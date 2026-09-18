import React, { useState, useEffect } from 'react';
import {
  Building2, User, ShieldCheck, ArrowRight, Activity, CheckCircle2,
  Lock, FileText, Search, HeartPulse, CreditCard
} from 'lucide-react';
import { fetchCases } from '../api/client';
import { CaseDetail } from '../types';

interface LoginDashboardProps {
  onLoginHospital: (staffInfo: { name: string; role: string; hospital: string }) => void;
  onLoginPatient: (caseId: string, patientName: string) => void;
}

export const LoginDashboard: React.FC<LoginDashboardProps> = ({
  onLoginHospital,
  onLoginPatient,
}) => {
  const [selectedRole, setSelectedRole] = useState<'hospital' | 'patient'>('hospital');
  
  // Hospital staff selection state
  const [hospitalStaff, setHospitalStaff] = useState({
    name: 'Dr. Arvind Sharma',
    role: 'Chief Medical Officer & Billing Admin',
    hospital: 'Apollo Multi-Specialty Hospital'
  });

  // Patient selection state
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [selectedPatientCaseId, setSelectedPatientCaseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingCases, setLoadingCases] = useState<boolean>(true);

  useEffect(() => {
    fetchCases()
      .then((data) => {
        setCases(data);
        if (data.length > 0) {
          // Default to Vikram Rao (Room cap demo) or first case
          const defaultCase = data.find((c) => c.case_number.includes('ROOMCAP')) || data[0];
          setSelectedPatientCaseId(defaultCase.id);
        }
      })
      .catch((err) => console.error('Error fetching cases for patient login:', err))
      .finally(() => setLoadingCases(false));
  }, []);

  const handleHospitalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginHospital(hospitalStaff);
  };

  const handlePatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foundCase = cases.find((c) => c.id === selectedPatientCaseId);
    onLoginPatient(
      selectedPatientCaseId,
      foundCase ? foundCase.patient.full_name : 'Patient User'
    );
  };

  const filteredCases = cases.filter((c) =>
    c.patient.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.primary_diagnosis_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-100 flex flex-col justify-between font-sans">
      {/* Top Brand Bar */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">MedPass AI</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold uppercase tracking-wider">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Healthcare Hospital & Insurance Workflow Suite</p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden sm:flex items-center text-slate-600 font-medium space-x-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>IRDAI & HIPAA Compliant</span>
            </div>
            <div className="hidden sm:inline-block text-slate-300">|</div>
            <div className="flex items-center space-x-1 text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>256-Bit Encrypted Gateway</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Authentication Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome to <span className="bg-gradient-to-r from-teal-700 to-emerald-600 bg-clip-text text-transparent">MedPass Portal</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Select your role to access hospital revenue cycle management or track real-time insurance coverage and out-of-pocket claims.
          </p>

          {/* Role Switcher Tabs */}
          <div className="mt-6 inline-flex p-1.5 rounded-2xl bg-slate-200/80 border border-slate-300/80 shadow-inner">
            <button
              type="button"
              onClick={() => setSelectedRole('hospital')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                selectedRole === 'hospital'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-teal-600" />
              <span>Hospital Staff & Doctors</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('patient')}
              className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                selectedRole === 'patient'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 text-emerald-600" />
              <span>Patient & Beneficiary</span>
            </button>
          </div>
        </div>

        {/* Dynamic Card based on Selected Role */}
        <div className="max-w-xl w-full mx-auto bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 overflow-hidden transition-all">
          {selectedRole === 'hospital' ? (
            /* Hospital Staff Login Form */
            <div className="p-6 sm:p-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Hospital Administration Desk</h2>
                  <p className="text-xs text-slate-500">Manage admissions, add/delete cases, and process payer claims</p>
                </div>
              </div>

              <form onSubmit={handleHospitalSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Medical Professional Profile
                  </label>
                  <div className="space-y-2">
                    {[
                      {
                        name: 'Dr. Arvind Sharma',
                        role: 'Chief Medical Officer & Billing Admin',
                        hospital: 'Apollo Multi-Specialty Hospital'
                      },
                      {
                        name: 'Priya Nair',
                        role: 'TPA Coordinator & Discharge Desk',
                        hospital: 'Apollo Multi-Specialty Hospital'
                      },
                      {
                        name: 'Dr. Rajesh Deshmukh',
                        role: 'Attending Physician & Surgeon',
                        hospital: 'Apollo Multi-Specialty Hospital'
                      }
                    ].map((staff) => (
                      <div
                        key={staff.name}
                        onClick={() => setHospitalStaff(staff)}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          hospitalStaff.name === staff.name
                            ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-500'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            hospitalStaff.name === staff.name
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{staff.name}</div>
                            <div className="text-xs text-slate-500">{staff.role} • {staff.hospital}</div>
                          </div>
                        </div>
                        {hospitalStaff.name === staff.name && (
                          <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                  <div className="flex items-center font-semibold text-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1.5" /> Full Administrative Privileges Enabled
                  </div>
                  <ul className="list-disc list-inside text-slate-500 pl-1 space-y-0.5">
                    <li>Create new patient admissions with insurance policies</li>
                    <li>Add, edit, or remove treatment line items & costs</li>
                    <li>Delete or archive complete patient case records</li>
                    <li>Deterministic pre-authorization calculation & submission</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <span>Enter Hospital Console</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            /* Patient Login Form */
            <div className="p-6 sm:p-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Patient & Family Claim Tracker</h2>
                  <p className="text-xs text-slate-500">Track insurance company coverage & out-of-pocket dues</p>
                </div>
              </div>

              <form onSubmit={handlePatientSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Your Patient Account or Case
                  </label>
                  
                  {/* Search filter for cases */}
                  <div className="relative mb-2">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search by your name or case number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {loadingCases ? (
                    <div className="py-6 text-center text-xs text-slate-400">Loading patient records...</div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {filteredCases.map((c) => {
                        const isSelected = selectedPatientCaseId === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedPatientCaseId(c.id)}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-emerald-50/70 border-emerald-500 ring-1 ring-emerald-500'
                                : 'border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {c.patient.full_name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{c.patient.full_name}</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {c.case_number}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {c.primary_diagnosis_name || 'Inpatient Admission'} • {c.patient.age_band} yrs
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-emerald-50/60 rounded-xl p-3 border border-emerald-200/80 text-xs text-emerald-950 space-y-1">
                  <div className="flex items-center font-bold text-emerald-900">
                    <CreditCard className="w-4 h-4 text-emerald-700 mr-1.5" /> Plain-Language Financial Clarity
                  </div>
                  <p className="text-emerald-800 text-[11px]">
                    See exact insurance approved coverage, deductible deductions, room rent difference, and your final out-of-pocket payable amount before discharge.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!selectedPatientCaseId}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <span>Track My Claim & Coverage</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 max-w-4xl mx-auto w-full">
          <div className="p-4 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Zero Arithmetic Hallucination</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every deduction, room-rent cap, and copay is calculated with deterministic policy rules.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">IRDAI SLA Timers</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Built-in tracking for the mandatory 1-hour pre-authorization and 3-hour cashless discharge clearance.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Automated Webhook Sync</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Outbound events push real-time updates to hospital EHR systems and patient communication channels.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Enterprise Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>MedPass AI Enterprise • Hospital Revenue Cycle & Payer Automation Suite</span>
          <span className="font-mono text-slate-400">IRDAI Cashless Everywhere • ABDM FHIR Standards</span>
        </div>
      </footer>
    </div>
  );
};
