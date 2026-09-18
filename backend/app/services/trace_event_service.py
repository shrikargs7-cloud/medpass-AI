import json
import hashlib
import uuid
from datetime import datetime, date
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.config import settings
from backend.app.models.audit import OutboxEvent, AuditLog
from backend.app.models.operational import Case
from backend.app.models.trace import (
    TraceSubject, TraceFacility, TraceEncounter, TraceCondition,
    TraceProcedure, TraceInsuranceEvent, TraceWorkflowEvent, TraceOutcome
)
from backend.app.services.privacy_service import PrivacyDeidentificationService

INSURANCE_EVENT_TYPES = {
    "PREAUTH_REQUESTED", "PREAUTH_SUBMITTED", "PREAUTH_APPROVED",
    "PREAUTH_REJECTED", "PREAUTH_QUERY", "CLAIM_SUBMITTED",
    "CLAIM_QUERY", "CLAIM_APPROVED", "CLAIM_REJECTED", "CLAIM_SETTLED"
}

class TraceEventService:
    """
    Manages Transactional Outbox and synchronizes domain workflow events
    into the governed Trace Commons schema after passing through the privacy gate.
    Strictly decouples operational identifiers from research identities.
    """

    @staticmethod
    def record_event(
        db: Session,
        event_type: str,
        case: Case,
        actor_id: str = "SYSTEM",
        actor_role: str = "SYSTEM",
        extra_data: Optional[Dict[str, Any]] = None
    ) -> OutboxEvent:
        payload = {
            "case_id": case.id,
            "case_number": case.case_number,
            "hospital_id": case.hospital_id,
            "policy_id": case.policy_id,
            "case_status": case.case_status,
            "authorization_status": case.authorization_status,
            "readiness_score": case.readiness_score,
            "primary_diagnosis_code": case.primary_diagnosis_code,
            "primary_diagnosis_name": case.primary_diagnosis_name,
            "admission_at": case.admission_at.isoformat() if case.admission_at else None,
            "discharge_at": case.discharge_at.isoformat() if case.discharge_at else None,
            "extra_data": extra_data or {}
        }

        # 1. Write to Outbox
        outbox = OutboxEvent(
            event_type=event_type,
            aggregate_type="Case",
            aggregate_id=case.id,
            payload=payload,
            status="PENDING"
        )
        db.add(outbox)

        # 2. Write to AuditLog
        audit = AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=event_type,
            resource_type="CASE",
            resource_id=case.id,
            details=payload
        )
        db.add(audit)

        # 3. Synchronize to Trace schema through Privacy Gate
        TraceEventService._project_to_trace(db, event_type, case, payload)

        outbox.status = "PROCESSED"
        outbox.processed_at = datetime.utcnow()
        db.commit()
        return outbox

    @staticmethod
    def _project_to_trace(db: Session, event_type: str, case: Case, payload: Dict[str, Any]):
        patient = case.patient
        if not patient:
            return

        # 1. Pseudonymize Subject
        subject_key = PrivacyDeidentificationService.generate_subject_key(patient.id)
        subject = db.query(TraceSubject).filter(TraceSubject.subject_key == subject_key).first()
        if not subject:
            subject = TraceSubject(
                subject_key=subject_key,
                age_band=patient.age_band or "31-45",
                sex_category=patient.sex_at_birth or "MALE",
                region_bucket=patient.broad_region or "REGION_NORTH"
            )
            db.add(subject)
            db.flush()

        # 2. Anonymize Facility (opaque hashed identifier with generalized tier attributes)
        hospital = case.hospital
        raw_fac = hospital.hospital_ref if hospital else "DEFAULT_FAC"
        hashed_fac = hashlib.sha256((raw_fac + settings.TRACE_PSEUDONYM_SECRET).encode()).hexdigest()[:8].upper()
        fac_key = f"FAC-{hashed_fac}"

        facility = db.query(TraceFacility).filter(TraceFacility.facility_key == fac_key).first()
        if not facility:
            facility = TraceFacility(
                facility_key=fac_key,
                facility_tier=hospital.hospital_tier if hospital else "TIER_1",
                city_bucket=hospital.city_bucket if hospital else "METRO",
                state_bucket=hospital.state_bucket if hospital else "STATE_NORTH"
            )
            db.add(facility)
            db.flush()

        # 3. Opaque Encounter Key (no case_number in Trace identifier)
        enc_hash = hashlib.sha256((case.id + settings.TRACE_PSEUDONYM_SECRET).encode()).hexdigest()[:16]
        enc_key = f"ENC-{enc_hash}"

        encounter = db.query(TraceEncounter).filter(TraceEncounter.encounter_key == enc_key).first()
        start_month = case.admission_at.date().replace(day=1) if case.admission_at else date.today().replace(day=1)
        end_month = case.discharge_at.date().replace(day=1) if case.discharge_at else start_month

        if not encounter:
            encounter = TraceEncounter(
                encounter_key=enc_key,
                subject_key=subject.subject_key,
                facility_key=facility.facility_key,
                encounter_type="INPATIENT",
                start_month=start_month,
                end_month=end_month,
                los_days=3
            )
            db.add(encounter)
            db.flush()

        # 4. Add condition if primary diagnosis is present
        if case.primary_diagnosis_code:
            existing_cond = db.query(TraceCondition).filter(
                TraceCondition.encounter_key == encounter.encounter_key,
                TraceCondition.concept_code == case.primary_diagnosis_code
            ).first()
            if not existing_cond:
                cond = TraceCondition(
                    encounter_key=encounter.encounter_key,
                    concept_system="ICD-10",
                    concept_code=case.primary_diagnosis_code,
                    concept_name=case.primary_diagnosis_name or "General Diagnosis",
                    is_primary=True,
                    event_month=start_month
                )
                db.add(cond)

        # 5. Add procedures from line items
        for item in (case.line_items or []):
            if item.category in ["SURGERY", "PROCEDURE"]:
                existing_proc = db.query(TraceProcedure).filter(
                    TraceProcedure.encounter_key == encounter.encounter_key,
                    TraceProcedure.concept_code == item.code
                ).first()
                if not existing_proc:
                    proc = TraceProcedure(
                        encounter_key=encounter.encounter_key,
                        concept_system=item.code_system or "CPT",
                        concept_code=item.code,
                        concept_name=item.description,
                        category="SURGICAL",
                        event_month=start_month
                    )
                    db.add(proc)

        # 6. Record Insurance Event ONLY if event_type is an insurance event
        if event_type in INSURANCE_EVENT_TYPES or "CLAIM" in event_type or "PREAUTH" in event_type:
            gross = sum(float(it.gross_amount) for it in case.line_items) if case.line_items else 0.0
            covered = sum(float(it.decision.covered_amount) for it in case.line_items if it.decision) if case.line_items else 0.0
            payable = sum(float(it.decision.patient_payable) for it in case.line_items if it.decision) if case.line_items else 0.0

            amount_bucket = "<25K"
            if gross > 250000:
                amount_bucket = "250K+"
            elif gross > 100000:
                amount_bucket = "100K-250K"
            elif gross > 50000:
                amount_bucket = "50K-100K"
            elif gross > 25000:
                amount_bucket = "25K-50K"

            ins_ev = TraceInsuranceEvent(
                encounter_key=encounter.encounter_key,
                event_type=event_type,
                payer_tier="PRIVATE_A",
                plan_category="COMPREHENSIVE",
                amount_bucket=amount_bucket,
                covered_amount_numeric=round(covered, 2),
                patient_payable_numeric=round(payable, 2),
                event_month=start_month
            )
            db.add(ins_ev)

        # 7. Record Workflow Event for operational lifecycle progressions
        stage = "INTAKE"
        if "SUBMIT" in event_type:
            stage = "PREAUTH"
        elif "EVALUAT" in event_type:
            stage = "EVALUATION"
        elif "DISCHARGE" in event_type:
            stage = "DISCHARGE"
        elif "DOCUMENT" in event_type:
            stage = "CLINICAL_DOCUMENTATION"

        wf_ev = TraceWorkflowEvent(
            encounter_key=encounter.encounter_key,
            workflow_stage=stage,
            duration_hours=4.0,
            had_blocker=(len(case.blockers or []) > 0),
            blocker_category=case.blockers[0].blocker_type if (case.blockers and len(case.blockers) > 0) else None,
            event_month=start_month
        )
        db.add(wf_ev)
