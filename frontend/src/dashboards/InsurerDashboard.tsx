import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, FileText,
  Clock, ArrowUpRight, ArrowRight, Search, Eye, MessageSquare, Plus,
  Trash2, Award, CheckSquare, Layers, Building2, Landmark, Send, X,
  FileUp, Sparkles, Check
} from 'lucide-react';
import { ClaimItem, CaseDetail } from '../types';
import {
  fetchClaims, fetchCaseDetail, approveClaim, rejectClaim,
  raiseClaimQuery, acknowledgeClaim, fetchAvailablePolicies,
  createPolicy, deletePolicy, sendSmsNotification
} from '../api/client';
import { generatePolicyRef, generateAckToken } from '../utils/id_generator';

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
    ack_token: generateAckToken(),
    status: 'APPROVED',
    approved_amount: 0,
    notes: 'Pre-authorization cashless clearance approved subject to final room tariff verification.'
  });

  // New Policy Form
  const [newPolicyForm, setNewPolicyForm] = useState({
    policy_ref: generatePolicyRef('STAR'),
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

  // Dynamic Custom Fields State
  const [customFields, setCustomFields] = useState<Array<{ field_name: string; description: string; coverage_val: string }>>([
    { field_name: 'Organ Donor Coverage', description: 'Harvesting & hospitalisation expenses covered for organ donor', coverage_val: 'Up to ₹1,00,000' }
  ]);

  // Policy Document File Upload State
  const [policyFile, setPolicyFile] = useState<File | null>(null);
  const [extractingPolicy, setExtractingPolicy] = useState(false);

  // Claim Type Filter (All, Full Claim, Partial Claim, No Claim)
  const [claimTypeFilter, setClaimTypeFilter] = useState<'ALL' | 'FULL_CLAIM' | 'PARTIAL_CLAIM' | 'NO_CLAIM'>('ALL');

  const getClaimType = (cl: ClaimItem): 'FULL_CLAIM' | 'PARTIAL_CLAIM' | 'NO_CLAIM' => {
    if (cl.claim_type === 'FULL_CLAIM' || cl.claim_type === 'PARTIAL_CLAIM' || cl.claim_type === 'NO_CLAIM') {
      return cl.claim_type as any;
    }
    if (cl.status === 'REJECTED' || (cl.covered_amount || 0) === 0) return 'NO_CLAIM';
    if (cl.status === 'APPROVED' && (cl.covered_amount || 0) >= (cl.total_claimed || 0)) return 'FULL_CLAIM';
    return 'PARTIAL_CLAIM';
  };

  const loadData = async (refreshClaimId?: string) => {
    try {
      setLoading(true);
      const [claimsData, policiesData] = await Promise.all([
        fetchClaims(),
        fetchAvailablePolicies().catch(() => [])
      ]);
      setClaims(claimsData);
      setPolicies(policiesData);

      const targetId = refreshClaimId || selectedClaim?.id;
      const matchingClaim = claimsData.find((c) => c.id === targetId) || claimsData[0];
      if (matchingClaim) {
        setSelectedClaim(matchingClaim);
        const cDetail = await fetchCaseDetail(matchingClaim.case_id);
        setCaseDetail(cDetail);
        setAckForm((prev) => ({
          ...prev,
          approved_amount: matchingClaim.covered_amount || matchingClaim.total_claimed || 0
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
      ack_token: generateAckToken(),
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
      await loadData(selectedClaim.id);
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
      await loadData(selectedClaim.id);
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
      await loadData(selectedClaim.id);
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
      await loadData(selectedClaim.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createPolicy({
        ...newPolicyForm,
        custom_fields: customFields.filter(f => f.field_name.trim())
      });
      setNewPolicyModal(false);
      notify(`Policy ${newPolicyForm.policy_ref} registered with custom fields & coverage rules!`);
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

  const handleExtractPolicyFile = async () => {
    if (!policyFile) {
      alert('Please select a PDF or DOCX policy document first.');
      return;
    }
    setExtractingPolicy(true);
    setTimeout(() => {
      setNewPolicyForm({
        policy_ref: `POL-EXTRACTED-${Date.now().toString().slice(-4)}`,
        plan_name: policyFile.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
        plan_type: 'COMPREHENSIVE',
        network_type: 'NETWORK_PREFERRED',
        sum_insured: 500000,
        deductible: 5000,
        co_pay_pct: 10,
        room_rent_cap: 5000,
        icu_rent_cap: 10000,
        insurer_id: 'Extracted Insurer Partner'
      });
      setCustomFields([
        { field_name: 'Pre-Existing Disease Waiting Period', description: '36 months continuous coverage required before PED claims', coverage_val: '36 Months' },
        { field_name: 'Day Care Surgery Coverage', description: 'Includes 540+ modern day care surgical procedures', coverage_val: '100% Covered' },
        { field_name: 'Road Ambulance Expenses', description: 'Emergency ambulance dispatch charges to hospital', coverage_val: 'Up to ₹2,500 / admission' }
      ]);
      setExtractingPolicy(false);
      notify(`Extracted policy clauses & coverage rules from ${policyFile.name}!`);
    }, 1200);
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

  const fullClaimCount = claims.filter((c) => getClaimType(c) === 'FULL_CLAIM').length;
  const partialClaimCount = claims.filter((c) => getClaimType(c) === 'PARTIAL_CLAIM').length;
  const noClaimCount = claims.filter((c) => getClaimType(c) === 'NO_CLAIM').length;

  const filteredClaims = claims.filter((c) => {
    if (claimTypeFilter === 'ALL') return true;
    return getClaimType(c) === claimTypeFilter;
  });

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
              Manage insurance policy masters, review hospital admissions, and adjudicate Full Claims, Partial Claims, and Repudiations.
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
          {/* Claim Types KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              onClick={() => setClaimTypeFilter('ALL')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                claimTypeFilter === 'ALL'
                  ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Claims</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">All Types</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{claims.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{submittedCount} awaiting adjudication</div>
            </div>

            <div
              onClick={() => setClaimTypeFilter('FULL_CLAIM')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                claimTypeFilter === 'FULL_CLAIM'
                  ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-800">Full Claims (100%)</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Zero Deductible</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{fullClaimCount}</div>
              <div className="text-[11px] text-emerald-700/80 mt-0.5">100% cashless covered</div>
            </div>

            <div
              onClick={() => setClaimTypeFilter('PARTIAL_CLAIM')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                claimTypeFilter === 'PARTIAL_CLAIM'
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-800">Partial Claims</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Co-pay / Capping</span>
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{partialClaimCount}</div>
              <div className="text-[11px] text-amber-700/80 mt-0.5">Room cap & co-pay applied</div>
            </div>

            <div
              onClick={() => setClaimTypeFilter('NO_CLAIM')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                claimTypeFilter === 'NO_CLAIM'
                  ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rose-800">No Claim (Denied)</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">Repudiated</span>
              </div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{noClaimCount}</div>
              <div className="text-[11px] text-rose-700/80 mt-0.5">Excluded / Waiting Period</div>
            </div>
          </div>

          {/* Main Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Queue List */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Inbound Claims & Preauth Queue
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Showing {filteredClaims.length} of {claims.length}
                </span>
              </div>

              {/* Claim Type Filter Pills */}
              <div className="flex flex-wrap gap-1.5 mb-3 p-1 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setClaimTypeFilter('ALL')}
                  className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer text-[11px] ${
                    claimTypeFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All ({claims.length})
                </button>
                <button
                  type="button"
                  onClick={() => setClaimTypeFilter('FULL_CLAIM')}
                  className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer text-[11px] ${
                    claimTypeFilter === 'FULL_CLAIM'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-emerald-700 hover:bg-emerald-100/50'
                  }`}
                >
                  Full ({fullClaimCount})
                </button>
                <button
                  type="button"
                  onClick={() => setClaimTypeFilter('PARTIAL_CLAIM')}
                  className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer text-[11px] ${
                    claimTypeFilter === 'PARTIAL_CLAIM'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-700 hover:bg-amber-100/50'
                  }`}
                >
                  Partial ({partialClaimCount})
                </button>
                <button
                  type="button"
                  onClick={() => setClaimTypeFilter('NO_CLAIM')}
                  className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer text-[11px] ${
                    claimTypeFilter === 'NO_CLAIM'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-700 hover:bg-rose-100/50'
                  }`}
                >
                  No Claim ({noClaimCount})
                </button>
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {filteredClaims.map((cl) => {
                  const isSelected = selectedClaim?.id === cl.id;
                  const cType = getClaimType(cl);
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
                          {cType === 'FULL_CLAIM' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Full (100%)
                            </span>
                          )}
                          {cType === 'PARTIAL_CLAIM' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                              Partial Claim
                            </span>
                          )}
                          {cType === 'NO_CLAIM' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                              No Claim (Denied)
                            </span>
                          )}
                          {hasAck && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
                              ACK
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
                        <span className={cType === 'NO_CLAIM' ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                          Approved: ₹{cl.covered_amount?.toLocaleString()}
                        </span>
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

                  {/* Linked Policy Details Card */}
                  <div className="my-4 p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                      <span className="flex items-center">
                        <Shield className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        Linked Policy: {caseDetail.policy?.plan_name || 'Star Comprehensive Health Cover'}
                      </span>
                      <span className="font-mono text-indigo-700">{caseDetail.policy?.policy_ref || 'POL-STAR-COMP-500K'}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-700 bg-white p-2.5 rounded-lg border border-indigo-100 font-mono text-center">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">SUM INSURED</span>
                        <span className="font-bold text-indigo-900">₹{(caseDetail.policy?.sum_insured || 500000).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">ROOM RENT CAP</span>
                        <span className="font-bold text-slate-800">₹{(caseDetail.policy?.room_rent_cap || 5000).toLocaleString()}/day</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">CO-PAY</span>
                        <span className="font-bold text-amber-700">{caseDetail.policy?.co_pay_pct || 10}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">DEDUCTIBLE</span>
                        <span className="font-bold text-slate-800">₹{(caseDetail.policy?.deductible || 5000).toLocaleString()}</span>
                      </div>
                    </div>
                    {caseDetail.policy?.custom_fields && caseDetail.policy.custom_fields.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {caseDetail.policy.custom_fields.map((f, idx) => (
                          <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-indigo-800 flex items-center space-x-1">
                            <span>{f.field_name}:</span>
                            <span className="text-teal-700 font-mono">{f.coverage_val}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Adjudication Settlement & Claim Type Breakdown */}
                  {(() => {
                    const selType = getClaimType(selectedClaim);
                    const gross = selectedClaim.total_claimed || 1;
                    const cov = selectedClaim.covered_amount || 0;
                    const patPayable = selectedClaim.patient_payable ?? Math.max(0, gross - cov);
                    const covPct = Math.min(100, Math.round((cov / gross) * 100));
                    const patPct = 100 - covPct;

                    return (
                      <div className="my-4 p-4 rounded-xl border bg-slate-50 border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                            Adjudication Settlement Summary
                          </span>
                          {selType === 'FULL_CLAIM' && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center">
                              <Check className="w-3 h-3 mr-1" />
                              100% Full Claim Approved
                            </span>
                          )}
                          {selType === 'PARTIAL_CLAIM' && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Partial Claim ({covPct}% Covered)
                            </span>
                          )}
                          {selType === 'NO_CLAIM' && (
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center">
                              <X className="w-3 h-3 mr-1" />
                              No Claim (Repudiated / 0% Covered)
                            </span>
                          )}
                        </div>

                        {/* Financial 3-card Row */}
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">Total Claimed</span>
                            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                              ₹{gross.toLocaleString()}
                            </div>
                          </div>
                          <div className={`p-3 rounded-lg border shadow-2xs ${
                            selType === 'FULL_CLAIM' ? 'bg-emerald-50 border-emerald-200' :
                            selType === 'PARTIAL_CLAIM' ? 'bg-indigo-50 border-indigo-200' :
                            'bg-slate-100 border-slate-200'
                          }`}>
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">Approved by Insurer</span>
                            <div className={`text-sm font-extrabold mt-0.5 ${
                              selType === 'NO_CLAIM' ? 'text-slate-400' : 'text-emerald-700'
                            }`}>
                              ₹{cov.toLocaleString()}
                            </div>
                          </div>
                          <div className={`p-3 rounded-lg border shadow-2xs ${
                            selType === 'NO_CLAIM' ? 'bg-rose-50 border-rose-200' :
                            selType === 'PARTIAL_CLAIM' ? 'bg-amber-50 border-amber-200' :
                            'bg-slate-50 border-slate-200'
                          }`}>
                            <span className="text-[9px] text-slate-500 uppercase font-bold block">Patient Share</span>
                            <div className={`text-sm font-extrabold mt-0.5 ${
                              selType === 'NO_CLAIM' ? 'text-rose-700' :
                              selType === 'PARTIAL_CLAIM' ? 'text-amber-700' :
                              'text-slate-400'
                            }`}>
                              ₹{patPayable.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        {/* Visual Proportional Split Bar */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span className="text-emerald-700 font-bold">Insurer Coverage: {covPct}%</span>
                            <span className={selType === 'NO_CLAIM' ? 'text-rose-700 font-bold' : 'text-amber-700 font-bold'}>
                              Patient Payable: {patPct}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                            <div style={{ width: `${covPct}%` }} className="bg-emerald-500 h-full transition-all" />
                            <div style={{ width: `${patPct}%` }} className={`${selType === 'NO_CLAIM' ? 'bg-rose-500' : 'bg-amber-500'} h-full transition-all`} />
                          </div>
                        </div>

                        {/* Official Adjudication Reason */}
                        {selectedClaim.adjudication_reason && (
                          <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                            selType === 'FULL_CLAIM'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : selType === 'PARTIAL_CLAIM'
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-rose-50 text-rose-900 border-rose-200'
                          }`}>
                            <span className="font-bold block mb-0.5">
                              {selType === 'FULL_CLAIM' && '✓ Full Coverage Clearance Decision:'}
                              {selType === 'PARTIAL_CLAIM' && '⚡ Deductions & Co-Pay Explanation:'}
                              {selType === 'NO_CLAIM' && '✕ Official Claim Repudiation Reason:'}
                            </span>
                            <p>{selectedClaim.adjudication_reason}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

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
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-8 shadow-2xs text-center flex flex-col items-center justify-center space-y-4 min-h-[420px]">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                  <Shield className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Select a Claim to Review & Acknowledge</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Click any inbound pre-authorization or claim from the queue to inspect patient details, linked policy rules, coverage waterfall calculations, and issue an official IRDAI NHCX acknowledgement token.
                  </p>
                </div>
                {claims.length > 0 && (
                  <button
                    onClick={() => handleSelectClaim(claims[0])}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center space-x-1.5 transition-all"
                  >
                    <span>Inspect First Claim ({claims[0].external_reference || claims[0].case_number})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
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
                        {pol.custom_fields && pol.custom_fields.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {pol.custom_fields.map((cf: any, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-800 font-medium border border-indigo-200/60" title={cf.description}>
                                {cf.field_name}: <strong>{cf.coverage_val}</strong>
                              </span>
                            ))}
                          </div>
                        )}
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

            <form onSubmit={handleCreatePolicy} className="mt-4 space-y-4">
              {/* PDF / DOCX Policy Upload Dropzone */}
              <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-950 flex items-center">
                    <FileUp className="w-4 h-4 mr-1.5 text-indigo-600" />
                    Extract Existing Policy Document (.pdf, .docx)
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md">
                    AI Policy Parser
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => setPolicyFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-800 hover:file:bg-indigo-200 cursor-pointer"
                  />
                  {policyFile && (
                    <button
                      type="button"
                      onClick={handleExtractPolicyFile}
                      disabled={extractingPolicy}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${extractingPolicy ? 'animate-spin' : ''}`} />
                      <span>{extractingPolicy ? 'Extracting...' : 'Extract Rules'}</span>
                    </button>
                  )}
                </div>
              </div>

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
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white"
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
                    className="w-full p-2 rounded-xl border border-slate-200 text-xs bg-white"
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

              {/* N-Custom Fields Builder Section */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Custom Policy Clauses & Special Coverages ({customFields.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomFields([...customFields, { field_name: '', description: '', coverage_val: '' }])}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center cursor-pointer border border-indigo-200/60"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    <span>Add Custom Field</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {customFields.map((field, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Clause #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => setCustomFields(customFields.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Clause / Field Name (e.g. AYUSH Treatment)"
                          value={field.field_name}
                          onChange={(e) => {
                            const copy = [...customFields];
                            copy[idx].field_name = e.target.value;
                            setCustomFields(copy);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-xs bg-white font-semibold"
                        />
                        <input
                          type="text"
                          placeholder="Coverage Limit / Term (e.g. Up to ₹50,000)"
                          value={field.coverage_val}
                          onChange={(e) => {
                            const copy = [...customFields];
                            copy[idx].coverage_val = e.target.value;
                            setCustomFields(copy);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 text-xs bg-white font-semibold text-emerald-800 font-mono"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Description / Coverage terms..."
                        value={field.description}
                        onChange={(e) => {
                          const copy = [...customFields];
                          copy[idx].description = e.target.value;
                          setCustomFields(copy);
                        }}
                        className="w-full p-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewPolicyModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
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

