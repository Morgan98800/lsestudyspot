'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  CheckCircle2,
  Trash2,
  Eye,
  Check,
  Mail,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Lightbulb,
  HelpCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Feedback, FeedbackKind, FeedbackStatus } from '@/types/database';

interface AdminFeedbackPanelProps {
  initialFeedbacks: Feedback[];
  adminSecret: string;
}

export function AdminFeedbackPanel({ initialFeedbacks, adminSecret }: AdminFeedbackPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState(false);

  const [feedbacks, setFeedbacks] = useState<Feedback[]>(initialFeedbacks);
  const [filter, setFilter] = useState<'all' | FeedbackStatus>('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('lse_admin_unlocked');
      if (stored === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const refreshData = async () => {
    try {
      const res = await fetch('/api/admin/feedback');
      const data = await res.json();
      if (data.success && data.feedback) {
        setFeedbacks(data.feedback);
      }
    } catch (err) {
      console.error('Failed to refresh feedback:', err);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretInput === adminSecret) {
      setIsAuthenticated(true);
      setAuthError(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('lse_admin_unlocked', 'true');
      }
    } else {
      setAuthError(true);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: FeedbackStatus) => {
    setIsProcessing(id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbacks((prev) =>
          prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f))
        );
        setActionNotice(`Feedback marked as ${newStatus}`);
      }
    } catch {
      setActionNotice('Failed to update status');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback entry?')) {
      return;
    }

    setIsProcessing(id);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedbacks((prev) => prev.filter((f) => f.id !== id));
        setActionNotice('Feedback deleted');
      }
    } catch {
      setActionNotice('Failed to delete feedback');
    } finally {
      setIsProcessing(null);
    }
  };

  const counts = {
    all: feedbacks.length,
    new: feedbacks.filter((f) => f.status === 'new').length,
    seen: feedbacks.filter((f) => f.status === 'seen').length,
    done: feedbacks.filter((f) => f.status === 'done').length,
  };

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filter === 'all') return true;
    return f.status === filter;
  });

  const getKindBadge = (kind: FeedbackKind) => {
    switch (kind) {
      case 'wrong':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Something is wrong</span>
          </span>
        );
      case 'idea':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Lightbulb className="w-3 h-3" />
            <span>I have an idea</span>
          </span>
        );
      case 'other':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--ink-2)] border border-[var(--line)]">
            <HelpCircle className="w-3 h-3" />
            <span>Something else</span>
          </span>
        );
    }
  };

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case 'new':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-[var(--brand)] text-[var(--brand-ink)]">
            New
          </span>
        );
      case 'seen':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Seen
          </span>
        );
      case 'done':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Done
          </span>
        );
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="max-w-sm mx-auto px-4 pt-28 pb-8 min-h-[80vh] flex flex-col justify-center">
        <form
          onSubmit={handleLogin}
          className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xs"
        >
          <h1 className="text-xl font-bold font-heading text-[var(--ink)] mb-1">
            Admin access
          </h1>
          <p className="text-xs text-[var(--ink-2)] mb-4">
            Enter administrator secret to manage user feedback.
          </p>

          <input
            type="password"
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            placeholder="Admin secret"
            className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-sm mb-3 focus:outline-none"
          />

          {authError && (
            <p className="text-xs text-[var(--brand)] font-medium mb-3">
              Invalid secret key.
            </p>
          )}

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-sm cursor-pointer"
          >
            Unlock admin panel
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 pt-20 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 mb-6 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading text-[var(--ink)]">
              User Feedback
            </h1>
            {counts.new > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[var(--brand)] text-[var(--brand-ink)]">
                {counts.new} new
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--ink-2)] mt-0.5">
            Review user messages, bug reports, and suggestions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-2)] inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Control Room</span>
          </Link>
          <Link
            href="/admin/calendar"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-2)] inline-flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-[var(--brand)] hover:underline ml-1"
          >
            Back to app
          </Link>
        </div>
      </div>

      {actionNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[var(--line)] pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
            filter === 'all'
              ? 'bg-[var(--ink)] text-[var(--surface)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => setFilter('new')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
            filter === 'new'
              ? 'bg-[var(--ink)] text-[var(--surface)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          <span>New</span>
          {counts.new > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                filter === 'new'
                  ? 'bg-[var(--brand)] text-[var(--brand-ink)]'
                  : 'bg-[var(--brand)] text-white'
              }`}
            >
              {counts.new}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setFilter('seen')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
            filter === 'seen'
              ? 'bg-[var(--ink)] text-[var(--surface)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          Seen ({counts.seen})
        </button>
        <button
          type="button"
          onClick={() => setFilter('done')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
            filter === 'done'
              ? 'bg-[var(--ink)] text-[var(--surface)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          Done ({counts.done})
        </button>
      </div>

      {/* Feedback Items List */}
      {filteredFeedbacks.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[var(--surface)] border border-[var(--line)]">
          <MessageSquare className="w-8 h-8 mx-auto text-[var(--ink-2)] opacity-40 mb-3" />
          <p className="text-sm font-semibold text-[var(--ink)]">
            No feedback in this category
          </p>
          <p className="text-xs text-[var(--ink-2)] mt-1">
            {filter === 'all'
              ? 'No feedback submissions recorded yet.'
              : `There are currently no items marked as "${filter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="feedback-list">
          {filteredFeedbacks.map((item) => (
            <article
              key={item.id}
              data-testid={`feedback-row-${item.id}`}
              className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xs space-y-3 transition-colors"
            >
              {/* Header row: Kind, Status, Date */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {getKindBadge(item.kind)}
                  {getStatusBadge(item.status)}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]">
                  <Clock className="w-3.5 h-3.5 opacity-70" />
                  <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                </div>
              </div>

              {/* Feedback Content */}
              <div className="py-1">
                <p className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-wrap select-text">
                  {item.message}
                </p>
              </div>

              {/* Context metadata (Page, Zone, Email, App Version) */}
              <div className="pt-2 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-2)]">
                <div className="flex flex-wrap items-center gap-2">
                  {item.page_path && (
                    <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)] font-mono text-[11px] border border-[var(--line)]">
                      from: {item.page_path}
                    </span>
                  )}
                  {item.zone_slug && (
                    <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)] font-mono text-[11px] border border-[var(--line)]">
                      zone: {item.zone_slug}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-2)] text-[11px]">
                    app: v{item.app_version}
                  </span>
                </div>

                {item.email && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-[var(--brand)]" />
                    <a
                      href={`mailto:${item.email}?subject=LSE%20Spots%20Feedback`}
                      className="text-[var(--brand)] hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      <span>{item.email}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Action Buttons: Mark seen, Mark done, Delete */}
              <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                {item.status !== 'seen' && (
                  <button
                    type="button"
                    disabled={isProcessing === item.id}
                    onClick={() => handleUpdateStatus(item.id, 'seen')}
                    className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    <span>Mark seen</span>
                  </button>
                )}

                {item.status !== 'done' && (
                  <button
                    type="button"
                    disabled={isProcessing === item.id}
                    onClick={() => handleUpdateStatus(item.id, 'done')}
                    className="px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Mark done</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isProcessing === item.id}
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
