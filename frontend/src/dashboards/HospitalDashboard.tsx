import React, { useState, useEffect } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, UploadCloud,
  FileText, ArrowRight, DollarSign, ShieldAlert, Sparkles, Plus,
  Info, ChevronRight, FileCheck, Trash2, Edit3, X, Shield, RefreshCw, BarChart2
} from 'lucide-react';
import { CaseDetail } from '../types';
import {
  fetchCases, fetchCaseDetail, evaluateCase,
  submitCasePreauth, resolveBlocker, uploadDocument, createCase,
  updateCase, deleteCase, addLineItem, updateLineItem, deleteLineItem,
  addBlocker, deleteBlocker, fetchAvailablePolicies
} from '../api/client';
import {
  ReadinessRing,
  FinancialWaterfallChart,
  ClaimFunnelChart,
  BlockerDistributionChart
} from '../components/AnalyticsCharts';

interface HospitalDashboardProps {
  onSelectCase: (caseId: string) => void;
  selectedCaseId?: string;
  beeceptorScenario: string;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  onSelectCase,
  selectedCaseId,
  beeceptorScenario
}) => {
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState<any[]>([]);

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
    primary_diagnosis_name: 'Acute Appendicitis',
    room_rent_rate: 5000,
    room_days: 3,
    surgery_cost: 65000
  });

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

  const loadData = async (targetCaseId?: string) => {
    try {
      setLoading(true);
      const data = await fetchCases();
      setCases(data);

      try {
        const policies = await fetchAvailablePolicies();
        setAvailablePolicies(policies);
        if (policies.length > 0 && !newCaseForm.policy_id) {
          setNewCaseForm((prev) => ({ ...prev, policy_id: policies[0].id }));
        }
      } catch (e) {
        console.error('Error fetching policies:', e);
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
      const res = await submitCasePreauth(selectedCase.id, beeceptorScenario);
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
      const payload = {
        hospital_id: 'HOSP-APOLLO-001',
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
        line_items: [
          {
            category: 'ROOM_RENT',
            code: 'ROOM-101',
            description: `Room Charges (${newCaseForm.room_days}d)`,
            quantity: Number(newCaseForm.room_days),
            unit_amount: Number(newCaseForm.room_rent_rate)
          },
          {
            category: 'SURGERY',
            code: 'SURG-201',
            description: `${newCaseForm.primary_diagnosis_name} OT Care`,
            quantity: 1,
            unit_amount: Number(newCaseForm.surgery_cost)
          }
        ]
      };

      const created = await createCase(payload);
      setShowNewCaseModal(false);
      notify(`Case ${created.case_number} created.`);
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
    try {
      setUploadingDoc(true);
      const text = documentInput.trim() || undefined;
      const res = await uploadDocument(selectedCase.id, 'BILL_INVOICE', text);
      notify(`Document processed. Readiness: ${res.new_readiness_score}%.`);
      setDocumentInput('');
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

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
            <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <span>Roster ({cases.length})</span>
            </div>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {cases.map((c) => {
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

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-600 font-medium font-mono">₹{c.total_gross?.toLocaleString('en-IN')}</span>
                      <span className="font-semibold text-teal-700 px-1.5 py-0.2 rounded bg-teal-50 text-[10px]">
                        {c.case_status}
                      </span>
                    </div>
                  </div>
                );
              })}
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

            {/* Visual Graph: Financial Waterfall Analysis */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Deterministic Financial Waterfall Analysis
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                  ZERO ARITHMETIC HALLUCINATION
                </span>
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

              {/* Document OCR Intake */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                    <UploadCloud className="w-3.5 h-3.5 text-teal-600 mr-1" />
                    OCR / NLP Extraction
                  </h3>
                </div>

                <textarea
                  rows={4}
                  value={documentInput}
                  onChange={(e) => setDocumentInput(e.target.value)}
                  placeholder="Paste medical bills or lab reports..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleUploadDoc}
                    disabled={uploadingDoc}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    {uploadingDoc ? 'Ingesting...' : 'Ingest Document'}
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative my-8 text-slate-900 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">New Admission</h3>
              <button onClick={() => setShowNewCaseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="mt-4 space-y-3 text-xs">
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

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Insurance Policy</label>
                <select
                  value={newCaseForm.policy_id}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, policy_id: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono"
                >
                  {availablePolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} • ₹{p.sum_insured.toLocaleString()} • Cap: ₹{p.room_rent_cap}/d
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] text-slate-500">Room Rate / d</label>
                  <input
                    type="number"
                    value={newCaseForm.room_rent_rate}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, room_rent_rate: Number(e.target.value) })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">Days</label>
                  <input
                    type="number"
                    value={newCaseForm.room_days}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, room_days: Number(e.target.value) })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">Surgery / OT</label>
                  <input
                    type="number"
                    value={newCaseForm.surgery_cost}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, surgery_cost: Number(e.target.value) })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
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
                  Create
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
    </div>
  );
};
