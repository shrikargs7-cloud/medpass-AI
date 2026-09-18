from typing import Dict, Any, List, Tuple
from backend.app.models.operational import Case, DischargeBlocker

class ReadinessAndBlockerEngine:
    """
    Computes case readiness percentage across weighted categories
    and discovers discharge/claim blockers.
    """

    @staticmethod
    def evaluate_readiness(case: Case) -> Dict[str, Any]:
        # 1. Documents (Weight: 35%)
        # Required: at least 1 BILL_INVOICE or DISCHARGE_SUMMARY or PRE_AUTH_FORM
        docs = case.documents or []
        doc_types = {d.doc_type for d in docs}
        has_id_or_card = any(t in doc_types for t in ["POLICY_CARD", "PRE_AUTH_FORM"])
        has_clinical = any(t in doc_types for t in ["DISCHARGE_SUMMARY", "LAB_REPORT", "CLINICAL_NOTE"])
        has_bill = any(t in doc_types for t in ["BILL_INVOICE", "ESTIMATE"])

        doc_score = 0.0
        if has_id_or_card:
            doc_score += 10.0
        if has_clinical:
            doc_score += 15.0
        if has_bill:
            doc_score += 10.0
        # If no documents at all, 0 / 35

        # 2. Diagnosis / Treatment structure (Weight: 20%)
        # Case has valid diagnosis code and at least 1 line item
        diag_score = 0.0
        if case.primary_diagnosis_code:
            diag_score += 10.0
        if case.line_items and len(case.line_items) > 0:
            diag_score += 10.0

        # 3. Policy fields (Weight: 15%)
        # Case has linked policy with valid sum_insured
        policy_score = 0.0
        if case.policy_id and case.policy:
            policy_score += 15.0
        elif case.policy_id:
            policy_score += 10.0

        # 4. Coverage mapping (Weight: 20%)
        # Evaluated decisions exist for line items
        coverage_score = 0.0
        if case.decisions and len(case.decisions) > 0:
            all_reviewed = not any(d.requires_human_review for d in case.decisions)
            coverage_score = 20.0 if all_reviewed else 12.0

        # 5. Submission payload readiness (Weight: 10%)
        payload_score = 0.0
        if case.patient and case.hospital:
            payload_score += 10.0

        total_score = round(doc_score + diag_score + policy_score + coverage_score + payload_score, 1)

        # Bands:
        # 85-100: SUBMISSION_READY
        # 60-84: REVIEW_REQUIRED
        # <60: BLOCKED
        if total_score >= 85.0:
            band = "SUBMISSION_READY"
        elif total_score >= 60.0:
            band = "REVIEW_REQUIRED"
        else:
            band = "BLOCKED"

        return {
            "documents_score": doc_score,
            "clinical_structure_score": diag_score,
            "policy_fields_score": policy_score,
            "coverage_mapping_score": coverage_score,
            "submission_payload_score": payload_score,
            "total_score": total_score,
            "band": band
        }

    @staticmethod
    def identify_blockers(case: Case) -> List[Dict[str, Any]]:
        blockers = []

        # 1. Missing document check
        docs = case.documents or []
        doc_types = {d.doc_type for d in docs}
        if not any(t in doc_types for t in ["BILL_INVOICE", "ESTIMATE"]):
            blockers.append({
                "blocker_type": "MISSING_DOCUMENT",
                "severity": "HIGH",
                "owner_role": "HOSPITAL_STAFF",
                "description": "Missing hospital bill invoice or detailed cost estimate.",
                "action_required": "Upload itemized billing invoice."
            })

        if not any(t in doc_types for t in ["DISCHARGE_SUMMARY", "LAB_REPORT"]):
            blockers.append({
                "blocker_type": "MISSING_DOCUMENT",
                "severity": "HIGH",
                "owner_role": "HOSPITAL_STAFF",
                "description": "Missing clinical summary or investigation report.",
                "action_required": "Upload physician clinical summary or diagnostic report."
            })

        # 2. Insurer Authorization status
        if case.authorization_status in ["PENDING", "PREAUTH_REQUESTED"]:
            blockers.append({
                "blocker_type": "INSURANCE_AUTHORIZATION",
                "severity": "CRITICAL",
                "owner_role": "INSURER_REVIEWER",
                "description": "Awaiting initial preauthorization approval from insurer.",
                "action_required": "Insurer adjudication and initial decision required."
            })
        elif case.authorization_status == "QUERY_RAISED":
            blockers.append({
                "blocker_type": "INSURER_QUERY",
                "severity": "CRITICAL",
                "owner_role": "HOSPITAL_STAFF",
                "description": "Insurer raised a query regarding clinical justification or itemization.",
                "action_required": "Hospital desk must submit query response documents."
            })

        # 3. Pending human review decisions
        if case.decisions and any(d.requires_human_review for d in case.decisions):
            blockers.append({
                "blocker_type": "CLINICAL_PENDING",
                "severity": "MEDIUM",
                "owner_role": "HOSPITAL_STAFF",
                "description": "Coverage evaluation flagged ambiguous clauses requiring manual review.",
                "action_required": "Hospital insurance coordinator must verify pre-existing clause."
            })

        # 4. Discharge billing clearance
        if case.case_status == "APPROVED" and case.discharge_status == "NOT_READY":
            blockers.append({
                "blocker_type": "BILLING_CLEARANCE",
                "severity": "HIGH",
                "owner_role": "BILLING_TEAM",
                "description": "Final billing reconciliation and patient copay settlement pending.",
                "action_required": "Collect patient payable balance and finalize discharge summary."
            })

        return blockers
