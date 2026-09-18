import React from 'react';
import {
  Activity, Shield, User, Database, Bot,
  Layers, LogOut, CheckCircle2, Lock, Workflow
} from 'lucide-react';

interface HeaderProps {
  activePortal: 'hospital' | 'insurer' | 'patient' | 'trace';
  setActivePortal: (portal: 'hospital' | 'insurer' | 'patient' | 'trace') => void;
  onOpenMCP: () => void;
  onOpenInfographics: () => void;
  userSession?: { role: string; name: string; subtitle?: string } | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePortal,
  setActivePortal,
  onOpenMCP,
  onOpenInfographics,
  userSession,
  onLogout
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs font-sans">
      {/* Top Enterprise Compliance & Gateway Status Banner */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-x-auto">
          <span className="font-semibold text-white flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 mr-1.5" />
            MedPass Enterprise Health Suite v2.4
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-teal-500/30 text-[11px]">
            National Health Exchange (NHCX): Connected
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-emerald-500/30 text-[11px]">
            IRDAI 1h Preauth SLA Active
          </span>
        </div>

        <div className="hidden md:flex items-center space-x-3 text-slate-400 text-xs">
          <span className="flex items-center text-teal-400 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse mr-1.5"></span>
            256-Bit HIPAA / ABDM Compliant
          </span>
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
                <span className="font-extrabold text-xl tracking-tight text-slate-900">MedPass AI</span>
                <span className="text-slate-400 font-light">+</span>
                <span className="font-semibold text-lg text-teal-700">Trace Commons</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Healthcare Hospital & Insurance Workflow Suite</p>
            </div>
          </div>

          {/* Role / Portal Navigation */}
          <nav className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActivePortal('hospital')}
              className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
              className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
              className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
              className={`flex items-center px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activePortal === 'trace'
                  ? 'bg-white text-blue-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Database className="w-4 h-4 mr-1.5 text-blue-600" />
              Trace Commons
            </button>
          </nav>

          {/* User Session & Utility Buttons */}
          <div className="flex items-center space-x-2.5">
            {userSession && (
              <div className="hidden xl:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <div className="text-left">
                  <div className="font-bold text-slate-800 text-[11px] leading-tight">{userSession.name}</div>
                  <div className="text-[10px] text-slate-500 leading-tight">{userSession.subtitle || userSession.role}</div>
                </div>
              </div>
            )}

            <button
              onClick={onOpenInfographics}
              className="flex items-center px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer"
            >
              <Workflow className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
              Workflow & n8n
            </button>

            <button
              onClick={onOpenMCP}
              className="flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-sm hover:from-teal-700 hover:to-teal-800 transition-all cursor-pointer"
            >
              <Bot className="w-4 h-4 mr-1.5" />
              AI Agent (MCP)
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                title="Switch role or log out"
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
