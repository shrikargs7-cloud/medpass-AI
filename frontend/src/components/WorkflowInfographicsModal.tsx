import React, { useState } from 'react';
import {
  X, Workflow, Cpu, Zap, Network, Bot, ShieldCheck,
  CheckCircle2, Clock, Smartphone, Mail, Database, AlertTriangle,
  Play, RefreshCw, ArrowRight, Layers, FileCode, Check
} from 'lucide-react';
import { triggerN8NWebhook } from '../api/client';

interface WorkflowInfographicsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkflowInfographicsModal: React.FC<WorkflowInfographicsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'n8n' | 'architecture' | 'comparison'>('n8n');
  const [simulatingStep, setSimulatingStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeEvent, setActiveEvent] = useState<'CLAIM_APPROVED' | 'PREAUTH_SUBMITTED' | 'QUERY_RAISED'>('CLAIM_APPROVED');
  const [simulationLog, setSimulationLog] = useState<string[]>([]);

  if (!isOpen) return null;

  const runSimulation = async () => {
    setIsSimulating(true);
    setSimulatingStep(1);
    setSimulationLog(['[00.0s] MedPass domain event fired: ' + activeEvent]);

    await new Promise((r) => setTimeout(r, 600));
    setSimulatingStep(2);
    setSimulationLog((prev) => [...prev, '[00.6s] Decoupled Outbox Dispatcher picked up payload. Calling n8n Webhook...']);

    try {
      await triggerN8NWebhook(activeEvent);
    } catch (e) {
      // Non-blocking fallback
    }

    await new Promise((r) => setTimeout(r, 800));
    setSimulatingStep(3);
    setSimulationLog((prev) => [...prev, '[01.4s] n8n Switch Node evaluated: Branching on event.type === "' + activeEvent + '"']);

    await new Promise((r) => setTimeout(r, 900));
    setSimulatingStep(4);
    if (activeEvent === 'CLAIM_APPROVED') {
      setSimulationLog((prev) => [
        ...prev,
        '[02.3s] WhatsApp & SMS Node: Message dispatched to Vikram Rao (+91 98450 12345)',
        '[02.3s] Payload: "Star Health approved ₹1,88,000. Patient payable: ₹60,000."'
      ]);
    } else if (activeEvent === 'PREAUTH_SUBMITTED') {
      setSimulationLog((prev) => [
        ...prev,
        '[02.3s] IRDAI SLA Sentinel: Started 45-minute countdown timer.',
        '[02.3s] Auto-escalation webhook armed for TPA Nodal Officer if breached.'
      ]);
    } else {
      setSimulationLog((prev) => [
        ...prev,
        '[02.3s] Hospital Desk Auto-Triage: Assigned task to Nursing Station.',
        '[02.3s] Alert: "Provide Platelet Count Lab Sheet to Star Health."'
      ]);
    }

    setIsSimulating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8 text-slate-900 animate-fade-in max-h-[92vh] flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">System Architecture & Automation Infographics</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  Visual Blueprint
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Visualizing n8n workflows, external payer gateway mocking, and the AI agent reasoning engine.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 py-3 border-b border-slate-100 shrink-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('n8n')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'n8n'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>1. n8n Automation Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('comparison')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>2. Beeceptor vs AI Agent (MCP)</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. End-to-End Hospital Pipeline</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* TAB 1: n8n AUTOMATION ENGINE */}
          {activeTab === 'n8n' && (
            <div className="space-y-6">
              {/* Infographic Overview Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 p-5 rounded-2xl text-white shadow-md border border-slate-700/60">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 px-2.5 py-0.5 rounded-md border border-teal-500/30">
                      Decoupled Outbox Event Architecture
                    </span>
                    <h3 className="text-base font-bold text-white mt-1">
                      How n8n Automates Real-Time Hospital & Patient Operations
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                      MedPass AI emits asynchronous domain events. n8n catches the webhook, branches on the claim status, and executes notifications, IRDAI SLA timers, and hospital EHR synchronization without blocking core billing.
                    </p>
                  </div>

                  {/* Interactive Runner Trigger */}
                  <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 flex flex-col items-end space-y-2">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-400 text-[11px]">Event:</span>
                      <select
                        value={activeEvent}
                        onChange={(e) => setActiveEvent(e.target.value as any)}
                        className="bg-slate-900 text-teal-300 text-xs font-mono px-2 py-1 rounded border border-slate-600 focus:outline-none"
                      >
                        <option value="CLAIM_APPROVED">CLAIM_APPROVED</option>
                        <option value="PREAUTH_SUBMITTED">PREAUTH_SUBMITTED</option>
                        <option value="QUERY_RAISED">QUERY_RAISED</option>
                      </select>
                    </div>

                    <button
                      onClick={runSimulation}
                      disabled={isSimulating}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isSimulating ? 'Executing Workflow...' : 'Simulate n8n Run'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Visual n8n Canvas Infographic */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center">
                    <Workflow className="w-4 h-4 text-teal-600 mr-1.5" />
                    Interactive n8n Node Graph
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    File: integrations/n8n/n8n_case_workflow.json
                  </span>
                </div>

                {/* Nodes Horizontal Flow */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                  {/* Node 1: Webhook Ingestion */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    simulatingStep === 1
                      ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500 shadow-md scale-102'
                      : simulatingStep > 1
                      ? 'bg-white border-emerald-400 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Step 1: Ingestion</span>
                      <div className={`w-3 h-3 rounded-full ${
                        simulatingStep === 1 ? 'bg-teal-500 animate-ping' : simulatingStep > 1 ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} />
                    </div>
                    <div className="font-bold text-xs text-slate-900 flex items-center">
                      <Zap className="w-4 h-4 text-amber-500 mr-1.5" />
                      Webhook Trigger
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1 bg-slate-100 p-1 rounded">
                      POST /webhook/medpass
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Catches outbox domain events emitted by FastAPI asynchronously.
                    </p>
                  </div>

                  {/* Node 2: Payload Parser & Validation */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    simulatingStep === 2
                      ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500 shadow-md scale-102'
                      : simulatingStep > 2
                      ? 'bg-white border-emerald-400 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Step 2: Processing</span>
                      <div className={`w-3 h-3 rounded-full ${
                        simulatingStep === 2 ? 'bg-teal-500 animate-ping' : simulatingStep > 2 ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} />
                    </div>
                    <div className="font-bold text-xs text-slate-900 flex items-center">
                      <FileCode className="w-4 h-4 text-blue-500 mr-1.5" />
                      JSON Item Normalizer
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1 bg-slate-100 p-1 rounded">
                      Extracts case_id, amount
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Sanitizes patient contacts, formats INR currency amounts.
                    </p>
                  </div>

                  {/* Node 3: Event Switch Router */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    simulatingStep === 3
                      ? 'bg-teal-50 border-teal-500 ring-2 ring-teal-500 shadow-md scale-102'
                      : simulatingStep > 3
                      ? 'bg-white border-emerald-400 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Step 3: Routing</span>
                      <div className={`w-3 h-3 rounded-full ${
                        simulatingStep === 3 ? 'bg-teal-500 animate-ping' : simulatingStep > 3 ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} />
                    </div>
                    <div className="font-bold text-xs text-slate-900 flex items-center">
                      <Workflow className="w-4 h-4 text-purple-500 mr-1.5" />
                      Event Type Switch
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1 bg-slate-100 p-1 rounded">
                      Switch: {activeEvent}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Routes payload to WhatsApp, SLA timers, or EHR alerts.
                    </p>
                  </div>

                  {/* Node 4: Action Execution */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    simulatingStep === 4
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 shadow-md scale-102'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Step 4: Dispatch</span>
                      <div className={`w-3 h-3 rounded-full ${
                        simulatingStep === 4 ? 'bg-emerald-500 animate-bounce' : 'bg-slate-300'
                      }`} />
                    </div>
                    <div className="font-bold text-xs text-slate-900 flex items-center">
                      {activeEvent === 'CLAIM_APPROVED' ? (
                        <Smartphone className="w-4 h-4 text-emerald-600 mr-1.5" />
                      ) : activeEvent === 'PREAUTH_SUBMITTED' ? (
                        <Clock className="w-4 h-4 text-amber-600 mr-1.5" />
                      ) : (
                        <Mail className="w-4 h-4 text-rose-600 mr-1.5" />
                      )}
                      {activeEvent === 'CLAIM_APPROVED'
                        ? 'WhatsApp Dispatch'
                        : activeEvent === 'PREAUTH_SUBMITTED'
                        ? 'IRDAI SLA Sentinel'
                        : 'EHR Auto-Triage'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-1 bg-slate-100 p-1 rounded">
                      {activeEvent === 'CLAIM_APPROVED'
                        ? 'SMS / WhatsApp Gateway'
                        : activeEvent === 'PREAUTH_SUBMITTED'
                        ? '45-Min Timer Armed'
                        : 'Hospital Nursing Task'}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {activeEvent === 'CLAIM_APPROVED'
                        ? 'Patient receives exact approved vs payable dues.'
                        : activeEvent === 'PREAUTH_SUBMITTED'
                        ? 'Escalates to TPA Nodal Officer if breached.'
                        : 'Alerts nurses to upload missing clinical records.'}
                    </p>
                  </div>
                </div>

                {/* Live Console Output during Simulation */}
                {simulationLog.length > 0 && (
                  <div className="mt-4 p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                      Execution Trace:
                    </div>
                    {simulationLog.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3 Real-World Healthcare Use Cases of n8n */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2.5">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">1. Plain-Language Patient SMS</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Patients receive instantaneous, reassuring WhatsApp updates with their covered amount and remaining payable balance before discharge.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">2. IRDAI 1h SLA Escalation</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    A countdown node starts at pre-auth submission. If no insurer decision arrives in 45 minutes, n8n automatically fires an escalation to the TPA nodal officer.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-2.5">
                    <Database className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">3. Governed Data Sync</h4>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Runs nightly to trigger MedPass's privacy gate and package de-identified cohorts into research-ready Parquet datasets.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BEECEPTOR VS AI AGENT (MCP) VS CALCULATION ENGINE */}
          {activeTab === 'comparison' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs text-slate-700">
                <span className="font-bold text-slate-900 block mb-1">
                  Clarification: Who Does What in MedPass AI?
                </span>
                <p className="leading-relaxed">
                  The <strong>AI Agent (MCP)</strong> and <strong>Beeceptor</strong> serve completely different, complementary roles in this architecture:
                </p>
              </div>

              {/* 3-Way Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Beeceptor */}
                <div className="p-5 rounded-2xl bg-white border-2 border-amber-300 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      External Simulation
                    </span>
                    <Network className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">Beeceptor / NHCX Gateway</h3>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-amber-900">Role: External Payer Endpoint</p>
                    <p>Mocks the National Health Claims Exchange & Insurers:</p>
                    <ul className="list-disc list-inside text-slate-500 text-[11px] space-y-1">
                      <li>202 Auto-Approved pre-authorization</li>
                      <li>200 Query (requests missing lab reports)</li>
                      <li>200 Rejected (clause exclusion)</li>
                      <li>504 Gateway Timeout (SLA circuit breaker)</li>
                      <li>500 Internal Payer Server Error</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 p-2 rounded-xl border border-amber-200 text-[10px] text-amber-900 font-medium">
                    Does NOT do AI reasoning. Strictly mocks HTTP API payloads.
                  </div>
                </div>

                {/* 2. AI Agent (MCP) */}
                <div className="p-5 rounded-2xl bg-white border-2 border-teal-400 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-900 px-2 py-0.5 rounded">
                      Autonomous Reasoning
                    </span>
                    <Bot className="w-5 h-5 text-teal-600" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">AI Agent (MCP Tools)</h3>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-teal-900">Role: Clinical & Policy Assistant</p>
                    <p>Operates via Model Context Protocol (MCP) tool execution:</p>
                    <ul className="list-disc list-inside text-slate-500 text-[11px] space-y-1">
                      <li><code>get_case</code>: Loads full admission details</li>
                      <li><code>get_policy</code>: Inspects room caps & copay</li>
                      <li><code>get_blockers</code>: Diagnoses discharge hurdles</li>
                      <li><code>check_coverage</code>: Explains rule deductions</li>
                      <li><code>query_trace_dataset</code>: Analyzes cohorts</li>
                    </ul>
                  </div>
                  <div className="bg-teal-50 p-2 rounded-xl border border-teal-200 text-[10px] text-teal-900 font-medium">
                    Reads backend database, reasons over evidence, chats with hospital staff.
                  </div>
                </div>

                {/* 3. Deterministic Engine */}
                <div className="p-5 rounded-2xl bg-white border-2 border-emerald-400 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                      Audited Rules
                    </span>
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">Deterministic Policy Engine</h3>
                  <div className="text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-emerald-900">Role: Financial Math & Rule Waterfall</p>
                    <p>Strict pure code calculations:</p>
                    <ul className="list-disc list-inside text-slate-500 text-[11px] space-y-1">
                      <li>Exclusion checks (alcohol/cosmetic)</li>
                      <li>Waiting period validation</li>
                      <li>Proportional room-rent cap deductions</li>
                      <li>Deductibles and mandatory co-pays</li>
                      <li>Generates auditable calculation traces</li>
                    </ul>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200 text-[10px] text-emerald-900 font-medium">
                    Never allows an LLM to calculate bill amounts. Guaranteed invariants.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: END-TO-END PIPELINE */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800">
                <h3 className="text-sm font-bold text-white mb-2">Hospital-to-Payer Complete Execution Chain</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  From patient intake to cashless discharge and research export:
                </p>
              </div>

              {/* Step Sequence Infographic */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="font-bold text-slate-900">1. Intake & Ingestion</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Patient arrives, policy card attached, medical records uploaded for OCR.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="font-bold text-slate-900">2. Deterministic Adjudication</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Policy engine applies room caps and copays; generates readiness score.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="font-bold text-slate-900">3. Payer Submission (Gateway)</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Preauth submitted to NHCX / Beeceptor with FHIR claims payload.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="font-bold text-slate-900">4. n8n Automation</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Dispatches patient WhatsApp message and arms IRDAI 1h SLA sentinel.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <div className="font-bold text-slate-900">5. Payer Reconciliation Ledger</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Audited settlement transaction logged to ledger for final bank payment clearance.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>MedPass AI Specification Blueprint • n8n & External Gateway Contracts</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl cursor-pointer"
          >
            Close Infographics
          </button>
        </div>
      </div>
    </div>
  );
};
