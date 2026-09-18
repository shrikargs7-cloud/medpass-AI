import React, { useState } from 'react';
import { Header } from './components/Header';
import { BeeceptorBar } from './components/BeeceptorBar';
import { MCPAgentDrawer } from './components/MCPAgentDrawer';
import { HospitalDashboard } from './dashboards/HospitalDashboard';
import { InsurerDashboard } from './dashboards/InsurerDashboard';
import { PatientDashboard } from './dashboards/PatientDashboard';
import { TraceCommonsDashboard } from './dashboards/TraceCommonsDashboard';

import { PitchBlueprintModal } from './components/PitchBlueprintModal';

export function App() {
  const [activePortal, setActivePortal] = useState<'hospital' | 'insurer' | 'patient' | 'trace'>('hospital');
  const [selectedScenario, setSelectedScenario] = useState<string>('SUCCESS');
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined);
  const [isMCPOpen, setIsMCPOpen] = useState<boolean>(false);
  const [isPitchOpen, setIsPitchOpen] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navigation Header */}
      <Header
        activePortal={activePortal}
        setActivePortal={setActivePortal}
        onOpenMCP={() => setIsMCPOpen(true)}
        onOpenPitch={() => setIsPitchOpen(true)}
      />

      {/* Beeceptor & n8n Simulation Controller Bar */}
      <BeeceptorBar
        selectedScenario={selectedScenario}
        setSelectedScenario={setSelectedScenario}
      />

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
          <PatientDashboard selectedCaseId={selectedCaseId} />
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>MedPass AI + Trace Commons • Team THE X (RV University) • DSU DEVHACK 3.0</span>
          <span className="font-mono text-slate-400">IRDAI 1h Preauth & 3h Discharge • DuckDB Analytics</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
