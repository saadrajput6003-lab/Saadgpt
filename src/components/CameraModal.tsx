import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Check } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Data: string, mimeType: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setError(null);
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please enable camera access in your browser or attach an image file instead.'
          : 'Unable to access camera device on this system.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(dataUrl);
    }
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage, 'image/jpeg');
      onClose();
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg glass-panel rounded-3xl overflow-hidden border border-rose-500/30 shadow-2xl glow-crimson">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-950/40 bg-[#0f070b]">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Camera className="w-4 h-4 text-rose-400" />
            <span>SaadGPT Vision / Camera</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-rose-950/40 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center max-w-sm">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <p className="text-xs text-rose-200">{error}</p>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Snapshot" className="w-full h-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {/* Scanner Grid Overlay */}
          {!capturedImage && !error && (
            <div className="absolute inset-0 pointer-events-none border border-rose-500/20 m-4 rounded-xl flex items-center justify-center">
              <div className="w-12 h-12 border-t-2 border-l-2 border-rose-500 absolute top-2 left-2" />
              <div className="w-12 h-12 border-t-2 border-r-2 border-rose-500 absolute top-2 right-2" />
              <div className="w-12 h-12 border-b-2 border-l-2 border-rose-500 absolute bottom-2 left-2" />
              <div className="w-12 h-12 border-b-2 border-r-2 border-rose-500 absolute bottom-2 right-2" />
            </div>
          )}
        </div>

        {/* Controls Footer */}
        <div className="p-4 bg-[#0a0508] border-t border-rose-950/40 flex items-center justify-between">
          {!capturedImage ? (
            <>
              <button
                type="button"
                onClick={toggleCamera}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:bg-rose-950/40 transition"
              >
                <RefreshCw className="w-4 h-4 text-rose-400" />
                <span>Switch Lens</span>
              </button>

              <button
                type="button"
                onClick={takeSnapshot}
                disabled={!!error}
                className="px-6 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-950/50 flex items-center gap-2 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Frame</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:bg-neutral-800"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={confirmCapture}
                className="px-6 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Attach to Prompt</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
