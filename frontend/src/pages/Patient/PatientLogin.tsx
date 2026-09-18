import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../../firebase';
import { RecaptchaVerifier, ConfirmationResult, signInWithPhoneNumber } from 'firebase/auth';
import { Activity, Phone, Lock, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';

interface PatientLoginProps {
  onLoginSuccess: (uid: string, phone: string) => void;
  onBack: () => void;
}

export const PatientLogin: React.FC<PatientLoginProps> = ({ onLoginSuccess, onBack }) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const setupRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
    }
    recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {},
    });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 13) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current!);
      setConfirmationResult(confirmation);
      setStep('otp');
      setCountdown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      console.error('OTP send error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const cred = await confirmationResult!.confirm(otpCode);
      onLoginSuccess(cred.user.uid, cred.user.phoneNumber || phoneNumber);
    } catch (err: any) {
      console.error('OTP verify error:', err);
      setError('Invalid OTP. Please check and try again.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    try {
      setLoading(true);
      setError(null);
      setupRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifierRef.current!);
      setConfirmationResult(confirmation);
      setCountdown(30);
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg text-slate-900 tracking-tight">MedPass AI</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold uppercase font-mono">Patient</span>
          </div>
          <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 font-semibold cursor-pointer">← Back to Portal Select</button>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <Phone className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {step === 'phone' ? 'Patient Login' : 'Verify OTP'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {step === 'phone'
              ? 'Enter your registered mobile number to receive OTP'
              : `We sent a 6-digit code to ${phoneNumber}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Registered Mobile Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                    maxLength={13}
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Secure OTP Login:</span> A 6-digit code will be sent via SMS to verify your identity.
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {loading ? <span>Sending OTP...</span> : <><span>Send OTP</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-3 text-center">Enter 6-Digit Verification Code</label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-12 text-center text-lg font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center text-xs text-slate-500">
                {countdown > 0 ? (
                  <span>Resend OTP in {countdown}s</span>
                ) : (
                  <button type="button" onClick={handleResendOtp} className="flex items-center space-x-1 text-emerald-700 hover:underline font-semibold cursor-pointer">
                    <RefreshCw className="w-3 h-3" />
                    <span>Resend OTP</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otp.join('').length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                {loading ? <span>Verifying...</span> : <><CheckCircle2 className="w-4 h-4" /><span>Verify & Sign In</span></>}
              </button>
            </form>
          )}
        </div>

        <div id="recaptcha-container" ref={recaptchaContainerRef}></div>
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-400 border-t border-slate-200">
        MedPass AI Enterprise • OTP Secured Patient Portal • Firebase Phone Auth
      </footer>
    </div>
  );
};
