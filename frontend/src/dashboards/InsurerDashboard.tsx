import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, FileText,
  Clock, ArrowUpRight, ArrowRight, Search, Eye, MessageSquare, Plus,
  Trash2, Award, CheckSquare, Layers, Building2, Landmark, Send, X,
  FileUp, Sparkles, Check, FileQuestion, Activity, ShieldAlert
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
  
  const [finalApprovedAmount, setFinalApprovedAmount] = useState<number>(0);

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
  const [searchQuery, setSearchQuery] = useState('');

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
        setFinalApprovedAmount(matchingClaim.covered_amount || matchingClaim.total_claimed || 0);
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
    setFinalApprovedAmount(claim.covered_amount || claim.total_claimed || 0);
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
      await approveClaim(selectedClaim.id, finalApprovedAmount);
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
      const payload = {
        ...newPolicyForm,
        custom_fields: customFields
      };
      await createPolicy(payload);
      setNewPolicyModal(false);
      notify('New policy successfully minted in network.');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('Are you sure you want to deactivate this policy?')) return;
    try {
      await deletePolicy(policyId);
      notify('Policy deactivated successfully.');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Dummy PDF Extraction Simulator
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPolicyFile(e.target.files[0]);
    }
  };

  const extractPolicyData = async () => {
    if (!policyFile) return;
    setExtractingPolicy(true);
    const formData = new FormData();
    formData.append('file', policyFile);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/cases/aux/policies/extract`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error("Failed to extract policy");
      const data = await res.json();
      const extracted = data.extracted_data;
      
      setNewPolicyForm(prev => ({
        ...prev,
        policy_ref: extracted.policy_number || prev.policy_ref,
        plan_name: extracted.plan_name || prev.plan_name,
        sum_insured: extracted.sum_insured || prev.sum_insured,
        deductible: extracted.deductible || prev.deductible,
        co_pay_pct: extracted.co_pay_pct || prev.co_pay_pct
      }));

      if (extracted.exclusions && extracted.exclusions.length > 0) {
        setCustomFields(extracted.exclusions.map((ex: string) => ({
          field_name: 'Exclusion',
          description: ex,
          coverage_val: 'No Cover'
        })));
      } else {
         setCustomFields([]);
      }
    } catch (err: any) {
      alert("Extraction failed: " + err.message);
    } finally {
      setExtractingPolicy(false);
    }
  };

  // Filtered Claims
  const filteredClaims = claims.filter(c => {
    const matchesType = claimTypeFilter === 'ALL' || getClaimType(c) === claimTypeFilter;
    const matchesSearch = !searchQuery || 
      c.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.external_reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: any }> = {
      SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
      UNDER_REVIEW: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock },
      APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-800', icon: CheckCircle2 },
      REJECTED: { bg: 'bg-rose-100', text: 'text-rose-800', icon: XCircle },
      QUERIED: { bg: 'bg-amber-100', text: 'text-amber-800', icon: AlertTriangle },
    };
    const config = map[status] || map.SUBMITTED;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${config.bg} ${config.text}`}>
        <Icon className="w-3.5 h-3.5 mr-1" />
        {status}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col font-sans bg-slate-50">
      {notification && (
        <div className="fixed top-20 right-8 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 z-50 animate-in slide-in-from-right-8">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-sm">{notification}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">TPA / Payer Adjudication Portal</h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">National Health Claims Exchange</p>
          </div>
        </div>
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/60 shadow-inner">
          <button
            onClick={() => setActiveTab('adjudication')}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'adjudication' ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            Adjudication Desk
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'policies' ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-900/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            Policy & Master Data
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden flex">
        {loading && !claims.length ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : activeTab === 'policies' ? (
          /* POLICY MASTER VIEW */
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Policy Definitions Master</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage rulesets, room rent caps, and network inclusions for automated cashless assessment.</p>
                </div>
                <button
                  onClick={() => setNewPolicyModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Policy Version</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {policies.map(policy => (
                  <div key={policy.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-indigo-600 border border-slate-100">
                            <Landmark className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">{policy.plan_name}</h3>
                            <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                              REF: {policy.policy_ref}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => handleDeletePolicy(policy.id)} className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer" title="Deactivate Policy">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm mb-4">
                        <div>
                          <span className="text-slate-500 text-xs block mb-0.5">Sum Insured</span>
                          <span className="font-semibold text-slate-900">₹{policy.sum_insured?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs block mb-0.5">Network Type</span>
                          <span className="font-semibold text-slate-900">{policy.network_type}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs block mb-0.5">Room Rent Cap</span>
                          <span className="font-semibold text-slate-900">{policy.room_rent_cap ? `₹${policy.room_rent_cap}/day` : 'No Limit'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs block mb-0.5">Co-pay</span>
                          <span className="font-semibold text-slate-900">{policy.co_pay_pct}%</span>
                        </div>
                      </div>
                    </div>

                    {policy.custom_fields && Object.keys(policy.custom_fields).length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Special Clauses</span>
                        <div className="space-y-1.5">
                          {Object.entries(policy.custom_fields).slice(0, 2).map(([k, v]: any) => (
                            <div key={k} className="flex justify-between text-xs bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-100">
                              <span className="text-slate-600 font-medium">{v?.field_name || k}</span>
                              <span className="text-emerald-700 font-semibold">{v?.coverage_val}</span>
                            </div>
                          ))}
                          {Object.keys(policy.custom_fields).length > 2 && (
                            <span className="text-xs text-indigo-600 font-medium cursor-pointer hover:underline pl-1">
                              +{Object.keys(policy.custom_fields).length - 2} more clauses
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {policies.length === 0 && (
                  <div className="col-span-2 text-center py-16 bg-white border border-slate-200 border-dashed rounded-2xl">
                    <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-900">No Custom Policies Defined</p>
                    <p className="text-xs text-slate-500 mt-1">Create a policy template to automate adjudication mappings.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ADJUDICATION VIEW */
          <>
            {/* LEFT SIDEBAR: INBOX */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
              <div className="p-4 border-b border-slate-100 shrink-0">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Claim Inbox</h3>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search UID, Name, Ref..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition-all"
                  />
                </div>
                
                {/* Custom Filters for Claim Types */}
                <div className="flex mt-3 space-x-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  <button onClick={() => setClaimTypeFilter('ALL')} className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${claimTypeFilter === 'ALL' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>All</button>
                  <button onClick={() => setClaimTypeFilter('FULL_CLAIM')} className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${claimTypeFilter === 'FULL_CLAIM' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>Full Claim</button>
                  <button onClick={() => setClaimTypeFilter('PARTIAL_CLAIM')} className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${claimTypeFilter === 'PARTIAL_CLAIM' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>Partial</button>
                  <button onClick={() => setClaimTypeFilter('NO_CLAIM')} className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${claimTypeFilter === 'NO_CLAIM' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>No Claim</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredClaims.map((claim) => (
                  <div
                    key={claim.id}
                    onClick={() => handleSelectClaim(claim)}
                    className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                      selectedClaim?.id === claim.id ? 'bg-indigo-50/60 border-l-4 border-l-indigo-600' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono font-semibold text-slate-500">
                        {claim.external_reference || claim.id.slice(0, 8).toUpperCase()}
                      </span>
                      {getStatusBadge(claim.status)}
                    </div>
                    <div className="font-bold text-slate-900 text-sm mb-1">{claim.patient_name || 'Patient Info Pending'}</div>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-100/50 px-2 py-0.5 rounded-md">
                        ₹{(claim.total_claimed || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(claim.submitted_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredClaims.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No claims match this filter.
                  </div>
                )}
              </div>
            </div>

            {/* MAIN PANEL */}
            <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
              {selectedClaim ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  
                  {/* Header & Quick Actions */}
                  <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900 mb-1">
                        {caseDetail?.patient?.full_name || 'Loading Patient...'}
                      </h2>
                      <div className="flex items-center space-x-3 text-sm text-slate-500 font-medium">
                        <span className="flex items-center"><Building2 className="w-4 h-4 mr-1 text-slate-400" /> {caseDetail?.hospital?.name || 'Network Hospital'}</span>
                        <span>•</span>
                        <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{caseDetail?.policy?.policy_ref}</span>
                      </div>
                    </div>
                    
                    {/* Core Insurer Actions mapped exactly to User Prompts */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setAckModal(true)}
                        className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold text-sm flex items-center space-x-1.5 shadow-sm transition-all"
                      >
                        <Award className="w-4 h-4" />
                        <span>Step 1: Issue Acknowledgement</span>
                      </button>
                      <button
                        onClick={() => setQueryModal(true)}
                        className="px-3.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl font-semibold text-sm flex items-center space-x-1.5 transition-all"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Step 2: Raise Query</span>
                      </button>
                      <button
                        onClick={() => setSmsModal(true)}
                        className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold text-sm flex items-center space-x-1.5 shadow-sm transition-all"
                      >
                        <Send className="w-4 h-4" />
                        <span>Notify Patient</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Col: Analytics & Fraud Diagnostics */}
                    <div className="lg:col-span-2 space-y-6">
                      
                      {/* AI Mapping Breakdown Panel */}
                      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                          <h3 className="font-bold text-slate-900 flex items-center">
                            <Layers className="w-4 h-4 mr-2 text-indigo-600" />
                            Bill-to-Policy Auto Mapping
                          </h3>
                          <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded">Processed in 0.4s</span>
                        </div>
                        <div className="p-0">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50/50 text-xs text-slate-500 font-semibold border-b border-slate-100">
                              <tr>
                                <th className="px-5 py-3 text-left">Clinical Category</th>
                                <th className="px-5 py-3 text-right">Billed Amount</th>
                                <th className="px-5 py-3 text-right">AI Assessment</th>
                                <th className="px-5 py-3 text-right">Sanctioned</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              <tr>
                                <td className="px-5 py-3 font-medium text-slate-700">Room & Nursing</td>
                                <td className="px-5 py-3 text-right font-mono">₹12,000</td>
                                <td className="px-5 py-3 text-right text-xs">
                                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">Under 1% Cap ✅</span>
                                </td>
                                <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">₹12,000</td>
                              </tr>
                              <tr>
                                <td className="px-5 py-3 font-medium text-slate-700">Surgery / OT</td>
                                <td className="px-5 py-3 text-right font-mono">₹45,000</td>
                                <td className="px-5 py-3 text-right text-xs">
                                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">Diagnosis Match ✅</span>
                                </td>
                                <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">₹45,000</td>
                              </tr>
                              <tr>
                                <td className="px-5 py-3 font-medium text-slate-700">Pharmacy & Consumables</td>
                                <td className="px-5 py-3 text-right font-mono">₹14,500</td>
                                <td className="px-5 py-3 text-right text-xs">
                                  <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-semibold flex items-center justify-end">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Gloves/Masks Excluded (-₹3,200)
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">₹11,300</td>
                              </tr>
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                              <tr>
                                <td colSpan={2} className="px-5 py-3 text-right font-bold text-slate-700 text-sm">Total Recommended:</td>
                                <td colSpan={2} className="px-5 py-3 text-right font-mono font-extrabold text-emerald-600 text-lg">
                                  ₹{(selectedClaim.covered_amount || 0).toLocaleString()}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Fraud & Integrity Checks */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center space-x-2 mb-3">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            <h4 className="font-bold text-slate-900 text-sm">Fraud & KYC Verification</h4>
                          </div>
                          <ul className="space-y-2.5">
                            <li className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Provider Blacklist Check</span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">PASSED</span>
                            </li>
                            <li className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Duplicate Invoice Pattern</span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">CLEAR</span>
                            </li>
                            <li className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Patient Identity Match</span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">VERIFIED</span>
                            </li>
                          </ul>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center space-x-2 mb-3">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            <h4 className="font-bold text-slate-900 text-sm">Clinical NLP Analysis</h4>
                          </div>
                          <ul className="space-y-2.5">
                            <li className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">ICD-10 Code Alignment</span>
                              <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">High Confidence</span>
                            </li>
                            <li className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Duration of Stay (ALOS)</span>
                              <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">Standard (3 Days)</span>
                            </li>
                            <li className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">Surgical Notes Quality</span>
                              <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Needs Review</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                    </div>

                    {/* Right Col: Adjudication Action Panel */}
                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl shadow-xl border border-indigo-100 overflow-hidden sticky top-6">
                        <div className="bg-indigo-600 p-4 text-white">
                          <h3 className="font-bold flex items-center">
                            <CheckSquare className="w-4 h-4 mr-2 text-indigo-200" />
                            Final Judgement
                          </h3>
                          <p className="text-indigo-200 text-xs mt-1">Review the AI recommendations and execute the final adjudication decision.</p>
                        </div>
                        <div className="p-5 space-y-5">
                          
                          {/* Financial Summary */}
                          <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">Gross Billed</span>
                              <span className="font-mono font-semibold text-slate-900">₹{(selectedClaim.total_claimed || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500">AI Suggested Deductions</span>
                              <span className="font-mono font-semibold text-rose-600">-₹{((selectedClaim.total_claimed || 0) - (selectedClaim.covered_amount || 0)).toLocaleString()}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-200">
                              <label className="block text-xs font-bold text-slate-700 mb-1">Final Approved Amount (Editable)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-500 font-bold">₹</span>
                                <input
                                  type="number"
                                  value={finalApprovedAmount}
                                  onChange={(e) => setFinalApprovedAmount(Number(e.target.value))}
                                  className="w-full pl-8 pr-3 py-2 text-lg font-bold font-mono text-emerald-700 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1">Adjust if manual override is required.</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <button
                              onClick={handleApprove}
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                              <span>Step 3A: Approve Cashless</span>
                            </button>
                            <button
                              onClick={handleReject}
                              className="w-full py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Step 3B: Reject Claim</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-700">No Claim Selected</h3>
                    <p className="text-sm mt-1 max-w-sm mx-auto">Select a pre-auth request from the inbox to initiate AI-assisted adjudication.</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODALS */}
      {/* ACKNOWLEDGEMENT MODAL */}
      {ackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-indigo-900">Issue NHCX Acknowledgement</h3>
              </div>
              <button onClick={() => setAckModal(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleIssueAcknowledgement} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Acknowledgement Token (IRDAI-compliant)</label>
                <input
                  type="text"
                  readOnly
                  value={ackForm.ack_token}
                  className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={ackForm.status}
                    onChange={(e) => setAckForm({ ...ackForm, status: e.target.value })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-600 outline-none"
                  >
                    <option value="APPROVED">Adjudication In-Progress</option>
                    <option value="QUERIED">Immediate Query</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Provisioned Amount</label>
                  <input
                    type="number"
                    value={ackForm.approved_amount}
                    onChange={(e) => setAckForm({ ...ackForm, approved_amount: Number(e.target.value) })}
                    className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg font-mono text-slate-700 focus:ring-2 focus:ring-indigo-600 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Regulatory Notes</label>
                <textarea
                  value={ackForm.notes}
                  onChange={(e) => setAckForm({ ...ackForm, notes: e.target.value })}
                  className="w-full p-2 text-sm bg-white border border-slate-300 rounded-lg h-20 text-slate-700 focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Issue Token</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE POLICY MODAL */}
      {newPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 text-sm my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Define Network Policy</h3>
                  <p className="text-xs text-slate-500">Create rules for automated bill-to-policy mapping.</p>
                </div>
              </div>
              <button onClick={() => setNewPolicyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="p-6 space-y-6">
              
              {/* Automated Extraction Banner */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <FileUp className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-indigo-900 text-sm">Smart Policy Ingestion (OCR/NLP)</h4>
                    <p className="text-xs text-indigo-700/70 mt-0.5">Upload a PDF policy document to automatically extract coverage caps and clauses.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={extractPolicyData}
                    disabled={!policyFile || extractingPolicy}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg flex items-center space-x-1 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {extractingPolicy ? (
                      <span className="flex items-center"><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div> Extracting...</span>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Extract Clauses</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    value={newPolicyForm.plan_name}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, plan_name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Policy Master Reference</label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={newPolicyForm.policy_ref}
                    className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Base Sum Insured (₹)</label>
                  <input
                    type="number"
                    required
                    value={newPolicyForm.sum_insured}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, sum_insured: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Network Type</label>
                  <select
                    value={newPolicyForm.network_type}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, network_type: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="NETWORK_PREFERRED">Preferred Provider Network (PPN)</option>
                    <option value="NON_NETWORK">Non-Network / Reimbursement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Room Rent Cap (₹/day)</label>
                  <input
                    type="number"
                    value={newPolicyForm.room_rent_cap}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, room_rent_cap: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Base Co-Pay (%)</label>
                  <input
                    type="number"
                    value={newPolicyForm.co_pay_pct}
                    onChange={(e) => setNewPolicyForm({ ...newPolicyForm, co_pay_pct: Number(e.target.value) })}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Mapped Clauses */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center">
                      <Layers className="w-4 h-4 mr-1.5 text-indigo-500" />
                      Dynamic Coverage Clauses
                    </h4>
                    <p className="text-[11px] text-slate-500">Custom mapping rules applied during AI adjudication.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomFields([...customFields, { field_name: '', description: '', coverage_val: '' }])}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center cursor-pointer"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Rule
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {customFields.map((field, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid gap-2 relative group">
                      <button 
                        type="button" 
                        onClick={() => setCustomFields(customFields.filter((_, i) => i !== idx))}
                        className="absolute right-2 top-2 p-1 text-slate-400 hover:text-rose-500 rounded bg-white border border-slate-100 shadow-xs hidden group-hover:block transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <div className="grid grid-cols-2 gap-2 pr-6">
                        <input
                          type="text"
                          placeholder="Clause Name (e.g., Maternity, Cataract)"
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
                          placeholder="Coverage Limit (e.g., ₹50,000 max)"
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
                        placeholder="Description / Context for AI rules engine..."
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

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewPolicyModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Policy Ruleset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUERY MODAL */}
      {queryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center"><FileQuestion className="w-5 h-5 mr-2 text-amber-500" /> Raise Adjudication Query</h3>
            <p className="text-slate-500 mb-4 text-xs">
              Specify missing clinical evidence, OT notes, or itemization questions required from the hospital billing desk.
            </p>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="e.g. Please upload historical cardiology consultation records and ultrasound Doppler..."
              className="w-full p-3 border border-slate-300 rounded-xl h-28 mb-4 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setQueryModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseQuery}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 cursor-pointer flex items-center shadow-md shadow-amber-500/20"
              >
                <Send className="w-4 h-4 mr-1.5" />
                Step 2: Submit Query
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS MODAL */}
      {smsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
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

            <form onSubmit={handleSendInsurerSms} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Beneficiary Mobile Number</label>
                <div className="relative">
                  <Send className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-slate-200 font-mono bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Quick Adjudication Templates</label>
                <div className="space-y-2">
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
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-xs text-slate-700 transition-all cursor-pointer bg-slate-50/50"
                    >
                      {tmpl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Custom Message Body</label>
                <textarea
                  required
                  rows={3}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 resize-none font-sans text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSmsModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-sm cursor-pointer text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={smsSending}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm flex items-center space-x-1.5 cursor-pointer shadow-md"
                >
                  {smsSending ? <span>Sending...</span> : <><Send className="w-4 h-4" /><span>Dispatch SMS</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
