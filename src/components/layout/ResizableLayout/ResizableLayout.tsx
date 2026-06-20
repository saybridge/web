import React, { useState, useEffect, useRef } from 'react';
import { LiquidSidePanel } from '@saybridge/ui';
import './ResizableLayout.css';

interface ResizableLayoutProps {
  sidebar?: React.ReactNode;
  roomList: React.ReactNode;
  chatPanel: React.ReactNode;
  detailPanel: React.ReactNode;
  showDetail: boolean;
  // Admin/Settings mode overrides
  secondaryPanel?: React.ReactNode;  // replaces roomList
  mainContent?: React.ReactNode;     // replaces chatPanel + detailPanel
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  sidebar,
  roomList,
  chatPanel,
  detailPanel,
  showDetail,
  secondaryPanel,
  mainContent,
}) => {
  const [detailWidth, setDetailWidth] = useState<number>(() => {
    const saved = localStorage.getItem('saybridge_layout_detail_width');
    return saved ? parseInt(saved, 10) : 340;
  });

  const isDraggingDetail = useRef(false);

  useEffect(() => {
    localStorage.setItem('saybridge_layout_detail_width', detailWidth.toString());
  }, [detailWidth]);

  const handleDetailMouseDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingDetail.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (isDraggingDetail.current && showDetail) {
        const newWidth = Math.max(280, Math.min(500, window.innerWidth - e.clientX));
        setDetailWidth(newWidth);
      }
    };

    const handlePointerUp = () => {
      if (isDraggingDetail.current) {
        isDraggingDetail.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [showDetail]);

  const isOverrideMode = !!secondaryPanel && !!mainContent;

  return (
    <div className="layout-root">
      {/* Sidebar — floating pill */}
      {sidebar && (
        <div className="layout-sidebar">
          {sidebar}
        </div>
      )}

      {/* Room List / Secondary Panel — glass card */}
      <div className="layout-roomlist">
        {isOverrideMode ? secondaryPanel : roomList}
      </div>

      {/* Main Content — glass card */}
      <div className="layout-main">
        {isOverrideMode ? (
          <div className="layout-admin-content">
            {mainContent}
          </div>
        ) : (
          <>
            <div className="layout-chat">
              {chatPanel}
            </div>

            <LiquidSidePanel
              isOpen={showDetail}
              width={detailWidth}
              className="layout-detail"
              dragHandle={
                <div 
                  className={`drag-handle ${isDraggingDetail.current ? 'active' : ''}`}
                  onPointerDown={handleDetailMouseDown}
                />
              }
            >
              {detailPanel}
            </LiquidSidePanel>
          </>
        )}
      </div>
    </div>
  );
};
