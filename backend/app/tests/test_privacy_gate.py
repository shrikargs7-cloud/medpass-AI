import pytest
from backend.app.services.privacy_service import PrivacyDeidentificationService

def test_deny_list_filtration():
    raw_record = {
        "name": "Dr. Rajesh Kumar",
        "full_name": "Suresh Raina",
        "phone": "+91 9876543210",
        "email": "patient@hospital.org",
        "encounter_key": "ENC-001",
        "concept_code": "K35.80",
        "age_band": "31-45"
    }

    sanitized, passed, quarantine = PrivacyDeidentificationService.sanitize_record(raw_record)

    assert "name" not in sanitized
    assert "full_name" not in sanitized
    assert "phone" not in sanitized
    assert "email" not in sanitized
    assert sanitized["encounter_key"] == "ENC-001"
    assert sanitized["concept_code"] == "K35.80"

def test_pii_regex_scanner():
    text_with_phone = "Patient relative contact is 9876543210 for billing."
    findings = PrivacyDeidentificationService.scan_for_pii(text_with_phone)
    assert len(findings) > 0
    assert findings[0]["type"] == "PHONE_NUMBER"

def test_small_cell_suppression():
    # 4 rows with '80+' (< 5 minimum k threshold) and 6 rows with '31-45'
    rows = [{"age_band": "80+"} for _ in range(4)] + [{"age_band": "31-45"} for _ in range(6)]
    filtered, suppressed_count = PrivacyDeidentificationService.apply_small_cell_suppression(rows, "age_band", min_k=5)

    assert suppressed_count == 4
    for r in filtered[:4]:
        assert r["age_band"] == "SUPPRESSED_<5"
    for r in filtered[4:]:
        assert r["age_band"] == "31-45"
