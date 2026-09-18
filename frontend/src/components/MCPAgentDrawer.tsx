import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, X, Send, ShieldCheck, Sparkles, Key, Check,
  AlertCircle, ChevronDown, Settings, HelpCircle, CornerDownLeft
} from 'lucide-react';
import { fetchMCPTools, chatMCPAgent } from '../api/client';
import { MCPTool } from '../types';

interface MCPAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCaseId?: string;
}

interface Message {
  role: 'user' | 'agent';
  text: string;
  bounded?: boolean;
  guardrail_status?: string;
  provider?: string;
  tools?: any[];
}

export const MCPAgentDrawer: React.FC<MCPAgentDrawerProps> = ({
  isOpen,
  onClose,
  currentCaseId
}) => {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('medpass_ai_key') || '');
  const [provider, setProvider] = useState<'gemini' | 'openai'>(() => {
    return (localStorage.getItem('medpass_ai_provider') as any) || 'gemini';
  });
  const [keySavedMessage, setKeySavedMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'agent',
      text: 'Hello! I am MedPass AI Healthcare Assistant. I am specialized strictly in hospital admissions, clinical care plans, insurance policies, claims adjudication, and discharge readiness.\n\nHow can I assist you with your active case or policy query?'
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchMCPTools().then(setTools).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('medpass_ai_key', apiKey.trim());
      localStorage.setItem('medpass_ai_provider', provider);
    } else {
      localStorage.removeItem('medpass_ai_key');
    }
    setKeySavedMessage(true);
    setTimeout(() => {
      setKeySavedMessage(false);
      setShowKeyConfig(false);
    }, 1200);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      const activeKey = apiKey.trim() || undefined;
      const res = await chatMCPAgent(text, currentCaseId, activeKey, provider);
      const agentMsg: Message = {
        role: 'agent',
        text: res.reply,
        bounded: res.bounded,
        guardrail_status: res.guardrail_status,
        provider: res.provider,
        tools: res.tools_invoked
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: 'Unable to connect to assistant service: ' + (err.message || 'Check network connection.')
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Top Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/40">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h2 className="text-sm font-bold text-white">MedPass AI Assistant</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-500/40 uppercase">
                    Topic Bounded
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Clinical & Insurance Specialist</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  showKeyConfig || apiKey
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Configure Gemini or OpenAI API Key"
              >
                <Key className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Optional API Key Settings Panel */}
          {showKeyConfig && (
            <div className="bg-slate-900/95 border-b border-slate-800 text-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-300 flex items-center">
                  <Key className="w-3.5 h-3.5 mr-1.5" />
                  Connect Custom LLM Key
                </span>
                <span className="text-[10px] text-slate-400">Optional • Fallback engine active</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProvider('gemini')}
                  className={`py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                    provider === 'gemini'
                      ? 'bg-teal-600 border-teal-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Google Gemini
                </button>
                <button
                  type="button"
                  onClick={() => setProvider('openai')}
                  className={`py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                    provider === 'openai'
                      ? 'bg-teal-600 border-teal-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  OpenAI (GPT-4o)
                </button>
              </div>

              <div className="space-y-1">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'gemini' ? 'Enter Gemini API Key (AIza...)' : 'Enter OpenAI Key (sk-...)'}
                  className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{keySavedMessage ? 'Saved!' : 'Save Key'}</span>
                </button>
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKey('');
                      localStorage.removeItem('medpass_ai_key');
                    }}
                    className="text-[11px] text-slate-400 hover:text-red-400"
                  >
                    Clear Key
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Domain Bounding & Guardrail Notice Banner */}
          <div className="bg-teal-50/80 px-4 py-2 border-b border-teal-100 flex items-center justify-between text-[11px] text-teal-900">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span>
                <strong>Strict Boundary:</strong> Answers healthcare, policy & discharge only.
              </span>
            </div>
            {currentCaseId && (
              <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-teal-200/60 text-teal-800">
                Case Active
              </span>
            )}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-xs ${
                    m.role === 'user'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : m.guardrail_status === 'OFF_TOPIC_REJECTED'
                      ? 'bg-amber-50 border border-amber-300 text-amber-900 shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-xs'
                  }`}
                >
                  {m.guardrail_status === 'OFF_TOPIC_REJECTED' && (
                    <div className="flex items-center space-x-1 text-[10px] font-bold text-amber-800 mb-1 pb-1 border-b border-amber-200">
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>Topic Boundary Guardrail Activated</span>
                    </div>
                  )}
                  <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-slate-200 p-3 rounded-2xl w-fit shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                <span>Assistant verifying healthcare domain...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Healthcare Prompts */}
          <div className="px-4 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSend("What blockers are preventing discharge?")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Check discharge blockers
            </button>
            <button
              onClick={() => handleSend("Why was the room rent capped and how much is patient payable?")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Room rent deduction rule
            </button>
            <button
              onClick={() => handleSend("Explain standard cashless pre-authorization process")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Pre-auth process
            </button>
            <button
              onClick={() => handleSend("What is the clinical protocol for Appendicitis (K35.80)?")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Appendicitis protocol
            </button>
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                placeholder="Ask about patient case, policy, or blockers..."
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50"
              />
              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="p-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer"
                title="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
