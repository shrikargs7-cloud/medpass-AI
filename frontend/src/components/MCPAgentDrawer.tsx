import React, { useState, useEffect } from 'react';
import { Bot, X, Send, Wrench, ShieldCheck, Terminal, Sparkles } from 'lucide-react';
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
  tools?: { tool: string; result: any }[];
}

export const MCPAgentDrawer: React.FC<MCPAgentDrawerProps> = ({
  isOpen,
  onClose,
  currentCaseId
}) => {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'agent',
      text: 'Hello! I am MedPass Agent. I utilize registered Model Context Protocol (MCP) tools to query policy terms, explain coverage deductions, or inspect discharge blockers. How can I assist you?'
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchMCPTools().then(setTools).catch(console.error);
    }
  }, [isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim()) return;

    const userMsg: Message = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      const res = await chatMCPAgent(text, currentCaseId);
      const agentMsg: Message = {
        role: 'agent',
        text: res.reply,
        tools: res.tools_invoked
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'agent', text: 'Error interacting with MCP tools: ' + (err.message || 'Unknown error') }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/40">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold flex items-center">
                  MedPass AI Agent
                  <span className="ml-2 text-[10px] bg-teal-500/30 text-teal-300 px-1.5 py-0.2 rounded border border-teal-500/40">
                    MCP Protocol
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">Explainable tool querying & adjudication assistant</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Core Principle Banner */}
          <div className="bg-teal-50 px-4 py-2 border-b border-teal-100 flex items-center space-x-2 text-xs text-teal-900">
            <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
            <span>
              <strong>Guardrail:</strong> Agent reads & explains; deterministic backend decides. No write mutation allowed.
            </span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-xs ${
                    m.role === 'user'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-line leading-relaxed">{m.text}</p>

                  {/* Tool Execution Card */}
                  {m.tools && m.tools.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        <Terminal className="w-3 h-3 mr-1 text-teal-600" />
                        MCP Tool Executed
                      </div>
                      {m.tools.map((t, tidx) => (
                        <div key={tidx} className="bg-slate-900 text-teal-300 p-2 rounded-lg font-mono text-[10px] overflow-x-auto">
                          <span className="text-amber-400 font-bold">{t.tool}()</span>
                          <pre className="text-slate-300 text-[9px] mt-1">
                            {JSON.stringify(t.result, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-slate-200 p-3 rounded-2xl w-fit">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                <span>Agent invoking MCP tools...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 bg-white border-t border-slate-100 flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSend("Why was the room rent capped and how much is patient payable?")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors"
            >
              Why was room rent capped?
            </button>
            <button
              onClick={() => handleSend("What blockers are currently preventing discharge?")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors"
            >
              What blockers are active?
            </button>
            <button
              onClick={() => handleSend("Explain policy coverage deductions")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md transition-colors"
            >
              Explain coverage rules
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
                placeholder="Ask MCP agent about case, policy, or Trace..."
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-slate-50"
              />
              <button
                type="submit"
                disabled={loading || !inputPrompt.trim()}
                className="p-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
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
