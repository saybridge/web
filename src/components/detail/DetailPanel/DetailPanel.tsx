import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Hash, Lock, MessageCircle, ChevronDown, ChevronRight,
  UserPlus, LogOut, Users, Calendar, Shield, Zap, Pin,
  Star, FileText, Ban, Bell, BellOff, BellRing, Edit3,
  Archive, Globe, MoreHorizontal, Search, Info
} from 'lucide-react';
import { useChatStore } from '../../../stores/useChatStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { api } from '../../../services/api';
import './DetailPanel.css';

interface DetailPanelProps {
  onClose: () => void;
  onOpenPanel?: (panel: 'pinned' | 'starred' | 'files' | 'banned') => void;
}

interface MemberDetail {
  user_id: string;
  room_role: string;
  username?: string;
}

// Collapsible section component
const AccordionSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`dp-accordion ${open ? 'dp-accordion--open' : ''}`}>
      <button className="dp-accordion-trigger" onClick={() => setOpen(!open)}>
        <span className="dp-accordion-icon">{icon}</span>
        <span className="dp-accordion-title">{title}</span>
        {badge && <span className="dp-accordion-badge">{badge}</span>}
        <ChevronDown size={14} className="dp-accordion-chevron" />
      </button>
      <div className="dp-accordion-body">
        <div className="dp-accordion-content">{children}</div>
      </div>
    </div>
  );
};

export const DetailPanel: React.FC<DetailPanelProps> = ({ onClose, onOpenPanel }) => {
  const { activeRoomId, rooms, setRooms, onlineUsers } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [inviteQuery, setInviteQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [memberFilter, setMemberFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  const dmUser = useMemo(() => {
    if (!activeRoom || activeRoom.type !== 'dm' || !currentUser) return null;
    const membersList = roomDetails?.members || activeRoom.members || [];
    const otherMember = membersList.find((m: any) => m.user_id !== currentUser.id);
    return otherMember?.user || null;
  }, [activeRoom, currentUser, roomDetails]);

  const dmUserPresence = dmUser ? (onlineUsers[dmUser.id] || dmUser.presence_status || 'offline') : 'offline';

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!activeRoomId) return;
    const fetchDetails = async () => {
      try {
        const res = await api.get(`/rooms/${activeRoomId}`);
        if (res.data?.success) setRoomDetails(res.data.data);
      } catch (err) {
        console.error('Failed to load room details', err);
      }
    };
    fetchDetails();
  }, [activeRoomId]);

  // Search users for invite
  useEffect(() => {
    if (!inviteQuery.trim() || inviteQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/users/search', { params: { q: inviteQuery, limit: 5 } });
        const data = res.data?.data;
        setSearchResults(Array.isArray(data) ? data : data?.users || []);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery]);

  const handleInviteUser = async (userId: string) => {
    if (!activeRoomId) return;
    setIsLoading(true);
    try {
      const res = await api.post(`/rooms/${activeRoomId}/members`, { user_id: userId });
      if (res.data?.success) {
        showToast('Đã mời thành viên!', 'success');
        setInvitedIds(prev => new Set(prev).add(userId));
        const detailsRes = await api.get(`/rooms/${activeRoomId}`);
        setRoomDetails(detailsRes.data.data);
      }
    } catch (err: any) {
      showToast('Lỗi: ' + (err.response?.data?.error?.message || err.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!activeRoomId) return;
    if (!window.confirm('Bạn có chắc chắn muốn rời khỏi kênh này?')) return;
    setIsLoading(true);
    try {
      const res = await api.post(`/rooms/${activeRoomId}/leave`);
      if (res.data?.success) {
        showToast('Đã rời khỏi kênh!', 'success');
        setRooms(rooms.filter((r) => r.id !== activeRoomId));
        onClose();
      }
    } catch (err: any) {
      showToast('Lỗi: ' + (err.response?.data?.error?.message || err.message), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch { return '—'; }
  };

  if (!activeRoom) return null;

  const members: MemberDetail[] = roomDetails?.members || [];
  const filteredMembers = memberFilter
    ? members.filter((m) =>
      (m.username || m.user_id).toLowerCase().includes(memberFilter.toLowerCase())
    )
    : members;
  const displayMembers = showAllMembers ? filteredMembers : filteredMembers.slice(0, 5);

  const roomIcon = activeRoom.type === 'dm' && dmUser ? (
    dmUser.avatar_url ? (
      <img src={dmUser.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'cover' }} />
    ) : (
      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
        {getInitials(dmUser.display_name || dmUser.username)}
      </div>
    )
  ) : activeRoom.type === 'private' ? <Lock size={20} /> :
    activeRoom.type === 'dm' ? <MessageCircle size={20} /> :
      <Hash size={20} />;

  const roomTypeLabel = activeRoom.type === 'public' ? 'Kênh công khai' :
    activeRoom.type === 'private' ? 'Kênh riêng tư' : 'Tin nhắn trực tiếp';

  const resolvedRoomName = activeRoom.type === 'dm' && dmUser
    ? (dmUser.display_name || dmUser.username)
    : activeRoom.name;

  const resolvedRoomDesc = activeRoom.type === 'dm' && dmUser
    ? (dmUser.custom_status ? `"${dmUser.custom_status}"` : `@${dmUser.username}`)
    : (roomDetails?.description || roomDetails?.topic || 'Chưa có mô tả');

  // Quick actions config
  const quickActions = [
    { id: 'pinned' as const, icon: <Pin size={16} />, label: 'Ghim', show: true },
    { id: 'starred' as const, icon: <Star size={16} />, label: 'Đánh dấu', show: true },
    { id: 'files' as const, icon: <FileText size={16} />, label: 'Tệp', show: true },
    { id: 'banned' as const, icon: <Ban size={16} />, label: 'Cấm', show: activeRoom.type !== 'dm' },
  ].filter(a => a.show);

  return (
    <>
      <div className="dp-container">
        {/* Toast */}
        {toast && (
          <div className={`dp-toast dp-toast--${toast.type}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="dp-header">
          <div className="dp-header-pill">
            <div className="dp-header-left">
              <Info size={16} />
              <span className="dp-header-title">Chi tiết</span>
            </div>
            <button className="dp-header-close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="dp-scroll">
          {/* ── Channel Hero ── */}
          <div className="dp-hero">
            <div
              className="dp-hero-icon"
              style={activeRoom.type === 'dm' && dmUser?.avatar_url ? { background: 'transparent', border: 'none', boxShadow: 'none' } : undefined}
            >
              {roomIcon}
            </div>
            <h2 className="dp-hero-name">{resolvedRoomName}</h2>
            <p className="dp-hero-topic">
              {resolvedRoomDesc}
            </p>
          </div>

          {/* ── Quick Actions ── */}
          <div className="dp-quick-actions">
            {quickActions.map((qa) => (
              <button
                key={qa.id}
                className="dp-quick-btn"
                onClick={() => {
                  onClose();
                  onOpenPanel?.(qa.id);
                }}
              >
                <span className="dp-quick-icon">{qa.icon}</span>
                <span className="dp-quick-label">{qa.label}</span>
              </button>
            ))}
          </div>

          {/* ── Add Member Button ── */}
          {activeRoom.type !== 'dm' && (
            <div className="dp-add-member-row">
              <button
                className="dp-add-member-btn"
                onClick={() => {
                  setShowInvite(true);
                  setInviteQuery('');
                  setSearchResults([]);
                  setInvitedIds(new Set());
                  setTimeout(() => inviteInputRef.current?.focus(), 100);
                }}
              >
                <UserPlus size={15} />
                <span>Thêm thành viên</span>
              </button>
            </div>
          )}

          {/* ── About Section ── */}
          {activeRoom.type === 'dm' ? (
            <AccordionSection title="Thông tin người dùng" icon={<Info size={14} />} defaultOpen>
              {dmUser ? (
                <div className="dp-about-grid">
                  <div className="dp-about-item">
                    <span className="dp-about-label">Tên hiển thị</span>
                    <span className="dp-about-value">{dmUser.display_name || '—'}</span>
                  </div>
                  <div className="dp-about-item">
                    <span className="dp-about-label">Username</span>
                    <span className="dp-about-value">@{dmUser.username}</span>
                  </div>
                  <div className="dp-about-item">
                    <span className="dp-about-label">Email</span>
                    <span className="dp-about-value" style={{ wordBreak: 'break-all' }}>{dmUser.email || '—'}</span>
                  </div>
                  <div className="dp-about-item">
                    <span className="dp-about-label">Trạng thái</span>
                    <span
                      className="dp-about-value"
                      style={{
                        color: dmUserPresence === 'online' ? 'var(--success)' :
                          dmUserPresence === 'away' ? 'var(--warning)' :
                            dmUserPresence === 'busy' ? 'var(--danger)' : 'var(--text-tertiary)',
                        fontWeight: 600
                      }}
                    >
                      {dmUserPresence.toUpperCase()}
                    </span>
                  </div>
                  <div className="dp-about-item">
                    <span className="dp-about-label">Vai trò</span>
                    <span className="dp-about-value">{dmUser.system_role || 'user'}</span>
                  </div>
                  <div className="dp-about-item">
                    <span className="dp-about-label">Ngày tạo</span>
                    <span className="dp-about-value">{formatDate(roomDetails?.created_at || activeRoom.created_at)}</span>
                  </div>
                </div>
              ) : (
                <p className="dp-about-desc">Đang tải thông tin người dùng...</p>
              )}
            </AccordionSection>
          ) : (
            <AccordionSection title="Giới thiệu" icon={<Hash size={14} />} defaultOpen>
              {(roomDetails?.description || roomDetails?.topic) && (
                <p className="dp-about-desc">
                  {roomDetails?.description || roomDetails?.topic}
                </p>
              )}
              <div className="dp-about-grid">
                <div className="dp-about-item">
                  <Globe size={13} />
                  <span className="dp-about-label">Loại</span>
                  <span className="dp-about-value">{roomTypeLabel}</span>
                </div>
                <div className="dp-about-item">
                  <Calendar size={13} />
                  <span className="dp-about-label">Ngày tạo</span>
                  <span className="dp-about-value">{formatDate(roomDetails?.created_at || activeRoom.created_at)}</span>
                </div>
                {activeRoom.is_encrypted && (
                  <div className="dp-about-item">
                    <Shield size={13} />
                    <span className="dp-about-label">Mã hoá</span>
                    <span className="dp-about-value dp-about-value--accent">E2EE</span>
                  </div>
                )}
              </div>
            </AccordionSection>
          )}

          {/* ── Members Section ── */}
          {activeRoom.type !== 'dm' && (
            <AccordionSection
              title="Thành viên"
              icon={<Users size={14} />}
              badge={String(members.length)}
              defaultOpen
            >
              {/* Invite form toggle */}
              <div className="dp-members-toolbar">
                <div className="dp-members-search">
                  <Search size={13} />
                  <input
                    type="text"
                    placeholder="Tìm thành viên..."
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                  />
                </div>
                <button
                  className="dp-members-add-btn"
                  onClick={() => {
                    setShowInvite(true);
                    setInviteQuery('');
                    setSearchResults([]);
                    setInvitedIds(new Set());
                    setTimeout(() => inviteInputRef.current?.focus(), 100);
                  }}
                  title="Thêm thành viên"
                >
                  <UserPlus size={14} />
                </button>
              </div>

              {/* Member list */}
              <div className="dp-members-list">
                {displayMembers.map((member) => (
                  <div key={member.user_id} className="dp-member">
                    <div className="dp-member-avatar">
                      {(member.username || member.user_id).slice(0, 2).toUpperCase()}
                      <span className="dp-member-status" />
                    </div>
                    <div className="dp-member-info">
                      <span className="dp-member-name">
                        {member.user_id === currentUser?.id
                          ? 'Bạn'
                          : (member.username || member.user_id.slice(0, 8))}
                      </span>
                      <span className={`dp-member-role dp-member-role--${member.room_role}`}>
                        {member.room_role}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {filteredMembers.length > 5 && !showAllMembers && (
                <button className="dp-members-show-all" onClick={() => setShowAllMembers(true)}>
                  Xem tất cả {filteredMembers.length} thành viên
                </button>
              )}
              {showAllMembers && filteredMembers.length > 5 && (
                <button className="dp-members-show-all" onClick={() => setShowAllMembers(false)}>
                  Thu gọn
                </button>
              )}
            </AccordionSection>
          )}

          {/* ── Notifications Section ── */}
          <AccordionSection title="Thông báo" icon={<Bell size={14} />}>
            <div className="dp-notif-options">
              <label className="dp-notif-option">
                <input type="radio" name="notif" defaultChecked />
                <BellRing size={14} />
                <div>
                  <span className="dp-notif-label">Tất cả tin nhắn</span>
                  <span className="dp-notif-desc">Nhận thông báo cho mọi tin nhắn mới</span>
                </div>
              </label>
              <label className="dp-notif-option">
                <input type="radio" name="notif" />
                <Bell size={14} />
                <div>
                  <span className="dp-notif-label">Chỉ mention</span>
                  <span className="dp-notif-desc">Chỉ khi được @mention hoặc @all</span>
                </div>
              </label>
              <label className="dp-notif-option">
                <input type="radio" name="notif" />
                <BellOff size={14} />
                <div>
                  <span className="dp-notif-label">Tắt tiếng</span>
                  <span className="dp-notif-desc">Không nhận thông báo</span>
                </div>
              </label>
            </div>
          </AccordionSection>

          {/* ── Integrations Section ── */}
          {activeRoom.type !== 'dm' && (
            <AccordionSection title="Tích hợp" icon={<Zap size={14} />}>
              <div className="dp-integrations-empty">
                <Zap size={20} />
                <p>Chưa có tích hợp nào cho kênh này.</p>
              </div>
            </AccordionSection>
          )}

          {/* ── Danger Zone ── */}
          {activeRoom.type !== 'dm' && (
            <div className="dp-danger-zone">
              <button className="dp-danger-btn dp-danger-btn--edit" disabled={isLoading}>
                <Edit3 size={14} /> Chỉnh sửa kênh
              </button>
              <button className="dp-danger-btn dp-danger-btn--leave" onClick={handleLeave} disabled={isLoading}>
                <LogOut size={14} /> Rời khỏi kênh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Invite Member Modal ── */}
      {showInvite && createPortal(
        <div className="dp-invite-overlay" onClick={() => setShowInvite(false)}>
          <div className="dp-invite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dp-invite-modal-header">
              <h4>Thêm thành viên</h4>
              <button className="dp-invite-modal-close" onClick={() => setShowInvite(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="dp-invite-modal-search">
              <Search size={15} />
              <input
                ref={inviteInputRef}
                type="text"
                placeholder="Tìm theo tên, username hoặc email..."
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="dp-invite-modal-body">
              {inviteQuery.length < 2 && (
                <div className="dp-invite-modal-hint">
                  <Users size={24} />
                  <p>Nhập ít nhất 2 ký tự để tìm kiếm</p>
                </div>
              )}
              {inviteQuery.length >= 2 && searchResults.length === 0 && (
                <div className="dp-invite-modal-hint">
                  <Search size={24} />
                  <p>Không tìm thấy người dùng nào</p>
                </div>
              )}
              {searchResults.map((u) => {
                const alreadyInvited = invitedIds.has(u.id);
                const alreadyMember = members.some(m => m.user_id === u.id);
                return (
                  <div key={u.id} className="dp-invite-modal-user">
                    <div className="dp-invite-modal-user-avatar">
                      {(u.username || '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="dp-invite-modal-user-info">
                      <span className="dp-invite-modal-user-name">
                        {u.display_name || u.username}
                      </span>
                      <span className="dp-invite-modal-user-meta">
                        @{u.username} {u.email && `· ${u.email}`}
                      </span>
                    </div>
                    {alreadyMember ? (
                      <span className="dp-invite-modal-badge dp-invite-modal-badge--member">Đã là TV</span>
                    ) : alreadyInvited ? (
                      <span className="dp-invite-modal-badge dp-invite-modal-badge--invited">✓ Đã mời</span>
                    ) : (
                      <button
                        className="dp-invite-modal-invite-btn"
                        onClick={() => handleInviteUser(u.id)}
                        disabled={isLoading}
                      >
                        Mời
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

