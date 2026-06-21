import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Hash, Lock, Plus, Search, Settings, LogOut, Shield, HardDrive } from 'lucide-react';
import { useChatStore, Room } from '../../../stores/useChatStore';
import { usePreferencesStore } from '../../../stores/usePreferencesStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { logout } from '../../../services/auth';
import { useGlassConfirm } from '@saybridge/ui';
import { SlotRenderer } from '../../common/SlotRenderer/SlotRenderer';
import { useTranslation } from 'react-i18next';
import './RoomList.css';

export type ViewMode = 'chat' | 'admin' | 'settings' | 'drive';

interface RoomListProps {
  onOpenCreateRoom: () => void;
  onOpenStartDM: () => void;
  viewMode: ViewMode;
  onSwitchView: (mode: ViewMode) => void;
  showAdminLink?: boolean;
}

export const RoomList: React.FC<RoomListProps> = ({
  onOpenCreateRoom,
  onOpenStartDM,
  viewMode,
  onSwitchView,
  showAdminLink = true,
}) => {
  const { t } = useTranslation();
  const { rooms, activeRoomId, setActiveRoomId, onlineUsers } = useChatStore();
  const roomSortOrder = usePreferencesStore((s) => s.roomSortOrder);
  const [filterText, setFilterText] = useState('');

  const { user } = useAuthStore();
  const { confirm, modal } = useGlassConfirm();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ bottom: number; left: number; width: number } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideFooter = profileRef.current?.contains(target) ?? false;
      const insideMenu = menuRef.current?.contains(target) ?? false;
      if (!insideFooter && !insideMenu) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const toggleProfileMenu = useCallback(() => {
    if (!showProfileMenu && profileRef.current) {
      const rect = profileRef.current.getBoundingClientRect();
      setMenuPosition({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left,
        width: rect.width,
      });
    }
    setShowProfileMenu(!showProfileMenu);
  }, [showProfileMenu]);

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: t('sidebar.signout_confirm_title'),
      message: t('sidebar.signout_confirm_message'),
      confirmText: t('sidebar.signout_confirm_ok'),
      cancelText: t('common.cancel'),
      variant: 'warning',
    });
    if (confirmed) {
      await logout();
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  const userStatus = user?.presence_status || 'online';

  const getDMInfo = (room: Room) => {
    if (!user || !room.members) return { name: room.name || t('chat.chat_with', { name: '' }), avatar: undefined, presence: 'offline' };
    const otherMember = room.members.find((m) => m.user_id !== user.id);
    if (!otherMember || !otherMember.user) {
      return { name: room.name || t('chat.chat_with', { name: '' }), avatar: undefined, presence: 'offline' };
    }
    const otherUser = otherMember.user;
    const displayName = otherUser.display_name || otherUser.username;
    const presence = onlineUsers[otherUser.id] || otherUser.presence_status || 'offline';
    return {
      name: displayName,
      username: otherUser.username,
      avatar: otherUser.avatar_url,
      presence,
    };
  };

  const filteredRooms = rooms.filter((r) => {
    if (r.type === 'dm') {
      const info = getDMInfo(r);
      const search = filterText.toLowerCase();
      return (
        info.name.toLowerCase().includes(search) ||
        (info.username && info.username.toLowerCase().includes(search))
      );
    }
    return r.name.toLowerCase().includes(filterText.toLowerCase());
  });

  const sortRooms = (list: Room[]) => {
    const sorted = [...list];
    switch (roomSortOrder) {
      case 'alphabetical':
        return sorted.sort((a, b) => {
          const nameA = a.type === 'dm' ? getDMInfo(a).name : a.name;
          const nameB = b.type === 'dm' ? getDMInfo(b).name : b.name;
          return nameA.localeCompare(nameB);
        });
      case 'unread':
        return sorted.sort((a, b) => (b.unread_count || 0) - (a.unread_count || 0));
      case 'activity':
      default:
        return sorted.sort((a, b) => {
          const aTime = (a as any).last_message_at || a.created_at || '';
          const bTime = (b as any).last_message_at || b.created_at || '';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
    }
  };

  const channels = useMemo(() => sortRooms(filteredRooms.filter((r) => r.type !== 'dm')), [filteredRooms, roomSortOrder, user, onlineUsers]);
  const dms = useMemo(() => sortRooms(filteredRooms.filter((r) => r.type === 'dm')), [filteredRooms, roomSortOrder, user, onlineUsers]);

  const getRoomIcon = (room: Room) => {
    if (room.type === 'private') return <Lock size={16} className="room-icon-svg" />;
    return <Hash size={16} className="room-icon-svg" />;
  };

  return (
    <div className="roomlist-container">
      {/* Title */}
      <div className="roomlist-header" data-tauri-drag-region>
        <SlotRenderer slot="sidebar_header" />
        <h2 className="roomlist-title" data-tauri-drag-region>Saybridge</h2>
      </div>

      {/* Filter search box */}
      <div className="roomlist-search">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-box"
            placeholder={t('sidebar.search_placeholder')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      <SlotRenderer slot="sidebar_before_rooms" />

      {/* Channels section */}
      <div className="roomlist-section">
        <div className="section-header">
          <span className="section-label">{t('sidebar.channels')}</span>
          <button className="create-room-btn" onClick={onOpenCreateRoom} title={t('sidebar.create_channel_tooltip')}>
            <Plus size={16} />
          </button>
        </div>
        <div className="section-items">
          {channels.length > 0 ? (
            channels.map((room) => (
              <button
                key={room.id}
                className={`room-item ${activeRoomId === room.id ? 'active' : ''} ${room.unread_count > 0 ? 'unread' : ''}`}
                onClick={() => setActiveRoomId(room.id)}
              >
                <div className="room-item-left">
                  {getRoomIcon(room)}
                  <span className="room-name">{room.name}</span>
                </div>
                {room.unread_count > 0 && (
                  <span className="unread-badge">{room.unread_count}</span>
                )}
              </button>
            ))
          ) : (
            <div className="empty-section-text">{t('sidebar.no_channels')}</div>
          )}
        </div>
      </div>

      {/* Direct Messages section */}
      <div className="roomlist-section dm-section">
        <div className="section-header">
          <span className="section-label">{t('sidebar.direct_messages')}</span>
          <button className="create-room-btn" onClick={onOpenStartDM} title={t('sidebar.start_dm_tooltip')}>
            <Plus size={16} />
          </button>
        </div>
        <div className="section-items">
          {dms.length > 0 ? (
            dms.map((room) => {
              const info = getDMInfo(room);
              return (
                <button
                  key={room.id}
                  className={`room-item dm-item ${activeRoomId === room.id ? 'active' : ''} ${room.unread_count > 0 ? 'unread' : ''}`}
                  onClick={() => setActiveRoomId(room.id)}
                >
                  <div className="room-item-left">
                    <div className="dm-avatar-wrapper">
                      {info.avatar ? (
                        <img src={info.avatar} alt="avatar" className="avatar-img dm-avatar-img" />
                      ) : (
                        <div className="dm-avatar-fallback">
                          {info.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className={`status-badge-dot ${info.presence}`} />
                    </div>
                    <span className="room-name">{info.name}</span>
                  </div>
                  {room.unread_count > 0 && (
                    <span className="unread-badge">{room.unread_count}</span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="empty-section-text">{t('sidebar.no_dms')}</div>
          )}
        </div>
      </div>

      <SlotRenderer slot="sidebar_after_rooms" />
      <SlotRenderer slot="sidebar_footer" />

      {/* Profile & Controls footer */}
      <div className="roomlist-footer" ref={profileRef}>
        <div
          className="roomlist-footer-profile clickable"
          onClick={toggleProfileMenu}
          title="User Profile Actions"
        >
          <div className="sidebar-profile-avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="avatar-img" />
            ) : (
              <div className="avatar-fallback">{getInitials(user?.username)}</div>
            )}
            <span className={`status-badge ${userStatus}`} />
          </div>
          <div className="profile-info">
            <span className="profile-name" title={user?.username}>{user?.username}</span>
            <span className="profile-status">{userStatus}</span>
          </div>
        </div>

        {showProfileMenu && menuPosition && createPortal(
          <div
            ref={menuRef}
            className="profile-context-menu"
            style={{
              position: 'fixed',
              bottom: menuPosition.bottom,
              left: menuPosition.left,
              width: menuPosition.width,
            }}
          >
            {showAdminLink && (
              <button
                className={`profile-menu-item ${viewMode === 'admin' ? 'active' : ''}`}
                onClick={() => {
                  onSwitchView(viewMode === 'admin' ? 'chat' : 'admin');
                  setShowProfileMenu(false);
                }}
              >
                <Shield size={16} />
                <span>{t('sidebar.admin', 'Bảng quản trị')}</span>
              </button>
            )}

            <button
              className={`profile-menu-item ${viewMode === 'drive' ? 'active' : ''}`}
              onClick={() => {
                onSwitchView(viewMode === 'drive' ? 'chat' : 'drive');
                setShowProfileMenu(false);
              }}
            >
              <HardDrive size={16} />
              <span>{t('sidebar.drive', 'Saybridge Drive')}</span>
            </button>

            <button
              className={`profile-menu-item ${viewMode === 'settings' ? 'active' : ''}`}
              onClick={() => {
                onSwitchView(viewMode === 'settings' ? 'chat' : 'settings');
                setShowProfileMenu(false);
              }}
            >
              <Settings size={16} />
              <span>{t('sidebar.settings', 'Cài đặt')}</span>
            </button>

            <div className="profile-menu-divider" />

            <button
              className="profile-menu-item danger"
              onClick={() => {
                handleLogout();
                setShowProfileMenu(false);
              }}
            >
              <LogOut size={16} />
              <span>{t('sidebar.logout', 'Đăng xuất')}</span>
            </button>
          </div>,
          document.body
        )}
      </div>

      {/* Glass confirmation modal portal */}
      {modal}
    </div>
  );
};
