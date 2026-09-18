import React, { useState, useEffect } from 'react';
import {
  Heart, ShieldCheck, CheckCircle2, Clock,
  AlertCircle, DollarSign, ArrowRight, UserCheck
} from 'lucide-react';
import { CaseDetail } from '../types';
import { fetchCases, fetchCaseDetail } from '../api/client';

interface PatientDashboardProps {
  selectedCaseId?: string;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({ selectedCaseId }) => {
  const [patientCase, setPatientCase] = useState<CaseDetail | null>(null);
  const [allCases, setAllCases] = useState<CaseDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCases()
      .then((cases) => {
        setAllCases(cases);
        const current = selectedCaseId
          ? cases.find((c) => c.id === selectedCaseId) || cases[0]
          : cases[0];
        if (current) {
          fetchCaseDetail(current.id).then(setPatientCase);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedCaseId]);

  if (loading || !patientCase) {
    return <div className="p-8 text-center text-slate-500 text-xs">Loading patient journey...</div>;
  }

  const patient = patientCase.patient;
  const activeBlockers = patientCase.blockers?.filter((b) => !b.is_resolved) || [];

  // Plain English blocker translation
  let blockerSummary = "All verifications are progressing smoothly.";
  if (activeBlockers.length > 0) {
    const top = activeBlockers[0];
    if (top.blocker_type === 'MISSING_DOCUMENT') {
      blockerSummary = "The hospital team is attaching one clinical document requested by your insurance provider.";
    } else if (top.blocker_type === 'INSURER_QUERY') {
      blockerSummary = "Your insurance provider requested clinical clarification. Hospital insurance desk is preparing the response.";
    } else if (top.blocker_type === 'INSURANCE_AUTHORIZATION') {
      blockerSummary = "Your hospital has submitted pre-authorization. Awaiting initial confirmation from your insurer.";
    } else if (top.blocker_type === 'BILLING_CLEARANCE') {
      blockerSummary = "Medical care is complete. Hospital billing desk is finalizing the discharge account.";
    }
  }

  // Stepper stages
  const stages = [
    { name: 'Admission', completed: true, current: false },
    { name: 'Treatment & Care', completed: true, current: false },
    {
      name: 'Insurance Authorization',
      completed: patientCase.authorization_status === 'APPROVED',
      current: patientCase.authorization_status === 'PREAUTH_REQUESTED' || patientCase.authorization_status === 'QUERY_RAISED'
    },
    {
      name: 'Billing Settlement',
      completed: patientCase.discharge_status === 'READY',
      current: patientCase.authorization_status === 'APPROVED' && patientCase.discharge_status !== 'READY'
    },
    {
      name: 'Discharge Ready',
      completed: patientCase.discharge_status === 'READY',
      current: false
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Patient Greeting & Case Selector */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded font-bold">
                Patient Care Portal
              </span>
              <span className="text-xs text-teal-100 font-mono">Reference: {patient.patient_ref}</span>
            </div>
            <h1 className="text-2xl font-bold mt-1">Hello, {patient.full_name}</h1>
            <p className="text-xs text-teal-100 mt-0.5">
              Tracking admission for <strong>{patientCase.primary_diagnosis_name}</strong> at Apollo Healthcare
            </p>
          </div>

          {/* Quick Case Switcher for Demo */}
          <div className="bg-white/10 p-2 rounded-xl border border-white/20 text-xs">
            <span className="block text-[10px] text-teal-100 uppercase tracking-wider font-semibold mb-1">
              Select Patient Case Demo:
            </span>
            <select
              value={patientCase.id}
              onChange={(e) => {
                const found = allCases.find((c) => c.id === e.target.value);
                if (found) fetchCaseDetail(found.id).then(setPatientCase);
              }}
              className="bg-teal-900/80 text-white text-xs p-1.5 rounded-lg border border-teal-400/40 focus:outline-hidden"
            >
              {allCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.case_number} ({c.patient.full_name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Financial Breakdown Cards in Plain English */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Total Bill</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            ₹{patientCase.total_gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Includes room, surgery, medications, and care.</p>
        </div>

        <div className="bg-emerald-50/80 p-5 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Approved by Insurance
          </span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            ₹{patientCase.total_covered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-700 mt-1">Directly covered by your Star Health policy.</p>
        </div>

        <div className="bg-amber-50/80 p-5 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
            Your Estimated Out-of-Pocket
          </span>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            ₹{patientCase.total_patient_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-amber-700 mt-1">Due to policy deductible, co-pay, or room cap difference.</p>
        </div>
      </div>

      {/* Current Status Notice */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Current Status & Action</h3>
        <div className="flex items-start space-x-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <AlertCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-xs text-slate-900">
              {activeBlockers.length === 0
                ? 'Ready for Discharge Settlement'
                : 'Insurance Verification in Progress'}
            </div>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              {blockerSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Journey Stepper */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-6">Care & Insurance Timeline</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {stages.map((stg, idx) => (
            <div key={idx} className="flex flex-col items-center text-center relative z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  stg.completed
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : stg.current
                    ? 'bg-amber-500 text-white animate-pulse ring-4 ring-amber-100'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {stg.completed ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-xs font-semibold mt-2.5 ${stg.current ? 'text-amber-700' : stg.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                {stg.name}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                {stg.completed ? 'Completed' : stg.current ? 'Active stage' : 'Upcoming'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
