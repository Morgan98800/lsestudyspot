'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FeedbackKind } from '@/types/database';
import strings from '@/messages/en.json';

interface FeedbackFormProps {
  fromParam?: string | null;
  zoneSlugParam?: string | null;
}

export function FeedbackForm({ fromParam = null, zoneSlugParam = null }: FeedbackFormProps) {
  const [kind, setKind] = useState<FeedbackKind>('wrong');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ message?: string; email?: string; general?: string }>({});

  const messageRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [clientRandomId, setClientRandomId] = useState<string>('');

  useEffect(() => {
    try {
      let id = localStorage.getItem('lse_client_random_id') || localStorage.getItem('lse_spots_device_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('lse_client_random_id', id);
      }
      setClientRandomId(id);
    } catch {
      // Storage unavailable
    }
  }, []);

  const getHelperText = (selectedKind: FeedbackKind) => {
    switch (selectedKind) {
      case 'wrong':
        return 'Which space, and what did you see?';
      case 'idea':
        return 'What would make LSE Spots better?';
      case 'other':
      default:
        return "What's on your mind?";
    }
  };

  const validate = () => {
    const newErrors: { message?: string; email?: string; general?: string } = {};

    const trimmedMsg = message.trim();
    if (trimmedMsg.length < 10) {
      newErrors.message = strings.feedback.errors.minChars;
    } else if (trimmedMsg.length > 500) {
      newErrors.message = strings.feedback.errors.maxChars;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        newErrors.email = strings.feedback.errors.invalidEmail;
      }
    }

    setErrors(newErrors);

    if (newErrors.message) {
      messageRef.current?.focus();
      return false;
    }
    if (newErrors.email) {
      emailRef.current?.focus();
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          message,
          email: email.trim() || null,
          from: fromParam,
          zone_slug: zoneSlugParam,
          client_random_id: clientRandomId,
          honeypot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.error || 'Could not send feedback. Please try again.' });
        return;
      }

      setSuccess(true);
    } catch {
      setErrors({ general: 'Network error. Please check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS SCREEN
  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+3rem)] min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] flex items-center justify-center mb-6 animate-check">
          <svg
            className="w-9 h-9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--ink)] mb-3">
          Thanks, we read every message.
        </h1>

        <div className="w-full mt-8">
          <Link
            href="/"
            className="w-full min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-base shadow-xs hover:opacity-95 transition-opacity"
          >
            See free spaces
          </Link>
        </div>
      </div>
    );
  }

  // FEEDBACK FORM
  return (
    <div className="max-w-xl mx-auto px-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+1.5rem)]">
      {/* 1. Heading & Subline */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--ink)] tracking-tight">
          Tell us what&apos;s wrong or missing
        </h1>
        <p className="text-base text-[var(--ink-2)] mt-1">
          We read every message.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Honeypot field (hidden from real users) */}
        <input
          type="text"
          name="feedback_hp"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="sr-only"
          aria-hidden="true"
        />

        {/* General error message if submit failed */}
        {errors.general && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 font-medium"
          >
            {errors.general}
          </div>
        )}

        {/* 2. Three large choice buttons (>= 56px) */}
        <fieldset>
          <legend className="sr-only">Feedback kind</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setKind('wrong');
                setErrors((prev) => ({ ...prev, message: undefined }));
              }}
              aria-pressed={kind === 'wrong'}
              className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all flex items-center justify-center text-center cursor-pointer ${
                kind === 'wrong'
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)] shadow-xs'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-2)]'
              }`}
            >
              Something is wrong
            </button>

            <button
              type="button"
              onClick={() => {
                setKind('idea');
                setErrors((prev) => ({ ...prev, message: undefined }));
              }}
              aria-pressed={kind === 'idea'}
              className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all flex items-center justify-center text-center cursor-pointer ${
                kind === 'idea'
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)] shadow-xs'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-2)]'
              }`}
            >
              I have an idea
            </button>

            <button
              type="button"
              onClick={() => {
                setKind('other');
                setErrors((prev) => ({ ...prev, message: undefined }));
              }}
              aria-pressed={kind === 'other'}
              className={`min-h-[56px] px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all flex items-center justify-center text-center cursor-pointer ${
                kind === 'other'
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)] shadow-xs'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-2)]'
              }`}
            >
              Something else
            </button>
          </div>
        </fieldset>

        {/* 3. Text Area with live counter and dynamic helper */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="feedback-message" className="text-sm font-bold text-[var(--ink)]">
              What happened? <span className="text-[var(--brand)]" aria-hidden="true">*</span>
            </label>
            <span
              className={`text-xs ${
                message.length > 500
                  ? 'text-red-600 font-bold'
                  : message.length >= 10
                  ? 'text-[var(--ink-2)]'
                  : 'text-[var(--ink-2)]'
              }`}
              aria-live="polite"
            >
              {message.length}/500 characters
            </span>
          </div>

          <p id="message-helper" className="text-xs text-[var(--ink-2)] mb-2">
            {getHelperText(kind)}
          </p>

          <textarea
            ref={messageRef}
            id="feedback-message"
            name="message"
            rows={4}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (errors.message) {
                setErrors((prev) => ({ ...prev, message: undefined }));
              }
            }}
            aria-describedby="message-helper message-error"
            aria-invalid={Boolean(errors.message)}
            placeholder="Type your message here..."
            className={`w-full p-3.5 rounded-2xl bg-[var(--surface)] border-2 text-base text-[var(--ink)] placeholder:text-[var(--ink-2)]/60 focus:outline-none transition-colors ${
              errors.message
                ? 'border-red-600 focus:border-red-600'
                : 'border-[var(--line)] focus:border-[var(--brand)]'
            }`}
          />

          {errors.message && (
            <p id="message-error" role="alert" className="text-xs font-semibold text-red-600 mt-1.5">
              {errors.message}
            </p>
          )}
        </div>

        {/* 4. Optional Email Field */}
        <div>
          <label htmlFor="feedback-email" className="block text-sm font-bold text-[var(--ink)] mb-1">
            Your email (only if you want a reply)
          </label>
          <p id="email-helper" className="text-xs text-[var(--ink-2)] mb-2">
            We only use it to reply to you. Leave it empty to stay anonymous.
          </p>

          <input
            ref={emailRef}
            type="email"
            id="feedback-email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) {
                setErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            aria-describedby="email-helper email-error"
            aria-invalid={Boolean(errors.email)}
            placeholder="name@example.com"
            className={`w-full min-h-[48px] px-3.5 rounded-2xl bg-[var(--surface)] border-2 text-base text-[var(--ink)] placeholder:text-[var(--ink-2)]/60 focus:outline-none transition-colors ${
              errors.email
                ? 'border-red-600 focus:border-red-600'
                : 'border-[var(--line)] focus:border-[var(--brand)]'
            }`}
          />

          {errors.email && (
            <p id="email-error" role="alert" className="text-xs font-semibold text-red-600 mt-1.5">
              {errors.email}
            </p>
          )}
        </div>

        {/* 5. Privacy note & link */}
        <p className="text-xs text-[var(--ink-2)] leading-relaxed">
          Please don&apos;t include personal details about other people.{' '}
          <Link href="/privacy" className="underline hover:text-[var(--ink)]">
            Privacy
          </Link>
        </p>

        {/* 6. Primary Button in thumb zone (kept enabled) */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-bold text-base shadow-xs hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer"
          >
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-[var(--line)] text-center text-xs text-[var(--ink-2)] space-y-2">
        <p>Student-built, not affiliated with LSE. Estimates only.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>&bull;</span>
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>
          <span>&bull;</span>
          <Link href="/feedback" className="font-semibold text-[var(--ink)] hover:underline">
            Send feedback
          </Link>
        </div>
      </footer>
    </div>
  );
}
