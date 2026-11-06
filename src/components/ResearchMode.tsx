import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MarkdownView } from './MarkdownView';
import {
  Globe,
  Search,
  ExternalLink,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  History,
  FileCheck,
} from 'lucide-react';

export const ResearchMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'deep' | 'quick'>('deep');
  const [query, setQuery] = useState('');
  const [depth, setDepth] = useState<'standard' | 'deep' | 'exhaustive'>('deep');

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [activeReport, setActiveReport] = useState<any | null>(null);
  const [researchHistory, setResearchHistory] = useState<any[]>([]);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const res = await api.getResearchJobs();
      setResearchHistory(res.jobs || []);
      if (res.jobs && res.jobs.length > 0 && !activeReport) {
        setActiveReport(res.jobs[0]);
      }
    } catch {}
  };

  const handleExecuteResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setCurrentStep('Initializing research inquiry...');

    try {
      if (activeTab === 'deep') {
        const res = await api.deepResearch(query.trim(), depth);
        if (res.job) {
          setResearchHistory((prev) => [res.job, ...prev]);
          setActiveReport(res.job);
        }
      } else {
        const res = await api.quickResearch(query.trim());
        const quickJob = {
          id: Date.now().toString(),
          query: query.trim(),
          report: res.report,
          sources: res.sources,
          created_at: Date.now(),
        };
        setActiveReport(quickJob);
      }
      setQuery('');
    } catch (err: any) {
      setError(err.message || 'Research inquiry failed.');
    } finally {
      setLoading(false);
      setCurrentStep(null);
    }
  };

  const handleDownloadReport = () => {
    if (!activeReport) return;
    const blob = new Blob([activeReport.report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SaadGPT_Research_${activeReport.query.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#070406]">
      {/* LEFT: Query & Research Config */}
      <div className="w-full lg:w-[420px] p-6 border-b lg:border-b-0 lg:border-r border-rose-950/30 overflow-y-auto shrink-0 bg-[#0a0508]/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400">
            <Globe className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SaadGPT Deep Research</h2>
            <p className="text-xs text-neutral-400">Multi-Step Search &bull; Verified Citations &bull; Synthesis</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-neutral-950 p-1 border border-rose-950/40 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('deep')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'deep' ? 'bg-rose-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Deep Research Pipeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'quick' ? 'bg-rose-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Quick Web Grounding
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleExecuteResearch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Research Inquiry / Complex Topic
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. State of room-temperature superconductor replication experiments in 2026, empirical data and critical consensus..."
              rows={4}
              required
              className="w-full p-3 rounded-xl glass-input text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {activeTab === 'deep' && (
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Research Depth &amp; Investigation Scope
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'standard', label: 'Rapid' },
                  { id: 'deep', label: 'Deep (3-Pass)' },
                  { id: 'exhaustive', label: 'Exhaustive' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDepth(d.id as any)}
                    className={`py-2 rounded-xl text-xs font-medium border transition ${
                      depth === d.id
                        ? 'border-rose-500 bg-rose-600/20 text-white'
                        : 'border-rose-950/40 text-neutral-400 bg-[#0e070b]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deep Research Real Pipeline Visualization */}
          <div className="p-3.5 rounded-2xl bg-[#0d070b] border border-rose-950/40 text-xs text-neutral-300 space-y-2">
            <span className="font-semibold text-rose-400 text-[11px] uppercase tracking-wider block">
              Autonomous Verification Process
            </span>
            <div className="space-y-1.5 text-[11px] text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>1. Multi-Inquiry Query Planning</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>2. Live Web Crawl &amp; Google Search Grounding</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>3. Cross-Checking &amp; Empirical Extraction</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>4. Academic-Grade Dossier Synthesis</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Conducting Deep Research...
              </span>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Launch Deep Research</span>
              </>
            )}
          </button>
        </form>

        {/* History List */}
        {researchHistory.length > 0 && (
          <div className="mt-6 pt-4 border-t border-rose-950/30">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2">
              Past Research Dossiers ({researchHistory.length})
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {researchHistory.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setActiveReport(h)}
                  className={`w-full p-2.5 rounded-xl border text-left text-xs transition truncate block ${
                    activeReport?.id === h.id
                      ? 'border-rose-500 bg-rose-600/15 text-white'
                      : 'border-rose-950/40 text-neutral-400 hover:text-white bg-[#0e070b]'
                  }`}
                >
                  <p className="truncate font-medium">{h.query}</p>
                  <span className="text-[10px] text-neutral-500">
                    {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Live Report View & Source Grounding Citations */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col">
        {activeReport ? (
          <div className="flex-1 flex flex-col rounded-3xl bg-[#0c0609] border border-rose-950/40 p-6 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-rose-950/30">
              <div className="min-w-0 pr-4">
                <span className="text-[10px] uppercase font-mono text-rose-400 tracking-wider">
                  Verified Research Report
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {activeReport.query}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-xs text-rose-200 hover:text-white transition shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Dossier</span>
              </button>
            </div>

            {/* Citations Grid */}
            {activeReport.sources && activeReport.sources.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#080407] border border-rose-950/30 space-y-2">
                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-rose-400" />
                  Primary Web Citations ({activeReport.sources.length})
                </span>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {activeReport.sources.map((s: any, idx: number) => (
                    <a
                      key={idx}
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#140b10] border border-rose-950/50 hover:border-rose-500/50 text-[11px] text-neutral-300 hover:text-rose-200 transition"
                    >
                      <ExternalLink className="w-3 h-3 text-rose-400 shrink-0" />
                      <span className="truncate max-w-[200px]">{s.title || s.uri}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Markdown Report Body */}
            <div className="flex-1 overflow-y-auto pt-2">
              <MarkdownView content={activeReport.report} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-rose-950/30 bg-[#0a0508]/30 p-8 text-center">
            <Globe className="w-12 h-12 text-rose-500/30 mb-3" />
            <h3 className="text-base font-semibold text-white">Deep Research Terminal</h3>
            <p className="mt-1 text-xs text-neutral-400 max-w-sm">
              Initiate a high-rigor investigation on the left to activate multi-search query planning and verified empirical web grounding.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
