'use client';

import React from 'react';
import { BusynessLevel } from '@/types/database';

interface StatusIconProps {
  level: BusynessLevel;
  className?: string;
}

export function StatusCircleIcon({ level, className = 'w-6 h-6' }: StatusIconProps) {
  if (level === 0) {
    // Plenty of seats = outlined circle with check
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
    );
  }

  if (level === 1) {
    // Filling up = half-filled outlined circle
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        className={className}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 2.5 A 9.5 9.5 0 0 1 12 21.5 Z" fill="currentColor" />
      </svg>
    );
  }

  // Full = outlined circle with cross
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

interface StatusSquareProps {
  level: BusynessLevel;
  isPredicted?: boolean;
}

export function StatusSquare({ level, isPredicted = false }: StatusSquareProps) {
  // Styles for live vs predicted
  const styleConfig = {
    0: {
      text: 'text-[var(--status-plenty-text)]',
      bg: 'bg-[var(--status-plenty-bg)]',
      border: 'border-[var(--status-plenty-text)]',
      label: 'Plenty of seats',
    },
    1: {
      text: 'text-[var(--status-filling-text)]',
      bg: 'bg-[var(--status-filling-bg)]',
      border: 'border-[var(--status-filling-text)]',
      label: 'Filling up',
    },
    2: {
      text: 'text-[var(--status-full-text)]',
      bg: 'bg-[var(--status-full-bg)]',
      border: 'border-[var(--status-full-text)]',
      label: 'Full',
    },
  };

  const cfg = styleConfig[level];

  if (isPredicted) {
    return (
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 border-dashed bg-transparent ${cfg.border} ${cfg.text} shrink-0`}
        title={`Predicted: ${cfg.label} (Usual level)`}
      >
        <StatusCircleIcon level={level} className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div
      className={`w-11 h-11 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.text} shrink-0`}
      title={`Live: ${cfg.label}`}
    >
      <StatusCircleIcon level={level} className="w-5 h-5" />
    </div>
  );
}
