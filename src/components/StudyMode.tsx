import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { MarkdownView } from './MarkdownView';
import {
  GraduationCap,
  BookOpen,
  Sparkles,
  Upload,
  FileText,
  ListChecks,
  CheckCircle,
  HelpCircle,
  Calendar,
  Layers,
  Copy,
  Download,
  AlertCircle,
} from 'lucide-react';

export const StudyMode: React.FC = () => {
  const [docText, setDocText] = useState('');
  const [studyPrompt, setStudyPrompt] = useState('');
  const [selectedTask, setSelectedTask] = useState('summary');
  const [fileName, setFileName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    // Read plain text or extract text
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setDocText(text);
    };
    reader.onerror = () => {
      setError('Unable to read selected file.');
    };
    reader.readAsText(file);
  };

  const handleExecute = async (taskOverride?: string) => {
    const task = taskOverride || selectedTask;
    if (!docText.trim() && !studyPrompt.trim()) {
      setError('Please provide document text or an academic study topic.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.studyAction({
        documentText: docText,
        prompt: studyPrompt,
        task,
      });
      setResult(res.result);
    } catch (err: any) {
      setError(err.message || 'Study operation failed.');
    } finally {
      setLoading(false);
    }
  };

  const studyPresets = [
    { id: 'summary', name: 'Executive Summary', icon: FileText, desc: 'Key takeaways and high-yield summary' },
    { id: 'explain_simply', name: 'Feynman Explanation', icon: HelpCircle, desc: 'Intuitive plain-English breakdown' },
    { id: 'chapter_breakdown', name: 'Chapter Structure', icon: BookOpen, desc: 'Section-by-section outline with definitions' },
    { id: 'mcq_quiz', name: 'MCQ Practice Exam', icon: ListChecks, desc: '5 multiple choice questions with rationale' },
    { id: 'flashcards', name: 'Active Recall Flashcards', icon: Layers, desc: 'Question & answer study cards' },
    { id: 'study_plan', name: 'Exam Study Schedule', icon: Calendar, desc: 'Milestone roadmap towards test day' },
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#070406]">
      {/* Left Input & Tool Presets */}
      <div className="w-full lg:w-[420px] p-6 border-b lg:border-b-0 lg:border-r border-rose-950/30 overflow-y-auto shrink-0 bg-[#0a0508]/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400">
            <GraduationCap className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SaadGPT Study Mode</h2>
            <p className="text-xs text-neutral-400">Academic Synthesis &bull; Exam Prep &bull; Feynman Learning</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* File Upload / Source Document */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Source Document / Notes
              </label>
              {fileName && (
                <button
                  type="button"
                  onClick={() => {
                    setFileName(null);
                    setDocText('');
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300"
                >
                  Clear File
                </button>
              )}
            </div>

            {fileName ? (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-white truncate">
                  <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="truncate">{fileName}</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">Loaded</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3.5 border-2 border-dashed border-rose-950/50 hover:border-rose-500/40 rounded-xl flex items-center justify-center gap-2 text-neutral-400 hover:text-neutral-200 bg-[#0d070b]/40 transition"
              >
                <Upload className="w-4 h-4 text-rose-400" />
                <span className="text-xs">Upload Document / Text (.txt, .md, .csv)</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.json,.csv,.ts,.js,.py"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Paste Document Text */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Paste Text or Syllabus Content
            </label>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste reading passages, lecture notes, textbook chapters, or legal briefs here..."
              rows={4}
              className="w-full p-3 rounded-xl glass-input text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500 resize-none font-mono"
            />
          </div>

          {/* Specific Focus / Questions */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Specific Query / Topic Focus (Optional)
            </label>
            <input
              type="text"
              value={studyPrompt}
              onChange={(e) => setStudyPrompt(e.target.value)}
              placeholder="e.g. Focus on mitochondrial phosphorylation and Krebs cycle"
              className="w-full p-2.5 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Tool Presets */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Study Tool
            </label>
            <div className="grid grid-cols-1 gap-2">
              {studyPresets.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedTask(p.id);
                      handleExecute(p.id);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-start gap-3 transition ${
                      selectedTask === p.id
                        ? 'border-rose-500 bg-rose-600/15 text-white'
                        : 'border-rose-950/40 text-neutral-400 hover:text-white bg-[#0e070b]'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-xs text-rose-300 block">{p.name}</span>
                      <p className="text-[11px] text-neutral-400 leading-tight">{p.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleExecute()}
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing Document...
              </span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Execute Study Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Output View */}
      <div className="flex-1 p-6 overflow-y-auto flex flex-col">
        {result ? (
          <div className="flex-1 rounded-3xl bg-[#0c0609] border border-rose-950/40 p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-950/30">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  {studyPresets.find((p) => p.id === selectedTask)?.name || 'Study Output'}
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
              </div>
            </div>

            <div className="max-w-none">
              <MarkdownView content={result} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-rose-950/30 bg-[#0a0508]/30 p-8 text-center">
            <GraduationCap className="w-12 h-12 text-rose-500/30 mb-3" />
            <h3 className="text-base font-semibold text-white">Study Workspace Ready</h3>
            <p className="mt-1 text-xs text-neutral-400 max-w-sm">
              Upload notes or paste reading material on the left, then choose a study action (Summary, MCQs, Flashcards, or Schedule).
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
