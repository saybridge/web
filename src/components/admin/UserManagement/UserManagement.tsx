import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Shield,
  ShieldCheck,
  Circle,
  ChevronDown,
  X,
  UserCog,
  Loader2,
  UserX,
} from 'lucide-react';
import { api } from '../../../services/api';
import { PageContainer, LiquidModal } from '@saybridge/ui';
import './UserManagement.css';

/* ═══════════════════ Types ═══════════════════ */
interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  system_role: string;
  presence_status: string;
  is_active: boolean;
  created_at: string;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface InviteForm {
  username: string;
  email: string;
  password: string;
  display_name: string;
}

/* ═══════════════════ Component ═══════════════════ */
export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleDropdownId, setRoleDropdownId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    username: '',
    email: '',
    password: '',
    display_name: '',
  });
  const [inviteErrors, setInviteErrors] = useState<Partial<InviteForm>>({});
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── Fetch users ── */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/search', {
        params: { q: '', limit: 50 },
      });
      const data = res.data?.data;
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data?.users && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        setUsers([]);
      }
    } catch {
      setUsers([]);
      showToast('Không thể tải danh sách người dùng', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ── Toast ── */
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ── Filter users by search ── */
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  /* ── Stats ── */
  const totalUsers = users.length;
  const onlineUsers = users.filter((u) => u.presence_status === 'online').length;
  const adminCount = users.filter((u) => u.system_role === 'admin').length;

  /* ── Toggle active ── */
  const handleToggleActive = async (user: User) => {
    const newStatus = !user.is_active;
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_active: newStatus } : u))
    );
    try {
      await api.patch(`/admin/users/${user.id}`, { is_active: newStatus });
      showToast(
        newStatus
          ? `Đã kích hoạt tài khoản ${user.display_name || user.username}`
          : `Đã vô hiệu hóa tài khoản ${user.display_name || user.username}`,
        'success'
      );
    } catch {
      // Revert on failure
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: !newStatus } : u))
      );
      showToast('Không thể cập nhật trạng thái tài khoản', 'error');
    }
  };

  /* ── Change role ── */
  const handleRoleChange = async (user: User, newRole: string) => {
    setRoleDropdownId(null);
    if (user.system_role === newRole) return;

    const oldRole = user.system_role;
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, system_role: newRole } : u))
    );
    try {
      await api.patch(`/admin/users/${user.id}`, { system_role: newRole });
      showToast(
        `Đã đổi vai trò ${user.display_name || user.username} thành ${newRole}`,
        'success'
      );
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, system_role: oldRole } : u))
      );
      showToast('Không thể cập nhật vai trò', 'error');
    }
  };

  /* ── Invite user ── */
  const validateInviteForm = (): boolean => {
    const errors: Partial<InviteForm> = {};
    if (!inviteForm.username.trim()) errors.username = 'Tên đăng nhập là bắt buộc';
    if (!inviteForm.email.trim()) errors.email = 'Email là bắt buộc';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteForm.email))
      errors.email = 'Email không hợp lệ';
    if (!inviteForm.password.trim()) errors.password = 'Mật khẩu là bắt buộc';
    else if (inviteForm.password.length < 6)
      errors.password = 'Mật khẩu ít nhất 6 ký tự';
    if (!inviteForm.display_name.trim()) errors.display_name = 'Tên hiển thị là bắt buộc';
    setInviteErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInviteSubmit = async () => {
    if (!validateInviteForm()) return;
    setInviteSubmitting(true);
    try {
      await api.post('/auth/register', {
        username: inviteForm.username.trim(),
        email: inviteForm.email.trim(),
        password: inviteForm.password,
        display_name: inviteForm.display_name.trim(),
      });
      showToast(`Đã mời ${inviteForm.display_name} thành công!`, 'success');
      setShowInviteModal(false);
      setInviteForm({ username: '', email: '', password: '', display_name: '' });
      setInviteErrors({});
      // Refresh list
      fetchUsers();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.response?.data?.error || 'Không thể tạo tài khoản';
      showToast(msg, 'error');
    } finally {
      setInviteSubmitting(false);
    }
  };

  /* ── Helpers ── */
  const formatDate = (iso: string): string => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getInitial = (user: User): string => {
    return (user.display_name || user.username || '?').charAt(0).toUpperCase();
  };

  /* ═══════════════════ Render ═══════════════════ */
  return (
    <PageContainer
      title="Quản lý người dùng"
      subtitle="Quản lý tài khoản, vai trò và quyền truy cập hệ thống"
      icon={<Users size={24} />}
      actions={
        <button className="sb-btn sb-btn-primary" onClick={() => setShowInviteModal(true)}>
          <UserPlus size={18} />
          Mời người dùng
        </button>
      }
      filters={
        <div className="um-search-bar" style={{ margin: 0, width: '100%' }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, username hoặc email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="um-search-count">
            {filteredUsers.length} / {totalUsers} người dùng
          </span>
        </div>
      }
    >
      {/* Stats Bar */}
      <div className="um-stats-bar">
        <div className="um-stat-card">
          <div className="um-stat-icon users">
            <Users size={22} />
          </div>
          <div className="um-stat-info">
            <h3>{totalUsers}</h3>
            <span>Tổng người dùng</span>
          </div>
        </div>
        <div className="um-stat-card">
          <div className="um-stat-icon online">
            <Circle size={22} />
          </div>
          <div className="um-stat-info">
            <h3>{onlineUsers}</h3>
            <span>Đang trực tuyến</span>
          </div>
        </div>
        <div className="um-stat-card">
          <div className="um-stat-icon admins">
            <ShieldCheck size={22} />
          </div>
          <div className="um-stat-info">
            <h3>{adminCount}</h3>
            <span>Quản trị viên</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="um-table-container">
        {loading ? (
          <div className="um-loading">
            <div className="um-spinner" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="um-empty">
            <UserX size={48} />
            <p>
              {searchQuery
                ? 'Không tìm thấy người dùng phù hợp'
                : 'Chưa có người dùng nào trong hệ thống'}
            </p>
          </div>
        ) : (
          <table className="um-table">
            <thead>
              <tr>
                <th></th>
                <th>Tên</th>
                <th>Username</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Kích hoạt</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  {/* Avatar */}
                  <td>
                    <div className="um-avatar-cell">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          className="um-avatar"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove(
                              'um-hidden'
                            );
                          }}
                        />
                      ) : (
                        <div className="um-avatar-fallback">{getInitial(user)}</div>
                      )}
                      <span
                        className={`um-presence-dot ${
                          user.presence_status === 'online' ? 'online' : 'offline'
                        }`}
                      />
                    </div>
                  </td>

                  {/* Name */}
                  <td>
                    <div className="um-name-cell">
                      <span className="um-display-name">
                        {user.display_name || user.username}
                      </span>
                    </div>
                  </td>

                  {/* Username */}
                  <td>
                    <span className="um-username">@{user.username}</span>
                  </td>

                  {/* Email */}
                  <td>
                    <span className="um-email" title={user.email}>
                      {user.email}
                    </span>
                  </td>

                  {/* Role */}
                  <td>
                    <span
                      className={`um-role-badge ${
                        user.system_role === 'admin' ? 'admin' : 'user'
                      }`}
                    >
                      {user.system_role === 'admin' ? (
                        <ShieldCheck size={13} />
                      ) : (
                        <Shield size={13} />
                      )}
                      {user.system_role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <span
                      className={`um-status-badge ${
                        user.presence_status === 'online' ? 'online' : 'offline'
                      }`}
                    >
                      <span
                        className={`um-status-dot ${
                          user.presence_status === 'online' ? 'online' : 'offline'
                        }`}
                      />
                      {user.presence_status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </td>

                  {/* Active */}
                  <td>
                    <button
                      className={`um-active-toggle ${user.is_active ? 'active' : 'inactive'}`}
                      onClick={() => handleToggleActive(user)}
                      title={user.is_active ? 'Đang kích hoạt' : 'Đã vô hiệu hóa'}
                    />
                  </td>

                  {/* Created */}
                  <td>
                    <span className="um-created">{formatDate(user.created_at)}</span>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="um-actions">
                      <div className="um-role-dropdown-wrapper" ref={roleDropdownId === user.id ? dropdownRef : null}>
                        <button
                          className="sb-btn sb-btn-ghost um-action-btn"
                          title="Đổi vai trò"
                          onClick={() =>
                            setRoleDropdownId((prev) => (prev === user.id ? null : user.id))
                          }
                        >
                          <UserCog size={16} />
                        </button>
                        {roleDropdownId === user.id && (
                          <div className="um-role-dropdown">
                            <button
                              className={`um-role-option ${
                                user.system_role === 'user' ? 'selected' : ''
                              }`}
                              onClick={() => handleRoleChange(user, 'user')}
                            >
                              <Shield size={14} />
                              User
                            </button>
                            <button
                              className={`um-role-option ${
                                user.system_role === 'admin' ? 'selected' : ''
                              }`}
                              onClick={() => handleRoleChange(user, 'admin')}
                            >
                              <ShieldCheck size={14} />
                              Admin
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══════════ Invite Modal ═══════════ */}
      <LiquidModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Mời người dùng mới"
      >
        <div className="um-modal-body" style={{ padding: 0 }}>
          <div className="sb-form-group">
            <label className="sb-label">Tên hiển thị</label>
            <input
              type="text"
              className="sb-input"
              placeholder="VD: Nguyễn Văn A"
              value={inviteForm.display_name}
              onChange={(e) => {
                setInviteForm((f) => ({ ...f, display_name: e.target.value }));
                setInviteErrors((err) => ({ ...err, display_name: undefined }));
              }}
            />
            {inviteErrors.display_name && (
              <span className="um-form-error">{inviteErrors.display_name}</span>
            )}
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Tên đăng nhập</label>
            <input
              type="text"
              className="sb-input"
              placeholder="VD: nguyenvana"
              value={inviteForm.username}
              onChange={(e) => {
                setInviteForm((f) => ({ ...f, username: e.target.value }));
                setInviteErrors((err) => ({ ...err, username: undefined }));
              }}
            />
            {inviteErrors.username && (
              <span className="um-form-error">{inviteErrors.username}</span>
            )}
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Email</label>
            <input
              type="email"
              className="sb-input"
              placeholder="VD: user@example.com"
              value={inviteForm.email}
              onChange={(e) => {
                setInviteForm((f) => ({ ...f, email: e.target.value }));
                setInviteErrors((err) => ({ ...err, email: undefined }));
              }}
            />
            {inviteErrors.email && (
              <span className="um-form-error">{inviteErrors.email}</span>
            )}
          </div>

          <div className="sb-form-group">
            <label className="sb-label">Mật khẩu</label>
            <input
              type="password"
              className="sb-input"
              placeholder="Ít nhất 6 ký tự"
              value={inviteForm.password}
              onChange={(e) => {
                setInviteForm((f) => ({ ...f, password: e.target.value }));
                setInviteErrors((err) => ({ ...err, password: undefined }));
              }}
            />
            {inviteErrors.password && (
              <span className="um-form-error">{inviteErrors.password}</span>
            )}
          </div>
        </div>

        <div className="um-modal-footer" style={{ padding: '16px 0 0 0', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            className="sb-btn sb-btn-ghost"
            onClick={() => {
              setShowInviteModal(false);
              setInviteErrors({});
            }}
          >
            Hủy
          </button>
          <button
            className="sb-btn sb-btn-primary"
            disabled={inviteSubmitting}
            onClick={handleInviteSubmit}
          >
            {inviteSubmitting ? (
              <>
                <Loader2 size={16} className="um-btn-spinner" />
                Đang tạo…
              </>
            ) : (
              <>
                <UserPlus size={16} />
                Tạo tài khoản
              </>
            )}
          </button>
        </div>
      </LiquidModal>

      {/* ═══════════ Toast ═══════════ */}
      {toast && (
        <div className={`um-toast ${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
    </PageContainer>
  );
}
