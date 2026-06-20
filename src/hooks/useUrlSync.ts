import { useEffect, useCallback } from 'react';
import { useChatStore } from '../stores/useChatStore';
import { api } from '../services/api';

/**
 * URL routing patterns:
 *   /                     → Chat home (no room selected)
 *   /channel/:slug        → Chat with specific room (slug-based, e.g. /channel/general)
 *   /admin                → Admin overview
 *   /admin/:tab           → Admin sub-page (plugins, workflows, etc.)
 *
 * This hook syncs browser URL ↔ app state without react-router.
 */

interface UrlState {
  view: 'chat' | 'admin' | 'drive';
  slug: string | null;
  adminTab: string | null;
}

/** Parse current URL into app state */
export function parseUrl(pathname: string = window.location.pathname): UrlState {
  const parts = pathname.split('/').filter(Boolean);

  if (parts[0] === 'admin') {
    return {
      view: 'admin',
      slug: null,
      adminTab: parts[1] || 'overview',
    };
  }

  if (parts[0] === 'drive') {
    return {
      view: 'drive',
      slug: null,
      adminTab: parts[1] || 'my',
    };
  }

  if (parts[0] === 'channel' && parts[1]) {
    return {
      view: 'chat',
      slug: parts[1],
      adminTab: null,
    };
  }

  return { view: 'chat', slug: null, adminTab: null };
}

/** Push a new URL without full page reload */
export function navigateTo(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, '', path);
    // Dispatch popstate so listeners pick it up
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/** Navigate to a specific room by slug */
export function navigateToRoom(slug: string) {
  navigateTo(`/channel/${slug}`);
}

/** Navigate to admin panel */
export function navigateToAdmin(tab: string = 'overview') {
  navigateTo(tab === 'overview' ? '/admin' : `/admin/${tab}`);
}

/** Navigate to drive panel */
export function navigateToDrive(tab: string = 'my') {
  navigateTo(tab === 'my' ? '/drive' : `/drive/${tab}`);
}

/** Navigate to chat home */
export function navigateToChat() {
  navigateTo('/');
}

/** Resolve slug to room ID via API, then set active room */
async function resolveSlugAndNavigate(
  slug: string,
  setActiveRoomId: (id: string) => void,
  rooms: { id: string; slug: string }[],
) {
  // First try local lookup from loaded rooms
  const local = rooms.find((r) => r.slug === slug);
  if (local) {
    setActiveRoomId(local.id);
    return;
  }

  // Fallback: resolve via API
  try {
    const res = await api.get(`/rooms/slug/${slug}`);
    if (res.data?.data?.id) {
      setActiveRoomId(res.data.data.id);
    }
  } catch {
    console.warn(`[URL] Could not resolve slug: ${slug}`);
  }
}

/**
 * Hook: sync URL → app state on mount + popstate (back/forward).
 * Also sync app state → URL when activeRoomId changes.
 */
export function useUrlSync(
  viewMode: 'chat' | 'admin' | 'settings' | 'drive',
  setViewMode: (v: 'chat' | 'admin' | 'settings' | 'drive') => void,
  _adminTab?: string,
  setAdminTab?: (tab: string) => void,
  _driveTab?: string,
  setDriveTab?: (tab: string) => void,
) {
  const activeRoomId = useChatStore((s) => s.activeRoomId);
  const setActiveRoomId = useChatStore((s) => s.setActiveRoomId);
  const rooms = useChatStore((s) => s.rooms);

  // On mount: restore state from URL
  useEffect(() => {
    const state = parseUrl();
    if (state.view === 'admin') {
      setViewMode('admin');
      if (setAdminTab && state.adminTab) {
        setAdminTab(state.adminTab);
      }
    } else if (state.view === 'drive') {
      setViewMode('drive');
      if (setDriveTab && state.adminTab) {
        setDriveTab(state.adminTab);
      }
    } else if (state.slug) {
      setViewMode('chat');
      resolveSlugAndNavigate(state.slug, setActiveRoomId, rooms);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const state = parseUrl();
      if (state.view === 'admin') {
        setViewMode('admin');
        if (setAdminTab && state.adminTab) {
          setAdminTab(state.adminTab);
        }
      } else if (state.view === 'drive') {
        setViewMode('drive');
        if (setDriveTab && state.adminTab) {
          setDriveTab(state.adminTab);
        }
      } else {
        setViewMode('chat');
        if (state.slug) {
          resolveSlugAndNavigate(state.slug, setActiveRoomId, rooms);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setViewMode, setActiveRoomId, setAdminTab, setDriveTab, rooms]);

  // Sync activeRoomId → URL using slug (when user clicks a room)
  useEffect(() => {
    if (viewMode === 'admin' || viewMode === 'drive') return; // Admin/Drive mode, don't sync room URL
    if (!activeRoomId) {
      const currentState = parseUrl();
      if (currentState.slug) {
        window.history.pushState(null, '', '/');
      }
      return;
    }

    // Find slug for active room
    const activeRoom = rooms.find((r) => r.id === activeRoomId);
    const slug = activeRoom?.slug || activeRoomId;

    const currentState = parseUrl();
    if (currentState.slug !== slug) {
      window.history.pushState(null, '', `/channel/${slug}`);
    }
  }, [activeRoomId, viewMode, rooms]);

  // Sync admin state → URL
  const syncAdminUrl = useCallback((tab: string) => {
    const path = tab === 'overview' ? '/admin' : `/admin/${tab}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, []);

  return { syncAdminUrl };
}
