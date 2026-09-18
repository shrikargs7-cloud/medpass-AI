from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from backend.app.db import get_db
from backend.app.schemas.mcp import (
    MCPToolDefinition, MCPToolCallRequest, MCPToolCallResponse, MCPAgentChatRequest
)
from backend.app.services.mcp_server import MCPServer
from backend.app.services.chatbot_service import ChatbotService
from backend.app.models.operational import Case

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
    Topic-bounded AI Healthcare Assistant.
    Answers ONLY questions related to healthcare, hospital workflows, clinical treatments,
    insurance policies, claims, and discharge blockers. Strictly declines off-topic prompts.
    Supports live Gemini / OpenAI when API keys are configured, with deterministic fallback.
    """
    case_context = None
    tools_invoked = []

    if payload.case_id:
        case = db.query(Case).filter((Case.id == payload.case_id) | (Case.case_number == payload.case_id)).first()
        if case:
            # Build case summary for contextual AI reasoning
            total_gross = sum([float(i.gross_amount) for i in (case.line_items or [])])
            total_covered = sum([float(d.covered_amount) for d in (case.decisions or [])])
            total_payable = sum([float(d.patient_payable) for d in (case.decisions or [])])
            blockers = [
                {
                    "type": b.blocker_type,
                    "severity": b.severity,
                    "description": b.description,
                    "action_required": b.action_required
                }
                for b in (case.blockers or []) if not b.is_resolved
            ]
            blockers_summary = "; ".join([f"{b['type']}: {b['description']}" for b in blockers]) if blockers else "None"

            case_context = {
                "case_id": case.id,
                "case_number": case.case_number,
                "patient_name": case.patient.full_name if case.patient else "Patient",
                "diagnosis": f"{case.primary_diagnosis_code}: {case.primary_diagnosis_name}",
                "status": case.case_status,
                "readiness_score": case.readiness_score,
                "readiness_band": case.readiness_band,
                "total_gross": total_gross,
                "total_covered": total_covered,
                "total_patient_payable": total_payable,
                "blockers": blockers,
                "blockers_summary": blockers_summary
            }
            tools_invoked.append({"tool": "get_case", "case_number": case.case_number})

    # Call topic-bounded chatbot service
    result = ChatbotService.answer_query(
        prompt=payload.prompt,
        case_context=case_context,
        custom_api_key=payload.api_key,
        provider=payload.provider
    )

    return {
        "reply": result["reply"],
        "tools_invoked": tools_invoked,
        "guardrail_status": result.get("status", "SUCCESS"),
        "provider": result.get("provider", "deterministic_engine"),
        "bounded": True
    }
