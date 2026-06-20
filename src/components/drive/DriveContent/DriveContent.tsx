import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, FileText, FileImage, FileAudio, FileVideo, File,
  Trash2, Download, Eye, Link as LinkIcon, Grid, List, Plus, Loader2, Info, X, ExternalLink,
  FolderOpen
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, getAuthenticatedFileUrl } from '../../../services/api';
import './DriveContent.css';

interface DriveFile {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
  sender_name: string;
  created_at: string;
}

interface DriveContentProps {
  activeTab: 'my' | 'shared' | 'recent' | 'all';
  onNavigate: (view: 'chat' | 'admin' | 'settings' | 'drive') => void;
}

type FilterType = 'all' | 'image' | 'document' | 'media';
type ViewType = 'list' | 'grid';

export function DriveContent({ activeTab }: DriveContentProps) {
  const { t, i18n } = useTranslation();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Fetch files based on active tab selection
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = '/files/my';
      if (activeTab === 'shared') endpoint = '/files/shared';
      if (activeTab === 'all') endpoint = '/files/all';
      if (activeTab === 'recent') endpoint = '/files/my?limit=10'; // recent uploads

      const res = await api.get(endpoint);
      if (res.data?.success) {
        setFiles(res.data.data?.files || res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch drive files', err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchFiles();
    setSelectedFile(null);
  }, [fetchFiles]);

  const [isDragging, setIsDragging] = useState(false);

  // Reusable single file upload helper — uploads binary via backend to MinIO
  const uploadSingleFile = async (file: File) => {
    try {
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 95));
          }
        },
      });

      if (res.data?.success) {
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 500);
        fetchFiles();
      }
    } catch (err) {
      console.error('Upload failed', err);
      setUploadProgress(null);
    }
  };

  // Handle uploading files directly via button click
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    uploadSingleFile(e.target.files[0]);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadSingleFile(e.dataTransfer.files[0]);
    }
  };

  // Delete file handler
  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm(t('drive.delete_confirm', 'Are you sure you want to delete this file?'))) return;
    try {
      const res = await api.delete(`/files/${fileId}`);
      if (res.data?.success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
        if (selectedFile?.id === fileId) {
          setSelectedFile(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  // Copy shareable link
  const handleCopyLink = (fileUrl: string) => {
    const fullUrl = getAuthenticatedFileUrl(fileUrl);
    navigator.clipboard.writeText(fullUrl)
      .then(() => alert(t('drive.link_copied', 'File download link copied to clipboard!')))
      .catch(() => alert(t('drive.link_copy_failed', 'Failed to copy link.')));
  };

  // Deduce file icons
  const getFileIcon = (contentType: string, size: number = 24) => {
    if (contentType.startsWith('image/')) return <FileImage size={size} className="icon-image" />;
    if (contentType.startsWith('video/')) return <FileVideo size={size} className="icon-video" />;
    if (contentType.startsWith('audio/')) return <FileAudio size={size} className="icon-audio" />;
    if (contentType === 'application/pdf') return <FileText size={size} className="icon-pdf" />;
    return <File size={size} className="icon-generic" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string): string => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter tệp tin dựa trên loại & thanh tìm kiếm
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch = file.filename.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterType === 'image') return file.content_type.startsWith('image/');
      if (filterType === 'media') {
        return file.content_type.startsWith('video/') || file.content_type.startsWith('audio/');
      }
      if (filterType === 'document') {
        return (
          !file.content_type.startsWith('image/') &&
          !file.content_type.startsWith('video/') &&
          !file.content_type.startsWith('audio/')
        );
      }
      return true;
    });
  }, [files, searchQuery, filterType]);

  return (
    <div className="drive-content-container">
      {/* Top Bar / Toolbar */}
      <div className="drive-toolbar" data-tauri-drag-region>
        <div className="drive-toolbar-left">
          <span className="drive-context-title">
            {activeTab === 'my' && t('drive.tab_my', 'My Files')}
            {activeTab === 'shared' && t('drive.tab_shared', 'Shared')}
            {activeTab === 'recent' && t('drive.tab_recent', 'Recent')}
            {activeTab === 'all' && t('drive.tab_all', 'System')}
          </span>
          <div className="drive-toolbar-divider" />
          <div className="drive-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder={t('drive.search_placeholder', 'Search files...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="drive-filter-tabs">
          {(['all', 'image', 'document', 'media'] as FilterType[]).map((tab) => (
            <button
              key={tab}
              className={`filter-tab ${filterType === tab ? 'active' : ''}`}
              onClick={() => setFilterType(tab)}
            >
              {tab === 'all' && t('drive.filter_all', 'All')}
              {tab === 'image' && t('drive.filter_image', 'Images')}
              {tab === 'document' && t('drive.filter_document', 'Documents')}
              {tab === 'media' && t('drive.filter_media', 'Media')}
            </button>
          ))}
        </div>

        <div className="drive-toolbar-actions">
          <div className="view-toggle-btns">
            <button
              className={`view-btn ${viewType === 'list' ? 'active' : ''}`}
              onClick={() => setViewType('list')}
              title={t('drive.view_list', 'List view')}
            >
              <List size={18} />
            </button>
            <button
              className={`view-btn ${viewType === 'grid' ? 'active' : ''}`}
              onClick={() => setViewType('grid')}
              title={t('drive.view_grid', 'Grid view')}
            >
              <Grid size={18} />
            </button>
          </div>

          <label className="drive-upload-label">
            <Plus size={16} />
            <span>{t('drive.upload', 'Upload File')}</span>
            <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Upload progress indicator */}
      {uploadProgress !== null && (
        <div className="drive-upload-progress-bar">
          <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
          <span className="progress-text">{t('drive.uploading', 'Uploading file... {{progress}}%', { progress: uploadProgress })}</span>
        </div>
      )}

      {/* Main Grid/List View Area */}
      <div className="drive-body-layout">
        <div 
          className={`drive-explorer ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {loading ? (
            <div className="drive-state-loading">
              <Loader2 size={32} className="drive-spinner" />
              <span>{t('drive.loading', 'Loading file list...')}</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="drive-state-empty-container">
              <div className="drive-upload-dropzone">
                <div className="empty-decorations">
                  <FileImage className="decor-icon img-decor" size={20} />
                  <FileText className="decor-icon doc-decor" size={20} />
                  <FileVideo className="decor-icon vid-decor" size={20} />
                  <FileAudio className="decor-icon aud-decor" size={20} />
                </div>
                <div className="empty-icon-container">
                  <FolderOpen size={48} className="empty-folder-icon" />
                </div>
                <h3>{t('drive.no_files', 'No files found')}</h3>
                <p>{t('drive.drag_drop_desc', 'Drag and drop your files here or click below to start.')}</p>
                <label className="dropzone-upload-btn">
                  <Plus size={16} />
                  <span>{t('drive.select_from_device', 'Choose file from device')}</span>
                  <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          ) : viewType === 'list' ? (
            /* LIST VIEW */
            <div className="drive-list-view">
              <div className="list-header">
                <span className="col-name">{t('drive.col_name', 'File Name')}</span>
                <span className="col-owner">{t('drive.col_owner', 'Shared By')}</span>
                <span className="col-size">{t('drive.col_size', 'Size')}</span>
                <span className="col-date">{t('drive.col_date', 'Upload Date')}</span>
                <span className="col-actions">{t('drive.col_actions', 'Actions')}</span>
              </div>
              <div className="list-body">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`list-row ${selectedFile?.id === file.id ? 'selected' : ''}`}
                    onClick={() => setSelectedFile(file)}
                  >
                    <span className="col-name">
                      {getFileIcon(file.content_type, 18)}
                      <span className="file-name-txt" title={file.filename}>{file.filename}</span>
                    </span>
                    <span className="col-owner">{file.sender_name}</span>
                    <span className="col-size">{formatFileSize(file.size)}</span>
                    <span className="col-date">{formatDate(file.created_at)}</span>
                    <span className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="row-action-btn" onClick={() => setPreviewFile(file)} title={t('drive.preview', 'Preview')}>
                        <Eye size={15} />
                      </button>
                      <a
                        className="row-action-btn"
                        href={getAuthenticatedFileUrl(file.url)}
                        download={file.filename}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('drive.download', 'Download')}
                      >
                        <Download size={15} />
                      </a>
                      <button className="row-action-btn" onClick={() => handleCopyLink(file.url)} title={t('drive.copy_link', 'Copy Link')}>
                        <LinkIcon size={15} />
                      </button>
                      <button className="row-action-btn delete" onClick={() => handleDeleteFile(file.id)} title={t('drive.delete', 'Delete')}>
                        <Trash2 size={15} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* GRID VIEW */
            <div className="drive-grid-view">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`grid-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="card-preview-zone">
                    {file.content_type.startsWith('image/') ? (
                      <img src={getAuthenticatedFileUrl(file.url)} alt={file.filename} className="grid-image-img" />
                    ) : (
                      <div className="grid-file-fallback-icon">
                        {getFileIcon(file.content_type, 38)}
                      </div>
                    )}
                  </div>
                  <div className="card-meta">
                    <span className="card-name" title={file.filename}>{file.filename}</span>
                    <span className="card-size">{formatFileSize(file.size)}</span>
                  </div>
                  <div className="card-hover-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="card-action-btn" onClick={() => setPreviewFile(file)} title={t('drive.preview', 'Preview')}>
                      <Eye size={14} />
                    </button>
                    <a
                      className="card-action-btn"
                      href={getAuthenticatedFileUrl(file.url)}
                      download={file.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={t('drive.download', 'Download')}
                    >
                      <Download size={14} />
                    </a>
                    <button className="card-action-btn delete" onClick={() => handleDeleteFile(file.id)} title={t('drive.delete', 'Delete')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Pane (Sidebar Right) */}
        {selectedFile && (
          <div className="drive-details-pane">
            <div className="details-header">
              <h3>{t('drive.details_title', 'File Details')}</h3>
              <button className="details-close" onClick={() => setSelectedFile(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="details-body">
              <div className="details-icon-large">
                {getFileIcon(selectedFile.content_type, 44)}
              </div>
              <h4 className="details-filename" title={selectedFile.filename}>{selectedFile.filename}</h4>

              <div className="details-meta-list">
                <div className="meta-item">
                  <span className="meta-label">{t('drive.meta_format', 'Format:')}</span>
                  <span className="meta-value">{selectedFile.content_type || 'Unknown'}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('drive.meta_size', 'Size:')}</span>
                  <span className="meta-value">{formatFileSize(selectedFile.size)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('drive.meta_owner', 'Owner:')}</span>
                  <span className="meta-value">{selectedFile.sender_name}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('drive.meta_date', 'Created Date:')}</span>
                  <span className="meta-value">{formatDate(selectedFile.created_at)}</span>
                </div>
              </div>

              <div className="details-actions">
                <button className="details-btn primary" onClick={() => setPreviewFile(selectedFile)}>
                  <Eye size={15} />
                  <span>{t('drive.preview', 'Preview')}</span>
                </button>
                <a
                  className="details-btn secondary"
                  href={getAuthenticatedFileUrl(selectedFile.url)}
                  download={selectedFile.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={15} />
                  <span>{t('drive.download', 'Download')}</span>
                </a>
                <button className="details-btn link" onClick={() => handleCopyLink(selectedFile.url)}>
                  <LinkIcon size={15} />
                  <span>{t('drive.copy_link', 'Copy Link')}</span>
                </button>
                <button className="details-btn danger" onClick={() => handleDeleteFile(selectedFile.id)}>
                  <Trash2 size={15} />
                  <span>{t('drive.delete', 'Delete')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic File Preview Modal */}
      {previewFile && (
        <div className="drive-preview-modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <span className="preview-title" title={previewFile.filename}>{previewFile.filename}</span>
              <div className="preview-header-actions">
                <a
                  className="preview-header-btn"
                  href={getAuthenticatedFileUrl(previewFile.url)}
                  download={previewFile.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t('drive.download', 'Download')}
                >
                  <Download size={16} />
                </a>
                <button className="preview-header-btn close" onClick={() => setPreviewFile(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="preview-modal-body">
              {previewFile.content_type.startsWith('image/') ? (
                <img
                  src={getAuthenticatedFileUrl(previewFile.url)}
                  alt={previewFile.filename}
                  className="preview-media-image"
                />
              ) : previewFile.content_type.startsWith('video/') ? (
                <video
                  src={getAuthenticatedFileUrl(previewFile.url)}
                  controls
                  autoPlay
                  className="preview-media-video"
                />
              ) : previewFile.content_type.startsWith('audio/') ? (
                <div className="preview-media-audio-container">
                  <div className="audio-disc">🎵</div>
                  <audio
                     src={getAuthenticatedFileUrl(previewFile.url)}
                     controls
                     autoPlay
                  />
                </div>
              ) : previewFile.content_type === 'application/pdf' ? (
                <iframe
                  src={getAuthenticatedFileUrl(previewFile.url)}
                  title={previewFile.filename}
                  className="preview-media-pdf"
                />
              ) : (
                <div className="preview-no-support-container">
                  <span className="no-support-icon">📝</span>
                  <h3>{t('drive.preview_not_supported', 'Preview not supported for this file')}</h3>
                  <p>{t('drive.preview_not_supported_desc', 'This file type cannot be previewed in the browser. Please download to view it.')}</p>
                  <a
                    className="no-support-download-btn"
                    href={getAuthenticatedFileUrl(previewFile.url)}
                    download={previewFile.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download size={16} />
                    <span>{t('drive.download_now', 'Download Now')}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
