import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Send, Sparkles, RefreshCw, User, FileText } from 'lucide-react';
import { fetchMCPTools, chatMCPAgent } from '../api/client';
import { MCPTool } from '../types';
import ReactMarkdown from 'react-markdown';

interface MCPAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCaseId?: string;
}

interface Message {
  role: 'user' | 'agent';
  text: string;
  time?: string;
}

export const MCPAgentDrawer: React.FC<MCPAgentDrawerProps> = ({
  isOpen,
  onClose,
  currentCaseId
}) => {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initialWelcomeMessage = (): Message => ({
    role: 'agent',
    text: `Hello! I am **MedPass AI Clinical Assistant**, your intelligent co-pilot for hospital admissions, claims adjudication, and discharge clearance.\n\nYou can ask me to search active patient files, verify insurance policy clauses, calculate co-pay and room rent deductions, or review clinical care protocols.`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  const [messages, setMessages] = useState<Message[]>([initialWelcomeMessage()]);

  useEffect(() => {
    localStorage.removeItem('medpass_ai_key');
    localStorage.removeItem('medpass_ai_provider');
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMCPTools().then(setTools).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleResetChat = () => {
    setMessages([initialWelcomeMessage()]);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      const res = await chatMCPAgent(text, currentCaseId);
      const agentMsg: Message = {
        role: 'agent',
        text: res.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          text: 'Unable to connect to assistant service: ' + (err.message || 'Please verify network connection.'),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/40 shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-white tracking-tight">MedPass AI Assistant</h2>
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[9px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Ready</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">Clinical, Claims & Care Plan Co-Pilot</p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handleResetChat}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reset Conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close Assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Active Case Context Chip */}
          {currentCaseId && (
            <div className="bg-teal-50/70 px-4 py-2 border-b border-teal-100/80 flex items-center justify-between text-[11px] text-teal-900">
              <div className="flex items-center space-x-1.5 font-medium">
                <FileText className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>Active Context:</span>
                <span className="font-mono font-bold text-teal-800">{currentCaseId}</span>
              </div>
              <span className="text-[10px] text-teal-700/80 font-semibold uppercase tracking-wider">In Focus</span>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-teal-600 text-white shadow-xs rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-900 shadow-xs rounded-tl-xs'
                  }`}
                >
                  <div className="prose prose-xs max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800">
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                </div>
                {m.time && (
                  <span className="text-[9px] text-slate-400 mt-1 px-1 font-mono">
                    {m.time}
                  </span>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-xs text-slate-600 bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl w-fit shadow-xs animate-fade-in">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                <span className="font-medium">MedPass AI is analyzing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Healthcare Suggestion Pills */}
          <div className="px-3.5 py-2 bg-white border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Suggested Inquiries
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              <button
                type="button"
                onClick={() => handleSend("fetch Rahul details")}
                className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
              >
                🔍 Fetch Rahul details
              </button>
              <button
                type="button"
                onClick={() => handleSend("tell me the queries that I can ask you")}
                className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
              >
                💡 What queries can I ask?
              </button>
              <button
                type="button"
                onClick={() => handleSend("What blockers are preventing discharge?")}
                className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
              >
                ⚡ Check discharge blockers
              </button>
              <button
                type="button"
                onClick={() => handleSend("Explain room rent deduction rule")}
                className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
              >
                🛡️ Room rent deduction rule
              </button>
              <button
                type="button"
                onClick={() => handleSend("Explain standard cashless pre-authorization process")}
                className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
              >
                📋 Pre-auth process
              </button>
            </div>
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
                placeholder="Ask about patient files, policy rules, care plans, or blockers..."
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 placeholder-slate-400 font-medium"
              />
              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="p-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
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
