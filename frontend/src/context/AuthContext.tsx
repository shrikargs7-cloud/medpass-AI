import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  User
} from 'firebase/auth';

export type UserRole = 'patient' | 'hospital' | 'insurer' | 'admin';

interface AuthUser {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  role: UserRole;
}

interface AuthContextType {
  user: AuthUser | null;
  firebaseUser: User | null;
  loading: boolean;
  error: string | null;
  loginWithEmail: (email: string, password: string, role: UserRole) => Promise<void>;
  sendOtp: (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  verifyOtp: (confirmationResult: ConfirmationResult, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        // Retrieve role from localStorage (set during login)
        const storedRole = localStorage.getItem(`medpass_role_${fbUser.uid}`) as UserRole || 'patient';
        setUser({
          uid: fbUser.uid,
          email: fbUser.email,
          phone: fbUser.phoneNumber,
          displayName: fbUser.displayName,
          role: storedRole,
        });
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string, role: UserRole) => {
    try {
      setError(null);
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem(`medpass_role_${cred.user.uid}`, role);
      setUser({
        uid: cred.user.uid,
        email: cred.user.email,
        phone: cred.user.phoneNumber,
        displayName: cred.user.displayName,
        role,
      });
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier): Promise<ConfirmationResult> => {
    try {
      setError(null);
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return confirmation;
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
      throw err;
    }
  };

  const verifyOtp = async (confirmationResult: ConfirmationResult, otp: string) => {
    try {
      setError(null);
      setLoading(true);
      const cred = await confirmationResult.confirm(otp);
      localStorage.setItem(`medpass_role_${cred.user.uid}`, 'patient');
      setUser({
        uid: cred.user.uid,
        email: cred.user.email,
        phone: cred.user.phoneNumber,
        displayName: cred.user.displayName,
        role: 'patient',
      });
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, error, loginWithEmail, sendOtp, verifyOtp, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};
