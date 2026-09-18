from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any
from backend.app.config import settings
from backend.app.integrations.beeceptor.client import BeeceptorIntegrationClient
from backend.app.integrations.n8n.dispatcher import N8NWebhookDispatcher

router = APIRouter(prefix="/integrations", tags=["Integrations (Beeceptor & n8n)"])

class BeeceptorTestRequest(BaseModel):
    scenario: str = "SUCCESS" # SUCCESS, QUERY, REJECTION, TIMEOUT, 500
    case_payload: Optional[Dict[str, Any]] = None

class N8NTestRequest(BaseModel):
    event_type: str = "CASE_STATUS_CHANGED"
    sample_data: Optional[Dict[str, Any]] = None

@router.get("/status")
def get_integrations_status():
    return {
        "beeceptor": {
            "status": "CONNECTED",
            "base_url": settings.BEECEPTOR_BASE_URL,
            "mode": "HYBRID_WITH_LOCAL_SIMULATOR",
            "supported_scenarios": ["SUCCESS", "QUERY", "REJECTION", "TIMEOUT", "500"]
        },
        "n8n": {
            "status": "CONFIGURED" if settings.N8N_ENABLED else "DISABLED",
            "webhook_url": settings.N8N_WEBHOOK_URL,
            "is_blocking_dependency": False
        },
        "fhir": {
            "profile": "HL7 FHIR R4",
            "ndjson_export": "ENABLED"
        },
        "omop": {
            "version": "OMOP CDM v5.5",
            "status": "ACTIVE"
        }
    }

@router.post("/beeceptor/test-scenario")
async def test_beeceptor_scenario(payload: BeeceptorTestRequest):
    case_data = payload.case_payload or {
        "case_number": "MED-TEST-001",
        "hospital_id": "HOSP-001",
        "estimated_covered": 75000.0
    }
    result = await BeeceptorIntegrationClient.submit_preauthorization(case_data, payload.scenario)
    return {
        "requested_scenario": payload.scenario,
        "beeceptor_response": result
    }

@router.post("/n8n/trigger-test")
def trigger_n8n_test(payload: N8NTestRequest):
    data = payload.sample_data or {
        "case_number": "MED-DEMO-2026",
        "event": payload.event_type,
        "status": "APPROVED",
        "coverage_amount": 54000.0
    }
    N8NWebhookDispatcher.dispatch_case_event(payload.event_type, data)
    return {
        "message": "Webhook successfully dispatched to n8n automation engine (non-blocking)",
        "endpoint": settings.N8N_WEBHOOK_URL,
        "payload": data
    }
