import pytest
from datetime import date
from backend.app.models.operational import Policy, PolicyRule, TreatmentLineItem
from backend.app.services.policy_engine import DeterministicPolicyEngine
from backend.app.services.calculation_engine import FinancialCalculationEngine

def test_room_rent_cap_rule():
    policy = Policy(
        policy_ref="POL-TEST-001",
        plan_name="Test Policy",
        sum_insured=500000.0,
        deductible=0.0,
        co_pay_pct=0.0,
        room_rent_cap=5000.0,
        effective_from=date(2025, 1, 1),
        effective_to=date(2026, 12, 31)
    )

    # Item with daily rate of ₹7,500 for 3 days = ₹22,500
    item = TreatmentLineItem(
        category="ROOM_RENT",
        code="ROOM-001",
        description="Single AC Deluxe Room",
        quantity=3.0,
        unit_amount=7500.0,
        gross_amount=22500.0
    )

    res = DeterministicPolicyEngine.evaluate_line_item(policy, item)
    assert res.is_eligible is True
    assert res.status == "PARTIALLY_COVERED"
    # Eligible amount is cap ₹5,000 * 3 = ₹15,000
    assert res.eligible_amount == 15000.0
    assert res.rule_applied == "ROOM_CAP_001"

def test_non_medical_exclusion_rule():
    policy = Policy(
        policy_ref="POL-TEST-001",
        plan_name="Test Policy",
        sum_insured=500000.0,
        deductible=0.0,
        co_pay_pct=0.0,
        effective_from=date(2025, 1, 1),
        effective_to=date(2026, 12, 31)
    )

    item = TreatmentLineItem(
        category="NON_MEDICAL",
        code="ADMIN-001",
        description="Administrative admission registration kit",
        quantity=1.0,
        unit_amount=2500.0,
        gross_amount=2500.0
    )

    res = DeterministicPolicyEngine.evaluate_line_item(policy, item)
    assert res.is_eligible is False
    assert res.status == "EXCLUDED"
    assert res.eligible_amount == 0.0

def test_financial_calculation_waterfall_invariants():
    policy = Policy(
        policy_ref="POL-TEST-002",
        plan_name="Test Policy with Deductible & Co-Pay",
        sum_insured=200000.0,
        deductible=10000.0,
        co_pay_pct=10.0,
        room_rent_cap=5000.0,
        effective_from=date(2025, 1, 1),
        effective_to=date(2026, 12, 31)
    )

    items = [
        TreatmentLineItem(id="1", category="ROOM_RENT", code="ROOM-001", description="Room", quantity=2, unit_amount=6000, gross_amount=12000),
        TreatmentLineItem(id="2", category="SURGERY", code="SURG-001", description="Surgery", quantity=1, unit_amount=80000, gross_amount=80000),
        TreatmentLineItem(id="3", category="NON_MEDICAL", code="ADMIN-001", description="Kit", quantity=1, unit_amount=3000, gross_amount=3000)
    ]

    calc = FinancialCalculationEngine.calculate_case_financials(policy, items)

    assert calc["total_gross"] == 95000.0
    assert calc["total_covered"] >= 0.0
    assert calc["total_patient_payable"] >= 0.0
    # Invariant: covered + payable >= gross (accounting for exclusions and copay)
    assert round(calc["total_covered"] + calc["total_patient_payable"], 2) >= calc["total_gross"] - 0.05
    assert calc["deductible_applied"] == 10000.0
