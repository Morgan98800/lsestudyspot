'use client';

export default function TestErrorPage() {
  if (typeof window !== 'undefined') {
    throw new Error('Simulated test error for error boundary');
  }

  return null;
}
