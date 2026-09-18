import React from 'react';
import {
  Activity, Shield, User, Database, Bot,
  Layers, ExternalLink, Zap
} from 'lucide-react';

interface HeaderProps {
  activePortal: 'hospital' | 'insurer' | 'patient' | 'trace';
  setActivePortal: (portal: 'hospital' | 'insurer' | 'patient' | 'trace') => void;
  onOpenMCP: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePortal,
  setActivePortal,
  onOpenMCP
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Track & Compliance Banner */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-x-auto">
          <span className="font-semibold text-white flex items-center">
            <Shield className="w-3.5 h-3.5 text-teal-400 mr-1" /> DSU DEVHACK TRACKS:
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-teal-300 border border-teal-500/30">
            GitHub Developer
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
            Beeceptor Mocking
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/30">
            Render Cloud Deploy
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-rose-300 border border-rose-500/30">
            n8n Automation
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 border border-blue-500/30">
            Trace Commons $100 Award
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-3 text-slate-400">
          <span className="flex items-center text-teal-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse mr-1.5"></span>
            SYSTEM DETERMINISTIC
          </span>
          <span className="text-slate-600">|</span>
          <span>FastAPI + DuckDB + Parquet</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xl tracking-tight text-slate-900">MedPass AI</span>
                <span className="text-slate-400 font-light">+</span>
                <span className="font-semibold text-lg text-teal-700">Trace Commons</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Healthcare Workflow & Governed Open-Data Platform</p>
            </div>
          </div>

          {/* Role / Portal Navigation */}
          <nav className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActivePortal('hospital')}
              className={`flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activePortal === 'hospital'
                  ? 'bg-white text-teal-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Activity className="w-4 h-4 mr-1.5 text-teal-600" />
              Hospital Portal
            </button>

            <button
              onClick={() => setActivePortal('insurer')}
              className={`flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activePortal === 'insurer'
                  ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Shield className="w-4 h-4 mr-1.5 text-indigo-600" />
              Insurer / TPA
            </button>

            <button
              onClick={() => setActivePortal('patient')}
              className={`flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activePortal === 'patient'
                  ? 'bg-white text-emerald-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <User className="w-4 h-4 mr-1.5 text-emerald-600" />
              Patient View
            </button>

            <button
              onClick={() => setActivePortal('trace')}
              className={`flex items-center px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activePortal === 'trace'
                  ? 'bg-white text-blue-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Database className="w-4 h-4 mr-1.5 text-blue-600" />
              Trace Commons
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">Data</span>
            </button>
          </nav>

          {/* AI Assistant MCP Trigger */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenMCP}
              className="flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-sm hover:from-teal-700 hover:to-teal-800 transition-all cursor-pointer"
            >
              <Bot className="w-4 h-4 mr-1.5" />
              Ask AI Agent (MCP)
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
