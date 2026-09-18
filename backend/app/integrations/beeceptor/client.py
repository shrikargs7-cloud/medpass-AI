import httpx
import uuid
from typing import Dict, Any, Optional
from backend.app.config import settings

class BeeceptorIntegrationClient:
    """
    Client for mocking external insurance and health authority endpoints via Beeceptor:
    1. Insurer Preauthorization API
    2. NHCX Claim Submission & Status API
    3. Hospital / FHIR Data Source

    Supports simulated scenarios:
    - Success (202 / 200 with external reference)
    - Query (200 with query request)
    - Rejection (200 with rejection reason)
    - Timeout (handles delays gracefully)
    - 500 (handles server error with fallback)
    """

    BASE_URL = settings.BEECEPTOR_BASE_URL
    SIMULATE_LOCALLY = settings.SIMULATE_BEECEPTOR_LOCALLY

    @classmethod
    async def submit_preauthorization(
        cls,
        case_payload: Dict[str, Any],
        simulated_mode: str = "SUCCESS" # SUCCESS, QUERY, REJECTION, TIMEOUT, 500
    ) -> Dict[str, Any]:
        """Submits preauthorization request to external insurer mock endpoint."""
        endpoint = f"{cls.BASE_URL}/api/v1/preauth/submit"
        tx_id = str(uuid.uuid4())[:8].upper()

        if not cls.SIMULATE_LOCALLY:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.post(
                        endpoint,
                        json={"transaction_id": tx_id, "case": case_payload, "scenario": simulated_mode},
                        headers={"X-Mock-Scenario": simulated_mode}
                    )
                    if resp.status_code in [200, 202]:
                        return resp.json()
            except Exception:
                pass # Fall back to local simulator seamlessly

        # Local deterministic Beeceptor simulation
        if simulated_mode == "SUCCESS":
            return {
                "status": "APPROVED",
                "http_status": 202,
                "external_reference": f"BEE-PREAUTH-{tx_id}",
                "authorized_amount": case_payload.get("estimated_covered", 50000.0),
                "comments": "Initial pre-authorization accepted and approved by mock payer gateway.",
                "payer_identifier": "INS-STAR-HEALTH-01",
                "integration_source": "BEECEPTOR_MOCK_SUCCESS"
            }
        elif simulated_mode == "QUERY":
            return {
                "status": "QUERY_RAISED",
                "http_status": 200,
                "external_reference": f"BEE-QUERY-{tx_id}",
                "query_category": "CLINICAL_JUSTIFICATION",
                "query_text": "Please provide pre-operative ultrasound scan or clinical OT notes for line item validation.",
                "required_action": "Upload diagnostic report to clear query.",
                "integration_source": "BEECEPTOR_MOCK_QUERY"
            }
        elif simulated_mode == "REJECTION":
            return {
                "status": "REJECTED",
                "http_status": 200,
                "external_reference": f"BEE-REJ-{tx_id}",
                "rejection_code": "EXCLUSION_PED_ACTIVE",
                "rejection_reason": "Pre-existing disease 2-year waiting period has not completed as per clause 4.2.",
                "integration_source": "BEECEPTOR_MOCK_REJECTION"
            }
        elif simulated_mode == "TIMEOUT":
            return {
                "status": "GATEWAY_TIMEOUT",
                "http_status": 504,
                "external_reference": None,
                "error": "Upstream insurer preauth server failed to respond within 5000ms. Queued for background retry.",
                "integration_source": "BEECEPTOR_MOCK_TIMEOUT"
            }
        else: # 500
            return {
                "status": "UPSTREAM_ERROR",
                "http_status": 500,
                "external_reference": None,
                "error": "Internal 500 Server Error at payer claims adjudication clearinghouse.",
                "integration_source": "BEECEPTOR_MOCK_500"
            }

    @classmethod
    async def submit_nhcx_claim(
        cls,
        claim_payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Submits final claim to NHCX-shaped mock interchange."""
        return {
            "nhcx_bundle_id": f"NHCX-{uuid.uuid4().hex[:12].upper()}",
            "ack_status": "ACCEPTED",
            "settlement_status": "PROCESSING",
            "timestamp": "2026-09-18T10:00:00Z"
        }
