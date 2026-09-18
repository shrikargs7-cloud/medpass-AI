import React, { useState } from 'react';
import { Header } from './components/Header';
import { BeeceptorBar } from './components/BeeceptorBar';
import { MCPAgentDrawer } from './components/MCPAgentDrawer';
import { LoginDashboard } from './dashboards/LoginDashboard';
import { HospitalDashboard } from './dashboards/HospitalDashboard';
import { InsurerDashboard } from './dashboards/InsurerDashboard';
import { PatientDashboard } from './dashboards/PatientDashboard';
import { TraceCommonsDashboard } from './dashboards/TraceCommonsDashboard';
import { PitchBlueprintModal } from './components/PitchBlueprintModal';

interface UserSession {
  role: 'hospital' | 'patient' | 'insurer' | 'trace';
  name: string;
  subtitle?: string;
}

export function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activePortal, setActivePortal] = useState<'hospital' | 'insurer' | 'patient' | 'trace'>('hospital');
  const [selectedScenario, setSelectedScenario] = useState<string>('SUCCESS');
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined);
  const [isMCPOpen, setIsMCPOpen] = useState<boolean>(false);
  const [isPitchOpen, setIsPitchOpen] = useState<boolean>(false);

  // If no user is logged in, show the initial enterprise Login Gateway
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
        onOpenPitch={() => setIsPitchOpen(true)}
        userSession={userSession}
        onLogout={() => setUserSession(null)}
      />

      {/* Payer Gateway Simulation & Event Webhook Bar (Only visible in Hospital / Insurer views) */}
      {(activePortal === 'hospital' || activePortal === 'insurer') && (
        <BeeceptorBar
          selectedScenario={selectedScenario}
          setSelectedScenario={setSelectedScenario}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activePortal === 'hospital' && (
          <HospitalDashboard
            onSelectCase={(id) => setSelectedCaseId(id)}
            selectedCaseId={selectedCaseId}
            beeceptorScenario={selectedScenario}
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

        {activePortal === 'trace' && (
          <TraceCommonsDashboard />
        )}
      </main>

      {/* AI Agent (MCP) Slide-over Drawer */}
      <MCPAgentDrawer
        isOpen={isMCPOpen}
        onClose={() => setIsMCPOpen(false)}
        currentCaseId={selectedCaseId}
      />

      {/* Pitch & Architecture Blueprint Modal */}
      <PitchBlueprintModal
        isOpen={isPitchOpen}
        onClose={() => setIsPitchOpen(false)}
      />

      {/* Professional Enterprise Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>MedPass AI Enterprise Healthcare Platform • Hospital & Payer Automation Suite</span>
          <span className="font-mono text-slate-400">IRDAI Cashless Everywhere • ABDM FHIR Standards • 256-Bit Encrypted</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
