import React, { useState, useEffect } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, UploadCloud,
  FileText, ArrowRight, DollarSign, ShieldAlert, Sparkles, Plus,
  Info, ChevronRight, FileCheck
} from 'lucide-react';
import { CaseDetail } from '../types';
import {
  fetchCases, fetchCaseDetail, evaluateCase,
  submitCasePreauth, resolveBlocker, uploadDocument, createCase
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
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeForm, setIntakeForm] = useState({
    patient_ref: 'PAT-2026-NEW',
    full_name: 'Aditya Sen',
    dob: '1985-05-15',
    age_band: '31-45',
    sex_at_birth: 'MALE',
    broad_region: 'KARNATAKA',
    primary_diagnosis_code: 'K35.80',
    primary_diagnosis_name: 'Acute Appendicitis'
  });

  const [documentInput, setDocumentInput] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchCases();
      setCases(data);
      if (data.length > 0) {
        const active = selectedCaseId
          ? data.find((c) => c.id === selectedCaseId) || data[0]
          : data[0];
        const detail = await fetchCaseDetail(active.id);
        setSelectedCase(detail);
        onSelectCase(detail.id);
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

  const handleEvaluate = async () => {
    if (!selectedCase) return;
    try {
      setEvaluating(true);
      const updated = await evaluateCase(selectedCase.id);
      setSelectedCase(updated);
      setNotification('Deterministic policy and coverage rules evaluated successfully!');
      setTimeout(() => setNotification(null), 4000);
      loadData();
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
      setNotification(`Submitted to Payer via Beeceptor [Scenario: ${beeceptorScenario}]. Result: ${res.authorization_status}`);
      setTimeout(() => setNotification(null), 5000);
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveBlocker = async (blockerId: string) => {
    if (!selectedCase) return;
    try {
      await resolveBlocker(selectedCase.id, blockerId);
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      setNotification('Discharge blocker marked as resolved!');
      setTimeout(() => setNotification(null), 4000);
      loadData();
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
      setNotification(`Document analyzed by AI Intelligence. Readiness updated to ${res.new_readiness_score}%!`);
      setTimeout(() => setNotification(null), 4000);
      setDocumentInput('');
      const updated = await fetchCaseDetail(selectedCase.id);
      setSelectedCase(updated);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleCreateIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        hospital_id: cases[0]?.id ? 'HOSP-APOLLO-001' : '',
        patient: {
          patient_ref: intakeForm.patient_ref,
          full_name: intakeForm.full_name,
          dob: intakeForm.dob,
          age_band: intakeForm.age_band,
          sex_at_birth: intakeForm.sex_at_birth,
          broad_region: intakeForm.broad_region
        },
        primary_diagnosis_code: intakeForm.primary_diagnosis_code,
        primary_diagnosis_name: intakeForm.primary_diagnosis_name,
        line_items: [
          { category: 'ROOM_RENT', code: 'ROOM-001', description: 'Single Room (3 days)', quantity: 3, unit_amount: 5000 },
          { category: 'SURGERY', code: 'SURG-47562', description: 'Laparoscopic OT Procedure', quantity: 1, unit_amount: 60000 }
        ]
      };
      const created = await createCase(payload);
      setShowIntakeModal(false);
      setSelectedCase(created);
      setNotification(`Case ${created.case_number} created successfully!`);
      setTimeout(() => setNotification(null), 4000);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // KPIs calculation
  const activeCount = cases.length;
  const readyCount = cases.filter((c) => c.readiness_band === 'SUBMISSION_READY').length;
  const blockedCount = cases.filter((c) => c.readiness_band === 'BLOCKED').length;
  const queriedCount = cases.filter((c) => c.authorization_status === 'QUERY_RAISED').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md flex items-center justify-between text-xs font-semibold animate-slide-down">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-200 hover:text-white">✕</button>
        </div>
      )}

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Active Cases</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{activeCount}</div>
          <div className="text-[10px] text-teal-600 font-semibold mt-1 flex items-center">
            <Activity className="w-3 h-3 mr-1" /> Real-time pipeline
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Submission Ready</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{readyCount}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">Readiness ≥ 85%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Cases Blocked</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{blockedCount}</div>
          <div className="text-[10px] text-rose-600 font-semibold mt-1">Readiness &lt; 60%</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Insurer Queried</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{queriedCount}</div>
          <div className="text-[10px] text-amber-600 font-semibold mt-1">Action required</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-center">
          <button
            onClick={() => setShowIntakeModal(true)}
            className="w-full flex items-center justify-center py-2.5 px-3 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Case Intake
          </button>
        </div>
      </div>

      {/* Main Hospital Grid: Left Case List & Detail Center/Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Case Selection Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Case Roster & Preauth Pipeline
            </h3>
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {cases.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                let bandColor = 'bg-rose-100 text-rose-800 border-rose-200';
                if (c.readiness_band === 'SUBMISSION_READY') bandColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                else if (c.readiness_band === 'REVIEW_REQUIRED') bandColor = 'bg-amber-100 text-amber-800 border-amber-200';

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800">{c.case_number}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bandColor}`}>
                        {c.readiness_score}% Readiness
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900 mt-1">
                      {c.patient?.full_name}
                    </div>

                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {c.primary_diagnosis_code}: {c.primary_diagnosis_name}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-500">Gross: ₹{c.total_gross?.toLocaleString() || '0'}</span>
                      <span className="font-semibold text-teal-700">{c.case_status}</span>
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
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedCase.case_number}</h2>
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                      {selectedCase.patient?.patient_ref}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                      {selectedCase.case_status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mt-1">
                    {selectedCase.patient?.full_name} • {selectedCase.patient?.age_band} ({selectedCase.patient?.sex_at_birth}) • {selectedCase.patient?.broad_region}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <strong>Diagnosis:</strong> {selectedCase.primary_diagnosis_code} - {selectedCase.primary_diagnosis_name}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleEvaluate}
                    disabled={evaluating}
                    className="flex items-center px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-400" />
                    {evaluating ? 'Evaluating...' : 'Run Policy Engine'}
                  </button>

                  <button
                    onClick={handleSubmitPreauth}
                    disabled={submitting}
                    className="flex items-center px-3.5 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors shadow-xs cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                    {submitting ? 'Sending to Beeceptor...' : 'Submit to Payer'}
                  </button>
                </div>
              </div>

              {/* Financial KPI Ledger Strip */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                  <span className="text-[11px] text-slate-500 font-medium">Total Billed Gross</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    ₹{selectedCase.total_gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
                  <span className="text-[11px] text-emerald-800 font-medium">Insurer Covered</span>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">
                    ₹{selectedCase.total_covered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-100">
                  <span className="text-[11px] text-amber-800 font-medium">Patient Payable</span>
                  <div className="text-lg font-bold text-amber-700 mt-0.5">
                    ₹{selectedCase.total_patient_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Grid: Itemized Table & Active Blockers */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Itemized Billing & Coverage Decisions */}
              <div className="md:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Clinical Line Items & Deterministic Decisions
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {selectedCase.line_items?.length || 0} items
                  </span>
                </div>

                <div className="space-y-2.5">
                  {selectedCase.line_items?.map((item) => {
                    const dec = selectedCase.decisions?.find((d) => d.line_item_id === item.id);
                    return (
                      <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 text-xs">
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>{item.description}</span>
                          <span>₹{item.gross_amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2">
                          <span className="bg-slate-200 px-1.5 py-0.2 rounded text-slate-700 font-mono text-[10px]">
                            {item.category}
                          </span>
                          <span>Qty: {item.quantity}</span>
                          <span>@ ₹{item.unit_amount}/unit</span>
                        </div>

                        {dec && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                            <span className="text-emerald-700 font-semibold">
                              Covered: ₹{dec.covered_amount.toLocaleString()}
                            </span>
                            <span className="text-amber-800 font-semibold">
                              Patient Pays: ₹{dec.patient_payable.toLocaleString()}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                              Rule: {dec.rule_id || 'DEFAULT'}
                            </span>
                          </div>
                        )}
                        {dec?.explanation && (
                          <p className="text-[10px] text-slate-600 mt-1 italic">
                            "{dec.explanation}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blockers & Document AI Upload */}
              <div className="md:col-span-5 space-y-4">
                {/* Active Blockers Box */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500 mr-1" />
                      Discharge Blockers
                    </h3>
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                      {selectedCase.blockers?.filter((b) => !b.is_resolved).length || 0} active
                    </span>
                  </div>

                  <div className="space-y-2 mt-3">
                    {selectedCase.blockers?.map((b) => (
                      <div
                        key={b.id}
                        className={`p-2.5 rounded-lg border text-xs ${
                          b.is_resolved
                            ? 'border-emerald-200 bg-emerald-50/50 text-slate-500 line-through'
                            : 'border-rose-200 bg-rose-50/60 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold text-[11px]">
                          <span className={b.is_resolved ? 'text-emerald-700' : 'text-rose-700'}>
                            {b.blocker_type}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">
                            {b.owner_role}
                          </span>
                        </div>
                        <p className="text-[11px] mt-1">{b.description}</p>
                        {!b.is_resolved && (
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500 font-medium">
                              Action: {b.action_required || 'Verification'}
                            </span>
                            <button
                              onClick={() => handleResolveBlocker(b.id)}
                              className="text-[10px] bg-white border border-rose-300 text-rose-700 font-semibold px-2 py-0.5 rounded hover:bg-rose-100 cursor-pointer"
                            >
                              Resolve
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Document Intelligence AI Upload Box */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600 mr-1" />
                    Document Intelligence (AI / OCR)
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Upload or paste medical bill invoice / discharge text to auto-extract line items and calculate readiness.
                  </p>
                  <textarea
                    value={documentInput}
                    onChange={(e) => setDocumentInput(e.target.value)}
                    placeholder="Paste billing text or clinical notes here (or click Process Sample Invoice)..."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-teal-500 h-20 resize-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => setDocumentInput(
                        "Hospital Bill Invoice\nRoom Rent Deluxe AC 3 days: 22,500\nLaparoscopic OT Procedure: 65,000\nDiagnostic Ultrasound & Lab: 8,500\nPharmacy Inpatient: 14,000"
                      )}
                      className="text-[10px] text-teal-600 underline font-medium hover:text-teal-700 cursor-pointer"
                    >
                      Fill Sample Bill
                    </button>
                    <button
                      onClick={handleUploadDoc}
                      disabled={uploadingDoc}
                      className="flex items-center px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors shadow-xs cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 mr-1" />
                      {uploadingDoc ? 'Extracting...' : 'Extract with AI'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500">
            Select a case to inspect details
          </div>
        )}
      </div>

      {/* New Case Intake Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">New Patient Case Intake</h3>
            <form onSubmit={handleCreateIntake} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Patient Ref</label>
                  <input
                    type="text"
                    value={intakeForm.patient_ref}
                    onChange={(e) => setIntakeForm({ ...intakeForm, patient_ref: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={intakeForm.full_name}
                    onChange={(e) => setIntakeForm({ ...intakeForm, full_name: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Age Band</label>
                  <select
                    value={intakeForm.age_band}
                    onChange={(e) => setIntakeForm({ ...intakeForm, age_band: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="0-18">0-18</option>
                    <option value="19-30">19-30</option>
                    <option value="31-45">31-45</option>
                    <option value="46-60">46-60</option>
                    <option value="60+">60+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Sex</label>
                  <select
                    value={intakeForm.sex_at_birth}
                    onChange={(e) => setIntakeForm({ ...intakeForm, sex_at_birth: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Region</label>
                  <input
                    type="text"
                    value={intakeForm.broad_region}
                    onChange={(e) => setIntakeForm({ ...intakeForm, broad_region: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Primary ICD-10 Code & Diagnosis</label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={intakeForm.primary_diagnosis_code}
                    onChange={(e) => setIntakeForm({ ...intakeForm, primary_diagnosis_code: e.target.value })}
                    className="p-2 border border-slate-300 rounded-lg font-mono"
                    required
                  />
                  <input
                    type="text"
                    value={intakeForm.primary_diagnosis_name}
                    onChange={(e) => setIntakeForm({ ...intakeForm, primary_diagnosis_name: e.target.value })}
                    className="col-span-2 p-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700"
                >
                  Create & Run Readiness
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
