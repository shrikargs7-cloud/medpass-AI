import {
  CaseDetail, ClaimItem, TraceOverview, CohortFilter,
  CohortPreview, ExportJob, MCPTool
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

async function handleResponse<T>(res: Response, defaultErrMsg: string): Promise<T> {
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errorMsg = data?.detail || data?.message || `${defaultErrMsg} (HTTP ${res.status})`;
    throw new Error(typeof errorMsg === 'string' ? errorMsg : defaultErrMsg);
  }

  if (data === null) {
    throw new Error(`${defaultErrMsg}: Server returned empty or non-JSON response (HTTP ${res.status})`);
  }

  return data as T;
}

export async function fetchCases(status?: string, band?: string): Promise<CaseDetail[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (band) params.append('band', band);
  const res = await fetch(`${API_BASE}/cases?${params.toString()}`);
  return handleResponse<CaseDetail[]>(res, 'Failed to fetch cases');
}

export async function fetchCaseDetail(caseId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`);
  return handleResponse<CaseDetail>(res, 'Failed to fetch case detail');
}

export async function createCase(payload: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<CaseDetail>(res, 'Failed to create case');
}

export async function updateCase(caseId: string, payload: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<CaseDetail>(res, 'Failed to update case');
}

export async function deleteCase(caseId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${caseId}`, { method: 'DELETE' });
  return handleResponse<any>(res, 'Failed to delete case');
}

export async function addLineItem(caseId: string, item: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/line-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  return handleResponse<CaseDetail>(res, 'Failed to add line item');
}

export async function updateLineItem(caseId: string, itemId: string, item: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/line-items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  return handleResponse<CaseDetail>(res, 'Failed to update line item');
}

export async function deleteLineItem(caseId: string, itemId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/line-items/${itemId}`, { method: 'DELETE' });
  return handleResponse<CaseDetail>(res, 'Failed to delete line item');
}

export async function addBlocker(caseId: string, blocker: any): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/blockers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(blocker)
  });
  return handleResponse<CaseDetail>(res, 'Failed to add blocker');
}

export async function deleteBlocker(caseId: string, blockerId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/blockers/${blockerId}`, { method: 'DELETE' });
  return handleResponse<CaseDetail>(res, 'Failed to delete blocker');
}

export async function fetchAvailablePolicies(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/cases/aux/policies`);
  return handleResponse<any[]>(res, 'Failed to fetch policies');
}

export async function createPolicy(payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/aux/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<any>(res, 'Failed to create policy');
}

export async function deletePolicy(policyId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/aux/policies/${policyId}`, { method: 'DELETE' });
  return handleResponse<any>(res, 'Failed to delete policy');
}

export async function fetchAvailableHospitals(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/cases/aux/hospitals`);
  return handleResponse<any[]>(res, 'Failed to fetch hospitals');
}

export async function evaluateCase(caseId: string): Promise<CaseDetail> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/evaluate`, { method: 'POST' });
  return handleResponse<CaseDetail>(res, 'Failed to evaluate case');
}

export async function submitCasePreauth(caseId: string, scenario: string = 'SUCCESS'): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/submit?scenario=${scenario}`, { method: 'POST' });
  return handleResponse<any>(res, 'Failed to submit preauthorization');
}

export async function resolveBlocker(caseId: string, blockerId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/cases/${caseId}/resolve-blocker/${blockerId}`, { method: 'POST' });
  return handleResponse<any>(res, 'Failed to resolve blocker');
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
  return handleResponse<any>(res, 'Failed to upload document');
}

export async function fetchClaims(): Promise<ClaimItem[]> {
  const res = await fetch(`${API_BASE}/claims`);
  return handleResponse<ClaimItem[]>(res, 'Failed to fetch claims');
}

export async function raiseClaimQuery(claimId: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'CLINICAL_JUSTIFICATION', reason })
  });
  return handleResponse<any>(res, 'Failed to raise query');
}

export async function approveClaim(claimId: string, approvedAmount?: number): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_amount: approvedAmount })
  });
  return handleResponse<any>(res, 'Failed to approve claim');
}

export async function rejectClaim(claimId: string, reason: string): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision_reason: reason })
  });
  return handleResponse<any>(res, 'Failed to reject claim');
}

export async function acknowledgeClaim(claimId: string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/claims/${claimId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return handleResponse<any>(res, 'Failed to issue acknowledgement');
}

export async function fetchTraceOverview(): Promise<TraceOverview> {
  const res = await fetch(`${API_BASE}/trace/overview`);
  return handleResponse<TraceOverview>(res, 'Failed to fetch trace overview');
}

export async function previewCohort(filters: CohortFilter): Promise<CohortPreview> {
  const res = await fetch(`${API_BASE}/trace/cohorts/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  });
  return handleResponse<CohortPreview>(res, 'Failed to preview cohort');
}

export async function createExportJob(filters: CohortFilter): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/trace/exports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_version: filters.dataset_version, filters })
  });
  return handleResponse<ExportJob>(res, 'Failed to create export job');
}

export async function fetchExports(): Promise<ExportJob[]> {
  const res = await fetch(`${API_BASE}/trace/exports`);
  return handleResponse<ExportJob[]>(res, 'Failed to fetch exports');
}

export async function fetchDatasets(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/trace/datasets`);
  return handleResponse<any[]>(res, 'Failed to fetch datasets');
}

export async function fetchMCPTools(): Promise<MCPTool[]> {
  const res = await fetch(`${API_BASE}/mcp/tools`);
  return handleResponse<MCPTool[]>(res, 'Failed to fetch MCP tools');
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
  return handleResponse<any>(res, 'Healthcare Assistant error');
}

export async function sendSmsNotification(to: string, body: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body })
  });
  return handleResponse<any>(res, 'Failed to dispatch SMS');
}

export async function triggerN8NWebhook(eventType: string = 'CASE_STATUS_CHANGED'): Promise<any> {
  const res = await fetch(`${API_BASE}/integrations/n8n/trigger-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: eventType })
  });
  return handleResponse<any>(res, 'Failed to trigger n8n');
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

export async function sendSmsApi(to: string, body: string): Promise<{ status: string; sid?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to send SMS' }));
    throw new Error(err.detail || 'Failed to send SMS');
  }
  return res.json();
}

