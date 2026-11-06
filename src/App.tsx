/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api, authStorage, setUnauthorizedHandler } from './services/api';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar, ActiveView } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { ImageStudio } from './components/ImageStudio';
import { VideoStudio } from './components/VideoStudio';
import { VoiceStudio } from './components/VoiceStudio';
import { StudyMode } from './components/StudyMode';
import { CodingMode } from './components/CodingMode';
import { ResearchMode } from './components/ResearchMode';
import { ProjectsView } from './components/ProjectsView';
import { FilesView } from './components/FilesView';
import { SettingsModal } from './components/SettingsModal';
import { usePWAInstall, useOnlineStatus } from './hooks/usePWAInstall';
import {
  Menu,
  Sparkles,
  WifiOff,
  Download,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // App Navigation & Views
  const [activeView, setActiveView] = useState<ActiveView>('chat');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Conversations
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null);

  // PWA & Offline hooks
  const { isInstallable, install: installPWA } = usePWAInstall();
  const isOnline = useOnlineStatus();

  // Check auth on load
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });

    const verifyExistingAuth = async () => {
      const token = authStorage.getToken();
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const res = await api.getMe();
        setUser(res.user);
        loadConversations();
      } catch {
        authStorage.clearToken();
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    };

    verifyExistingAuth();
  }, []);

  const loadConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations || []);
    } catch {}
  };

  const handleAuthenticated = (authedUser: any) => {
    setUser(authedUser);
    loadConversations();
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setActiveConversationId(null);
    setConversations([]);
    setIsSettingsOpen(false);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setCurrentProject(null);
    setActiveView('chat');
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    } catch {}
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await api.updateConversation(id, { title: newTitle });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
    } catch {}
  };

  const handleSelectProjectChat = (projectId: string, projectName: string) => {
    setCurrentProject({ id: projectId, name: projectName });
    setActiveConversationId(null);
    setActiveView('chat');
  };

  // Loading Splash
  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#070406]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-950 flex items-center justify-center text-white shadow-[0_0_30px_rgba(225,29,72,0.4)] animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="text-xs uppercase tracking-widest text-rose-300 font-mono">
            Initializing SaadGPT Vault...
          </span>
        </div>
      </div>
    );
  }

  // 1. Mandatory First Screen: Authentication
  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  // 2. Main SaadGPT Application Dashboard
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070406] text-white">
      {/* Offline Status Warning Banner */}
      {!isOnline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-600/90 text-white text-xs font-semibold shadow-xl flex items-center gap-2 backdrop-blur-md">
          <WifiOff className="w-4 h-4" />
          <span>Offline mode active. Using cached data.</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
        user={user}
        onLogout={handleLogout}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isInstallable={isInstallable}
        onInstallApp={installPWA}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Mobile Top Header */}
        <header className="lg:hidden px-4 py-3 border-b border-rose-950/30 bg-[#0a0508]/80 backdrop-blur-md flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">
                Saad<span className="text-rose-500">GPT</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-300 font-mono uppercase">
                {activeView.replace('-', ' ')}
              </span>
            </div>
          </div>

          {isInstallable && (
            <button
              onClick={installPWA}
              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40"
              title="Install App"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </header>

        {/* Dynamic Studio & Mode Router */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeView === 'chat' && (
            <ChatView
              conversationId={activeConversationId}
              onConversationCreated={(conv) => {
                setConversations((prev) => [conv, ...prev]);
                setActiveConversationId(conv.id);
              }}
              currentProject={currentProject}
            />
          )}

          {activeView === 'image-studio' && <ImageStudio />}

          {activeView === 'video-studio' && <VideoStudio />}

          {activeView === 'voice-studio' && <VoiceStudio />}

          {activeView === 'study-mode' && <StudyMode />}

          {activeView === 'coding-mode' && <CodingMode />}

          {activeView === 'research' && <ResearchMode />}

          {activeView === 'projects' && (
            <ProjectsView onSelectProjectChat={handleSelectProjectChat} />
          )}

          {activeView === 'files' && <FilesView />}
        </main>
      </div>

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onUserUpdated={setUser}
        onLogout={handleLogout}
      />
    </div>
  );
}
