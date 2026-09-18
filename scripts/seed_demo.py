import os
import sys
from datetime import datetime, date, timedelta

# Add workspace root to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.db import engine, Base, SessionLocal
from backend.app.models.operational import (
    Organization, Hospital, Insurer, Patient, Policy, PolicyRule,
    Case, TreatmentLineItem, CoverageDecision, CalculationItem, Document, DischargeBlocker, Claim
)
from backend.app.models.trace import TraceDataset, DatasetVersion, QualityRun
from backend.app.services.calculation_engine import FinancialCalculationEngine
from backend.app.services.blocker_engine import ReadinessAndBlockerEngine
from backend.app.services.trace_event_service import TraceEventService

def seed():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear operational tables
    db.query(CalculationItem).delete()
    db.query(CoverageDecision).delete()
    db.query(TreatmentLineItem).delete()
    db.query(DischargeBlocker).delete()
    db.query(Document).delete()
    db.query(Claim).delete()
    db.query(Case).delete()
    db.query(PolicyRule).delete()
    db.query(Policy).delete()
    db.query(Patient).delete()
    db.query(Hospital).delete()
    db.query(Insurer).delete()
    db.query(Organization).delete()
    db.commit()

    print("Seeding Organizations, Hospitals, and Insurers...")
    org_hosp = Organization(name="Apollo Healthcare Group", org_type="HOSPITAL")
    org_ins = Organization(name="Star Health & Allied Insurance", org_type="INSURER")
    db.add_all([org_hosp, org_ins])
    db.flush()

    hosp1 = Hospital(
        organization_id=org_hosp.id,
        hospital_ref="HOSP-APOLLO-001",
        name="Apollo Multi-Specialty Hospital, Bengaluru",
        hospital_tier="TIER_1",
        city_bucket="METRO",
        state_bucket="KARNATAKA"
    )
    hosp2 = Hospital(
        hospital_ref="HOSP-FORTIS-002",
        name="Fortis Super Specialty Center, Mumbai",
        hospital_tier="TIER_1",
        city_bucket="METRO",
        state_bucket="MAHARASHTRA"
    )
    hosp3 = Hospital(
        hospital_ref="HOSP-DISTRICT-003",
        name="District Care General Hospital, Mysuru",
        hospital_tier="TIER_2",
        city_bucket="TIER_2_URBAN",
        state_bucket="KARNATAKA"
    )
    db.add_all([hosp1, hosp2, hosp3])
    db.flush()

    insurer1 = Insurer(
        organization_id=org_ins.id,
        insurer_ref="INS-STAR-001",
        name="Star Comprehensive Health Insurance"
    )
    insurer2 = Insurer(
        insurer_ref="INS-HDFC-002",
        name="HDFC ERGO Optima Secure"
    )
    db.add_all([insurer1, insurer2])
    db.flush()

    print("Seeding Policies & Deterministic Rules...")
    policy1 = Policy(
        insurer_id=insurer1.id,
        policy_ref="POL-STAR-COMP-500K",
        plan_name="Star Gold Comprehensive Cover",
        plan_type="COMPREHENSIVE",
        network_type="IN_NETWORK",
        sum_insured=500000.0,
        deductible=5000.0,
        co_pay_pct=10.0,
        room_rent_cap=5000.0,
        floater=False,
        effective_from=date(2025, 1, 1),
        effective_to=date(2026, 12, 31)
    )
    policy2 = Policy(
        insurer_id=insurer2.id,
        policy_ref="POL-HDFC-SECURE-1M",
        plan_name="HDFC Optima Family Floater 10L",
        plan_type="FAMILY_FLOATER",
        network_type="IN_NETWORK",
        sum_insured=1000000.0,
        deductible=0.0,
        co_pay_pct=0.0,
        room_rent_cap=8000.0,
        floater=True,
        effective_from=date(2025, 1, 1),
        effective_to=date(2026, 12, 31)
    )
    db.add_all([policy1, policy2])
    db.flush()

    rule_room = PolicyRule(
        policy_id=policy1.id,
        rule_code="ROOM_CAP_001",
        rule_type="ROOM_LIMIT",
        priority=50,
        conditions={"room_category": "single"},
        action={"cap_amount": 5000.0},
        source_clause_ref="Clause 3.2 - Room Rent Eligibility Cap",
        version="2026.1"
    )
    rule_sublimit = PolicyRule(
        policy_id=policy1.id,
        rule_code="SUBLIMIT_CATARACT_002",
        rule_type="SUB_LIMIT",
        priority=40,
        conditions={"category": "CATARACT"},
        action={"cap_amount": 40000.0},
        source_clause_ref="Clause 4.5 - Specific Procedure Sub-Limits",
        version="2026.1"
    )
    db.add_all([rule_room, rule_sublimit])
    db.flush()

    print("Seeding 5 Golden Demo Cases...")

    # CASE 1: Clean Preauth
    # Expected: READY_FOR_REVIEW -> APPROVED -> DISCHARGE_READY
    p1 = Patient(
        patient_ref="PAT-1001", full_name="Aarav Sharma", dob=date(1988, 4, 12),
        age_band="31-45", sex_at_birth="MALE", broad_region="KARNATAKA", phone="+91 9876543210"
    )
    db.add(p1)
    db.flush()

    c1 = Case(
        patient_id=p1.id, hospital_id=hosp1.id, policy_id=policy1.id,
        case_number="MED-2026-CLEAN-01", case_status="APPROVED", authorization_status="APPROVED",
        discharge_status="READY", readiness_score=95.0, readiness_band="SUBMISSION_READY",
        primary_diagnosis_code="K35.80", primary_diagnosis_name="Acute Appendicitis (Unspecified)",
        admission_at=datetime.utcnow() - timedelta(days=2)
    )
    db.add(c1)
    db.flush()

    items1 = [
        TreatmentLineItem(case_id=c1.id, category="ROOM_RENT", code="ROOM-001", description="Single Private Room (2 days)", quantity=2, unit_amount=5000, gross_amount=10000),
        TreatmentLineItem(case_id=c1.id, category="SURGERY", code="SURG-47562", description="Laparoscopic Appendectomy OT Charges", quantity=1, unit_amount=55000, gross_amount=55000),
        TreatmentLineItem(case_id=c1.id, category="INVESTIGATION", code="INV-001", description="Ultrasound Abdomen & Pre-Op Panel", quantity=1, unit_amount=6000, gross_amount=6000),
        TreatmentLineItem(case_id=c1.id, category="PHARMACY", code="PHARM-001", description="Post-Op IV Antibiotics & Analgesics", quantity=1, unit_amount=4000, gross_amount=4000)
    ]
    db.add_all(items1)
    db.flush()

    # Documents for Case 1
    doc1_1 = Document(case_id=c1.id, doc_type="POLICY_CARD", file_name="star_health_e_card.pdf", storage_key="docs/card1.pdf")
    doc1_2 = Document(case_id=c1.id, doc_type="BILL_INVOICE", file_name="apollo_interim_bill.pdf", storage_key="docs/bill1.pdf")
    doc1_3 = Document(case_id=c1.id, doc_type="DISCHARGE_SUMMARY", file_name="clinical_discharge_summary.pdf", storage_key="docs/disch1.pdf")
    db.add_all([doc1_1, doc1_2, doc1_3])
    db.flush()

    claim1 = Claim(
        case_id=c1.id, external_reference="BEE-PREAUTH-9428", status="APPROVED",
        total_claimed=75000.0, covered_amount=62500.0, patient_payable=12500.0
    )
    db.add(claim1)
    db.flush()

    # Calculate financial decisions for Case 1
    FinancialCalculationEngine.calculate_case_financials(policy1, items1, c1.primary_diagnosis_code)

    # CASE 2: Partial Coverage (Room Rent Cap Trigger)
    # Expected: Room rent ₹7,500 exceeds ₹5,000 cap; detailed deduction ledger recorded
    p2 = Patient(
        patient_ref="PAT-1002", full_name="Priya Nair", dob=date(1979, 9, 21),
        age_band="46-60", sex_at_birth="FEMALE", broad_region="MAHARASHTRA", phone="+91 9845123456"
    )
    db.add(p2)
    db.flush()

    c2 = Case(
        patient_id=p2.id, hospital_id=hosp2.id, policy_id=policy1.id,
        case_number="MED-2026-ROOMCAP-02", case_status="READY_FOR_REVIEW", authorization_status="PREAUTH_REQUESTED",
        discharge_status="NOT_READY", readiness_score=88.0, readiness_band="SUBMISSION_READY",
        primary_diagnosis_code="K81.0", primary_diagnosis_name="Acute Cholecystitis",
        admission_at=datetime.utcnow() - timedelta(days=1)
    )
    db.add(c2)
    db.flush()

    items2 = [
        TreatmentLineItem(case_id=c2.id, category="ROOM_RENT", code="ROOM-002", description="Deluxe AC Suite (3 days @ ₹7,500/day)", quantity=3, unit_amount=7500, gross_amount=22500),
        TreatmentLineItem(case_id=c2.id, category="SURGERY", code="SURG-47562", description="Laparoscopic Cholecystectomy", quantity=1, unit_amount=65000, gross_amount=65000),
        TreatmentLineItem(case_id=c2.id, category="INVESTIGATION", code="INV-002", description="MRI Cholangiogram & Pathology", quantity=1, unit_amount=12000, gross_amount=12000),
        TreatmentLineItem(case_id=c2.id, category="NON_MEDICAL", code="ADMIN-001", description="Hospital Admission Kit & Linen Surcharge", quantity=1, unit_amount=2500, gross_amount=2500)
    ]
    db.add_all(items2)
    db.flush()

    doc2_1 = Document(case_id=c2.id, doc_type="POLICY_CARD", file_name="star_card_priya.pdf", storage_key="docs/card2.pdf")
    doc2_2 = Document(case_id=c2.id, doc_type="BILL_INVOICE", file_name="fortis_itemized_estimate.pdf", storage_key="docs/bill2.pdf")
    db.add_all([doc2_1, doc2_2])
    db.flush()

    # CASE 3: Missing Document Blocker
    # Expected: BLOCKED with readiness 45%, Missing diagnostic ultrasound blocker
    p3 = Patient(
        patient_ref="PAT-1003", full_name="Vikram Verma", dob=date(1995, 11, 5),
        age_band="19-30", sex_at_birth="MALE", broad_region="KARNATAKA"
    )
    db.add(p3)
    db.flush()

    c3 = Case(
        patient_id=p3.id, hospital_id=hosp1.id, policy_id=policy1.id,
        case_number="MED-2026-BLOCKED-03", case_status="INTAKE_COMPLETE", authorization_status="PENDING",
        discharge_status="NOT_READY", readiness_score=45.0, readiness_band="BLOCKED",
        primary_diagnosis_code="M17.11", primary_diagnosis_name="Unilateral Knee Osteoarthritis",
        admission_at=datetime.utcnow()
    )
    db.add(c3)
    db.flush()

    items3 = [
        TreatmentLineItem(case_id=c3.id, category="SURGERY", code="SURG-27447", description="Total Knee Arthroplasty (Right)", quantity=1, unit_amount=140000, gross_amount=140000),
        TreatmentLineItem(case_id=c3.id, category="ROOM_RENT", code="ROOM-001", description="Single Private Bed (4 days)", quantity=4, unit_amount=5000, gross_amount=20000)
    ]
    db.add_all(items3)
    db.flush()

    b3 = DischargeBlocker(
        case_id=c3.id, blocker_type="MISSING_DOCUMENT", severity="CRITICAL",
        owner_role="HOSPITAL_STAFF", description="Pre-operative X-Ray / MRI Knee diagnostic imaging report is missing.",
        action_required="Upload diagnostic imaging report to enable insurer submission."
    )
    b3_2 = DischargeBlocker(
        case_id=c3.id, blocker_type="INSURANCE_AUTHORIZATION", severity="HIGH",
        owner_role="INSURER_REVIEWER", description="Awaiting initial preauthorization review from Star Health.",
        action_required="Submit complete dossier once imaging report is attached."
    )
    db.add_all([b3, b3_2])
    db.flush()

    # CASE 4: Ambiguous Pre-Existing Condition (Human Review Flag)
    p4 = Patient(
        patient_ref="PAT-1004", full_name="Sunita Deshmukh", dob=date(1968, 2, 14),
        age_band="46-60", sex_at_birth="FEMALE", broad_region="MAHARASHTRA"
    )
    db.add(p4)
    db.flush()

    c4 = Case(
        patient_id=p4.id, hospital_id=hosp2.id, policy_id=policy1.id,
        case_number="MED-2026-REVIEW-04", case_status="QUERIED", authorization_status="QUERY_RAISED",
        discharge_status="NOT_READY", readiness_score=72.0, readiness_band="REVIEW_REQUIRED",
        primary_diagnosis_code="I21.9", primary_diagnosis_name="Acute Myocardial Infarction",
        admission_at=datetime.utcnow() - timedelta(days=3)
    )
    db.add(c4)
    db.flush()

    items4 = [
        TreatmentLineItem(case_id=c4.id, category="ICU", code="ICU-001", description="Cardiac Care Unit (CCU Monitoring 2 days)", quantity=2, unit_amount=12000, gross_amount=24000),
        TreatmentLineItem(case_id=c4.id, category="SURGERY", code="SURG-92928", description="Percutaneous Coronary Angioplasty with Stent", quantity=1, unit_amount=185000, gross_amount=185000),
        TreatmentLineItem(case_id=c4.id, category="INVESTIGATION_SPECIAL", code="INV-PED-001", description="Pre-Existing Cardiac History Adjudication Panel", quantity=1, unit_amount=15000, gross_amount=15000)
    ]
    db.add_all(items4)
    db.flush()

    b4 = DischargeBlocker(
        case_id=c4.id, blocker_type="INSURER_QUERY", severity="CRITICAL",
        owner_role="HOSPITAL_STAFF", description="Payer Query: Submit past 2-year ECG and cardiologist consult records to verify pre-existing status.",
        action_required="Hospital coordinator must upload historical consultation notes."
    )
    db.add(b4)
    db.flush()

    # CASE 5: Family Floater Coordination
    p5 = Patient(
        patient_ref="PAT-1005", full_name="Rohan Kulkarni", dob=date(2012, 6, 18),
        age_band="0-18", sex_at_birth="MALE", broad_region="KARNATAKA"
    )
    db.add(p5)
    db.flush()

    c5 = Case(
        patient_id=p5.id, hospital_id=hosp1.id, policy_id=policy2.id,
        case_number="MED-2026-FLOATER-05", case_status="APPROVED", authorization_status="APPROVED",
        discharge_status="PENDING_CLEARANCE", readiness_score=92.0, readiness_band="SUBMISSION_READY",
        primary_diagnosis_code="J18.9", primary_diagnosis_name="Community Acquired Pneumonia (Pediatric)",
        admission_at=datetime.utcnow() - timedelta(days=2)
    )
    db.add(c5)
    db.flush()

    items5 = [
        TreatmentLineItem(case_id=c5.id, category="ROOM_RENT", code="ROOM-001", description="Pediatric Inpatient Room (3 days)", quantity=3, unit_amount=4500, gross_amount=13500),
        TreatmentLineItem(case_id=c5.id, category="PHARMACY", code="PHARM-001", description="Pediatric IV Antibiotics & Nebulization", quantity=1, unit_amount=8500, gross_amount=8500),
        TreatmentLineItem(case_id=c5.id, category="CONSULTATION", code="CONS-001", description="Pediatric Pulmonologist Daily Visits", quantity=3, unit_amount=1500, gross_amount=4500)
    ]
    db.add_all(items5)
    db.flush()

    db.commit()

    # Run evaluations on all cases
    for case_obj in [c1, c2, c3, c4, c5]:
        calc = FinancialCalculationEngine.calculate_case_financials(case_obj.policy, case_obj.line_items, case_obj.primary_diagnosis_code)
        for ld in calc["line_decisions"]:
            dec = CoverageDecision(
                case_id=case_obj.id,
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
            db.add(dec)
            db.flush()
            for stg in ld["stages"]:
                ci = CalculationItem(
                    decision_id=dec.id,
                    stage=stg["stage"],
                    stage_name=stg["stage_name"],
                    input_amount=stg["input_amount"],
                    adjustment_amount=stg["adjustment_amount"],
                    output_amount=stg["output_amount"],
                    formula=stg.get("formula")
                )
                db.add(ci)

        TraceEventService.record_event(db, "CASE_CREATED", case_obj, actor_role="HOSPITAL_STAFF")

    db.commit()
    print("Golden demo cases successfully seeded!")
    db.close()

if __name__ == "__main__":
    seed()
