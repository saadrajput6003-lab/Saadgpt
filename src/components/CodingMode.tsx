import React, { useState } from 'react';
import { api } from '../services/api';
import { MarkdownView } from './MarkdownView';
import {
  Code2,
  Terminal,
  Bug,
  Sparkles,
  RefreshCw,
  Copy,
  Download,
  CheckCircle,
  AlertCircle,
  FileCode,
} from 'lucide-react';

export const CodingMode: React.FC = () => {
  const [code, setCode] = useState('');
  const [prompt, setPrompt] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [action, setAction] = useState<'explain' | 'generate' | 'debug' | 'refactor' | 'test'>('generate');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const languages = [
    'typescript',
    'python',
    'rust',
    'go',
    'sql',
    'cpp',
    'java',
    'javascript',
    'html',
    'json',
  ];

  const handleExecute = async (actionOverride?: any) => {
    const act = actionOverride || action;
    if (!code.trim() && !prompt.trim()) {
      setError('Please provide code or a prompt describing what you wish to build.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.codingAction({
        code,
        prompt,
        language,
        action: act,
      });
      setResult(res.result);
    } catch (err: any) {
      setError(err.message || 'Coding action failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saadgpt_solution.${language === 'cpp' ? 'cpp' : language === 'python' ? 'py' : language === 'rust' ? 'rs' : 'ts'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#070406]">
      {/* LEFT: Code & Prompt Editor */}
      <div className="w-full lg:w-[460px] p-6 border-b lg:border-b-0 lg:border-r border-rose-950/30 overflow-y-auto shrink-0 bg-[#0a0508]/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400">
            <Code2 className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SaadGPT Coding Mode</h2>
            <p className="text-xs text-neutral-400">Principal Architect &bull; Debugging &bull; Optimization</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Action Tabs */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Architectural Action
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-950 border border-rose-950/40">
              {(
                [
                  { id: 'generate', label: 'Generate' },
                  { id: 'explain', label: 'Explain' },
                  { id: 'debug', label: 'Debug' },
                  { id: 'refactor', label: 'Refactor' },
                  { id: 'test', label: 'Test Suite' },
                ] as const
              ).map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setAction(act.id)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition ${
                    action === act.id
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs font-mono text-white focus:outline-none focus:border-rose-500"
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt / Specification */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Requirements / Task Description
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Implement a high-performance LRU Cache with O(1) get and put using doubly linked list and hashmap..."
              rows={3}
              className="w-full p-3 rounded-xl glass-input text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Code Input */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Source Code (Optional for new generation, Required for Debug/Refactor)
            </label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="// Paste existing code to analyze, debug, or optimize..."
              rows={8}
              className="w-full p-3 rounded-xl glass-input font-mono text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Synthesizing Engineering Solution...
              </span>
            ) : (
              <>
                <Terminal className="w-4 h-4" />
                <span>Execute Code Operation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* RIGHT: Architecture & Code Output */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col">
        {result ? (
          <div className="flex-1 rounded-3xl bg-[#0c0609] border border-rose-950/40 p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-950/30">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Generated Solution ({language.toUpperCase()})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs text-neutral-300 hover:text-white transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-xs text-rose-200 hover:text-white transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Code</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <MarkdownView content={result} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-rose-950/30 bg-[#0a0508]/30 p-8 text-center">
            <Code2 className="w-12 h-12 text-rose-500/30 mb-3" />
            <h3 className="text-base font-semibold text-white">Coding Terminal Ready</h3>
            <p className="mt-1 text-xs text-neutral-400 max-w-sm">
              Specify your language and architecture goals on the left to generate clean algorithms, unit tests, or refactor legacy code.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
