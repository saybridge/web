import { useState, useEffect, useCallback } from 'react';
import { X, Paperclip, FileText, FileImage, Film, Download, Loader2 } from 'lucide-react';
import { api, getAuthenticatedFileUrl } from '../../../services/api';
import './FilesPanel.css';

interface SharedFile {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
  sender_name: string;
  created_at: string;
}

interface FilesPanelProps {
  roomId: string;
  onClose: () => void;
}

type FileFilter = 'all' | 'images' | 'documents';

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return <FileImage size={20} />;
  if (contentType.startsWith('video/')) return <Film size={20} />;
  return <FileText size={20} />;
}

function getFileIconClass(contentType: string): string {
  if (contentType.startsWith('image/')) return 'file-icon-image';
  if (contentType.startsWith('video/')) return 'file-icon-video';
  return 'file-icon-doc';
}

function matchesFilter(file: SharedFile, filter: FileFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'images') return file.content_type.startsWith('image/');
  if (filter === 'documents') {
    return (
      !file.content_type.startsWith('image/') &&
      !file.content_type.startsWith('video/')
    );
  }
  return true;
}

export function FilesPanel({ roomId, onClose }: FilesPanelProps) {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FileFilter>('all');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/rooms/${roomId}/files`);
      if (res.data?.success) {
        setFiles(res.data.data?.files || []);
      }
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filtered = files.filter((f) => matchesFilter(f, filter));

  return (
    <div className="files-panel">
      <div className="files-panel-header">
        <div className="files-panel-title">
          <Paperclip size={16} />
          <span>Files</span>
        </div>
        <button className="files-panel-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="files-panel-tabs">
        {(['all', 'images', 'documents'] as FileFilter[]).map((tab) => (
          <button
            key={tab}
            className={`files-tab ${filter === tab ? 'active' : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="files-panel-content">
        {loading ? (
          <div className="files-panel-loading">
            <Loader2 size={24} className="files-spinner" />
            <span>Loading files…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="files-panel-empty">
            <div className="files-panel-empty-icon">
              <Paperclip size={28} />
            </div>
            <h4>No files shared</h4>
            <p>Files shared in this channel will appear here.</p>
          </div>
        ) : (
          <div className="files-panel-list">
            {filtered.map((file) => (
              <div className="file-card" key={file.id}>
                <div className={`file-card-icon ${getFileIconClass(file.content_type)}`}>
                  {getFileIcon(file.content_type)}
                </div>
                <div className="file-card-info">
                  <span className="file-card-name" title={file.filename}>
                    {file.filename}
                  </span>
                  <span className="file-card-meta">
                    {formatFileSize(file.size)} · {file.sender_name} · {formatDate(file.created_at)}
                  </span>
                </div>
                <a
                  className="file-card-download"
                  href={getAuthenticatedFileUrl(file.url)}
                  download={file.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download"
                >
                  <Download size={16} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
