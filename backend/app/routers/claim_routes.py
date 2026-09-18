import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models.operational import Claim, ClaimQuery, Case, DischargeBlocker
from backend.app.services.trace_event_service import TraceEventService
from backend.app.integrations.n8n.dispatcher import N8NWebhookDispatcher

router = APIRouter(prefix="/claims", tags=["Claims"])

class ClaimQueryCreate(BaseModel):
    category: str = "CLINICAL_JUSTIFICATION"
    reason: str

class ClaimDecisionAction(BaseModel):
    decision_reason: Optional[str] = None
    approved_amount: Optional[float] = None

class ClaimAcknowledgeAction(BaseModel):
    acknowledgement_number: Optional[str] = None
    status: str = "APPROVED"
    approved_amount: Optional[float] = None
    notes: Optional[str] = None

@router.get("")
def list_claims(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Claim)
    if status:
        q = q.filter(Claim.status == status)
    claims = q.order_by(Claim.submitted_at.desc()).all()

    return [
        {
            "id": c.id,
            "case_id": c.case_id,
            "case_number": c.case.case_number if c.case else "N/A",
            "hospital_name": c.case.hospital.name if (c.case and c.case.hospital) else "N/A",
            "patient_name": c.case.patient.full_name if (c.case and c.case.patient) else "N/A",
            "external_reference": c.external_reference,
            "status": c.status,
            "total_claimed": c.total_claimed,
            "covered_amount": c.covered_amount,
            "submitted_at": c.submitted_at,
            "queries_count": len(c.queries or [])
        }
        for c in claims
    ]

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

@router.post("/{claim_id}/approve")
def approve_claim(claim_id: str, payload: ClaimDecisionAction, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim.status = "APPROVED"
    claim.decided_at = datetime.utcnow()
    if payload.approved_amount is not None:
        claim.covered_amount = payload.approved_amount

    case = claim.case
    if case:
        case.case_status = "APPROVED"
        case.authorization_status = "APPROVED"

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

    case = claim.case
    if case:
        case.case_status = "REJECTED"
        case.authorization_status = "REJECTED"

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
    if payload.approved_amount is not None:
        claim.covered_amount = payload.approved_amount

    case = claim.case
    if case:
        case.authorization_status = payload.status
        if payload.status == "APPROVED":
            case.case_status = "APPROVED"
            for b in (case.blockers or []):
                if b.blocker_type in ["INSURANCE_AUTHORIZATION", "INSURER_QUERY"]:
                    b.is_resolved = True
                    b.resolved_at = datetime.utcnow()
        elif payload.status == "QUERY_RAISED":
            case.case_status = "QUERIED"
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

