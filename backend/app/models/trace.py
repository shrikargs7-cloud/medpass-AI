import uuid
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, DateTime, Date,
    ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from backend.app.db import Base

def gen_uuid():
    return str(uuid.uuid4())

class TraceSubject(Base):
    __tablename__ = "trace_subjects"
    subject_key = Column(String(36), primary_key=True, default=gen_uuid)
    age_band = Column(String(20), nullable=False) # 0-18, 19-30, 31-45, 46-60, 60+
    sex_category = Column(String(20), nullable=False) # MALE, FEMALE, OTHER
    region_bucket = Column(String(100), default="REGION_NORTH")
    created_at = Column(DateTime, default=datetime.utcnow)

class TraceFacility(Base):
    __tablename__ = "trace_facilities"
    facility_key = Column(String(36), primary_key=True, default=gen_uuid)
    facility_tier = Column(String(50), default="TIER_1") # TIER_1, TIER_2, TIER_3
    city_bucket = Column(String(100), default="METRO")
    state_bucket = Column(String(100), default="STATE_NORTH")
    active = Column(Boolean, default=True)

class TraceEncounter(Base):
    __tablename__ = "trace_encounters"
    encounter_key = Column(String(36), primary_key=True, default=gen_uuid)
    subject_key = Column(String(36), ForeignKey("trace_subjects.subject_key"), nullable=False)
    facility_key = Column(String(36), ForeignKey("trace_facilities.facility_key"), nullable=False)
    encounter_type = Column(String(50), default="INPATIENT") # INPATIENT, DAYCARE, EMERGENCY
    start_month = Column(Date, nullable=False) # e.g. 2026-01-01
    end_month = Column(Date, nullable=False) # e.g. 2026-01-01
    los_days = Column(Integer, default=3) # Length of stay
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("TraceSubject")
    facility = relationship("TraceFacility")

class TraceCondition(Base):
    __tablename__ = "trace_conditions"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    encounter_key = Column(String(36), ForeignKey("trace_encounters.encounter_key"), nullable=False)
    concept_system = Column(String(50), default="ICD-10")
    concept_code = Column(String(50), nullable=False) # e.g. I21.9, K35.80, M17.11
    concept_name = Column(String(255), nullable=False)
    is_primary = Column(Boolean, default=True)
    event_month = Column(Date, nullable=False)

class TraceProcedure(Base):
    __tablename__ = "trace_procedures"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    encounter_key = Column(String(36), ForeignKey("trace_encounters.encounter_key"), nullable=False)
    concept_system = Column(String(50), default="CPT")
    concept_code = Column(String(50), nullable=False) # e.g. 47562, 99223, 27447
    concept_name = Column(String(255), nullable=False)
    category = Column(String(100), default="SURGICAL")
    event_month = Column(Date, nullable=False)

class TraceObservation(Base):
    __tablename__ = "trace_observations"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    encounter_key = Column(String(36), ForeignKey("trace_encounters.encounter_key"), nullable=False)
    concept_code = Column(String(50), nullable=False) # LOINC or Safe category
    concept_name = Column(String(255), nullable=False)
    value_bucket = Column(String(50), nullable=False) # NORMAL, ELEVATED, LOW, CRITICAL
    event_month = Column(Date, nullable=False)

class TraceMedication(Base):
    __tablename__ = "trace_medications"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    encounter_key = Column(String(36), ForeignKey("trace_encounters.encounter_key"), nullable=False)
    concept_code = Column(String(50), nullable=False) # RxNorm / Generic
    drug_class = Column(String(100), nullable=False) # ANTIBIOTIC, ANALGESIC, STATIN, etc.
    event_month = Column(Date, nullable=False)

class TraceInsuranceEvent(Base):
    __tablename__ = "trace_insurance_events"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    encounter_key = Column(String(36), ForeignKey("trace_encounters.encounter_key"), nullable=False)
    event_type = Column(String(50), nullable=False) # PREAUTH_REQUEST, PREAUTH_APPROVED, CLAIM_SUBMITTED, CLAIM_QUERIED, CLAIM_SETTLED, CLAIM_REJECTED
    payer_tier = Column(String(50), default="PRIVATE_A")
    plan_category = Column(String(50), default="COMPREHENSIVE")
    amount_bucket = Column(String(50), nullable=False) # <25K, 25K-50K, 50K-100K, 100K-250K, 250K+
    covered_amount_numeric = Column(Float, default=0.0)
    patient_payable_numeric = Column(Float, default=0.0)
    event_month = Column(Date, nullable=False)

class TraceWorkflowEvent(Base):
    __tablename__ = "trace_workflow_events"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    encounter_key = Column(String(36), ForeignKey("trace_encounters.encounter_key"), nullable=False)
    workflow_stage = Column(String(50), nullable=False) # INTAKE, EVALUATION, PREAUTH, BILLING, DISCHARGE
    duration_hours = Column(Float, default=4.0)
    had_blocker = Column(Boolean, default=False)
    blocker_category = Column(String(50), nullable=True)
    event_month = Column(Date, nullable=False)

class TraceOutcome(Base):
    __tablename__ = "trace_outcomes"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    encounter_key = Column(String(36), ForeignKey("trace_encounters.encounter_key"), nullable=False)
    discharge_disposition = Column(String(50), default="ROUTINE_HOME") # ROUTINE_HOME, TRANSFER, RE_ADMISSION_30D
    total_gross_numeric = Column(Float, default=0.0)
    turnaround_hours = Column(Float, default=18.0)
    event_month = Column(Date, nullable=False)

class TraceDataset(Base):
    __tablename__ = "trace_datasets"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    dataset_key = Column(String(100), unique=True, nullable=False) # e.g. trace-core
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    governance_model = Column(String(100), default="COMMUNITY_GOVERNED_ACCESS")
    active_version = Column(String(50), default="1.3.0")
    created_at = Column(DateTime, default=datetime.utcnow)

    versions = relationship("DatasetVersion", backref="dataset", cascade="all, delete-orphan")

class DatasetVersion(Base):
    __tablename__ = "trace_dataset_versions"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    dataset_id = Column(String(36), ForeignKey("trace_datasets.id"), nullable=False)
    version_tag = Column(String(50), nullable=False) # e.g. trace-core-1.3.0
    status = Column(String(50), default="PUBLISHED") # DRAFT, PUBLISHED, ARCHIVED
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    encounter_count = Column(Integer, default=0)
    event_count = Column(Integer, default=0)
    facility_count = Column(Integer, default=3)
    completeness_score = Column(Float, default=0.98)
    privacy_status = Column(String(50), default="PASSED")
    published_at = Column(DateTime, default=datetime.utcnow)

class QualityRun(Base):
    __tablename__ = "trace_quality_runs"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    dataset_version_tag = Column(String(50), nullable=False)
    passed = Column(Boolean, default=True)
    row_count = Column(Integer, default=0)
    completeness = Column(Float, default=0.98)
    duplicate_rate = Column(Float, default=0.001)
    referential_failures = Column(Integer, default=0)
    temporal_failures = Column(Integer, default=0)
    privacy_findings = Column(Integer, default=0)
    quality_report = Column(JSON, default=dict)
    run_at = Column(DateTime, default=datetime.utcnow)

class ExportJob(Base):
    __tablename__ = "trace_export_jobs"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    dataset_version = Column(String(50), nullable=False)
    requested_by = Column(String(100), default="ANONYMOUS_RESEARCHER")
    journey_mode = Column(String(50), default="whole_journey") # event_window, whole_journey
    filters = Column(JSON, default=dict)
    format = Column(String(50), default="parquet") # parquet, csv, fhir, omop, all
    status = Column(String(50), default="QUEUED") # QUEUED, PROCESSING, COMPLETED, FAILED, BLOCKED_PRIVACY
    encounter_count = Column(Integer, default=0)
    event_count = Column(Integer, default=0)
    suppressed_cells = Column(Integer, default=0)
    archive_path = Column(String(255), nullable=True)
    download_url = Column(String(255), nullable=True)
    checksum_sha256 = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class QuarantineItem(Base):
    __tablename__ = "trace_quarantine_items"
    id = Column(String(36), primary_key=True, default=gen_uuid)
    source_event_id = Column(String(100), nullable=False)
    reason = Column(String(255), nullable=False) # PII_DETECTED, TEMPORAL_INVERSION, UNRECOGNIZED_CODE
    raw_payload_preview = Column(Text, nullable=True) # Masked preview
    created_at = Column(DateTime, default=datetime.utcnow)
