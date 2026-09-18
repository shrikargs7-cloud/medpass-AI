from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date

class PatientCreate(BaseModel):
    patient_ref: str
    full_name: str
    dob: Optional[date] = None
    age_band: str = "31-45"
    sex_at_birth: str = "MALE"
    broad_region: str = "REGION_NORTH"
    phone: Optional[str] = None
    email: Optional[str] = None

class PatientResponse(BaseModel):
    id: str
    patient_ref: str
    full_name: str
    age_band: str
    sex_at_birth: str
    broad_region: str

    class Config:
        from_attributes = True

class LineItemCreate(BaseModel):
    category: str # ROOM_RENT, SURGERY, ICU, PHARMACY, INVESTIGATION, CONSULTATION
    code: str
    code_system: str = "CPT"
    description: str
    quantity: float = 1.0
    unit_amount: float
    performed_at: Optional[datetime] = None

class LineItemResponse(BaseModel):
    id: str
    category: str
    code: str
    code_system: str
    description: str
    quantity: float
    unit_amount: float
    gross_amount: float

    class Config:
        from_attributes = True

class CalculationItemResponse(BaseModel):
    stage: int
    stage_name: str
    input_amount: float
    adjustment_amount: float
    output_amount: float
    formula: Optional[str] = None

    class Config:
        from_attributes = True

class CoverageDecisionResponse(BaseModel):
    id: str
    line_item_id: str
    decision_status: str
    eligible_amount: float
    covered_amount: float
    patient_payable: float
    confidence: float
    rule_id: Optional[str] = None
    policy_field: Optional[str] = None
    requires_human_review: bool
    explanation: Optional[str] = None
    calculation_items: List[CalculationItemResponse] = []

    class Config:
        from_attributes = True

class DischargeBlockerResponse(BaseModel):
    id: str
    blocker_type: str
    severity: str
    owner_role: str
    description: str
    action_required: Optional[str] = None
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class CaseCreate(BaseModel):
    hospital_id: str
    policy_id: Optional[str] = None
    patient: PatientCreate
    primary_diagnosis_code: str
    primary_diagnosis_name: str
    admission_at: Optional[datetime] = None
    line_items: List[LineItemCreate] = []

class CaseUpdate(BaseModel):
    hospital_id: Optional[str] = None
    policy_id: Optional[str] = None
    primary_diagnosis_code: Optional[str] = None
    primary_diagnosis_name: Optional[str] = None
    admission_at: Optional[datetime] = None
    discharge_at: Optional[datetime] = None
    case_status: Optional[str] = None
    authorization_status: Optional[str] = None
    discharge_status: Optional[str] = None

class PolicyBriefResponse(BaseModel):
    id: str
    policy_ref: str
    plan_name: str
    plan_type: str
    network_type: str
    sum_insured: float
    deductible: float
    co_pay_pct: float
    room_rent_cap: float
    icu_rent_cap: float

    class Config:
        from_attributes = True

class BlockerCreate(BaseModel):
    blocker_type: str
    severity: str = "HIGH"
    owner_role: str = "HOSPITAL_STAFF"
    description: str
    action_required: Optional[str] = None

class ReadinessScoreBreakdown(BaseModel):
    documents_score: float # 35% weight
    clinical_structure_score: float # 20% weight
    policy_fields_score: float # 15% weight
    coverage_mapping_score: float # 20% weight
    submission_payload_score: float # 10% weight
    total_score: float
    band: str # SUBMISSION_READY, REVIEW_REQUIRED, BLOCKED

class CaseDetailResponse(BaseModel):
    id: str
    case_number: str
    case_status: str
    authorization_status: str
    discharge_status: str
    readiness_score: float
    readiness_band: str
    primary_diagnosis_code: Optional[str] = None
    primary_diagnosis_name: Optional[str] = None
    admission_at: datetime
    discharge_at: Optional[datetime] = None
    patient: PatientResponse
    line_items: List[LineItemResponse] = []
    decisions: List[CoverageDecisionResponse] = []
    blockers: List[DischargeBlockerResponse] = []
    total_gross: float = 0.0
    total_covered: float = 0.0
    total_patient_payable: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True

class ClaimResponseSchema(BaseModel):
    id: str
    case_id: str
    external_reference: Optional[str] = None
    status: str
    total_claimed: float
    covered_amount: float
    patient_payable: float
    submitted_at: datetime
    decided_at: Optional[datetime] = None
    integration_mode: str = "BEECEPTOR_SIMULATION"

    class Config:
        from_attributes = True
