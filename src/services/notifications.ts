import i18n from '../i18n';

export const isTauriPlatform = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
};

export const triggerNotification = async (title: string, body: string) => {
  // Truncate body if too long
  const contentBody = body.startsWith('http') ? `[${i18n.t('chat.attachment', 'Attachment')}]` : body.substring(0, 100);

  if (isTauriPlatform()) {
    try {
      // Dynamic import to prevent bundler errors on standard web browsers
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('show_native_notification', { title, body: contentBody });
    } catch (err) {
      console.error('Failed to trigger Tauri native notification', err);
    }
  } else {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: contentBody });
      }
    }
  }
};

export const requestNotificationPermission = async () => {
  if (isTauriPlatform()) {
    return true;
  }
  
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }
  return false;
};
