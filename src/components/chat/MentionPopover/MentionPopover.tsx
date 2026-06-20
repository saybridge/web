import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../services/api';
import './MentionPopover.css';

interface UserInfo {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  presence_status?: string;
  custom_status?: string;
  system_role?: string;
}

// Simple in-memory cache to avoid repeated API calls
const userCache = new Map<string, UserInfo>();

interface MentionPopoverProps {
  /** The container element to listen for mention hovers via event delegation */
  containerRef: React.RefObject<HTMLElement | null>;
}

const POPOVER_WIDTH = 260;
const VIEWPORT_PADDING = 12;

export const MentionPopover: React.FC<MentionPopoverProps> = ({ containerRef }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [adjustedLeft, setAdjustedLeft] = useState<number | null>(null);
  const [arrowOffset, setArrowOffset] = useState<number>(50); // % from left
  const popoverRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
  };

  const fetchUser = useCallback(async (username: string) => {
    // Check cache first
    if (userCache.has(username)) {
      return userCache.get(username)!;
    }
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(username)}&limit=5`);
      const users: UserInfo[] = res.data?.data || [];
      const found = users.find(u => u.username === username);
      if (found) {
        userCache.set(username, found);
        return found;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseEnter = async (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.sb-md-mention-user');
      if (!target) return;

      // Extract username (remove leading @)
      const text = target.textContent?.trim() || '';
      const username = text.startsWith('@') ? text.slice(1) : text;
      if (!username) return;

      clearTimers();

      // Show after a small delay to avoid flicker
      showTimeoutRef.current = setTimeout(async () => {
        const rect = target.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const topY = rect.top;

        // Clamp horizontally so popover stays in viewport
        const halfW = POPOVER_WIDTH / 2;
        let finalX = centerX;
        let arrow = 50; // default center

        if (centerX - halfW < VIEWPORT_PADDING) {
          // Too close to left edge
          finalX = VIEWPORT_PADDING + halfW;
          arrow = ((centerX - VIEWPORT_PADDING) / POPOVER_WIDTH) * 100;
        } else if (centerX + halfW > window.innerWidth - VIEWPORT_PADDING) {
          // Too close to right edge
          finalX = window.innerWidth - VIEWPORT_PADDING - halfW;
          arrow = ((centerX - (finalX - halfW)) / POPOVER_WIDTH) * 100;
        }

        setPosition({ x: finalX, y: topY });
        setAdjustedLeft(null);
        setArrowOffset(Math.max(10, Math.min(90, arrow)));

        const userData = await fetchUser(username);
        if (userData) {
          setUser(userData);
          setVisible(true);
        }
      }, 200);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.sb-md-mention-user');
      if (!target) return;

      clearTimers();
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
      }, 150);
    };

    container.addEventListener('mouseenter', handleMouseEnter as unknown as EventListener, true);
    container.addEventListener('mouseleave', handleMouseLeave as unknown as EventListener, true);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter as unknown as EventListener, true);
      container.removeEventListener('mouseleave', handleMouseLeave as unknown as EventListener, true);
      clearTimers();
    };
  }, [containerRef, fetchUser]);

  // Keep popover open when mouse is over it
  const handlePopoverEnter = () => {
    clearTimers();
  };

  const handlePopoverLeave = () => {
    clearTimers();
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, 100);
  };

  if (!visible || !user) return null;

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const presenceColor: Record<string, string> = {
    online: '#22c55e',
    busy: '#ef4444',
    away: '#f59e0b',
    offline: '#6b7280',
  };

  const presenceLabel: Record<string, string> = {
    online: 'Trực tuyến',
    busy: 'Bận',
    away: 'Vắng mặt',
    offline: 'Ngoại tuyến',
  };

  return (
    <div
      ref={popoverRef}
      className="mention-popover"
      style={{
        left: position.x,
        top: position.y,
        width: POPOVER_WIDTH,
      }}
      onMouseEnter={handlePopoverEnter}
      onMouseLeave={handlePopoverLeave}
    >
      <div className="mention-popover-arrow" style={{ left: `${arrowOffset}%` }} />
      <div className="mention-popover-content">
        <div className="mention-popover-header">
          <div className="mention-popover-avatar">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} />
            ) : (
              <span>{getInitials(user.display_name || user.username)}</span>
            )}
            <span
              className="mention-popover-presence"
              style={{ backgroundColor: presenceColor[user.presence_status || 'offline'] }}
            />
          </div>
          <div className="mention-popover-info">
            <span className="mention-popover-name">{user.display_name || user.username}</span>
            <span className="mention-popover-username">@{user.username}</span>
          </div>
        </div>

        <div className="mention-popover-meta">
          <div className="mention-popover-status">
            <span
              className="mention-popover-status-dot"
              style={{ backgroundColor: presenceColor[user.presence_status || 'offline'] }}
            />
            <span>{presenceLabel[user.presence_status || 'offline']}</span>
          </div>
          {user.custom_status && (
            <div className="mention-popover-custom-status">
              {user.custom_status}
            </div>
          )}
          {user.system_role && user.system_role !== 'user' && (
            <div className="mention-popover-role">
              {user.system_role === 'admin' ? '👑 Quản trị viên' : user.system_role}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
