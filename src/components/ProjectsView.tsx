import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  MessageSquare,
  FileText,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Briefcase,
  Code,
  GraduationCap,
  Youtube,
  User,
} from 'lucide-react';

interface ProjectsViewProps {
  onSelectProjectChat: (projectId: string, projectName: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onSelectProjectChat }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Project Form Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');
  const [instructions, setInstructions] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.getProjects();
      setProjects(res.projects || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        category,
        instructions: instructions.trim(),
      });
      setProjects((prev) => [res.project, ...prev]);
      setShowModal(false);
      setName('');
      setDescription('');
      setInstructions('');
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Failed to delete project.');
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'school':
      case 'academic':
        return <GraduationCap className="w-5 h-5 text-indigo-400" />;
      case 'coding':
      case 'development':
        return <Code className="w-5 h-5 text-cyan-400" />;
      case 'youtube':
      case 'media':
        return <Youtube className="w-5 h-5 text-red-400" />;
      case 'business':
        return <Briefcase className="w-5 h-5 text-amber-400" />;
      default:
        return <User className="w-5 h-5 text-rose-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 bg-[#070406]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FolderKanban className="w-7 h-7 text-rose-500" />
            <span>Workspace Projects</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Group your domain chats, custom system instructions, and files into sovereign workspaces.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-950/40 flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-rose-950/30 bg-[#0a0508]/40 p-12 text-center my-auto">
          <FolderKanban className="w-14 h-14 text-rose-500/30 mb-4" />
          <h3 className="text-lg font-semibold text-white">No Projects Initialized</h3>
          <p className="text-xs text-neutral-400 max-w-sm mt-1 mb-5">
            Create tailored workspaces (e.g. School, Coding, YouTube, Business) to organize custom instructions, chats, and reference documents.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-[#0c0609] border border-rose-950/40 hover:border-rose-500/40 transition group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800">
                    {getCategoryIcon(p.category)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-900/30">
                      {p.category}
                    </span>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1 rounded text-neutral-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-rose-300 transition">
                  {p.name}
                </h3>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                  {p.description || 'No description provided.'}
                </p>

                {p.instructions && (
                  <div className="mt-3 p-2 rounded-lg bg-black/40 border border-rose-950/30 text-[11px] text-neutral-300 line-clamp-2">
                    <strong className="text-rose-400 font-mono">Rule: </strong>
                    {p.instructions}
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-rose-950/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-neutral-400">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
                    {p.chat_count || 0} chats
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    {p.file_count || 0} files
                  </span>
                </div>

                <button
                  onClick={() => onSelectProjectChat(p.id, p.name)}
                  className="flex items-center gap-1 font-semibold text-rose-400 hover:text-rose-300 transition"
                >
                  <span>Open Chat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md glass-panel rounded-3xl p-6 border border-rose-500/30 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Create New Project Workspace</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Master Thesis or Quantum AI App"
                  required
                  className="w-full p-2.5 rounded-xl glass-input text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Personal">Personal</option>
                  <option value="School">School / Academic</option>
                  <option value="Coding">Coding / Tech</option>
                  <option value="YouTube">YouTube / Content Creation</option>
                  <option value="Business">Business / Startup</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Short Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Goals, timeline, or notes..."
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Custom AI Instructions / Persona
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Always respond in Python, assume high math background, never use filler phrases..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-1/3 py-2.5 rounded-xl text-xs text-neutral-300 hover:bg-neutral-900 border border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-500 transition"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
