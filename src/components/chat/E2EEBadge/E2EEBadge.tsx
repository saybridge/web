import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import './E2EEBadge.css';

interface E2EEBadgeProps {
  isEncrypted: boolean;
  size?: number;
}

export const E2EEBadge: React.FC<E2EEBadgeProps> = ({ isEncrypted, size = 14 }) => {
  const { t } = useTranslation();
  if (!isEncrypted) return null;

  return (
    <span className="e2ee-badge" title={t('e2ee.encryptedTitle')}>
      <ShieldCheck size={size} />
      <span className="e2ee-badge-label">E2EE</span>
    </span>
  );
};
