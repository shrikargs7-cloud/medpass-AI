import pytest
from backend.app.models.operational import Case, Document, DischargeBlocker, TreatmentLineItem, Patient, Hospital
from backend.app.services.blocker_engine import ReadinessAndBlockerEngine

def test_readiness_scoring_weights():
    # Empty case should be blocked (<60%)
    case = Case(
        patient_id="p1",
        hospital_id="h1",
        case_number="MED-TEST-01",
        primary_diagnosis_code=None,
        line_items=[],
        documents=[],
        decisions=[]
    )
    score_data = ReadinessAndBlockerEngine.evaluate_readiness(case)
    assert score_data["band"] == "BLOCKED"
    assert score_data["total_score"] < 60.0

    # Case with docs, diagnosis, and line items
    case.primary_diagnosis_code = "K35.80"
    case.documents = [
        Document(doc_type="BILL_INVOICE", file_name="bill.pdf", storage_key="k1"),
        Document(doc_type="DISCHARGE_SUMMARY", file_name="disch.pdf", storage_key="k2")
    ]
    case.line_items = [
        TreatmentLineItem(category="SURGERY", code="S1", description="Surgery", quantity=1, unit_amount=50000, gross_amount=50000)
    ]
    score_data2 = ReadinessAndBlockerEngine.evaluate_readiness(case)
    assert score_data2["total_score"] > score_data["total_score"]

def test_blocker_detection():
    case = Case(
        authorization_status="PENDING",
        documents=[],
        decisions=[]
    )
    blockers = ReadinessAndBlockerEngine.identify_blockers(case)
    types = {b["blocker_type"] for b in blockers}
    assert "MISSING_DOCUMENT" in types
    assert "INSURANCE_AUTHORIZATION" in types
