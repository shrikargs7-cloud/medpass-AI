from typing import List, Dict, Any, Optional
from backend.app.models.operational import Policy, TreatmentLineItem, CoverageDecision, CalculationItem
from backend.app.services.policy_engine import DeterministicPolicyEngine, PolicyEvaluationResult

class FinancialCalculationEngine:
    """
    Deterministic financial engine. Computes exact covered and patient payable amounts.
    LLM is never allowed to perform arithmetic.
    """

    @staticmethod
    def calculate_case_financials(
        policy: Optional[Policy],
        line_items: List[TreatmentLineItem],
        diagnosis_code: Optional[str] = None
    ) -> Dict[str, Any]:
        results = []
        total_gross = 0.0
        total_eligible = 0.0
        total_covered = 0.0
        total_patient_payable = 0.0

        if not line_items:
            return {
                "line_decisions": [],
                "total_gross": 0.0,
                "total_eligible": 0.0,
                "total_covered": 0.0,
                "total_patient_payable": 0.0,
                "deductible_applied": 0.0,
                "copay_applied": 0.0
            }

        # Step 1: Evaluate eligibility item by item
        item_evaluations = []
        for item in line_items:
            gross = round(float(item.gross_amount), 2)
            total_gross += gross

            eval_res = DeterministicPolicyEngine.evaluate_line_item(policy, item, diagnosis_code)
            item_evaluations.append((item, eval_res))
            total_eligible += round(float(eval_res.eligible_amount), 2)

        # Step 2: Apply case-level Deductible and Co-pay across eligible items
        remaining_deductible = float(policy.deductible) if (policy and policy.deductible) else 0.0
        copay_pct = float(policy.co_pay_pct) if (policy and policy.co_pay_pct) else 0.0
        sum_insured = float(policy.sum_insured) if (policy and policy.sum_insured) else 0.0
        remaining_sum_insured = sum_insured

        total_deductible_applied = 0.0
        total_copay_applied = 0.0

        for item, eval_res in item_evaluations:
            gross = round(float(item.gross_amount), 2)
            eligible = round(float(eval_res.eligible_amount), 2)
            stages = list(eval_res.stages)

            if eligible <= 0:
                # 100% Non-covered / Excluded
                covered = 0.0
                payable = gross
                stages.append({
                    "stage": 3,
                    "stage_name": "FINAL_RECONCILIATION",
                    "input_amount": gross,
                    "adjustment_amount": -gross,
                    "output_amount": 0.0,
                    "formula": "Non-covered item passed 100% to patient payable"
                })
            else:
                # Apply deductible portion
                ded_for_item = 0.0
                if remaining_deductible > 0:
                    ded_for_item = min(eligible, remaining_deductible)
                    remaining_deductible -= ded_for_item
                    total_deductible_applied += ded_for_item

                post_deductible = eligible - ded_for_item

                stages.append({
                    "stage": 3,
                    "stage_name": "DEDUCTIBLE",
                    "input_amount": eligible,
                    "adjustment_amount": -ded_for_item,
                    "output_amount": post_deductible,
                    "formula": f"Deductible applied: ₹{ded_for_item:,.2f}"
                })

                # Apply co-pay
                copay_amount = round(post_deductible * (copay_pct / 100.0), 2)
                total_copay_applied += copay_amount
                post_copay = post_deductible - copay_amount

                stages.append({
                    "stage": 4,
                    "stage_name": "CO_PAY",
                    "input_amount": post_deductible,
                    "adjustment_amount": -copay_amount,
                    "output_amount": post_copay,
                    "formula": f"Co-pay ({copay_pct}%): ₹{copay_amount:,.2f}"
                })

                # Apply sum insured ceiling
                insured_covered = min(post_copay, remaining_sum_insured)
                remaining_sum_insured -= insured_covered

                covered = round(insured_covered, 2)
                payable = round(gross - covered, 2)

                stages.append({
                    "stage": 5,
                    "stage_name": "FINAL_COVERAGE",
                    "input_amount": post_copay,
                    "adjustment_amount": round(insured_covered - post_copay, 2),
                    "output_amount": covered,
                    "formula": f"Final insurer covered = ₹{covered:,.2f}, patient pays = ₹{payable:,.2f}"
                })

            # Invariant check
            assert covered >= 0.0, "Covered amount cannot be negative"
            assert payable >= 0.0, "Patient payable cannot be negative"
            assert round(covered + payable, 2) >= round(gross, 2) - 0.05, "Reconciliation invariant violated"

            total_covered += covered
            total_patient_payable += payable

            decision_status = eval_res.status
            if covered > 0 and payable > 0:
                decision_status = "PARTIALLY_COVERED"
            elif covered == 0 and gross > 0:
                decision_status = "EXCLUDED"
            elif covered == gross:
                decision_status = "COVERED"

            results.append({
                "line_item_id": item.id,
                "decision_status": decision_status,
                "eligible_amount": eligible,
                "covered_amount": covered,
                "patient_payable": payable,
                "confidence": eval_res.confidence,
                "rule_id": eval_res.rule_applied,
                "policy_field": eval_res.policy_field,
                "requires_human_review": eval_res.requires_human_review,
                "explanation": eval_res.explanation,
                "stages": stages
            })

        return {
            "line_decisions": results,
            "total_gross": round(total_gross, 2),
            "total_eligible": round(total_eligible, 2),
            "total_covered": round(total_covered, 2),
            "total_patient_payable": round(total_patient_payable, 2),
            "deductible_applied": round(total_deductible_applied, 2),
            "copay_applied": round(total_copay_applied, 2),
            "remaining_sum_insured": round(remaining_sum_insured, 2)
        }
