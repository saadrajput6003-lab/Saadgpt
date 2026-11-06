import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Mic,
  MicOff,
  Volume2,
  Play,
  Pause,
  Download,
  Sparkles,
  FileAudio,
  Radio,
  AlertCircle,
  RefreshCw,
  Waves,
} from 'lucide-react';

export const VoiceStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tts' | 'transcribe' | 'live'>('tts');

  // 1. TTS State
  const [ttsText, setTtsText] = useState('');
  const [voice, setVoice] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [voiceStyle, setVoiceStyle] = useState('Natural, professional and articulate');
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsHistory, setTtsHistory] = useState<any[]>([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // 2. Transcription State
  const [transcribeLoading, setTranscribeLoading] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<string | null>(null);
  const [isRecordingForTranscription, setIsRecordingForTranscription] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 3. Live Voice State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveState, setLiveState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [liveTranscripts, setLiveTranscripts] = useState<Array<{ role: string; text: string }>>([]);
  const speechRecognitionRef = useRef<any>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVoiceHistory();
  }, []);

  const loadVoiceHistory = async () => {
    try {
      const res = await api.getVoiceHistory();
      setTtsHistory(res.audioList || []);
    } catch {}
  };

  // --- TTS ACTIONS ---
  const handleGenerateTTS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ttsText.trim()) return;

    setTtsLoading(true);
    setError(null);

    try {
      const res = await api.textToSpeech(ttsText.trim(), voice, voiceStyle);
      setTtsHistory((prev) => [res.audio, ...prev]);
      playAudio(res.audio.audio_data, res.audio.id);
      setTtsText('');
    } catch (err: any) {
      setError(err.message || 'TTS generation failed.');
    } finally {
      setTtsLoading(false);
    }
  };

  const playAudio = (dataUrl: string, id: string) => {
    if (audioPlayerRef.current) {
      if (playingAudioId === id) {
        audioPlayerRef.current.pause();
        setPlayingAudioId(null);
        return;
      }
      audioPlayerRef.current.src = dataUrl;
      audioPlayerRef.current.play();
      setPlayingAudioId(id);
      audioPlayerRef.current.onended = () => setPlayingAudioId(null);
    }
  };

  // --- TRANSCRIPTION ACTIONS ---
  const startRecordingAudio = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setTranscribeLoading(true);
          try {
            const res = await api.transcribeAudio(base64Audio, 'audio/webm');
            setTranscriptResult(res.transcript);
          } catch (err: any) {
            setError(err.message || 'Transcription failed.');
          } finally {
            setTranscribeLoading(false);
          }
        };
        reader.readAsDataURL(audioBlob);

        // Stop mic tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingForTranscription(true);
    } catch {
      setError('Microphone access denied or audio device not found.');
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && isRecordingForTranscription) {
      mediaRecorderRef.current.stop();
      setIsRecordingForTranscription(false);
    }
  };

  // --- LIVE VOICE MODE ---
  const toggleLiveVoice = () => {
    if (isLiveActive) {
      stopLiveVoice();
    } else {
      startLiveVoice();
    }
  };

  const startLiveVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Live Speech Recognition is not supported by this browser. Try Google Chrome or Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsLiveActive(true);
        setLiveState('listening');
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript.trim()) {
          setLiveTranscripts((prev) => [...prev, { role: 'user', text: transcript }]);
          setLiveState('speaking');

          try {
            // Get quick voice response from AI
            const aiRes = await api.textToSpeech(
              `Respond conversationally to: "${transcript}"`,
              voice,
              'Direct, friendly, concise verbal conversation'
            );

            setLiveTranscripts((prev) => [
              ...prev,
              { role: 'assistant', text: `Voice synthesized with ${voice}` },
            ]);

            const audio = new Audio(aiRes.audio.audio_data);
            audio.onended = () => {
              setLiveState('listening');
            };
            audio.play();
          } catch {
            setLiveState('listening');
          }
        }
      };

      recognition.onerror = (e: any) => {
        setError(`Speech recognition notice: ${e.error}`);
        setLiveState('idle');
      };

      recognition.onend = () => {
        if (isLiveActive) {
          recognition.start();
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (err: any) {
      setError('Failed to initiate live voice session.');
    }
  };

  const stopLiveVoice = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    setIsLiveActive(false);
    setLiveState('idle');

    if (liveTranscripts.length > 0) {
      api.saveVoiceSession(
        'Live Voice Session',
        liveTranscripts.length * 6,
        liveTranscripts.map((t) => `${t.role.toUpperCase()}: ${t.text}`).join('\n')
      );
    }
  };

  const voices = [
    { name: 'Kore', gender: 'Female', desc: 'Warm, articulate, balanced' },
    { name: 'Puck', gender: 'Male', desc: 'Energetic, cheerful, bright' },
    { name: 'Charon', gender: 'Male', desc: 'Deep, resonant, commanding' },
    { name: 'Fenrir', gender: 'Male', desc: 'Crisp, dramatic, authoritative' },
    { name: 'Zephyr', gender: 'Female', desc: 'Calm, gentle, soothing' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070406]">
      {/* Hidden Audio Player Element */}
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Header Tabs */}
      <div className="px-6 py-4 border-b border-rose-950/30 bg-[#0a0508]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400">
            <Volume2 className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SaadGPT Voice &amp; Audio Studio</h2>
            <p className="text-xs text-neutral-400">TTS Audio Synthesis &bull; Transcription &bull; Live Voice</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex rounded-xl bg-neutral-950 p-1 border border-rose-950/40">
          <button
            onClick={() => setActiveTab('tts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'tts' ? 'bg-rose-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Text-to-Speech
          </button>
          <button
            onClick={() => setActiveTab('transcribe')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'transcribe' ? 'bg-rose-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Transcription
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'live' ? 'bg-rose-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Live Conversation
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: TEXT-TO-SPEECH */}
      {activeTab === 'tts' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Controls */}
          <div className="w-full lg:w-96 p-6 border-b lg:border-b-0 lg:border-r border-rose-950/30 overflow-y-auto shrink-0 bg-[#0a0508]/40">
            <form onSubmit={handleGenerateTTS} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Voice Model
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {voices.map((v) => (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setVoice(v.name as any)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition ${
                        voice === v.name
                          ? 'border-rose-500 bg-rose-600/15 text-white'
                          : 'border-rose-950/40 text-neutral-400 hover:text-white bg-[#0e070b]'
                      }`}
                    >
                      <div>
                        <span className="font-semibold text-xs text-rose-300">{v.name}</span>
                        <p className="text-[11px] text-neutral-400">{v.desc}</p>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400">
                        {v.gender}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Speaking Persona &amp; Style
                </label>
                <input
                  type="text"
                  value={voiceStyle}
                  onChange={(e) => setVoiceStyle(e.target.value)}
                  placeholder="e.g. Enthusiastic tech podcast host, calm meditation guide"
                  className="w-full p-2.5 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Text to Synthesize
                </label>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Enter the prose, script, or speech you want SaadGPT to articulate..."
                  rows={5}
                  required
                  className="w-full p-3 rounded-xl glass-input text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={ttsLoading}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {ttsLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Audio Stream...
                  </span>
                ) : (
                  <>
                    <Waves className="w-4 h-4" />
                    <span>Synthesize WAV Speech</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* History & Player Stream */}
          <div className="flex-1 p-6 overflow-y-auto">
            <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
              Synthesized Audio Library ({ttsHistory.length})
            </h3>

            {ttsHistory.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center rounded-2xl border border-rose-950/30 bg-[#0a0508]/30 p-8 text-center">
                <FileAudio className="w-10 h-10 text-rose-500/40 mb-3" />
                <p className="text-xs text-neutral-400">No synthesized audio clips yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ttsHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-[#0c0609] border border-rose-950/40 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => playAudio(item.audio_data, item.id)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0 ${
                          playingAudioId === item.id
                            ? 'bg-rose-600 text-white animate-pulse'
                            : 'bg-rose-950/50 text-rose-400 hover:bg-rose-600 hover:text-white'
                        }`}
                      >
                        {playingAudioId === item.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm text-neutral-200 font-medium truncate">
                          "{item.text}"
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                          <span>Voice: <strong className="text-rose-300">{item.voice}</strong></span>
                          <span>&bull;</span>
                          <span>{new Date(item.created_at).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={item.audio_data}
                      download={`SaadGPT_${item.voice}_Audio.wav`}
                      className="p-2 rounded-lg bg-neutral-900 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-300 transition"
                      title="Download WAV"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SPEECH TRANSCRIPTION */}
      {activeTab === 'transcribe' && (
        <div className="flex-1 p-6 max-w-3xl mx-auto w-full overflow-y-auto space-y-6">
          <div className="p-6 rounded-3xl glass-card border border-rose-950/40 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-950/50 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Mic className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Audio Speech-to-Text Transcription</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                Record directly from your microphone. Gemini 3.5 Transcribe will convert your speech to punctuated text.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              {!isRecordingForTranscription ? (
                <button
                  type="button"
                  onClick={startRecordingAudio}
                  disabled={transcribeLoading}
                  className="px-6 py-3 rounded-full font-semibold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-500 flex items-center gap-2 shadow-lg shadow-rose-950/50"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Microphone Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecordingAudio}
                  className="px-6 py-3 rounded-full font-semibold text-xs sm:text-sm text-white bg-red-600 hover:bg-red-500 animate-pulse flex items-center gap-2 shadow-lg"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Stop &amp; Transcribe</span>
                </button>
              )}
            </div>

            {transcribeLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-rose-300 font-medium">
                <span className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                Transcribing audio with Gemini 3.5 Transcribe...
              </div>
            )}
          </div>

          {transcriptResult && (
            <div className="p-6 rounded-3xl bg-[#0c0609] border border-rose-950/40 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Transcription Output
                </h4>
                <button
                  onClick={() => navigator.clipboard.writeText(transcriptResult)}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Copy Text
                </button>
              </div>
              <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                {transcriptResult}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LIVE VOICE CONVERSATION */}
      {activeTab === 'live' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full text-center">
          {/* Animated Glowing Orb / Visualizer */}
          <div className="relative mb-8">
            <div
              className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-500 ${
                liveState === 'speaking'
                  ? 'bg-rose-600/40 border-2 border-rose-400 shadow-[0_0_60px_rgba(225,29,72,0.8)] scale-110'
                  : liveState === 'listening'
                  ? 'bg-rose-950/40 border-2 border-rose-500/60 shadow-[0_0_40px_rgba(225,29,72,0.4)] animate-pulse'
                  : 'bg-neutral-950 border border-neutral-800'
              }`}
            >
              <Radio
                className={`w-14 h-14 transition-colors ${
                  liveState === 'speaking'
                    ? 'text-white'
                    : liveState === 'listening'
                    ? 'text-rose-400'
                    : 'text-neutral-600'
                }`}
              />
            </div>
          </div>

          <h3 className="text-xl font-bold text-white mb-1">SaadGPT Live Voice Agent</h3>
          <p className="text-xs text-neutral-400 mb-6 max-w-md">
            {liveState === 'listening'
              ? 'Listening to your voice... Speak naturally.'
              : liveState === 'speaking'
              ? 'SaadGPT is speaking...'
              : 'Press start to engage in real-time hands-free voice dialogue.'}
          </p>

          <button
            onClick={toggleLiveVoice}
            className={`px-8 py-3.5 rounded-full font-semibold text-sm transition-all shadow-xl flex items-center gap-2 ${
              isLiveActive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50'
                : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-950/50'
            }`}
          >
            {isLiveActive ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Disconnect Voice</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Connect Live Voice</span>
              </>
            )}
          </button>

          {/* Transcript Feed */}
          {liveTranscripts.length > 0 && (
            <div className="w-full mt-8 p-4 rounded-2xl bg-[#0c0609] border border-rose-950/40 text-left max-h-48 overflow-y-auto space-y-2">
              {liveTranscripts.map((t, idx) => (
                <div key={idx} className="text-xs">
                  <span className="font-semibold text-rose-400 capitalize">{t.role}: </span>
                  <span className="text-neutral-300">{t.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
