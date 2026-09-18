from pydantic import BaseModel
from typing import Dict, Any, Optional, List

class MCPToolDefinition(BaseModel):
    name: str
    description: str
    parameters: Dict[str, Any]

class MCPToolCallRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any]

class MCPToolCallResponse(BaseModel):
    tool_name: str
    success: bool
    result: Any
    explanation: Optional[str] = None
    source_rules_checked: Optional[List[str]] = None

class MCPAgentChatRequest(BaseModel):
    prompt: str
    case_id: Optional[str] = None
