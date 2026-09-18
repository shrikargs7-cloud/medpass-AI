from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models.operational import Case, Policy, TreatmentLineItem, CoverageDecision, DischargeBlocker
from backend.app.models.audit import AuditLog
from backend.app.models.trace import TraceDataset, DatasetVersion, TraceEncounter
from backend.app.schemas.mcp import MCPToolDefinition, MCPToolCallResponse
from backend.app.services.blocker_engine import ReadinessAndBlockerEngine

class MCPServer:
    """
    Model Context Protocol (MCP) server providing structured read-only and explainability tools.
    Never allows an LLM agent to independently approve, deny, or mutate financial state.
    """

    @staticmethod
    def get_tool_definitions() -> List[MCPToolDefinition]:
        return [
            MCPToolDefinition(
                name="get_case",
                description="Retrieves full clinical, hospital, and insurance case status including line items and readiness score.",
                parameters={
                    "type": "object",
                    "properties": {"case_id": {"type": "string", "description": "The unique UUID or case number"}},
                    "required": ["case_id"]
                }
            ),
            MCPToolDefinition(
                name="get_policy",
                description="Fetches insurance policy terms, room rent cap, sum insured, deductible, and co-pay parameters.",
                parameters={
                    "type": "object",
                    "properties": {"policy_id": {"type": "string", "description": "Policy UUID or policy reference"}},
                    "required": ["policy_id"]
                }
            ),
            MCPToolDefinition(
                name="check_coverage",
                description="Returns deterministic coverage calculation, patient payable amount, and policy rules evaluated.",
                parameters={
                    "type": "object",
                    "properties": {"case_id": {"type": "string", "description": "Case UUID"}},
                    "required": ["case_id"]
                }
            ),
            MCPToolDefinition(
                name="get_blockers",
                description="Pinpoints active discharge or claim submission blockers and required remediation actions.",
                parameters={
                    "type": "object",
                    "properties": {"case_id": {"type": "string", "description": "Case UUID"}},
                    "required": ["case_id"]
                }
            ),
            MCPToolDefinition(
                name="get_case_timeline",
                description="Returns complete chronological audit history of case lifecycle events.",
                parameters={
                    "type": "object",
                    "properties": {"case_id": {"type": "string", "description": "Case UUID"}},
                    "required": ["case_id"]
                }
            ),
            MCPToolDefinition(
                name="get_decision_evidence",
                description="Inspects detailed 'Why?' evidence, clause references, and calculation ledger for a treatment line item.",
                parameters={
                    "type": "object",
                    "properties": {
                        "case_id": {"type": "string", "description": "Case UUID"},
                        "line_item_id": {"type": "string", "description": "Line item UUID"}
                    },
                    "required": ["case_id", "line_item_id"]
                }
            ),
            MCPToolDefinition(
                name="query_trace_dataset",
                description="Queries governed Trace Commons longitudinal dataset statistics, encounter counts, and quality metrics.",
                parameters={
                    "type": "object",
                    "properties": {
                        "dataset_version": {"type": "string", "description": "Version tag (e.g. trace-core-1.3.0)"},
                        "facility_key": {"type": "string", "description": "Optional facility filter"}
                    }
                }
            )
        ]

    @staticmethod
    def execute_tool(db: Session, tool_name: str, arguments: Dict[str, Any]) -> MCPToolCallResponse:
        try:
            if tool_name == "get_case":
                case_id = arguments.get("case_id")
                case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
                if not case:
                    return MCPToolCallResponse(tool_name=tool_name, success=False, result=None, explanation="Case not found.")

                items = [
                    {"code": i.code, "category": i.category, "description": i.description, "gross": i.gross_amount}
                    for i in (case.line_items or [])
                ]
                return MCPToolCallResponse(
                    tool_name=tool_name,
                    success=True,
                    result={
                        "case_id": case.id,
                        "case_number": case.case_number,
                        "status": case.case_status,
                        "readiness_score": case.readiness_score,
                        "readiness_band": case.readiness_band,
                        "diagnosis": f"{case.primary_diagnosis_code}: {case.primary_diagnosis_name}",
                        "patient_ref": case.patient.patient_ref if case.patient else "N/A",
                        "hospital": case.hospital.name if case.hospital else "N/A",
                        "items_count": len(items),
                        "items": items
                    },
                    explanation=f"Case {case.case_number} currently has readiness {case.readiness_score}% ({case.readiness_band})."
                )

            elif tool_name == "get_policy":
                policy_id = arguments.get("policy_id")
                policy = db.query(Policy).filter((Policy.id == policy_id) | (Policy.policy_ref == policy_id)).first()
                if not policy:
                    return MCPToolCallResponse(tool_name=tool_name, success=False, result=None, explanation="Policy not found.")

                return MCPToolCallResponse(
                    tool_name=tool_name,
                    success=True,
                    result={
                        "policy_id": policy.id,
                        "policy_ref": policy.policy_ref,
                        "plan_name": policy.plan_name,
                        "sum_insured": policy.sum_insured,
                        "deductible": policy.deductible,
                        "co_pay_pct": policy.co_pay_pct,
                        "room_rent_cap": policy.room_rent_cap,
                        "rules_count": len(policy.rules or [])
                    },
                    explanation=f"Policy {policy.policy_ref} has sum insured ₹{policy.sum_insured:,.2f} and room cap ₹{policy.room_rent_cap:,.2f}/day."
                )

            elif tool_name == "check_coverage":
                case_id = arguments.get("case_id")
                case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
                if not case:
                    return MCPToolCallResponse(tool_name=tool_name, success=False, result=None, explanation="Case not found.")

                decisions = []
                total_gross = 0.0
                total_covered = 0.0
                total_payable = 0.0
                rules_checked = set()

                for d in (case.decisions or []):
                    total_gross += (d.covered_amount + d.patient_payable)
                    total_covered += d.covered_amount
                    total_payable += d.patient_payable
                    if d.rule_id:
                        rules_checked.add(d.rule_id)
                    decisions.append({
                        "line_item": d.line_item.description if d.line_item else "Unknown",
                        "status": d.decision_status,
                        "covered": d.covered_amount,
                        "patient_payable": d.patient_payable,
                        "rule_id": d.rule_id,
                        "explanation": d.explanation
                    })

                return MCPToolCallResponse(
                    tool_name=tool_name,
                    success=True,
                    result={
                        "case_number": case.case_number,
                        "total_gross": round(total_gross, 2),
                        "total_covered": round(total_covered, 2),
                        "total_patient_payable": round(total_payable, 2),
                        "decisions": decisions
                    },
                    source_rules_checked=list(rules_checked),
                    explanation=f"Insurer covers ₹{total_covered:,.2f}; patient payable is ₹{total_payable:,.2f}."
                )

            elif tool_name == "get_blockers":
                case_id = arguments.get("case_id")
                case = db.query(Case).filter((Case.id == case_id) | (Case.case_number == case_id)).first()
                if not case:
                    return MCPToolCallResponse(tool_name=tool_name, success=False, result=None, explanation="Case not found.")

                blockers = [
                    {
                        "type": b.blocker_type,
                        "severity": b.severity,
                        "owner_role": b.owner_role,
                        "description": b.description,
                        "action_required": b.action_required,
                        "resolved": b.is_resolved
                    }
                    for b in (case.blockers or [])
                ]
                return MCPToolCallResponse(
                    tool_name=tool_name,
                    success=True,
                    result={"case_number": case.case_number, "blockers": blockers},
                    explanation=f"Found {len(blockers)} active blockers on case {case.case_number}."
                )

            elif tool_name == "get_case_timeline":
                case_id = arguments.get("case_id")
                audits = db.query(AuditLog).filter(AuditLog.resource_id == case_id).order_by(AuditLog.created_at.asc()).all()
                timeline = [
                    {
                        "action": a.action,
                        "actor_role": a.actor_role,
                        "timestamp": a.created_at.isoformat(),
                        "details": a.details
                    }
                    for a in audits
                ]
                return MCPToolCallResponse(
                    tool_name=tool_name,
                    success=True,
                    result={"case_id": case_id, "timeline": timeline},
                    explanation=f"Case timeline contains {len(timeline)} recorded lifecycle events."
                )

            elif tool_name == "get_decision_evidence":
                case_id = arguments.get("case_id")
                line_item_id = arguments.get("line_item_id")
                decision = db.query(CoverageDecision).filter(
                    CoverageDecision.case_id == case_id,
                    CoverageDecision.line_item_id == line_item_id
                ).first()
                if not decision:
                    return MCPToolCallResponse(tool_name=tool_name, success=False, result=None, explanation="Decision evidence not found.")

                calc_stages = [
                    {"stage": c.stage_name, "input": c.input_amount, "adjustment": c.adjustment_amount, "output": c.output_amount, "formula": c.formula}
                    for c in (decision.calculation_items or [])
                ]
                return MCPToolCallResponse(
                    tool_name=tool_name,
                    success=True,
                    result={
                        "rule_id": decision.rule_id,
                        "policy_field": decision.policy_field,
                        "status": decision.decision_status,
                        "covered_amount": decision.covered_amount,
                        "patient_payable": decision.patient_payable,
                        "confidence": decision.confidence,
                        "stages": calc_stages
                    },
                    explanation=decision.explanation
                )

            elif tool_name == "query_trace_dataset":
                dataset = db.query(TraceDataset).first()
                version = db.query(DatasetVersion).first()
                enc_count = db.query(TraceEncounter).count()
                return MCPToolCallResponse(
                    tool_name=tool_name,
                    success=True,
                    result={
                        "dataset_title": dataset.title if dataset else "Trace Commons Core",
                        "active_version": version.version_tag if version else "trace-core-1.3.0",
                        "governance": "COMMUNITY_OPEN_ACCESS",
                        "total_encounters": enc_count,
                        "privacy_gate": "Multi-layer (Presidio, Age-banding, k-suppression >= 5)"
                    },
                    explanation=f"Trace Commons contains {enc_count} governed longitudinal encounters."
                )

            else:
                return MCPToolCallResponse(tool_name=tool_name, success=False, result=None, explanation=f"Unknown tool '{tool_name}'.")

        except Exception as e:
            return MCPToolCallResponse(tool_name=tool_name, success=False, result=None, explanation=f"Error executing tool: {str(e)}")
