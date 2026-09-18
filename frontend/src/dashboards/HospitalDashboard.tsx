import React, { useState, useEffect } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, UploadCloud,
  FileText, ArrowRight, DollarSign, ShieldAlert, Sparkles, Plus,
  Info, ChevronRight, FileCheck, Trash2, Edit3, X, Shield, RefreshCw, BarChart2,
  Award, Landmark, Search, MessageSquare, Send, Stethoscope, FileUp
} from 'lucide-react';
import { CaseDetail, ClaimItem } from '../types';
import {
  fetchCases, fetchCaseDetail, evaluateCase,
  submitCasePreauth, resolveBlocker, uploadDocument, createCase,
  updateCase, deleteCase, addLineItem, updateLineItem, deleteLineItem,
  addBlocker, deleteBlocker, fetchAvailablePolicies, fetchClaims,
  sendSmsNotification
} from '../api/client';
import {
  ReadinessRing,
  FinancialWaterfallChart,
  ClaimFunnelChart,
  BlockerDistributionChart
} from '../components/AnalyticsCharts';

interface TreatmentItem {
  id: string;
  category: string;
  code: string;
  description: string;
  quantity: number;
  unit_amount: number;
}

const TREATMENT_CATEGORIES = [
  { value: 'ROOM_RENT', label: 'Room Rent / Bed Tariff', defaultCode: 'ROOM' },
  { value: 'ICU', label: 'ICU / Critical Care Tariff', defaultCode: 'ICU' },
  { value: 'SURGERY', label: 'Surgery / OT Procedure', defaultCode: 'SURG' },
  { value: 'INVESTIGATION', label: 'Diagnostics / Radiology / Lab', defaultCode: 'DIAG' },
  { value: 'PHARMACY', label: 'Pharmacy / Medications', defaultCode: 'PHARM' },
  { value: 'CONSULTATION', label: 'Specialist / Doctor Consultation', defaultCode: 'CONS' },
];

const DEFAULT_TREATMENT_ITEMS: TreatmentItem[] = [
  {
    id: 'item-1',
    category: 'ROOM_RENT',
    code: 'ROOM-101',
    description: 'Single Private Inpatient Room',
    quantity: 3,
    unit_amount: 5000
  },
  {
    id: 'item-2',
    category: 'INVESTIGATION',
    code: 'DIAG-101',
    description: 'Ultrasound Abdomen & Routine Blood Panel',
    quantity: 1,
    unit_amount: 8500
  },
  {
    id: 'item-3',
    category: 'SURGERY',
    code: 'SURG-201',
    description: 'OT Charges & Surgical Procedure',
    quantity: 1,
    unit_amount: 55000
  },
  {
    id: 'item-4',
    category: 'PHARMACY',
    code: 'PHARM-301',
    description: 'Inpatient Medications & Consumables',
    quantity: 1,
    unit_amount: 9500
  }
];

interface HospitalDashboardProps {
  onSelectCase: (caseId: string) => void;
  selectedCaseId?: string;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  onSelectCase,
  selectedCaseId
}) => {
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState<any[]>([]);
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('BILL_INVOICE');

  // Modals state
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showEditCaseModal, setShowEditCaseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddLineItemModal, setShowAddLineItemModal] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<any | null>(null);
  const [showAddBlockerModal, setShowAddBlockerModal] = useState(false);

  // New Case Form State
  const [newCaseForm, setNewCaseForm] = useState({
    patient_ref: `PAT-${Date.now().toString().slice(-4)}`,
    full_name: '',
    dob: '1988-04-12',
    age_band: '31-45',
    sex_at_birth: 'MALE',
    broad_region: 'REGION_NORTH',
    phone: '+91 98450 12345',
    policy_id: '',
    primary_diagnosis_code: 'K35.80',
    primary_diagnosis_name: 'Acute Appendicitis'
  });

  // Dynamic Treatment & Diagnostic Items for New Admission
  const [treatmentItems, setTreatmentItems] = useState<TreatmentItem[]>(DEFAULT_TREATMENT_ITEMS);

  const handleAddTreatmentItem = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newItem: TreatmentItem = {
      id: `item-${Date.now()}-${randomSuffix}`,
      category: 'INVESTIGATION',
      code: `DIAG-${randomSuffix}`,
      description: '',
      quantity: 1,
      unit_amount: 2500
    };
    setTreatmentItems(prev => [...prev, newItem]);
  };

  const handleRemoveTreatmentItem = (id: string) => {
    if (treatmentItems.length <= 1) {
      alert('At least one treatment or diagnostic item is required.');
      return;
    }
    setTreatmentItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateTreatmentItem = (id: string, field: keyof TreatmentItem, value: any) => {
    setTreatmentItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'category') {
        const catConfig = TREATMENT_CATEGORIES.find(c => c.value === value);
        const prefix = catConfig ? catConfig.defaultCode : 'ITEM';
        updated.code = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
      }
      return updated;
    }));
  };

  // Edit Case Form State
  const [editCaseForm, setEditCaseForm] = useState({
    primary_diagnosis_code: '',
    primary_diagnosis_name: '',
    case_status: '',
    authorization_status: '',
    discharge_status: '',
    policy_id: ''
  });

  // Line Item Form State
  const [lineItemForm, setLineItemForm] = useState({
    category: 'ROOM_RENT',
    code: 'ROOM-101',
    description: 'Private Room Charges',
    quantity: 1,
    unit_amount: 5000
  });

  // Blocker Form State
  const [blockerForm, setBlockerForm] = useState({
    blocker_type: 'CLINICAL_DISCHARGE_SUMMARY',
    severity: 'HIGH',
    owner_role: 'HOSPITAL_STAFF',
    description: 'Physician final discharge summary pending signature.',
    action_required: 'Doctor sign-off on discharge notes.'
  });

  const [documentInput, setDocumentInput] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // SMS Modal State
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('+919845012345');
  const [smsBody, setSmsBody] = useState('Hospital Update: Your pre-authorization has been submitted to your insurer.');
  const [smsSending, setSmsSending] = useState(false);

  const handleSendHospitalSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsSending(true);
    try {
      const res = await sendSmsNotification(smsPhone, smsBody);
      notify(`SMS successfully dispatched to ${smsPhone} (${res.status})`);
      setShowSmsModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch SMS');
    } finally {
      setSmsSending(false);
    }
  };

  const loadData = async (targetCaseId?: string) => {
    try {
      setLoading(true);
      const [data, policies, claimsData] = await Promise.all([
        fetchCases(),
        fetchAvailablePolicies().catch(() => []),
        fetchClaims().catch(() => [])
      ]);
      setCases(data);
      setAvailablePolicies(policies);
      setClaims(claimsData);

      if (policies.length > 0 && !newCaseForm.policy_id) {
        setNewCaseForm((prev) => ({ ...prev, policy_id: policies[0].id }));
      }

      if (data.length > 0) {
        const activeId = targetCaseId || selectedCaseId || data[0].id;
        const found = data.find((c) => c.id === activeId) || data[0];
        const detail = await fetchCaseDetail(found.id);
        setSelectedCase(detail);
        onSelectCase(detail.id);
      } else {
        setSelectedCase(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectCase = async (c: CaseDetail) => {
    try {
      const detail = await fetchCaseDetail(c.id);
      setSelectedCase(detail);
      onSelectCase(detail.id);
    } catch (err) {
      console.error(err);
    }
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleEvaluate = async () => {
    if (!selectedCase) return;
    try {
      setEvaluating(true);
      const updated = await evaluateCase(selectedCase.id);
      setSelectedCase(updated);
      notify('Coverage waterfall and readiness evaluated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleSubmitPreauth = async () => {
    if (!selectedCase) return;
    try {
      setSubmitting(true);
      const res = await submitCasePreauth(selectedCase.id, 'SUCCESS');
      notify(`Payer response: ${res.authorization_status}.`);
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activeHospitalId = cases[0]?.hospital?.id || 'aaf0c56a-847d-4c75-9822-7811df715c07';
      const payload = {
        hospital_id: activeHospitalId,
        policy_id: newCaseForm.policy_id || undefined,
        patient: {
          patient_ref: newCaseForm.patient_ref,
          full_name: newCaseForm.full_name || 'Anonymous Patient',
          dob: newCaseForm.dob,
          age_band: newCaseForm.age_band,
          sex_at_birth: newCaseForm.sex_at_birth,
          broad_region: newCaseForm.broad_region,
          phone: newCaseForm.phone
        },
        primary_diagnosis_code: newCaseForm.primary_diagnosis_code,
        primary_diagnosis_name: newCaseForm.primary_diagnosis_name,
        line_items: treatmentItems.map((item, idx) => ({
          category: item.category,
          code: item.code.trim() || `ITEM-${idx + 1}`,
          code_system: 'CPT',
          description: item.description.trim() || `${item.category} Service`,
          quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          unit_amount: Number(item.unit_amount) >= 0 ? Number(item.unit_amount) : 0
        }))
      };

      const created = await createCase(payload);
      setShowNewCaseModal(false);
      setTreatmentItems(DEFAULT_TREATMENT_ITEMS);
      notify(`Case ${created.case_number} created with ${payload.line_items.length} treatments/diagnostics.`);
      loadData(created.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenEditModal = () => {
    if (!selectedCase) return;
    setEditCaseForm({
      primary_diagnosis_code: selectedCase.primary_diagnosis_code || '',
      primary_diagnosis_name: selectedCase.primary_diagnosis_name || '',
      case_status: selectedCase.case_status,
      authorization_status: selectedCase.authorization_status,
      discharge_status: selectedCase.discharge_status,
      policy_id: (selectedCase as any).policy_id || ''
    });
    setShowEditCaseModal(true);
  };

  const handleSaveEditCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const updated = await updateCase(selectedCase.id, editCaseForm);
      setSelectedCase(updated);
      setShowEditCaseModal(false);
      notify('Case details updated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCase = async () => {
    if (!selectedCase) return;
    try {
      const targetNumber = selectedCase.case_number;
      await deleteCase(selectedCase.id);
      setShowDeleteModal(false);
      notify(`Case ${targetNumber} deleted.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const updated = await addLineItem(selectedCase.id, {
        category: lineItemForm.category,
        code: lineItemForm.code,
        description: lineItemForm.description,
        quantity: Number(lineItemForm.quantity),
        unit_amount: Number(lineItemForm.unit_amount)
      });
      setSelectedCase(updated);
      setShowAddLineItemModal(false);
      notify('Line item added & waterfall recalculated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveEditLineItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !editingLineItem) return;
    try {
      const updated = await updateLineItem(selectedCase.id, editingLineItem.id, {
        category: editingLineItem.category,
        code: editingLineItem.code,
        description: editingLineItem.description,
        quantity: Number(editingLineItem.quantity),
        unit_amount: Number(editingLineItem.unit_amount)
      });
      setSelectedCase(updated);
      setEditingLineItem(null);
      notify('Line item updated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteLineItem = async (itemId: string) => {
    if (!selectedCase) return;
    try {
      const updated = await deleteLineItem(selectedCase.id, itemId);
      setSelectedCase(updated);
      notify('Line item removed.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const updated = await addBlocker(selectedCase.id, blockerForm);
      setSelectedCase(updated);
      setShowAddBlockerModal(false);
      notify('Blocker added.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteBlocker = async (blockerId: string) => {
    if (!selectedCase) return;
    try {
      const updated = await deleteBlocker(selectedCase.id, blockerId);
      setSelectedCase(updated);
      notify('Blocker deleted.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolveBlocker = async (blockerId: string) => {
    if (!selectedCase) return;
    try {
      await resolveBlocker(selectedCase.id, blockerId);
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      notify('Blocker resolved.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUploadDoc = async () => {
    if (!selectedCase) return;
    if (!selectedFile && !documentInput.trim()) {
      alert('Please select a file or enter document notes/text to upload.');
      return;
    }
    try {
      setUploadingDoc(true);
      const text = documentInput.trim() || undefined;
      const file = selectedFile || undefined;
      const res = await uploadDocument(selectedCase.id, uploadDocType, text, file);
      notify(`Document "${file ? file.name : 'Clinical Entry'}" uploaded and processed successfully! Readiness: ${res.new_readiness_score || 95}%.`);
      setDocumentInput('');
      setSelectedFile(null);
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message || 'Failed to upload document');
    } finally {
      setUploadingDoc(false);
    }
  };

  // Filtered Roster Cases
  const filteredCases = cases.filter((c) => {
    if (!rosterSearch.trim()) return true;
    const q = rosterSearch.toLowerCase();
    const name = c.patient?.full_name?.toLowerCase() || '';
    const caseNum = c.case_number?.toLowerCase() || '';
    const diag = c.primary_diagnosis_name?.toLowerCase() || '';
    const diagCode = c.primary_diagnosis_code?.toLowerCase() || '';
    const status = c.case_status?.toLowerCase() || '';
    const phone = (c.patient as any)?.phone?.toLowerCase() || '';
    return name.includes(q) || caseNum.includes(q) || diag.includes(q) || diagCode.includes(q) || status.includes(q) || phone.includes(q);
  });

  // KPIs
  const readyCount = cases.filter((c) => c.readiness_band === 'SUBMISSION_READY').length;
  const reviewCount = cases.filter((c) => c.readiness_band === 'REVIEW_REQUIRED').length;
  const blockedCount = cases.filter((c) => c.readiness_band === 'BLOCKED').length;
  const totalActiveBlockers = cases.reduce(
    (acc, c) => acc + (c.blockers?.filter((b) => !b.is_resolved).length || 0),
    0
  );

  return (
    <div className="space-y-5 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-sm flex items-center justify-between text-xs font-semibold animate-slide-down">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-200 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* KPI Row (Minimal, Visual, Per Spec 29_HOSPITAL_DASHBOARD) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Cases</span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">{cases.length}</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Ready to Submit</span>
          <div className="text-2xl font-black text-emerald-600 font-mono mt-0.5">{readyCount}</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Review Required</span>
          <div className="text-2xl font-black text-amber-600 font-mono mt-0.5">{reviewCount}</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Blocked Cases</span>
          <div className="text-2xl font-black text-rose-600 font-mono mt-0.5">{blockedCount}</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Blockers</span>
          <div className="text-2xl font-black text-slate-800 font-mono mt-0.5">{totalActiveBlockers}</div>
        </div>
      </div>

      {/* Action Strip */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-800">Apollo Multi-Specialty Billing Desk</span>
          <span className="text-slate-300">•</span>
          <span className="text-[11px] text-slate-500 font-mono">Gateway: Connected</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowNewCaseModal(true)}
            className="flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Admission
          </button>

          <button
            onClick={() => loadData(selectedCase?.id)}
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Case List Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span>Roster ({filteredCases.length}{filteredCases.length !== cases.length ? ` of ${cases.length}` : ''})</span>
            </div>

            {/* Search option after the roster */}
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search patient, disease, case ID..."
                className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
              />
              {rosterSearch && (
                <button
                  onClick={() => setRosterSearch('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {filteredCases.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No admissions found matching &ldquo;{rosterSearch}&rdquo;
                </div>
              ) : (
                filteredCases.map((c) => {
                  const isSelected = selectedCase?.id === c.id;
                  let bandColor = 'bg-rose-50 text-rose-700 border-rose-200';
                  if (c.readiness_band === 'SUBMISSION_READY') bandColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  else if (c.readiness_band === 'REVIEW_REQUIRED') bandColor = 'bg-amber-50 text-amber-700 border-amber-200';

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCase(c)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-1 ring-teal-500/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-slate-900">{c.case_number}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bandColor}`}>
                          {Math.round(c.readiness_score)}%
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-800 mt-1 flex items-center justify-between">
                        <span>{c.patient?.full_name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{c.patient?.age_band} yrs</span>
                      </div>

                      {/* Disease Condition Badge */}
                      <div className="mt-1 flex items-center space-x-1 overflow-hidden text-[11px]">
                        <span className="font-semibold text-teal-800 bg-teal-50 border border-teal-200/60 px-1.5 py-0.2 rounded-md truncate max-w-full">
                          🩺 {c.primary_diagnosis_name || 'Diagnosis Pending'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-600 font-medium font-mono">₹{c.total_gross?.toLocaleString('en-IN')}</span>
                        <span className="font-semibold text-teal-700 px-1.5 py-0.2 rounded bg-teal-50 text-[10px]">
                          {c.case_status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Claim Funnel Widget */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center">
              <BarChart2 className="w-3.5 h-3.5 mr-1 text-teal-600" />
              Claim Pipeline Funnel
            </h4>
            <ClaimFunnelChart
              total={cases.length}
              ready={readyCount}
              submitted={cases.filter((c) => c.case_status === 'SUBMITTED' || c.case_status === 'APPROVED').length}
              approved={cases.filter((c) => c.case_status === 'APPROVED').length}
            />
          </div>
        </div>

        {/* Selected Case Workspace */}
        {selectedCase ? (
          <div className="lg:col-span-8 space-y-5">
            {/* Case Header with Readiness Ring & Actions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-900 font-mono">{selectedCase.case_number}</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                      {selectedCase.case_status}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                      Auth: {selectedCase.authorization_status}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    {selectedCase.patient?.full_name} • {selectedCase.patient?.age_band} ({selectedCase.patient?.sex_at_birth})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    {selectedCase.primary_diagnosis_code}: {selectedCase.primary_diagnosis_name}
                  </p>
                </div>

                {/* Visual Readiness Ring Chart */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <ReadinessRing score={selectedCase.readiness_score} size={56} />
                    <div className="text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Readiness</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        selectedCase.readiness_score >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedCase.readiness_score >= 85 ? 'READY' : 'REVIEW'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <button
                      onClick={handleEvaluate}
                      disabled={evaluating}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1 text-teal-400" />
                      {evaluating ? '...' : 'Recalculate'}
                    </button>

                    <button
                      onClick={handleSubmitPreauth}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center"
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />
                      {submitting ? '...' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Administrative Quick Actions */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleOpenEditModal}
                    className="flex items-center px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Edit Info
                  </button>

                  <button
                    onClick={() => setShowAddLineItemModal(true)}
                    className="flex items-center px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    Add Item
                  </button>

                  <button
                    onClick={() => setShowAddBlockerModal(true)}
                    className="flex items-center px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Add Blocker
                  </button>
                </div>

                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  Delete Case
                </button>
              </div>
            </div>

            {/* Patient Clinical Profile & Suggested Treatment */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Patient Clinical Details & Suggested Treatment
                    </h3>
                    <p className="text-[11px] text-slate-500">Admitted condition, prescribed clinical protocol & treatment recommendations</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Active Clinical Pathway
                </span>
              </div>

              {/* Disease & Diagnosed Condition */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Disease / Primary Diagnosis
                  </span>
                  <div className="text-sm font-bold text-slate-900 flex items-center">
                    {selectedCase.primary_diagnosis_name || 'Acute Inpatient Care Condition'}
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="font-mono text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                      ICD-10: {selectedCase.primary_diagnosis_code || 'K35.80'}
                    </span>
                    <span className="text-[11px] text-slate-500">Class: Inpatient Medical Care</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Patient Demographics & Stay
                  </span>
                  <div className="text-sm font-bold text-slate-900">
                    {selectedCase.patient?.full_name} ({selectedCase.patient?.age_band} yrs, {selectedCase.patient?.sex_at_birth})
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span>Mobile: <strong className="text-slate-700">{(selectedCase.patient as any)?.phone || '+91 98450 12345'}</strong></span>
                    <span>Region: <strong className="text-slate-700">{selectedCase.patient?.broad_region || 'Karnataka'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Suggested Treatment & Care Protocol */}
              <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900 flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-1.5 text-teal-700" />
                    Suggested Treatment & Recommended Procedures
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700">
                    {selectedCase.line_items?.length || 0} Clinical Item(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Surgeries / Primary Procedures */}
                  <div className="p-2.5 bg-white rounded-lg border border-teal-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Suggested Procedure / Surgery</span>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                      {selectedCase.line_items?.find(i => i.category === 'SURGERY')?.description || `${selectedCase.primary_diagnosis_name} Surgical Intervention`}
                    </div>
                    <span className="text-[10px] text-teal-700 font-medium">OT & Surgical Team Care</span>
                  </div>

                  {/* Room & Stay */}
                  <div className="p-2.5 bg-white rounded-lg border border-teal-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Prescribed Stay & Room</span>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                      {selectedCase.line_items?.find(i => i.category === 'ROOM_RENT')?.description || 'Single Private AC Room'}
                    </div>
                    <span className="text-[10px] text-slate-500">24/7 Monitoring & Clinical Nursing</span>
                  </div>

                  {/* Pharmacy & Diagnostics */}
                  <div className="p-2.5 bg-white rounded-lg border border-teal-100 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Diagnostics & Medications</span>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                      {selectedCase.line_items?.find(i => i.category === 'INVESTIGATION' || i.category === 'PHARMACY')?.description || 'Diagnostic Pre-Op Panel & IV Antibiotics'}
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium">Standard Clinical Protocol</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mapped Policy Master & Verification Evidence */}
            {(() => {
              const matchingClaim = claims.find((c) => c.case_id === selectedCase.id);
              const activePolicy = (selectedCase as any).policy || availablePolicies.find((p) => p.id === (selectedCase as any).policy_id || p.policy_ref === (selectedCase as any).policy_id) || availablePolicies[0];

              if (!activePolicy) return null;

              return (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Landmark className="w-4 h-4 text-indigo-600" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Mapped Policy Master & Verification Evidence
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold">
                        Policy ID: {activePolicy.policy_ref}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {activePolicy.insurer_id || 'Insurer Master'}
                      </span>
                    </div>
                  </div>

                  {/* Official NHCX Payer Acknowledgement Status */}
                  {matchingClaim?.ack_token ? (
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <Award className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-teal-900 flex items-center space-x-1.5">
                            <span>IRDAI NHCX Official Payer Acknowledgement Confirmed</span>
                            <span className="px-1.5 py-0.2 rounded bg-teal-200/80 text-teal-900 text-[10px] font-bold">
                              {matchingClaim.status}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-teal-700 mt-0.5">
                            Token: <strong>{matchingClaim.ack_token}</strong> • External Ref: {matchingClaim.external_reference || selectedCase.case_number}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-teal-600 font-bold uppercase block">Cashless Cleared</span>
                        <span className="text-sm font-black text-teal-900 font-mono">
                          ₹{matchingClaim.covered_amount?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ) : matchingClaim?.status === 'QUERY_RAISED' ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="font-bold">Insurer Query Raised:</span> Clinical documents or OT justification requested by payer before issuing cashless acknowledgement.
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-200 font-bold text-[10px]">
                        PENDING INFO
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
                      <span className="text-[11px]">
                        Payer Pre-Authorization: {selectedCase.authorization_status === 'APPROVED' ? 'Approved' : 'Pending Submission/Adjudication'}.
                      </span>
                      <button
                        onClick={handleSubmitPreauth}
                        disabled={submitting}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        {submitting ? 'Submitting...' : 'Transmit to Insurer'}
                      </button>
                    </div>
                  )}

                  {/* 4-Parameter Grid Mapped from Policy Master */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium uppercase block">Sum Insured</span>
                      <div className="font-bold text-slate-800 text-sm mt-0.5">₹{activePolicy.sum_insured?.toLocaleString()}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium uppercase block">Room Rent Cap / Day</span>
                      <div className="font-bold text-slate-800 text-sm mt-0.5">₹{activePolicy.room_rent_cap?.toLocaleString()}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium uppercase block">ICU Rent Cap / Day</span>
                      <div className="font-bold text-slate-800 text-sm mt-0.5">₹{(activePolicy.icu_rent_cap || 0).toLocaleString()}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-medium uppercase block">Co-Pay & Deductible</span>
                      <div className="font-bold text-slate-800 text-sm mt-0.5">{activePolicy.co_pay_pct}% co-pay • ₹{activePolicy.deductible || 0}</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Visual Graph: Financial Waterfall Analysis */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Financial Analysis
                </h3>
              </div>
              <FinancialWaterfallChart
                gross={selectedCase.total_gross}
                covered={selectedCase.total_covered}
                payable={selectedCase.total_patient_payable}
              />
            </div>

            {/* Line Items Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Itemized Charges ({selectedCase.line_items?.length || 0})
                </h3>
                <button
                  onClick={() => setShowAddLineItemModal(true)}
                  className="text-xs text-teal-700 font-bold hover:underline cursor-pointer flex items-center"
                >
                  <Plus className="w-3.5 h-3.5 mr-0.5" /> Add
                </button>
              </div>

              <div className="space-y-2">
                {selectedCase.line_items?.map((item) => {
                  const dec = selectedCase.decisions?.find((d) => d.line_item_id === item.id);
                  return (
                    <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{item.description}</span>
                          <span className="bg-slate-200 px-1.5 py-0.2 rounded text-slate-700 font-mono text-[10px]">
                            {item.category}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 font-mono">
                            ₹{item.gross_amount.toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => setEditingLineItem(item)}
                            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLineItem(item.id)}
                            className="p-1 text-rose-400 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {dec && (
                        <div className="mt-2 pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                          <span className="text-emerald-700 font-semibold font-mono">
                            Covered: ₹{dec.covered_amount.toLocaleString('en-IN')}
                          </span>
                          <span className="text-amber-800 font-semibold font-mono">
                            Patient: ₹{dec.patient_payable.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {dec.rule_id || 'RULE_APPLIED'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blockers & Document Intake */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Blockers with Distribution Chart */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500 mr-1" />
                    Blockers ({selectedCase.blockers?.filter((b) => !b.is_resolved).length || 0})
                  </h3>
                  <button
                    onClick={() => setShowAddBlockerModal(true)}
                    className="text-xs text-teal-700 font-bold hover:underline cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {selectedCase.blockers && selectedCase.blockers.length > 0 && (
                  <BlockerDistributionChart blockers={selectedCase.blockers} />
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedCase.blockers?.map((b) => (
                    <div
                      key={b.id}
                      className={`p-2.5 rounded-xl border text-xs ${
                        b.is_resolved
                          ? 'border-emerald-200 bg-emerald-50/40 text-slate-400 line-through'
                          : 'border-rose-200 bg-rose-50/50 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span>{b.blocker_type}</span>
                        <div className="flex items-center space-x-1">
                          {!b.is_resolved && (
                            <button
                              onClick={() => handleResolveBlocker(b.id)}
                              className="text-[10px] bg-white border border-rose-300 text-rose-700 font-bold px-1.5 py-0.2 rounded hover:bg-rose-100 cursor-pointer"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteBlocker(b.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] mt-0.5">{b.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document Upload & Extraction */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                    <UploadCloud className="w-3.5 h-3.5 text-teal-600 mr-1.5" />
                    Upload Document
                  </h3>
                  <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200/60 px-2 py-0.5 rounded-full font-mono">
                    Extraction Engine Active
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Document Type
                    </label>
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="BILL_INVOICE">Medical Bill / Itemized Invoice</option>
                      <option value="DISCHARGE_SUMMARY">Clinical Discharge Summary</option>
                      <option value="LAB_REPORT">Diagnostic / Lab Report</option>
                      <option value="POLICY_CARD">Insurance Policy Card</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Choose File (.pdf, .jpg, .png, .txt)
                    </label>
                    <div className="flex items-center space-x-2">
                      <label className="flex-1 flex items-center justify-center px-3 py-2 border-2 border-dashed border-slate-200 hover:border-teal-500 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-teal-50/30 transition-all text-xs text-slate-600">
                        <FileUp className="w-4 h-4 mr-2 text-teal-600 shrink-0" />
                        <span className="truncate">
                          {selectedFile ? selectedFile.name : 'Select or drop file here'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setSelectedFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Remove selected file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      value={documentInput}
                      onChange={(e) => setDocumentInput(e.target.value)}
                      placeholder="Optional notes or paste raw bill/report text..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono bg-slate-50/40"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Auto-links to case ledger
                  </span>
                  <button
                    onClick={handleUploadDoc}
                    disabled={uploadingDoc || (!selectedFile && !documentInput.trim())}
                    className="flex items-center px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                    {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            Select a case from the roster.
          </div>
        )}
      </div>

      {/* MODAL 1: Create New Admission */}
      {showNewCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 relative my-6 text-slate-900 animate-fade-in max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">New Patient Admission</h3>
                  <p className="text-[11px] text-slate-500">Configure patient demographics, insurance plan & itemized treatments/diagnostics</p>
                </div>
              </div>
              <button onClick={() => setShowNewCaseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="mt-4 space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Patient Name"
                    value={newCaseForm.full_name}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, full_name: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newCaseForm.phone}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, phone: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Diagnosis Code</label>
                  <input
                    type="text"
                    required
                    value={newCaseForm.primary_diagnosis_code}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, primary_diagnosis_code: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Diagnosis Name</label>
                  <input
                    type="text"
                    required
                    value={newCaseForm.primary_diagnosis_name}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, primary_diagnosis_name: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              {/* Policy ID Selector & Live Mapped Parameters */}
              {(() => {
                const selectedNewPolicy = availablePolicies.find((p) => p.id === newCaseForm.policy_id || p.policy_ref === newCaseForm.policy_id) || availablePolicies[0];
                const previewCap = selectedNewPolicy ? selectedNewPolicy.room_rent_cap : 5000;
                const previewIcuCap = selectedNewPolicy ? (selectedNewPolicy.icu_rent_cap || 10000) : 10000;
                const previewCopayPct = selectedNewPolicy ? selectedNewPolicy.co_pay_pct : 10;

                let previewGross = 0;
                let previewTotalExcess = 0;
                let previewAdmissibleBase = 0;
                let hasRoomExcess = false;
                let maxRoomDaily = 0;
                let totalRoomExcess = 0;

                treatmentItems.forEach((item) => {
                  const qty = Number(item.quantity) || 0;
                  const rate = Number(item.unit_amount) || 0;
                  const itemTotal = qty * rate;
                  previewGross += itemTotal;

                  if (item.category === 'ROOM_RENT') {
                    if (rate > previewCap) {
                      hasRoomExcess = true;
                      maxRoomDaily = Math.max(maxRoomDaily, rate);
                      const excessPerUnit = rate - previewCap;
                      const itemExcess = excessPerUnit * qty;
                      totalRoomExcess += itemExcess;
                      previewTotalExcess += itemExcess;
                      previewAdmissibleBase += previewCap * qty;
                    } else {
                      previewAdmissibleBase += itemTotal;
                    }
                  } else if (item.category === 'ICU') {
                    if (rate > previewIcuCap) {
                      const excessPerUnit = rate - previewIcuCap;
                      const itemExcess = excessPerUnit * qty;
                      previewTotalExcess += itemExcess;
                      previewAdmissibleBase += previewIcuCap * qty;
                    } else {
                      previewAdmissibleBase += itemTotal;
                    }
                  } else {
                    previewAdmissibleBase += itemTotal;
                  }
                });

                const previewCopayAmount = previewAdmissibleBase * (previewCopayPct / 100);
                const previewInsurerPayout = Math.max(0, previewAdmissibleBase - previewCopayAmount);
                const previewPatientShare = previewTotalExcess + previewCopayAmount;

                return (
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-semibold text-slate-700">Insurance Policy ID & Plan</label>
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          Auto-Mapped to Master
                        </span>
                      </div>
                      <select
                        value={newCaseForm.policy_id}
                        onChange={(e) => setNewCaseForm({ ...newCaseForm, policy_id: e.target.value })}
                        className="w-full p-2 rounded-xl border border-slate-200 font-mono text-xs bg-slate-50"
                      >
                        {availablePolicies.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.policy_ref}] {p.plan_name} • Cap: ₹{p.room_rent_cap?.toLocaleString()}/d • {p.insurer_id || 'Payer'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mapped Policy Parameters Display */}
                    {selectedNewPolicy && (
                      <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center space-x-1.5">
                            <Landmark className="w-3.5 h-3.5 text-indigo-700" />
                            <span className="font-bold text-indigo-900">{selectedNewPolicy.plan_name}</span>
                          </div>
                          <span className="font-mono font-bold text-indigo-800 bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-[10px]">
                            {selectedNewPolicy.policy_ref}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] bg-white p-2 rounded-lg border border-indigo-100">
                          <div>
                            <span className="text-slate-400 block">Sum Insured</span>
                            <strong className="text-slate-800">₹{selectedNewPolicy.sum_insured?.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Room Cap/Day</span>
                            <strong className="text-slate-800">₹{selectedNewPolicy.room_rent_cap?.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">ICU Cap/Day</span>
                            <strong className="text-slate-800">₹{(selectedNewPolicy.icu_rent_cap || 0).toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Co-Pay</span>
                            <strong className="text-slate-800">{selectedNewPolicy.co_pay_pct}%</strong>
                          </div>
                        </div>

                        {/* Dynamic Rule Enforcement Check */}
                        {hasRoomExcess ? (
                          <div className="p-2 rounded-lg bg-amber-100/90 border border-amber-300 text-[10px] text-amber-950 flex items-start space-x-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Room Rent Cap Breach:</span> Inpatient room daily rate reaches ₹{maxRoomDaily.toLocaleString()} which exceeds policy room cap of ₹{previewCap.toLocaleString()}/d.
                              Total excess of <strong className="text-rose-700 font-bold">₹{totalRoomExcess.toLocaleString()}</strong> will fall to patient out-of-pocket obligation.
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-emerald-100/80 border border-emerald-300 text-[10px] text-emerald-950 flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Room & service tariffs conform to policy thresholds (₹{previewCap.toLocaleString()}/day cap). Admissible for cashless preauth.</span>
                          </div>
                        )}

                        {/* Calculated Waterfall Preview */}
                        <div className="pt-2 border-t border-indigo-100 grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div>
                            <span className="text-slate-500 block">Gross Estimate ({treatmentItems.length} items)</span>
                            <strong className="text-slate-900 text-[11px]">₹{previewGross.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-emerald-700 block">Est. Payer Payout</span>
                            <strong className="text-emerald-700 text-[11px]">₹{previewInsurerPayout.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-amber-700 block">Est. Patient Share</span>
                            <strong className="text-amber-700 text-[11px]">₹{previewPatientShare.toLocaleString()}</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Dynamic N Treatment & Diagnostic Fields */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                      <span>Treatments, Diagnostics & Itemized Services</span>
                      <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-mono font-bold">
                        {treatmentItems.length} {treatmentItems.length === 1 ? 'item' : 'items'}
                      </span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Add any number of procedures, diagnostic tests, room stays, pharmacy items, or consultations
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTreatmentItem}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {treatmentItems.map((item, idx) => {
                    const itemTotal = (Number(item.quantity) || 0) * (Number(item.unit_amount) || 0);
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 bg-slate-50/90 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all space-y-2"
                      >
                        <div className="grid grid-cols-12 gap-2 items-center">
                          {/* Category Selector */}
                          <div className="col-span-12 sm:col-span-4">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              #{idx + 1} Category
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) => handleUpdateTreatmentItem(item.id, 'category', e.target.value)}
                              className="w-full p-1.5 rounded-lg border border-slate-200 bg-white font-medium text-xs text-slate-800"
                            >
                              {TREATMENT_CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Code */}
                          <div className="col-span-6 sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Billing / CPT Code
                            </label>
                            <input
                              type="text"
                              value={item.code}
                              placeholder="e.g. DIAG-101"
                              onChange={(e) => handleUpdateTreatmentItem(item.id, 'code', e.target.value)}
                              className="w-full p-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs"
                            />
                          </div>

                          {/* Line Total Display */}
                          <div className="col-span-5 sm:col-span-4 text-right">
                            <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                              Line Total
                            </label>
                            <span className="text-xs font-bold text-slate-900">
                              ₹{itemTotal.toLocaleString()}
                            </span>
                          </div>

                          {/* Delete Button */}
                          <div className="col-span-1 text-right flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveTreatmentItem(item.id)}
                              disabled={treatmentItems.length <= 1}
                              title={treatmentItems.length <= 1 ? "At least one item required" : "Remove item"}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                treatmentItems.length <= 1
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Description & Rate / Qty */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 sm:col-span-6">
                            <input
                              type="text"
                              required
                              placeholder="Treatment / diagnostic description (e.g. Ultrasound Abdomen, Laparoscopy OT...)"
                              value={item.description}
                              onChange={(e) => handleUpdateTreatmentItem(item.id, 'description', e.target.value)}
                              className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <div className="flex items-center space-x-1">
                              <span className="text-[10px] text-slate-400">Qty</span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                value={item.quantity}
                                onChange={(e) => handleUpdateTreatmentItem(item.id, 'quantity', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                              />
                            </div>
                          </div>
                          <div className="col-span-6 sm:col-span-3">
                            <div className="flex items-center space-x-1">
                              <span className="text-[10px] text-slate-400">₹/Unit</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                required
                                value={item.unit_amount}
                                onChange={(e) => handleUpdateTreatmentItem(item.id, 'unit_amount', Number(e.target.value))}
                                className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add Helper Buttons for Common Items */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Quick Add:</span>
                  {[
                    { label: '+ Ultrasound / CT', category: 'INVESTIGATION', desc: 'Abdomen & Pelvis CT Scan', amount: 6500, code: 'DIAG-201' },
                    { label: '+ Blood Panel', category: 'INVESTIGATION', desc: 'Complete Blood Count & Electrolytes', amount: 1800, code: 'DIAG-202' },
                    { label: '+ ICU Day', category: 'ICU', desc: 'ICU Intensive Monitoring & Nursing', amount: 12000, code: 'ICU-101' },
                    { label: '+ Specialist Consult', category: 'CONSULTATION', desc: 'Senior Consultant Surgical Rounds', amount: 2000, code: 'CONS-101' },
                    { label: '+ IV Medications', category: 'PHARMACY', desc: 'Broad-Spectrum IV Antibiotics & Fluids', amount: 4500, code: 'PHARM-201' }
                  ].map((quick, qIdx) => (
                    <button
                      key={qIdx}
                      type="button"
                      onClick={() => {
                        const newItem: TreatmentItem = {
                          id: `item-${Date.now()}-${qIdx}`,
                          category: quick.category,
                          code: quick.code,
                          description: quick.desc,
                          quantity: 1,
                          unit_amount: quick.amount
                        };
                        setTreatmentItems(prev => [...prev, newItem]);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-medium transition-colors cursor-pointer"
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Create Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Case */}
      {showEditCaseModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit Details</h3>
              <button onClick={() => setShowEditCaseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCase} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ICD-10 Code</label>
                <input
                  type="text"
                  value={editCaseForm.primary_diagnosis_code}
                  onChange={(e) => setEditCaseForm({ ...editCaseForm, primary_diagnosis_code: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diagnosis Description</label>
                <input
                  type="text"
                  value={editCaseForm.primary_diagnosis_name}
                  onChange={(e) => setEditCaseForm({ ...editCaseForm, primary_diagnosis_name: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditCaseModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation */}
      {showDeleteModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs text-center">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Delete Case {selectedCase.case_number}?</h3>
            <p className="text-slate-500 mt-1 text-[11px]">
              This permanently deletes all line items and calculations.
            </p>

            <div className="flex justify-center space-x-2 mt-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCase}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Line Item */}
      {showAddLineItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Line Item</h3>
              <button onClick={() => setShowAddLineItemModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLineItem} className="mt-3 space-y-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Category</label>
                <select
                  value={lineItemForm.category}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, category: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                >
                  <option value="ROOM_RENT">ROOM_RENT</option>
                  <option value="ICU">ICU</option>
                  <option value="SURGERY">SURGERY</option>
                  <option value="INVESTIGATION">INVESTIGATION</option>
                  <option value="PHARMACY">PHARMACY</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Description</label>
                <input
                  type="text"
                  required
                  value={lineItemForm.description}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, description: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={lineItemForm.quantity}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, quantity: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Unit Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={lineItemForm.unit_amount}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, unit_amount: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLineItemModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Line Item */}
      {editingLineItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit Line Item</h3>
              <button onClick={() => setEditingLineItem(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLineItem} className="mt-3 space-y-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Description</label>
                <input
                  type="text"
                  required
                  value={editingLineItem.description}
                  onChange={(e) => setEditingLineItem({ ...editingLineItem, description: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingLineItem.quantity}
                    onChange={(e) => setEditingLineItem({ ...editingLineItem, quantity: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Unit Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingLineItem.unit_amount}
                    onChange={(e) => setEditingLineItem({ ...editingLineItem, unit_amount: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLineItem(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Add Blocker */}
      {showAddBlockerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Blocker</h3>
              <button onClick={() => setShowAddBlockerModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBlocker} className="mt-3 space-y-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Type</label>
                <select
                  value={blockerForm.blocker_type}
                  onChange={(e) => setBlockerForm({ ...blockerForm, blocker_type: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                >
                  <option value="CLINICAL_DISCHARGE_SUMMARY">CLINICAL_DISCHARGE_SUMMARY</option>
                  <option value="MISSING_DOCUMENT">MISSING_DOCUMENT</option>
                  <option value="INSURER_QUERY">INSURER_QUERY</option>
                  <option value="BILLING_CLEARANCE">BILLING_CLEARANCE</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Description</label>
                <input
                  type="text"
                  required
                  value={blockerForm.description}
                  onChange={(e) => setBlockerForm({ ...blockerForm, description: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBlockerModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Send Patient SMS */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Send Patient SMS Notification</h3>
                  <p className="text-[10px] text-slate-500">Hospital Billing & Coordination Desk</p>
                </div>
              </div>
              <button
                onClick={() => setShowSmsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendHospitalSms} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Recipient Mobile Number</label>
                <div className="relative">
                  <Send className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 font-mono bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Quick Notification Templates</label>
                <div className="space-y-1.5">
                  {[
                    `Pre-auth submitted for Case #${selectedCase?.case_number || '2025'}. In review with insurer.`,
                    `Estimated patient payable: ₹${(selectedCase?.total_patient_payable || 0).toLocaleString()}. Please visit billing desk.`,
                    `Discharge summary ready. Room rent cap clause 3.2 applied per policy terms.`,
                    `Cashless authorization approved. You may proceed with discharge procedures.`
                  ].map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSmsBody(tmpl)}
                      className="w-full text-left p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-[11px] text-slate-700 transition-all cursor-pointer"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Custom Message Body</label>
                <textarea
                  required
                  rows={3}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 resize-none font-sans text-xs bg-slate-50/50"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSmsModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={smsSending}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  {smsSending ? <span>Sending...</span> : <><Send className="w-3.5 h-3.5" /><span>Dispatch SMS</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
