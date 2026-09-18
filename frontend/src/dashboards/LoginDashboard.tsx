import React, { useState, useEffect } from 'react';
import {
  Building2, User, Shield, ArrowRight, Activity, CheckCircle2,
  Lock, ShieldCheck, Mail, Eye, EyeOff, Phone, Settings,
  AlertCircle, UserPlus, LogIn
} from 'lucide-react';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { fetchCases } from '../api/client';
import { CaseDetail } from '../types';

interface LoginDashboardProps {
  onLoginHospital: (staffInfo: { name: string; role: string; hospital: string }) => void;
  onLoginPatient: (caseId: string, patientName: string) => void;
  onLoginInsurer: (insurerInfo: { name: string; role: string; company: string }) => void;
  onLoginAdmin?: (adminInfo: { name: string; role: string }) => void;
}

export const LoginDashboard: React.FC<LoginDashboardProps> = ({
  onLoginHospital,
  onLoginPatient,
  onLoginInsurer,
  onLoginAdmin
}) => {
  const [selectedRole, setSelectedRole] = useState<'patient' | 'hospital' | 'insurer' | 'admin'>('patient');

  // Mode: First Sign Up, then Sign In!
  const [mode, setMode] = useState<'signup' | 'login'>('signup');

  // 1. Patient State (Pure credentials, NO OTP)
  const [patientForm, setPatientForm] = useState({
    fullName: '',
    phone: '+91',
    password: '',
    caseId: '',
    rememberMe: true
  });
  const [showPatientPassword, setShowPatientPassword] = useState(false);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [patientSuccess, setPatientSuccess] = useState<string | null>(null);

  // 2. Hospital State
  const [hospitalForm, setHospitalForm] = useState({
    fullName: '',
    email: '',
    password: '',
    hospitalName: 'Apollo Multi-Specialty Hospital',
    rememberMe: true
  });
  const [showHospitalPassword, setShowHospitalPassword] = useState(false);
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [hospitalSuccess, setHospitalSuccess] = useState<string | null>(null);

  // 3. Insurer State
  const [insurerForm, setInsurerForm] = useState({
    fullName: '',
    email: '',
    password: '',
    company: 'Star Health & Allied Insurance',
    rememberMe: true
  });
  const [showInsurerPassword, setShowInsurerPassword] = useState(false);
  const [insurerLoading, setInsurerLoading] = useState(false);
  const [insurerError, setInsurerError] = useState<string | null>(null);
  const [insurerSuccess, setInsurerSuccess] = useState<string | null>(null);

  // 4. Admin State
  const [adminAuth, setAdminAuth] = useState({
    email: 'admin@medpass.ai',
    password: 'password123',
    rememberMe: true
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Case list for patient record mapping
  const [cases, setCases] = useState<CaseDetail[]>([]);
  const [loadingCases, setLoadingCases] = useState<boolean>(true);

  // Initialize demo accounts in local registry if not present
  useEffect(() => {
    const initRegistry = () => {
      if (!localStorage.getItem('medpass_registered_patients')) {
        const defaultPatients = [
          { phone: '+919845012345', password: 'password123', name: 'Priya Sharma' },
          { phone: '+919876543210', password: 'password123', name: 'Vikram Rao' }
        ];
        localStorage.setItem('medpass_registered_patients', JSON.stringify(defaultPatients));
      }
      if (!localStorage.getItem('medpass_registered_users')) {
        const defaultStaff = [
          { email: 'arvind.sharma@apollohospitals.org', password: 'password123', name: 'Dr. Arvind Sharma', role: 'hospital' },
          { email: 'rohit.mehta@starhealth.in', password: 'password123', name: 'Rohit Mehta', role: 'insurer' }
        ];
        localStorage.setItem('medpass_registered_users', JSON.stringify(defaultStaff));
      }
    };
    initRegistry();

    fetchCases()
      .then((data) => {
        setCases(data);
        if (data.length > 0) {
          const defaultCase = data.find((c) => c.case_number.includes('ROOMCAP')) || data[0];
          setPatientForm((prev) => ({ ...prev, caseId: defaultCase.id }));
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingCases(false));
  }, []);

  // Helper: check patient credentials in registry
  const getRegisteredPatient = (phone: string) => {
    const rawList = localStorage.getItem('medpass_registered_patients');
    if (!rawList) return null;
    try {
      const list = JSON.parse(rawList);
      const cleanTarget = phone.replace(/[\s-]/g, '');
      return list.find((p: any) => p.phone.replace(/[\s-]/g, '') === cleanTarget) || null;
    } catch {
      return null;
    }
  };

  // Helper: register patient
  const registerPatientRecord = (phone: string, pass: string, name: string) => {
    const rawList = localStorage.getItem('medpass_registered_patients') || '[]';
    try {
      const list = JSON.parse(rawList);
      const cleanPhone = phone.replace(/[\s-]/g, '');
      const existingIdx = list.findIndex((p: any) => p.phone.replace(/[\s-]/g, '') === cleanPhone);
      if (existingIdx >= 0) {
        list[existingIdx] = { phone: cleanPhone, password: pass, name };
      } else {
        list.push({ phone: cleanPhone, password: pass, name });
      }
      localStorage.setItem('medpass_registered_patients', JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  // Helper: check user credentials in local registry
  const checkRegisteredUser = (email: string, pass: string, role: string) => {
    const raw = localStorage.getItem('medpass_registered_users');
    if (!raw) return null;
    try {
      const users = JSON.parse(raw);
      return users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.role === role);
    } catch {
      return null;
    }
  };

  // Helper: save registered user in local registry
  const saveRegisteredUser = (email: string, pass: string, name: string, role: string) => {
    const raw = localStorage.getItem('medpass_registered_users') || '[]';
    try {
      const users = JSON.parse(raw);
      users.push({ email, password: pass, name, role });
      localStorage.setItem('medpass_registered_users', JSON.stringify(users));
    } catch {
      // ignore
    }
  };

  // ========================================================
  // PATIENT: SIGN UP & SIGN IN (NO OTP)
  // ========================================================
  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatientLoading(true);
    setPatientError(null);
    setPatientSuccess(null);

    const rawPhone = patientForm.phone.trim();
    const cleanPhone = rawPhone.replace(/[\s-]/g, '');
    const password = patientForm.password;

    if (cleanPhone.length < 10) {
      setPatientError('Please enter a valid 10-digit mobile number with country code (e.g. +91 98450 12345).');
      setPatientLoading(false);
      return;
    }

    if (!password) {
      setPatientError('Please enter your account password / security PIN.');
      setPatientLoading(false);
      return;
    }

    const syntheticEmail = `${cleanPhone.replace('+', '')}@patient.medpass.ai`;

    if (mode === 'signup') {
      // SIGN UP MODE
      if (!patientForm.fullName.trim()) {
        setPatientError('Please enter your full name as per hospital records.');
        setPatientLoading(false);
        return;
      }
      if (password.length < 6) {
        setPatientError('Password must be at least 6 characters long.');
        setPatientLoading(false);
        return;
      }

      try {
        // Create in Firebase
        try {
          await createUserWithEmailAndPassword(auth, syntheticEmail, password);
        } catch (fbErr: any) {
          if (fbErr.code === 'auth/email-already-in-use') {
            setPatientError(`An account with mobile number ${cleanPhone} already exists. Please switch to Sign In.`);
            setPatientLoading(false);
            return;
          }
        }

        registerPatientRecord(cleanPhone, password, patientForm.fullName);
        localStorage.setItem('medpass_active_role', 'patient');
        localStorage.setItem('medpass_patient_phone', cleanPhone);

        const targetCaseId = patientForm.caseId || (cases[0] ? cases[0].id : '');
        onLoginPatient(targetCaseId, patientForm.fullName);
      } catch (err: any) {
        setPatientError(err.message || 'Patient registration failed. Please try again.');
      } finally {
        setPatientLoading(false);
      }
    } else {
      // SIGN IN MODE
      try {
        let authenticated = false;

        // Try Firebase Authentication
        try {
          await signInWithEmailAndPassword(auth, syntheticEmail, password);
          authenticated = true;
        } catch (fbErr: any) {
          // Check local registry
          const registered = getRegisteredPatient(cleanPhone);
          if (registered) {
            if (registered.password === password) {
              authenticated = true;
            } else {
              setPatientError('Incorrect password or security PIN. Please verify and try again.');
              setPatientLoading(false);
              return;
            }
          } else {
            setPatientError(`No account registered with ${cleanPhone}. Please switch to Sign Up to create an account.`);
            setPatientLoading(false);
            return;
          }
        }

        if (authenticated) {
          localStorage.setItem('medpass_active_role', 'patient');
          localStorage.setItem('medpass_patient_phone', cleanPhone);

          const registered = getRegisteredPatient(cleanPhone);
          const targetCaseId = patientForm.caseId || (cases[0] ? cases[0].id : '');
          const foundCase = cases.find((c) => c.id === targetCaseId);
          const patientName = registered?.name || foundCase?.patient?.full_name || 'Verified Patient';

          onLoginPatient(targetCaseId, patientName);
        }
      } catch (err: any) {
        setPatientError(err.message || 'Authentication error.');
      } finally {
        setPatientLoading(false);
      }
    }
  };

  // ========================================================
  // HOSPITAL: SIGN UP & SIGN IN
  // ========================================================
  const handleHospitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHospitalLoading(true);
    setHospitalError(null);
    setHospitalSuccess(null);

    const email = hospitalForm.email.trim();
    const password = hospitalForm.password;

    if (!email || !password) {
      setHospitalError('Please provide both email and password.');
      setHospitalLoading(false);
      return;
    }

    if (mode === 'signup') {
      if (!hospitalForm.fullName.trim()) {
        setHospitalError('Please enter your staff full name.');
        setHospitalLoading(false);
        return;
      }
      if (password.length < 6) {
        setHospitalError('Password must be at least 6 characters long.');
        setHospitalLoading(false);
        return;
      }

      try {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (fbErr: any) {
          if (fbErr.code === 'auth/email-already-in-use') {
            setHospitalError('An account with this email already exists. Please switch to Sign In.');
            setHospitalLoading(false);
            return;
          }
        }

        saveRegisteredUser(email, password, hospitalForm.fullName, 'hospital');
        localStorage.setItem('medpass_active_role', 'hospital');

        onLoginHospital({
          name: hospitalForm.fullName,
          role: 'Chief Medical Officer & Billing Admin',
          hospital: hospitalForm.hospitalName
        });
      } catch (err: any) {
        setHospitalError(err.message || 'Hospital registration failed.');
      } finally {
        setHospitalLoading(false);
      }
    } else {
      // SIGN IN MODE
      try {
        let authenticated = false;

        try {
          await signInWithEmailAndPassword(auth, email, password);
          authenticated = true;
        } catch (fbErr: any) {
          const localUser = checkRegisteredUser(email, password, 'hospital');
          if (localUser) {
            if (localUser.password === password) {
              authenticated = true;
            } else {
              setHospitalError('Incorrect password. Please verify your workstation credentials.');
              setHospitalLoading(false);
              return;
            }
          } else {
            if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential') {
              setHospitalError('Account not found with this email. Please sign up first.');
              setHospitalLoading(false);
              return;
            } else if (fbErr.code === 'auth/wrong-password') {
              setHospitalError('Incorrect password entered. Please try again.');
              setHospitalLoading(false);
              return;
            } else {
              setHospitalError('Invalid email or password. Please sign up if you do not have an account.');
              setHospitalLoading(false);
              return;
            }
          }
        }

        if (authenticated) {
          localStorage.setItem('medpass_active_role', 'hospital');
          const emailPrefix = email.split('@')[0] || 'Hospital Staff';
          const formattedName = emailPrefix
            .split(/[._-]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

          onLoginHospital({
            name: formattedName.toLowerCase().includes('admin') || formattedName.toLowerCase().includes('staff')
              ? 'Dr. Arvind Sharma'
              : formattedName,
            role: 'Chief Medical Officer & Billing Admin',
            hospital: hospitalForm.hospitalName
          });
        }
      } catch (err: any) {
        setHospitalError(err.message || 'Sign in failed.');
      } finally {
        setHospitalLoading(false);
      }
    }
  };

  // ========================================================
  // INSURER: SIGN UP & SIGN IN
  // ========================================================
  const handleInsurerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInsurerLoading(true);
    setInsurerError(null);
    setInsurerSuccess(null);

    const email = insurerForm.email.trim();
    const password = insurerForm.password;

    if (!email || !password) {
      setInsurerError('Please provide work email and password.');
      setInsurerLoading(false);
      return;
    }

    if (mode === 'signup') {
      if (!insurerForm.fullName.trim()) {
        setInsurerError('Please enter your officer full name.');
        setInsurerLoading(false);
        return;
      }
      if (password.length < 6) {
        setInsurerError('Password must be at least 6 characters long.');
        setInsurerLoading(false);
        return;
      }

      try {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (fbErr: any) {
          if (fbErr.code === 'auth/email-already-in-use') {
            setInsurerError('An account with this email already exists. Please switch to Sign In.');
            setInsurerLoading(false);
            return;
          }
        }

        saveRegisteredUser(email, password, insurerForm.fullName, 'insurer');
        localStorage.setItem('medpass_active_role', 'insurer');

        onLoginInsurer({
          name: insurerForm.fullName,
          role: 'Senior Adjudication Officer',
          company: insurerForm.company
        });
      } catch (err: any) {
        setInsurerError(err.message || 'Insurer registration failed.');
      } finally {
        setInsurerLoading(false);
      }
    } else {
      // SIGN IN MODE
      try {
        let authenticated = false;

        try {
          await signInWithEmailAndPassword(auth, email, password);
          authenticated = true;
        } catch (fbErr: any) {
          const localUser = checkRegisteredUser(email, password, 'insurer');
          if (localUser) {
            if (localUser.password === password) {
              authenticated = true;
            } else {
              setInsurerError('Incorrect password. Please verify your payer gateway credentials.');
              setInsurerLoading(false);
              return;
            }
          } else {
            if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential') {
              setInsurerError('Account not found with this work email. Please sign up first.');
              setInsurerLoading(false);
              return;
            } else if (fbErr.code === 'auth/wrong-password') {
              setInsurerError('Incorrect password entered. Please try again.');
              setInsurerLoading(false);
              return;
            } else {
              setInsurerError('Invalid payer credentials. Please check your details or sign up.');
              setInsurerLoading(false);
              return;
            }
          }
        }

        if (authenticated) {
          localStorage.setItem('medpass_active_role', 'insurer');
          const emailPrefix = email.split('@')[0] || 'Adjudication Officer';
          const formattedName = emailPrefix
            .split(/[._-]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

          onLoginInsurer({
            name: formattedName.toLowerCase().includes('adjudicat') ? 'Rohit Mehta' : formattedName,
            role: 'Senior Adjudication Officer',
            company: insurerForm.company
          });
        }
      } catch (err: any) {
        setInsurerError(err.message || 'Payer gateway sign in failed.');
      } finally {
        setInsurerLoading(false);
      }
    }
  };

  // ========================================================
  // ADMIN: SIGN IN
  // ========================================================
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError(null);

    const email = adminAuth.email.trim();
    const password = adminAuth.password;

    if (email !== 'admin@medpass.ai' || password !== 'password123') {
      setAdminError('Access denied: Invalid administrator credentials. (Default: admin@medpass.ai / password123)');
      setAdminLoading(false);
      return;
    }

    try {
      localStorage.setItem('medpass_active_role', 'admin');
      if (onLoginAdmin) {
        onLoginAdmin({
          name: 'System Administrator',
          role: 'admin'
        });
      }
    } catch (err: any) {
      setAdminError(err.message || 'Admin authentication failed.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRoleChange = (role: 'patient' | 'hospital' | 'insurer' | 'admin') => {
    setSelectedRole(role);
    setPatientError(null);
    setHospitalError(null);
    setInsurerError(null);
    setAdminError(null);
    setPatientSuccess(null);
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
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold uppercase font-mono">
              Enterprise
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-Bit Encrypted Portal</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8 flex flex-col justify-center">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {mode === 'signup' ? 'Create Your Account' : 'Sign In to Portal'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'signup'
              ? 'First time user? Please register your details below'
              : 'Enter your verified credentials to access your dashboard'}
          </p>

          {/* 4-Way Role Switcher */}
          <div className="mt-4 inline-flex p-1 rounded-xl bg-slate-200/80 border border-slate-300/80 max-w-full overflow-x-auto">
            {/* 1. Patient */}
            <button
              type="button"
              onClick={() => handleRoleChange('patient')}
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
              onClick={() => handleRoleChange('hospital')}
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
              onClick={() => handleRoleChange('insurer')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'insurer'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Insurer</span>
            </button>

            {/* 4. Admin */}
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-purple-600" />
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Dynamic Card for Selected Role */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          
          {/* Sign Up vs Sign In Tab Toggle */}
          {selectedRole !== 'admin' && (
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mb-5">
              <button
                type="button"
                onClick={() => { setMode('signup'); setPatientError(null); setHospitalError(null); setInsurerError(null); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-teal-600" />
                <span>1. Sign Up First</span>
              </button>

              <button
                type="button"
                onClick={() => { setMode('login'); setPatientError(null); setHospitalError(null); setInsurerError(null); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Sign In</span>
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* 1. PATIENT: DIRECT CREDENTIAL SIGN UP & SIGN IN (NO OTP) */}
          {/* ======================================================== */}
          {selectedRole === 'patient' && (
            <form onSubmit={handlePatientSubmit} className="space-y-4">
              {patientError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{patientError}</span>
                </div>
              )}
              {patientSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{patientSuccess}</span>
                </div>
              )}

              <div className="space-y-3.5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Full Name (as per Hospital Records)
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={patientForm.fullName}
                        onChange={(e) => setPatientForm({ ...patientForm, fullName: e.target.value })}
                        placeholder="e.g. Priya Sharma"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {mode === 'signup' ? 'Mobile Number to Register' : 'Registered Mobile Number'}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={patientForm.phone}
                      onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                      placeholder="+91 98450 12345"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {mode === 'signup' ? 'Create Password / Security PIN' : 'Password / Security PIN'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showPatientPassword ? 'text' : 'password'}
                      required
                      value={patientForm.password}
                      onChange={(e) => setPatientForm({ ...patientForm, password: e.target.value })}
                      placeholder={mode === 'signup' ? 'Create a secure password (min 6 chars)' : 'Enter your password or PIN'}
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
                    Linked Hospital Admission
                  </label>
                  <div className="relative">
                    <Activity className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <select
                      value={patientForm.caseId}
                      onChange={(e) => setPatientForm({ ...patientForm, caseId: e.target.value })}
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

                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Patient Portal Access:</span> Check cashless authorization, itemized bills, and approved coverage in real-time.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={patientLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {patientLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>{mode === 'signup' ? 'Create Patient Account' : 'Sign In to Patient Portal'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* 2. HOSPITAL: SIGN UP & SIGN IN */}
          {/* ======================================================== */}
          {selectedRole === 'hospital' && (
            <form onSubmit={handleHospitalSubmit} className="space-y-4">
              {hospitalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{hospitalError}</span>
                </div>
              )}
              {hospitalSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{hospitalSuccess}</span>
                </div>
              )}

              <div className="space-y-3.5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Staff Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={hospitalForm.fullName}
                        onChange={(e) => setHospitalForm({ ...hospitalForm, fullName: e.target.value })}
                        placeholder="e.g. Dr. Arvind Sharma"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Hospital Work Email ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={hospitalForm.email}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, email: e.target.value })}
                      placeholder="e.g. arvind.sharma@apollohospitals.org"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {mode === 'signup' ? 'Create Password (min 6 chars)' : 'Workstation Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showHospitalPassword ? 'text' : 'password'}
                      required
                      value={hospitalForm.password}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, password: e.target.value })}
                      placeholder="Enter password"
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
                      value={hospitalForm.hospitalName}
                      onChange={(e) => setHospitalForm({ ...hospitalForm, hospitalName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                    >
                      <option value="Apollo Multi-Specialty Hospital">Apollo Multi-Specialty Hospital (Main Campus)</option>
                      <option value="Fortis Memorial Research Institute">Fortis Memorial Research Institute</option>
                      <option value="Manipal Hospital">Manipal Hospital Bannerghatta</option>
                      <option value="Max Super Speciality Hospital">Max Super Speciality Hospital</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={hospitalLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {hospitalLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>{mode === 'signup' ? 'Create Hospital Account' : 'Sign In to Hospital Console'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* 3. INSURER: SIGN UP & SIGN IN */}
          {/* ======================================================== */}
          {selectedRole === 'insurer' && (
            <form onSubmit={handleInsurerSubmit} className="space-y-4">
              {insurerError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{insurerError}</span>
                </div>
              )}
              {insurerSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{insurerSuccess}</span>
                </div>
              )}

              <div className="space-y-3.5">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Officer Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={insurerForm.fullName}
                        onChange={(e) => setInsurerForm({ ...insurerForm, fullName: e.target.value })}
                        placeholder="e.g. Rohit Mehta"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Adjudication Officer Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={insurerForm.email}
                      onChange={(e) => setInsurerForm({ ...insurerForm, email: e.target.value })}
                      placeholder="e.g. rohit.mehta@starhealth.in"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {mode === 'signup' ? 'Create Password (min 6 chars)' : 'Payer Gateway Password'}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showInsurerPassword ? 'text' : 'password'}
                      required
                      value={insurerForm.password}
                      onChange={(e) => setInsurerForm({ ...insurerForm, password: e.target.value })}
                      placeholder="Enter password"
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
                      value={insurerForm.company}
                      onChange={(e) => setInsurerForm({ ...insurerForm, company: e.target.value })}
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
              </div>

              <button
                type="submit"
                disabled={insurerLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {insurerLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>{mode === 'signup' ? 'Create Insurer Account' : 'Sign In to Insurer Portal'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ======================================================== */}
          {/* 4. ADMIN: MASTER SIGN IN */}
          {/* ======================================================== */}
          {selectedRole === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              {adminError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminError}</span>
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Administrator Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={adminAuth.email}
                      onChange={(e) => setAdminAuth({ ...adminAuth, email: e.target.value })}
                      placeholder="admin@medpass.ai"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Master Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      value={adminAuth.password}
                      onChange={(e) => setAdminAuth({ ...adminAuth, password: e.target.value })}
                      placeholder="Enter administrator password"
                      className="w-full pl-9 pr-9 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200/80 text-[11px] text-purple-900 flex items-start space-x-2">
                  <Settings className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Admin Console Access:</span> Houses N8N automation workflows, real-time SMS broadcasts, and user controls.
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {adminLoading ? (
                  <span>Authenticating Admin...</span>
                ) : (
                  <>
                    <span>Enter Admin Console</span>
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
      </footer>
    </div>
  );
};

export default LoginDashboard;
