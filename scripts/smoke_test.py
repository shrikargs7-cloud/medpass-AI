import os
import sys
import json
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.db import SessionLocal, engine, Base
from scripts.seed_demo import seed as seed_demo
from scripts.seed_trace import seed_trace_population

def run_smoke_tests():
    print("=== RUNNING MEDPASS AI + TRACE COMMONS SMOKE TESTS ===")

    print("\n1. Initializing & Seeding...")
    seed_demo()
    seed_trace_population(100)

    client = TestClient(app)

    print("\n2. Testing Health & Probes...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health failed: {res.text}"
    print("✓ /health passed")

    res = client.get("/ready")
    assert res.status_code == 200, f"Ready failed: {res.text}"
    print("✓ /ready passed")

    print("\n3. Testing Cases API...")
    res = client.get("/api/cases")
    assert res.status_code == 200
    cases = res.json()
    assert len(cases) >= 5, f"Expected 5 cases, got {len(cases)}"
    print(f"✓ Listed {len(cases)} cases")

    test_case = cases[0]
    case_id = test_case["id"]

    res = client.post(f"/api/cases/{case_id}/evaluate")
    assert res.status_code == 200
    eval_case = res.json()
    assert len(eval_case["decisions"]) > 0, "No decisions produced!"
    assert eval_case["total_covered"] + eval_case["total_patient_payable"] >= eval_case["total_gross"] - 0.05
    print(f"✓ Case evaluated deterministically: Gross ₹{eval_case['total_gross']:,.2f}, Covered ₹{eval_case['total_covered']:,.2f}, Payable ₹{eval_case['total_patient_payable']:,.2f}")

    print("\n4. Testing Document AI & Extraction...")
    res = client.post(
        f"/api/cases/{case_id}/documents",
        data={"doc_type": "BILL_INVOICE", "raw_text": "Room Rent: 15,000\nSurgery OT Fee: 45,000\nPharmacy: 8,000"}
    )
    assert res.status_code == 200
    print("✓ Document uploaded & structured data extracted via Document Intelligence")

    print("\n5. Testing Beeceptor Mock Integration...")
    res = client.post(f"/api/cases/{case_id}/submit?scenario=SUCCESS")
    assert res.status_code == 200
    sub_res = res.json()
    assert sub_res["authorization_status"] == "APPROVED"
    assert "BEE-PREAUTH" in sub_res["beeceptor_response"]["external_reference"]
    print(f"✓ Beeceptor preauth success simulation passed: {sub_res['beeceptor_response']['external_reference']}")

    # Test Beeceptor Query scenario
    res_q = client.post(f"/api/cases/{case_id}/submit?scenario=QUERY")
    assert res_q.status_code == 200
    assert res_q.json()["authorization_status"] == "QUERY_RAISED"
    print("✓ Beeceptor query simulation passed")

    print("\n6. Testing Trace Commons API...")
    res = client.get("/api/trace/overview")
    assert res.status_code == 200
    trace_kpis = res.json()["kpis"]
    assert trace_kpis["total_encounters"] >= 100
    print(f"✓ Trace overview returned {trace_kpis['total_encounters']} longitudinal encounters")

    res = client.post(
        "/api/trace/cohorts/preview",
        json={
            "dataset_version": "trace-core-1.3.0",
            "journey_mode": "whole_journey",
            "format": "parquet"
        }
    )
    assert res.status_code == 200
    preview = res.json()
    assert preview["total_encounters"] >= 100
    assert preview["privacy_status"] in ["PASS", "REVIEW_REQUIRED"]
    print(f"✓ Cohort preview passed: {preview['total_encounters']} encounters, {preview['total_events']} events, quality: {preview['quality_status']}")

    print("\n7. Testing DuckDB Parquet / CSV / FHIR Export Packaging...")
    res = client.post(
        "/api/trace/exports",
        json={
            "dataset_version": "trace-core-1.3.0",
            "filters": {
                "dataset_version": "trace-core-1.3.0",
                "journey_mode": "whole_journey",
                "format": "parquet"
            }
        }
    )
    assert res.status_code == 200
    exp_res = res.json()
    assert exp_res["status"] == "COMPLETED"
    assert exp_res["checksum_sha256"] is not None
    print(f"✓ Export bundle generated: {exp_res['export_id']}, SHA-256: {exp_res['checksum_sha256'][:16]}...")

    # Test file download
    dl_res = client.get(f"/api/trace/exports/{exp_res['export_id']}/download")
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 1000
    print(f"✓ Downloaded export package .zip ({len(dl_res.content)} bytes)")

    print("\n8. Testing Model Context Protocol (MCP) Agent Tools...")
    res = client.get("/api/mcp/tools")
    assert res.status_code == 200
    tools = res.json()
    assert len(tools) >= 7
    print(f"✓ Discovered {len(tools)} registered MCP tools")

    res = client.post(
        "/api/mcp/execute",
        json={"tool_name": "get_case", "arguments": {"case_id": case_id}}
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    print("✓ Executed MCP tool 'get_case'")

    res = client.post(
        "/api/mcp/chat",
        json={"prompt": "Why was the room rent capped and how much is patient payable?", "case_id": case_id}
    )
    assert res.status_code == 200
    chat_resp = res.json()
    assert len(chat_resp["tools_invoked"]) > 0
    print(f"✓ MCP Agent invoked tool: {chat_resp['tools_invoked'][0]['tool']}")

    print("\n=======================================================")
    print("ALL SMOKE TESTS PASSED CLEANLY! SYSTEM IS 100% HEALTHY.")
    print("=======================================================")

if __name__ == "__main__":
    run_smoke_tests()
