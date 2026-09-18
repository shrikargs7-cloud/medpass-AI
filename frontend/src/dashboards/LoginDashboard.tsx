import React, { useState, useEffect } from 'react';
import {
  Building2, User, Shield, ArrowRight, Activity, CheckCircle2,
  Lock, Search, ShieldCheck
} from 'lucide-react';
import { fetchCases } from '../api/client';
import { CaseDetail } from '../types';

interface LoginDashboardProps {
  onLoginHospital: (staffInfo: { name: string; role: string; hospital: string }) => void;
  onLoginPatient: (caseId: string, patientName: string) => void;
  onLoginInsurer: (insurerInfo: { name: string; role: string; company: string }) => void;
}

export const LoginDashboard: React.FC<LoginDashboardProps> = ({
  onLoginHospital,
  onLoginPatient,
  onLoginInsurer
}) => {
  const [selectedRole, setSelectedRole] = useState<'patient' | 'hospital' | 'insurer'>('hospital');
  
  // Hospital staff selection
  const [hospitalStaff, setHospitalStaff] = useState({
    name: 'Dr. Arvind Sharma',
    role: 'Chief Medical Officer & Billing Admin',
    hospital: 'Apollo Multi-Specialty Hospital'
  });

  // Insurer selection
  const [insurerStaff, setInsurerStaff] = useState({
    name: 'Rohit Mehta',
    role: 'Senior Adjudication Officer',
    company: 'Star Health & Allied Insurance'
  });

  // Patient selection
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [selectedPatientCaseId, setSelectedPatientCaseId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loadingCases, setLoadingCases] = useState<boolean>(true);

  useEffect(() => {
    fetchCases()
      .then((data) => {
        setCases(data);
        if (data.length > 0) {
          const defaultCase = data.find((c) => c.case_number.includes('ROOMCAP')) || data[0];
          setSelectedPatientCaseId(defaultCase.id);
        }
      })
      .catch((err) => console.error(err))
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

  const handleInsurerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginInsurer(insurerStaff);
  };

  const filteredCases = cases.filter((c) =>
    c.patient.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.case_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.primary_diagnosis_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <span className="text-[10px] px-2 py-0.2 rounded-md bg-teal-50 text-teal-800 font-bold uppercase">
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
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-10 flex flex-col justify-center">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Sign In to Portal
          </h1>
          <p className="text-xs text-slate-500 mt-1">Select your account domain to enter your dedicated view</p>

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
          {/* 1. PATIENT SECTION */}
          {selectedRole === 'patient' && (
            <form onSubmit={handlePatientSubmit} className="space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Select Patient Record
                </span>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name or case #..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {loadingCases ? (
                  <div className="py-6 text-center text-xs text-slate-400 font-mono">Loading...</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {filteredCases.map((c) => {
                      const isSelected = selectedPatientCaseId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedPatientCaseId(c.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-50/60 border-emerald-500 ring-1 ring-emerald-500'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                              <span>{c.patient.full_name}</span>
                              <span className="text-[10px] font-mono text-slate-400">{c.case_number}</span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {c.primary_diagnosis_name || 'Inpatient Admission'}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-[11px] text-emerald-900">
                🔒 Patient Access Only: View amount covered by insurance company and your out-of-pocket payable share.
              </div>

              <button
                type="submit"
                disabled={!selectedPatientCaseId}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>Enter Patient Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* 2. HOSPITAL SECTION */}
          {selectedRole === 'hospital' && (
            <form onSubmit={handleHospitalSubmit} className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Select Hospital Staff Profile
                </span>
                {[
                  {
                    name: 'Dr. Arvind Sharma',
                    role: 'Chief Medical Officer',
                    hospital: 'Apollo Multi-Specialty Hospital'
                  },
                  {
                    name: 'Priya Nair',
                    role: 'TPA & Billing Desk',
                    hospital: 'Apollo Multi-Specialty Hospital'
                  },
                  {
                    name: 'Dr. Rajesh Deshmukh',
                    role: 'Attending Surgeon',
                    hospital: 'Apollo Multi-Specialty Hospital'
                  }
                ].map((staff) => (
                  <div
                    key={staff.name}
                    onClick={() => setHospitalStaff(staff)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      hospitalStaff.name === staff.name
                        ? 'bg-teal-50/60 border-teal-500 ring-1 ring-teal-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{staff.name}</div>
                      <div className="text-[11px] text-slate-500">{staff.role} • {staff.hospital}</div>
                    </div>
                    {hospitalStaff.name === staff.name && (
                      <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 text-[11px] text-teal-900">
                🏥 Hospital Privileges: Full CRUD on cases, policy ID verification, line items, and counseling patient view. (No TPA access).
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>Enter Hospital Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* 3. INSURANCE COMPANY SECTION */}
          {selectedRole === 'insurer' && (
            <form onSubmit={handleInsurerSubmit} className="space-y-4">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Select Insurance Adjudication Officer
                </span>
                {[
                  {
                    name: 'Rohit Mehta',
                    role: 'Senior Adjudication Officer',
                    company: 'Star Health & Allied Insurance'
                  },
                  {
                    name: 'Neha Verma',
                    role: 'TPA Claims Manager',
                    company: 'HDFC ERGO Health Insurance'
                  },
                  {
                    name: 'Sunil Kulkarni',
                    role: 'Payer Network Reviewer',
                    company: 'Care Health Insurance'
                  }
                ].map((payer) => (
                  <div
                    key={payer.name}
                    onClick={() => setInsurerStaff(payer)}
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      insurerStaff.name === payer.name
                        ? 'bg-indigo-50/60 border-indigo-500 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{payer.name}</div>
                      <div className="text-[11px] text-slate-500">{payer.role} • {payer.company}</div>
                    </div>
                    {insurerStaff.name === payer.name && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-[11px] text-indigo-900">
                🛡️ Payer Privileges: Upload insurance policies with ID, manage rules, and issue pre-authorization acknowledgements.
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>Enter Insurer & Payer Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-slate-400 border-t border-slate-200">
        MedPass AI Enterprise • Role-Based Healthcare Workflow Platform
      </footer>
    </div>
  );
};
