import asyncio
import pytest
from backend.app.integrations.beeceptor.client import BeeceptorIntegrationClient
from backend.app.services.mcp_server import MCPServer

def test_beeceptor_scenarios():
    async def _run():
        payload = {"case_number": "MED-TEST-001", "estimated_covered": 50000.0}

        # Success scenario
        resp_success = await BeeceptorIntegrationClient.submit_preauthorization(payload, "SUCCESS")
        assert resp_success["status"] == "APPROVED"
        assert "BEE-PREAUTH" in resp_success["external_reference"]

        # Query scenario
        resp_query = await BeeceptorIntegrationClient.submit_preauthorization(payload, "QUERY")
        assert resp_query["status"] == "QUERY_RAISED"
        assert "query_text" in resp_query

        # Rejection scenario
        resp_rej = await BeeceptorIntegrationClient.submit_preauthorization(payload, "REJECTION")
        assert resp_rej["status"] == "REJECTED"
        assert "rejection_code" in resp_rej

    asyncio.run(_run())

def test_mcp_tool_definitions():
    tools = MCPServer.get_tool_definitions()
    names = {t.name for t in tools}
    assert "get_case" in names
    assert "get_policy" in names
    assert "check_coverage" in names
    assert "get_blockers" in names
    assert "get_decision_evidence" in names
    assert "query_trace_dataset" in names
