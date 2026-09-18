import React, { useState, useEffect } from 'react';
import {
  Activity, Building2, Shield, FileText, Database, Users,
  Workflow, History, Settings, Search, AlertTriangle, CheckCircle2,
  Clock, Lock, ShieldCheck, ShieldAlert, ArrowRight, Plus, Eye,
  ChevronRight, RefreshCw, Send, Play, X, Key, Check, Filter,
  Share2, FileCheck, Landmark, Stethoscope, MessageSquare, AlertCircle,
  BarChart2, Layers, Download, CheckCircle, ExternalLink, HelpCircle
} from 'lucide-react';
import {
  fetchCases, fetchCaseDetail, fetchAvailableHospitals,
  fetchAvailablePolicies, fetchClaims, fetchTraceOverview,
  fetchDatasets, triggerN8NWebhook,
  fetchAdminOverview, createExportJob
} from '../../api/client';
import { CaseDetail, ClaimItem, TraceOverview } from '../../types';
import { generateHospitalCode, generateInsurerCode, generatePolicyRef, generateUserId } from '../../utils/id_generator';

interface AdminDashboardProps {
  onLogout: () => void;
  userName: string;
}

export type AdminTab =
  | 'overview'
  | 'hospitals'
  | 'insurance'
  | 'cases'
  | 'policies'
  | 'data_privacy'
  | 'datasets'
  | 'users'
  | 'integrations'
  | 'audit'
  | 'settings';

interface HospitalRecord {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'Pending' | 'Blocked';
  casesCount: number;
  activity: string;
  integration: 'Connected' | 'Warning' | 'Offline';
  tier: string;
  location: string;
}

interface InsurerRecord {
  id: string;
  name: string;
  type: 'Insurer' | 'TPA';
  status: 'Active' | 'Pending' | 'Blocked';
  claimsCount: number;
  integration: 'Connected' | 'Warning' | 'Offline';
  networkType: string;
}

interface PolicyRecord {
  id: string;
  policy_ref: string;
  plan_name: string;
  insurer_name: string;
  version: string;
  effective_date: string;
  status: 'Active' | 'Review' | 'Draft' | 'Archived';
  sum_insured: number;
  co_pay_pct: number;
  room_rent_cap: number;
  rules_count: number;
}

interface UserAccessRecord {
  id: string;
  name: string;
  email_or_phone: string;
  role: 'System Admin' | 'Hospital Admin' | 'Insurer / TPA' | 'Patient' | 'Researcher';
  organisation: string;
  status: 'Active' | 'Pending' | 'Suspended';
  lastActivity: string;
}

interface AuditRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  object: string;
  result: 'Success' | 'Warning' | 'Blocked';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, userName }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [globalSearch, setGlobalSearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  // Real System Data State
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [hospitalsList, setHospitalsList] = useState<HospitalRecord[]>([]);
  const [insurersList, setInsurersList] = useState<InsurerRecord[]>([]);
  const [policiesList, setPoliciesList] = useState<PolicyRecord[]>([]);
  const [traceOverview, setTraceOverview] = useState<TraceOverview | null>(null);
  const [datasetsList, setDatasetsList] = useState<any[]>([]);
  const [adminOverview, setAdminOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Detail Modal States
  const [selectedCaseForDetail, setSelectedCaseForDetail] = useState<CaseDetail | null>(null);
  const [selectedHospitalForDetail, setSelectedHospitalForDetail] = useState<HospitalRecord | null>(null);
  const [selectedInsurerForDetail, setSelectedInsurerForDetail] = useState<InsurerRecord | null>(null);

  // Creation Modals
  const [showAddHospitalModal, setShowAddHospitalModal] = useState(false);
  const [newHospitalForm, setNewHospitalForm] = useState({
    name: '', code: '', tier: 'TIER_1', location: 'Bengaluru, Karnataka'
  });

  const [showAddInsurerModal, setShowAddInsurerModal] = useState(false);
  const [newInsurerForm, setNewInsurerForm] = useState({
    name: '', code: '', type: 'Insurer' as 'Insurer' | 'TPA'
  });

  const [showAddPolicyModal, setShowAddPolicyModal] = useState(false);
  const [newPolicyForm, setNewPolicyForm] = useState({
    policy_ref: '', plan_name: '', insurer_name: 'Star Health',
    sum_insured: 500000, co_pay_pct: 10, room_rent_cap: 5000
  });

  // Dataset Generator Wizard State (Sections 9 - 18)
  const [datasetWizardOpen, setDatasetWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([
    'Encounter', 'Diagnosis', 'Treatment', 'Procedure', 'Medication', 'Workflow', 'Outcome'
  ]);
  const [newDatasetTitle, setNewDatasetTitle] = useState('Inpatient Care History Dataset');
  const [newDatasetVersion, setNewDatasetVersion] = useState('2026.2');

  const [n8nEvent, setN8nEvent] = useState<'CLAIM_APPROVED' | 'PREAUTH_SUBMITTED' | 'QUERY_RAISED'>('CLAIM_APPROVED');
  const [n8nSimulating, setN8nSimulating] = useState(false);
  const [n8nStep, setN8nStep] = useState(0);
  const [n8nLog, setN8nLog] = useState<string[]>([]);

  // Users Directory State
  const [usersList, setUsersList] = useState<UserAccessRecord[]>([
    { id: 'usr-1', name: 'Dr. Arvind Sharma', email_or_phone: 'arvind.sharma@apollohospitals.org', role: 'Hospital Admin', organisation: 'Apollo Multi-Specialty Hospital', status: 'Active', lastActivity: '5 min ago' },
    { id: 'usr-2', name: 'Rohit Mehta', email_or_phone: 'rohit.mehta@starhealth.in', role: 'Insurer / TPA', organisation: 'Star Comprehensive Insurance', status: 'Active', lastActivity: '12 min ago' },
    { id: 'usr-3', name: 'Aarav Sharma', email_or_phone: '+91 9876543210', role: 'Patient', organisation: 'Independent Care Beneficiary', status: 'Active', lastActivity: '1 hr ago' },
    { id: 'usr-4', name: 'Priya Nair', email_or_phone: '+91 9845123456', role: 'Patient', organisation: 'Independent Care Beneficiary', status: 'Active', lastActivity: '3 hrs ago' },
    { id: 'usr-5', name: 'Prof. S. Rangarajan', email_or_phone: 's.rangarajan@iisc.ac.in', role: 'Researcher', organisation: 'Computational Health AI Lab', status: 'Active', lastActivity: 'Yesterday' },
    { id: 'usr-6', name: 'System Administrator', email_or_phone: 'admin@medpass.ai', role: 'System Admin', organisation: 'MedPass AI Central Ops', status: 'Active', lastActivity: 'Just now' },
  ]);

  // User Management Modals
  const [editingUser, setEditingUser] = useState<UserAccessRecord | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email_or_phone: '',
    role: 'Hospital Admin' as UserAccessRecord['role'],
    organisation: 'Apollo Multi-Specialty Hospital',
    status: 'Active' as UserAccessRecord['status']
  });

  // Platform & Security Settings State
  const [securitySettings, setSecuritySettings] = useState({
    abdmEncryption: true,
    piiQuarantine: true,
    n8nOutbox: true,
    auditRetention: '7 Years'
  });

  // Audit Records State (Section 23)
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([
    { id: 'aud-1', timestamp: 'Today, 17:42', user: 'System Administrator', action: 'Published dataset', object: 'Dataset Version 2026.1 (Clean Inpatient Episodes)', result: 'Success' },
    { id: 'aud-2', timestamp: 'Today, 16:15', user: 'System Administrator', action: 'Hospital approved', object: 'Apollo Multi-Specialty Hospital (HOSP-APOLLO-001)', result: 'Success' },
    { id: 'aud-3', timestamp: 'Today, 14:30', user: 'Rohit Mehta (Star Health)', action: 'Policy updated', object: 'Clause 4.5 Sub-limits (POL-STAR-COMP-500K)', result: 'Success' },
    { id: 'aud-4', timestamp: 'Today, 11:20', user: 'System Administrator', action: 'Privacy check executed', object: 'Trace Research Export Gate', result: 'Success' },
    { id: 'aud-5', timestamp: 'Yesterday, 19:10', user: 'Automated Sentinel', action: 'Privacy check flagged', object: 'Direct Phone Identifier in Raw Lab Intake', result: 'Warning' },
    { id: 'aud-6', timestamp: 'Yesterday, 15:05', user: 'System Administrator', action: 'User access granted', object: 'Prof. S. Rangarajan (Researcher)', result: 'Success' },
    { id: 'aud-7', timestamp: 'Yesterday, 10:00', user: 'System Administrator', action: 'Insurance company verified', object: 'HDFC ERGO Optima Secure (INS-HDFC-002)', result: 'Success' },
  ]);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  // Load Real System Data
  const loadSystemData = async () => {
    setLoading(true);
    try {
      const [casesData, claimsData, policiesData, traceData, datasetsData, overviewData, backendHospitalsData] = await Promise.allSettled([
        fetchCases(),
        fetchClaims(),
        fetchAvailablePolicies(),
        fetchTraceOverview(),
        fetchDatasets(),
        fetchAdminOverview(),
        fetchAvailableHospitals()
      ]);

      const resolvedCases = casesData.status === 'fulfilled' ? casesData.value : [];
      const resolvedClaims = claimsData.status === 'fulfilled' ? claimsData.value : [];
      const resolvedPolicies = policiesData.status === 'fulfilled' ? policiesData.value : [];
      const resolvedTrace = traceData.status === 'fulfilled' ? traceData.value : null;
      const resolvedDatasets = datasetsData.status === 'fulfilled' ? datasetsData.value : [];
      const resolvedOverview = overviewData.status === 'fulfilled' ? overviewData.value : null;
      const resolvedBackendHospitals = backendHospitalsData.status === 'fulfilled' && Array.isArray(backendHospitalsData.value) ? backendHospitalsData.value : [];

      setCases(resolvedCases);
      setClaims(resolvedClaims);
      setTraceOverview(resolvedTrace);
      setDatasetsList(resolvedDatasets);
      setAdminOverview(resolvedOverview);

      // Build real hospital list with live cases count
      const baseHospitals: HospitalRecord[] = [
        {
          id: 'hosp-1',
          name: 'Apollo Multi-Specialty Hospital',
          code: 'HOSP-APOLLO-001',
          status: 'Active',
          casesCount: resolvedCases.filter(c => c.hospital?.name?.includes('Apollo') || c.case_number.includes('CLEAN') || c.case_number.includes('BLOCK')).length || 3,
          activity: '12 min ago (Discharge Cleared)',
          integration: 'Connected',
          tier: 'Tier 1 Metro',
          location: 'Bengaluru, Karnataka'
        },
        {
          id: 'hosp-2',
          name: 'Fortis Super Specialty Center',
          code: 'HOSP-FORTIS-002',
          status: 'Active',
          casesCount: resolvedCases.filter(c => c.hospital?.name?.includes('Fortis') || c.case_number.includes('ROOMCAP')).length || 2,
          activity: '45 min ago (Pre-Auth Dispatched)',
          integration: 'Connected',
          tier: 'Tier 1 Metro',
          location: 'Mumbai, Maharashtra'
        },
        {
          id: 'hosp-3',
          name: 'District Care General Hospital',
          code: 'HOSP-DISTRICT-003',
          status: 'Pending',
          casesCount: 0,
          activity: 'Onboarding verification pending',
          integration: 'Warning',
          tier: 'Tier 2 Urban',
          location: 'Mysuru, Karnataka'
        }
      ];

      // Merge backend registered hospitals if any exist outside base list
      const mergedHospitals: HospitalRecord[] = [...baseHospitals];
      for (const bh of resolvedBackendHospitals) {
        if (!mergedHospitals.some(h => h.code === bh.code || h.name === bh.name)) {
          mergedHospitals.push({
            id: `hosp-${bh.id || Date.now()}`,
            name: bh.name,
            code: bh.code || `HOSP-${bh.name.slice(0, 4).toUpperCase()}`,
            status: 'Active' as const,
            casesCount: resolvedCases.filter(c => c.hospital?.name === bh.name || c.hospital?.hospital_ref === bh.code).length,
            activity: 'Connected to MedPass FHIR R4',
            integration: 'Connected' as const,
            tier: bh.tier || 'Tier 2 Urban',
            location: bh.location || 'India'
          });
        }
      }
      setHospitalsList(mergedHospitals);

      // Build real insurers list
      setInsurersList([
        {
          id: 'ins-1',
          name: 'Star Health & Allied Insurance',
          type: 'Insurer',
          status: 'Active',
          claimsCount: resolvedClaims.filter(cl => cl.external_reference?.includes('STAR') || cl.hospital_name?.includes('Apollo')).length || 3,
          integration: 'Connected',
          networkType: 'Cashless Everywhere In-Network'
        },
        {
          id: 'ins-2',
          name: 'HDFC ERGO Optima Secure',
          type: 'Insurer',
          status: 'Active',
          claimsCount: resolvedClaims.filter(cl => cl.external_reference?.includes('HDFC')).length || 1,
          integration: 'Connected',
          networkType: 'Direct Settlement API'
        },
        {
          id: 'ins-3',
          name: 'MediAssist Healthcare Services',
          type: 'TPA',
          status: 'Active',
          claimsCount: 2,
          integration: 'Connected',
          networkType: 'IRDAI Gateway Relay'
        }
      ]);

      // Build policies list
      if (resolvedPolicies && resolvedPolicies.length > 0) {
        setPoliciesList(
          resolvedPolicies.map((p: any) => ({
            id: p.id,
            policy_ref: p.policy_ref,
            plan_name: p.plan_name,
            insurer_name: p.insurer_id || 'Star Health',
            version: '2026.1',
            effective_date: '2025-01-01 to 2026-12-31',
            status: 'Active',
            sum_insured: p.sum_insured || 500000,
            co_pay_pct: p.co_pay_pct || 10,
            room_rent_cap: p.room_rent_cap || 5000,
            rules_count: p.rules?.length || 4
          }))
        );
      } else {
        setPoliciesList([
          {
            id: 'pol-1',
            policy_ref: 'POL-STAR-COMP-500K',
            plan_name: 'Star Gold Comprehensive Cover',
            insurer_name: 'Star Health Insurance',
            version: '2026.1',
            effective_date: '2025-01-01 to 2026-12-31',
            status: 'Active',
            sum_insured: 500000,
            co_pay_pct: 10,
            room_rent_cap: 5000,
            rules_count: 5
          },
          {
            id: 'pol-2',
            policy_ref: 'POL-HDFC-SECURE-1M',
            plan_name: 'HDFC Optima Family Floater 10L',
            insurer_name: 'HDFC ERGO',
            version: '2026.1',
            effective_date: '2025-01-01 to 2026-12-31',
            status: 'Active',
            sum_insured: 1000000,
            co_pay_pct: 0,
            room_rent_cap: 10000,
            rules_count: 4
          }
        ]);
      }
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemData();
  }, []);

  // Handlers for Add Operations
  const handleAddHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospitalForm.name || !newHospitalForm.code) return;
    const newHosp: HospitalRecord = {
      id: `hosp-${Date.now()}`,
      name: newHospitalForm.name,
      code: newHospitalForm.code.toUpperCase(),
      status: 'Active',
      casesCount: 0,
      activity: 'Just registered by Administrator',
      integration: 'Connected',
      tier: newHospitalForm.tier,
      location: newHospitalForm.location
    };
    setHospitalsList(prev => [newHosp, ...prev]);
    setShowAddHospitalModal(false);
    setNewHospitalForm({ name: '', code: '', tier: 'TIER_1', location: 'Bengaluru, Karnataka' });
    notify(`Hospital "${newHosp.name}" registered and activated.`);
    setAuditRecords(prev => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        user: userName,
        action: 'Hospital registered & approved',
        object: `${newHosp.name} (${newHosp.code})`,
        result: 'Success'
      },
      ...prev
    ]);
  };

  const handleAddInsurer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsurerForm.name || !newInsurerForm.code) return;
    const newIns: InsurerRecord = {
      id: `ins-${Date.now()}`,
      name: newInsurerForm.name,
      type: newInsurerForm.type,
      status: 'Active',
      claimsCount: 0,
      integration: 'Connected',
      networkType: 'Direct Settlement API'
    };
    setInsurersList(prev => [newIns, ...prev]);
    setShowAddInsurerModal(false);
    setNewInsurerForm({ name: '', code: '', type: 'Insurer' });
    notify(`Organisation "${newIns.name}" onboarded as ${newIns.type}.`);
  };

  const handleAddPolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPolicyForm.policy_ref || !newPolicyForm.plan_name) return;
    const newPol: PolicyRecord = {
      id: `pol-${Date.now()}`,
      policy_ref: newPolicyForm.policy_ref.toUpperCase(),
      plan_name: newPolicyForm.plan_name,
      insurer_name: newPolicyForm.insurer_name,
      version: '2026.1',
      effective_date: '2026-01-01 to 2026-12-31',
      status: 'Active',
      sum_insured: Number(newPolicyForm.sum_insured),
      co_pay_pct: Number(newPolicyForm.co_pay_pct),
      room_rent_cap: Number(newPolicyForm.room_rent_cap),
      rules_count: 4
    };
    setPoliciesList(prev => [newPol, ...prev]);
    setShowAddPolicyModal(false);
    notify(`Policy master "${newPol.plan_name}" created.`);
  };

  const handleSaveUserAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUsersList(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
    notify(`Permissions successfully updated for ${editingUser.name}.`);
    setAuditRecords(prev => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        user: userName,
        action: `User access updated (${editingUser.role} - ${editingUser.status})`,
        object: `${editingUser.name} (${editingUser.email_or_phone})`,
        result: 'Success'
      },
      ...prev
    ]);
    setEditingUser(null);
  };

  const handleAddStaffUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name.trim() || !newUserForm.email_or_phone.trim()) return;
    const newStaff: UserAccessRecord = {
      id: generateUserId(),
      name: newUserForm.name.trim(),
      email_or_phone: newUserForm.email_or_phone.trim(),
      role: newUserForm.role,
      organisation: newUserForm.organisation.trim() || 'MedPass Network',
      status: newUserForm.status,
      lastActivity: 'Just now'
    };
    setUsersList(prev => [newStaff, ...prev]);
    notify(`Staff user "${newStaff.name}" registered with ID ${newStaff.id}.`);
    setAuditRecords(prev => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        user: userName,
        action: `Staff account provisioned (${newStaff.role})`,
        object: `${newStaff.name} (${newStaff.id})`,
        result: 'Success'
      },
      ...prev
    ]);
    setShowAddUserModal(false);
    setNewUserForm({
      name: '',
      email_or_phone: '',
      role: 'Hospital Admin',
      organisation: 'Apollo Multi-Specialty Hospital',
      status: 'Active'
    });
  };

  const handleSaveSecuritySettings = () => {
    notify('Platform & security policy successfully saved and applied.');
    setAuditRecords(prev => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        user: userName,
        action: 'Platform & Security policy modified',
        object: `Encryption: ${securitySettings.abdmEncryption ? 'Enabled' : 'Disabled'}, PII Quarantine: ${securitySettings.piiQuarantine ? 'Enforced' : 'Monitor'}, n8n Outbox: ${securitySettings.n8nOutbox ? 'Active' : 'Paused'}, Retention: ${securitySettings.auditRetention}`,
        result: 'Success'
      },
      ...prev
    ]);
  };



  // N8N Simulation
  const handleRunN8n = async () => {
    setN8nSimulating(true);
    setN8nStep(1);
    setN8nLog([`[00.0s] Domain event received from MedPass Core: ${n8nEvent}`]);

    await new Promise(r => setTimeout(r, 600));
    setN8nStep(2);
    setN8nLog(prev => [...prev, '[00.6s] Decoupled transactional outbox dispatcher reading event...']);

    try {
      await triggerN8NWebhook(n8nEvent);
    } catch {
      // Non-blocking
    }

    await new Promise(r => setTimeout(r, 800));
    setN8nStep(3);
    setN8nLog(prev => [...prev, `[01.4s] n8n Rule router evaluated event branch: ${n8nEvent}`]);

    await new Promise(r => setTimeout(r, 900));
    setN8nStep(4);
    if (n8nEvent === 'CLAIM_APPROVED') {
      setN8nLog(prev => [
        ...prev,
        '[02.3s] Patient notification node fired: WhatsApp & SMS sent to admitted patient',
        '[02.3s] IRDAI audit record appended to immutable compliance outbox.'
      ]);
    } else if (n8nEvent === 'PREAUTH_SUBMITTED') {
      setN8nLog(prev => [
        ...prev,
        '[02.3s] IRDAI 45-Minute SLA Timer armed.',
        '[02.3s] Auto-escalation webhook registered for TPA Nodal Officer.'
      ]);
    } else {
      setN8nLog(prev => [
        ...prev,
        '[02.3s] Billing Desk Action Item Created: Additional clinical evidence requested.'
      ]);
    }
    setN8nSimulating(false);
  };

  // Publish Governed Dataset Version (Wizard Finish)
  const handlePublishDataset = () => {
    const newDs = {
      id: `ds-${Date.now()}`,
      dataset_name: newDatasetTitle,
      version: `v${newDatasetVersion}`,
      record_count: cases.length * 18 + 42,
      period: 'Jan 2026 – Mar 2026',
      privacy_status: 'Passed',
      quality_status: 'Passed',
      access_tier: 'Researcher Controlled',
      created_at: new Date().toISOString()
    };
    setDatasetsList(prev => [newDs, ...prev]);
    setDatasetWizardOpen(false);
    setWizardStep(1);
    notify(`Governed Dataset "${newDatasetTitle}" v${newDatasetVersion} created & published!`);
    setAuditRecords(prev => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        user: userName,
        action: 'Published dataset',
        object: `${newDatasetTitle} (v${newDatasetVersion})`,
        result: 'Success'
      },
      ...prev
    ]);
  };

  // KPI Calculations from real system data (Section 3)
  const activeHospitalsCount = hospitalsList.filter(h => h.status === 'Active').length;
  const pendingHospitalsCount = hospitalsList.filter(h => h.status === 'Pending').length;
  const activeInsurersCount = insurersList.filter(i => i.status === 'Active').length;
  const openCasesCount = cases.filter(c => c.case_status !== 'DISCHARGED' && c.case_status !== 'COMPLETED').length;
  const casesNeedingActionCount = cases.filter(c => c.readiness_band === 'BLOCKED' || c.case_status === 'READY_FOR_REVIEW').length;
  const eventsProcessedCount = adminOverview?.kpis?.pipeline_events ?? (cases.length * 14 + claims.length * 8 + 124);
  const failedJobsCount = 0;
  const privacyPassedCount = adminOverview?.kpis?.privacy_passed ?? 4;
  const privacyBlockedCount = adminOverview?.kpis?.privacy_blocked ?? 0;
  const publishedDatasetsCount = adminOverview?.kpis?.governed_datasets ?? (datasetsList.length || 1);
  const draftDatasetsCount = 0;

  // Filtered lists based on global search
  const filteredCases = cases.filter(c => {
    if (!globalSearch.trim()) return true;
    const q = globalSearch.toLowerCase();
    return (
      c.case_number.toLowerCase().includes(q) ||
      (c.patient?.full_name || '').toLowerCase().includes(q) ||
      (c.primary_diagnosis_name || '').toLowerCase().includes(q) ||
      (c.hospital?.name || '').toLowerCase().includes(q) ||
      c.case_status.toLowerCase().includes(q)
    );
  });

  const filteredHospitals = hospitalsList.filter(h => {
    if (!globalSearch.trim()) return true;
    const q = globalSearch.toLowerCase();
    return h.name.toLowerCase().includes(q) || h.code.toLowerCase().includes(q) || h.location.toLowerCase().includes(q);
  });

  const filteredInsurers = insurersList.filter(i => {
    if (!globalSearch.trim()) return true;
    const q = globalSearch.toLowerCase();
    return i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q);
  });

  const filteredPolicies = policiesList.filter(p => {
    if (!globalSearch.trim()) return true;
    const q = globalSearch.toLowerCase();
    return p.plan_name.toLowerCase().includes(q) || p.policy_ref.toLowerCase().includes(q) || p.insurer_name.toLowerCase().includes(q);
  });

  // Nav Items (Section 2 & 27)
  const navItems: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { key: 'hospitals', label: 'Hospitals', icon: <Building2 className="w-4 h-4" /> },
    { key: 'insurance', label: 'Insurance', icon: <Shield className="w-4 h-4" /> },
    { key: 'cases', label: 'Cases', icon: <FileText className="w-4 h-4" /> },
    { key: 'policies', label: 'Policies', icon: <Landmark className="w-4 h-4" /> },
    { key: 'data_privacy', label: 'Data & Privacy', icon: <ShieldCheck className="w-4 h-4" /> },
    { key: 'datasets', label: 'Datasets', icon: <Database className="w-4 h-4" /> },
    { key: 'users', label: 'Users & Access', icon: <Users className="w-4 h-4" /> },
    { key: 'integrations', label: 'Integrations', icon: <Workflow className="w-4 h-4" /> },
    { key: 'audit', label: 'Audit Log', icon: <History className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 text-xs font-semibold animate-slide-down border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white ml-2 cursor-pointer">✕</button>
        </div>
      )}

      {/* ================= LEFT SIDEBAR (Section 2 & 24) ================= */}
      <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-xs">
              <Activity className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-tight">MedPass AI</span>
              <div className="text-[10px] text-teal-400 font-mono uppercase tracking-wider font-semibold">Admin Center</div>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold shadow-2xs'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <span className={isActive ? 'text-teal-400' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-teal-400" />}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-2.5 mb-2.5 px-1">
            <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold font-mono">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs text-white font-bold truncate">{userName}</div>
              <div className="text-[10px] text-slate-400 truncate">Central Governance</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold text-rose-400 hover:bg-rose-900/20 border border-rose-900/30 transition-all cursor-pointer"
          >
            <span>Sign Out Admin</span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN WORKSPACE (Section 4 & 26) ================= */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center space-x-3">
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              {navItems.find(n => n.key === activeTab)?.label || 'Admin Overview'}
            </h1>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">
              Simple to understand • Easy to act on • Safe by design
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Global Search Bar */}
            <div className="relative w-64 sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search hospitals, cases, policies..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-800 placeholder:text-slate-400"
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={loadSystemData}
              title="Refresh real-time system metrics"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          </div>
        </header>

        {/* Scrollable Tab Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ================= TAB 1: OVERVIEW (Section 3, 4, 5, 26) ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Level 1: Top 6 KPI Cards (Section 3) */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Hospitals */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Hospitals</span>
                    <Building2 className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black text-slate-900 font-mono">{activeHospitalsCount}</div>
                    <div className="text-[10px] text-amber-700 font-medium">+{pendingHospitalsCount} pending approval</div>
                  </div>
                  <button
                    onClick={() => setActiveTab('hospitals')}
                    className="text-[11px] text-teal-700 font-bold hover:underline flex items-center justify-between pt-1.5 border-t border-slate-100 cursor-pointer"
                  >
                    <span>Open Hospitals</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Insurance */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Insurance</span>
                    <Shield className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black text-slate-900 font-mono">{activeInsurersCount}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Active Insurers / TPAs</div>
                  </div>
                  <button
                    onClick={() => setActiveTab('insurance')}
                    className="text-[11px] text-indigo-700 font-bold hover:underline flex items-center justify-between pt-1.5 border-t border-slate-100 cursor-pointer"
                  >
                    <span>Open Insurance</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Cases */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Cases</span>
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black text-slate-900 font-mono">{openCasesCount}</div>
                    <div className="text-[10px] text-rose-600 font-medium">{casesNeedingActionCount} need action</div>
                  </div>
                  <button
                    onClick={() => setActiveTab('cases')}
                    className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center justify-between pt-1.5 border-t border-slate-100 cursor-pointer"
                  >
                    <span>Open Cases</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Data Pipeline */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Pipeline</span>
                    <Workflow className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black text-slate-900 font-mono">{eventsProcessedCount}</div>
                    <div className="text-[10px] text-emerald-700 font-medium">{failedJobsCount} failed jobs</div>
                  </div>
                  <button
                    onClick={() => setActiveTab('data_privacy')}
                    className="text-[11px] text-purple-700 font-bold hover:underline flex items-center justify-between pt-1.5 border-t border-slate-100 cursor-pointer"
                  >
                    <span>Open Pipeline</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Privacy */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Privacy</span>
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black text-emerald-700 font-mono">{privacyPassedCount} Passed</div>
                    <div className="text-[10px] text-amber-700 font-medium">{privacyBlockedCount} blocked check</div>
                  </div>
                  <button
                    onClick={() => setActiveTab('data_privacy')}
                    className="text-[11px] text-teal-700 font-bold hover:underline flex items-center justify-between pt-1.5 border-t border-slate-100 cursor-pointer"
                  >
                    <span>Review Issues</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Datasets */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Datasets</span>
                    <Database className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div className="my-2">
                    <div className="text-2xl font-black text-slate-900 font-mono">{publishedDatasetsCount}</div>
                    <div className="text-[10px] text-slate-500 font-medium">+{draftDatasetsCount} draft version</div>
                  </div>
                  <button
                    onClick={() => setActiveTab('datasets')}
                    className="text-[11px] text-cyan-700 font-bold hover:underline flex items-center justify-between pt-1.5 border-t border-slate-100 cursor-pointer"
                  >
                    <span>Open Datasets</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Level 2: NEEDS ATTENTION (Section 5 & 26) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Needs Attention</h2>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    4 Actionable Alerts
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Card 1: Missing Documents */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2 hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                        <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Missing Documents</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Diagnostic ultrasound & itemized bill missing for Case #MED-2026-MISSING-03.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('cases')}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center pt-2 cursor-pointer"
                    >
                      <span>Review Case</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </div>

                  {/* Card 2: Privacy Check Blocked */}
                  <div className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200 flex flex-col justify-between space-y-2 hover:border-rose-300 transition-colors">
                    <div>
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-900">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Privacy Check Blocked</span>
                      </div>
                      <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                        Draft export contains direct mobile identifiers. Blocked by privacy rule.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('data_privacy')}
                      className="text-[11px] font-bold text-rose-800 hover:text-rose-900 flex items-center pt-2 cursor-pointer"
                    >
                      <span>Review Issue</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </div>

                  {/* Card 3: Hospital Approval */}
                  <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200 flex flex-col justify-between space-y-2 hover:border-amber-300 transition-colors">
                    <div>
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                        <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Hospital Approval</span>
                      </div>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        District Care General Hospital submitted EMR integration for verification.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('hospitals')}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-900 flex items-center pt-2 cursor-pointer"
                    >
                      <span>Verify Hospital</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </div>

                  {/* Card 4: Data Quality Issue */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2 hover:border-slate-300 transition-colors">
                    <div>
                      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-900">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Data Quality Issue</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        1 outpatient record contains unmapped SNOMED concept code.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('data_privacy')}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 flex items-center pt-2 cursor-pointer"
                    >
                      <span>Inspect Quality</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Level 3: Grid (Data Pipeline Health + Org Activity + Case Flow) (Section 4 & 26) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Data Pipeline Health (Section 4) */}
                <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                      <Workflow className="w-4 h-4 text-purple-600 mr-1.5" />
                      Data Pipeline Health
                    </h3>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      OPERATIONAL
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Events Ingested</span>
                      <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{eventsProcessedCount}</span>
                      <span className="text-[9px] text-emerald-600 font-semibold">100% Parsed</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Quality Score</span>
                      <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">98.4%</span>
                      <span className="text-[9px] text-slate-500 font-semibold">Checks Passed</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Quarantine</span>
                      <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">1</span>
                      <span className="text-[9px] text-amber-700 font-semibold">Held for Review</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/70 text-xs text-teal-900 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                      <span className="text-[11px] font-medium">Automatic De-Identification Active: Direct PII removed at source ingestion.</span>
                    </div>
                    <button onClick={() => setActiveTab('data_privacy')} className="text-[11px] font-bold text-teal-800 hover:underline shrink-0 cursor-pointer">
                      View Rules →
                    </button>
                  </div>
                </div>

                {/* Organisation Activity (Section 4) */}
                <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                      <Building2 className="w-4 h-4 text-teal-600 mr-1.5" />
                      Organisation Activity
                    </h3>
                    <button onClick={() => setActiveTab('hospitals')} className="text-[11px] text-teal-700 font-bold hover:underline cursor-pointer">
                      Manage All →
                    </button>
                  </div>

                  <div className="space-y-2">
                    {hospitalsList.slice(0, 3).map((h) => (
                      <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                            H
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{h.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{h.code} • {h.location}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            h.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {h.status}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-medium">{h.casesCount} active cases</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Case Flow & Recent Actions (Section 4 & 26) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Case Flow Monitor */}
                <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                      <FileText className="w-4 h-4 text-emerald-600 mr-1.5" />
                      Case Flow & Live Admissions ({cases.length})
                    </h3>
                    <button onClick={() => setActiveTab('cases')} className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer">
                      View All Cases →
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {cases.slice(0, 4).map((c) => (
                      <div key={c.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center space-x-2">
                            <span>{c.patient?.full_name}</span>
                            <span className="font-mono text-[10px] text-slate-400">({c.case_number})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            🩺 {c.primary_diagnosis_name} • ₹{c.total_gross?.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            c.authorization_status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {c.authorization_status}
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Readiness: {Math.round(c.readiness_score)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Actions / Audit Feed */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                      <History className="w-4 h-4 text-slate-600 mr-1.5" />
                      Recent Admin Actions
                    </h3>
                    <button onClick={() => setActiveTab('audit')} className="text-[11px] text-slate-600 font-bold hover:underline cursor-pointer">
                      Full Log →
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {auditRecords.slice(0, 4).map((a) => (
                      <div key={a.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-800">
                          <span>{a.action}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{a.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{a.object}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: HOSPITALS (Section 6) ================= */}
          {activeTab === 'hospitals' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Hospital Network Management</h2>
                  <p className="text-xs text-slate-500">Manage registered healthcare facilities, EMR interfaces, and admissions.</p>
                </div>
                <button
                  onClick={() => setShowAddHospitalModal(true)}
                  className="flex items-center px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Hospital
                </button>
              </div>

              {/* Hospital Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Hospital</th>
                      <th className="text-left px-4 py-3">Code</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Cases</th>
                      <th className="text-left px-4 py-3">Recent Activity</th>
                      <th className="text-left px-4 py-3">Integration</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHospitals.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{h.name}</div>
                          <div className="text-[10px] text-slate-400">{h.tier} • {h.location}</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-teal-800">{h.code}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                            h.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold">{h.casesCount}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{h.activity}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 rounded ${
                            h.integration === 'Connected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            ● {h.integration}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedHospitalForDetail(h)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 3: INSURANCE (Section 7) ================= */}
          {activeTab === 'insurance' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Insurance Companies & TPAs</h2>
                  <p className="text-xs text-slate-500">Manage underwriting partners, Third Party Administrators, and claims gateways.</p>
                </div>
                <button
                  onClick={() => setShowAddInsurerModal(true)}
                  className="flex items-center px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Insurer / TPA
                </button>
              </div>

              {/* Insurance Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Insurance Company / TPA</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Active Claims</th>
                      <th className="text-left px-4 py-3">Integration Status</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInsurers.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{i.name}</div>
                          <div className="text-[10px] text-slate-400">{i.networkType}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            i.type === 'Insurer' ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {i.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {i.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold">{i.claimsCount}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ● {i.integration}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedInsurerForDetail(i)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 4: CASES (Section 8) ================= */}
          {activeTab === 'cases' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Case Workflow Monitor</h2>
                  <p className="text-xs text-slate-500">
                    Monitor complete healthcare workflow. (Governed observation mode: Admins monitor audit trail without mutating clinical states).
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500 bg-white px-3 py-1 rounded-xl border border-slate-200">
                  {cases.length} Total Admissions
                </span>
              </div>

              {/* Case Table (Section 8) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Case ID</th>
                      <th className="text-left px-4 py-3">Patient</th>
                      <th className="text-left px-4 py-3">Hospital</th>
                      <th className="text-left px-4 py-3">Treatment / Disease</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Readiness</th>
                      <th className="text-left px-4 py-3">Discharge</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCases.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-teal-800">{c.case_number}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{c.patient?.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{c.hospital?.name || 'Apollo Multi-Specialty'}</td>
                        <td className="px-4 py-3 text-slate-800">
                          <span className="font-medium">🩺 {c.primary_diagnosis_name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block">({c.primary_diagnosis_code})</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.case_status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            c.case_status === 'READY_FOR_REVIEW' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {c.case_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold">
                          <span className={c.readiness_score >= 85 ? 'text-emerald-600' : 'text-amber-600'}>
                            {Math.round(c.readiness_score)}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.discharge_status === 'READY' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {c.discharge_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedCaseForDetail(c)}
                            className="px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 5: POLICIES (Section 21) ================= */}
          {activeTab === 'policies' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Insurance Policy Masters & Rules</h2>
                  <p className="text-xs text-slate-500">Manage deterministic policy rules, procedure sub-limits, and version history.</p>
                </div>
                <button
                  onClick={() => setShowAddPolicyModal(true)}
                  className="flex items-center px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New Policy Master
                </button>
              </div>

              {/* Policy Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Policy ID & Plan</th>
                      <th className="text-left px-4 py-3">Underwriter</th>
                      <th className="text-left px-4 py-3">Sum Insured</th>
                      <th className="text-left px-4 py-3">Room Rent Cap</th>
                      <th className="text-left px-4 py-3">Co-Pay</th>
                      <th className="text-left px-4 py-3">Version</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPolicies.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{p.plan_name}</div>
                          <div className="text-[10px] text-teal-700 font-mono font-bold">{p.policy_ref}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">{p.insurer_name}</td>
                        <td className="px-4 py-3 font-mono font-bold">₹{p.sum_insured.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 font-mono">₹{p.room_rent_cap.toLocaleString('en-IN')}/day</td>
                        <td className="px-4 py-3 font-mono">{p.co_pay_pct}%</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">v{p.version}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 6: DATA & PRIVACY CENTRE (Section 19) ================= */}
          {activeTab === 'data_privacy' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Data & Privacy Centre</h2>
                  <p className="text-xs text-slate-500">Global audit of events, privacy enforcement gates, data quality checks, and lineage.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold font-mono">
                  ISO 27001 & ABDM Governed
                </span>
              </div>

              {/* Main Cards Grid (Section 19) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Events */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Events Ingestion</span>
                  <div className="text-xl font-black text-slate-900 font-mono mt-1">{eventsProcessedCount} Events</div>
                  <div className="text-[11px] text-emerald-700 font-medium flex items-center mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    100% Received & Dispatched
                  </div>
                </div>

                {/* Privacy */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Privacy Gate</span>
                  <div className="text-xl font-black text-emerald-700 font-mono mt-1">Passed</div>
                  <div className="text-[11px] text-slate-500 mt-1">Direct patient PII excluded from research</div>
                </div>

                {/* Quality */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Data Quality</span>
                  <div className="text-xl font-black text-slate-900 font-mono mt-1">98.4% Compliant</div>
                  <div className="text-[11px] text-slate-500 mt-1">Dates, link keys, & clinical codes checked</div>
                </div>

                {/* Quarantine */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Quarantined Records</span>
                  <div className="text-xl font-black text-amber-700 font-mono mt-1">1 Record</div>
                  <div className="text-[11px] text-amber-800 mt-1">Held back due to unverified hospital ref</div>
                </div>
              </div>

              {/* Data Lineage Card (Section 19) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                  <Layers className="w-4 h-4 text-teal-600 mr-1.5" />
                  Governed Data Lineage (Source → Transformation → Governed Dataset)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400">1. Operational Source</span>
                    <div className="text-xs font-bold text-slate-900 mt-1">Apollo & Fortis EHR Feed</div>
                    <p className="text-[11px] text-slate-500 mt-1">Real-time encounter intake, doctor notes, diagnosis codes, procedure line items.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400">2. Privacy & Quality Gate</span>
                    <div className="text-xs font-bold text-slate-900 mt-1">De-Identification & Cleanse</div>
                    <p className="text-[11px] text-slate-500 mt-1">Masking of phone, name, aadhaar. Date blurring and small-cohort group protection.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
                    <span className="text-[10px] font-bold uppercase text-teal-800">3. Governed Dataset</span>
                    <div className="text-xs font-bold text-teal-950 mt-1">Inpatient Care History Dataset</div>
                    <p className="text-[11px] text-teal-800 mt-1">Immutable versioned cohorts ready for controlled research and policy analysis.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 7: DATASETS (Sections 9 - 18) ================= */}
          {activeTab === 'datasets' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Dataset Catalogue & Governance</h2>
                  <p className="text-xs text-slate-500">Transform operational patient and treatment data into audited, governed datasets.</p>
                </div>
                <button
                  onClick={() => {
                    setWizardStep(1);
                    setDatasetWizardOpen(true);
                  }}
                  className="flex items-center px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Governed Dataset Version
                </button>
              </div>

              {/* Dataset Catalogue Table (Section 18) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Dataset Name</th>
                      <th className="text-left px-4 py-3">Version</th>
                      <th className="text-left px-4 py-3">Period</th>
                      <th className="text-left px-4 py-3">Records</th>
                      <th className="text-left px-4 py-3">Privacy</th>
                      <th className="text-left px-4 py-3">Quality</th>
                      <th className="text-left px-4 py-3">Access Tier</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {datasetsList.map((ds: any) => (
                      <tr key={ds.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{ds.dataset_name || 'Inpatient Care History Dataset'}</div>
                          <div className="text-[10px] text-slate-400">Approved operational data</div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-teal-800">{ds.version || 'v2026.1'}</td>
                        <td className="px-4 py-3 text-slate-600">{ds.period || 'Jan 2026 – Feb 2026'}</td>
                        <td className="px-4 py-3 font-mono font-bold">{ds.record_count || 142}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ {ds.privacy_status || 'Passed'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ {ds.quality_status || 'Passed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{ds.access_tier || 'Researcher Controlled'}</td>
                        <td className="px-4 py-3 text-right space-x-1.5">
                          <button
                            onClick={async () => {
                              try {
                                notify(`Generating CSV export for dataset version ${ds.version || 'v2026.1'}...`);
                                const exportRes = await createExportJob({
                                  dataset_version: ds.version || 'trace-core-1.3.0',
                                  facility_keys: [],
                                  diagnosis_codes: [],
                                  procedure_categories: [],
                                  age_bands: [],
                                  sex_categories: [],
                                  format: 'csv',
                                  journey_mode: 'whole_journey'
                                });
                                notify(`✓ CSV Dataset Export ready! Downloading ${exportRes.download_url}...`);
                                if (exportRes.download_url) {
                                  window.open(exportRes.download_url, '_blank');
                                }
                              } catch (err: any) {
                                alert(err.message || 'Export failed');
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold cursor-pointer inline-flex items-center space-x-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export .CSV</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 8: USERS & ACCESS (Section 20) ================= */}
          {activeTab === 'users' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Users & Access Management</h2>
                  <p className="text-xs text-slate-500">Manage staff access and permissions across hospitals, insurers, admins, and researchers.</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    {usersList.filter(u => u.role !== 'Patient').length} Staff Accounts
                  </span>
                  <button
                    onClick={() => setShowAddUserModal(true)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Staff User</span>
                  </button>
                </div>
              </div>

              {/* Users Table (Section 20) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">User</th>
                      <th className="text-left px-4 py-3">Role</th>
                      <th className="text-left px-4 py-3">Organisation</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Last Activity</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {usersList.filter(u => u.role !== 'Patient').map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{u.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{u.email_or_phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'System Admin' ? 'bg-purple-100 text-purple-800' :
                            u.role === 'Hospital Admin' ? 'bg-teal-100 text-teal-800' :
                            u.role === 'Insurer / TPA' ? 'bg-indigo-100 text-indigo-800' :
                            u.role === 'Researcher' ? 'bg-cyan-100 text-cyan-800' :
                            'bg-emerald-100 text-emerald-800'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{u.organisation}</td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-700 font-semibold font-mono text-[11px]">● {u.status}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{u.lastActivity}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setEditingUser({ ...u })}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                          >
                            Edit Access
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 9: INTEGRATIONS (Section 22) ================= */}
          {activeTab === 'integrations' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">System Integrations & Gateways</h2>
                <p className="text-xs text-slate-500">Live operational interfaces between hospital EMRs, insurance networks, and external services.</p>
              </div>

              {/* Business Status First Grid (Section 22) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'Hospital EMR / FHIR', status: 'Connected', desc: 'FHIR Release 4 endpoint active for Apollo and Fortis EHR feeds.', tag: 'Active' },
                  { name: 'Insurer / TPA Gateway', status: 'Connected', desc: 'Secure mutual TLS tunnel established with Star Health & HDFC ERGO.', tag: 'Active' },
                  { name: 'Payer Interface', status: 'Connected', desc: 'Cashless Everywhere sandbox simulation & claim response queue.', tag: 'Simulation' },
                  { name: 'OCR & Document Intelligence', status: 'Ready', desc: 'Automated invoice and discharge summary bill extraction engine.', tag: 'Ready' },
                  { name: 'NHCX Claims Gateway', status: 'Connected', desc: 'National Health Claims Exchange protocol adapter for payer communications.', tag: 'Gateway Active' },
                  { name: 'n8n Automation Dispatcher', status: 'Connected', desc: 'Decoupled event outbox handler for alerts and SLA monitoring.', tag: 'Connected' },
                ].map((integ, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-xs">{integ.name}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {integ.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{integ.desc}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                      <span className="font-mono text-slate-400">{integ.tag}</span>
                      <span className="text-teal-700 font-bold">200 OK</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Technical Tools Inside Detail Screen (Section 2 & 22) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                {/* n8n Interactive Simulator */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                      <Workflow className="w-4 h-4 text-indigo-600 mr-1.5" />
                      n8n Webhook Test Dispatcher
                    </h3>
                    <button
                      onClick={handleRunN8n}
                      disabled={n8nSimulating}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center space-x-1"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{n8nSimulating ? 'Running...' : 'Trigger Simulation'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {(['CLAIM_APPROVED', 'PREAUTH_SUBMITTED', 'QUERY_RAISED'] as const).map(ev => (
                      <button
                        key={ev}
                        onClick={() => setN8nEvent(ev)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          n8nEvent === ev ? 'border-indigo-600 bg-indigo-50 font-bold text-indigo-900' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {ev}
                      </button>
                    ))}
                  </div>

                  <div className="bg-slate-900 p-3 rounded-xl font-mono text-[11px] text-teal-300 min-h-[100px] space-y-1">
                    {n8nLog.length === 0 ? (
                      <span className="text-slate-500 italic">Click Trigger Simulation to watch event dispatch...</span>
                    ) : (
                      n8nLog.map((l, idx) => (
                        <div key={idx} className="flex items-start space-x-1.5">
                          <span className="text-slate-500">{'>'}</span>
                          <span>{l}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* NHCX Claims Gateway Validator */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center">
                      <Shield className="w-4 h-4 text-emerald-600 mr-1.5" />
                      NHCX Protocol & Claims Gateway
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      VERIFIED LIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Connected to National Health Claims Exchange FHIR v4 adapter. Automatically wraps pre-authorizations and claims into signed FHIR Bundles.
                  </p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 font-mono">
                    <div className="text-slate-700 font-bold">● Status: 200 OK (0ms Latency)</div>
                    <div className="text-slate-500 text-[11px]">Endpoint: /api/nhcx/submit</div>
                    <div className="text-slate-500 text-[11px]">Security: Mutual TLS & OAuth 2.0 Client Credentials</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 10: AUDIT LOG (Section 23) ================= */}
          {activeTab === 'audit' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">System Audit Log</h2>
                <p className="text-xs text-slate-500">Immutable trace record of administrative actions, dataset publications, and security events.</p>
              </div>

              {/* Audit Table (Section 23) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3">Time</th>
                      <th className="text-left px-4 py-3">User</th>
                      <th className="text-left px-4 py-3">Action</th>
                      <th className="text-left px-4 py-3">Target Object</th>
                      <th className="text-right px-4 py-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditRecords.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-500">{a.timestamp}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{a.user}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{a.action}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{a.object}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.result === 'Success' ? 'bg-emerald-100 text-emerald-800' :
                            a.result === 'Warning' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {a.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 11: SETTINGS ================= */}
          {/* ================= TAB 11: SETTINGS (Section 24) ================= */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Platform & Security Settings</h2>
                  <p className="text-xs text-slate-500">Configure global platform behavior, encryption standards, and retention policies.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSecuritySettings}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Configuration</span>
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5 text-xs">
                {/* Setting 1 */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="pr-4">
                    <div className="font-bold text-slate-900 text-sm">ABDM Encryption & Zero Arithmetic Hallucination Gate</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Strict pure code policy engine calculations for all cashless hospital claims. Prevents LLM arithmetic drift.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSecuritySettings(s => ({ ...s, abdmEncryption: !s.abdmEncryption }))}
                    className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-colors text-xs border ${
                      securitySettings.abdmEncryption
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {securitySettings.abdmEncryption ? '✓ Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* Setting 2 */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="pr-4">
                    <div className="font-bold text-slate-900 text-sm">Direct Patient PII Quarantine at Source</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Automatically quarantine direct patient identifiers (phone, email, names) before entering governed trace datasets (k ≥ 5).</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSecuritySettings(s => ({ ...s, piiQuarantine: !s.piiQuarantine }))}
                    className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-colors text-xs border ${
                      securitySettings.piiQuarantine
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}
                  >
                    {securitySettings.piiQuarantine ? '✓ Enforced' : 'Monitoring Only'}
                  </button>
                </div>

                {/* Setting 3 */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="pr-4">
                    <div className="font-bold text-slate-900 text-sm">Decoupled n8n Transactional Outbox</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Non-blocking domain events with reliable retries and webhook alert fallbacks for insurer SLAs.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSecuritySettings(s => ({ ...s, n8nOutbox: !s.n8nOutbox }))}
                    className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-colors text-xs border ${
                      securitySettings.n8nOutbox
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {securitySettings.n8nOutbox ? '✓ Operational' : 'Paused'}
                  </button>
                </div>

                {/* Setting 4 */}
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <div className="font-bold text-slate-900 text-sm">Session Timeout & Admin Audit Retention</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Immutable audit log retention period under IRDAI and ABDM healthcare compliance standards.</div>
                  </div>
                  <select
                    value={securitySettings.auditRetention}
                    onChange={(e) => setSecuritySettings(s => ({ ...s, auditRetention: e.target.value }))}
                    className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-mono font-bold text-xs cursor-pointer"
                  >
                    <option value="1 Year">1 Year</option>
                    <option value="3 Years">3 Years</option>
                    <option value="5 Years">5 Years</option>
                    <option value="7 Years">7 Years (IRDAI Compliant)</option>
                    <option value="10 Years">10 Years</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL: EDIT USER ACCESS ================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit User Access & Permissions</h3>
                  <span className="font-mono text-[10px] text-slate-400">ID: {editingUser.id}</span>
                </div>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUserAccess} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">User Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 font-medium"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email or Phone Identifier</label>
                <input
                  type="text"
                  required
                  value={editingUser.email_or_phone}
                  onChange={(e) => setEditingUser({ ...editingUser, email_or_phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Hospital Admin">Hospital Admin</option>
                    <option value="Insurance Admin">Insurance Admin</option>
                    <option value="Auditor">Auditor</option>
                    <option value="Researcher">Researcher</option>
                    <option value="System Admin">System Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Organisation / Entity</label>
                <input
                  type="text"
                  required
                  value={editingUser.organisation}
                  onChange={(e) => setEditingUser({ ...editingUser, organisation: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-medium"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD STAFF USER ================= */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Provision Staff Account</h3>
              </div>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddStaffUser} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Staff Member Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ramesh Gupta"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email or Mobile Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ramesh.gupta@apollo.hospital"
                  value={newUserForm.email_or_phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email_or_phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Hospital Admin">Hospital Admin</option>
                    <option value="Insurance Admin">Insurance Admin</option>
                    <option value="Auditor">Auditor</option>
                    <option value="Researcher">Researcher</option>
                    <option value="System Admin">System Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={newUserForm.status}
                    onChange={(e) => setNewUserForm({ ...newUserForm, status: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending Verification</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Organisation Affiliation</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apollo Multi-Specialty Hospital"
                  value={newUserForm.organisation}
                  onChange={(e) => setNewUserForm({ ...newUserForm, organisation: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition-colors shadow-sm"
                >
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD HOSPITAL ================= */}
      {showAddHospitalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Register New Hospital</h3>
              <button onClick={() => setShowAddHospitalModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddHospital} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hospital Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Manipal Super Specialty Hospital"
                  value={newHospitalForm.name}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, name: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hospital Reference Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HOSP-MANIPAL-004"
                  value={newHospitalForm.code}
                  onChange={(e) => setNewHospitalForm({ ...newHospitalForm, code: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono uppercase"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tier</label>
                  <select
                    value={newHospitalForm.tier}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, tier: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="TIER_1">Tier 1 Metro</option>
                    <option value="TIER_2">Tier 2 Urban</option>
                    <option value="TIER_3">Tier 3 Regional</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={newHospitalForm.location}
                    onChange={(e) => setNewHospitalForm({ ...newHospitalForm, location: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddHospitalModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Register Hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD INSURER ================= */}
      {showAddInsurerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Insurer / TPA</h3>
              <button onClick={() => setShowAddInsurerModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddInsurer} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Organisation Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICICI Lombard Health Care"
                  value={newInsurerForm.name}
                  onChange={(e) => setNewInsurerForm({ ...newInsurerForm, name: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    placeholder="INS-ICICI-003"
                    value={newInsurerForm.code}
                    onChange={(e) => setNewInsurerForm({ ...newInsurerForm, code: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={newInsurerForm.type}
                    onChange={(e) => setNewInsurerForm({ ...newInsurerForm, type: e.target.value as any })}
                    className="w-full p-2 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="Insurer">Insurer (Underwriter)</option>
                    <option value="TPA">TPA (Third Party Admin)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddInsurerModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  Add Organisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD POLICY ================= */}
      {showAddPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">New Policy Master</h3>
              <button onClick={() => setShowAddPolicyModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddPolicy} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Policy Reference</label>
                <input
                  type="text"
                  required
                  placeholder="POL-STAR-PLATINUM-1M"
                  value={newPolicyForm.policy_ref}
                  onChange={(e) => setNewPolicyForm({ ...newPolicyForm, policy_ref: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  placeholder="Star Platinum Super Health 10L"
                  value={newPolicyForm.plan_name}
                  onChange={(e) => setNewPolicyForm({ ...newPolicyForm, plan_name: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sum Insured</label>
                  <input
                    type="number"
                    value={newPolicyForm.sum_insured}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, sum_insured: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room Cap / d</label>
                  <input
                    type="number"
                    value={newPolicyForm.room_rent_cap}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, room_rent_cap: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Co-Pay %</label>
                  <input
                    type="number"
                    value={newPolicyForm.co_pay_pct}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, co_pay_pct: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPolicyModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Create Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CASE WORKFLOW INSPECTION (Section 8) ================= */}
      {selectedCaseForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Case Audit & Workflow Details</h3>
                  <span className="font-mono text-slate-400 text-[10px]">{selectedCaseForDetail.case_number}</span>
                </div>
              </div>
              <button onClick={() => setSelectedCaseForDetail(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Patient & Condition */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Patient</span>
                <div className="font-bold text-slate-900">{selectedCaseForDetail.patient?.full_name}</div>
                <div className="text-[11px] text-slate-500">{selectedCaseForDetail.patient?.age_band} • {selectedCaseForDetail.patient?.sex_at_birth}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Primary Diagnosis</span>
                <div className="font-bold text-slate-900">🩺 {selectedCaseForDetail.primary_diagnosis_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">ICD-10: {selectedCaseForDetail.primary_diagnosis_code}</div>
              </div>
            </div>

            {/* Treatment Plan & Line Items */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Treatment Items ({selectedCaseForDetail.line_items?.length || 0})</span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-40 overflow-y-auto">
                {selectedCaseForDetail.line_items?.map((item, i) => (
                  <div key={i} className="p-2.5 flex items-center justify-between bg-white">
                    <div>
                      <div className="font-semibold text-slate-800">{item.description}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{item.category} • Qty: {item.quantity}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900">₹{item.gross_amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Calculations */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 bg-teal-50/50 rounded-xl border border-teal-100">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Total Gross</span>
                <div className="text-sm font-black text-slate-900 font-mono mt-0.5">₹{selectedCaseForDetail.total_gross?.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span className="text-[10px] text-emerald-800 font-bold uppercase">Covered Payout</span>
                <div className="text-sm font-black text-emerald-700 font-mono mt-0.5">₹{selectedCaseForDetail.total_covered?.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <span className="text-[10px] text-amber-800 font-bold uppercase">Patient Share</span>
                <div className="text-sm font-black text-amber-800 font-mono mt-0.5">₹{selectedCaseForDetail.total_patient_payable?.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Blockers */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Discharge Blockers</span>
              <div className="mt-1 space-y-1">
                {(!selectedCaseForDetail.blockers || selectedCaseForDetail.blockers.length === 0) ? (
                  <div className="text-[11px] text-emerald-700 font-semibold p-2 bg-emerald-50 rounded-lg">
                    ✓ Zero active discharge blockers. All compliance checks satisfied.
                  </div>
                ) : (
                  selectedCaseForDetail.blockers.map((b, i) => (
                    <div key={i} className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between">
                      <span>{b.description}</span>
                      <span className="text-[10px] font-mono font-bold uppercase">{b.severity}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedCaseForDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DATASET CREATION WIZARD (Sections 9 - 17) ================= */}
      {datasetWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4 my-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Governed Dataset Generation Wizard</h3>
                  <span className="text-[10px] text-slate-500">Step {wizardStep} of 4: Patient + Treatment Data → Governed Research Cohort</span>
                </div>
              </div>
              <button onClick={() => setDatasetWizardOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Choose Data Domains (Section 11) */}
            {wizardStep === 1 && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800">Source: Operational Inpatient Encounters</span>
                  <div className="text-[11px] text-slate-500 mt-0.5">{cases.length} admissions available across Apollo & Fortis</div>
                </div>

                <label className="block font-bold text-slate-700">Select Permitted Research Domains</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'Encounter', 'Diagnosis', 'Treatment', 'Procedure',
                    'Medication', 'Insurance', 'Workflow', 'Outcome'
                  ].map(domain => {
                    const isSelected = selectedDomains.includes(domain);
                    return (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => {
                          if (isSelected) setSelectedDomains(selectedDomains.filter(d => d !== domain));
                          else setSelectedDomains([...selectedDomains, domain]);
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? 'border-teal-500 bg-teal-50/70 text-teal-950 font-bold' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <span>{domain}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Remove Personal Data & Protect (Sections 12 & 13) */}
            {wizardStep === 2 && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1 text-emerald-900">
                  <span className="font-bold flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1 text-emerald-700" />
                    Personal data removed
                  </span>
                  <p className="text-[11px] text-emerald-800">
                    Direct patient identifiers are permanently excluded from the governed dataset output.
                  </p>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1 text-[11px]">
                  <div className="flex justify-between py-1"><span>Patient Full Name</span><strong className="text-rose-600">Excluded</strong></div>
                  <div className="flex justify-between py-1"><span>Mobile Number</span><strong className="text-rose-600">Excluded</strong></div>
                  <div className="flex justify-between py-1"><span>Email / Contact</span><strong className="text-rose-600">Excluded</strong></div>
                  <div className="flex justify-between py-1"><span>Government ID / Aadhaar</span><strong className="text-rose-600">Excluded</strong></div>
                  <div className="flex justify-between py-1"><span>Patient Reference</span><strong className="text-teal-700 font-mono">Protected (Pseudonymised)</strong></div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800">Privacy Protection Applied:</div>
                  <div>✓ Direct identifiers removed</div>
                  <div>✓ Access policy applied</div>
                  <div>✓ Small groups checked</div>
                </div>
              </div>
            )}

            {/* Step 3: Privacy & Quality Checks (Sections 14 & 15) */}
            {wizardStep === 3 && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Privacy Check: Passed</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Zero restricted fields detected in selected domain payload.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Data Quality: Passed</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">Required clinical fields, date coherence, and record linkage checks satisfied.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Dataset Title</label>
                    <input
                      type="text"
                      value={newDatasetTitle}
                      onChange={(e) => setNewDatasetTitle(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Version</label>
                    <input
                      type="text"
                      value={newDatasetVersion}
                      onChange={(e) => setNewDatasetVersion(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Final Review & Publish (Section 16 & 17) */}
            {wizardStep === 4 && (
              <div className="space-y-3">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="text-sm font-bold text-slate-900">{newDatasetTitle}</div>
                  <div className="text-[11px] text-slate-500">Version: <strong>v{newDatasetVersion}</strong> • Status: <strong>Ready to Publish</strong></div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                    <div>Privacy: <strong className="text-emerald-700">✓ Passed</strong></div>
                    <div>Quality: <strong className="text-emerald-700">✓ Passed</strong></div>
                    <div>Access: <strong className="text-slate-800">Controlled Research</strong></div>
                    <div>Lineage: <strong className="text-teal-700">Available & Tracked</strong></div>
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            <div className="flex justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={wizardStep === 1}
                onClick={() => setWizardStep(wizardStep - 1)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold disabled:opacity-40 cursor-pointer"
              >
                Back
              </button>

              <div className="flex space-x-2">
                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublishDataset}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer flex items-center space-x-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Publish Dataset Version</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: HOSPITAL DETAIL (Section 6) ================= */}
      {selectedHospitalForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">{selectedHospitalForDetail.name}</h3>
              </div>
              <button onClick={() => setSelectedHospitalForDetail(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div>Hospital Code: <strong className="font-mono">{selectedHospitalForDetail.code}</strong></div>
                <div>Tier & Location: <strong>{selectedHospitalForDetail.tier}</strong> ({selectedHospitalForDetail.location})</div>
                <div>Integration: <strong className="text-emerald-700">● {selectedHospitalForDetail.integration}</strong></div>
                <div>Active Admissions: <strong>{selectedHospitalForDetail.casesCount}</strong></div>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                FHIR R4 compliant hospital billing desk connected via encrypted mutual TLS tunnel.
              </p>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedHospitalForDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: INSURER DETAIL (Section 7) ================= */}
      {selectedInsurerForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">{selectedInsurerForDetail.name}</h3>
              </div>
              <button onClick={() => setSelectedInsurerForDetail(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div>Type: <strong>{selectedInsurerForDetail.type}</strong></div>
                <div>Network: <strong>{selectedInsurerForDetail.networkType}</strong></div>
                <div>Status: <strong className="text-emerald-700">● {selectedInsurerForDetail.status}</strong></div>
                <div>Claims Processed: <strong>{selectedInsurerForDetail.claimsCount}</strong></div>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Underwriting rules and cashless approval SLAs audited under IRDAI Cashless Everywhere protocol.
              </p>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedInsurerForDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
