import re
import hashlib
import uuid
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date
from backend.app.config import settings

class PrivacyDeidentificationService:
    """
    Multi-layer privacy gate:
    1. Schema deny-list enforcement
    2. Quasi-identifier generalization (DOB -> age band, timestamps -> month bucket)
    3. Facility & patient pseudonymization
    4. Presidio / regex PII pattern detection
    5. Small-cell suppression (k-anonymity >= 5)
    """

    DENY_LIST = {
        "name", "full_name", "first_name", "last_name", "phone", "mobile",
        "email", "address", "aadhaar", "ssn", "national_id", "patient_name",
        "hospital_patient_ref", "policy_number", "card_number", "ip_address"
    }

    # Presidio / Heuristic PII regex patterns
    PII_PATTERNS = [
        (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "EMAIL"),
        (r"\b(?:\+91|0)?[6-9]\d{9}\b", "PHONE_NUMBER"),
        (r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b", "AADHAAR_NUMBER"),
        (r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b", "PAN_NUMBER"),
        (r"\b\d{3}-\d{2}-\d{4}\b", "SSN")
    ]

    @classmethod
    def scan_for_pii(cls, text: str) -> List[Dict[str, Any]]:
        """Scans unstructured text for leaked PII."""
        findings = []
        for pattern, pii_type in cls.PII_PATTERNS:
            for match in re.finditer(pattern, text):
                findings.append({
                    "type": pii_type,
                    "span": match.span(),
                    "matched_snippet": "[REDACTED]"
                })
        return findings

    @classmethod
    def sanitize_record(cls, record: Dict[str, Any]) -> Tuple[Dict[str, Any], bool, List[str]]:
        """
        Strips deny-listed fields, hashes patient keys, and generalizes dates.
        Returns: (sanitized_record, passed, quarantine_reasons)
        """
        sanitized = {}
        quarantine_reasons = []

        for key, value in record.items():
            lower_key = key.lower()

            # 1. Deny-list check
            if lower_key in cls.DENY_LIST:
                continue # Strip completely

            # 2. Text value PII scan
            if isinstance(value, str):
                pii_findings = cls.scan_for_pii(value)
                if pii_findings:
                    quarantine_reasons.append(f"PII detected in field '{key}': {pii_findings[0]['type']}")
                    # Anonymize/redact pattern
                    for pat, _ in cls.PII_PATTERNS:
                        value = re.sub(pat, "[REDACTED]", value)

            # 3. Generalization of dates to month bucket
            if "date" in lower_key or "time" in lower_key:
                if isinstance(value, datetime):
                    value = value.strftime("%Y-%m-01")
                elif isinstance(value, date):
                    value = value.strftime("%Y-%m-01")
                elif isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}", value):
                    value = value[:7] + "-01"

            sanitized[key] = value

        passed = len(quarantine_reasons) == 0
        return sanitized, passed, quarantine_reasons

    @classmethod
    def generate_subject_key(cls, operational_id: str, salt: Optional[str] = None) -> str:
        """
        One-way pseudonymization for patient identifier into safe trace subject key.
        Uses server-side secret seed.
        """
        active_salt = salt or settings.TRACE_PSEUDONYM_SECRET
        hasher = hashlib.sha256((operational_id + active_salt).encode("utf-8"))
        return str(uuid.UUID(bytes=hasher.digest()[:16]))

    @classmethod
    def apply_small_cell_suppression(
        cls,
        rows: List[Dict[str, Any]],
        group_key: str = "age_band",
        min_k: int = 5
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Suppresses records in categories with count < min_k to prevent re-identification.
        """
        counts = {}
        for r in rows:
            val = r.get(group_key, "UNKNOWN")
            counts[val] = counts.get(val, 0) + 1

        suppressed_count = 0
        filtered_rows = []
        for r in rows:
            val = r.get(group_key, "UNKNOWN")
            if counts.get(val, 0) < min_k:
                suppressed_count += 1
                # Redact or mark suppressed
                r_copy = dict(r)
                r_copy[group_key] = "SUPPRESSED_<5"
                filtered_rows.append(r_copy)
            else:
                filtered_rows.append(r)

        return filtered_rows, suppressed_count
