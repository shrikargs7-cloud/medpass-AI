import os
import sys
from datetime import datetime, timedelta
import random

# Add root directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.db import engine, Base, SessionLocal
from backend.app.models.operational import (
    Case, Claim, TreatmentLineItem, CoverageDecision, CalculationItem, DischargeBlocker
)
from sqlalchemy import inspect, text

REJECTION_REASONS = [
    "Claim Repudiated: Pre-existing condition (Type 2 Diabetes / Cardiac complication) diagnosed within active 36-month waiting period under Policy Section 4.1.",
    "Claim Repudiated: Elective cosmetic / refractive procedure excluded under General Policy Exclusion Clause 8.2.",
    "Claim Repudiated: Admission at an un-empanelled / de-listed healthcare facility without mandatory emergency intimation within 24 hours (Clause 14.1).",
    "Claim Repudiated: Policy lapsed due to premium non-renewal prior to admission date; no active cashless cover in force.",
    "Claim Repudiated: Insufficient clinical justification and failure to provide required pre-op histology report following query."
]

PARTIAL_REASONS = [
    "Partial Pre-Authorization Approved. Room rent capped at ₹5,000/day (proportional deduction applied), plus mandatory 10% co-pay on surgical procedure. Excess borne by insured.",
    "Partial Clearance Approved. Non-medical admission consumables, PPE kits, and administrative surcharge excluded under IRDAI Non-Payable guidelines, with 15% patient co-pay.",
    "Partial Pre-Authorization Approved. Procedure sub-limit cap applied to surgical package; excess billed implant upgrade and routine pharmacy to be settled by patient."
]

def ensure_columns():
    inspector = inspect(engine)
    claim_cols = [c['name'] for c in inspector.get_columns('claims')]
    with engine.connect() as conn:
        if 'claim_type' not in claim_cols:
            conn.execute(text('ALTER TABLE claims ADD COLUMN claim_type VARCHAR(50);'))
        if 'adjudication_reason' not in claim_cols:
            conn.execute(text('ALTER TABLE claims ADD COLUMN adjudication_reason TEXT;'))
        if 'ack_token' not in claim_cols:
            conn.execute(text('ALTER TABLE claims ADD COLUMN ack_token VARCHAR(100);'))
        conn.commit()

def seed_claims():
    ensure_columns()
    db = SessionLocal()
    try:
        cases = db.query(Case).order_by(Case.created_at.asc()).all()
        if not cases:
            print("No cases found in DB to seed claims.")
            return

        print(f"Generating comprehensive claim dataset across {len(cases)} cases...")

        # Delete existing claims & decisions to establish perfectly synchronized mock data
        db.query(Claim).delete()
        db.query(CalculationItem).delete()
        db.query(CoverageDecision).delete()
        db.commit()

        # Distribution: ~40% FULL_CLAIM, ~40% PARTIAL_CLAIM, ~20% NO_CLAIM
        for idx, case in enumerate(cases):
            line_items = db.query(TreatmentLineItem).filter(TreatmentLineItem.case_id == case.id).all()
            gross = sum(float(it.gross_amount) for it in line_items)
            if gross == 0:
                gross = 55000.0

            claim_pattern = idx % 10
            # 0, 1, 2, 3 -> FULL CLAIM (40%)
            # 4, 5, 6, 7 -> PARTIAL CLAIM (40%)
            # 8, 9       -> NO CLAIM (20%)
            if claim_pattern in [0, 1, 2, 3]:
                claim_type = "FULL_CLAIM"
            elif claim_pattern in [4, 5, 6, 7]:
                claim_type = "PARTIAL_CLAIM"
            else:
                claim_type = "NO_CLAIM"

            if claim_type == "FULL_CLAIM":
                covered = gross
                payable = 0.0
                status = "APPROVED"
                ack = f"ACK-NHCX-FULL-2026-{idx+1:04d}"
                ext_ref = f"CLM-FULL-{case.case_number.split('-')[-1]}"
                reason = "100% Cashless Clearance Approved. All tariff lines, room rent, and diagnostics fully covered under policy terms without deductible or non-medical exclusions."
                case.authorization_status = "APPROVED"
                if case.case_status in ["INTAKE_COMPLETE", "QUERIED"]:
                    case.case_status = "APPROVED"

                # Line item decisions
                for item in line_items:
                    dec = CoverageDecision(
                        case_id=case.id,
                        line_item_id=item.id,
                        decision_status="COVERED",
                        eligible_amount=float(item.gross_amount),
                        covered_amount=float(item.gross_amount),
                        patient_payable=0.0,
                        confidence=1.0,
                        requires_human_review=False,
                        explanation="Fully covered under standard policy schedule."
                    )
                    db.add(dec)

            elif claim_type == "PARTIAL_CLAIM":
                status = "APPROVED"
                ack = f"ACK-NHCX-PART-2026-{idx+1:04d}"
                ext_ref = f"CLM-PART-{case.case_number.split('-')[-1]}"
                reason_template = PARTIAL_REASONS[idx % len(PARTIAL_REASONS)]

                covered_subtotal = 0.0
                payable_subtotal = 0.0

                for item in line_items:
                    item_gross = float(item.gross_amount)
                    cat = (item.category or "").upper()

                    if "ROOM" in cat:
                        unit = float(item.unit_amount)
                        qty = float(item.quantity) or 1.0
                        if unit > 5000.0:
                            item_covered = round(5000.0 * qty, 2)
                            item_payable = round(item_gross - item_covered, 2)
                            exp = f"Room rent capped at ₹5,000/day under policy schedule. Excess ₹{item_payable:,.0f} payable by patient."
                            dec_status = "PARTIALLY_COVERED"
                        else:
                            item_covered = item_gross
                            item_payable = 0.0
                            exp = "Room rent within permissible daily tariff cap."
                            dec_status = "COVERED"
                    elif "NON_MEDICAL" in cat or "ADMIN" in cat or "KIT" in (item.description or "").upper():
                        item_covered = 0.0
                        item_payable = item_gross
                        exp = "Non-medical admission items & consumables excluded under IRDAI guidelines."
                        dec_status = "EXCLUDED"
                    elif "SURG" in cat:
                        copay = round(item_gross * 0.10, 2)
                        item_covered = round(item_gross - copay, 2)
                        item_payable = copay
                        exp = "10% patient procedure co-pay applied as per policy terms."
                        dec_status = "PARTIALLY_COVERED"
                    else:
                        copay = round(item_gross * 0.05, 2)
                        item_covered = round(item_gross - copay, 2)
                        item_payable = copay
                        exp = "Diagnostic / medication panel eligible with standard policy co-pay."
                        dec_status = "PARTIALLY_COVERED"

                    covered_subtotal += item_covered
                    payable_subtotal += item_payable

                    dec = CoverageDecision(
                        case_id=case.id,
                        line_item_id=item.id,
                        decision_status=dec_status,
                        eligible_amount=item_gross,
                        covered_amount=item_covered,
                        patient_payable=item_payable,
                        confidence=0.95,
                        requires_human_review=False,
                        explanation=exp
                    )
                    db.add(dec)

                covered = covered_subtotal
                payable = payable_subtotal
                reason = f"{reason_template} (Total Claimed: ₹{gross:,.0f}, Covered: ₹{covered:,.0f}, Patient Out-of-Pocket: ₹{payable:,.0f})"
                case.authorization_status = "APPROVED"

            else: # NO_CLAIM
                covered = 0.0
                payable = gross
                status = "REJECTED"
                ack = None
                ext_ref = f"CLM-REJ-{case.case_number.split('-')[-1]}"
                reason = REJECTION_REASONS[idx % len(REJECTION_REASONS)]
                case.authorization_status = "REJECTED"
                case.case_status = "REJECTED"

                for item in line_items:
                    dec = CoverageDecision(
                        case_id=case.id,
                        line_item_id=item.id,
                        decision_status="EXCLUDED",
                        eligible_amount=0.0,
                        covered_amount=0.0,
                        patient_payable=float(item.gross_amount),
                        confidence=1.0,
                        requires_human_review=False,
                        explanation=f"Repudiated: {reason}"
                    )
                    db.add(dec)

            # Create the Claim record
            claim = Claim(
                case_id=case.id,
                external_reference=ext_ref,
                ack_token=ack,
                status=status,
                claim_type=claim_type,
                adjudication_reason=reason,
                total_claimed=gross,
                covered_amount=covered,
                patient_payable=payable,
                submitted_at=datetime.utcnow() - timedelta(days=random.randint(1, 14)),
                decided_at=datetime.utcnow() - timedelta(hours=random.randint(2, 48))
            )
            db.add(claim)

        db.commit()

        full_count = db.query(Claim).filter(Claim.claim_type == "FULL_CLAIM").count()
        part_count = db.query(Claim).filter(Claim.claim_type == "PARTIAL_CLAIM").count()
        no_count = db.query(Claim).filter(Claim.claim_type == "NO_CLAIM").count()
        print("Claims seeding completed successfully!")
        print(f"Total claims: {len(cases)}")
        print(f"  - Full Claims (100% Covered): {full_count}")
        print(f"  - Partial Claims (Deductions): {part_count}")
        print(f"  - No Claim (Rejected / Repudiated): {no_count}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding claims: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_claims()
