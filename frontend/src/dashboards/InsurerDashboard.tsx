import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, FileText,
  Clock, ArrowUpRight, Search, Eye, MessageSquare, Plus,
  Trash2, Award, CheckSquare, Layers, Building2, Landmark, Send, X
} from 'lucide-react';
import { ClaimItem, CaseDetail } from '../types';
import {
  fetchClaims, fetchCaseDetail, approveClaim, rejectClaim,
  raiseClaimQuery, acknowledgeClaim, fetchAvailablePolicies,
  createPolicy, deletePolicy, sendSmsNotification
} from '../api/client';

export const InsurerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'adjudication' | 'policies'>('adjudication');
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals
  const [queryModal, setQueryModal] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [ackModal, setAckModal] = useState(false);
  const [newPolicyModal, setNewPolicyModal] = useState(false);

  // SMS Modal State
  const [smsModal, setSmsModal] = useState(false);
  const [smsPhone, setSmsPhone] = useState('+919845012345');
  const [smsBody, setSmsBody] = useState('Payer Notice: Pre-authorization cashless request is processed.');
  const [smsSending, setSmsSending] = useState(false);

  const handleSendInsurerSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsSending(true);
    try {
      const res = await sendSmsNotification(smsPhone, smsBody);
      notify(`SMS successfully dispatched to ${smsPhone} (${res.status})`);
      setSmsModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch SMS');
    } finally {
      setSmsSending(false);
    }
  };

  // Acknowledgement Form
  const [ackForm, setAckForm] = useState({
    ack_token: `ACK-NHCX-${Date.now().toString().slice(-7)}`,
    status: 'APPROVED',
    approved_amount: 0,
    notes: 'Pre-authorization cashless clearance approved subject to final room tariff verification.'
  });

  // New Policy Form
  const [newPolicyForm, setNewPolicyForm] = useState({
    policy_ref: `POL-STAR-${Date.now().toString().slice(-4)}`,
    plan_name: 'Star Comprehensive Care Protect',
    plan_type: 'COMPREHENSIVE',
    network_type: 'NETWORK_PREFERRED',
    sum_insured: 500000,
    deductible: 0,
    co_pay_pct: 10,
    room_rent_cap: 5000,
    icu_rent_cap: 10000,
    insurer_id: 'Star Health & Allied Insurance'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [claimsData, policiesData] = await Promise.all([
        fetchClaims(),
        fetchAvailablePolicies().catch(() => [])
      ]);
      setClaims(claimsData);
      setPolicies(policiesData);

      if (claimsData.length > 0 && !selectedClaim) {
        setSelectedClaim(claimsData[0]);
        const cDetail = await fetchCaseDetail(claimsData[0].case_id);
        setCaseDetail(cDetail);
        setAckForm((prev) => ({
          ...prev,
          approved_amount: claimsData[0].covered_amount || claimsData[0].total_claimed || 0
        }));
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

  const handleSelectClaim = async (claim: ClaimItem) => {
    setSelectedClaim(claim);
    setAckForm((prev) => ({
      ...prev,
      ack_token: `ACK-NHCX-${Date.now().toString().slice(-7)}`,
      approved_amount: claim.covered_amount || claim.total_claimed || 0
    }));
    try {
      const cDetail = await fetchCaseDetail(claim.case_id);
      setCaseDetail(cDetail);
    } catch (err) {
      console.error(err);
    }
  };

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleApprove = async () => {
    if (!selectedClaim) return;
    try {
      await approveClaim(selectedClaim.id, selectedClaim.total_claimed);
      notify(`Claim ${selectedClaim.external_reference || selectedClaim.id.slice(0, 8)} approved by Payer.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReject = async () => {
    if (!selectedClaim) return;
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await rejectClaim(selectedClaim.id, reason);
      notify(`Claim rejected.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRaiseQuery = async () => {
    if (!selectedClaim || !queryText.trim()) return;
    try {
      await raiseClaimQuery(selectedClaim.id, queryText.trim());
      setQueryModal(false);
      setQueryText('');
      notify(`Query dispatched to hospital billing desk via NHCX.`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleIssueAcknowledgement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim) return;
    try {
      await acknowledgeClaim(selectedClaim.id, {
        ack_token: ackForm.ack_token,
        status: ackForm.status,
        approved_amount: Number(ackForm.approved_amount),
        notes: ackForm.notes
      });
      setAckModal(false);
      notify(`Payer Acknowledgement ${ackForm.ack_token} issued successfully!`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPolicy(newPolicyForm);
      setNewPolicyModal(false);
      notify(`Policy ${newPolicyForm.policy_ref} registered and mapped with rules!`);
      const updatedPolicies = await fetchAvailablePolicies();
      setPolicies(updatedPolicies);
      setNewPolicyForm((prev) => ({
        ...prev,
        policy_ref: `POL-STAR-${Date.now().toString().slice(-4)}`
      }));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePolicy = async (policyId: string, policyRef: string) => {
    if (!confirm(`Are you sure you want to delete policy ${policyRef}?`)) return;
    try {
      await deletePolicy(policyId);
      notify(`Policy ${policyRef} deleted.`);
      const updatedPolicies = await fetchAvailablePolicies();
      setPolicies(updatedPolicies);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const submittedCount = claims.filter((c) => c.status === 'SUBMITTED' || c.status === 'PENDING').length;
  const queriedCount = claims.filter((c) => c.status === 'QUERIED' || c.status === 'QUERY_RAISED').length;
  const approvedCount = claims.filter((c) => c.status === 'APPROVED').length;
  const rejectedCount = claims.filter((c) => c.status === 'REJECTED').length;

  return (
    <div className="space-y-6 font-sans">
      {notification && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md text-xs font-semibold flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="cursor-pointer">✕</button>
        </div>
      )}

      {/* Top Banner & Tab Switcher */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-base tracking-tight">Insurance & Payer Adjudication Portal</h1>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
                TPA Gateway
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Manage insurance policy masters, review hospital admissions, and issue cashless pre-authorization acknowledgements.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveTab('adjudication')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'adjudication'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Adjudication & Claims</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] font-mono">
              {claims.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'policies'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Policy Master Repository</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] font-mono">
              {policies.length}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADJUDICATION & CLAIMS */}
      {activeTab === 'adjudication' && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Awaiting Adjudication</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{submittedCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Query Raised</span>
              <div className="text-2xl font-bold text-amber-600 mt-1">{queriedCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Approved Claims</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{approvedCount}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-medium text-slate-500">Rejected Claims</span>
              <div className="text-2xl font-bold text-rose-600 mt-1">{rejectedCount}</div>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Queue List */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Inbound Claims & Preauth Queue
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">{claims.length} cases</span>
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {claims.map((cl) => {
                  const isSelected = selectedClaim?.id === cl.id;
                  let statusBadge = 'bg-slate-100 text-slate-700';
                  if (cl.status === 'APPROVED') statusBadge = 'bg-emerald-100 text-emerald-800';
                  else if (cl.status === 'QUERIED' || cl.status === 'QUERY_RAISED') statusBadge = 'bg-amber-100 text-amber-800';
                  else if (cl.status === 'REJECTED') statusBadge = 'bg-rose-100 text-rose-800';

                  const hasAck = (cl as any).ack_token;

                  return (
                    <div
                      key={cl.id}
                      onClick={() => handleSelectClaim(cl)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected ? 'border-indigo-500 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-800">{cl.external_reference || cl.case_number}</span>
                        <div className="flex items-center space-x-1.5">
                          {hasAck && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
                              ACK ISSUED
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>
                            {cl.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mt-1">
                        {cl.patient_name} • <span className="text-slate-500 font-normal">{cl.hospital_name}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                        <span className="text-slate-500">Claimed: ₹{cl.total_claimed?.toLocaleString()}</span>
                        <span className="text-emerald-700 font-bold">Approved: ₹{cl.covered_amount?.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Claim Detail & Payer Actions */}
            {selectedClaim && caseDetail ? (
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                  {/* Payer Acknowledgement Status Banner */}
                  {(selectedClaim as any).ack_token && (
                    <div className="mb-4 p-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Award className="w-5 h-5 text-teal-600" />
                        <div>
                          <div className="text-xs font-bold text-teal-900">
                            IRDAI NHCX Official Payer Acknowledgement Issued
                          </div>
                          <div className="text-[11px] font-mono text-teal-700">
                            Token: {(selectedClaim as any).ack_token}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded">
                          Cashless Cleared
                        </span>
                        <div className="text-xs font-bold text-teal-900 mt-0.5">
                          ₹{selectedClaim.covered_amount?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-base font-bold text-slate-900">
                          {selectedClaim.external_reference || selectedClaim.case_number}
                        </h2>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                          {selectedClaim.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Hospital: {caseDetail.hospital?.name} • Patient: {caseDetail.patient?.full_name} ({caseDetail.patient?.age_band})
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <strong>Diagnosis:</strong> {caseDetail.primary_diagnosis_code} - {caseDetail.primary_diagnosis_name}
                      </p>
                    </div>

                    {/* Payer Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setAckModal(true)}
                        className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors shadow-xs flex items-center space-x-1 cursor-pointer"
                        title="Issue preauthorization acknowledgement with token"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Issue Acknowledgement</span>
                      </button>
                      <button
                        onClick={() => {
                          if (caseDetail) {
                            setSmsBody(`Payer Update [Claim #${selectedClaim.external_reference || selectedClaim.id.slice(0, 8)}]: Authorized ₹${(selectedClaim.covered_amount || selectedClaim.total_claimed || 0).toLocaleString()}. Patient co-pay: ₹${(selectedClaim.patient_payable || 0).toLocaleString()}.`);
                          }
                          setSmsModal(true);
                        }}
                        className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer flex items-center space-x-1"
                        title="Send SMS notification to beneficiary"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send SMS</span>
                      </button>
                      <button
                        onClick={() => setQueryModal(true)}
                        className="px-2.5 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer"
                      >
                        Query
                      </button>
                      <button
                        onClick={handleReject}
                        className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={handleApprove}
                        className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Approve
                      </button>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-3 gap-3 my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Total Claimed</span>
                      <div className="text-sm font-bold text-slate-900 mt-0.5">
                        ₹{selectedClaim.total_claimed?.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-600 uppercase font-bold">Approved By Payer</span>
                      <div className="text-sm font-bold text-emerald-700 mt-0.5">
                        ₹{selectedClaim.covered_amount?.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-600 uppercase font-bold">Patient Payable</span>
                      <div className="text-sm font-bold text-amber-700 mt-0.5">
                        ₹{(selectedClaim.patient_payable || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Structured Evidence & Rule Matching */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Adjudication Evidence & Policy Rule Matching
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {caseDetail.decisions?.map((dec) => (
                        <div key={dec.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
                          <div className="flex items-center justify-between font-semibold text-slate-800">
                            <span>Rule Applied: <code className="text-indigo-700">{dec.rule_id || 'STANDARD'}</code></span>
                            <span className={dec.decision_status === 'COVERED' ? 'text-emerald-700' : 'text-amber-800'}>
                              {dec.decision_status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1">
                            {dec.explanation}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                            <span>Eligible: ₹{dec.eligible_amount?.toLocaleString()}</span>
                            <span>Covered: ₹{dec.covered_amount?.toLocaleString()}</span>
                            <span>Patient Payable: ₹{dec.patient_payable?.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lg:col-span-7 flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
                Select a claim from the queue to view policy details and issue acknowledgement
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: POLICY MASTER REPOSITORY */}
      {activeTab === 'policies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Insurance Policies & Tariff Masters</h2>
              <p className="text-xs text-slate-500">
                Upload and configure insurance policies with ID, room rent caps, copay %, and sum insured for hospital auto-mapping.
              </p>
            </div>
            <button
              onClick={() => setNewPolicyModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Upload / Register Policy</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="p-3">Policy ID</th>
                    <th className="p-3">Plan Name & Insurer</th>
                    <th className="p-3">Sum Insured</th>
                    <th className="p-3">Room Rent Cap</th>
                    <th className="p-3">ICU Cap</th>
                    <th className="p-3">Deductible</th>
                    <th className="p-3">Co-Pay %</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {policies.map((pol) => (
                    <tr key={pol.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-indigo-700">
                        {pol.policy_ref}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{pol.plan_name}</div>
                        <div className="text-[11px] text-slate-500">{pol.insurer_id} • {pol.plan_type}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        ₹{pol.sum_insured?.toLocaleString()}
                      </td>
                      <td className="p-3 text-slate-700">
                        ₹{pol.room_rent_cap?.toLocaleString()} / day
                      </td>
                      <td className="p-3 text-slate-700">
                        ₹{pol.icu_rent_cap?.toLocaleString()} / day
                      </td>
                      <td className="p-3 text-slate-700">
                        ₹{pol.deductible?.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                          {pol.co_pay_pct}%
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDeletePolicy(pol.id, pol.policy_ref)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete policy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {policies.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                        No insurance policies found. Click "Upload / Register Policy" to add your first policy master.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ISSUE PAYER ACKNOWLEDGEMENT */}
      {ackModal && selectedClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Issue Official Payer Acknowledgement</h3>
              </div>
              <button onClick={() => setAckModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleIssueAcknowledgement} className="mt-4 space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs font-semibold text-slate-800">
                  Target Claim: <span className="font-mono text-indigo-700">{selectedClaim.external_reference || selectedClaim.case_number}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Patient: {selectedClaim.patient_name} • Hospital: {selectedClaim.hospital_name}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Generated NHCX Acknowledgement Token
                </label>
                <input
                  type="text"
                  required
                  value={ackForm.ack_token}
                  onChange={(e) => setAckForm({ ...ackForm, ack_token: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 font-mono text-xs bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Adjudication Status
                  </label>
                  <select
                    value={ackForm.status}
                    onChange={(e) => setAckForm({ ...ackForm, status: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <option value="APPROVED">APPROVED (Cashless Cleared)</option>
                    <option value="QUERY_RAISED">QUERY_RAISED (Pending Info)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Approved Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={ackForm.approved_amount}
                    onChange={(e) => setAckForm({ ...ackForm, approved_amount: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Payer Notes & Conditions for Hospital
                </label>
                <textarea
                  rows={3}
                  value={ackForm.notes}
                  onChange={(e) => setAckForm({ ...ackForm, notes: e.target.value })}
                  placeholder="Enter cashless authorization conditions..."
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAckModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>Dispatch Acknowledgement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD NEW POLICY */}
      {newPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Upload & Register Insurance Policy</h3>
              </div>
              <button onClick={() => setNewPolicyModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreatePolicy} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Policy ID / Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPolicyForm.policy_ref}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, policy_ref: e.target.value })}
                    placeholder="e.g. POL-STAR-COMP-01"
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Insurer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPolicyForm.insurer_id}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, insurer_id: e.target.value })}
                    placeholder="e.g. Star Health & Allied Insurance"
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPolicyForm.plan_name}
                  onChange={(e) => setNewPolicyForm({ ...newPolicyForm, plan_name: e.target.value })}
                  placeholder="e.g. Comprehensive Family Protect Plan"
                  className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Plan Type</label>
                  <select
                    value={newPolicyForm.plan_type}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, plan_type: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <option value="COMPREHENSIVE">Comprehensive</option>
                    <option value="BASE_HEALTH">Base Health</option>
                    <option value="SENIOR_CITIZEN">Senior Citizen</option>
                    <option value="CRITICAL_ILLNESS">Critical Illness</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Network Type</label>
                  <select
                    value={newPolicyForm.network_type}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, network_type: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <option value="NETWORK_PREFERRED">Network Preferred (Cashless)</option>
                    <option value="PAN_INDIA">Pan India Open</option>
                    <option value="TIER_1_ONLY">Tier 1 Multi-Specialty Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Sum Insured (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newPolicyForm.sum_insured}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, sum_insured: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Room Rent Cap / Day (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newPolicyForm.room_rent_cap}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, room_rent_cap: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">ICU Cap / Day (₹)</label>
                  <input
                    type="number"
                    value={newPolicyForm.icu_rent_cap}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, icu_rent_cap: Number(e.target.value) })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Deductible (₹)</label>
                  <input
                    type="number"
                    value={newPolicyForm.deductible}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, deductible: Number(e.target.value) })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-1">Co-Pay (%)</label>
                  <input
                    type="number"
                    value={newPolicyForm.co_pay_pct}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, co_pay_pct: Number(e.target.value) })}
                    className="w-full p-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-[11px] text-indigo-900">
                💡 Policy rule engine will automatically configure <code>ROOM_LIMIT</code> and <code>COPAY</code> deduction rules mapped to this policy ID.
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewPolicyModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Policy Master</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUERY MODAL */}
      {queryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Raise Adjudication Query</h3>
            <p className="text-slate-500 mb-3 text-[11px]">
              Specify missing clinical evidence, OT notes, or itemization questions required from the hospital coordinator.
            </p>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g. Please upload historical cardiology consultation records and ultrasound Doppler..."
              className="w-full p-2.5 border border-slate-300 rounded-lg h-24 mb-3"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setQueryModal(false)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseQuery}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 cursor-pointer"
              >
                Send Query
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS MODAL */}
      {smsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Send Beneficiary SMS Alert</h3>
                  <p className="text-[10px] text-slate-500">Payer Pre-auth & Claim Adjudication Gateway</p>
                </div>
              </div>
              <button
                onClick={() => setSmsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInsurerSms} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Beneficiary Mobile Number</label>
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
                <label className="block font-bold text-slate-700 mb-1">Quick Adjudication Templates</label>
                <div className="space-y-1.5">
                  {[
                    `Pre-authorization approved for ₹${(selectedClaim?.covered_amount || 0).toLocaleString()}. Claim token: ${selectedClaim?.external_reference || 'ACK-2026'}.`,
                    `Query raised on claim item. Please provide discharge summary and pharmacy bill copy.`,
                    `Claim settlement complete. Payment dispatched directly to hospital under cashless agreement.`,
                    `Advisory: Deductions applied under room rent cap clause 3.2. Patient co-pay confirmed.`
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
                  onClick={() => setSmsModal(false)}
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

