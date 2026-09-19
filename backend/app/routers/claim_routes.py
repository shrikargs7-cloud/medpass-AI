import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models.operational import Claim, ClaimQuery, Case, DischargeBlocker, CoverageDecision
from backend.app.services.trace_event_service import TraceEventService
from backend.app.services.case_workflow_service import CaseWorkflowService
from backend.app.integrations.n8n.dispatcher import N8NWebhookDispatcher

router = APIRouter(prefix="/claims", tags=["Claims"])

class ClaimQueryCreate(BaseModel):
    category: str = "CLINICAL_JUSTIFICATION"
    reason: str

class ClaimQueryRespondAction(BaseModel):
    response_notes: str
    document_ids: Optional[List[str]] = []

class ClaimDecisionAction(BaseModel):
    decision_reason: Optional[str] = None
    approved_amount: Optional[float] = None

class ClaimAcknowledgeAction(BaseModel):
    acknowledgement_number: Optional[str] = None
    status: str = "APPROVED"
    approved_amount: Optional[float] = None
    notes: Optional[str] = None

@router.get("")
def list_claims(status: Optional[str] = None, claim_type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Claim)
    if status:
        q = q.filter(Claim.status == status)
    if claim_type:
        q = q.filter(Claim.claim_type == claim_type)
    claims = q.order_by(Claim.submitted_at.desc()).all()

    results = []
    for c in claims:
        ctype = c.claim_type
        if not ctype:
            if c.status == "REJECTED" or (c.covered_amount or 0.0) == 0.0:
                ctype = "NO_CLAIM"
            elif c.status == "APPROVED" and (c.covered_amount or 0.0) >= (c.total_claimed or 0.0):
                ctype = "FULL_CLAIM"
            elif (c.covered_amount or 0.0) > 0.0 and (c.covered_amount or 0.0) < (c.total_claimed or 0.0):
                ctype = "PARTIAL_CLAIM"
            else:
                ctype = "PENDING"

        ctype_label = {
            "FULL_CLAIM": "Full Claim (100% Covered)",
            "PARTIAL_CLAIM": "Partial Claim (Deductions)",
            "NO_CLAIM": "No Claim (Rejected / Denied)",
            "PENDING": "Under Review"
        }.get(ctype, ctype)

        results.append({
            "id": c.id,
            "case_id": c.case_id,
            "case_number": c.case.case_number if c.case else "N/A",
            "hospital_name": c.case.hospital.name if (c.case and c.case.hospital) else "N/A",
            "patient_name": c.case.patient.full_name if (c.case and c.case.patient) else "N/A",
            "primary_diagnosis": f"{c.case.primary_diagnosis_code or ''} - {c.case.primary_diagnosis_name or ''}" if c.case else "N/A",
            "external_reference": c.external_reference,
            "ack_token": c.ack_token or (c.external_reference if (c.external_reference and "ACK" in c.external_reference) else None),
            "status": c.status,
            "claim_type": ctype,
            "claim_type_label": ctype_label,
            "adjudication_reason": c.adjudication_reason,
            "total_claimed": c.total_claimed or 0.0,
            "covered_amount": c.covered_amount or 0.0,
            "patient_payable": c.patient_payable if c.patient_payable is not None else max(0.0, (c.total_claimed or 0.0) - (c.covered_amount or 0.0)),
            "submitted_at": c.submitted_at,
            "decided_at": c.decided_at,
            "queries_count": len(c.queries or [])
        })

    return results

@router.get("/{claim_id}")
def get_claim(claim_id: str, db: Session = Depends(get_db)):
    c = db.query(Claim).filter((Claim.id == claim_id) | (Claim.external_reference == claim_id)).first()
    if not c:
        raise HTTPException(status_code=404, detail="Claim not found")

    ctype = c.claim_type
    if not ctype:
        if c.status == "REJECTED" or (c.covered_amount or 0.0) == 0.0:
            ctype = "NO_CLAIM"
        elif c.status == "APPROVED" and (c.covered_amount or 0.0) >= (c.total_claimed or 0.0):
            ctype = "FULL_CLAIM"
        elif (c.covered_amount or 0.0) > 0.0 and (c.covered_amount or 0.0) < (c.total_claimed or 0.0):
            ctype = "PARTIAL_CLAIM"
        else:
            ctype = "PENDING"

    return {
        "id": c.id,
        "case_id": c.case_id,
        "case_number": c.case.case_number if c.case else "N/A",
        "hospital_name": c.case.hospital.name if (c.case and c.case.hospital) else "N/A",
        "patient_name": c.case.patient.full_name if (c.case and c.case.patient) else "N/A",
        "primary_diagnosis": f"{c.case.primary_diagnosis_code or ''} - {c.case.primary_diagnosis_name or ''}" if c.case else "N/A",
        "external_reference": c.external_reference,
        "ack_token": c.ack_token or (c.external_reference if (c.external_reference and "ACK" in c.external_reference) else None),
        "status": c.status,
        "claim_type": ctype,
        "claim_type_label": {
            "FULL_CLAIM": "Full Claim (100% Covered)",
            "PARTIAL_CLAIM": "Partial Claim (Deductions)",
            "NO_CLAIM": "No Claim (Rejected / Denied)",
            "PENDING": "Under Review"
        }.get(ctype, ctype),
        "adjudication_reason": c.adjudication_reason,
        "total_claimed": c.total_claimed or 0.0,
        "covered_amount": c.covered_amount or 0.0,
        "patient_payable": c.patient_payable if c.patient_payable is not None else max(0.0, (c.total_claimed or 0.0) - (c.covered_amount or 0.0)),
        "submitted_at": c.submitted_at,
        "decided_at": c.decided_at,
        "queries_count": len(c.queries or [])
    }

@router.post("/{claim_id}/query")
def raise_claim_query(claim_id: str, payload: ClaimQueryCreate, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.status = "QUERIED"
    new_query = ClaimQuery(
        claim_id=claim.id,
        category=payload.category,
        reason=payload.reason,
        status="OPEN"
    )
    db.add(new_query)

    case = claim.case
    if case:
        case.case_status = "QUERIED"
        case.authorization_status = "QUERY_RAISED"

        # Add discharge blocker
        blocker = DischargeBlocker(
            case_id=case.id,
            blocker_type="INSURER_QUERY",
            severity="CRITICAL",
            owner_role="HOSPITAL_STAFF",
            description=f"Payer Query: {payload.reason}",
            action_required="Provide requested clinical documentation."
        )
        db.add(blocker)

    db.commit()

    if case:
        TraceEventService.record_event(db, "CLAIM_QUERIED", case, actor_role="INSURER_REVIEWER", extra_data={"query": payload.reason})
        N8NWebhookDispatcher.dispatch_case_event("CLAIM_QUERIED", {"claim_id": claim.id, "case_number": case.case_number, "reason": payload.reason})

    return {"message": "Query raised successfully", "query_id": new_query.id, "status": "QUERIED"}

@router.get("/{claim_id}/queries")
def list_claim_queries(claim_id: str, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return [
        {
            "id": q.id,
            "claim_id": q.claim_id,
            "category": q.category,
            "reason": q.reason,
            "status": q.status,
            "created_at": q.created_at,
            "resolved_at": q.resolved_at
        }
        for q in (claim.queries or [])
    ]

@router.post("/{claim_id}/query/{query_id}/respond")
def respond_to_claim_query(claim_id: str, query_id: str, payload: ClaimQueryRespondAction, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    query = db.query(ClaimQuery).filter(ClaimQuery.id == query_id, ClaimQuery.claim_id == claim.id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    query.status = "RESPONDED"
    query.resolved_at = datetime.utcnow()
    claim.status = "QUERY_RESPONDED"

    case = claim.case
    if case:
        case.case_status = "QUERY_RESPONDED"
        case.authorization_status = "QUERY_RESPONDED"

        # Resolve or update insurer query blocker
        for b in (case.blockers or []):
            if b.blocker_type == "INSURER_QUERY":
                b.is_resolved = True
                b.resolved_at = datetime.utcnow()

    db.commit()

    if case:
        TraceEventService.record_event(
            db, "CLAIM_QUERY_RESPONDED", case,
            actor_role="HOSPITAL_STAFF",
            extra_data={"query_id": query.id, "response_notes": payload.response_notes}
        )
        N8NWebhookDispatcher.dispatch_case_event("CLAIM_QUERY_RESPONDED", {
            "claim_id": claim.id,
            "case_number": case.case_number,
            "query_id": query.id,
            "response_notes": payload.response_notes
        })

    return {
        "message": "Query response submitted to payer via NHCX gateway",
        "claim_id": claim.id,
        "query_id": query.id,
        "status": "QUERY_RESPONDED"
    }

@router.post("/{claim_id}/approve")
def approve_claim(claim_id: str, payload: ClaimDecisionAction, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.status = "APPROVED"
    claim.decided_at = datetime.utcnow()
    total = float(claim.total_claimed or 0.0)
    if payload.approved_amount is not None:
        claim.covered_amount = float(payload.approved_amount)
    else:
        claim.covered_amount = total

    claim.patient_payable = max(0.0, total - claim.covered_amount)
    if claim.covered_amount >= total and total > 0:
        claim.claim_type = "FULL_CLAIM"
    elif claim.covered_amount > 0:
        claim.claim_type = "PARTIAL_CLAIM"
    else:
        claim.claim_type = "NO_CLAIM"

    case = claim.case
    if case:
        case.case_status = "APPROVED"
        case.authorization_status = "APPROVED"

        # Clear previous decisions and populate fresh CoverageDecision records for line items
        db.query(CoverageDecision).filter(CoverageDecision.case_id == case.id).delete()
        db.flush()

        ratio = (claim.covered_amount / total) if total > 0 else 1.0
        for li in (case.line_items or []):
            gross = float(li.gross_amount or 0.0)
            it_covered = round(gross * ratio, 2)
            it_payable = max(0.0, round(gross - it_covered, 2))
            dec_status = "COVERED" if it_covered >= gross else ("EXCLUDED" if it_covered == 0 else "PARTIALLY_COVERED")

            decision = CoverageDecision(
                case_id=case.id,
                line_item_id=li.id,
                decision_status=dec_status,
                eligible_amount=gross,
                covered_amount=it_covered,
                patient_payable=it_payable,
                confidence=1.0,
                rule_id="INSURER_CLEARANCE",
                policy_field="PREAUTH_APPROVED",
                requires_human_review=False,
                explanation=f"Preauthorization approved by payer ({claim.external_reference or 'Cashless Clearance'})."
            )
            db.add(decision)

        # Resolve insurer blockers
        for b in (case.blockers or []):
            if b.blocker_type in ["INSURANCE_AUTHORIZATION", "INSURER_QUERY"]:
                b.is_resolved = True
                b.resolved_at = datetime.utcnow()

    db.commit()

    if case:
        TraceEventService.record_event(db, "CLAIM_APPROVED", case, actor_role="INSURER_REVIEWER", extra_data={"amount": claim.covered_amount})
        N8NWebhookDispatcher.dispatch_case_event("CLAIM_APPROVED", {"claim_id": claim.id, "case_number": case.case_number, "covered_amount": claim.covered_amount})

    return {"message": "Claim preauthorization approved by payer", "status": "APPROVED", "covered_amount": claim.covered_amount}

@router.post("/{claim_id}/reject")
def reject_claim(claim_id: str, payload: ClaimDecisionAction, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.status = "REJECTED"
    claim.decided_at = datetime.utcnow()
    claim.covered_amount = 0.0
    claim.patient_payable = float(claim.total_claimed or 0.0)
    claim.claim_type = "NO_CLAIM"

    case = claim.case
    if case:
        case.case_status = "REJECTED"
        case.authorization_status = "REJECTED"

        for d in (case.decisions or []):
            d.covered_amount = 0.0
            d.patient_payable = d.line_item.gross_amount if d.line_item else (d.eligible_amount or 0.0)
            d.decision_status = "EXCLUDED"
            d.explanation = f"Pre-authorization rejected by payer: {payload.decision_reason or 'Policy exclusion'}"

    db.commit()

    if case:
        TraceEventService.record_event(db, "CLAIM_REJECTED", case, actor_role="INSURER_REVIEWER", extra_data={"reason": payload.decision_reason})
        N8NWebhookDispatcher.dispatch_case_event("CLAIM_REJECTED", {"claim_id": claim.id, "case_number": case.case_number, "reason": payload.decision_reason})

    return {"message": "Claim rejected by payer", "status": "REJECTED"}

@router.post("/{claim_id}/acknowledge")
def acknowledge_claim(claim_id: str, payload: ClaimAcknowledgeAction, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    ack_token = payload.acknowledgement_number or f"ACK-NHCX-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    claim.external_reference = ack_token
    claim.status = payload.status
    claim.decided_at = datetime.utcnow()
    total = float(claim.total_claimed or 0.0)

    case = claim.case
    if payload.status == "APPROVED":
        if payload.approved_amount is not None:
            claim.covered_amount = float(payload.approved_amount)
        else:
            claim.covered_amount = total
        claim.patient_payable = max(0.0, total - claim.covered_amount)
        if claim.covered_amount >= total and total > 0:
            claim.claim_type = "FULL_CLAIM"
        elif claim.covered_amount > 0:
            claim.claim_type = "PARTIAL_CLAIM"
        else:
            claim.claim_type = "NO_CLAIM"

        if case:
            case.case_status = "APPROVED"
            case.authorization_status = "APPROVED"

            # Clear previous decisions and populate fresh CoverageDecision records for line items
            db.query(CoverageDecision).filter(CoverageDecision.case_id == case.id).delete()
            db.flush()

            ratio = (claim.covered_amount / total) if total > 0 else 1.0
            for li in (case.line_items or []):
                gross = float(li.gross_amount or 0.0)
                it_covered = round(gross * ratio, 2)
                it_payable = max(0.0, round(gross - it_covered, 2))
                dec_status = "COVERED" if it_covered >= gross else ("EXCLUDED" if it_covered == 0 else "PARTIALLY_COVERED")

                decision = CoverageDecision(
                    case_id=case.id,
                    line_item_id=li.id,
                    decision_status=dec_status,
                    eligible_amount=gross,
                    covered_amount=it_covered,
                    patient_payable=it_payable,
                    confidence=1.0,
                    rule_id="INSURER_CLEARANCE",
                    policy_field="PREAUTH_APPROVED",
                    requires_human_review=False,
                    explanation=f"Preauthorization acknowledged by payer ({ack_token})."
                )
                db.add(decision)

            for b in (case.blockers or []):
                if b.blocker_type in ["INSURANCE_AUTHORIZATION", "INSURER_QUERY"]:
                    b.is_resolved = True
                    b.resolved_at = datetime.utcnow()
    elif payload.status == "REJECTED":
        claim.covered_amount = 0.0
        claim.patient_payable = total
        claim.claim_type = "NO_CLAIM"
        if case:
            case.case_status = "REJECTED"
            case.authorization_status = "REJECTED"
            for d in (case.decisions or []):
                d.covered_amount = 0.0
                d.patient_payable = d.line_item.gross_amount if d.line_item else (d.eligible_amount or 0.0)
                d.decision_status = "EXCLUDED"
    elif payload.status == "QUERY_RAISED":
        if case:
            case.case_status = "QUERIED"
            case.authorization_status = "QUERY_RAISED"
            blocker = DischargeBlocker(
                case_id=case.id,
                blocker_type="INSURER_QUERY",
                severity="CRITICAL",
                owner_role="HOSPITAL_STAFF",
                description=payload.notes or "Payer requested additional documentation.",
                action_required="Hospital staff must upload required medical evidence."
            )
            db.add(blocker)

    db.commit()
    if case:
        TraceEventService.record_event(db, f"CLAIM_ACK_{payload.status}", case, actor_role="INSURER_REVIEWER", extra_data={"ack": ack_token, "notes": payload.notes})
        N8NWebhookDispatcher.dispatch_case_event(f"CLAIM_ACK_{payload.status}", {
            "claim_id": claim.id,
            "case_number": case.case_number,
            "ack_number": ack_token,
            "status": payload.status,
            "covered_amount": claim.covered_amount
        })

    return {
        "message": "Payer acknowledgement issued successfully",
        "acknowledgement_number": ack_token,
        "status": claim.status,
        "covered_amount": claim.covered_amount
    }

