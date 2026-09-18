import {
  CaseDetail, ClaimItem, TraceOverview, CohortFilter,
  CohortPreview, ExportJob, MCPTool
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export async function fetchCases(status?: string, band?: string): Promise<CaseDetail[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (band) params.append('band', band);
  const res = await fetch(`${API_BASE}/cases?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch cases');
  return res.json();
}

export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`);
  if (!res.ok) throw new Error('Failed to fetch case detail');
  return res.json();
}

export async function createCase(payload: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to create case');
  return res.json();
}

export async function updateCase(caseId: string, payload: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to update case');
  return res.json();
}

export async function deleteCase(caseId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete case');
  return res.json();
}

export async function addLineItem(caseId: string, item: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/line-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error('Failed to add line item');
  return res.json();
}

export async function updateLineItem(caseId: string, itemId: string, item: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/line-items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!res.ok) throw new Error('Failed to update line item');
  return res.json();
}

export async function deleteLineItem(caseId: string, itemId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/line-items/${itemId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete line item');
  return res.json();
}

export async function addBlocker(caseId: string, blocker: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/blockers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(blocker)
  });
  if (!res.ok) throw new Error('Failed to add blocker');
  return res.json();
}

export async function deleteBlocker(caseId: string, blockerId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/blockers/${blockerId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete blocker');
  return res.json();
}

export async function fetchAvailablePolicies(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/cases/aux/policies`);
  if (!res.ok) throw new Error('Failed to fetch policies');
  return res.json();
}

export async function createPolicy(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/aux/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create policy');
  }
  return res.json();
}

export async function deletePolicy(policyId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/aux/policies/${policyId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete policy');
  return res.json();
}

export async function fetchAvailableHospitals(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/cases/aux/hospitals`);
  if (!res.ok) throw new Error('Failed to fetch hospitals');
  return res.json();
}

export async function evaluateCase(caseId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/evaluate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to evaluate case');
  return res.json();
}

export async function submitCasePreauth(caseId: string, scenario: string = 'SUCCESS'): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/submit?scenario=${scenario}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to submit preauthorization');
  return res.json();
}

export async function resolveBlocker(caseId: string, blockerId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/resolve-blocker/${blockerId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to resolve blocker');
  return res.json();
}

export async function uploadDocument(caseId: string, docType: string, textContent?: string, file?: File): Promise<any> {
  const formData = new FormData();
  formData.append('doc_type', docType);
  if (file) formData.append('file', file);
  if (textContent) formData.append('raw_text', textContent);

  const res = await fetch(`${API_BASE}/cases/${caseId}/documents`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload document');
  return res.json();
}

export async function fetchClaims(): Promise<ClaimItem[]> {
  const res = await fetch(`${API_BASE}/claims`);
  if (!res.ok) throw new Error('Failed to fetch claims');
  return res.json();
}

export async function raiseClaimQuery(claimId: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'CLINICAL_JUSTIFICATION', reason })
  });
  if (!res.ok) throw new Error('Failed to raise query');
  return res.json();
}

export async function approveClaim(claimId: string, approvedAmount?: number): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_amount: approvedAmount })
  });
  if (!res.ok) throw new Error('Failed to approve claim');
  return res.json();
}

export async function rejectClaim(claimId: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision_reason: reason })
  });
  if (!res.ok) throw new Error('Failed to reject claim');
  return res.json();
}

export async function acknowledgeClaim(claimId: string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to issue acknowledgement');
  return res.json();
}

export async function fetchTraceOverview(): Promise<TraceOverview> {
  const res = await fetch(`${API_BASE}/trace/overview`);
  if (!res.ok) throw new Error('Failed to fetch trace overview');
  return res.json();
}

export async function previewCohort(filters: CohortFilter): Promise<CohortPreview> {
  const res = await fetch(`${API_BASE}/trace/cohorts/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  });
  if (!res.ok) throw new Error('Failed to preview cohort');
  return res.json();
}

export async function createExportJob(filters: CohortFilter): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/trace/exports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_version: filters.dataset_version, filters })
  });
  if (!res.ok) throw new Error('Failed to create export job');
  return res.json();
}

export async function fetchExports(): Promise<ExportJob[]> {
  const res = await fetch(`${API_BASE}/trace/exports`);
  if (!res.ok) throw new Error('Failed to fetch exports');
  return res.json();
}

export async function fetchDatasets(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/trace/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function fetchMCPTools(): Promise<MCPTool[]> {
  const res = await fetch(`${API_BASE}/mcp/tools`);
  if (!res.ok) throw new Error('Failed to fetch MCP tools');
  return res.json();
}

export async function chatMCPAgent(
  prompt: string,
  caseId?: string,
  apiKey?: string,
  provider?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/mcp/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      case_id: caseId,
      api_key: apiKey,
      provider: provider
    })
  });
  if (!res.ok) throw new Error('Healthcare Assistant error');
  return res.json();
}

export async function sendSmsNotification(to: string, body: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to send SMS' }));
    throw new Error(err.detail || 'Failed to dispatch SMS');
  }
  return res.json();
}

export async function triggerN8NWebhook(eventType: string = 'CASE_STATUS_CHANGED'): Promise<any> {
  const res = await fetch(`${API_BASE}/integrations/n8n/trigger-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType })
  });
  if (!res.ok) throw new Error('Failed to trigger n8n');
  return res.json();
}

export async function loginApi(payload: {
  email?: string;
  phone?: string;
  password?: string;
  role?: string;
  firebase_uid?: string;
}): Promise<{
  authenticated: boolean;
  uid: string;
  name: string;
  role: 'admin' | 'hospital' | 'insurer' | 'patient';
  email?: string;
  phone?: string;
  token: string;
  organization?: string;
}> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(err.detail || 'Authentication failed');
  }
  return res.json();
}

export async function fetchAdminOverview(): Promise<{
  kpis: {
    hospitals: number;
    insurers: number;
    cases: number;
    active_cases: number;
    policies: number;
    claims: number;
    pipeline_events: number;
    outbox_processed: number;
    outbox_pending: number;
    privacy_passed: number;
    privacy_blocked: number;
    governed_datasets: number;
    total_encounters: number;
  };
  needs_attention: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    reason: string;
    action: string;
    case_id: string;
  }>;
  system_status: {
    api: string;
    database: string;
    outbox_relay: string;
    privacy_gate: string;
    last_audit_timestamp: string;
  };
}> {
  const res = await fetch(`${API_BASE}/admin/overview`);
  if (!res.ok) throw new Error('Failed to fetch admin overview');
  return res.json();
}

