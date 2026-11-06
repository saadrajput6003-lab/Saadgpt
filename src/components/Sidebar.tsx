import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Search,
  FolderKanban,
  Image,
  Video,
  Volume2,
  GraduationCap,
  Code2,
  Globe,
  HardDrive,
  Settings,
  LogOut,
  ChevronRight,
  Pin,
  Trash2,
  Edit2,
  Sparkles,
  Download,
  X,
  Menu,
} from 'lucide-react';

export type ActiveView =
  | 'chat'
  | 'image-studio'
  | 'video-studio'
  | 'voice-studio'
  | 'study-mode'
  | 'coding-mode'
  | 'research'
  | 'projects'
  | 'files';

interface SidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  conversations: any[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  user: any;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isInstallable?: boolean;
  onInstallApp?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  user,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  isInstallable,
  onInstallApp,
}) => {
  const [searchChat, setSearchChat] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const navItems: Array<{ id: ActiveView; label: string; icon: any; badge?: string }> = [
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'image-studio', label: 'Image Studio', icon: Image, badge: 'Nano' },
    { id: 'video-studio', label: 'Video Studio', icon: Video, badge: 'Omni' },
    { id: 'voice-studio', label: 'Voice Studio', icon: Volume2, badge: 'TTS' },
    { id: 'study-mode', label: 'Study Mode', icon: GraduationCap },
    { id: 'coding-mode', label: 'Coding Mode', icon: Code2 },
    { id: 'research', label: 'Deep Research', icon: Globe },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'files', label: 'Files Vault', icon: HardDrive },
  ];

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchChat.toLowerCase())
  );

  const handleStartRename = (conv: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setNewTitle(conv.title);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      onRenameConversation(id, newTitle.trim());
    }
    setEditingConvId(null);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 bg-[#090407] border-r border-rose-950/30 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-rose-950/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 via-rose-600 to-red-950 flex items-center justify-center text-white shadow-md shadow-rose-950/50 border border-rose-400/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white block">
                Saad<span className="text-rose-500">GPT</span>
              </span>
              <span className="text-[10px] text-neutral-400 uppercase tracking-widest block font-mono">
                Sovereign Core
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* New Chat Primary Action Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onSelectView('chat');
              onCloseMobile();
            }}
            className="w-full py-2.5 px-3.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.98] transition shadow-lg shadow-rose-950/40 flex items-center justify-between group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>New Conversation</span>
            </span>
            <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded font-mono text-rose-200">
              Ctrl+K
            </span>
          </button>
        </div>

        {/* Primary Studio Navigation */}
        <div className="px-3 pb-2 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                  isActive
                    ? 'bg-rose-600/15 text-rose-300 border border-rose-500/30'
                    : 'text-neutral-400 hover:text-white hover:bg-rose-950/20'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-rose-400' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-900/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chat History Section */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 border-t border-rose-950/30 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Chat Vault ({conversations.length})
            </span>
          </div>

          {/* Search Chats Input */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchChat}
              onChange={(e) => setSearchChat(e.target.value)}
              placeholder="Filter chats..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#0e070b] border border-rose-950/40 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500/50"
            />
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredConversations.length === 0 ? (
              <p className="text-[11px] text-neutral-500 text-center py-4 italic">
                {searchChat ? 'No matching chats found' : 'No previous conversations'}
              </p>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = activeConversationId === conv.id && activeView === 'chat';
                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onSelectView('chat');
                      onCloseMobile();
                    }}
                    className={`group relative p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-rose-600/20 text-white font-medium border border-rose-500/30'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                    }`}
                  >
                    {editingConvId === conv.id ? (
                      <form
                        onSubmit={(e) => handleSaveRename(conv.id, e)}
                        className="flex-1 flex gap-1 mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          autoFocus
                          className="w-full px-2 py-0.5 rounded bg-black border border-rose-500 text-xs text-white"
                        />
                      </form>
                    ) : (
                      <span className="truncate flex-1 pr-2">{conv.title}</span>
                    )}

                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleStartRename(conv, e)}
                        className="p-1 hover:text-white"
                        title="Rename"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        className="p-1 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PWA In-App Install Prompt Button if available */}
        {isInstallable && onInstallApp && (
          <div className="px-3 pt-2">
            <button
              onClick={onInstallApp}
              className="w-full py-2 px-3 rounded-xl border border-rose-500/40 bg-rose-950/20 hover:bg-rose-950/40 text-xs font-semibold text-rose-300 flex items-center justify-center gap-2 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install SaadGPT App</span>
            </button>
          </div>
        )}

        {/* User Profile & Account Footer */}
        <div className="p-3 border-t border-rose-950/30 bg-[#070305]">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-rose-950/20 transition">
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2.5 min-w-0 text-left flex-1"
            >
              <div className="w-8 h-8 rounded-full bg-rose-600/30 border border-rose-500/40 text-rose-200 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.name?.[0]?.toUpperCase() || 'S'}
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-xs text-white block truncate">
                  {user?.name || 'Saad Operator'}
                </span>
                <span className="text-[10px] text-neutral-500 block truncate">
                  {user?.email || 'saad@operator'}
                </span>
              </div>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
