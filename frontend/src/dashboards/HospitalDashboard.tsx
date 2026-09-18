import React, { useState, useEffect } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, UploadCloud,
  FileText, ArrowRight, DollarSign, ShieldAlert, Sparkles, Plus,
  Info, ChevronRight, FileCheck, Trash2, Edit3, X, Shield, RefreshCw
} from 'lucide-react';
import { CaseDetail } from '../types';
import {
  fetchCases, fetchCaseDetail, evaluateCase,
  submitCasePreauth, resolveBlocker, uploadDocument, createCase,
  updateCase, deleteCase, addLineItem, updateLineItem, deleteLineItem,
  addBlocker, deleteBlocker, fetchAvailablePolicies
} from '../api/client';

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
    setTimeout(() => setNotification(null), 4500);
  };

  // Re-run policy engine
  const handleEvaluate = async () => {
    if (!selectedCase) return;
    try {
      setEvaluating(true);
      const updated = await evaluateCase(selectedCase.id);
      setSelectedCase(updated);
      notify('Deterministic coverage rules and readiness evaluated successfully.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEvaluating(false);
    }
  };

  // Submit to Payer Gateway
  const handleSubmitPreauth = async () => {
    if (!selectedCase) return;
    try {
      setSubmitting(true);
      const res = await submitCasePreauth(selectedCase.id, beeceptorScenario);
      notify(`Gateway response: ${res.authorization_status}. Claim recorded.`);
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Create Case
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
            description: `Room Rent (${newCaseForm.room_days} Days)`,
            quantity: Number(newCaseForm.room_days),
            unit_amount: Number(newCaseForm.room_rent_rate)
          },
          {
            category: 'SURGERY',
            code: 'SURG-201',
            description: `${newCaseForm.primary_diagnosis_name} Surgical Intervention`,
            quantity: 1,
            unit_amount: Number(newCaseForm.surgery_cost)
          }
        ]
      };

      const created = await createCase(payload);
      setShowNewCaseModal(false);
      notify(`Case ${created.case_number} created with initial line items.`);
      loadData(created.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Open Edit Modal
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

  // Save Edit Case
  const handleSaveEditCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const updated = await updateCase(selectedCase.id, editCaseForm);
      setSelectedCase(updated);
      setShowEditCaseModal(false);
      notify('Case details updated and re-evaluated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Case
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

  // Add Line Item
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
      notify('Line item added. Financial waterfall recalculated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Update Line Item
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
      notify('Line item updated. Financial waterfall recalculated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Line Item
  const handleDeleteLineItem = async (itemId: string) => {
    if (!selectedCase) return;
    try {
      const updated = await deleteLineItem(selectedCase.id, itemId);
      setSelectedCase(updated);
      notify('Line item removed. Financial waterfall recalculated.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Blocker
  const handleAddBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    try {
      const updated = await addBlocker(selectedCase.id, blockerForm);
      setSelectedCase(updated);
      setShowAddBlockerModal(false);
      notify('Discharge blocker added.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Blocker
  const handleDeleteBlocker = async (blockerId: string) => {
    if (!selectedCase) return;
    try {
      const updated = await deleteBlocker(selectedCase.id, blockerId);
      setSelectedCase(updated);
      notify('Blocker removed.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Resolve Blocker
  const handleResolveBlocker = async (blockerId: string) => {
    if (!selectedCase) return;
    try {
      await resolveBlocker(selectedCase.id, blockerId);
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      notify('Blocker marked as resolved.');
      loadData(selectedCase.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Document Upload
  const handleUploadDoc = async () => {
    if (!selectedCase) return;
    try {
      setUploadingDoc(true);
      const text = documentInput.trim() || undefined;
      const res = await uploadDocument(selectedCase.id, 'BILL_INVOICE', text);
      notify(`Document processed. Readiness score updated to ${res.new_readiness_score}%.`);
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

  return (
    <div className="space-y-6 font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between text-xs font-semibold animate-slide-down">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-200 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Hospital Workspace Hero Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-5 rounded-2xl text-white shadow-md border border-slate-700/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-md border border-teal-500/30">
                Hospital Administration Console
              </span>
              <span className="text-xs text-slate-400">Apollo Multi-Specialty Hospital</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Patient Admissions & Revenue Cycle Management
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Deterministic rule evaluation, discharge blocker management, and digital payer pre-authorizations.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => setShowNewCaseModal(true)}
              className="flex items-center px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Patient Admission
            </button>

            <button
              onClick={() => loadData(selectedCase?.id)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-all cursor-pointer"
              title="Refresh case roster"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Case List & Right Case Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Case List Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Admissions Roster ({cases.length})
              </h3>
              <span className="text-[11px] text-teal-700 font-semibold">Live Feed</span>
            </div>

            <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
              {cases.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                let bandColor = 'bg-rose-50 text-rose-700 border-rose-200';
                if (c.readiness_band === 'SUBMISSION_READY') bandColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                else if (c.readiness_band === 'REVIEW_REQUIRED') bandColor = 'bg-amber-50 text-amber-700 border-amber-200';

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 shadow-xs ring-1 ring-teal-500/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-900">{c.case_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bandColor}`}>
                        {Math.round(c.readiness_score)}% Readiness
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-800 mt-1.5 flex items-center justify-between">
                      <span>{c.patient?.full_name}</span>
                      <span className="text-[10px] text-slate-500 font-normal">{c.patient?.age_band} yrs</span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {c.primary_diagnosis_code}: {c.primary_diagnosis_name}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-600 font-medium">₹{c.total_gross?.toLocaleString('en-IN') || '0'}</span>
                      <span className="font-semibold text-teal-700 px-1.5 py-0.2 rounded bg-teal-50">
                        {c.case_status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Case Workspace */}
        {selectedCase ? (
          <div className="lg:col-span-8 space-y-6">
            {/* Case Header Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xl font-bold text-slate-900">{selectedCase.case_number}</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
                      {selectedCase.case_status}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                      Auth: {selectedCase.authorization_status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-800 mt-1">
                    {selectedCase.patient?.full_name} • {selectedCase.patient?.age_band} ({selectedCase.patient?.sex_at_birth}) • {selectedCase.patient?.broad_region}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <strong>Primary Diagnosis:</strong> {selectedCase.primary_diagnosis_code} — {selectedCase.primary_diagnosis_name}
                  </p>
                </div>

                {/* Readiness Score & Action Buttons */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2.5 bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-500/40 p-2.5 rounded-2xl">
                    <div className="relative flex items-center justify-center w-12 h-12 rounded-full border-3 border-teal-600 bg-white shadow-xs">
                      <span className="text-xs font-black text-slate-900 font-mono">
                        {Math.round(selectedCase.readiness_score)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-teal-800 block">
                        Readiness
                      </span>
                      <span className={`inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        selectedCase.readiness_score >= 85
                          ? 'bg-emerald-600 text-white'
                          : selectedCase.readiness_score >= 60
                          ? 'bg-amber-500 text-white'
                          : 'bg-rose-600 text-white'
                      }`}>
                        {selectedCase.readiness_score >= 85 ? 'READY' : selectedCase.readiness_score >= 60 ? 'REVIEW' : 'BLOCKED'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <button
                      onClick={handleEvaluate}
                      disabled={evaluating}
                      className="flex items-center justify-center px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
                      {evaluating ? 'Calculating...' : 'Recalculate'}
                    </button>

                    <button
                      onClick={handleSubmitPreauth}
                      disabled={submitting}
                      className="flex items-center justify-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                      {submitting ? 'Submitting...' : 'Submit to Payer'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Administrative Actions Bar */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleOpenEditModal}
                    className="flex items-center px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Edit Case Info
                  </button>

                  <button
                    onClick={() => setShowAddLineItemModal(true)}
                    className="flex items-center px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    Add Treatment Item
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

              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[11px] text-slate-500 font-medium">Hospital Gross Total</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    ₹{selectedCase.total_gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                  <span className="text-[11px] text-emerald-800 font-semibold">Insurer Covered</span>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">
                    ₹{selectedCase.total_covered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                  <span className="text-[11px] text-amber-900 font-semibold">Patient Out-of-Pocket</span>
                  <div className="text-lg font-bold text-amber-800 mt-0.5">
                    ₹{selectedCase.total_patient_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Treatment Line Items Management */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Treatment & Procedure Line Items ({selectedCase.line_items?.length || 0})
                  </h3>
                  <p className="text-[11px] text-slate-500">Edit quantities or unit rates to recalculate policy adjudication.</p>
                </div>

                <button
                  onClick={() => setShowAddLineItemModal(true)}
                  className="flex items-center px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Line Item
                </button>
              </div>

              <div className="space-y-3">
                {selectedCase.line_items?.map((item) => {
                  const dec = selectedCase.decisions?.find((d) => d.line_item_id === item.id);
                  return (
                    <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs hover:bg-slate-50 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-sm">{item.description}</span>
                          <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-mono text-[10px]">
                            {item.category}
                          </span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-slate-900 text-sm">
                            ₹{item.gross_amount.toLocaleString('en-IN')}
                          </span>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => setEditingLineItem(item)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
                              title="Edit line item"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLineItem(item.id)}
                              className="p-1 rounded text-rose-400 hover:text-rose-700 hover:bg-rose-100 cursor-pointer"
                              title="Delete line item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-3">
                        <span>Code: {item.code}</span>
                        <span>•</span>
                        <span>Quantity: {item.quantity}</span>
                        <span>•</span>
                        <span>Unit Rate: ₹{item.unit_amount.toLocaleString('en-IN')}</span>
                      </div>

                      {dec && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] gap-2">
                          <div className="flex items-center space-x-3">
                            <span className="text-emerald-700 font-bold">
                              ✓ Insurer Covered: ₹{dec.covered_amount.toLocaleString('en-IN')}
                            </span>
                            <span className="text-amber-800 font-semibold">
                              Patient Pays: ₹{dec.patient_payable.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            Adjudication Rule: {dec.rule_id || 'GENERAL_COVERAGE'}
                          </span>
                        </div>
                      )}

                      {dec?.explanation && (
                        <p className="text-[11px] text-slate-600 mt-1 italic bg-white/60 p-1.5 rounded border border-slate-200/60">
                          {dec.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blockers & Document Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Discharge Blockers */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                    <ShieldAlert className="w-4 h-4 text-rose-500 mr-1.5" />
                    Discharge Blockers ({selectedCase.blockers?.filter((b) => !b.is_resolved).length || 0})
                  </h3>
                  <button
                    onClick={() => setShowAddBlockerModal(true)}
                    className="text-xs text-teal-700 font-bold hover:underline cursor-pointer flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-0.5" /> Add
                  </button>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {selectedCase.blockers?.map((b) => (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border text-xs ${
                        b.is_resolved
                          ? 'border-emerald-200 bg-emerald-50/40 text-slate-500'
                          : 'border-rose-200 bg-rose-50/50 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span className={b.is_resolved ? 'text-emerald-700 line-through' : 'text-rose-700'}>
                          {b.blocker_type}
                        </span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {b.owner_role}
                          </span>
                          <button
                            onClick={() => handleDeleteBlocker(b.id)}
                            className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                            title="Remove blocker"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className={`text-[11px] mt-1 ${b.is_resolved ? 'line-through text-slate-400' : ''}`}>
                        {b.description}
                      </p>

                      {!b.is_resolved && (
                        <div className="mt-2 flex items-center justify-between pt-1 border-t border-rose-200/60">
                          <span className="text-[10px] text-slate-500">
                            Action: {b.action_required || 'Required'}
                          </span>
                          <button
                            onClick={() => handleResolveBlocker(b.id)}
                            className="text-[10px] bg-white border border-rose-300 text-rose-700 font-bold px-2 py-0.5 rounded hover:bg-rose-100 cursor-pointer"
                          >
                            Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Document Extraction & OCR Intake */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                    <UploadCloud className="w-4 h-4 text-teal-600 mr-1.5" />
                    Clinical Document Intelligence
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-semibold">
                    OCR / NLP
                  </span>
                </div>

                <div className="space-y-3">
                  <textarea
                    rows={4}
                    value={documentInput}
                    onChange={(e) => setDocumentInput(e.target.value)}
                    placeholder="Paste medical discharge summary, lab reports, or bill itemizations..."
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">PDF, JPG, or Text supported</span>
                    <button
                      onClick={handleUploadDoc}
                      disabled={uploadingDoc}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      {uploadingDoc ? 'Extracting...' : 'Upload & Ingest'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
            Select a case from the admissions roster or click "New Patient Admission" above.
          </div>
        )}
      </div>

      {/* MODAL 1: Create New Admission */}
      {showNewCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative my-8 text-slate-900 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">New Patient Admission & Policy Assignment</h3>
              <button onClick={() => setShowNewCaseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Patient Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra"
                    value={newCaseForm.full_name}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, full_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newCaseForm.phone}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Age Band</label>
                  <select
                    value={newCaseForm.age_band}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, age_band: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="0-18">0-18 yrs</option>
                    <option value="19-30">19-30 yrs</option>
                    <option value="31-45">31-45 yrs</option>
                    <option value="46-60">46-60 yrs</option>
                    <option value="60+">60+ yrs</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={newCaseForm.sex_at_birth}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, sex_at_birth: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Region</label>
                  <select
                    value={newCaseForm.broad_region}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, broad_region: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="REGION_NORTH">North India</option>
                    <option value="REGION_SOUTH">South India</option>
                    <option value="REGION_WEST">West India</option>
                    <option value="REGION_EAST">East India</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Insurance Policy</label>
                <select
                  value={newCaseForm.policy_id}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, policy_id: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500 font-mono"
                >
                  {availablePolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name} ({p.policy_ref}) • Sum: ₹{p.sum_insured.toLocaleString()} • Room Cap: ₹{p.room_rent_cap}/day
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ICD-10 Code</label>
                  <input
                    type="text"
                    required
                    value={newCaseForm.primary_diagnosis_code}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, primary_diagnosis_code: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Diagnosis Name</label>
                  <input
                    type="text"
                    required
                    value={newCaseForm.primary_diagnosis_name}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, primary_diagnosis_name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-800 block mb-2">Initial Admission Charges</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Room Rate / Day (₹)</label>
                    <input
                      type="number"
                      value={newCaseForm.room_rent_rate}
                      onChange={(e) => setNewCaseForm({ ...newCaseForm, room_rent_rate: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Estimated Days</label>
                    <input
                      type="number"
                      value={newCaseForm.room_days}
                      onChange={(e) => setNewCaseForm({ ...newCaseForm, room_days: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Surgery / OT Cost (₹)</label>
                    <input
                      type="number"
                      value={newCaseForm.surgery_cost}
                      onChange={(e) => setNewCaseForm({ ...newCaseForm, surgery_cost: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewCaseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer shadow-md"
                >
                  Create Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Case Info */}
      {showEditCaseModal && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Case Details</h3>
              <button onClick={() => setShowEditCaseModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCase} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diagnosis ICD-10 Code</label>
                <input
                  type="text"
                  value={editCaseForm.primary_diagnosis_code}
                  onChange={(e) => setEditCaseForm({ ...editCaseForm, primary_diagnosis_code: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diagnosis Description</label>
                <input
                  type="text"
                  value={editCaseForm.primary_diagnosis_name}
                  onChange={(e) => setEditCaseForm({ ...editCaseForm, primary_diagnosis_name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Case Status</label>
                  <select
                    value={editCaseForm.case_status}
                    onChange={(e) => setEditCaseForm({ ...editCaseForm, case_status: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="INTAKE_COMPLETE">INTAKE_COMPLETE</option>
                    <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="QUERIED">QUERIED</option>
                    <option value="DISCHARGE_READY">DISCHARGE_READY</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discharge Status</label>
                  <select
                    value={editCaseForm.discharge_status}
                    onChange={(e) => setEditCaseForm({ ...editCaseForm, discharge_status: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="NOT_READY">NOT_READY</option>
                    <option value="PENDING_CLEARANCE">PENDING_CLEARANCE</option>
                    <option value="READY">READY</option>
                    <option value="DISCHARGED">DISCHARGED</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditCaseModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Save Changes
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
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Delete Case Record?</h3>
            <p className="text-slate-500 mt-1 leading-relaxed">
              Are you sure you want to delete case <strong>{selectedCase.case_number}</strong> ({selectedCase.patient?.full_name})?
              All line items and calculations will be permanently deleted.
            </p>

            <div className="flex justify-center space-x-2.5 mt-5">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCase}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer shadow-md shadow-rose-600/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Line Item */}
      {showAddLineItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Treatment Line Item</h3>
              <button onClick={() => setShowAddLineItemModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLineItem} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={lineItemForm.category}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="ROOM_RENT">ROOM_RENT</option>
                    <option value="ICU">ICU</option>
                    <option value="SURGERY">SURGERY</option>
                    <option value="INVESTIGATION">INVESTIGATION</option>
                    <option value="PHARMACY">PHARMACY</option>
                    <option value="CONSULTATION">CONSULTATION</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Item Code</label>
                  <input
                    type="text"
                    required
                    value={lineItemForm.code}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, code: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diagnostic CT Abdomen Scan"
                  value={lineItemForm.description}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={lineItemForm.quantity}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, quantity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Rate (₹)</label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    required
                    value={lineItemForm.unit_amount}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, unit_amount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLineItemModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Edit Line Item */}
      {editingLineItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Edit Line Item</h3>
              <button onClick={() => setEditingLineItem(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditLineItem} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={editingLineItem.description}
                  onChange={(e) => setEditingLineItem({ ...editingLineItem, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={editingLineItem.quantity}
                    onChange={(e) => setEditingLineItem({ ...editingLineItem, quantity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Unit Rate (₹)</label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    required
                    value={editingLineItem.unit_amount}
                    onChange={(e) => setEditingLineItem({ ...editingLineItem, unit_amount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLineItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Add Blocker */}
      {showAddBlockerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Add Discharge Blocker</h3>
              <button onClick={() => setShowAddBlockerModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBlocker} className="mt-4 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Blocker Type</label>
                <select
                  value={blockerForm.blocker_type}
                  onChange={(e) => setBlockerForm({ ...blockerForm, blocker_type: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                >
                  <option value="CLINICAL_DISCHARGE_SUMMARY">CLINICAL_DISCHARGE_SUMMARY</option>
                  <option value="MISSING_DOCUMENT">MISSING_DOCUMENT</option>
                  <option value="INSURER_QUERY">INSURER_QUERY</option>
                  <option value="INSURANCE_AUTHORIZATION">INSURANCE_AUTHORIZATION</option>
                  <option value="BILLING_CLEARANCE">BILLING_CLEARANCE</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Severity</label>
                  <select
                    value={blockerForm.severity}
                    onChange={(e) => setBlockerForm({ ...blockerForm, severity: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Owner Role</label>
                  <select
                    value={blockerForm.owner_role}
                    onChange={(e) => setBlockerForm({ ...blockerForm, owner_role: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  >
                    <option value="HOSPITAL_STAFF">HOSPITAL_STAFF</option>
                    <option value="INSURER_REVIEWER">INSURER_REVIEWER</option>
                    <option value="ATTENDING_PHYSICIAN">ATTENDING_PHYSICIAN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={blockerForm.description}
                  onChange={(e) => setBlockerForm({ ...blockerForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Action Required</label>
                <input
                  type="text"
                  value={blockerForm.action_required}
                  onChange={(e) => setBlockerForm({ ...blockerForm, action_required: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBlockerModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                >
                  Save Blocker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
