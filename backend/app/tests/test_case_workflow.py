import pytest
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db import Base
from backend.app.models.operational import Case, Patient, Hospital, DischargeBlocker
from backend.app.services.case_workflow_service import CaseWorkflowService, CanonicalCaseState

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_canonical_state_transitions(db_session):
    hosp = Hospital(hospital_ref="HOSP-TEST", name="Test Hospital")
    pat = Patient(patient_ref="PAT-001", full_name="John Doe", age_band="31-45", sex_at_birth="MALE")
    db_session.add_all([hosp, pat])
    db_session.flush()

    case = Case(
        patient_id=pat.id,
        hospital_id=hosp.id,
        case_number="MED-TEST-001",
        case_status="INTAKE_COMPLETE",
        authorization_status="PENDING",
        discharge_status="NOT_READY"
    )
    db_session.add(case)
    db_session.flush()

    # Valid transition to EVALUATED
    CaseWorkflowService.transition(db_session, case, CanonicalCaseState.EVALUATED)
    assert case.case_status == "EVALUATED"

    # Valid transition to READY_FOR_REVIEW
    CaseWorkflowService.transition(db_session, case, CanonicalCaseState.READY_FOR_REVIEW)
    assert case.case_status == "READY_FOR_REVIEW"

    # Valid transition to SUBMITTED
    CaseWorkflowService.transition(db_session, case, CanonicalCaseState.SUBMITTED)
    assert case.case_status == "SUBMITTED"

def test_illegal_transition_rejected(db_session):
    hosp = Hospital(hospital_ref="HOSP-TEST", name="Test Hospital")
    pat = Patient(patient_ref="PAT-001", full_name="John Doe", age_band="31-45", sex_at_birth="MALE")
    db_session.add_all([hosp, pat])
    db_session.flush()

    case = Case(
        patient_id=pat.id,
        hospital_id=hosp.id,
        case_number="MED-TEST-002",
        case_status="INTAKE_COMPLETE"
    )
    db_session.add(case)
    db_session.flush()

    # Illegal jump from INTAKE_COMPLETE to DISCHARGED
    with pytest.raises(HTTPException) as exc_info:
        CaseWorkflowService.transition(db_session, case, CanonicalCaseState.DISCHARGED)

    assert exc_info.value.status_code == 400
    assert "Illegal state transition" in exc_info.value.detail

def test_discharge_blocked_when_critical_blocker_active(db_session):
    hosp = Hospital(hospital_ref="HOSP-TEST", name="Test Hospital")
    pat = Patient(patient_ref="PAT-001", full_name="John Doe", age_band="31-45", sex_at_birth="MALE")
    db_session.add_all([hosp, pat])
    db_session.flush()

    case = Case(
        patient_id=pat.id,
        hospital_id=hosp.id,
        case_number="MED-TEST-003",
        case_status="DISCHARGE_READY"
    )
    db_session.add(case)
    db_session.flush()

    # Add active critical blocker
    blocker = DischargeBlocker(
        case_id=case.id,
        blocker_type="MISSING_DOCUMENT",
        severity="CRITICAL",
        owner_role="HOSPITAL",
        description="Missing physician discharge summary",
        is_resolved=False
    )
    db_session.add(blocker)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        CaseWorkflowService.discharge(db_session, case)

    assert exc_info.value.status_code == 400
    assert "Active critical blockers" in exc_info.value.detail
