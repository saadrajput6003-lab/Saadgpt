import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Settings,
  X,
  User,
  Brain,
  Shield,
  Download,
  Trash2,
  Lock,
  Moon,
  Volume2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sliders,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUserUpdated: (user: any) => void;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  user,
  onUserUpdated,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<'account' | 'ai' | 'memory' | 'data'>('account');

  // Account State
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Settings State
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [defaultVoice, setDefaultVoice] = useState('Kore');
  const [streamSpeed, setStreamSpeed] = useState('normal');

  // Memories State
  const [memories, setMemories] = useState<any[]>([]);
  const [newMemory, setNewMemory] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettingsAndMemories();
    }
  }, [isOpen]);

  const loadSettingsAndMemories = async () => {
    try {
      const [settingsRes, memRes] = await Promise.all([
        api.getSettings(),
        api.getMemories(),
      ]);
      if (settingsRes.settings) {
        setMemoryEnabled(Boolean(settingsRes.settings.memory_enabled));
        setDefaultVoice(settingsRes.settings.default_voice || 'Kore');
        setStreamSpeed(settingsRes.settings.stream_speed || 'normal');
      }
      setMemories(memRes.memories || []);
    } catch {}
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await api.updateProfile({ name });
      onUserUpdated({ ...user, name });
      setMessage('Profile updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await api.changePassword(currentPassword, newPassword);
      setMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAISettings = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await api.updateSettings({
        memory_enabled: memoryEnabled,
        default_voice: defaultVoice,
        stream_speed: streamSpeed,
      });
      setMessage('AI preferences saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;

    try {
      const res = await api.addMemory(newMemory.trim());
      setMemories((prev) => [res.memory, ...prev]);
      setNewMemory('');
    } catch {
      setError('Failed to record memory.');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError('Failed to delete memory.');
    }
  };

  const handleClearAllMemories = async () => {
    if (!confirm('Are you sure you want to clear all learned memories?')) return;
    try {
      await api.clearMemories();
      setMemories([]);
    } catch {
      setError('Failed to clear memories.');
    }
  };

  const handleExportData = async () => {
    try {
      const res = await api.exportData();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SaadGPT_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export data.');
    }
  };

  const handleClearAllChats = async () => {
    if (!confirm('Permanently delete all chat conversations? This cannot be undone.')) return;
    try {
      await api.clearChats();
      setMessage('All chat history deleted.');
    } catch {
      setError('Failed to delete chats.');
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        'CRITICAL WARNING: This will permanently delete your account, projects, generated media, and all private data. Proceed?'
      )
    )
      return;

    try {
      await api.deleteAccount();
      onLogout();
    } catch {
      setError('Failed to delete account.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-2xl glass-panel rounded-3xl overflow-hidden border border-rose-500/30 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rose-950/40 bg-[#0e070b] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-white">SaadGPT Settings &amp; Preferences</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-rose-950/40 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-rose-950/30 bg-[#090407] px-6 text-xs">
          {[
            { id: 'account', label: 'User Account', icon: User },
            { id: 'ai', label: 'AI Preferences', icon: Sliders },
            { id: 'memory', label: 'AI Memories', icon: Brain },
            { id: 'data', label: 'Data & Privacy', icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSection(tab.id as any);
                  setError(null);
                  setMessage(null);
                }}
                className={`py-3 px-4 font-medium flex items-center gap-2 border-b-2 transition ${
                  activeSection === tab.id
                    ? 'border-rose-500 text-white font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon className="w-4 h-4 text-rose-400" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback Messages */}
        <div className="px-6 pt-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{message}</span>
            </div>
          )}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* SECTION 1: ACCOUNT */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Profile Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-300 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-500 cursor-not-allowed"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition"
                >
                  Save Profile
                </button>
              </form>

              <hr className="border-rose-950/30" />

              <form onSubmit={handleChangePassword} className="space-y-3">
                <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Change Password
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-300 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-300 mb-1">New Password (min 6)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 rounded-xl glass-input text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 transition"
                >
                  Update Password
                </button>
              </form>
            </div>
          )}

          {/* SECTION 2: AI PREFERENCES */}
          {activeSection === 'ai' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#0c0609] border border-rose-950/40">
                <div>
                  <span className="text-xs font-semibold text-white block">Persistent AI Memory</span>
                  <p className="text-[11px] text-neutral-400">
                    Allow SaadGPT to remember personal preferences and context across chats.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={memoryEnabled}
                  onChange={(e) => setMemoryEnabled(e.target.checked)}
                  className="w-5 h-5 accent-rose-600 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Default Speech Synthesizer Voice
                </label>
                <select
                  value={defaultVoice}
                  onChange={(e) => setDefaultVoice(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl glass-input text-xs text-white focus:outline-none"
                >
                  <option value="Kore">Kore (Warm, Balanced, Articulate - Female)</option>
                  <option value="Puck">Puck (Cheerful, Energetic - Male)</option>
                  <option value="Charon">Charon (Deep, Authoritative - Male)</option>
                  <option value="Fenrir">Fenrir (Dramatic, Powerful - Male)</option>
                  <option value="Zephyr">Zephyr (Calm, Serene - Female)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Chat Streaming Velocity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['fast', 'normal', 'steady'].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setStreamSpeed(speed)}
                      className={`py-2 rounded-xl text-xs font-medium capitalize border transition ${
                        streamSpeed === speed
                          ? 'border-rose-500 bg-rose-600/20 text-white'
                          : 'border-rose-950/40 text-neutral-400 bg-[#0e070b]'
                      }`}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveAISettings}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition"
              >
                Apply AI Preferences
              </button>
            </div>
          )}

          {/* SECTION 3: MEMORY */}
          {activeSection === 'memory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                    Learned Memory Vault ({memories.length})
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    Facts SaadGPT stores to personalize its responses to you.
                  </p>
                </div>
                {memories.length > 0 && (
                  <button
                    onClick={handleClearAllMemories}
                    className="text-[11px] text-red-400 hover:text-red-300"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <form onSubmit={handleAddMemory} className="flex gap-2">
                <input
                  type="text"
                  value={newMemory}
                  onChange={(e) => setNewMemory(e.target.value)}
                  placeholder="e.g. My primary tech stack is React and Go..."
                  className="flex-1 p-2 rounded-xl glass-input text-xs text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition shrink-0"
                >
                  Add Memory
                </button>
              </form>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {memories.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic py-4 text-center">
                    No active memories saved.
                  </p>
                ) : (
                  memories.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 rounded-xl bg-[#0c0609] border border-rose-950/40 flex items-center justify-between text-xs"
                    >
                      <span className="text-neutral-200">{m.content}</span>
                      <button
                        onClick={() => handleDeleteMemory(m.id)}
                        className="text-neutral-500 hover:text-red-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SECTION 4: DATA & PRIVACY */}
          {activeSection === 'data' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#0c0609] border border-rose-950/40 space-y-3">
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Full Workspace Backup
                </h4>
                <p className="text-xs text-neutral-400">
                  Export all your conversations, system instructions, memories, generated media references, and account profiles into a secure JSON archive.
                </p>
                <button
                  type="button"
                  onClick={handleExportData}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 flex items-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Complete Backup (.json)</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/30 space-y-3">
                <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                  Danger Zone
                </h4>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div>
                    <span className="text-xs font-medium text-neutral-200 block">Delete All Chats</span>
                    <span className="text-[11px] text-neutral-400">Wipe all conversation histories permanently.</span>
                  </div>
                  <button
                    onClick={handleClearAllChats}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-red-300 border border-red-500/40 hover:bg-red-950/50 transition"
                  >
                    Delete Chats
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-red-950/40">
                  <div>
                    <span className="text-xs font-medium text-red-300 block">Terminate Account</span>
                    <span className="text-[11px] text-neutral-400">Irreversibly delete account and database records.</span>
                  </div>
                  <button
                    onClick={handleDeleteAccount}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-rose-950/40 bg-[#0a0508] flex items-center justify-between text-xs">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-rose-400 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Secure Log Out</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
