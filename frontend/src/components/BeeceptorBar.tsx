import React, { useState } from 'react';
import { Network, Zap, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { triggerN8NWebhook } from '../api/client';

interface BeeceptorBarProps {
  selectedScenario: string;
  setSelectedScenario: (scenario: string) => void;
}

export const BeeceptorBar: React.FC<BeeceptorBarProps> = ({
  selectedScenario,
  setSelectedScenario
}) => {
  const [n8nStatus, setN8nStatus] = useState<string | null>(null);
  const [loadingN8N, setLoadingN8N] = useState(false);

  const handleTriggerN8N = async () => {
    try {
      setLoadingN8N(true);
      const res = await triggerN8NWebhook('DEMO_LIFECYCLE_TRANSITION');
      setN8nStatus('Dispatched (200 OK)');
      setTimeout(() => setN8nStatus(null), 4000);
    } catch (err) {
      setN8nStatus('Triggered non-blocking');
      setTimeout(() => setN8nStatus(null), 4000);
    } finally {
      setLoadingN8N(false);
    }
  };

  return (
    <div className="bg-amber-50/70 border-b border-amber-200/80 px-4 py-2 text-xs text-amber-950">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="flex items-center font-bold uppercase tracking-wider text-[11px] bg-amber-200/70 px-2 py-0.5 rounded text-amber-900">
            <Network className="w-3.5 h-3.5 mr-1" /> Beeceptor Mock Track
          </span>
          <span className="text-slate-600 hidden sm:inline">Payer Preauth Gateway Scenario:</span>
        </div>

        {/* Scenario Selection Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedScenario('SUCCESS')}
            className={`flex items-center px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedScenario === 'SUCCESS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-300" />
            202 Approved
          </button>

          <button
            onClick={() => setSelectedScenario('QUERY')}
            className={`flex items-center px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedScenario === 'QUERY'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-300" />
            200 Query
          </button>

          <button
            onClick={() => setSelectedScenario('REJECTION')}
            className={`flex items-center px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedScenario === 'REJECTION'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-300" />
            200 Rejected
          </button>

          <button
            onClick={() => setSelectedScenario('TIMEOUT')}
            className={`flex items-center px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedScenario === 'TIMEOUT'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 mr-1 text-purple-300" />
            504 Timeout
          </button>

          <button
            onClick={() => setSelectedScenario('500')}
            className={`flex items-center px-2.5 py-1 rounded-md font-medium transition-all ${
              selectedScenario === '500'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            500 Error
          </button>
        </div>

        {/* n8n Webhook Test Button */}
        <div className="flex items-center space-x-2">
          <span className="font-bold text-[11px] uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-300">
            n8n Automation Track
          </span>
          <button
            onClick={handleTriggerN8N}
            disabled={loadingN8N}
            className="flex items-center px-2.5 py-1 rounded-md font-medium bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 mr-1 text-rose-500" />
            {loadingN8N ? 'Dispatching...' : 'Fire Webhook'}
          </button>
          {n8nStatus && (
            <span className="text-emerald-700 font-semibold text-[11px] animate-fade-in">
              ✓ {n8nStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
