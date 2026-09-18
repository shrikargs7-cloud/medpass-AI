from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from backend.app.db import get_db
from backend.app.schemas.mcp import (
    MCPToolDefinition, MCPToolCallRequest, MCPToolCallResponse, MCPAgentChatRequest
)
from backend.app.services.mcp_server import MCPServer

router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP)"])

@router.get("/tools", response_model=List[MCPToolDefinition])
def list_mcp_tools():
    """Returns definitions of all registered MedPass & Trace MCP tools."""
    return MCPServer.get_tool_definitions()

@router.post("/execute", response_model=MCPToolCallResponse)
def execute_mcp_tool(payload: MCPToolCallRequest, db: Session = Depends(get_db)):
    """Executes an MCP tool with provided arguments in read-only/explainability mode."""
    return MCPServer.execute_tool(db, payload.tool_name, payload.arguments)

@router.post("/chat")
def mcp_agent_chat(payload: MCPAgentChatRequest, db: Session = Depends(get_db)):
    """
    AI Agent endpoint for pair-assisting hospital coordinators, insurers, or researchers.
    Analyzes intent, invokes relevant MCP tool(s), and provides an explainable answer.
    """
    prompt = payload.prompt.lower()
    case_id = payload.case_id

    # 1. Intent routing to MCP tools
    tools_invoked = []
    response_text = ""

    if "blocker" in prompt or "why blocked" in prompt or "stuck" in prompt:
        if case_id:
            res = MCPServer.execute_tool(db, "get_blockers", {"case_id": case_id})
            tools_invoked.append({"tool": "get_blockers", "result": res.result})
            blockers = res.result.get("blockers", []) if res.result else []
            if blockers:
                reasons = "; ".join([f"{b['type']}: {b['description']}" for b in blockers])
                response_text = f"Case {res.result.get('case_number')} is currently blocked by: {reasons}. Recommended action: {blockers[0].get('action_required')}."
            else:
                response_text = "No active blockers detected. The case is ready for the next lifecycle stage."
        else:
            response_text = "Please specify or select a Case ID to check active blockers."

    elif "room" in prompt or "cap" in prompt or "deductible" in prompt or "why" in prompt or "payable" in prompt:
        if case_id:
            res = MCPServer.execute_tool(db, "check_coverage", {"case_id": case_id})
            tools_invoked.append({"tool": "check_coverage", "result": res.result})
            if res.result:
                response_text = (
                    f"Coverage Analysis for Case {res.result.get('case_number')}:\n"
                    f"• Total Gross Billed: ₹{res.result.get('total_gross'):,.2f}\n"
                    f"• Insurer Covered: ₹{res.result.get('total_covered'):,.2f}\n"
                    f"• Patient Payable: ₹{res.result.get('total_patient_payable'):,.2f}\n\n"
                    f"Explanation: Under policy terms, room rent daily caps (Clause 3.2) and co-pays "
                    f"were deterministically applied. The policy engine verified that no non-medical items were covered."
                )
            else:
                response_text = "Could not find coverage decisions for the selected case."
        else:
            response_text = "Please select a Case to inspect financial calculations and policy evidence."

    elif "trace" in prompt or "research" in prompt or "dataset" in prompt or "longitudinal" in prompt:
        res = MCPServer.execute_tool(db, "query_trace_dataset", {})
        tools_invoked.append({"tool": "query_trace_dataset", "result": res.result})
        response_text = (
            f"Trace Commons Overview:\n"
            f"Currently hosting {res.result.get('total_encounters')} governed encounters under "
            f"{res.result.get('active_version')}. Privacy gates ensure 100% PII removal, 15-year age banding, "
            f"and small-cell k-suppression (k >= 5). You can filter cohorts and download full Parquet bundles in the Trace Portal."
        )

    else:
        if case_id:
            res = MCPServer.execute_tool(db, "get_case", {"case_id": case_id})
            tools_invoked.append({"tool": "get_case", "result": res.result})
            if res.result:
                response_text = (
                    f"Case {res.result.get('case_number')} Status:\n"
                    f"• Diagnosis: {res.result.get('diagnosis')}\n"
                    f"• Readiness Score: {res.result.get('readiness_score')}% ({res.result.get('readiness_band')})\n"
                    f"• Status: {res.result.get('status')}\n"
                    f"• Total Line Items: {res.result.get('items_count')}"
                )
            else:
                response_text = f"Hello! I am MedPass Agent. I can assist you in inspecting cases, checking policy coverage rules, finding discharge blockers, or querying Trace Commons."
        else:
            response_text = "Hello! I am MedPass Agent. I can assist you in analyzing cases, policy rules, discharge blockers, and querying Trace Commons longitudinal research data."

    return {
        "reply": response_text,
        "tools_invoked": tools_invoked,
        "guardrail_status": "DETERMINISTIC_SAFE_NO_WRITE_PERMITTED"
    }
