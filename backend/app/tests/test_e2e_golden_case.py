import os
import uuid
from datetime import datetime, date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import docx
from io import BytesIO

from backend.app.db import Base, get_db
from backend.app.main import app
from backend.app.models.operational import Hospital, Insurer, Policy, Case, Claim, DischargeBlocker, Document
from backend.app.models.trace import (
    TraceDataset, DatasetVersion, TraceSubject, TraceFacility, TraceEncounter,
    TraceCondition, TraceProcedure, TraceObservation, TraceMedication,
    TraceInsuranceEvent, TraceWorkflowEvent, TraceOutcome, ExportJob
)
from backend.app.schemas.trace import CohortFilter, ExportJobCreate


@pytest.fixture(scope="session")
def test_setup():
    """Sets up an in-memory SQLite database sharing a static pool for all test client requests."""
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # Seed baseline hospital, policy, and Trace dataset metadata
    with TestingSessionLocal() as session:
        ins = Insurer(
            id="ins-star-001",
            insurer_ref="INS-STAR-001",
            name="Star Health & Allied Insurance",
            active=True
        )
        hosp = Hospital(
            id="hosp-apollo-001",
            hospital_ref="HOSP-APOLLO-001",
            name="Apollo Multi-Specialty Hospital",
            hospital_tier="TIER_1",
            city_bucket="METRO",
            state_bucket="STATE_SOUTH"
        )
        pol = Policy(
            id="pol-star-001",
            insurer_id="ins-star-001",
            policy_ref="POL-STAR-001",
            plan_name="Star Health Comprehensive Family Optima",
            sum_insured=500000.0,
            deductible=0.0,
            co_pay_pct=0.0,
            room_rent_cap=5000.0,
            effective_from=date(2025, 1, 1),
            effective_to=date(2026, 12, 31)
        )
        dataset = TraceDataset(
            id="dataset-trace-core",
            dataset_key="trace-core",
            title="Trace Commons National Claims & Clinical Trajectory Database",
            description="Governed longitudinal dataset spanning pre-auth, adjudication, and outcomes.",
            active_version="1.3.0"
        )
        version = DatasetVersion(
            dataset_id=dataset.id,
            version_tag="trace-core-1.3.0",
            status="PUBLISHED",
            period_start=date(2025, 1, 1),
            period_end=date(2026, 12, 31),
            encounter_count=0,
            event_count=0,
            facility_count=1,
            completeness_score=0.99,
            privacy_status="PASSED"
        )
        session.add_all([ins, hosp, pol, dataset, version])
        session.commit()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield {
        "client": client,
        "session_factory": TestingSessionLocal,
        "hospital_id": "hosp-apollo-001",
        "policy_id": "pol-star-001"
    }

    app.dependency_overrides.clear()


def test_golden_e2e_lifecycle(test_setup):
    """
    Comprehensive End-to-End Acceptance Test:
    1. Patient intake with persisted discharge blockers
    2. Document upload and real NLP extraction
    3. Deterministic policy evaluation & financial waterfall
    4. Pre-authorization submission to Payer
    5. Insurer query raised
    6. Hospital response submitted
    7. Insurer adjudication & approval
    8. Blocker-free discharge authorization
    9. Governed Trace Commons 8-domain longitudinal projection & dynamic KPI computation
    10. Trace cohort preview & export package generation
    """
    client = test_setup["client"]
    SessionLocal = test_setup["session_factory"]
    hosp_id = test_setup["hospital_id"]
    pol_id = test_setup["policy_id"]

    # -------------------------------------------------------------------------
    # STEP 1: Patient Intake (POST /api/cases)
    # -------------------------------------------------------------------------
    admission_time = datetime.utcnow() - timedelta(days=3)
    intake_payload = {
        "hospital_id": hosp_id,
        "policy_id": pol_id,
        "patient": {
            "patient_ref": "PAT-GOLDEN-001",
            "full_name": "Vikram Sethi",
            "dob": "1985-05-15",
            "age_band": "31-45",
            "sex_at_birth": "MALE",
            "broad_region": "REGION_NORTH",
            "phone": "+919876543210",
            "email": "vikram.sethi@example.com"
        },
        "primary_diagnosis_code": "K35.80",
        "primary_diagnosis_name": "Acute Appendicitis",
        "admission_at": admission_time.isoformat(),
        "line_items": [
            {
                "category": "SURGERY",
                "code": "47562",
                "code_system": "CPT",
                "description": "Laparoscopic Appendectomy with General Anesthesia",
                "quantity": 1.0,
                "unit_amount": 45000.0
            },
            {
                "category": "ROOM_RENT",
                "code": "ROOM-DELUXE",
                "code_system": "LOCAL",
                "description": "Single Deluxe Private Room",
                "quantity": 3.0,
                "unit_amount": 6000.0
            },
            {
                "category": "INVESTIGATION",
                "code": "LAB-CBC-USG",
                "code_system": "LOINC",
                "description": "Complete Blood Count & USG Abdomen",
                "quantity": 1.0,
                "unit_amount": 4500.0
            },
            {
                "category": "PHARMACY",
                "code": "RX-CEFTRIAXONE",
                "code_system": "RxNorm",
                "description": "IV Ceftriaxone & Analgesics",
                "quantity": 3.0,
                "unit_amount": 1500.0
            }
        ]
    }

    intake_resp = client.post("/api/cases", json=intake_payload)
    assert intake_resp.status_code == 200, f"Intake failed: {intake_resp.text}"
    case_data = intake_resp.json()
    case_id = case_data["id"]

    assert case_data["case_status"] == "INTAKE_COMPLETE"
    assert case_data["authorization_status"] == "PENDING"
    assert len(case_data["line_items"]) == 4

    # VERIFY P0.4: Blockers persisted into DB
    with SessionLocal() as db:
        persisted_blockers = db.query(DischargeBlocker).filter(DischargeBlocker.case_id == case_id).all()
        assert len(persisted_blockers) > 0, "DischargeBlockers must be persisted into database"
        blocker_types = {b.blocker_type for b in persisted_blockers}
        assert "INSURANCE_AUTHORIZATION" in blocker_types, "Expected INSURANCE_AUTHORIZATION blocker"
        assert "MISSING_DOCUMENT" in blocker_types, "Expected MISSING_DOCUMENT blocker"

        # Verify inbound claim was created in SUBMITTED state
        inbound_claim = db.query(Claim).filter(Claim.case_id == case_id).first()
        assert inbound_claim is not None, "Inbound Claim must be created on intake"
        assert inbound_claim.status == "SUBMITTED"
        claim_id = inbound_claim.id

    # -------------------------------------------------------------------------
    # STEP 2: Document Upload & Real Extraction (POST /api/cases/{case_id}/documents)
    # -------------------------------------------------------------------------
    # Generate real in-memory DOCX document to verify real parser pipeline
    doc = docx.Document()
    doc.add_heading("Apollo Multi-Specialty Hospital - Itemized Invoice", level=1)
    doc.add_paragraph("Patient Name: Vikram Sethi")
    doc.add_paragraph("Diagnosis: Acute Appendicitis")
    doc.add_paragraph("Surgeon Fee & Operation Theatre Charges: Rs. 45000")
    doc.add_paragraph("Ultrasound Abdomen & Routine Pathology: Rs. 4500")
    doc.add_paragraph("Pharmacy Inpatient Medication: Rs. 4500")
    docx_io = BytesIO()
    doc.save(docx_io)
    docx_bytes = docx_io.getvalue()

    doc_upload_resp = client.post(
        f"/api/cases/{case_id}/documents",
        data={"doc_type": "BILL_INVOICE"},
        files={"file": ("clinical_bill.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    )
    assert doc_upload_resp.status_code == 200, f"Document upload failed: {doc_upload_resp.text}"
    doc_res_data = doc_upload_resp.json()
    assert "document_id" in doc_res_data
    assert doc_res_data["file_name"] == "clinical_bill.docx"
    assert doc_res_data["extracted_data"] is not None

    # Verify document retrieval
    docs_list_resp = client.get(f"/api/cases/{case_id}/documents")
    assert docs_list_resp.status_code == 200
    docs_list = docs_list_resp.json()
    assert len(docs_list) >= 1
    assert docs_list[0]["file_name"] == "clinical_bill.docx"
    assert docs_list[0]["sha256"] is not None

    # -------------------------------------------------------------------------
    # STEP 3: Policy Evaluation & Financial Waterfall (POST /api/cases/{case_id}/evaluate)
    # -------------------------------------------------------------------------
    eval_resp = client.post(f"/api/cases/{case_id}/evaluate")
    assert eval_resp.status_code == 200, f"Evaluation failed: {eval_resp.text}"
    eval_data = eval_resp.json()
    assert eval_data["case_status"] == "EVALUATED"
    assert len(eval_data["decisions"]) >= 4
    # Gross sum covers initial items plus NLP extracted document line items
    assert eval_data["total_gross"] >= 72000.0

    # -------------------------------------------------------------------------
    # STEP 4: Pre-Authorization Submission (POST /api/cases/{case_id}/submit)
    # -------------------------------------------------------------------------
    submit_resp = client.post(f"/api/cases/{case_id}/submit")
    assert submit_resp.status_code == 200, f"Submit failed: {submit_resp.text}"
    submit_data = submit_resp.json()
    assert submit_data.get("status") == "SUBMITTED"

    with SessionLocal() as db:
        c = db.query(Case).filter(Case.id == case_id).first()
        assert c.case_status == "SUBMITTED"
        assert c.authorization_status == "PREAUTH_REQUESTED"

    # -------------------------------------------------------------------------
    # STEP 5: Insurer Query (POST /api/claims/{claim_id}/query)
    # -------------------------------------------------------------------------
    query_payload = {
        "category": "MEDICAL_NECESSITY",
        "reason": "Please furnish pre-operative ultrasound imaging report confirming acute appendicitis."
    }
    query_resp = client.post(f"/api/claims/{claim_id}/query", json=query_payload)
    assert query_resp.status_code == 200, f"Query failed: {query_resp.text}"
    query_res_data = query_resp.json()
    query_id = query_res_data["query_id"]

    # Verify claim and case transitioned to QUERIED
    with SessionLocal() as db:
        clm = db.query(Claim).filter(Claim.id == claim_id).first()
        cas = db.query(Case).filter(Case.id == case_id).first()
        assert clm.status == "QUERIED"
        assert cas.case_status == "QUERIED"
        # Verify INSURER_QUERY blocker exists
        query_blockers = [b for b in cas.blockers if b.blocker_type == "INSURER_QUERY" and not b.is_resolved]
        assert len(query_blockers) == 1

    # -------------------------------------------------------------------------
    # STEP 6: Hospital Query Response (POST /api/claims/{claim_id}/query/{query_id}/respond)
    # -------------------------------------------------------------------------
    respond_payload = {
        "response_notes": "Pre-operative abdominal ultrasound submitted showing 8.5mm non-compressible appendix with periappendiceal fat stranding."
    }
    respond_resp = client.post(f"/api/claims/{claim_id}/query/{query_id}/respond", json=respond_payload)
    assert respond_resp.status_code == 200, f"Respond failed: {respond_resp.text}"
    respond_data = respond_resp.json()
    assert respond_data["status"] == "QUERY_RESPONDED"

    with SessionLocal() as db:
        clm = db.query(Claim).filter(Claim.id == claim_id).first()
        cas = db.query(Case).filter(Case.id == case_id).first()
        assert clm.status == "QUERY_RESPONDED"
        assert cas.case_status == "QUERY_RESPONDED"
        # Verify INSURER_QUERY blocker is resolved
        query_blockers = [b for b in cas.blockers if b.blocker_type == "INSURER_QUERY"]
        assert all(b.is_resolved for b in query_blockers)

    # -------------------------------------------------------------------------
    # STEP 7: Insurer Approval (POST /api/claims/{claim_id}/approve)
    # -------------------------------------------------------------------------
    approve_payload = {
        "approved_amount": 69000.0,
        "notes": "Cashless pre-authorization approved under policy terms. Co-pay: Nil."
    }
    approve_resp = client.post(f"/api/claims/{claim_id}/approve", json=approve_payload)
    assert approve_resp.status_code == 200, f"Approve failed: {approve_resp.text}"
    approve_data = approve_resp.json()
    assert approve_data["status"] == "APPROVED"
    assert approve_data["covered_amount"] == 69000.0

    with SessionLocal() as db:
        clm = db.query(Claim).filter(Claim.id == claim_id).first()
        cas = db.query(Case).filter(Case.id == case_id).first()
        assert clm.claim_type == "PARTIAL_CLAIM"
        assert cas.case_status in ["APPROVED", "DISCHARGE_READY"]
        assert cas.authorization_status == "APPROVED"
        # Verify INSURANCE_AUTHORIZATION blocker is resolved
        auth_blockers = [b for b in cas.blockers if b.blocker_type == "INSURANCE_AUTHORIZATION"]
        assert all(b.is_resolved for b in auth_blockers)

    # -------------------------------------------------------------------------
    # STEP 8: Case Discharge (POST /api/cases/{case_id}/discharge)
    # -------------------------------------------------------------------------
    # Clear any remaining document blockers (simulating hospital desk completion)
    with SessionLocal() as db:
        cas = db.query(Case).filter(Case.id == case_id).first()
        for b in cas.blockers:
            if not b.is_resolved:
                b.is_resolved = True
                b.resolved_at = datetime.utcnow()
        cas.case_status = "DISCHARGE_READY"
        db.commit()

    discharge_resp = client.post(f"/api/cases/{case_id}/discharge")
    assert discharge_resp.status_code == 200, f"Discharge failed: {discharge_resp.text}"
    discharge_data = discharge_resp.json()
    assert discharge_data["case_status"] == "DISCHARGED"
    assert discharge_data["discharge_status"] == "DISCHARGED"

    # -------------------------------------------------------------------------
    # STEP 9: Trace Commons 8-Domain Validation & Overview KPIs
    # -------------------------------------------------------------------------
    with SessionLocal() as db:
        enc_count = db.query(TraceEncounter).count()
        subj_count = db.query(TraceSubject).count()
        fac_count = db.query(TraceFacility).count()
        cond_count = db.query(TraceCondition).count()
        proc_count = db.query(TraceProcedure).count()
        obs_count = db.query(TraceObservation).count()
        med_count = db.query(TraceMedication).count()
        ins_count = db.query(TraceInsuranceEvent).count()
        wf_count = db.query(TraceWorkflowEvent).count()
        out_count = db.query(TraceOutcome).count()

        assert enc_count >= 1, "TraceEncounter must be populated"
        assert subj_count >= 1, "TraceSubject must be pseudonymized and populated"
        assert fac_count >= 1, "TraceFacility must be populated"
        assert cond_count >= 1, "TraceCondition must capture primary diagnosis"
        assert proc_count >= 1, "TraceProcedure must capture surgical line items"
        assert obs_count >= 1, "TraceObservation must capture investigation line items"
        assert med_count >= 1, "TraceMedication must capture pharmacy line items"
        assert ins_count >= 1, "TraceInsuranceEvent must capture preauth/claim events"
        assert wf_count >= 1, "TraceWorkflowEvent must track operational progression"
        assert out_count >= 1, "TraceOutcome must capture discharge disposition and turnaround"

        # Check outcome values
        outcome = db.query(TraceOutcome).first()
        assert outcome.discharge_disposition == "ROUTINE_HOME"
        assert outcome.turnaround_hours > 0.0

        # Check encounter length of stay
        encounter = db.query(TraceEncounter).first()
        assert encounter.los_days >= 1

    # Verify GET /api/trace/overview API
    overview_resp = client.get("/api/trace/overview")
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["kpis"]["total_encounters"] >= 1
    assert overview["kpis"]["total_events"] >= 5
    assert overview["kpis"]["completeness_score"] >= 0.90
    assert len(overview["domain_distribution"]) == 8

    # -------------------------------------------------------------------------
    # STEP 10: Cohort Preview & Governed Export Package Generation
    # -------------------------------------------------------------------------
    preview_payload = {
        "dataset_version": "trace-core-1.3.0",
        "journey_mode": "whole_journey",
        "format": "parquet"
    }
    preview_resp = client.post("/api/trace/cohorts/preview", json=preview_payload)
    assert preview_resp.status_code == 200, f"Cohort preview failed: {preview_resp.text}"
    preview_data = preview_resp.json()
    assert preview_data["total_encounters"] >= 1
    assert preview_data["total_events"] >= 5
    assert preview_data["privacy_status"] == "PASS"

    # Trigger export job
    export_payload = {
        "dataset_version": "trace-core-1.3.0",
        "requested_by": "GOLDEN_TEST_SUITE",
        "filters": {
            "dataset_version": "trace-core-1.3.0",
            "journey_mode": "whole_journey",
            "format": "all"
        }
    }
    export_resp = client.post("/api/trace/exports", json=export_payload)
    assert export_resp.status_code == 200, f"Export failed: {export_resp.text}"
    export_data = export_resp.json()
    assert export_data["status"] == "COMPLETED"
    assert export_data["checksum_sha256"] is not None
    assert export_data["encounter_count"] >= 1
    assert export_data["download_url"] is not None
