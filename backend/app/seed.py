from datetime import date, datetime
from backend.app.db import SessionLocal, engine, Base
from backend.app.models.operational import (
    Hospital, Insurer, Patient, Policy, PolicyRule, Case, TreatmentLineItem, DischargeBlocker, Claim
)

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Case).count() > 0:
            print("Database already contains case records.")
            return

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
        db.add_all([hosp1, hosp2])
        db.flush()

        # 2. Insurers
        ins1 = Insurer(
            insurer_ref="INS-STAR-001",
            name="Star Health & Allied Insurance",
            active=True
        )
        ins2 = Insurer(
            insurer_ref="INS-HDFC-002",
            name="HDFC ERGO Health Insurance",
            active=True
        )
        db.add_all([ins1, ins2])
        db.flush()

        # 3. Policies & Rules
        pol1 = Policy(
            insurer_id=ins1.id,
            policy_ref="POL-STAR-COMP-5L",
            plan_name="Star Comprehensive Health Gold",
            plan_type="COMPREHENSIVE",
            network_type="IN_NETWORK",
            sum_insured=500000.0,
            deductible=5000.0,
            co_pay_pct=10.0,
            room_rent_cap=5000.0,
            icu_rent_cap=10000.0,
            floater=True,
            effective_from=date(2025, 1, 1),
            effective_to=date(2026, 12, 31)
        )
        pol2 = Policy(
            insurer_id=ins2.id,
            policy_ref="POL-HDFC-ROOMCAP-3L",
            plan_name="HDFC Optima Secure Platinum",
            plan_type="COMPREHENSIVE",
            network_type="IN_NETWORK",
            sum_insured=300000.0,
            deductible=0.0,
            co_pay_pct=0.0,
            room_rent_cap=4000.0,
            icu_rent_cap=8000.0,
            floater=False,
            effective_from=date(2025, 1, 1),
            effective_to=date(2026, 12, 31)
        )
        db.add_all([pol1, pol2])
        db.flush()

        # 4. Patients
        pat1 = Patient(
            patient_ref="PAT-9845",
            full_name="Priya Sharma",
            dob=date(1988, 4, 12),
            age_band="31-45",
            sex_at_birth="FEMALE",
            broad_region="REGION_NORTH",
            phone="+91 98450 12345",
            email="priya.sharma@example.com"
        )
        pat2 = Patient(
            patient_ref="PAT-9876",
            full_name="Vikram Rao",
            dob=date(1975, 8, 23),
            age_band="46-60",
            sex_at_birth="MALE",
            broad_region="REGION_WEST",
            phone="+91 98765 43210",
            email="vikram.rao@example.com"
        )
        pat3 = Patient(
            patient_ref="PAT-5541",
            full_name="Ananya Verma",
            dob=date(1996, 11, 5),
            age_band="19-30",
            sex_at_birth="FEMALE",
            broad_region="REGION_SOUTH",
            phone="+91 99887 76655",
            email="ananya.v@example.com"
        )
        db.add_all([pat1, pat2, pat3])
        db.flush()

        # 5. Cases
        c1 = Case(
            patient_id=pat1.id,
            hospital_id=hosp1.id,
            policy_id=pol1.id,
            case_number="MED-2026-8842",
            case_status="EVALUATED",
            readiness_score=85.0,
            readiness_band="SUBMISSION_READY",
            primary_diagnosis_code="K35.80",
            primary_diagnosis_name="Acute Appendicitis (Unspecified)",
            authorization_status="APPROVED",
            discharge_status="NOT_READY"
        )
        c2 = Case(
            patient_id=pat2.id,
            hospital_id=hosp1.id,
            policy_id=pol2.id,
            case_number="MED-2026-5091",
            case_status="SUBMITTED",
            readiness_score=62.0,
            readiness_band="REVIEW_REQUIRED",
            primary_diagnosis_code="K80.20",
            primary_diagnosis_name="Calculus of Gallbladder without Cholecystitis",
            authorization_status="PENDING",
            discharge_status="NOT_READY"
        )
        c3 = Case(
            patient_id=pat3.id,
            hospital_id=hosp2.id,
            policy_id=pol1.id,
            case_number="MED-2026-1104",
            case_status="DISCHARGE_READY",
            readiness_score=95.0,
            readiness_band="SUBMISSION_READY",
            primary_diagnosis_code="J18.9",
            primary_diagnosis_name="Pneumonia, Unspecified Organism",
            authorization_status="APPROVED",
            discharge_status="READY"
        )
        db.add_all([c1, c2, c3])
        db.flush()

        # 6. Treatment Line Items for Case 1
        items_c1 = [
            TreatmentLineItem(
                case_id=c1.id,
                category="ROOM_RENT",
                code="ROOM-PRIV",
                description="Single Private AC Room (3 Days @ 5,000/day)",
                quantity=3,
                unit_amount=5000.0,
                gross_amount=15000.0
            ),
            TreatmentLineItem(
                case_id=c1.id,
                category="SURGERY",
                code="OT-SURG-APP",
                description="Laparoscopic Appendectomy Surgical Operation Charges",
                quantity=1,
                unit_amount=55000.0,
                gross_amount=55000.0
            ),
            TreatmentLineItem(
                case_id=c1.id,
                category="PHARMACY",
                code="PHARM-PREOP",
                description="Pre-Op & Post-Op IV Antibiotics Panel",
                quantity=1,
                unit_amount=12000.0,
                gross_amount=12000.0
            ),
            TreatmentLineItem(
                case_id=c1.id,
                category="INVESTIGATION",
                code="LAB-BLOOD",
                description="Complete Blood Count & Abdominal Ultrasound",
                quantity=1,
                unit_amount=6000.0,
                gross_amount=6000.0
            )
        ]

        # Line Items for Case 2
        items_c2 = [
            TreatmentLineItem(
                case_id=c2.id,
                category="ROOM_RENT",
                code="ROOM-PRIV",
                description="Deluxe Room Charges (2 Days @ 7,000/day)",
                quantity=2,
                unit_amount=7000.0,
                gross_amount=14000.0
            ),
            TreatmentLineItem(
                case_id=c2.id,
                category="SURGERY",
                code="OT-CHOLE",
                description="Laparoscopic Cholecystectomy Surgery",
                quantity=1,
                unit_amount=60000.0,
                gross_amount=60000.0
            )
        ]
        db.add_all(items_c1 + items_c2)
        db.flush()

        # 7. Discharge Blockers
        b1 = DischargeBlocker(
            case_id=c2.id,
            blocker_type="MISSING_DOCUMENT",
            severity="HIGH",
            owner_role="HOSPITAL_STAFF",
            description="Physician signed discharge summary pending upload.",
            action_required="Upload final clinical discharge notes.",
            is_resolved=False
        )
        db.add(b1)

        db.commit()
        print("Database successfully seeded with realistic sample hospital & insurance cases!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
