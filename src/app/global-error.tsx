'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error.message, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '24px',
          backgroundColor: '#F6F5F3',
          color: '#1B1B1D',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <header
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '56px',
            backgroundColor: '#E4002B',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '18px',
          }}
        >
          LSE Spots
        </header>

        <div style={{ maxWidth: '420px', width: '100%', marginTop: '64px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              marginBottom: '12px',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: '#55555B',
              marginBottom: '28px',
              lineHeight: 1.5,
            }}
          >
            It&apos;s not you. Try again in a moment.
          </p>

          <button
            type="button"
            onClick={() => reset()}
            style={{
              width: '100%',
              minHeight: '48px',
              backgroundColor: '#E4002B',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              marginBottom: '12px',
            }}
          >
            Try again
          </button>

          <a
            href="/"
            style={{
              display: 'inline-flex',
              width: '100%',
              minHeight: '48px',
              backgroundColor: '#EBE9E6',
              color: '#1B1B1D',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '16px',
              textDecoration: 'none',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            See free spaces
          </a>
        </div>
      </body>
    </html>
  );
}
