import os
import sys
import uuid
import random
from datetime import date, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.db import engine, Base, SessionLocal
from backend.app.models.trace import (
    TraceSubject, TraceFacility, TraceEncounter, TraceCondition,
    TraceProcedure, TraceObservation, TraceMedication, TraceInsuranceEvent,
    TraceWorkflowEvent, TraceOutcome, TraceDataset, DatasetVersion, QualityRun
)

DIAGNOSIS_POOL = [
    ("I21.9", "Acute Myocardial Infarction", "CARDIOLOGY"),
    ("K35.80", "Acute Appendicitis", "GASTROENTEROLOGY"),
    ("K81.0", "Acute Cholecystitis", "GASTROENTEROLOGY"),
    ("M17.11", "Unilateral Knee Osteoarthritis", "ORTHOPEDICS"),
    ("J18.9", "Pneumonia, Unspecified Organism", "RESPIRATORY"),
    ("E11.9", "Type 2 Diabetes Mellitus with Complications", "ENDOCRINOLOGY"),
    ("I63.9", "Cerebral Infarction (Ischemic Stroke)", "NEUROLOGY"),
    ("S82.201A", "Fracture of Shaft of Tibia", "TRAUMA")
]

PROCEDURES_POOL = [
    ("47562", "Laparoscopic Cholecystectomy", "SURGICAL"),
    ("44970", "Laparoscopic Appendectomy", "SURGICAL"),
    ("27447", "Total Knee Arthroplasty", "SURGICAL"),
    ("92928", "Percutaneous Transcatheter Coronary Stent", "INTERVENTIONAL"),
    ("99223", "Initial Inpatient Intensive Care Evaluation", "CLINICAL"),
    ("74176", "Computed Tomography Abdomen and Pelvis", "DIAGNOSTIC")
]

DRUGS_POOL = [
    ("RX-001", "ANTIBIOTIC", "Ceftriaxone IV"),
    ("RX-002", "ANALGESIC", "Paracetamol & Tramadol IV"),
    ("RX-003", "ANTICOAGULANT", "Enoxaparin Sodium"),
    ("RX-004", "STATIN", "Atorvastatin 40mg"),
    ("RX-005", "GASTROPROTECTIVE", "Pantoprazole IV")
]

AGE_BANDS = ["0-18", "19-30", "31-45", "46-60", "60+"]
SEX_CATEGORIES = ["MALE", "FEMALE"]
INSURANCE_OUTCOMES = [
    ("PREAUTH_APPROVED", 0.65),
    ("CLAIM_SETTLED", 0.20),
    ("CLAIM_QUERIED", 0.10),
    ("CLAIM_REJECTED", 0.05)
]
BLOCKER_TYPES = [
    "INSURANCE_AUTHORIZATION", "MISSING_DOCUMENT", "INSURER_QUERY",
    "BILLING_CLEARANCE", "CLINICAL_PENDING"
]

def seed_trace_population(num_encounters=550):
    print(f"Seeding {num_encounters} synthetic encounters in Trace Commons...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear trace domain tables for clean re-seeding
    db.query(QualityRun).delete()
    db.query(TraceOutcome).delete()
    db.query(TraceWorkflowEvent).delete()
    db.query(TraceInsuranceEvent).delete()
    db.query(TraceMedication).delete()
    db.query(TraceProcedure).delete()
    db.query(TraceCondition).delete()
    db.query(TraceEncounter).delete()
    db.query(TraceSubject).delete()
    db.commit()

    # Ensure facilities exist
    facilities = [
        {"key": "FAC-APOLLO-METRO", "tier": "TIER_1", "city": "BENGALURU_METRO", "state": "KARNATAKA"},
        {"key": "FAC-FORTIS-MUMBAI", "tier": "TIER_1", "city": "MUMBAI_METRO", "state": "MAHARASHTRA"},
        {"key": "FAC-DISTRICT-MYSURU", "tier": "TIER_2", "city": "MYSURU_URBAN", "state": "KARNATAKA"}
    ]

    fac_objs = []
    for f in facilities:
        obj = db.query(TraceFacility).filter(TraceFacility.facility_key == f["key"]).first()
        if not obj:
            obj = TraceFacility(
                facility_key=f["key"],
                facility_tier=f["tier"],
                city_bucket=f["city"],
                state_bucket=f["state"]
            )
            db.add(obj)
            db.flush()
        fac_objs.append(obj)

    start_anchor = date(2025, 10, 1)

    for i in range(num_encounters):
        # 1. Subject
        age_band = random.choice(AGE_BANDS)
        sex = random.choice(SEX_CATEGORIES)
        subj = TraceSubject(
            subject_key=f"SUBJ-{uuid.uuid4().hex[:12].upper()}",
            age_band=age_band,
            sex_category=sex,
            region_bucket="REGION_SOUTH" if random.random() > 0.3 else "REGION_WEST"
        )
        db.add(subj)
        db.flush()

        # 2. Encounter timeline (spread over 12 months)
        month_offset = random.randint(0, 11)
        enc_month = (start_anchor.replace(day=1) + timedelta(days=month_offset * 30)).replace(day=1)
        facility = random.choice(fac_objs)
        los = random.randint(1, 7)

        enc_key = f"ENC-SYN-{i+1:04d}"
        enc = TraceEncounter(
            encounter_key=enc_key,
            subject_key=subj.subject_key,
            facility_key=facility.facility_key,
            encounter_type="INPATIENT" if los > 1 else "DAYCARE",
            start_month=enc_month,
            end_month=enc_month,
            los_days=los
        )
        db.add(enc)
        db.flush()

        # 3. Diagnosis / Condition
        diag = random.choice(DIAGNOSIS_POOL)
        cond = TraceCondition(
            encounter_key=enc.encounter_key,
            concept_system="ICD-10",
            concept_code=diag[0],
            concept_name=diag[1],
            is_primary=True,
            event_month=enc_month
        )
        db.add(cond)

        # 4. Procedure
        proc = random.choice(PROCEDURES_POOL)
        proc_obj = TraceProcedure(
            encounter_key=enc.encounter_key,
            concept_system="CPT",
            concept_code=proc[0],
            concept_name=proc[1],
            category=proc[2],
            event_month=enc_month
        )
        db.add(proc_obj)

        # 5. Medication
        drug = random.choice(DRUGS_POOL)
        med_obj = TraceMedication(
            encounter_key=enc.encounter_key,
            concept_code=drug[0],
            drug_class=drug[1],
            event_month=enc_month
        )
        db.add(med_obj)

        # 6. Insurance Event
        outcome_roll = random.random()
        if outcome_roll < 0.65:
            ev_type = "PREAUTH_APPROVED"
        elif outcome_roll < 0.85:
            ev_type = "CLAIM_SETTLED"
        elif outcome_roll < 0.95:
            ev_type = "CLAIM_QUERIED"
        else:
            ev_type = "CLAIM_REJECTED"

        gross = random.randint(30000, 220000)
        covered = gross * random.uniform(0.70, 0.95) if ev_type != "CLAIM_REJECTED" else 0.0
        payable = gross - covered

        amt_bucket = "<25K"
        if gross > 150000:
            amt_bucket = "150K+"
        elif gross > 80000:
            amt_bucket = "80K-150K"
        elif gross > 40000:
            amt_bucket = "40K-80K"

        ins_ev = TraceInsuranceEvent(
            encounter_key=enc.encounter_key,
            event_type=ev_type,
            payer_tier="PRIVATE_A" if random.random() > 0.4 else "PUBLIC_TRUST",
            plan_category="COMPREHENSIVE",
            amount_bucket=amt_bucket,
            covered_amount_numeric=round(covered, 2),
            patient_payable_numeric=round(payable, 2),
            event_month=enc_month
        )
        db.add(ins_ev)

        # 7. Workflow Event
        had_blocker = random.random() < 0.28
        wf_ev = TraceWorkflowEvent(
            encounter_key=enc.encounter_key,
            workflow_stage="DISCHARGE" if ev_type in ["PREAUTH_APPROVED", "CLAIM_SETTLED"] else "PREAUTH",
            duration_hours=round(random.uniform(2.5, 36.0), 1),
            had_blocker=had_blocker,
            blocker_category=random.choice(BLOCKER_TYPES) if had_blocker else None,
            event_month=enc_month
        )
        db.add(wf_ev)

        # 8. Outcome
        outcome_obj = TraceOutcome(
            encounter_key=enc.encounter_key,
            discharge_disposition="ROUTINE_HOME" if random.random() > 0.05 else "TRANSFER",
            total_gross_numeric=round(float(gross), 2),
            turnaround_hours=round(random.uniform(4.0, 28.0), 1),
            event_month=enc_month
        )
        db.add(outcome_obj)

    # Add default dataset & quality run
    ds = db.query(TraceDataset).filter(TraceDataset.dataset_key == "trace-core").first()
    if not ds:
        ds = TraceDataset(
            dataset_key="trace-core",
            title="Trace Commons Core Longitudinal Healthcare Dataset",
            description="Governed, de-identified longitudinal records covering 500+ inpatient admissions, ICD-10 diagnoses, surgical procedures, insurance preauthorizations, and discharge blockers.",
            governance_model="COMMUNITY_OPEN_ACCESS",
            active_version="1.3.0"
        )
        db.add(ds)
        db.flush()

    ver = db.query(DatasetVersion).filter(DatasetVersion.version_tag == "trace-core-1.3.0").first()
    if not ver:
        ver = DatasetVersion(
            dataset_id=ds.id,
            version_tag="trace-core-1.3.0",
            status="PUBLISHED",
            period_start=date(2025, 10, 1),
            period_end=date(2026, 9, 30),
            encounter_count=num_encounters,
            event_count=num_encounters * 6,
            facility_count=3,
            completeness_score=0.985,
            privacy_status="PASSED"
        )
        db.add(ver)

    qual = QualityRun(
        dataset_version_tag="trace-core-1.3.0",
        passed=True,
        row_count=num_encounters * 6,
        completeness=0.985,
        duplicate_rate=0.0005,
        referential_failures=0,
        temporal_failures=0,
        privacy_findings=0,
        quality_report={
            "rules_checked": 12,
            "passed": True,
            "checks": [
                {"name": "check_subject_exists", "status": "PASSED"},
                {"name": "check_temporal_ordering", "status": "PASSED"},
                {"name": "check_schema_nullability", "status": "PASSED"},
                {"name": "check_icd10_codes", "status": "PASSED"},
                {"name": "check_no_phi_leakage", "status": "PASSED"},
                {"name": "check_small_cell_suppression", "status": "PASSED"}
            ]
        }
    )
    db.add(qual)

    db.commit()
    print("Trace Commons seed population completed successfully!")
    db.close()

if __name__ == "__main__":
    seed_trace_population(550)
