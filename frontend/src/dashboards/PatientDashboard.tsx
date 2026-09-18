import React, { useState, useEffect } from 'react';
import {
  Heart, ShieldCheck, CheckCircle2, Clock, AlertCircle,
  DollarSign, ArrowRight, UserCheck, HelpCircle, FileText,
  Printer, LogOut, Info, AlertTriangle, PieChart
} from 'lucide-react';
import { CaseDetail } from '../types';
import { fetchCases, fetchCaseDetail } from '../api/client';
import { PatientCoverageDonut, FinancialWaterfallChart } from '../components/AnalyticsCharts';

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
      <div className="py-20 text-center text-slate-400 text-xs font-mono">
        Loading coverage statement...
      </div>
    );
  }

  const patient = patientCase.patient;
  const activeBlockers = patientCase.blockers?.filter((b) => !b.is_resolved) || [];
  const percentCovered = patientCase.total_gross > 0
    ? Math.round((patientCase.total_covered / patientCase.total_gross) * 100)
    : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 font-sans">
      {/* Patient Greeting & Status */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-slate-500">{patientCase.case_number}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              patientCase.authorization_status === 'APPROVED'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {patientCase.authorization_status === 'APPROVED' ? '✓ CLAIM APPROVED' : 'UNDER REVIEW'}
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            {patient.full_name}
          </h1>
          <p className="text-xs text-slate-500">
            {patientCase.primary_diagnosis_name} • Apollo Multi-Specialty Hospital
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer border border-slate-200"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer border border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              Switch
            </button>
          )}
        </div>
      </div>

      {/* Visual Graph: Donut & KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Visual Donut Chart */}
        <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-center">
          <PatientCoverageDonut
            covered={patientCase.total_covered}
            payable={patientCase.total_patient_payable}
            size={130}
          />
        </div>

        {/* Financial KPI Numbers */}
        <div className="md:col-span-7 grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Hospital Gross
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              ₹{patientCase.total_gross.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">All clinical items included</span>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-2xs flex flex-col justify-center">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Insurance Covered
            </span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
              ₹{patientCase.total_covered.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium mt-1">
              {percentCovered}% Cashless Settlement
            </span>
          </div>

          <div className="col-span-2 bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                Patient Out-of-Pocket Due at Discharge
              </span>
              <div className="text-2xl font-black text-amber-800 font-mono mt-0.5">
                ₹{patientCase.total_patient_payable.toLocaleString('en-IN')}
              </div>
            </div>
            <span className="text-[11px] font-bold px-3 py-1 rounded-xl bg-amber-200/80 text-amber-900">
              {100 - percentCovered}% Your Share
            </span>
          </div>
        </div>
      </div>

      {/* Visual Graph: Financial Waterfall Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Finance
        </h2>
        <FinancialWaterfallChart
          gross={patientCase.total_gross}
          covered={patientCase.total_covered}
          payable={patientCase.total_patient_payable}
        />
      </div>

      {/* Itemized Table (Compact, Clean) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          Itemized Settlement Summary
        </h2>

        <div className="divide-y divide-slate-100 text-xs">
          {patientCase.line_items?.map((item) => {
            const dec = patientCase.decisions?.find((d) => d.line_item_id === item.id);
            const isCovered = dec && dec.patient_payable === 0;

            return (
              <div key={item.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{item.description}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {item.category} • Qty {item.quantity}
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="font-bold text-slate-900">
                    ₹{item.gross_amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] mt-0.5">
                    <span className="text-emerald-700 font-semibold mr-2">
                      Covered: ₹{dec ? dec.covered_amount.toLocaleString('en-IN') : item.gross_amount.toLocaleString('en-IN')}
                    </span>
                    <span className={isCovered ? 'text-slate-300' : 'text-amber-800 font-bold'}>
                      You: ₹{dec ? dec.patient_payable.toLocaleString('en-IN') : '0'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Progression (Minimal) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
            ✓ 1. Admitted
          </div>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
            ✓ 2. Clinical Care
          </div>
          <div className={`p-2 rounded-xl font-bold border ${
            patientCase.authorization_status === 'APPROVED'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'
          }`}>
            {patientCase.authorization_status === 'APPROVED' ? '✓ 3. Pre-Auth Approved' : '• 3. In Review'}
          </div>
          <div className={`p-2 rounded-xl font-bold border ${
            patientCase.discharge_status === 'READY'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            {patientCase.discharge_status === 'READY' ? '✓ 4. Discharge Ready' : '4. Discharge Pending'}
          </div>
        </div>
      </div>
    </div>
  );
};
