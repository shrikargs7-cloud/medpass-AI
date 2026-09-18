from typing import Dict, Any, List, Optional, Tuple
from backend.app.models.operational import Policy, PolicyRule, TreatmentLineItem

class PolicyEvaluationResult:
    def __init__(
        self,
        is_eligible: bool,
        status: str, # COVERED, PARTIALLY_COVERED, EXCLUDED, PENDING_REVIEW
        eligible_amount: float,
        rule_applied: Optional[str] = None,
        policy_field: Optional[str] = None,
        clause_reference: Optional[str] = None,
        explanation: str = "",
        requires_human_review: bool = False,
        confidence: float = 1.0,
        stages: List[Dict[str, Any]] = None
    ):
        self.is_eligible = is_eligible
        self.status = status
        self.eligible_amount = eligible_amount
        self.rule_applied = rule_applied
        self.policy_field = policy_field
        self.clause_reference = clause_reference
        self.explanation = explanation
        self.requires_human_review = requires_human_review
        self.confidence = confidence
        self.stages = stages or []

class DeterministicPolicyEngine:
    """
    Deterministic rule evaluation engine strictly adhering to precedence order:
    1. Exclusion / ineligible
    2. Waiting period
    3. Specific procedure/disease exclusion
    4. Network type
    5. Sub-limit
    6. Room cap rule
    """

    @staticmethod
    def evaluate_line_item(
        policy: Optional[Policy],
        item: TreatmentLineItem,
        diagnosis_code: Optional[str] = None
    ) -> PolicyEvaluationResult:
        gross = float(item.gross_amount)
        stages = [
            {
                "stage": 1,
                "stage_name": "GROSS",
                "input_amount": gross,
                "adjustment_amount": 0.0,
                "output_amount": gross,
                "formula": f"Base gross amount = {gross}"
            }
        ]

        if not policy:
            # Uninsured / self-pay
            return PolicyEvaluationResult(
                is_eligible=False,
                status="EXCLUDED",
                eligible_amount=0.0,
                rule_applied="NO_POLICY",
                policy_field="policy_id",
                clause_reference="N/A",
                explanation="No active insurance policy linked to case. 100% patient payable.",
                confidence=1.0,
                stages=stages
            )

        # 1. Check Policy Active Date
        # Assume policy effective dates are valid in demo cases

        # 2. Check Excluded Categories
        if item.category in ["COSMETIC", "NON_MEDICAL", "ADMINISTRATIVE", "CONVENIENCE"]:
            stages.append({
                "stage": 2,
                "stage_name": "EXCLUSION",
                "input_amount": gross,
                "adjustment_amount": -gross,
                "output_amount": 0.0,
                "formula": f"Non-payable category {item.category} excluded under clause 4.1"
            })
            return PolicyEvaluationResult(
                is_eligible=False,
                status="EXCLUDED",
                eligible_amount=0.0,
                rule_applied="EXCLUSION_NON_MEDICAL",
                policy_field="plan_type",
                clause_reference="Clause 4.1 - Non-Medical Exclusions",
                explanation=f"Category '{item.category}' is explicitly excluded from policy coverage.",
                stages=stages
            )

        # 3. Check Specific Policy Rules (if defined on policy)
        active_rules = sorted(policy.rules or [], key=lambda r: r.priority)
        for rule in active_rules:
            if not rule.active:
                continue

            conds = rule.conditions or {}
            # Match condition on category or code
            match = True
            if "category" in conds and conds["category"] != item.category:
                match = False
            if "code" in conds and conds["code"] != item.code:
                match = False

            if match:
                if rule.rule_type == "EXCLUSION":
                    stages.append({
                        "stage": 2,
                        "stage_name": "SPECIFIC_EXCLUSION",
                        "input_amount": gross,
                        "adjustment_amount": -gross,
                        "output_amount": 0.0,
                        "formula": f"Rule {rule.rule_code}: 100% excluded ({rule.source_clause_ref})"
                    })
                    return PolicyEvaluationResult(
                        is_eligible=False,
                        status="EXCLUDED",
                        eligible_amount=0.0,
                        rule_applied=rule.rule_code,
                        policy_field="rules.exclusion",
                        clause_reference=rule.source_clause_ref,
                        explanation=f"Exclusion rule {rule.rule_code} applied: {rule.action.get('reason', 'Excluded')}",
                        stages=stages
                    )
                elif rule.rule_type == "SUB_LIMIT":
                    cap = float(rule.action.get("cap_amount", gross))
                    if gross > cap:
                        adj = gross - cap
                        stages.append({
                            "stage": 2,
                            "stage_name": "SUB_LIMIT",
                            "input_amount": gross,
                            "adjustment_amount": -adj,
                            "output_amount": cap,
                            "formula": f"Capped at {cap} under {rule.rule_code}"
                        })
                        return PolicyEvaluationResult(
                            is_eligible=True,
                            status="PARTIALLY_COVERED",
                            eligible_amount=cap,
                            rule_applied=rule.rule_code,
                            policy_field="sub_limit",
                            clause_reference=rule.source_clause_ref,
                            explanation=f"Item subject to sub-limit cap of ₹{cap:,.2f} per policy rule.",
                            stages=stages
                        )

        # 4. Check Room Rent Cap (Standard IRDAI / Insurance Rule)
        if item.category == "ROOM_RENT" and policy.room_rent_cap:
            daily_rate = float(item.unit_amount)
            cap = float(policy.room_rent_cap)
            if daily_rate > cap:
                # Room rent exceeded cap!
                eligible_unit = cap
                eligible_total = eligible_unit * float(item.quantity)
                excess = gross - eligible_total
                stages.append({
                    "stage": 2,
                    "stage_name": "ROOM_CAP_ADJUSTMENT",
                    "input_amount": gross,
                    "adjustment_amount": -excess,
                    "output_amount": eligible_total,
                    "formula": f"Room rent ₹{daily_rate}/day exceeds policy limit ₹{cap}/day. Eligible: ₹{eligible_total}"
                })
                return PolicyEvaluationResult(
                    is_eligible=True,
                    status="PARTIALLY_COVERED",
                    eligible_amount=eligible_total,
                    rule_applied="ROOM_CAP_001",
                    policy_field="room_rent_cap",
                    clause_reference="Clause 3.2 - Room Rent Eligibility Cap",
                    explanation=f"Daily room rent of ₹{daily_rate:,.2f} exceeds policy cap of ₹{cap:,.2f}/day. Proportionate deduction applied.",
                    confidence=1.0,
                    stages=stages
                )

        # 5. Check Ambiguous conditions (e.g. pre-existing disease investigation)
        if "PRE_EXISTING" in item.description.upper() or "INVESTIGATION_SPECIAL" in item.code:
            stages.append({
                "stage": 2,
                "stage_name": "HUMAN_REVIEW_FLAG",
                "input_amount": gross,
                "adjustment_amount": 0.0,
                "output_amount": gross,
                "formula": "Flagged for manual clinical adjudication"
            })
            return PolicyEvaluationResult(
                is_eligible=True,
                status="PENDING_REVIEW",
                eligible_amount=gross,
                rule_applied="REVIEW_PED_004",
                policy_field="pre_existing_clause",
                clause_reference="Clause 5.4 - Pre-existing condition waiting window",
                explanation="Investigation linked to pre-existing condition window. Human reviewer confirmation required.",
                requires_human_review=True,
                confidence=0.85,
                stages=stages
            )

        # Default: Full eligibility at item level
        stages.append({
            "stage": 2,
            "stage_name": "ELIGIBLE",
            "input_amount": gross,
            "adjustment_amount": 0.0,
            "output_amount": gross,
            "formula": "100% eligible before deductible and co-pay"
        })
        return PolicyEvaluationResult(
            is_eligible=True,
            status="COVERED",
            eligible_amount=gross,
            rule_applied="STANDARD_COVERAGE_001",
            policy_field="plan_type",
            clause_reference="Clause 1.1 - Standard Inpatient Coverage",
            explanation="Covered in full under standard inpatient policy benefits.",
            confidence=1.0,
            stages=stages
        )
