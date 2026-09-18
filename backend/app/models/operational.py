import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, Date,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from backend.app.db import Base

def gen_uuid():
    return str(uuid.uuid4())

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    org_type = Column(String(50), nullable=False) # HOSPITAL, INSURER, REGULATOR
    created_at = Column(DateTime, default=datetime.utcnow)

class Membership(Base):
    __tablename__ = "memberships"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    user_id = Column(String(36), nullable=False)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=False)
    role = Column(String(50), nullable=False) # HOSPITAL_ADMIN, HOSPITAL_STAFF, INSURER_REVIEWER, PATIENT, etc.
    active = Column(Boolean, default=True)

class Hospital(Base):
    __tablename__ = "hospitals"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)
    hospital_ref = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    hospital_tier = Column(String(50), default="TIER_1") # TIER_1, TIER_2, TIER_3
    city_bucket = Column(String(100), default="METRO")
    state_bucket = Column(String(100), default="STATE_NORTH")
    active = Column(Boolean, default=True)

class Insurer(Base):
    __tablename__ = "insurers"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id"), nullable=True)
    insurer_ref = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    active = Column(Boolean, default=True)

class Patient(Base):
    __tablename__ = "patients"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_ref = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False) # Kept in operational DB, masked in Trace
    dob = Column(Date, nullable=True)
    age_band = Column(String(20), nullable=False) # 0-18, 19-30, 31-45, 46-60, 60+
    sex_at_birth = Column(String(20), nullable=False) # MALE, FEMALE, OTHER
    broad_region = Column(String(100), default="REGION_NORTH")
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Policy(Base):
    __tablename__ = "policies"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    insurer_id = Column(String(36), ForeignKey("insurers.id"), nullable=False)
    policy_ref = Column(String(100), unique=True, nullable=False)
    plan_name = Column(String(255), nullable=False)
    plan_type = Column(String(50), default="COMPREHENSIVE")
    network_type = Column(String(50), default="IN_NETWORK") # IN_NETWORK, OUT_OF_NETWORK
    sum_insured = Column(Float, default=500000.0)
    deductible = Column(Float, default=10000.0)
    co_pay_pct = Column(Float, default=10.0) # 10%
    room_rent_cap = Column(Float, default=5000.0) # Per day
    icu_rent_cap = Column(Float, default=10000.0)
    floater = Column(Boolean, default=False)
    custom_fields = Column(JSON, nullable=True, default=list) # [{field_name, description, coverage_val}]
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=False)

    rules = relationship("PolicyRule", back_populates="policy", cascade="all, delete-orphan")

class PolicyRule(Base):
    __tablename__ = "policy_rules"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    policy_id = Column(String(36), ForeignKey("policies.id"), nullable=False)
    rule_code = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False) # EXCLUSION, WAITING_PERIOD, ROOM_LIMIT, SUB_LIMIT, COPAY, DEDUCTIBLE
    priority = Column(Integer, default=50) # 1 highest to 100 lowest
    conditions = Column(JSON, nullable=False, default=dict)
    action = Column(JSON, nullable=False, default=dict)
    source_clause_ref = Column(String(100), nullable=False)
    version = Column(String(20), default="2026.1")
    active = Column(Boolean, default=True)

    policy = relationship("Policy", back_populates="rules")

class Case(Base):
    __tablename__ = "cases"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    hospital_id = Column(String(36), ForeignKey("hospitals.id"), nullable=False)
    policy_id = Column(String(36), ForeignKey("policies.id"), nullable=True)
    case_number = Column(String(100), unique=True, nullable=False)
    case_status = Column(String(50), default="DRAFT") # DRAFT, INTAKE_COMPLETE, READY_FOR_REVIEW, SUBMITTED, QUERIED, APPROVED, REJECTED, DISCHARGE_READY, COMPLETED
    authorization_status = Column(String(50), default="PENDING") # PENDING, PREAUTH_REQUESTED, QUERY_RAISED, APPROVED, REJECTED
    discharge_status = Column(String(50), default="NOT_READY") # NOT_READY, PENDING_CLEARANCE, READY, DISCHARGED
    readiness_score = Column(Float, default=0.0) # 0 to 100
    readiness_band = Column(String(50), default="BLOCKED") # SUBMISSION_READY, REVIEW_REQUIRED, BLOCKED
    primary_diagnosis_code = Column(String(100), nullable=True) # ICD-10
    primary_diagnosis_name = Column(String(255), nullable=True)
    admission_at = Column(DateTime, default=datetime.utcnow)
    discharge_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient = relationship("Patient")
    hospital = relationship("Hospital")
    policy = relationship("Policy")
    line_items = relationship("TreatmentLineItem", back_populates="case", cascade="all, delete-orphan")
    decisions = relationship("CoverageDecision", back_populates="case", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="case", cascade="all, delete-orphan")
    blockers = relationship("DischargeBlocker", back_populates="case", cascade="all, delete-orphan")
    claims = relationship("Claim", back_populates="case", cascade="all, delete-orphan")

class TreatmentLineItem(Base):
    __tablename__ = "treatment_line_items"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    category = Column(String(100), nullable=False) # ROOM_RENT, SURGERY, PHARMACY, INVESTIGATION, ICU, CONSULTATION
    code_system = Column(String(50), default="CPT")
    code = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_amount = Column(Float, nullable=False)
    gross_amount = Column(Float, nullable=False)
    performed_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="line_items")
    decision = relationship("CoverageDecision", back_populates="line_item", uselist=False)

class CoverageDecision(Base):
    __tablename__ = "coverage_decisions"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    line_item_id = Column(String(36), ForeignKey("treatment_line_items.id"), nullable=False)
    decision_status = Column(String(50), nullable=False) # COVERED, PARTIALLY_COVERED, EXCLUDED, PENDING_REVIEW
    eligible_amount = Column(Float, default=0.0)
    covered_amount = Column(Float, default=0.0)
    patient_payable = Column(Float, default=0.0)
    confidence = Column(Float, default=1.0)
    rule_id = Column(String(100), nullable=True)
    policy_field = Column(String(100), nullable=True)
    requires_human_review = Column(Boolean, default=False)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="decisions")
    line_item = relationship("TreatmentLineItem", back_populates="decision")
    calculation_items = relationship("CalculationItem", back_populates="decision", cascade="all, delete-orphan")

class CalculationItem(Base):
    __tablename__ = "calculation_items"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    decision_id = Column(String(36), ForeignKey("coverage_decisions.id"), nullable=False)
    stage = Column(Integer, nullable=False)
    stage_name = Column(String(100), nullable=False) # GROSS, ELIGIBILITY, ROOM_CAP, DEDUCTIBLE, COPAY, FINAL
    input_amount = Column(Float, nullable=False)
    adjustment_amount = Column(Float, nullable=False)
    output_amount = Column(Float, nullable=False)
    formula = Column(Text, nullable=True)

    decision = relationship("CoverageDecision", back_populates="calculation_items")

class Document(Base):
    __tablename__ = "documents"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    doc_type = Column(String(100), nullable=False) # DISCHARGE_SUMMARY, BILL_INVOICE, POLICY_CARD, LAB_REPORT, PRE_AUTH_FORM
    file_name = Column(String(255), nullable=False)
    storage_key = Column(String(255), nullable=False)
    sha256 = Column(String(64), nullable=True)
    mime_type = Column(String(100), default="application/pdf")
    extracted_data = Column(JSON, nullable=True, default=dict)
    confidence = Column(Float, default=0.95)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="documents")

class Claim(Base):
    __tablename__ = "claims"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    external_reference = Column(String(100), nullable=True) # From Beeceptor / Payer
    status = Column(String(50), default="SUBMITTED") # SUBMITTED, QUERIED, APPROVED, REJECTED
    total_claimed = Column(Float, default=0.0)
    covered_amount = Column(Float, default=0.0)
    patient_payable = Column(Float, default=0.0)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    last_external_sync_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="claims")
    queries = relationship("ClaimQuery", back_populates="claim", cascade="all, delete-orphan")

class ClaimQuery(Base):
    __tablename__ = "claim_queries"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    claim_id = Column(String(36), ForeignKey("claims.id"), nullable=False)
    category = Column(String(100), nullable=False) # CLINICAL_JUSTIFICATION, MISSING_REPORT, BILL_ITEMIZATION
    reason = Column(Text, nullable=False)
    status = Column(String(50), default="OPEN") # OPEN, RESPONDED, RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    claim = relationship("Claim", back_populates="queries")

class DischargeBlocker(Base):
    __tablename__ = "discharge_blockers"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    case_id = Column(String(36), ForeignKey("cases.id"), nullable=False)
    blocker_type = Column(String(100), nullable=False) # INSURANCE_AUTHORIZATION, MISSING_DOCUMENT, INSURER_QUERY, BILLING_CLEARANCE, PATIENT_ACTION, CLINICAL_PENDING
    severity = Column(String(50), default="HIGH") # CRITICAL, HIGH, MEDIUM, LOW
    owner_role = Column(String(50), nullable=False) # HOSPITAL_STAFF, INSURER_REVIEWER, PATIENT, BILLING_TEAM
    description = Column(Text, nullable=False)
    action_required = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    case = relationship("Case", back_populates="blockers")
