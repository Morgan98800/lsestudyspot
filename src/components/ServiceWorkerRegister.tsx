'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('LSE Spots ServiceWorker registered:', reg.scope);
          })
          .catch((err) => {
            console.warn('LSE Spots ServiceWorker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}
