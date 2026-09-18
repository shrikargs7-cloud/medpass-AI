import React, { useState, lazy, Suspense } from 'react';
import { Header } from './components/Header';
import { MCPAgentDrawer } from './components/MCPAgentDrawer';
import { Activity } from 'lucide-react';

const LoginDashboard = lazy(() => import('./dashboards/LoginDashboard').then(m => ({ default: m.LoginDashboard })));
const HospitalDashboard = lazy(() => import('./dashboards/HospitalDashboard').then(m => ({ default: m.HospitalDashboard })));
const InsurerDashboard = lazy(() => import('./dashboards/InsurerDashboard').then(m => ({ default: m.InsurerDashboard })));
const PatientDashboard = lazy(() => import('./dashboards/PatientDashboard').then(m => ({ default: m.PatientDashboard })));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));

interface UserSession {
  role: 'hospital' | 'patient' | 'insurer' | 'admin';
  name: string;
  subtitle?: string;
}

export function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activePortal, setActivePortal] = useState<'hospital' | 'insurer' | 'patient'>('hospital');
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined);
  const [isMCPOpen, setIsMCPOpen] = useState<boolean>(false);

  const LoadingFallback = () => (
    <div className="min-h-[400px] flex items-center justify-center space-x-2 text-slate-500 text-sm font-semibold">
      <Activity className="w-5 h-5 text-teal-600 animate-spin" />
      <span>Loading MedPass Suite...</span>
    </div>
  );

  // Admin dashboard (separate full-page UI)
  if (userSession && userSession.role === 'admin') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AdminDashboard
          onLogout={() => setUserSession(null)}
          userName={userSession.name}
        />
      </Suspense>
    );
  }

  // If no user is logged in, show the Login Gateway
  if (!userSession) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LoginDashboard
          onLoginHospital={(staff) => {
            setUserSession({
              role: 'hospital',
              name: staff.name,
              subtitle: `${staff.role} • ${staff.hospital}`
            });
            setActivePortal('hospital');
          }}
          onLoginPatient={(caseId, patientName) => {
            setUserSession({
              role: 'patient',
              name: patientName,
              subtitle: 'Patient & Beneficiary'
            });
            setSelectedCaseId(caseId);
            setActivePortal('patient');
          }}
          onLoginInsurer={(insurer) => {
            setUserSession({
              role: 'insurer',
              name: insurer.name,
              subtitle: `${insurer.role} • ${insurer.company}`
            });
            setActivePortal('insurer');
          }}
          onLoginAdmin={(admin) => {
            setUserSession({
              role: 'admin',
              name: admin.name,
              subtitle: 'System & Platform Administrator'
            });
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navigation Header */}
      <Header
        activePortal={activePortal}
        setActivePortal={setActivePortal}
        onOpenMCP={() => setIsMCPOpen(true)}
        onOpenInfographics={() => {}}
        userSession={userSession}
        onLogout={() => setUserSession(null)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={<LoadingFallback />}>
          {activePortal === 'hospital' && (
            <HospitalDashboard
              onSelectCase={(id) => setSelectedCaseId(id)}
              selectedCaseId={selectedCaseId}
            />
          )}

          {activePortal === 'insurer' && (
            <InsurerDashboard />
          )}

          {activePortal === 'patient' && (
            <PatientDashboard
              selectedCaseId={selectedCaseId}
              onLogout={() => setUserSession(null)}
            />
          )}
        </Suspense>
      </main>

      {/* AI Agent (MCP) Slide-over Drawer */}
      <MCPAgentDrawer
        isOpen={isMCPOpen}
        onClose={() => setIsMCPOpen(false)}
        currentCaseId={selectedCaseId}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
      </footer>
    </div>
  );
}

export default App;
