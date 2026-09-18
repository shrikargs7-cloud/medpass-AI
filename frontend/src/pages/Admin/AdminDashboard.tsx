import React, { useState } from 'react';
import {
  Settings, Database, Activity, MessageSquare, BarChart3,
  Users, Shield, Building2, LogOut, ChevronRight, Send,
  CheckCircle2, AlertCircle, Globe, Workflow
} from 'lucide-react';

interface AdminDashboardProps {
  onLogout: () => void;
  userName: string;
}

type AdminTab = 'overview' | 'trace' | 'workflows' | 'sms' | 'users';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, userName }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [smsForm, setSmsForm] = useState({ to: '', body: '' });
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<string | null>(null);

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsSending(true);
    setSmsResult(null);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smsForm),
      });
      const data = await res.json();
      setSmsResult(`SMS ${data.status}: sent to ${smsForm.to}`);
      setSmsForm({ to: '', body: '' });
    } catch (err: any) {
      setSmsResult(`Error: ${err.message}`);
    } finally {
      setSmsSending(false);
    }
  };

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'trace', label: 'Trace Commons', icon: <Database className="w-4 h-4" /> },
    { key: 'workflows', label: 'N8N Workflows', icon: <Workflow className="w-4 h-4" /> },
    { key: 'sms', label: 'SMS Sender', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'users', label: 'User Management', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm">MedPass AI</span>
              <div className="text-[10px] text-slate-400 font-mono">Admin Console</div>
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
                  ? 'bg-teal-600/20 text-teal-400'
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
          <div className="text-xs text-slate-400 mb-2">{userName}</div>
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-900/20 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-6">Admin Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Active Patients', value: '1,247', icon: <Users className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50' },
                { label: 'Hospitals Connected', value: '12', icon: <Building2 className="w-5 h-5 text-teal-600" />, bg: 'bg-teal-50' },
                { label: 'Insurance Partners', value: '8', icon: <Shield className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50' },
              ].map((stat, i) => (
                <div key={i} className={`${stat.bg} rounded-2xl p-5 border border-slate-200`}>
                  <div className="flex items-center justify-between mb-3">{stat.icon}<span className="text-[10px] font-mono text-slate-400">LIVE</span></div>
                  <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                  <div className="text-xs text-slate-600 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {[
                  { action: 'New patient registered via OTP', time: '2 min ago', status: 'success' },
                  { action: 'Policy uploaded by Star Health', time: '15 min ago', status: 'success' },
                  { action: 'Pre-auth approved for Case #ROOMCAP-2025', time: '1 hr ago', status: 'success' },
                  { action: 'SMS notification sent to 5 patients', time: '3 hrs ago', status: 'info' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center space-x-3">
                      {item.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-blue-500" />}
                      <span className="text-xs text-slate-700">{item.action}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trace' && (
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Trace Commons Management</h2>
            <p className="text-sm text-slate-500 mb-6">Manage datasets, cohorts, and export pipelines.</p>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-700 mb-2">Trace Commons Dashboard</h3>
              <p className="text-xs text-slate-500">Full dataset management, cohort explorer, and 6-step export wizard are available here for admin users.</p>
            </div>
          </div>
        )}

        {activeTab === 'workflows' && (
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-2">N8N Workflow Management</h2>
            <p className="text-sm text-slate-500 mb-6">Configure and monitor automated healthcare workflows.</p>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-sm font-bold text-slate-700 mb-2">N8N Integration Hub</h3>
              <p className="text-xs text-slate-500">Workflow automation, webhook management, and integration monitoring for admin users.</p>
            </div>
          </div>
        )}

        {activeTab === 'sms' && (
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-2">SMS Notification Sender</h2>
            <p className="text-sm text-slate-500 mb-6">Send SMS messages to patients from hospital or insurer accounts.</p>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg">
              <form onSubmit={handleSendSms} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Recipient Phone Number</label>
                  <div className="relative">
                    <Send className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={smsForm.to}
                      onChange={(e) => setSmsForm({ ...smsForm, to: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Message Body</label>
                  <textarea
                    required
                    value={smsForm.body}
                    onChange={(e) => setSmsForm({ ...smsForm, body: e.target.value })}
                    placeholder="Your appointment is confirmed for..."
                    rows={4}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50 resize-none"
                  />
                </div>

                {smsResult && (
                  <div className={`p-3 rounded-xl text-xs font-medium ${
                    smsResult.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {smsResult}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={smsSending}
                  className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  {smsSending ? <span>Sending...</span> : <><Send className="w-3.5 h-3.5" /><span>Send SMS</span></>}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="text-xl font-black text-slate-900 mb-2">User Management</h2>
            <p className="text-sm text-slate-500 mb-6">Manage patients, hospital staff, and insurer accounts.</p>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">User</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">Role</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">Status</th>
                    <th className="text-left px-4 py-3 font-bold text-slate-600">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Priya Sharma', role: 'Patient', status: 'Active', lastActive: '10 min ago' },
                    { name: 'Dr. Arvind Sharma', role: 'Hospital', status: 'Active', lastActive: '5 min ago' },
                    { name: 'Rohit Mehta', role: 'Insurer', status: 'Active', lastActive: '1 hr ago' },
                    { name: 'Admin User', role: 'Admin', status: 'Active', lastActive: 'Now' },
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
                      <td className="px-4 py-3"><span className="text-emerald-600 font-semibold">● {user.status}</span></td>
                      <td className="px-4 py-3 text-slate-400 font-mono">{user.lastActive}</td>
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
