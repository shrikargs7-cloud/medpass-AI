import React, { useState, useEffect } from 'react';
import {
  Building2, User, Shield, ArrowRight, Activity, CheckCircle2,
  Lock, Search, ShieldCheck, Mail, Eye, EyeOff, KeyRound, Phone
} from 'lucide-react';
import { fetchCases } from '../api/client';
import { CaseDetail } from '../types';

interface LoginDashboardProps {
  onLoginHospital: (staffInfo: { name: string; role: string; hospital: string }) => void;
  onLoginPatient: (caseId: string, patientName: string) => void;
  onLoginInsurer: (insurerInfo: { name: string; role: string; company: string }) => void;
  onPatientOtpLogin?: () => void;
}

export const LoginDashboard: React.FC<LoginDashboardProps> = ({
  onLoginHospital,
  onLoginPatient,
  onLoginInsurer,
  onPatientOtpLogin
}) => {
  const [selectedRole, setSelectedRole] = useState<'patient' | 'hospital' | 'insurer'>('hospital');
  
  // 1. Patient actual credentials (Firebase Auth ready)
  const [patientAuth, setPatientAuth] = useState({
    identifier: 'priya.sharma@gmail.com',
    password: 'password123',
    caseId: '',
    rememberMe: true
  });
  const [showPatientPassword, setShowPatientPassword] = useState(false);
  const [patientAuthLoading, setPatientAuthLoading] = useState(false);

  // 2. Hospital staff actual credentials (Firebase Auth ready)
  const [hospitalAuth, setHospitalAuth] = useState({
    email: 'arvind.sharma@apollohospitals.org',
    password: 'password123',
    hospitalName: 'Apollo Multi-Specialty Hospital',
    rememberMe: true
  });
  const [showHospitalPassword, setShowHospitalPassword] = useState(false);
  const [hospitalAuthLoading, setHospitalAuthLoading] = useState(false);

  // 3. Insurer officer actual credentials (Firebase Auth ready)
  const [insurerAuth, setInsurerAuth] = useState({
    email: 'rohit.mehta@starhealth.in',
    password: 'password123',
    company: 'Star Health & Allied Insurance',
    rememberMe: true
  });
  const [showInsurerPassword, setShowInsurerPassword] = useState(false);
  const [insurerAuthLoading, setInsurerAuthLoading] = useState(false);

  // Case list for patient record mapping
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [loadingCases, setLoadingCases] = useState<boolean>(true);

  useEffect(() => {
    fetchCases()
      .then((data) => {
        setCases(data);
        if (data.length > 0) {
          const defaultCase = data.find((c) => c.case_number.includes('ROOMCAP')) || data[0];
          setPatientAuth((prev) => ({ ...prev, caseId: defaultCase.id }));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingCases(false));
  }, []);

  // 1. Patient Submit Handler (Firebase Auth ready)
  const handlePatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPatientAuthLoading(true);
    // Ready for Firebase: await signInWithEmailAndPassword(auth, patientAuth.identifier, patientAuth.password)
    setTimeout(() => {
      setPatientAuthLoading(false);
      const targetCaseId = patientAuth.caseId || (cases[0] ? cases[0].id : '');
      const foundCase = cases.find((c) => c.id === targetCaseId);
      const rawName = patientAuth.identifier.split('@')[0];
      const fallbackName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      onLoginPatient(
        targetCaseId,
        foundCase ? foundCase.patient.full_name : fallbackName
      );
    }, 350);
  };

  // 2. Hospital Submit Handler (Firebase Auth ready)
  const handleHospitalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHospitalAuthLoading(true);
    // Ready for Firebase: await signInWithEmailAndPassword(auth, hospitalAuth.email, hospitalAuth.password)
    setTimeout(() => {
      setHospitalAuthLoading(false);
      const emailPrefix = hospitalAuth.email.split('@')[0] || 'Hospital Staff';
      const formattedName = emailPrefix
        .split(/[._-]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      onLoginHospital({
        name: formattedName.toLowerCase().includes('admin') || formattedName.toLowerCase().includes('staff') ? 'Dr. Arvind Sharma' : formattedName,
        role: 'Chief Medical Officer & Billing Admin',
        hospital: hospitalAuth.hospitalName
      });
    }, 350);
  };

  // 3. Insurer Submit Handler (Firebase Auth ready)
  const handleInsurerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInsurerAuthLoading(true);
    // Ready for Firebase: await signInWithEmailAndPassword(auth, insurerAuth.email, insurerAuth.password)
    setTimeout(() => {
      setInsurerAuthLoading(false);
      const emailPrefix = insurerAuth.email.split('@')[0] || 'Adjudication Officer';
      const formattedName = emailPrefix
        .split(/[._-]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      onLoginInsurer({
        name: formattedName.toLowerCase().includes('adjudicat') ? 'Rohit Mehta' : formattedName,
        role: 'Senior Adjudication Officer',
        company: insurerAuth.company
      });
    }, 350);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg text-slate-900 tracking-tight">MedPass AI</span>
            <span className="text-[10px] px-2 py-0.2 rounded-md bg-teal-50 text-teal-800 font-bold uppercase font-mono">
              Enterprise
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-Bit Encrypted Gateway</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 flex flex-col justify-center">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Sign In to Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">Select your account domain to authenticate</p>

          {/* 3-Way Role Switcher */}
          <div className="mt-4 inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300/80">
            {/* 1. Patient */}
            <button
              type="button"
              onClick={() => setSelectedRole('patient')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'patient'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Patients</span>
            </button>

            {/* 2. Hospital */}
            <button
              type="button"
              onClick={() => setSelectedRole('hospital')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'hospital'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Hospital</span>
            </button>

            {/* 3. Insurance Company */}
            <button
              type="button"
              onClick={() => setSelectedRole('insurer')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'insurer'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Insurance Company</span>
            </button>
          </div>
        </div>

        {/* Dynamic Card for the 3 Roles */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          {/* 1. PATIENT SECTION - ACTUAL AUTHENTICATION GATEWAY */}
          {selectedRole === 'patient' && (
            <form onSubmit={handlePatientSubmit} className="space-y-4">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Beneficiary Email or Registered Mobile
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={patientAuth.identifier}
                      onChange={(e) => setPatientAuth({ ...patientAuth, identifier: e.target.value })}
                      placeholder="e.g. rahul.sharma@gmail.com or +91 98450 12345"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Password / Security PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPatientPassword ? 'text' : 'password'}
                      required
                      value={patientAuth.password}
                      onChange={(e) => setPatientAuth({ ...patientAuth, password: e.target.value })}
                      placeholder="Enter patient portal password"
                      className="w-full pl-9 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPatientPassword(!showPatientPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPatientPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select Linked Admission Record
                  </label>
                  <div className="relative">
                    <Activity className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={patientAuth.caseId}
                      onChange={(e) => setPatientAuth({ ...patientAuth, caseId: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 font-mono"
                    >
                      {cases.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.case_number}] {c.patient?.full_name} • {c.primary_diagnosis_name || 'Inpatient'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={patientAuth.rememberMe}
                      onChange={(e) => setPatientAuth({ ...patientAuth, rememberMe: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Remember this device</span>
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Firebase Authentication password reset link will be sent to your registered email.');
                    }}
                    className="text-emerald-700 hover:underline font-semibold"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Patient Access Only:</span> View amount covered by insurance company and your out-of-pocket payable share.
                </div>
              </div>

              <button
                type="submit"
                disabled={patientAuthLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {patientAuthLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Patient Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {onPatientOtpLogin && (
                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                  <div className="relative flex justify-center text-[10px]"><span className="bg-white px-3 text-slate-400 font-semibold">OR</span></div>
                </div>
              )}

              {onPatientOtpLogin && (
                <button
                  type="button"
                  onClick={onPatientOtpLogin}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-50 border-2 border-emerald-300 text-emerald-700 font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Login with Mobile OTP</span>
                </button>
              )}
            </form>
          )}

          {/* 2. HOSPITAL SECTION - ACTUAL AUTHENTICATION GATEWAY */}
          {selectedRole === 'hospital' && (
            <form onSubmit={handleHospitalSubmit} className="space-y-4">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Hospital Staff Email ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={hospitalAuth.email}
                      onChange={(e) => setHospitalAuth({ ...hospitalAuth, email: e.target.value })}
                      placeholder="e.g. staff@apollohospitals.org"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Workstation Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showHospitalPassword ? 'text' : 'password'}
                      required
                      value={hospitalAuth.password}
                      onChange={(e) => setHospitalAuth({ ...hospitalAuth, password: e.target.value })}
                      placeholder="Enter hospital portal password"
                      className="w-full pl-9 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowHospitalPassword(!showHospitalPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showHospitalPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Hospital Facility / Branch
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={hospitalAuth.hospitalName}
                      onChange={(e) => setHospitalAuth({ ...hospitalAuth, hospitalName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                    >
                      <option value="Apollo Multi-Specialty Hospital">Apollo Multi-Specialty Hospital (Main Campus)</option>
                      <option value="Fortis Memorial Research Institute">Fortis Memorial Research Institute</option>
                      <option value="Manipal Hospital">Manipal Hospital Bannerghatta</option>
                      <option value="Max Super Speciality Hospital">Max Super Speciality Hospital</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hospitalAuth.rememberMe}
                      onChange={(e) => setHospitalAuth({ ...hospitalAuth, rememberMe: e.target.checked })}
                      className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                    />
                    <span>Remember workstation</span>
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Firebase Authentication password recovery will be triggered here.');
                    }}
                    className="text-teal-700 hover:underline font-semibold"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 text-[11px] text-teal-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Hospital Staff Clearance:</span> Authenticated for patient admission, policy ID verification, itemized charges, and patient counseling view. (No TPA access).
                </div>
              </div>

              <button
                type="submit"
                disabled={hospitalAuthLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {hospitalAuthLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Hospital Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. INSURANCE COMPANY SECTION - ACTUAL AUTHENTICATION GATEWAY */}
          {selectedRole === 'insurer' && (
            <form onSubmit={handleInsurerSubmit} className="space-y-4">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Adjudication Officer Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={insurerAuth.email}
                      onChange={(e) => setInsurerAuth({ ...insurerAuth, email: e.target.value })}
                      placeholder="e.g. adjudicator@starhealth.in"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Payer Gateway Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showInsurerPassword ? 'text' : 'password'}
                      required
                      value={insurerAuth.password}
                      onChange={(e) => setInsurerAuth({ ...insurerAuth, password: e.target.value })}
                      placeholder="Enter insurance portal password"
                      className="w-full pl-9 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInsurerPassword(!showInsurerPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showInsurerPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Insurance Organization / TPA
                  </label>
                  <div className="relative">
                    <Shield className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={insurerAuth.company}
                      onChange={(e) => setInsurerAuth({ ...insurerAuth, company: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    >
                      <option value="Star Health & Allied Insurance">Star Health & Allied Insurance</option>
                      <option value="HDFC ERGO Health Insurance">HDFC ERGO Health Insurance</option>
                      <option value="Care Health Insurance">Care Health Insurance</option>
                      <option value="Niva Bupa Health Insurance">Niva Bupa Health Insurance</option>
                      <option value="ICICI Lombard General Insurance">ICICI Lombard General Insurance</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <label className="flex items-center space-x-2 text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={insurerAuth.rememberMe}
                      onChange={(e) => setInsurerAuth({ ...insurerAuth, rememberMe: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Remember terminal</span>
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Firebase Authentication password reset link will be sent to your payer administrator.');
                    }}
                    className="text-indigo-700 hover:underline font-semibold"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-[11px] text-indigo-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Payer Privileges:</span> Upload insurance policies with ID, manage rules, and issue pre-authorization acknowledgements.
                </div>
              </div>

              <button
                type="submit"
                disabled={insurerAuthLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {insurerAuthLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to Insurer & Payer Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-slate-400 border-t border-slate-200">
        MedPass AI Enterprise • Role-Based Healthcare Workflow Platform • Firebase Auth Compatible
      </footer>
    </div>
  );
};

