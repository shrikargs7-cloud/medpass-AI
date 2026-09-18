export interface Patient {
  id: string;
  patient_ref: string;
  full_name: string;
  age_band: string;
  sex_at_birth: string;
  broad_region: string;
}

export interface LineItem {
  id: string;
  category: string;
  code: string;
  code_system: string;
  description: string;
  quantity: number;
  unit_amount: number;
  gross_amount: number;
}

export interface CalculationStage {
  stage: number;
  stage_name: string;
  input_amount: number;
  adjustment_amount: number;
  output_amount: number;
  formula?: string;
}

export interface CoverageDecision {
  id: string;
  line_item_id: string;
  decision_status: 'COVERED' | 'PARTIALLY_COVERED' | 'EXCLUDED' | 'PENDING_REVIEW';
  eligible_amount: number;
  covered_amount: number;
  patient_payable: number;
  confidence: number;
  rule_id?: string;
  policy_field?: string;
  requires_human_review: boolean;
  explanation?: string;
  calculation_items: CalculationStage[];
}

export interface DischargeBlocker {
  id: string;
  blocker_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  owner_role: string;
  description: string;
  action_required?: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface CaseDetail {
  id: string;
  case_number: string;
  case_status: string;
  authorization_status: string;
  discharge_status: string;
  readiness_score: number;
  readiness_band: 'SUBMISSION_READY' | 'REVIEW_REQUIRED' | 'BLOCKED';
  primary_diagnosis_code?: string;
  primary_diagnosis_name?: string;
  admission_at: string;
  discharge_at?: string;
  patient: Patient;
  hospital?: {
    id: string;
    name: string;
    hospital_ref: string;
  };
  line_items: LineItem[];
  decisions: CoverageDecision[];
  blockers: DischargeBlocker[];
  total_gross: number;
  total_covered: number;
  total_patient_payable: number;
  policy_id?: string;
  policy?: {
    id: string;
    policy_ref: string;
    plan_name: string;
    plan_type: string;
    network_type: string;
    sum_insured: number;
    deductible: number;
    co_pay_pct: number;
    room_rent_cap: number;
    icu_rent_cap: number;
    insurer_id?: string;
  };
  created_at: string;
}

export interface ClaimItem {
  id: string;
  case_id: string;
  case_number: string;
  hospital_name: string;
  patient_name: string;
  external_reference?: string;
  ack_token?: string;
  status: string;
  total_claimed: number;
  covered_amount: number;
  patient_payable?: number;
  submitted_at: string;
  queries_count: number;
}

export interface TraceOverview {
  kpis: {
    total_encounters: number;
    total_subjects: number;
    total_facilities: number;
    total_events: number;
    completeness_score: number;
    active_dataset_version: string;
    privacy_gate_blocks: number;
  };
  facility_contribution: { tier: string; count: number }[];
  events_by_month: { month: string; encounters: number }[];
  domain_distribution: { domain: string; count: number }[];
}

export interface CohortFilter {
  dataset_version: string;
  date_from?: string;
  date_to?: string;
  facility_keys?: string[];
  facility_tiers?: string[];
  diagnosis_codes?: string[];
  procedure_categories?: string[];
  age_bands?: string[];
  journey_mode: 'whole_journey' | 'event_window';
  format: 'parquet' | 'csv' | 'fhir' | 'omop' | 'all';
}

export interface CohortPreview {
  dataset_version: string;
  total_encounters: number;
  total_events: number;
  facility_count: number;
  journey_mode: string;
  privacy_status: string;
  quality_status: string;
  suppressed_cells: number;
  sample_distribution: Record<string, number>;
}

export interface ExportJob {
  export_id: string;
  status: string;
  dataset_version: string;
  journey_mode: string;
  encounter_count: number;
  event_count: number;
  suppressed_cells: number;
  download_url?: string;
  checksum_sha256?: string;
  created_at: string;
  completed_at?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}
