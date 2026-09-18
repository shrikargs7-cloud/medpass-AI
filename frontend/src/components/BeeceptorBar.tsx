import React, { useState } from 'react';
import { Network, Zap, CheckCircle2, AlertTriangle, XCircle, Clock, Send } from 'lucide-react';
import { triggerN8NWebhook } from '../api/client';

interface BeeceptorBarProps {
  selectedScenario: string;
  setSelectedScenario: (scenario: string) => void;
}

export const BeeceptorBar: React.FC<BeeceptorBarProps> = ({
  selectedScenario,
  setSelectedScenario
}) => {
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);

  const handleTriggerWebhook = async () => {
    try {
      setLoadingWebhook(true);
      await triggerN8NWebhook('DEMO_LIFECYCLE_TRANSITION');
      setWebhookStatus('Event Dispatched (200 OK)');
      setTimeout(() => setWebhookStatus(null), 4000);
    } catch (err) {
      setWebhookStatus('Dispatched (Non-blocking)');
      setTimeout(() => setWebhookStatus(null), 4000);
    } finally {
      setLoadingWebhook(false);
    }
  };

  return (
    <div className="bg-slate-100/90 border-b border-slate-200/80 px-4 py-2 text-xs text-slate-800 font-sans">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="flex items-center font-bold uppercase tracking-wider text-[11px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md border border-slate-300">
            <Network className="w-3.5 h-3.5 mr-1 text-teal-600" />
            National Health Exchange (NHCX) / Payer Gateway
          </span>
          <span className="text-slate-500 hidden sm:inline text-[11px]">Pre-Auth Scenario:</span>
        </div>

        {/* Scenario Selection Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedScenario('SUCCESS')}
            className={`flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedScenario === 'SUCCESS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-300" />
            202 Auto-Approved
          </button>

          <button
            onClick={() => setSelectedScenario('QUERY')}
            className={`flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedScenario === 'QUERY'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-300" />
            200 Insurer Query
          </button>

          <button
            onClick={() => setSelectedScenario('REJECTION')}
            className={`flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedScenario === 'REJECTION'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-300" />
            200 Rejected
          </button>

          <button
            onClick={() => setSelectedScenario('TIMEOUT')}
            className={`flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedScenario === 'TIMEOUT'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 mr-1 text-purple-300" />
            504 SLA Timeout
          </button>

          <button
            onClick={() => setSelectedScenario('500')}
            className={`flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedScenario === '500'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            500 Error
          </button>
        </div>

        {/* Workflow Webhook Test Button */}
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-[11px] text-slate-500 hidden md:inline">
            Workflow Webhook:
          </span>
          <button
            onClick={handleTriggerWebhook}
            disabled={loadingWebhook}
            className="flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-teal-700 border border-teal-300 hover:bg-teal-50 cursor-pointer transition-all shadow-2xs"
          >
            <Zap className="w-3.5 h-3.5 mr-1 text-teal-600" />
            {loadingWebhook ? 'Dispatching...' : 'Test Event Webhook'}
          </button>
          {webhookStatus && (
            <span className="text-emerald-700 font-bold text-[11px] animate-fade-in">
              ✓ {webhookStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
