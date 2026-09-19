import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from backend.app.models.operational import (
    Case, CoverageDecision, CalculationItem, DischargeBlocker
)
from backend.app.models.audit import AuditLog
from backend.app.services.trace_event_service import TraceEventService
from backend.app.services.calculation_engine import FinancialCalculationEngine
from backend.app.services.blocker_engine import ReadinessAndBlockerEngine

class CanonicalCaseState(str, Enum):
    DRAFT = "DRAFT"
    INTAKE_COMPLETE = "INTAKE_COMPLETE"
    EVALUATED = "EVALUATED"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    QUERY_RAISED = "QUERY_RAISED"
    QUERY_RESPONDED = "QUERY_RESPONDED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    DISCHARGE_REVIEW = "DISCHARGE_REVIEW"
    DISCHARGE_READY = "DISCHARGE_READY"
    DISCHARGED = "DISCHARGED"
    COMPLETED = "COMPLETED"

VALID_TRANSITIONS = {
    CanonicalCaseState.DRAFT: [CanonicalCaseState.INTAKE_COMPLETE],
    CanonicalCaseState.INTAKE_COMPLETE: [
        CanonicalCaseState.EVALUATED,
        CanonicalCaseState.READY_FOR_REVIEW
    ],
    CanonicalCaseState.EVALUATED: [
        CanonicalCaseState.READY_FOR_REVIEW,
        CanonicalCaseState.SUBMITTED
    ],
    CanonicalCaseState.READY_FOR_REVIEW: [
        CanonicalCaseState.SUBMITTED,
        CanonicalCaseState.EVALUATED
    ],
    CanonicalCaseState.SUBMITTED: [
        CanonicalCaseState.IN_REVIEW,
        CanonicalCaseState.APPROVED,
        CanonicalCaseState.REJECTED,
        CanonicalCaseState.QUERY_RAISED
    ],
    CanonicalCaseState.IN_REVIEW: [
        CanonicalCaseState.APPROVED,
        CanonicalCaseState.REJECTED,
        CanonicalCaseState.QUERY_RAISED
    ],
    CanonicalCaseState.QUERY_RAISED: [CanonicalCaseState.QUERY_RESPONDED],
    CanonicalCaseState.QUERY_RESPONDED: [
        CanonicalCaseState.IN_REVIEW,
        CanonicalCaseState.APPROVED,
        CanonicalCaseState.REJECTED
    ],
    CanonicalCaseState.APPROVED: [
        CanonicalCaseState.DISCHARGE_REVIEW,
        CanonicalCaseState.DISCHARGE_READY,
        CanonicalCaseState.DISCHARGED
    ],
    CanonicalCaseState.REJECTED: [
        CanonicalCaseState.COMPLETED,
        CanonicalCaseState.READY_FOR_REVIEW
    ],
    CanonicalCaseState.DISCHARGE_REVIEW: [
        CanonicalCaseState.DISCHARGE_READY,
        CanonicalCaseState.IN_REVIEW
    ],
    CanonicalCaseState.DISCHARGE_READY: [CanonicalCaseState.DISCHARGED],
    CanonicalCaseState.DISCHARGED: [CanonicalCaseState.COMPLETED],
    CanonicalCaseState.COMPLETED: []
}

class CaseWorkflowService:
    @staticmethod
    def transition(
        db: Session,
        case: Case,
        target_state: CanonicalCaseState,
        actor_role: str = "HOSPITAL_STAFF",
        actor_id: Optional[str] = None,
        reason: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> Case:
        current_state = case.case_status
        allowed = [s.value for s in VALID_TRANSITIONS.get(CanonicalCaseState(current_state), [])] if current_state in CanonicalCaseState.__members__ else []

        # Allow same state idempotency
        if current_state == target_state.value:
            return case

        if allowed and target_state.value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Illegal state transition from '{current_state}' to '{target_state.value}'. Allowed transitions: {allowed}"
            )

        previous_state = case.case_status
        case.case_status = target_state.value
        case.updated_at = datetime.utcnow()

        # Audit log creation
        audit = AuditLog(
            actor_role=actor_role,
            actor_id=actor_id or "system",
            action="CASE_STATE_TRANSITION",
            resource_type="CASE",
            resource_id=case.id,
            details={
                "previous_state": previous_state,
                "new_state": target_state.value,
                "reason": reason,
                "extra": extra_data or {}
            }
        )
        db.add(audit)
        db.flush()

        return case

    @classmethod
    def evaluate(cls, db: Session, case: Case, actor_role: str = "HOSPITAL_STAFF") -> Dict[str, Any]:
        """Calculates deterministic coverage, updates readiness, and transitions state."""
        # Clear previous decisions
        db.query(CoverageDecision).filter(CoverageDecision.case_id == case.id).delete()
        db.flush()

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

        # Evaluate readiness & blockers
        readiness = ReadinessAndBlockerEngine.evaluate_readiness(case)
        case.readiness_score = readiness["total_score"]
        case.readiness_band = readiness["band"]

        # Sync blockers in DB
        db.query(DischargeBlocker).filter(DischargeBlocker.case_id == case.id).delete()
        for b in readiness.get("blockers", []):
            blocker = DischargeBlocker(
                case_id=case.id,
                blocker_type=b["type"],
                severity=b["severity"],
                owner_role=b["owner_role"],
                description=b["description"],
                action_required=b["action_required"],
                is_resolved=False
            )
            db.add(blocker)

        cls.transition(
            db, case, CanonicalCaseState.EVALUATED, actor_role=actor_role,
            reason="Financial waterfall and readiness evaluation completed."
        )

        db.commit()
        return calc_res

    @classmethod
    def submit_preauth(cls, db: Session, case: Case, scenario: str = "SUCCESS", actor_role: str = "HOSPITAL_STAFF") -> Dict[str, Any]:
        """Submits case to Payer Gateway and executes canonical transition."""
        if case.case_status not in [CanonicalCaseState.EVALUATED.value, CanonicalCaseState.READY_FOR_REVIEW.value, CanonicalCaseState.INTAKE_COMPLETE.value]:
            cls.evaluate(db, case, actor_role=actor_role)

        # Transition to submitted
        cls.transition(db, case, CanonicalCaseState.SUBMITTED, actor_role=actor_role, reason="Pre-authorization packet dispatched to payer.")

        # Simulate or execute payer response
        if scenario == "QUERY":
            cls.transition(db, case, CanonicalCaseState.QUERY_RAISED, actor_role="PAYER_GATEWAY", reason="Insurer requested clinical investigation reports.")
            case.authorization_status = "QUERIED"
        elif scenario == "REJECTED":
            cls.transition(db, case, CanonicalCaseState.REJECTED, actor_role="PAYER_GATEWAY", reason="Pre-existing waiting period exclusion applies.")
            case.authorization_status = "REJECTED"
        else: # SUCCESS / Approved
            cls.transition(db, case, CanonicalCaseState.APPROVED, actor_role="PAYER_GATEWAY", reason="Initial pre-authorization approved under cashless terms.")
            case.authorization_status = "APPROVED"
            case.discharge_status = "IN_REVIEW"

        TraceEventService.record_event(
            db, "PREAUTH_SUBMITTED", case, actor_role="PAYER_GATEWAY",
            extra_data={"scenario": scenario, "status": case.authorization_status}
        )

        db.commit()
        return {
            "case_number": case.case_number,
            "case_status": case.case_status,
            "authorization_status": case.authorization_status,
            "readiness_score": case.readiness_score
        }

    @classmethod
    def discharge(cls, db: Session, case: Case, actor_role: str = "HOSPITAL_STAFF") -> Case:
        """Enforces blocker-free readiness check before authorizing discharge."""
        critical_blockers = [
            b for b in (case.blockers or []) if not b.is_resolved and b.severity in ["CRITICAL", "HIGH"]
        ]
        if critical_blockers:
            reasons = "; ".join([b.description for b in critical_blockers])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot authorize discharge. Active critical blockers: {reasons}"
            )

        cls.transition(db, case, CanonicalCaseState.DISCHARGED, actor_role=actor_role, reason="Discharge authorized by clinical and billing administration.")
        now = datetime.utcnow()
        case.discharge_status = "DISCHARGED"
        case.discharge_at = now
        case.discharged_at = now

        TraceEventService.record_event(
            db, "CASE_DISCHARGED", case, actor_role=actor_role,
            extra_data={"discharged_at": now.isoformat()}
        )

        db.commit()
        return case
