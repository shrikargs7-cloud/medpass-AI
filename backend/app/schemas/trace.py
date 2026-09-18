from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date, datetime

class CohortFilter(BaseModel):
    dataset_version: str = "trace-core-1.3.0"
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    facility_keys: Optional[List[str]] = None
    facility_tiers: Optional[List[str]] = None
    diagnosis_codes: Optional[List[str]] = None
    procedure_categories: Optional[List[str]] = None
    age_bands: Optional[List[str]] = None
    sex_categories: Optional[List[str]] = None
    journey_mode: str = "whole_journey" # whole_journey or event_window
    resource_scope: List[str] = [
        "encounters", "conditions", "procedures", "medications",
        "insurance_events", "workflow_events", "outcomes"
    ]
    format: str = "parquet" # parquet, csv, fhir, omop, all

class CohortPreviewResponse(BaseModel):
    dataset_version: str
    total_encounters: int
    total_events: int
    facility_count: int
    date_range_start: Optional[date]
    date_range_end: Optional[date]
    journey_mode: str
    privacy_status: str # PASS, QUARANTINE, BLOCKED
    quality_status: str # PASS, WARNING
    suppressed_cells: int
    sample_distribution: Dict[str, Any] = {}

class ExportJobCreate(BaseModel):
    dataset_version: str = "trace-core-1.3.0"
    filters: CohortFilter
    requested_by: Optional[str] = "ANONYMOUS_RESEARCHER"

class ExportJobResponse(BaseModel):
    export_id: str
    status: str # QUEUED, PROCESSING, COMPLETED, FAILED
    dataset_version: str
    journey_mode: str
    encounter_count: int
    event_count: int
    suppressed_cells: int
    download_url: Optional[str] = None
    checksum_sha256: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

class DatasetVersionResponse(BaseModel):
    version_tag: str
    status: str
    period_start: date
    period_end: date
    encounter_count: int
    event_count: int
    facility_count: int
    completeness_score: float
    privacy_status: str
    published_at: datetime

    class Config:
        from_attributes = True

class DatasetCardResponse(BaseModel):
    id: str
    dataset_key: str
    title: str
    description: str
    governance_model: str
    active_version: str
    versions: List[DatasetVersionResponse] = []

    class Config:
        from_attributes = True
