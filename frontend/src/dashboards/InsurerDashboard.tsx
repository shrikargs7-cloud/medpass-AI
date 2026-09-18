import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, FileText,
  Clock, ArrowUpRight, Search, Eye, MessageSquare
} from 'lucide-react';
import { ClaimItem, CaseDetail } from '../types';
import { fetchClaims, fetchCaseDetail, approveClaim, rejectClaim, raiseClaimQuery } from '../api/client';

export const InsurerDashboard: React.FC = () => {
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [queryModal, setQueryModal] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const loadClaims = async () => {
    try {
      setLoading(true);
      const data = await fetchClaims();
      setClaims(data);
      if (data.length > 0 && !selectedClaim) {
        setSelectedClaim(data[0]);
        const cDetail = await fetchCaseDetail(data[0].case_id);
        setCaseDetail(cDetail);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClaims();
  }, []);

  const handleSelectClaim = async (claim: ClaimItem) => {
    setSelectedClaim(claim);
    try {
      const cDetail = await fetchCaseDetail(claim.case_id);
      setCaseDetail(cDetail);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async () => {
    if (!selectedClaim) return;
    try {
      await approveClaim(selectedClaim.id, selectedClaim.total_claimed);
      setNotification(`Claim ${selectedClaim.external_reference || selectedClaim.id.slice(0, 8)} approved by Payer.`);
      setTimeout(() => setNotification(null), 4000);
      loadClaims();
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
      setNotification(`Claim rejected.`);
      setTimeout(() => setNotification(null), 4000);
      loadClaims();
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
      setNotification(`Query dispatched to hospital billing desk.`);
      setTimeout(() => setNotification(null), 4000);
      loadClaims();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const submittedCount = claims.filter((c) => c.status === 'SUBMITTED' || c.status === 'PENDING').length;
  const queriedCount = claims.filter((c) => c.status === 'QUERIED' || c.status === 'QUERY_RAISED').length;
  const approvedCount = claims.filter((c) => c.status === 'APPROVED').length;
  const rejectedCount = claims.filter((c) => c.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {notification && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-md text-xs font-semibold flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Prominent Legal / Design Notice */}
      <div className="bg-indigo-900 text-white px-4 py-2.5 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-indigo-300" />
          <span className="font-bold tracking-wide uppercase text-[11px] bg-indigo-800 px-2 py-0.5 rounded">
            Payer Decision Terminal
          </span>
          <span className="text-indigo-200">
            MedPass AI provides audited calculation evidence; the final adjudication decision is made by the authorized Insurer/TPA.
          </span>
        </div>
        <span className="text-[10px] text-indigo-300 font-mono hidden md:inline">IRDAI Preauth Sandbox</span>
      </div>

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

      {/* Main Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue List */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Inbound Claims & Preauth Queue
          </h3>
          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {claims.map((cl) => {
              const isSelected = selectedClaim?.id === cl.id;
              let statusBadge = 'bg-slate-100 text-slate-700';
              if (cl.status === 'APPROVED') statusBadge = 'bg-emerald-100 text-emerald-800';
              else if (cl.status === 'QUERIED' || cl.status === 'QUERY_RAISED') statusBadge = 'bg-amber-100 text-amber-800';
              else if (cl.status === 'REJECTED') statusBadge = 'bg-rose-100 text-rose-800';

              return (
                <div
                  key={cl.id}
                  onClick={() => handleSelectClaim(cl)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-800">{cl.external_reference || cl.case_number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge}`}>
                      {cl.status}
                    </span>
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

        {/* Claim Detail & Payer Action Card */}
        {selectedClaim && caseDetail ? (
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
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

                {/* Payer Decision Buttons */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setQueryModal(true)}
                    className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer"
                  >
                    Raise Query
                  </button>
                  <button
                    onClick={handleReject}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                  >
                    Approve Payer Decision
                  </button>
                </div>
              </div>

              {/* Structured Evidence & "Why?" Breakdown */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Adjudication Evidence & Policy Rule Matching
                </h4>
                <div className="space-y-2 max-h-72 overflow-y-auto">
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
          <div className="lg:col-span-7 flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500">
            Select a claim from the queue to adjudicate
          </div>
        )}
      </div>

      {/* Query Raising Modal */}
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
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRaiseQuery}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700"
              >
                Send Query
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
