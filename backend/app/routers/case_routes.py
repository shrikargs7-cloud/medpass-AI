import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models.operational import (
    Case, Patient, Hospital, Policy, TreatmentLineItem, CoverageDecision,
    CalculationItem, DischargeBlocker, Claim, Insurer, PolicyRule
)
from backend.app.schemas.case import (
    CaseCreate, CaseUpdate, CaseDetailResponse, ReadinessScoreBreakdown,
    CoverageDecisionResponse, DischargeBlockerResponse, ClaimResponseSchema,
    LineItemCreate, BlockerCreate, PolicyBriefResponse, PolicyCreatePayload
)
from backend.app.services.policy_engine import DeterministicPolicyEngine
from backend.app.services.calculation_engine import FinancialCalculationEngine
from backend.app.services.blocker_engine import ReadinessAndBlockerEngine
from backend.app.services.trace_event_service import TraceEventService
from backend.app.services.case_workflow_service import CaseWorkflowService, CanonicalCaseState
from backend.app.integrations.beeceptor.client import BeeceptorIntegrationClient
from backend.app.integrations.n8n.dispatcher import N8NWebhookDispatcher

router = APIRouter(prefix="/cases", tags=["Cases"])

@router.post("", response_model=CaseDetailResponse)
def create_case(payload: CaseCreate, db: Session = Depends(get_db)):
    # 1. Ensure patient exists or create
    patient = db.query(Patient).filter(Patient.patient_ref == payload.patient.patient_ref).first()
    if not patient:
        patient = Patient(
            patient_ref=payload.patient.patient_ref,
            full_name=payload.patient.full_name,
            dob=payload.patient.dob,
            age_band=payload.patient.age_band,
            sex_at_birth=payload.patient.sex_at_birth,
            broad_region=payload.patient.broad_region,
            phone=payload.patient.phone,
            email=payload.patient.email
        )
        db.add(patient)
        db.flush()

    # 2. Verify hospital
    hospital = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
    if not hospital:
        # Fallback to first available or create default
        hospital = db.query(Hospital).first()
        if not hospital:
            hospital = Hospital(hospital_ref="HOSP-APOLLO-001", name="Apollo Multi-Specialty Hospital", hospital_tier="TIER_1")
            db.add(hospital)
            db.flush()

    # 3. Create Case
    case_num = f"MED-{datetime.utcnow().strftime('%Y%m')}-{str(uuid.uuid4())[:6].upper()}"
    new_case = Case(
        patient_id=patient.id,
        hospital_id=hospital.id,
        policy_id=payload.policy_id,
        case_number=case_num,
        case_status="INTAKE_COMPLETE",
        authorization_status="PENDING",
        discharge_status="NOT_READY",
        primary_diagnosis_code=payload.primary_diagnosis_code,
        primary_diagnosis_name=payload.primary_diagnosis_name,
        admission_at=payload.admission_at or datetime.utcnow()
    )
    db.add(new_case)
    db.flush()

    # 4. Add Line Items
    for it in payload.line_items:
        gross = it.unit_amount * it.quantity
        line_item = TreatmentLineItem(
            case_id=new_case.id,
            category=it.category,
            code=it.code,
            code_system=it.code_system,
            description=it.description,
            quantity=it.quantity,
            unit_amount=it.unit_amount,
            gross_amount=gross,
            performed_at=it.performed_at or datetime.utcnow()
        )
        db.add(line_item)
    db.flush()

    # 5. Evaluate Readiness and Blockers
    readiness = ReadinessAndBlockerEngine.evaluate_readiness(new_case)
    new_case.readiness_score = readiness["total_score"]
    new_case.readiness_band = readiness["band"]

    blockers = ReadinessAndBlockerEngine.identify_blockers(new_case)
    for b in blockers:
        blocker_rec = DischargeBlocker(
            case_id=new_case.id,
            blocker_type=b["blocker_type"],
            severity=b["severity"],
            owner_role=b["owner_role"],
            description=b["description"],
            action_required=b.get("action_required")
        )
        db.add(blocker_rec)
    db.flush()
    # 6. Create initial inbound Claim in SUBMITTED / PENDING state so insurer person can review & adjudicate it
    total_gross = sum(float(it.unit_amount * it.quantity) for it in payload.line_items)
    new_claim = Claim(
        case_id=new_case.id,
        external_reference=f"CLM-INBOUND-{new_case.case_number.split('-')[-1]}",
        status="SUBMITTED",
        claim_type="PENDING",
        total_claimed=total_gross or 45000.0,
        covered_amount=0.0,
        patient_payable=total_gross or 45000.0,
        adjudication_reason="New hospital admission intake complete. Awaiting insurer medical review and pre-authorization approval."
    )
    db.add(new_claim)
    db.commit()

    # Record outbox domain event
    TraceEventService.record_event(db, "CASE_CREATED", new_case, actor_role="HOSPITAL_STAFF")
    N8NWebhookDispatcher.dispatch_case_event("CASE_CREATED", {"case_number": new_case.case_number, "status": new_case.case_status})

    db.refresh(new_case)
    return new_case

@router.get("", response_model=List[CaseDetailResponse])
def list_cases(
    status: Optional[str] = None,
    band: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(Case)
    if status:
        q = q.filter(Case.case_status == status)
    if band:
        q = q.filter(Case.readiness_band == band)
    cases = q.order_by(Case.created_at.desc()).all()

    # Compute totals dynamically for response
    for c in cases:
        gross = sum(float(i.gross_amount) for i in (c.line_items or []))
        if c.authorization_status == "APPROVED":
            covered = sum(float(d.covered_amount) for d in (c.decisions or []))
            payable = sum(float(d.patient_payable) for d in (c.decisions or []))
        else:
            covered = 0.0
            payable = gross
        c.total_gross = gross
        c.total_covered = covered
        c.total_patient_payable = payable

    return cases

@router.get("/{case_id}", response_model=CaseDetailResponse)
def get_case_detail(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    gross = sum(float(i.gross_amount) for i in (case.line_items or []))
    if case.authorization_status == "APPROVED":
        covered = sum(float(d.covered_amount) for d in (case.decisions or []))
        payable = sum(float(d.patient_payable) for d in (case.decisions or []))
    else:
        covered = 0.0
        payable = gross
    case.total_gross = gross
    case.total_covered = covered
    case.total_patient_payable = payable

    return case

@router.post("/{case_id}/evaluate", response_model=CaseDetailResponse)
def evaluate_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    calc_res = CaseWorkflowService.evaluate(db, case)
    return get_case_detail(case.id, db)

@router.post("/{case_id}/discharge", response_model=CaseDetailResponse)
def discharge_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case = CaseWorkflowService.discharge(db, case)
    return get_case_detail(case.id, db)

@router.post("/{case_id}/submit")
async def submit_case_preauth(
    case_id: str,
    scenario: str = Query("PENDING", description="Beeceptor mock scenario: PENDING, SUCCESS, QUERY, REJECTION, TIMEOUT, 500"),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    gross = sum(float(i.gross_amount) for i in (case.line_items or []))
    tx_ref = f"BEE-PREAUTH-{str(uuid.uuid4())[:8].upper()}"

    # Set case state to SUBMITTED awaiting insurance officer adjudication
    case.case_status = "SUBMITTED"
    case.authorization_status = "PREAUTH_REQUESTED"

    # Ensure an active insurance blocker is present indicating awaiting insurer approval
    has_auth_blocker = any(b.blocker_type == "INSURANCE_AUTHORIZATION" and not b.is_resolved for b in (case.blockers or []))
    if not has_auth_blocker:
        auth_blocker = DischargeBlocker(
            case_id=case.id,
            blocker_type="INSURANCE_AUTHORIZATION",
            severity="HIGH",
            owner_role="INSURER_REVIEWER",
            description="Awaiting pre-authorization review and approval from insurance officer.",
            action_required="Insurance officer must review medical records and issue cashless clearance or query."
        )
        db.add(auth_blocker)

    # Find existing claim or create new inbound claim in SUBMITTED state
    claim = db.query(Claim).filter(Claim.case_id == case.id).first()
    if not claim:
        claim = Claim(
            case_id=case.id,
            external_reference=tx_ref,
            status="SUBMITTED",
            claim_type="PENDING",
            total_claimed=gross or 45000.0,
            covered_amount=0.0,
            patient_payable=gross or 45000.0,
            adjudication_reason="Pre-authorization dossier transmitted by hospital. Awaiting adjudication and decision from insurance person."
        )
        db.add(claim)
    else:
        claim.status = "SUBMITTED"
        claim.claim_type = "PENDING"
        claim.total_claimed = gross or claim.total_claimed
        claim.covered_amount = 0.0
        claim.patient_payable = claim.total_claimed
        claim.adjudication_reason = "Pre-authorization dossier transmitted by hospital. Awaiting adjudication and decision from insurance person."

    db.commit()

    TraceEventService.record_event(
        db, "PREAUTH_TRANSMITTED", case, actor_role="HOSPITAL_STAFF", extra_data={"reference": claim.external_reference}
    )
    N8NWebhookDispatcher.dispatch_case_event("PREAUTH_TRANSMITTED", {
        "case_number": case.case_number,
        "external_reference": claim.external_reference,
        "status": "SUBMITTED"
    })

    return {
        "case_id": case.id,
        "case_number": case.case_number,
        "authorization_status": case.authorization_status,
        "status": "SUBMITTED",
        "message": "Pre-authorization transmitted to Insurer Gateway. Awaiting review and decision by insurance officer."
    }

@router.post("/{case_id}/resolve-blocker/{blocker_id}")
def resolve_blocker(case_id: str, blocker_id: str, db: Session = Depends(get_db)):
    blocker = db.query(DischargeBlocker).filter(
        DischargeBlocker.id == blocker_id,
        DischargeBlocker.case_id == case_id
    ).first()
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")

    blocker.is_resolved = True
    blocker.resolved_at = datetime.utcnow()

    # Re-check readiness
    case = db.query(Case).filter(Case.id == case_id).first()
    active_b = [b for b in (case.blockers or []) if not b.is_resolved]
    if not active_b and case.case_status == "APPROVED":
        case.discharge_status = "READY"
        case.case_status = "DISCHARGE_READY"

    db.commit()

    TraceEventService.record_event(
        db, "DISCHARGE_BLOCKER_RESOLVED", case, actor_role="HOSPITAL_STAFF",
        extra_data={"blocker_id": blocker_id, "type": blocker.blocker_type}
    )
    return {"message": "Blocker marked as resolved", "blocker_id": blocker_id, "is_resolved": True}

def _recalc_and_enrich_case(case: Case, db: Session):
    """Internal helper to recalculate financials and readiness after any case mutation."""
    db.query(CoverageDecision).filter(CoverageDecision.case_id == case.id).delete()
    db.flush()

    if case.policy and case.line_items:
        calc_res = FinancialCalculationEngine.calculate_case_financials(
            case.policy, case.line_items, case.primary_diagnosis_code
        )
        for ld in calc_res["line_decisions"]:
            decision = CoverageDecision(
                case_id=case.id,
                line_item_id=ld["line_item_id"],
                decision_status=ld["decision_status"],
                eligible_amount=ld["eligible_amount"],
                covered_amount=ld["covered_amount"],
                patient_payable=ld["patient_payable"],
                confidence=ld["confidence"],
                rule_id=ld["rule_id"],
                policy_field=ld["policy_field"],
                requires_human_review=ld["requires_human_review"],
                explanation=ld["explanation"]
            )
            db.add(decision)
            db.flush()

            for stg in ld.get("stages", []):
                ci = CalculationItem(
                    decision_id=decision.id,
                    stage=stg["stage"],
                    stage_name=stg["stage_name"],
                    input_amount=stg["input_amount"],
                    adjustment_amount=stg["adjustment_amount"],
                    output_amount=stg["output_amount"],
                    formula=stg.get("formula")
                )
                db.add(ci)

    readiness = ReadinessAndBlockerEngine.evaluate_readiness(case)
    case.readiness_score = readiness["total_score"]
    case.readiness_band = readiness["band"]

    db.commit()
    db.refresh(case)

    # Compute runtime totals
    gross = sum(float(i.gross_amount) for i in (case.line_items or []))
    covered = sum(float(d.covered_amount) for d in (case.decisions or []))
    payable = sum(float(d.patient_payable) for d in (case.decisions or []))
    case.total_gross = gross
    case.total_covered = covered
    case.total_patient_payable = payable if covered > 0 else gross
    return case

@router.put("/{case_id}", response_model=CaseDetailResponse)
def update_case(case_id: str, payload: CaseUpdate, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if payload.primary_diagnosis_code is not None:
        case.primary_diagnosis_code = payload.primary_diagnosis_code
    if payload.primary_diagnosis_name is not None:
        case.primary_diagnosis_name = payload.primary_diagnosis_name
    if payload.admission_at is not None:
        case.admission_at = payload.admission_at
    if payload.discharge_at is not None:
        case.discharge_at = payload.discharge_at
    # State machine protection: domain workflow validation
    if payload.case_status is not None and payload.case_status != case.case_status:
        allowed_case_transitions = {
            "INTAKE_PENDING": ["INTAKE_COMPLETE"],
            "INTAKE_COMPLETE": ["READY_FOR_REVIEW", "EVALUATED"],
            "READY_FOR_REVIEW": ["SUBMITTED_TO_PAYER", "CLOSED"],
            "SUBMITTED_TO_PAYER": ["ADJUDICATED", "QUERY_PENDING"],
            "QUERY_PENDING": ["QUERY_RESPONDED", "SUBMITTED_TO_PAYER"],
            "ADJUDICATED": ["DISCHARGE_READY", "SETTLED"],
            "DISCHARGE_READY": ["CLOSED"],
            "SETTLED": ["CLOSED"],
        }
        valid_next = allowed_case_transitions.get(case.case_status, [])
        if payload.case_status not in valid_next:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid case state transition from '{case.case_status}' to '{payload.case_status}'. Transitions must occur through domain actions."
            )
        case.case_status = payload.case_status

    if payload.authorization_status is not None and payload.authorization_status != case.authorization_status:
        allowed_auth_transitions = {
            "NOT_INITIATED": ["PENDING_SUBMISSION", "SUBMITTED"],
            "PENDING_SUBMISSION": ["SUBMITTED"],
            "SUBMITTED": ["IN_REVIEW", "QUERY_RAISED", "APPROVED", "REJECTED"],
            "QUERY_RAISED": ["QUERY_RESPONDED", "APPROVED", "REJECTED"],
            "QUERY_RESPONDED": ["APPROVED", "REJECTED"],
            "APPROVED": ["DISCHARGE_AUTHORIZED"],
            "REJECTED": ["APPEALED", "CLOSED"],
        }
        valid_auth = allowed_auth_transitions.get(case.authorization_status, [])
        if payload.authorization_status not in valid_auth:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid authorization transition from '{case.authorization_status}' to '{payload.authorization_status}'. Must be transitioned via Insurer Adjudication."
            )
        case.authorization_status = payload.authorization_status

    if payload.discharge_status is not None and payload.discharge_status != case.discharge_status:
        active_blockers = [b for b in (case.blockers or []) if not b.is_resolved and b.severity in ("CRITICAL", "HIGH")]
        if payload.discharge_status in ("DISCHARGE_READY", "DISCHARGED") and active_blockers:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition discharge status to '{payload.discharge_status}' while {len(active_blockers)} active blocker(s) remain unresolved."
            )
        case.discharge_status = payload.discharge_status
    if payload.policy_id is not None:
        case.policy_id = payload.policy_id
    if payload.hospital_id is not None:
        case.hospital_id = payload.hospital_id

    case = _recalc_and_enrich_case(case, db)
    TraceEventService.record_event(db, "CASE_UPDATED", case, actor_role="HOSPITAL_STAFF")
    return case

@router.delete("/{case_id}")
def delete_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case_num = case.case_number
    db.delete(case)
    db.commit()

    return {"status": "deleted", "case_id": case_id, "case_number": case_num}

@router.post("/{case_id}/line-items", response_model=CaseDetailResponse)
def add_line_item(case_id: str, item: LineItemCreate, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    gross = item.unit_amount * item.quantity
    new_item = TreatmentLineItem(
        case_id=case.id,
        category=item.category,
        code=item.code,
        code_system=item.code_system,
        description=item.description,
        quantity=item.quantity,
        unit_amount=item.unit_amount,
        gross_amount=gross,
        performed_at=item.performed_at or datetime.utcnow()
    )
    db.add(new_item)
    db.flush()

    case = _recalc_and_enrich_case(case, db)
    return case

@router.put("/{case_id}/line-items/{item_id}", response_model=CaseDetailResponse)
def update_line_item(case_id: str, item_id: str, item: LineItemCreate, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    db_item = db.query(TreatmentLineItem).filter(
        TreatmentLineItem.id == item_id,
        TreatmentLineItem.case_id == case.id
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Line item not found")

    db_item.category = item.category
    db_item.code = item.code
    db_item.code_system = item.code_system
    db_item.description = item.description
    db_item.quantity = item.quantity
    db_item.unit_amount = item.unit_amount
    db_item.gross_amount = item.unit_amount * item.quantity
    db.flush()

    case = _recalc_and_enrich_case(case, db)
    return case

@router.delete("/{case_id}/line-items/{item_id}", response_model=CaseDetailResponse)
def delete_line_item(case_id: str, item_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    db_item = db.query(TreatmentLineItem).filter(
        TreatmentLineItem.id == item_id,
        TreatmentLineItem.case_id == case.id
    ).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Line item not found")

    db.delete(db_item)
    db.flush()

    case = _recalc_and_enrich_case(case, db)
    return case

@router.post("/{case_id}/blockers", response_model=CaseDetailResponse)
def add_case_blocker(case_id: str, payload: BlockerCreate, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    blocker = DischargeBlocker(
        case_id=case.id,
        blocker_type=payload.blocker_type,
        severity=payload.severity,
        owner_role=payload.owner_role,
        description=payload.description,
        action_required=payload.action_required
    )
    db.add(blocker)
    db.commit()

    case = _recalc_and_enrich_case(case, db)
    return case

@router.delete("/{case_id}/blockers/{blocker_id}", response_model=CaseDetailResponse)
def delete_case_blocker(case_id: str, blocker_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    b = db.query(DischargeBlocker).filter(
        DischargeBlocker.id == blocker_id,
        DischargeBlocker.case_id == case.id
    ).first()
    if b:
        db.delete(b)
        db.commit()

    case = _recalc_and_enrich_case(case, db)
    return case

@router.get("/aux/policies", response_model=List[PolicyBriefResponse])
def get_available_policies(db: Session = Depends(get_db)):
    policies = db.query(Policy).all()
    return policies

@router.post("/aux/policies", response_model=PolicyBriefResponse)
def create_new_policy(payload: PolicyCreatePayload, db: Session = Depends(get_db)):
    # Check if policy_ref already exists
    existing = db.query(Policy).filter(Policy.policy_ref == payload.policy_ref).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Policy with ID '{payload.policy_ref}' already exists")

    insurer = None
    if payload.insurer_id:
        insurer = db.query(Insurer).filter(Insurer.id == payload.insurer_id).first()
    if not insurer:
        insurer = db.query(Insurer).first()
        if not insurer:
            insurer = Insurer(insurer_ref="STAR-HEALTH", name="Star Health & Allied Insurance")
            db.add(insurer)
            db.flush()

    new_policy = Policy(
        insurer_id=insurer.id,
        policy_ref=payload.policy_ref.strip().upper(),
        plan_name=payload.plan_name.strip(),
        plan_type=payload.plan_type,
        network_type=payload.network_type,
        sum_insured=payload.sum_insured,
        deductible=payload.deductible,
        co_pay_pct=payload.co_pay_pct,
        room_rent_cap=payload.room_rent_cap,
        icu_rent_cap=payload.icu_rent_cap,
        custom_fields=payload.custom_fields or [],
        effective_from=datetime.utcnow().date(),
        effective_to=datetime.utcnow().date().replace(year=datetime.utcnow().year + 1)
    )
    db.add(new_policy)
    db.flush()

    # Automatically attach deterministic calculation rules
    r_room = PolicyRule(
        policy_id=new_policy.id,
        rule_code=f"RULE-ROOM-{new_policy.policy_ref}",
        rule_type="ROOM_LIMIT",
        priority=40,
        conditions={"category": "ROOM_RENT"},
        action={"type": "CAP_PER_DAY", "limit": payload.room_rent_cap},
        source_clause_ref="Clause 4.1 Daily Room Rent Cap"
    )
    r_copay = PolicyRule(
        policy_id=new_policy.id,
        rule_code=f"RULE-COPAY-{new_policy.policy_ref}",
        rule_type="COPAY",
        priority=60,
        conditions={},
        action={"type": "PERCENTAGE", "percentage": payload.co_pay_pct},
        source_clause_ref="Clause 6.2 Co-payment Share"
    )
    db.add_all([r_room, r_copay])
    db.commit()
    db.refresh(new_policy)
    return new_policy

@router.delete("/aux/policies/{policy_id}")
def delete_policy(policy_id: str, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter((Policy.id == policy_id) | (Policy.policy_ref == policy_id)).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    db.delete(policy)
    db.commit()
    return {"message": "Policy deleted successfully", "policy_id": policy_id}

@router.get("/aux/hospitals")
def get_available_hospitals(db: Session = Depends(get_db)):
    hospitals = db.query(Hospital).all()
    return [{"id": h.id, "name": h.name, "hospital_tier": h.hospital_tier} for h in hospitals]


