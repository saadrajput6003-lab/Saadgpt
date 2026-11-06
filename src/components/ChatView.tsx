import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { MarkdownView } from './MarkdownView';
import { CameraModal } from './CameraModal';
import {
  Send,
  Square,
  Paperclip,
  Camera,
  Mic,
  MicOff,
  Sparkles,
  Globe,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  ChevronDown,
  FileText,
  AlertCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Heart,
} from 'lucide-react';

interface ChatViewProps {
  conversationId: string | null;
  onConversationCreated: (conv: any) => void;
  onSelectProject?: (projectId: string) => void;
  currentProject?: { id: string; name: string } | null;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversationId,
  onConversationCreated,
  currentProject,
}) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [enableSearch, setEnableSearch] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<
    Array<{ name: string; mimeType: string; data: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals & Camera
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Streaming & Loading state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingDelta, setStreamingDelta] = useState('');
  const [streamingSources, setStreamingSources] = useState<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Audio Playback
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Editing user message
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Voice recording for composer
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingDelta]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async (id: string) => {
    try {
      const res = await api.getConversation(id);
      setMessages(res.messages || []);
      if (res.conversation?.model) {
        setModel(res.conversation.model);
      }
    } catch (err: any) {
      setError('Failed to load conversation messages.');
    }
  };

  // Send message
  const handleSend = async (customMessage?: string, overrideModel?: string) => {
    const textToSend = (customMessage !== undefined ? customMessage : inputText).trim();
    if (!textToSend && attachments.length === 0) return;

    const activeModel = overrideModel || model;
    if (overrideModel && overrideModel !== model) {
      setModel(overrideModel);
    }

    setLastPrompt(textToSend);
    setError(null);
    setInputText('');
    const currentAttachments = [...attachments];
    setAttachments([]);

    // Avoid duplicate user message in log if retrying the same prompt
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: textToSend,
      metadata: currentAttachments.length > 0 ? { attachments: currentAttachments } : null,
      created_at: Date.now(),
    };

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'user' && last.content === textToSend) {
        return prev;
      }
      return [...prev, tempUserMsg];
    });

    setIsStreaming(true);
    setStreamingDelta('');
    setStreamingSources([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await api.streamChat(
        {
          conversationId: conversationId || undefined,
          message: textToSend,
          attachments: currentAttachments,
          model: activeModel,
          enableSearch,
          mode: 'chat',
        },
        {
          onStart: (data) => {
            if (!conversationId) {
              onConversationCreated({ id: data.conversationId, title: textToSend.slice(0, 30) });
            }
          },
          onChunk: (delta, sources) => {
            setStreamingDelta((prev) => prev + delta);
            if (sources && sources.length > 0) {
              setStreamingSources(sources);
            }
          },
          onDone: (data) => {
            const assistantMsg = {
              id: data.messageId,
              role: 'model',
              content: data.fullText,
              metadata: data.sources && data.sources.length > 0 ? { sources: data.sources } : null,
              created_at: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setIsStreaming(false);
            setStreamingDelta('');
            setStreamingSources([]);
          },
          onError: (streamErr) => {
            setError(streamErr);
            setIsStreaming(false);
          },
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error occurred while contacting AI model.');
      }
      setIsStreaming(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    if (streamingDelta) {
      // Keep partial response
      setMessages((prev) => [
        ...prev,
        {
          id: `partial-${Date.now()}`,
          role: 'model',
          content: `${streamingDelta}\n\n*[Generation stopped by user]*`,
          metadata: streamingSources.length > 0 ? { sources: streamingSources } : null,
          created_at: Date.now(),
        },
      ]);
      setStreamingDelta('');
      setStreamingSources([]);
    }
  };

  const handleRegenerate = () => {
    if (messages.length === 0 || isStreaming) return;
    // Find last user message
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      handleSend(lastUserMsg.content);
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await api.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError('Failed to delete message.');
    }
  };

  const handleReaction = async (msgId: string, reactionType: 'like' | 'dislike' | 'heart') => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg) return;

    const nextReaction = targetMsg.reaction === reactionType ? null : reactionType;

    // Optimistic UI update
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, reaction: nextReaction } : m))
    );

    try {
      await api.reactToMessage(msgId, nextReaction);
    } catch {
      // Revert on failure
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reaction: targetMsg.reaction } : m))
      );
      setError('Failed to record reaction.');
    }
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editContent.trim()) return;
    setEditingMsgId(null);
    handleSend(editContent);
  };

  const handleSpeakAloud = async (text: string, msgId: string) => {
    if (playingMsgId === msgId && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingMsgId(null);
      return;
    }

    try {
      const res = await api.textToSpeech(text.slice(0, 500));
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = res.audio.audio_data;
        audioPlayerRef.current.play();
        setPlayingMsgId(msgId);
        audioPlayerRef.current.onended = () => setPlayingMsgId(null);
      }
    } catch {
      setError('Speech playback failed.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: reader.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const toggleVoiceRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Voice dictation is not supported on this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setInputText((prev) => (prev ? `${prev} ${text}` : text));
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch {
      setError('Could not start microphone dictation.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070406] relative">
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Top Bar: Model Selector, Web Search Grounding Toggle, Project context */}
      <div className="px-4 sm:px-6 py-3 border-b border-rose-950/30 bg-[#0a0508]/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-xl bg-[#0f070b] border border-rose-950/50 hover:border-rose-500/40 text-xs font-semibold text-rose-200 focus:outline-none cursor-pointer transition"
            >
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Ultra-Fast Core)</option>
              <option value="gemini-4-argon">Gemini 4 Argon (Deep Reasoning / STEM)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Low Latency)</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          </div>

          {/* Project indicator badge */}
          {currentProject && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Project: {currentProject.name}
            </span>
          )}
        </div>

        {/* Right Tools: Web Search Grounding Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEnableSearch(!enableSearch)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              enableSearch
                ? 'bg-rose-600/20 text-rose-300 border-rose-500/50 shadow-md shadow-rose-950/30'
                : 'bg-[#0f070b] text-neutral-400 border-rose-950/40 hover:text-white'
            }`}
            title="Toggle Google Search Real-Time Grounding"
          >
            <Globe className={`w-3.5 h-3.5 ${enableSearch ? 'text-rose-400' : ''}`} />
            <span className="hidden sm:inline">Web Grounding</span>
          </button>
        </div>
      </div>

      {/* Error Banner with 1-Click Recovery Actions */}
      {error && (
        <div className="mx-4 sm:mx-6 mt-3 p-3.5 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs shadow-lg shadow-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5 sm:mt-0" />
            <span className="font-medium text-red-100">{error}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {lastPrompt && !isStreaming && (
              <>
                <button
                  type="button"
                  onClick={() => handleSend(lastPrompt)}
                  className="px-3 py-1.5 rounded-lg bg-red-900/70 hover:bg-red-800 text-white font-medium text-xs flex items-center gap-1.5 transition border border-red-700/50"
                  title="Retry sending last message"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                {model !== 'gemini-3.1-flash-lite' && (
                  <button
                    type="button"
                    onClick={() => handleSend(lastPrompt, 'gemini-3.1-flash-lite')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
                    title="Switch to Gemini 3.1 Flash Lite and retry immediately"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Try Flash Lite</span>
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-white p-1 rounded-lg hover:bg-red-900/40 transition"
              title="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-600 via-rose-700 to-red-950 flex items-center justify-center text-white shadow-[0_0_35px_rgba(225,29,72,0.4)] border border-rose-400/30">
                <Sparkles className="w-8 h-8" />
              </div>
            </div>
            <h2 className="text-2xl font-extrabold text-white">
              What shall we conquer today?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-neutral-400 max-w-sm">
              SaadGPT is configured with multi-modal vision, real-time Google search grounding, and deep technical reasoning.
            </p>

            {/* Quick Prompt Starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full text-left">
              {[
                'Analyze the quantum mechanics of topological insulators',
                'Write a production-grade distributed rate limiter in Go',
                'Design a 5-scene cinematic screenplay about Mars colonizers',
                'Review my uploaded document for critical counter-arguments',
              ].map((starter, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(starter)}
                  className="p-3 rounded-2xl bg-[#0c0609] border border-rose-950/40 hover:border-rose-500/40 text-xs text-neutral-300 hover:text-white transition group"
                >
                  <p className="line-clamp-2 leading-relaxed">{starter}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 sm:gap-4 max-w-3xl mx-auto ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-red-950 border border-rose-500/30 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`flex-1 rounded-2xl p-4 sm:p-5 relative group transition ${
                  msg.role === 'user'
                    ? 'max-w-[85%] bg-rose-600/15 border border-rose-500/30 text-white shadow-lg'
                    : 'bg-[#0c0609] border border-rose-950/40 shadow-xl'
                }`}
              >
                {/* User Attachment previews */}
                {msg.metadata?.attachments && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {msg.metadata.attachments.map((att: any, idx: number) => (
                      <div key={idx} className="rounded-xl overflow-hidden border border-rose-950/40 bg-black/40">
                        {att.mimeType?.startsWith('image/') ? (
                          <img src={att.data} alt="" className="max-h-48 max-w-xs object-cover rounded-lg" />
                        ) : (
                          <div className="p-2.5 flex items-center gap-2 text-xs text-rose-300">
                            <FileText className="w-4 h-4" />
                            <span className="truncate max-w-[150px]">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Body or Edit Field */}
                {editingMsgId === msg.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full p-2.5 rounded-xl glass-input text-xs text-white resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingMsgId(null)}
                        className="px-2.5 py-1 text-xs text-neutral-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(msg.id)}
                        className="px-3 py-1 rounded-lg bg-rose-600 text-xs font-semibold text-white"
                      >
                        Save &amp; Resend
                      </button>
                    </div>
                  </div>
                ) : (
                  <MarkdownView content={msg.content} />
                )}

                {/* Web Grounding Citations */}
                {msg.metadata?.sources && msg.metadata.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-rose-950/30">
                    <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-rose-400" />
                      Verified Sources:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.metadata.sources.map((s: any, idx: number) => (
                        <a
                          key={idx}
                          href={s.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/50 border border-rose-950/40 text-[10px] text-neutral-300 hover:text-rose-300"
                        >
                          <ExternalLink className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                          <span className="truncate max-w-[160px]">{s.title || s.uri}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Bar */}
                <div className={`mt-3 flex items-center justify-between gap-2 text-neutral-400 transition-opacity ${
                  msg.reaction ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                }`}>
                  {/* Left: Reactions for AI messages */}
                  {msg.role === 'model' ? (
                    <div className="flex items-center gap-1 bg-[#10070d]/80 rounded-xl p-1 border border-rose-950/40">
                      {/* Like */}
                      <button
                        type="button"
                        onClick={() => handleReaction(msg.id, 'like')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition cursor-pointer ${
                          msg.reaction === 'like'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 shadow-sm font-semibold'
                            : 'text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800/60'
                        }`}
                        title={msg.reaction === 'like' ? 'Liked (click to remove)' : 'Like this response'}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${msg.reaction === 'like' ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                        <span className="text-[11px] font-mono hidden sm:inline">Like</span>
                      </button>

                      {/* Dislike */}
                      <button
                        type="button"
                        onClick={() => handleReaction(msg.id, 'dislike')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition cursor-pointer ${
                          msg.reaction === 'dislike'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 shadow-sm font-semibold'
                            : 'text-neutral-400 hover:text-amber-300 hover:bg-neutral-800/60'
                        }`}
                        title={msg.reaction === 'dislike' ? 'Disliked (click to remove)' : 'Dislike this response'}
                      >
                        <ThumbsDown className={`w-3.5 h-3.5 ${msg.reaction === 'dislike' ? 'fill-amber-400 text-amber-400' : ''}`} />
                        <span className="text-[11px] font-mono hidden sm:inline">Dislike</span>
                      </button>

                      {/* Heart */}
                      <button
                        type="button"
                        onClick={() => handleReaction(msg.id, 'heart')}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition cursor-pointer ${
                          msg.reaction === 'heart'
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40 shadow-sm font-semibold'
                            : 'text-neutral-400 hover:text-rose-300 hover:bg-neutral-800/60'
                        }`}
                        title={msg.reaction === 'heart' ? 'Loved (click to remove)' : 'Heart this response'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${msg.reaction === 'heart' ? 'fill-rose-500 text-rose-400' : ''}`} />
                        <span className="text-[11px] font-mono hidden sm:inline">Love</span>
                      </button>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Right: Message Utility Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => navigator.clipboard.writeText(msg.content)}
                      className="p-1 rounded hover:bg-neutral-800 hover:text-white transition"
                      title="Copy Text"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleSpeakAloud(msg.content, msg.id)}
                      className={`p-1 rounded hover:bg-neutral-800 transition ${
                        playingMsgId === msg.id ? 'text-rose-400' : 'hover:text-white'
                      }`}
                      title="Speak Aloud"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    {msg.role === 'user' && (
                      <button
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditContent(msg.content);
                        }}
                        className="p-1 rounded hover:bg-neutral-800 hover:text-white transition"
                        title="Edit Message"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {msg.role === 'model' && (
                      <button
                        onClick={handleRegenerate}
                        className="p-1 rounded hover:bg-neutral-800 hover:text-white transition"
                        title="Regenerate Response"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-1 rounded hover:bg-red-950/40 hover:text-red-400 transition"
                      title="Delete Message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-rose-300 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Live Streaming Assistant Message */}
        {isStreaming && (
          <div className="flex gap-3 sm:gap-4 max-w-3xl mx-auto justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-600 to-red-950 border border-rose-500/30 flex items-center justify-center text-white shrink-0 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>

            <div className="flex-1 rounded-2xl p-4 sm:p-5 bg-[#0c0609] border border-rose-500/30 shadow-xl">
              <MarkdownView content={streamingDelta || 'Synthesizing response...'} />
              <span className="inline-block w-2 h-4 bg-rose-500 ml-1 animate-pulse" />

              {streamingSources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-rose-950/30 flex flex-wrap gap-1">
                  {streamingSources.map((s, idx) => (
                    <span key={idx} className="text-[10px] text-rose-400 truncate max-w-[180px]">
                      &bull; {s.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* BOTTOM COMPOSER */}
      <div className="p-4 sm:p-5 border-t border-rose-950/30 bg-[#090407]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Attachment Preview Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2"
                >
                  <span className="truncate max-w-[180px]">{att.name}</span>
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main Input Box */}
          <div className="relative rounded-2xl glass-input p-2 sm:p-3 border border-rose-500/20 focus-within:border-rose-500 transition-colors shadow-lg shadow-black/60 flex flex-col">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask SaadGPT anything, upload documents, or press mic to speak..."
              rows={2}
              className="w-full bg-transparent text-white text-xs sm:text-sm placeholder:text-neutral-500 focus:outline-none resize-none px-1"
            />

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between pt-2 border-t border-rose-950/20 mt-1">
              <div className="flex items-center gap-1 sm:gap-2">
                {/* File Attachment */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-rose-300 hover:bg-rose-950/30 transition"
                  title="Upload Image, PDF, or Document"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Camera Button */}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-rose-300 hover:bg-rose-950/30 transition"
                  title="Capture Vision Photo"
                >
                  <Camera className="w-4 h-4" />
                </button>

                {/* Voice Dictation */}
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`p-1.5 sm:p-2 rounded-xl transition ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'text-neutral-400 hover:text-rose-300 hover:bg-rose-950/30'
                  }`}
                  title="Voice Input"
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              {/* Send or Stop Button */}
              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-red-950/50"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!inputText.trim() && attachments.length === 0}
                  className="p-2 sm:px-4 sm:py-2 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.98] transition shadow-lg shadow-rose-950/50 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="hidden sm:inline">Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono">Shift+Enter</kbd> for newline</span>
            <span className="hidden sm:inline">Server-side isolated AI proxy</span>
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(data, mime) => {
          setAttachments((prev) => [
            ...prev,
            { name: `Snapshot_${Date.now()}.jpg`, mimeType: mime, data },
          ]);
        }}
      />
    </div>
  );
};
