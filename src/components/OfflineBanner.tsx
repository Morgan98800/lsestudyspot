'use client';

import React, { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineTime, setOfflineTime] = useState<string>('');

  useEffect(() => {
    const handleStatus = () => {
      if (!navigator.onLine) {
        setIsOffline(true);
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`;
        setOfflineTime(timeStr);
      } else {
        setIsOffline(false);
      }
    };

    if (typeof window !== 'undefined') {
      if (!navigator.onLine) handleStatus();
      window.addEventListener('online', handleStatus);
      window.addEventListener('offline', handleStatus);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleStatus);
        window.removeEventListener('offline', handleStatus);
      }
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="fixed top-14 left-0 right-0 z-30 bg-[var(--surface-2)] text-[var(--ink)] text-xs font-semibold py-2 px-4 text-center border-b border-[var(--line)] shadow-xs"
    >
      Offline. Showing data from {offlineTime || '14:32'}.
    </div>
  );
}
