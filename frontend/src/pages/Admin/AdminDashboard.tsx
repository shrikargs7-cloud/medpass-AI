import React, { useState } from 'react';
import {
  Settings, Database, Activity, MessageSquare, BarChart3,
  Users, Shield, Building2, LogOut, ChevronRight, Send,
  CheckCircle2, AlertCircle, Globe, Workflow, Play, RefreshCw,
  Clock, Smartphone, Zap, ArrowRight
} from 'lucide-react';
import { triggerN8NWebhook, sendSmsNotification } from '../../api/client';

interface AdminDashboardProps {
  onLogout: () => void;
  userName: string;
}

type AdminTab = 'overview' | 'workflows' | 'sms' | 'users';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, userName }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // SMS Form State
  const [smsForm, setSmsForm] = useState({ to: '+919845012345', body: 'MedPass Alert: Pre-authorization approved for Case #ROOMCAP-2025.' });
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<string | null>(null);

  // N8N Simulation State
  const [simulatingStep, setSimulatingStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeEvent, setActiveEvent] = useState<'CLAIM_APPROVED' | 'PREAUTH_SUBMITTED' | 'QUERY_RAISED'>('CLAIM_APPROVED');
  const [simulationLog, setSimulationLog] = useState<string[]>([]);

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsSending(true);
    setSmsResult(null);
    try {
      const data = await sendSmsNotification(smsForm.to, smsForm.body);
      setSmsResult(`Success (${data.status}): SMS queued for ${smsForm.to}`);
      setSmsForm({ to: '', body: '' });
    } catch (err: any) {
      setSmsResult(`Error: ${err.message}`);
    } finally {
      setSmsSending(false);
    }
  };

  const runN8nSimulation = async () => {
    setIsSimulating(true);
    setSimulatingStep(1);
    setSimulationLog(['[00.0s] MedPass domain event fired: ' + activeEvent]);

    await new Promise((r) => setTimeout(r, 600));
    setSimulatingStep(2);
    setSimulationLog((prev) => [...prev, '[00.6s] Decoupled Outbox Dispatcher picked up payload. Calling n8n Webhook...']);

    try {
      await triggerN8NWebhook(activeEvent);
    } catch {
      // Non-blocking
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
        '[02.3s] Billing Desk Action Item Created: Query payload forwarded to hospital queue.'
      ]);
    }
    setIsSimulating(false);
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Admin Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'workflows', label: 'n8n Workflow Hub', icon: <Workflow className="w-4 h-4" /> },
    { key: 'sms', label: 'SMS Dispatcher', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'users', label: 'Role & User Management', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-purple-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm">MedPass AI</span>
              <div className="text-[10px] text-purple-400 font-mono font-bold uppercase">Admin Console</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === tab.key
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {activeTab === tab.key && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="text-xs text-slate-300 font-bold mb-0.5">{userName}</div>
          <div className="text-[10px] text-slate-500 font-mono mb-3">Enterprise Administrator</div>
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-900/20 border border-rose-900/40 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto max-h-screen">
        {/* ================= OVERVIEW TAB ================= */}
        {activeTab === 'overview' && (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">System Administration & Health</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Global overview of decoupled n8n webhooks, automated notifications, and SMS gateways
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold font-mono flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
                All Engines Operational
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Active Admissions', value: '52', icon: <Activity className="w-5 h-5 text-teal-600" />, bg: 'bg-teal-50' },
                { label: 'n8n Webhook Triggers', value: '1,420', icon: <Workflow className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50' },
                { label: 'SMS Notifications Sent', value: '3,892', icon: <MessageSquare className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50' },
                { label: 'Connected Hospitals', value: '12', icon: <Building2 className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50' },
              ].map((stat, i) => (
                <div key={i} className={`${stat.bg} rounded-2xl p-5 border border-slate-200 shadow-2xs`}>
                  <div className="flex items-center justify-between mb-3">{stat.icon}<span className="text-[10px] font-mono text-slate-400">REAL-TIME</span></div>
                  <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                  <div className="text-xs text-slate-600 mt-1 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent System Activity */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-teal-600" />
                  Audit Log & Event Pipeline
                </h3>
                <div className="space-y-3">
                  {[
                    { action: 'Firebase Auth token issued for patient session (+91 98450 12345)', time: 'Just now', status: 'success' },
                    { action: 'n8n Webhook DISCHARGE_READY dispatched to notification node', time: '8 min ago', status: 'success' },
                    { action: 'Pre-auth cashless clearance verified for Case #ROOMCAP-2025', time: '24 min ago', status: 'success' },
                    { action: 'Pre-auth token issued for Star Health claim #CLM-8921', time: '1 hr ago', status: 'success' },
                    { action: 'SMS dispatch queued via Twilio gateway for room cap advisory', time: '2 hrs ago', status: 'info' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 text-xs">
                      <div className="flex items-center space-x-3">
                        {item.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-blue-500 shrink-0" />}
                        <span className="text-slate-700 font-medium">{item.action}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-4">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Maintenance Quick Actions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-purple-600" />
                  Console Shortcuts
                </h3>
                <p className="text-xs text-slate-500">
                  Quickly navigate to specialized governance panels or dispatch test events.
                </p>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('workflows')}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-all cursor-pointer group"
                  >
                    <Workflow className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-slate-800">n8n Automation</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Test event triggers & webhooks</div>
                  </button>

                  <button
                    onClick={() => setActiveTab('sms')}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 text-left transition-all cursor-pointer group"
                  >
                    <MessageSquare className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-slate-800">Broadcast SMS</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Send messages to patients</div>
                  </button>

                  <button
                    onClick={() => setActiveTab('users')}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition-all cursor-pointer group"
                  >
                    <Users className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="text-xs font-bold text-slate-800">User Directory</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Inspect authenticated roles</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= N8N WORKFLOWS TAB ================= */}
        {activeTab === 'workflows' && (
          <div className="p-8 max-w-5xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">n8n Event Orchestration</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Decoupled event pipeline simulating webhook triggers, SLA monitoring, and patient messaging
                </p>
              </div>
              <button
                onClick={runN8nSimulation}
                disabled={isSimulating}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:from-teal-700 hover:to-indigo-700 disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
              >
                {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>{isSimulating ? 'Simulating Pipeline...' : 'Run Live Event Simulation'}</span>
              </button>
            </div>

            {/* Event Selector */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs mb-6">
              <label className="block text-xs font-bold text-slate-700 mb-2">Select Domain Event to Trigger</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'CLAIM_APPROVED', label: 'Claim Approved by Payer', desc: 'Triggers SMS/WhatsApp node with settlement breakdown' },
                  { id: 'PREAUTH_SUBMITTED', label: 'Pre-auth Submitted', desc: 'Arms IRDAI 45-minute SLA timer node' },
                  { id: 'QUERY_RAISED', label: 'Query Raised by TPA', desc: 'Dispatches urgent billing desk notification' },
                ].map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setActiveEvent(ev.id as any)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      activeEvent === ev.id
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{ev.label}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{ev.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Step-by-Step Flow */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { step: 1, label: 'Domain Event', desc: 'MedPass Domain Emit' },
                { step: 2, label: 'Outbox Dispatcher', desc: 'Webhook POST Payload' },
                { step: 3, label: 'n8n Switch Router', desc: 'Branch by Event Type' },
                { step: 4, label: 'Notification Node', desc: 'Patient SMS / SLA Sentinel' },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-4 rounded-xl border transition-all ${
                    simulatingStep === s.step
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                      : simulatingStep > s.step
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider mb-1 font-bold">
                    Step {s.step} {simulatingStep > s.step && '✓'}
                  </div>
                  <div className="text-xs font-bold">{s.label}</div>
                  <div className={`text-[10px] mt-0.5 ${simulatingStep === s.step ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Simulation Execution Log */}
            <div className="bg-slate-900 rounded-2xl p-5 font-mono text-xs text-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3 text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                <span>Execution Console Stream</span>
                <span>Webhook: /api/integrations/n8n/trigger-test</span>
              </div>
              <div className="space-y-1.5 min-h-[120px]">
                {simulationLog.length === 0 ? (
                  <span className="text-slate-500 italic">Click "Run Live Event Simulation" to watch events route through the n8n pipeline...</span>
                ) : (
                  simulationLog.map((line, idx) => (
                    <div key={idx} className="text-teal-400 flex items-start space-x-2">
                      <span className="text-slate-500">{'>'}</span>
                      <span>{line}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= SMS SENDER TAB ================= */}
        {activeTab === 'sms' && (
          <div className="p-8 max-w-2xl">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Direct SMS Dispatcher</h2>
            <p className="text-xs text-slate-500 mb-6">
              Send SMS notifications to patients or hospital billing staff. Configured via Twilio in backend/.env.
            </p>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <form onSubmit={handleSendSms} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Recipient Mobile Number</label>
                  <div className="relative">
                    <Send className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={smsForm.to}
                      onChange={(e) => setSmsForm({ ...smsForm, to: e.target.value })}
                      placeholder="+91 98450 12345"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Pre-filled Notification Template</label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      'MedPass Alert: Pre-authorization approved for Case #ROOMCAP-2025.',
                      'Hospital Notice: Estimated discharge ready. Patient co-pay: ₹60,000.',
                      'Payer Notice: Query requested for invoice item Pharmacy-01.',
                      'MedPass OTP Verification Code: 123456. Valid for 10 minutes.'
                    ].map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSmsForm({ ...smsForm, body: tmpl })}
                        className="text-[10px] p-2 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-lg text-left text-slate-700 transition-colors cursor-pointer"
                      >
                        {tmpl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Message Body</label>
                  <textarea
                    required
                    value={smsForm.body}
                    onChange={(e) => setSmsForm({ ...smsForm, body: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50 resize-none font-sans"
                  />
                </div>

                {smsResult && (
                  <div className={`p-3 rounded-xl text-xs font-medium ${
                    smsResult.startsWith('Error')
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {smsResult}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={smsSending}
                  className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  {smsSending ? <span>Dispatching SMS...</span> : <><Send className="w-3.5 h-3.5" /><span>Dispatch SMS Now</span></>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ================= USERS TAB ================= */}
        {activeTab === 'users' && (
          <div className="p-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">User & Role Directory</h2>
            <p className="text-xs text-slate-500 mb-6">
              Inspect users across Patient (Phone Auth), Hospital, Insurer, and Admin domains.
            </p>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">User Identity</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">Domain Role</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">Auth Method</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Priya Sharma (+91 98450 12345)', role: 'Patient', method: 'Firebase Phone OTP', status: 'Active' },
                    { name: 'Dr. Arvind Sharma (arvind.sharma@apollohospitals.org)', role: 'Hospital', method: 'Firebase Email/Password', status: 'Active' },
                    { name: 'Rohit Mehta (rohit.mehta@starhealth.in)', role: 'Insurer', method: 'Firebase Email/Password', status: 'Active' },
                    { name: 'System Administrator (admin@medpass.ai)', role: 'Admin', method: 'Firebase Superuser', status: 'Active' },
                  ].map((user, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-semibold text-slate-800">{user.name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.role === 'Patient' ? 'bg-emerald-100 text-emerald-700' :
                          user.role === 'Hospital' ? 'bg-teal-100 text-teal-700' :
                          user.role === 'Insurer' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{user.role}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{user.method}</td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold font-mono">● {user.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
