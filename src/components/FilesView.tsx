import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Search,
  Eye,
  X,
  File,
  Image as ImageIcon,
  FileCode,
  Music,
  Video,
  AlertCircle,
  HardDrive,
} from 'lucide-react';

export const FilesView: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewFile, setPreviewFile] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.getFiles();
      setFiles(res.files || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load files.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError('File exceeds maximum size limit of 25MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await api.uploadFile({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          data: reader.result as string,
        });
        setFiles((prev) => [res.file, ...prev]);
      } catch (err: any) {
        setError(err.message || 'Upload failed.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePreview = async (file: any) => {
    setPreviewLoading(true);
    try {
      const res = await api.getFileData(file.id);
      setPreviewFile(res.file);
    } catch {
      setError('Could not retrieve file data for preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (previewFile?.id === id) setPreviewFile(null);
    } catch {
      setError('Failed to delete file.');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-rose-400" />;
    if (mime.startsWith('video/')) return <Video className="w-5 h-5 text-amber-400" />;
    if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-400" />;
    if (mime.includes('json') || mime.includes('javascript') || mime.includes('typescript')) {
      return <FileCode className="w-5 h-5 text-cyan-400" />;
    }
    return <FileText className="w-5 h-5 text-neutral-400" />;
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalStorageBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 bg-[#070406]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <HardDrive className="w-7 h-7 text-rose-500" />
            <span>Vault File System</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Private user storage &bull; {files.length} files &bull; {formatBytes(totalStorageBytes)} used
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-950/40 flex items-center gap-2 transition"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files by filename or extension..."
          className="w-full pl-10 pr-4 py-2 rounded-xl glass-input text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
        />
      </div>

      {/* File List / Table */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-rose-950/40 bg-[#0c0609]">
        {filteredFiles.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-8">
            <File className="w-12 h-12 text-rose-500/30 mb-3" />
            <p className="text-sm text-white font-medium">No Files Stored</p>
            <p className="text-xs text-neutral-400 mt-1">Upload images, PDFs, or code archives into your vault.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-rose-950/30 bg-[#0e070b] text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 hidden sm:table-cell">MIME Type</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4 hidden md:table-cell">Uploaded</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-950/20 text-neutral-200">
              {filteredFiles.map((f) => (
                <tr key={f.id} className="hover:bg-rose-950/20 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getFileIcon(f.mime_type)}
                      <span className="truncate font-medium max-w-[200px] sm:max-w-xs">{f.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell font-mono text-[11px] text-neutral-400">
                    {f.mime_type}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-neutral-300">
                    {formatBytes(f.size)}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-neutral-400 text-[11px]">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handlePreview(f)}
                        className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="p-1.5 rounded-lg hover:bg-red-950/40 text-neutral-400 hover:text-red-400 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-2xl glass-panel rounded-3xl overflow-hidden border border-rose-500/30 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-rose-950/40 bg-[#0e070b] flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-md">
                {previewFile.name}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile.data}
                  download={previewFile.name}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 text-xs text-white"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1 rounded-full text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex items-center justify-center bg-black/50 flex-1">
              {previewFile.mime_type.startsWith('image/') ? (
                <img src={previewFile.data} alt="" className="max-h-[60vh] max-w-full object-contain rounded-xl" />
              ) : previewFile.mime_type.startsWith('audio/') ? (
                <audio src={previewFile.data} controls className="w-full" />
              ) : previewFile.mime_type.startsWith('video/') ? (
                <video src={previewFile.data} controls className="max-h-[60vh] max-w-full rounded-xl" />
              ) : (
                <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap max-h-96 overflow-y-auto w-full p-4 bg-[#0a0508] rounded-xl">
                  {previewFile.data.startsWith('data:text') || previewFile.data.startsWith('data:application/json')
                    ? atob(previewFile.data.split(',')[1] || '')
                    : '[Binary file content ready for download]'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
