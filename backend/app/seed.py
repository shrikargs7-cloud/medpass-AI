import random
from datetime import date, datetime, timedelta
from backend.app.db import SessionLocal, engine, Base
from backend.app.models.operational import (
    Hospital, Insurer, Patient, Policy, PolicyRule, Case, TreatmentLineItem, DischargeBlocker, Claim
)

FIRST_NAMES = [
    "Aarav", "Ananya", "Vikram", "Priya", "Rahul", "Neha", "Siddharth", "Kavya", "Rohan", "Sneha",
    "Aditya", "Pooja", "Varun", "Riya", "Karan", "Meera", "Amit", "Divya", "Sanjay", "Ishita",
    "Deepak", "Swati", "Nikhil", "Tarun", "Shreya", "Manish", "Bhavna", "Alok", "Nisha", "Gaurav",
    "Tanvi", "Abhishek", "Simran", "Rajesh", "Krutika", "Vijay", "Aisha", "Harsh", "Shruti", "Yash"
]

LAST_NAMES = [
    "Sharma", "Rao", "Verma", "Mehta", "Patel", "Nair", "Reddy", "Gupta", "Deshmukh", "Chowdhury",
    "Joshi", "Kulkarni", "Bhat", "Iyer", "Singh", "Das", "Menon", "Agarwal", "Banerjee", "Sengupta"
]

DIAGNOSES = [
    ("K35.80", "Acute Appendicitis (Unspecified)"),
    ("K80.20", "Calculus of Gallbladder without Cholecystitis"),
    ("J18.9", "Pneumonia, Unspecified Organism"),
    ("I21.9", "Acute Myocardial Infarction"),
    ("S72.00", "Fracture of Femur Neck"),
    ("E11.9", "Type 2 Diabetes Mellitus with Complications"),
    ("H26.9", "Cataract Unspecified"),
    ("A91", "Dengue Hemorrhagic Fever"),
    ("M17.11", "Primary Osteoarthritis, Right Knee"),
    ("N39.0", "Urinary Tract Infection"),
    ("K57.90", "Diverticulitis of Intestine"),
    ("J44.9", "Chronic Obstructive Pulmonary Disease")
]

DISEASE_LINE_ITEMS = {
    "K35.80": [
        ("ROOM_RENT", "ROOM-PRIV", "Single Private AC Room (3 Days)", 3, 5000.0),
        ("SURGERY", "OT-SURG-APP", "Laparoscopic Appendectomy Surgical Charges", 1, 55000.0),
        ("PHARMACY", "PHARM-PREOP", "IV Antibiotics & Post-Op Analgesics", 1, 12000.0),
        ("INVESTIGATION", "LAB-BLOOD", "Complete Blood Count & Abdominal Ultrasound", 1, 6000.0)
    ],
    "K80.20": [
        ("ROOM_RENT", "ROOM-DELUXE", "Deluxe Room Charges (2 Days)", 2, 7000.0),
        ("SURGERY", "OT-CHOLE", "Laparoscopic Cholecystectomy Surgery", 1, 60000.0),
        ("PHARMACY", "PHARM-CHOLE", "Post-Op Anti-inflammatory & Painkillers", 1, 9500.0)
    ],
    "J18.9": [
        ("ROOM_RENT", "ROOM-GEN", "Semi-Private Ward (4 Days)", 4, 3500.0),
        ("PHARMACY", "PHARM-RESP", "Nebulization & High-Dose Antibiotics", 1, 18500.0),
        ("INVESTIGATION", "LAB-CT", "Chest High Resolution CT Scan", 1, 8500.0)
    ],
    "I21.9": [
        ("ICU", "ROOM-ICU", "Cardiac ICU Care (3 Days)", 3, 15000.0),
        ("SURGERY", "OT-ANGIO", "Coronary Angioplasty with Drug-Eluting Stent", 1, 140000.0),
        ("PHARMACY", "PHARM-CARD", "Thrombolytic & Anticoagulant Infusions", 1, 28000.0)
    ],
    "M17.11": [
        ("ROOM_RENT", "ROOM-PRIV", "Single Private Room (4 Days)", 4, 6000.0),
        ("SURGERY", "OT-KNEE", "Total Knee Replacement Orthopedic Operation", 1, 165000.0),
        ("INVESTIGATION", "LAB-XRAY", "Pre-Op Digital X-Ray & MRI Knee", 1, 12000.0)
    ]
}

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Clear existing records for fresh 50+ mock dataset reset
        db.query(Claim).delete()
        db.query(DischargeBlocker).delete()
        db.query(TreatmentLineItem).delete()
        db.query(Case).delete()
        db.query(Patient).delete()
        db.query(PolicyRule).delete()
        db.query(Policy).delete()
        db.query(Insurer).delete()
        db.query(Hospital).delete()
        db.commit()

        print("Cleared old database tables. Generating 50+ rich patient cases...")

        # 1. Hospitals
        hosp1 = Hospital(
            hospital_ref="HOSP-APOLLO-001",
            name="Apollo Multi-Specialty Hospital",
            hospital_tier="TIER_1",
            city_bucket="METRO",
            state_bucket="STATE_NORTH",
            active=True
        )
        hosp2 = Hospital(
            hospital_ref="HOSP-FORTIS-002",
            name="Fortis Healthcare Centre",
            hospital_tier="TIER_1",
            city_bucket="METRO",
            state_bucket="STATE_WEST",
            active=True
        )
        hosp3 = Hospital(
            hospital_ref="HOSP-DISTRICT-003",
            name="District General Care Center",
            hospital_tier="TIER_2",
            city_bucket="URBAN",
            state_bucket="STATE_SOUTH",
            active=True
        )
        db.add_all([hosp1, hosp2, hosp3])
        db.flush()

        # 2. Insurers
        ins1 = Insurer(insurer_ref="INS-STAR-001", name="Star Health & Allied Insurance", active=True)
        ins2 = Insurer(insurer_ref="INS-HDFC-002", name="HDFC ERGO Health Insurance", active=True)
        ins3 = Insurer(insurer_ref="INS-ICICI-003", name="ICICI Lombard General Insurance", active=True)
        db.add_all([ins1, ins2, ins3])
        db.flush()

        # 3. Policies
        pol1 = Policy(
            insurer_id=ins1.id,
            policy_ref="POL-STAR-COMP-500K",
            plan_name="Star Gold Comprehensive Cover",
            plan_type="COMPREHENSIVE",
            network_type="IN_NETWORK",
            sum_insured=500000.0,
            deductible=5000.0,
            co_pay_pct=10.0,
            room_rent_cap=5000.0,
            icu_rent_cap=12000.0,
            floater=True,
            effective_from=date(2025, 1, 1),
            effective_to=date(2026, 12, 31)
        )
        pol2 = Policy(
            insurer_id=ins2.id,
            policy_ref="POL-HDFC-SECURE-1M",
            plan_name="HDFC Optima Secure Platinum 10L",
            plan_type="COMPREHENSIVE",
            network_type="IN_NETWORK",
            sum_insured=1000000.0,
            deductible=0.0,
            co_pay_pct=0.0,
            room_rent_cap=8000.0,
            icu_rent_cap=18000.0,
            floater=False,
            effective_from=date(2025, 1, 1),
            effective_to=date(2026, 12, 31)
        )
        pol3 = Policy(
            insurer_id=ins3.id,
            policy_ref="POL-ICICI-HEALTH-300K",
            plan_name="ICICI Health Shield Classic",
            plan_type="BASIC",
            network_type="PREFERRED",
            sum_insured=300000.0,
            deductible=2500.0,
            co_pay_pct=15.0,
            room_rent_cap=4000.0,
            icu_rent_cap=9000.0,
            floater=False,
            effective_from=date(2025, 1, 1),
            effective_to=date(2026, 12, 31)
        )
        db.add_all([pol1, pol2, pol3])
        db.flush()

        hospitals = [hosp1, hosp2, hosp3]
        policies = [pol1, pol2, pol3]
        statuses = ["INTAKE_COMPLETE", "EVALUATED", "READY_FOR_REVIEW", "SUBMITTED", "APPROVED", "DISCHARGE_READY", "COMPLETED"]
        auth_statuses = ["PENDING", "PREAUTH_REQUESTED", "QUERY_RAISED", "APPROVED"]

        # Create 50 Patients and 50 Admissions Cases
        cases_to_add = []
        for i in range(1, 52):
            fname = random.choice(FIRST_NAMES)
            lname = random.choice(LAST_NAMES)
            full_name = f"{fname} {lname}"
            age = random.randint(22, 74)
            age_band = "19-30" if age <= 30 else ("31-45" if age <= 45 else ("46-60" if age <= 60 else "61+"))
            sex = random.choice(["MALE", "FEMALE"])
            region = random.choice(["REGION_NORTH", "REGION_SOUTH", "REGION_WEST", "REGION_EAST"])
            phone_num = f"+91 {random.randint(90000, 99999)} {random.randint(10000, 99999)}"

            pat = Patient(
                patient_ref=f"PAT-{1000 + i}",
                full_name=full_name,
                dob=date(2026 - age, random.randint(1, 12), random.randint(1, 28)),
                age_band=age_band,
                sex_at_birth=sex,
                broad_region=region,
                phone=phone_num,
                email=f"{fname.lower()}.{lname.lower()}{i}@example.com"
            )
            db.add(pat)
            db.flush()

            hosp = random.choice(hospitals)
            pol = random.choice(policies)
            diag_code, diag_name = random.choice(DIAGNOSES)

            c_status = random.choice(statuses)
            readiness_score = float(random.randint(45, 98))
            readiness_band = "SUBMISSION_READY" if readiness_score >= 80 else ("REVIEW_REQUIRED" if readiness_score >= 60 else "BLOCKED")
            auth_status = "APPROVED" if c_status in ["APPROVED", "DISCHARGE_READY", "COMPLETED"] else random.choice(auth_statuses)
            discharge_stat = "READY" if c_status in ["DISCHARGE_READY", "COMPLETED"] else "NOT_READY"

            case_obj = Case(
                patient_id=pat.id,
                hospital_id=hosp.id,
                policy_id=pol.id,
                case_number=f"MED-2026-{2000 + i}",
                case_status=c_status,
                readiness_score=readiness_score,
                readiness_band=readiness_band,
                primary_diagnosis_code=diag_code,
                primary_diagnosis_name=diag_name,
                authorization_status=auth_status,
                discharge_status=discharge_stat,
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 14))
            )
            db.add(case_obj)
            db.flush()

            # Attach Treatment Line Items
            items_templates = DISEASE_LINE_ITEMS.get(diag_code, [
                ("ROOM_RENT", "ROOM-PRIV", "Private AC Room Charges (3 Days)", 3, 5000.0),
                ("SURGERY", "OT-GEN", "Surgical Operation & OT Suite Charges", 1, 45000.0),
                ("PHARMACY", "PHARM-GEN", "Inpatient Medications & Supplies", 1, 8000.0)
            ])

            for cat, code, desc, qty, rate in items_templates:
                item = TreatmentLineItem(
                    case_id=case_obj.id,
                    category=cat,
                    code=code,
                    description=desc,
                    quantity=float(qty),
                    unit_amount=float(rate),
                    gross_amount=float(qty * rate)
                )
                db.add(item)

            # Add Discharge Blocker if BLOCKED band
            if readiness_band == "BLOCKED":
                blocker = DischargeBlocker(
                    case_id=case_obj.id,
                    blocker_type="MISSING_DOCUMENT",
                    severity="HIGH",
                    owner_role="HOSPITAL_STAFF",
                    description="Doctor discharge notes pending digital signature.",
                    action_required="Sign and upload clinical discharge summary.",
                    is_resolved=False
                )
                db.add(blocker)

        db.commit()
        print("Successfully generated 51 realistic patient admissions into database!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
