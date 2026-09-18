import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db import Base
from backend.app.models.trace import TraceSubject, TraceFacility, TraceEncounter, TraceCondition, ExportJob
from backend.app.schemas.trace import CohortFilter
from backend.app.services.cohort_service import CohortQueryEngine
from backend.app.services.export_service import TraceExportEngine

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Seed minimal trace data
    subj = TraceSubject(subject_key="SUBJ-1", age_band="31-45", sex_category="MALE")
    fac = TraceFacility(facility_key="FAC-1", facility_tier="TIER_1")
    db.add_all([subj, fac])
    db.flush()

    for i in range(10):
        enc = TraceEncounter(
            encounter_key=f"ENC-{i}",
            subject_key=subj.subject_key,
            facility_key=fac.facility_key,
            encounter_type="INPATIENT",
            start_month=date(2026, 1, 1),
            end_month=date(2026, 1, 1),
            los_days=2
        )
        db.add(enc)
        db.flush()
        cond = TraceCondition(
            encounter_key=enc.encounter_key,
            concept_system="ICD-10",
            concept_code="K35.80",
            concept_name="Appendicitis",
            event_month=date(2026, 1, 1)
        )
        db.add(cond)
    db.commit()

    yield db
    db.close()

def test_cohort_preview_and_duckdb_export(test_db):
    filters = CohortFilter(
        dataset_version="trace-core-1.3.0",
        journey_mode="whole_journey",
        format="parquet"
    )
    preview = CohortQueryEngine.preview_cohort(test_db, filters)
    assert preview.total_encounters == 10
    assert preview.total_events == 10
    assert preview.privacy_status == "PASS"

    job = ExportJob(
        dataset_version="trace-core-1.3.0",
        requested_by="TESTER",
        journey_mode="whole_journey",
        status="PROCESSING"
    )
    test_db.add(job)
    test_db.commit()

    zip_path = TraceExportEngine.generate_export(test_db, job, filters)
    assert zip_path.endswith(".zip")
    assert job.status == "COMPLETED"
    assert job.checksum_sha256 is not None
