import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  Sparkles,
  Download,
  Trash2,
  Upload,
  Image as ImageIcon,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
} from 'lucide-react';

export const ImageStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [quality, setQuality] = useState<'standard' | 'high'>('standard');
  const [style, setStyle] = useState('Photorealistic');
  const [operationType, setOperationType] = useState<string>('text-to-image');

  // Reference image for image-to-image / editing / variation / background mod
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refMime, setRefMime] = useState<string>('image/png');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<any | null>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const res = await api.getImages();
      setImages(res.images || []);
      if (res.images && res.images.length > 0 && !activeImage) {
        setActiveImage(res.images[0]);
      }
    } catch {}
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WEBP).');
      return;
    }

    setRefMime(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setRefImage(reader.result as string);
      if (operationType === 'text-to-image') {
        setOperationType('image-to-image');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError('Please describe the image you want to create or edit.');
      return;
    }

    setLoading(true);
    setError(null);

    // Build enhanced prompt based on creative operation
    let fullPrompt = prompt.trim();
    if (operationType === 'variation') {
      fullPrompt = `Generate creative variation of the reference image: ${prompt}`;
    } else if (operationType === 'background-mod') {
      fullPrompt = `Modify background while preserving foreground subject: ${prompt}`;
    } else if (operationType === 'enhancement') {
      fullPrompt = `Enhance details, lighting, sharpness, and high dynamic range: ${prompt}`;
    }

    try {
      const res = await api.generateImage({
        prompt: fullPrompt,
        aspectRatio,
        referenceImage: refImage || undefined,
        referenceMime: refMime,
        quality,
        style,
      });

      setImages((prev) => [res.image, ...prev]);
      setActiveImage(res.image);
      setPrompt('');
    } catch (err: any) {
      setError(err.message || 'Image generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (activeImage?.id === id) {
        setActiveImage(images.find((img) => img.id !== id) || null);
      }
    } catch (err: any) {
      setError('Failed to delete image record.');
    }
  };

  const handleDownload = (dataUrl: string, promptText: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `SaadGPT-${promptText.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_') || 'image'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const stylePresets = [
    'Photorealistic',
    'Cinematic 8K',
    'Cyberpunk Crimson',
    '3D Octane Render',
    'Studio Portrait',
    'Anime Aesthetic',
    'Oil Painting',
    'Minimalist Vector',
  ];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-[#070406]">
      {/* LEFT: Controls & Studio Studio Panel */}
      <div className="w-full lg:w-96 p-4 sm:p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-rose-950/30 bg-[#0a0508]/60 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/30 text-rose-400">
            <Sparkles className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SaadGPT Image Studio</h2>
            <p className="text-xs text-neutral-400">GenAI Visual Creation & Synthesis Engine</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Studio Operation Modes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Generation Operation
            </label>
            <select
              value={operationType}
              onChange={(e) => setOperationType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl glass-input text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="text-to-image">Text to Image (Original Synthesis)</option>
              <option value="image-to-image">Image to Image (Reference Guided)</option>
              <option value="variation">Image Variations</option>
              <option value="background-mod">Background Modification</option>
              <option value="enhancement">Image Detail Enhancement</option>
            </select>
          </div>

          {/* Reference Image Upload (Optional or for Image-to-Image) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Reference Image
              </label>
              {refImage && (
                <button
                  type="button"
                  onClick={() => setRefImage(null)}
                  className="text-[11px] text-rose-400 hover:text-rose-300"
                >
                  Clear Image
                </button>
              )}
            </div>

            {refImage ? (
              <div className="relative rounded-xl overflow-hidden border border-rose-950/40 h-28 bg-black/60 group">
                <img src={refImage} alt="Reference" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1 rounded bg-rose-600 text-xs text-white"
                  >
                    Change Reference
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-rose-950/50 hover:border-rose-500/40 rounded-xl flex flex-col items-center justify-center gap-1.5 text-neutral-400 hover:text-neutral-200 bg-[#0d070b]/40 transition"
              >
                <Upload className="w-4 h-4 text-rose-400" />
                <span className="text-xs">Upload Reference (JPG, PNG, WEBP)</span>
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

          {/* Prompt Input */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Visual Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A futuristic cybernetic tiger prowling through a neon-lit rain-soaked Tokyo street, cinematic red rim lighting..."
              rows={4}
              required
              className="w-full p-3 rounded-xl glass-input text-xs sm:text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-medium border transition ${
                    aspectRatio === ratio
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950'
                      : 'border-rose-950/40 text-neutral-400 hover:text-white bg-[#0e070b]'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Style Presets */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Style Preset
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {stylePresets.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                    style === s
                      ? 'bg-rose-600/40 text-rose-200 border-rose-500'
                      : 'border-rose-950/30 text-neutral-400 hover:text-white bg-[#0d070b]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Mode */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
              Model Quality
            </label>
            <div className="flex rounded-xl bg-neutral-950 p-1 border border-rose-950/40">
              <button
                type="button"
                onClick={() => setQuality('standard')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                  quality === 'standard'
                    ? 'bg-rose-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Standard (Flash)
              </button>
              <button
                type="button"
                onClick={() => setQuality('high')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
                  quality === 'high'
                    ? 'bg-rose-600 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                High Res 1K (Nano)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.99] transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Synthesizing Pixels...
              </span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Imagery</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* RIGHT: Live Viewport & Gallery */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
        {activeImage ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0508]/80 rounded-3xl border border-rose-950/40 overflow-hidden shadow-2xl">
            {/* Viewport Action Header */}
            <div className="px-5 py-3 border-b border-rose-950/30 bg-[#0d070b] flex items-center justify-between text-xs text-neutral-300">
              <span className="truncate max-w-md font-medium text-neutral-200">
                "{activeImage.prompt}"
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(activeImage.image_data, activeImage.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600 border border-rose-500/40 text-rose-200 hover:text-white transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(activeImage.id)}
                  className="p-1.5 rounded-lg hover:bg-red-950/50 text-neutral-400 hover:text-red-400 transition"
                  title="Delete Image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Main Stage Image Display */}
            <div className="flex-1 p-4 flex items-center justify-center overflow-hidden bg-black/40">
              <img
                src={activeImage.image_data}
                alt={activeImage.prompt}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              />
            </div>

            {/* Metadata Bar */}
            <div className="px-5 py-2.5 border-t border-rose-950/30 bg-[#0c070a] flex items-center justify-between text-[11px] text-neutral-400">
              <div className="flex items-center gap-4">
                <span>Model: <strong className="text-neutral-200">{activeImage.model}</strong></span>
                <span>Ratio: <strong className="text-neutral-200">{activeImage.aspect_ratio}</strong></span>
                <span>Style: <strong className="text-neutral-200">{activeImage.style}</strong></span>
              </div>
              <span>{new Date(activeImage.created_at).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center rounded-3xl border border-rose-950/30 bg-[#0a0508]/40 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-950/30 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <ImageIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-white">No Generated Images Yet</h3>
            <p className="mt-1 text-xs text-neutral-400 max-w-sm">
              Use the studio parameters on the left to synthesize high-fidelity art, concept designs, or photo enhancements.
            </p>
          </div>
        )}

        {/* Gallery Strip */}
        <div className="mt-4 pt-3 border-t border-rose-950/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Studio Generation Gallery ({images.length})
            </span>
            {images.length > 0 && (
              <button
                onClick={loadImages}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            )}
          </div>

          <div className="flex gap-2.5 overflow-x-auto pb-2">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveImage(img)}
                className={`relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border transition ${
                  activeImage?.id === img.id
                    ? 'border-rose-500 ring-2 ring-rose-500/40 scale-105'
                    : 'border-rose-950/40 opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img.image_data} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
