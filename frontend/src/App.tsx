import React, { useState } from 'react';
import { Header } from './components/Header';
import { MCPAgentDrawer } from './components/MCPAgentDrawer';
import { LoginDashboard } from './dashboards/LoginDashboard';
import { HospitalDashboard } from './dashboards/HospitalDashboard';
import { InsurerDashboard } from './dashboards/InsurerDashboard';
import { PatientDashboard } from './dashboards/PatientDashboard';
import { AdminDashboard } from './pages/Admin/AdminDashboard';

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

  // Admin dashboard (separate full-page UI)
  if (userSession && userSession.role === 'admin') {
    return (
      <AdminDashboard
        onLogout={() => setUserSession(null)}
        userName={userSession.name}
      />
    );
  }

  // If no user is logged in, show the Login Gateway
  if (!userSession) {
    return (
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
      </main>

      {/* Floating Chatbot Launcher Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setIsMCPOpen(true)}
          className="group flex items-center space-x-2.5 px-4 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full shadow-lg shadow-teal-700/20 transition-all hover:scale-105 cursor-pointer"
          title="Open MedPass AI Healthcare Assistant"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
          </span>
          <span className="text-xs font-bold tracking-tight">MedPass AI Assistant</span>
        </button>
      </div>

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
