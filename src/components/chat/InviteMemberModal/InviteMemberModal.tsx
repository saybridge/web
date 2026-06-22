import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Users, UserPlus, X } from 'lucide-react';
import { api } from '../../../services/api';
import { LiquidModal } from '@saybridge/ui';
import './InviteMemberModal.css';

interface InviteMemberModalProps {
  roomId: string;
  inviteQuery: string;
  setInviteQuery: (q: string) => void;
  inviteResults: any[];
  setInviteResults: (r: any[]) => void;
  invitedIds: Set<string>;
  setInvitedIds: (s: Set<string>) => void;
  isInviting: boolean;
  setIsInviting: (b: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  roomId,
  inviteQuery,
  setInviteQuery,
  inviteResults,
  setInviteResults,
  invitedIds,
  setInvitedIds,
  isInviting,
  setIsInviting,
  inputRef,
  onClose,
}) => {
  const { t } = useTranslation();
  // Search users
  useEffect(() => {
    if (!inviteQuery.trim() || inviteQuery.length < 2) {
      setInviteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/users/search', { params: { q: inviteQuery, limit: 8 } });
        const data = res.data?.data;
        setInviteResults(Array.isArray(data) ? data : data?.users || []);
      } catch {
        setInviteResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inviteQuery]);

  const handleInvite = async (userId: string) => {
    setIsInviting(true);
    try {
      const res = await api.post(`/rooms/${roomId}/members`, { user_id: userId });
      if (res.data?.success) {
        setInvitedIds(new Set(invitedIds).add(userId));
      }
    } catch (err: any) {
      console.error('Invite failed:', err);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <LiquidModal
      isOpen={true}
      onClose={onClose}
      title={t('inviteMember.title')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Search */}
        <div className="invite-modal-search" style={{ margin: 0 }}>
          <Search size={15} />
          <input
            ref={inputRef}
            type="text"
            placeholder={t('inviteMember.searchPlaceholder')}
            value={inviteQuery}
            onChange={(e) => setInviteQuery(e.target.value)}
            autoFocus
          />
          {inviteQuery && (
            <button className="invite-modal-search-clear" onClick={() => setInviteQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="invite-modal-body" style={{ maxHeight: '350px', overflowY: 'auto', padding: 0 }}>
          {inviteQuery.length < 2 && (
            <div className="invite-modal-empty" style={{ padding: '24px 0' }}>
              <Users size={28} />
              <p>{t('inviteMember.minChars')}</p>
            </div>
          )}
          {inviteQuery.length >= 2 && inviteResults.length === 0 && (
            <div className="invite-modal-empty" style={{ padding: '24px 0' }}>
              <Search size={28} />
              <p>{t('inviteMember.noResults')}</p>
            </div>
          )}
          {inviteResults.map((u) => {
            const invited = invitedIds.has(u.id);
            return (
              <div key={u.id} className={`invite-modal-user ${invited ? 'invite-modal-user--invited' : ''}`}>
                <div className="invite-modal-user-avatar">
                  {(u.username || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="invite-modal-user-info">
                  <span className="invite-modal-user-name">
                    {u.display_name || u.username}
                  </span>
                  <span className="invite-modal-user-meta">
                    @{u.username}{u.email ? ` · ${u.email}` : ''}
                  </span>
                </div>
                {invited ? (
                  <span className="invite-modal-badge">{t('inviteMember.invited')}</span>
                ) : (
                  <button
                    className="invite-modal-invite-btn"
                    onClick={() => handleInvite(u.id)}
                    disabled={isInviting}
                  >
                    {t('inviteMember.invite')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </LiquidModal>
  );
};
