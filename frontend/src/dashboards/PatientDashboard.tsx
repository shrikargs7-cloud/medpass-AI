import React, { useState, useEffect } from 'react';
import {
  Heart, ShieldCheck, CheckCircle2, Clock, AlertCircle,
  DollarSign, ArrowRight, UserCheck, HelpCircle, FileText,
  Printer, LogOut, Info, AlertTriangle
} from 'lucide-react';
import { CaseDetail } from '../types';
import { fetchCases, fetchCaseDetail } from '../api/client';

interface PatientDashboardProps {
  selectedCaseId?: string;
  onLogout?: () => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  selectedCaseId,
  onLogout
}) => {
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
    return (
      <div className="py-20 text-center text-slate-500 text-sm font-medium">
        Loading your insurance coverage details...
      </div>
    );
  }

  const patient = patientCase.patient;
  const activeBlockers = patientCase.blockers?.filter((b) => !b.is_resolved) || [];
  const percentCovered = patientCase.total_gross > 0
    ? Math.round((patientCase.total_covered / patientCase.total_gross) * 100)
    : 0;

  // Plain English explanation for any active clearance step
  let statusSummary = "Your insurance verification is fully approved and you are cleared for discharge!";
  if (patientCase.authorization_status === 'QUERY_RAISED') {
    statusSummary = "Your insurance company requested routine medical lab notes from the hospital desk. Hospital staff is already submitting them.";
  } else if (patientCase.authorization_status === 'PREAUTH_REQUESTED' || patientCase.authorization_status === 'PENDING') {
    statusSummary = "Hospital submitted your cashless claim. Awaiting final confirmation from your insurer under IRDAI 1-hour fast-track guidelines.";
  } else if (activeBlockers.length > 0) {
    statusSummary = "Medical treatment is complete. The hospital billing desk is preparing the final discharge package.";
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Patient Greeting & Case Identity Bar */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-teal-600/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-extrabold tracking-wider bg-white/20 text-emerald-100 px-2.5 py-0.5 rounded-full">
                Patient Claim & Coverage Tracker
              </span>
              <span className="text-xs text-teal-200 font-mono">Case #{patientCase.case_number}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-1.5 text-white">
              Hello, {patient.full_name}
            </h1>
            <p className="text-xs text-teal-100 mt-1">
              Admission for <strong>{patientCase.primary_diagnosis_name || 'Hospital Care'}</strong> • Apollo Multi-Specialty Hospital
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/20"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Summary
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/20"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Switch Account
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero Financial Cards: The Core Question Answered */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Hospital Bill */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Total Hospital Bill
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            ₹{patientCase.total_gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Gross charges including room, medications, and clinical care.
          </p>
        </div>

        {/* Card 2: Covered by Insurance */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/80 p-5 rounded-2xl border-2 border-emerald-500/40 shadow-xs">
          <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1 text-emerald-600" />
            Covered by Insurance Company
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">
            ₹{patientCase.total_covered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
            <span>Direct Cashless Settlement</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 font-bold">{percentCovered}% of Bill</span>
          </div>
        </div>

        {/* Card 3: Amount Patient Has to Pay */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/80 p-5 rounded-2xl border-2 border-amber-500/40 shadow-xs">
          <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center">
            <DollarSign className="w-4 h-4 mr-0.5 text-amber-600" />
            Amount You Have to Pay
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-800 mt-1">
            ₹{patientCase.total_patient_payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-amber-800 font-medium mt-1">
            Your remaining out-of-pocket payable to hospital at discharge.
          </p>
        </div>
      </div>

      {/* Coverage Progress Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-slate-700">Insurance Coverage Progress</span>
          <span className="text-emerald-700">{percentCovered}% Paid by Insurance</span>
        </div>
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-700"
            style={{ width: `${percentCovered}%` }}
          />
          <div
            className="bg-amber-400 h-full transition-all duration-700"
            style={{ width: `${100 - percentCovered}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>Insurance Pays: ₹{patientCase.total_covered.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>You Pay: ₹{patientCase.total_patient_payable.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* "Why Do I Pay This Amount?" Transparent Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center space-x-2">
          <HelpCircle className="w-5 h-5 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Why Do I Have to Pay ₹{patientCase.total_patient_payable.toLocaleString('en-IN')}?
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          In accordance with your health insurance policy terms and IRDAI guidelines, here is the exact reason for the out-of-pocket amount:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="font-bold text-slate-900 block mb-1">1. Room Rent Limit Cap</span>
            <p className="text-slate-500 text-[11px]">
              If your chosen room tier exceeds your policy's daily room limit (e.g. ₹5,000/day cap vs ₹10,000/day room), the difference is borne by the patient.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="font-bold text-slate-900 block mb-1">2. Mandatory Policy Co-Pay</span>
            <p className="text-slate-500 text-[11px]">
              Certain plans require a 10% or 15% patient co-share for surgical procedures or senior citizens.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="font-bold text-slate-900 block mb-1">3. Non-Medical Items</span>
            <p className="text-slate-500 text-[11px]">
              Consumables such as admission kits, sanitization charges, or administrative documentation fees not payable by standard insurance.
            </p>
          </div>
        </div>
      </div>

      {/* Itemized Plain-Language Coverage Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
          Detailed Item Breakdown
        </h2>

        <div className="divide-y divide-slate-100">
          {patientCase.line_items?.map((item) => {
            const dec = patientCase.decisions?.find((d) => d.line_item_id === item.id);
            const isFullyCovered = dec && dec.patient_payable === 0;

            return (
              <div key={item.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{item.description}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Category: <span className="font-semibold text-slate-700">{item.category}</span> • Qty: {item.quantity}
                  </div>
                  {dec?.explanation && (
                    <div className="text-[11px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                      {dec.explanation}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400">Total: ₹{item.gross_amount.toLocaleString('en-IN')}</div>
                  <div className="mt-0.5">
                    <span className="text-emerald-700 font-bold">
                      Insurance Pays: ₹{dec ? dec.covered_amount.toLocaleString('en-IN') : item.gross_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <span className={`font-bold ${isFullyCovered ? 'text-slate-400' : 'text-amber-800'}`}>
                      You Pay: ₹{dec ? dec.patient_payable.toLocaleString('en-IN') : '0'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Status Notice */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-700 shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Live Claim Status & Discharge Outlook
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {statusSummary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
