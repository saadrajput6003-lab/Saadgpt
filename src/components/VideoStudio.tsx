import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Video,
  Play,
  Film,
  Sparkles,
  Upload,
  Download,
  Trash2,
  Clock,
  Layers,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronRight,
} from 'lucide-react';

export const VideoStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState('10s');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [cameraMovement, setCameraMovement] = useState('Cinematic Pan & Zoom');
  const [style, setStyle] = useState('Hyper-Realistic Cinematic');

  const [refImage, setRefImage] = useState<string | null>(null);
  const [refMime, setRefMime] = useState<string>('image/png');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [pipelineExplanation, setPipelineExplanation] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const res = await api.getVideos();
      setVideos(res.videos || []);
      if (res.videos && res.videos.length > 0 && !activeJob) {
        setActiveJob(res.videos[0]);
      }
    } catch {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, WEBP) for video animation.');
      return;
    }

    setRefMime(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setRefImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Please provide a video prompt describing the motion, scenery, and subjects.');
      return;
    }

    setLoading(true);
    setError(null);
    setPipelineExplanation(null);

    const fullPrompt = `${prompt} (Camera Movement: ${cameraMovement}, Style: ${style})`;

    try {
      const res = await api.generateVideo({
        prompt: fullPrompt,
        duration,
        resolution,
        aspectRatio,
        referenceImage: refImage || undefined,
        referenceMime: refMime,
      });

      if (res.job) {
        setVideos((prev) => [res.job, ...prev]);
        setActiveJob(res.job);
      }
      if (res.explanation) {
        setPipelineExplanation(res.explanation);
      }
      setPrompt('');
    } catch (err: any) {
      setError(err.message || 'Video generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteVideo(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
      if (activeJob?.id === id) {
        setActiveJob(videos.find((v) => v.id !== id) || null);
      }
    } catch {
      setError('Failed to delete video record.');
    }
  };

  const durationOptions = [
    { label: '5s (Fast)', value: '5s' },
    { label: '10s (Standard)', value: '10s' },
    { label: '15s (Max Single Clip)', value: '15s' },
    { label: '20s (Pipeline Assembly)', value: '20s' },
    { label: '30s (Pipeline Assembly)', value: '30s' },
    { label: '1 min (Multi-Shot Breakdown)', value: '1m' },
    { label: '2 min (Director Scripting)', value: '2m' },
    { label: '3 min (Director Scripting)', value: '3m' },
    { label: '5 min (Cinematic Pipeline)', value: '5m' },
    { label: '7 min (Cinematic Pipeline)', value: '7m' },
    { label: '8 min (Cinematic Pipeline)', value: '8m' },
    { label: '10 min (Full Featurette)', value: '10m' },
    { label: '15 min (Full Featurette)', value: '15m' },
  ];

  const pipelineStages = [
    'User Prompt',
    'Screenplay Script',
    'Scene Breakdown',
    'Shot Generation',
    'Clip Interpolation',
    'Audio Synthesis',
    'Timeline Assembly',
    'Master Export',
  ];

  const isLongForm = duration.includes('m') || parseInt(duration) > 15;

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#070406]">
      {/* LEFT: Controls Panel */}
      <div className="w-full lg:w-[420px] p-4 sm:p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-rose-950/30 bg-[#0a0508]/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400">
            <Video className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SaadGPT Video Studio</h2>
            <p className="text-xs text-neutral-400">Omni Flash Video Synthesis & Pipeline Director</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Reference Image / First Frame */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Starting / Reference Frame (Optional)
              </label>
              {refImage && (
                <button
                  type="button"
                  onClick={() => setRefImage(null)}
                  className="text-[11px] text-rose-400 hover:text-rose-300"
                >
                  Remove Frame
                </button>
              )}
            </div>

            {refImage ? (
              <div className="relative rounded-xl overflow-hidden border border-rose-950/40 h-24 bg-black/60 group">
                <img src={refImage} alt="Reference Frame" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded bg-rose-600 text-xs text-white"
                  >
                    Change Frame
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3.5 border-2 border-dashed border-rose-950/50 hover:border-rose-500/40 rounded-xl flex items-center justify-center gap-2 text-neutral-400 hover:text-neutral-200 bg-[#0d070b]/40 transition"
              >
                <Upload className="w-4 h-4 text-rose-400" />
                <span className="text-xs">Upload Starting Frame (Image-to-Video)</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Video Prompt */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Motion & Scene Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. An astronaut exploring an alien crystal cavern on Mars, glowing crimson stalactites, drone camera panning upwards towards two moons..."
              rows={4}
              required
              className="w-full p-3 rounded-xl glass-input text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Duration Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Target Duration
              </label>
              {isLongForm && (
                <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Multi-Shot Pipeline
                </span>
              )}
            </div>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500"
            >
              {durationOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Real Production Pipeline Architecture Notice for Long-form Videos */}
          {isLongForm && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 text-[11px] text-rose-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>Production Pipeline Architecture</span>
              </div>
              <p className="text-neutral-300 leading-normal">
                Direct single API video clips are architecturally capped by generative video models at 5s–15s. For durations &gt; 15s, SaadGPT executes a full cinematic pipeline: Scripting &rarr; Scene Breakdown &rarr; Individual Shot Generation &rarr; Timeline Assembly.
              </p>
            </div>
          )}

          {/* Aspect Ratio & Resolution */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Aspect Ratio
              </label>
              <div className="flex rounded-xl bg-neutral-950 p-1 border border-rose-950/40">
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                    aspectRatio === '16:9' ? 'bg-rose-600 text-white' : 'text-neutral-400'
                  }`}
                >
                  16:9 Landscape
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                    aspectRatio === '9:16' ? 'bg-rose-600 text-white' : 'text-neutral-400'
                  }`}
                >
                  9:16 Portrait
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Resolution
              </label>
              <div className="flex rounded-xl bg-neutral-950 p-1 border border-rose-950/40">
                <button
                  type="button"
                  onClick={() => setResolution('720p')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                    resolution === '720p' ? 'bg-rose-600 text-white' : 'text-neutral-400'
                  }`}
                >
                  720p HD
                </button>
                <button
                  type="button"
                  onClick={() => setResolution('1080p')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                    resolution === '1080p' ? 'bg-rose-600 text-white' : 'text-neutral-400'
                  }`}
                >
                  1080p FHD
                </button>
              </div>
            </div>
          </div>

          {/* Camera Motion & Style */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Camera Movement
            </label>
            <select
              value={cameraMovement}
              onChange={(e) => setCameraMovement(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="Cinematic Pan & Zoom">Cinematic Pan &amp; Zoom</option>
              <option value="Slow Tracking Forward">Slow Tracking Forward</option>
              <option value="Dynamic Drone Flyover">Dynamic Drone Flyover</option>
              <option value="Orbiting 360 Subject">Orbiting 360 Subject</option>
              <option value="Static Tripod Fixed">Static Tripod Fixed</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.99] transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Rendering Omni Flash Video...
              </span>
            ) : (
              <>
                <Film className="w-4 h-4" />
                <span>Initialize Video Generation</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* RIGHT: Live Video Viewport & Pipeline Stage Status */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Pipeline Notice if active */}
        {pipelineExplanation && (
          <div className="mb-4 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200">
            <h4 className="font-semibold text-rose-300 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              Pipeline Execution Report
            </h4>
            <p className="text-neutral-300 leading-relaxed">{pipelineExplanation}</p>
          </div>
        )}

        {/* Video Player or Job Status Card */}
        {activeJob ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0508]/80 rounded-3xl border border-rose-950/40 overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b border-rose-950/30 bg-[#0d070b] flex items-center justify-between text-xs text-neutral-300">
              <span className="truncate max-w-md font-medium text-neutral-200">
                "{activeJob.prompt}"
              </span>
              <div className="flex items-center gap-2">
                {activeJob.result_url && (
                  <a
                    href={activeJob.result_url}
                    download="SaadGPT_Generated_Video.mp4"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-200 hover:text-white transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(activeJob.id)}
                  className="p-1.5 rounded-lg hover:bg-red-950/50 text-neutral-400 hover:text-red-400 transition"
                  title="Delete Record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Video or Production Flow Container */}
            <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-hidden bg-black/40">
              {activeJob.result_url ? (
                <video
                  src={activeJob.result_url}
                  controls
                  autoPlay
                  loop
                  className="max-w-full max-h-full rounded-2xl shadow-2xl border border-rose-950/50"
                />
              ) : (
                <div className="w-full max-w-lg p-6 rounded-2xl bg-[#0f070b] border border-rose-950/40 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
                    <Film className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white capitalize">
                      Job State: {activeJob.status}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1">
                      Step: <span className="font-mono text-rose-300">{activeJob.pipeline_step || 'queued'}</span>
                    </p>
                  </div>

                  {/* Production Pipeline Progress Visualization */}
                  <div className="pt-2 border-t border-rose-950/30 text-left space-y-2">
                    <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      SaadGPT Real Production Pipeline
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {pipelineStages.map((stage, idx) => (
                        <div
                          key={stage}
                          className="p-2 rounded-lg bg-[#070305] border border-rose-950/30 text-[10px] text-neutral-400 flex items-center gap-1.5"
                        >
                          <span className="w-4 h-4 rounded-full bg-rose-600/30 text-rose-300 flex items-center justify-center shrink-0 font-mono text-[9px]">
                            {idx + 1}
                          </span>
                          <span className="truncate">{stage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status Footer */}
            <div className="px-5 py-2.5 border-t border-rose-950/30 bg-[#0c070a] flex items-center justify-between text-[11px] text-neutral-400">
              <div className="flex items-center gap-4">
                <span>Duration: <strong className="text-neutral-200">{activeJob.duration}</strong></span>
                <span>Resolution: <strong className="text-neutral-200">{activeJob.resolution}</strong></span>
                <span>Aspect: <strong className="text-neutral-200">{activeJob.aspect_ratio}</strong></span>
              </div>
              <span>{new Date(activeJob.created_at).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-rose-950/30 bg-[#0a0508]/40 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/30 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <Film className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-white">No Generated Videos Yet</h3>
            <p className="mt-1 text-xs text-neutral-400 max-w-sm">
              Create video clips or multi-shot assembly sequences using Gemini Omni Flash video intelligence.
            </p>
          </div>
        )}

        {/* History Strip */}
        <div className="mt-4 pt-3 border-t border-rose-950/30">
          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2">
            Video Generation Jobs &amp; Archive ({videos.length})
          </span>
          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {videos.map((vid) => (
              <button
                key={vid.id}
                type="button"
                onClick={() => setActiveJob(vid)}
                className={`p-3 rounded-xl border text-left shrink-0 w-48 bg-[#0c0609] transition ${
                  activeJob?.id === vid.id
                    ? 'border-rose-500 ring-2 ring-rose-500/30'
                    : 'border-rose-950/40 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-1">
                  <span className="font-mono text-rose-300">{vid.duration}</span>
                  <span className="capitalize">{vid.status}</span>
                </div>
                <p className="text-xs text-white truncate font-medium">{vid.prompt}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
