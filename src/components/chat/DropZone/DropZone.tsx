import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import './DropZone.css';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
  children: React.ReactNode;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped, children }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files.item(i);
        if (file) {
          files.push(file);
        }
      }
      onFilesDropped(files);
    }
  };

  return (
    <div
      className="dropzone-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="dropzone-overlay">
          <div className="dropzone-box">
            <Upload size={48} className="dropzone-icon" />
            <h3 className="dropzone-title">{t('dropzone.title')}</h3>
            <p className="dropzone-subtitle">{t('dropzone.subtitle')}</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
