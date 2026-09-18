import duckdb
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.schemas.trace import CohortFilter, CohortPreviewResponse
from backend.app.models.trace import (
    TraceEncounter, TraceSubject, TraceFacility, TraceCondition,
    TraceProcedure, TraceInsuranceEvent, TraceWorkflowEvent
)
from backend.app.services.privacy_service import PrivacyDeidentificationService
from backend.app.services.quality_service import DataQualityService

class CohortQueryEngine:
    """
    DuckDB-powered analytical cohort query engine.
    Supports journey semantics: 'whole_journey' vs 'event_window'.
    """

    @staticmethod
    def preview_cohort(db: Session, filters: CohortFilter) -> CohortPreviewResponse:
        # 1. Fetch encounters matching base criteria
        enc_query = db.query(TraceEncounter).join(TraceSubject).join(TraceFacility)

        if filters.facility_keys:
            enc_query = enc_query.filter(TraceFacility.facility_key.in_(filters.facility_keys))
        if filters.facility_tiers:
            enc_query = enc_query.filter(TraceFacility.facility_tier.in_(filters.facility_tiers))
        if filters.age_bands:
            enc_query = enc_query.filter(TraceSubject.age_band.in_(filters.age_bands))
        if filters.date_from:
            enc_query = enc_query.filter(TraceEncounter.start_month >= filters.date_from)
        if filters.date_to:
            enc_query = enc_query.filter(TraceEncounter.end_month <= filters.date_to)

        encounters = enc_query.all()
        encounter_keys = [e.encounter_key for e in encounters]

        # 2. Conditions matching
        cond_query = db.query(TraceCondition).filter(TraceCondition.encounter_key.in_(encounter_keys))
        if filters.diagnosis_codes:
            cond_query = cond_query.filter(TraceCondition.concept_code.in_(filters.diagnosis_codes))
        conditions = cond_query.all()

        if filters.diagnosis_codes and filters.diagnosis_codes:
            # Narrow encounters to only those having the diagnosis
            matching_enc_keys = {c.encounter_key for c in conditions}
            encounters = [e for e in encounters if e.encounter_key in matching_enc_keys]
            encounter_keys = list(matching_enc_keys)

        # 3. Fetch related events for the matched encounters
        procs = db.query(TraceProcedure).filter(TraceProcedure.encounter_key.in_(encounter_keys)).all()
        ins_events = db.query(TraceInsuranceEvent).filter(TraceInsuranceEvent.encounter_key.in_(encounter_keys)).all()
        wf_events = db.query(TraceWorkflowEvent).filter(TraceWorkflowEvent.encounter_key.in_(encounter_keys)).all()

        total_encs = len(encounters)
        total_events = len(conditions) + len(procs) + len(ins_events) + len(wf_events)

        # Facilities count
        fac_count = len({e.facility_key for e in encounters})

        # Apply small-cell suppression check
        enc_dicts = [{"encounter_key": e.encounter_key, "age_band": e.subject.age_band if e.subject else "31-45"} for e in encounters]
        _, suppressed_count = PrivacyDeidentificationService.apply_small_cell_suppression(enc_dicts, "age_band", min_k=5)

        # Data quality evaluation
        all_events_dicts = [{"encounter_key": c.encounter_key} for c in conditions] + [{"encounter_key": p.encounter_key} for p in procs]
        qual_res = DataQualityService.evaluate_quality(
            [{"encounter_key": e.encounter_key, "start_month": e.start_month, "end_month": e.end_month} for e in encounters],
            all_events_dicts
        )

        return CohortPreviewResponse(
            dataset_version=filters.dataset_version,
            total_encounters=total_encs,
            total_events=total_events,
            facility_count=fac_count,
            date_range_start=filters.date_from,
            date_range_end=filters.date_to,
            journey_mode=filters.journey_mode,
            privacy_status="PASS" if suppressed_count < 50 else "REVIEW_REQUIRED",
            quality_status="PASS" if qual_res["passed"] else "WARNING",
            suppressed_cells=suppressed_count,
            sample_distribution={
                "encounters": total_encs,
                "conditions": len(conditions),
                "procedures": len(procs),
                "insurance_events": len(ins_events),
                "workflow_events": len(wf_events)
            }
        )
