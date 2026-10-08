'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, CheckCircle2, AlertCircle, ShieldCheck, ExternalLink } from 'lucide-react';
import strings from '@/messages/en.json';

export function PrivacyView() {
  const p = strings.privacy;

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteDeviceReports = async () => {
    setIsDeleting(true);
    setDeleteNotice(null);
    setDeleteError(null);

    try {
      const randomId = typeof window !== 'undefined' ? localStorage.getItem('lse_client_random_id') : null;

      if (!randomId) {
        setDeleteNotice(p.deleteEmpty);
        setIsDeleting(false);
        return;
      }

      const res = await fetch('/api/privacy/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_random_id: randomId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDeleteError(data.error || p.deleteError);
        setIsDeleting(false);
        return;
      }

      if (data.deletedReports > 0) {
        setDeleteNotice(p.deleteSuccess.replace('{count}', String(data.deletedReports)));
      } else {
        setDeleteNotice(p.deleteEmpty);
      }

      // Clear device identifier from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lse_client_random_id');
      }
    } catch {
      setDeleteError(p.deleteError);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col justify-between">
      {/* Red Header Bar */}
      <header className="sticky top-0 z-40 bg-[var(--brand)] text-[var(--brand-ink)] px-4 py-3 shadow-sm">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold hover:opacity-90 active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{p.backToApp}</span>
          </Link>
          <span className="text-xs uppercase font-bold tracking-wider opacity-90">
            {strings.app.name}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl w-full mx-auto px-4 py-8 space-y-8 flex-1">
        <div>
          <h1 className="text-2xl font-bold font-heading tracking-tight mb-1 text-[var(--ink)]">
            {p.title}
          </h1>
          <p className="text-xs text-[var(--ink-2)]">
            {p.subtitle}
          </p>
        </div>

        {/* Section 1: Who runs this */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.whoRuns.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.whoRuns.body}
          </p>
        </section>

        {/* Section 2: What we collect (Table) */}
        <section className="space-y-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.whatCollect.heading}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--ink-2)] font-semibold">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2">What it means</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-[var(--ink-2)]">
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">
                    {p.whatCollect.tableZone}
                  </td>
                  <td className="py-2.5">{p.whatCollect.tableZoneDesc}</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">
                    {p.whatCollect.tableLevel}
                  </td>
                  <td className="py-2.5">{p.whatCollect.tableLevelDesc}</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">
                    {p.whatCollect.tableTime}
                  </td>
                  <td className="py-2.5">{p.whatCollect.tableTimeDesc}</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">
                    {p.whatCollect.tableDevice}
                  </td>
                  <td className="py-2.5">{p.whatCollect.tableDeviceDesc}</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">
                    {p.whatCollect.tableIp}
                  </td>
                  <td className="py-2.5">{p.whatCollect.tableIpDesc}</td>
                </tr>
                {p.whatCollect.tableFeedback && (
                  <tr>
                    <td className="py-2.5 pr-3 font-medium text-[var(--ink)]">
                      {p.whatCollect.tableFeedback}
                    </td>
                    <td className="py-2.5">{p.whatCollect.tableFeedbackDesc}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: What we do not collect */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.whatNotCollect.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.whatNotCollect.body}
          </p>
        </section>

        {/* Section 4: Why we collect it */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.whyCollect.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.whyCollect.body}
          </p>
        </section>

        {/* Section 5: How long we keep it */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.howLong.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.howLong.body}
          </p>
        </section>

        {/* Section 6: Who else handles it */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.whoHandles.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.whoHandles.body}
          </p>
        </section>

        {/* Section 7: Cookies and storage */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.storage.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.storage.body}
          </p>
        </section>

        {/* Section 8: Your rights */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.yourRights.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.yourRights.body}{' '}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--brand)] underline inline-flex items-center gap-0.5 ml-1"
            >
              <span>ico.org.uk</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </section>

        {/* Section 9: Changes and Last updated */}
        <section className="space-y-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
          <h2 className="text-sm font-bold text-[var(--ink)]">
            {p.lastUpdated.heading}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--ink-2)]">
            {p.lastUpdated.body}
          </p>
        </section>

        {/* Self-service data deletion feature */}
        <section className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--brand)]" />
            <h2 className="text-base font-bold text-[var(--ink)]">
              Device Data Deletion
            </h2>
          </div>
          <p className="text-xs text-[var(--ink-2)]">
            Because we do not store logins, we can only identify reports made from this device. Tapping below will immediately remove all availability reports submitted by your browser from our database.
          </p>

          {deleteNotice && (
            <div className="p-3 rounded-xl bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{deleteNotice}</span>
            </div>
          )}

          {deleteError && (
            <div className="p-3 rounded-xl bg-[var(--status-full-bg)] text-[var(--status-full-text)] text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleDeleteDeviceReports}
            disabled={isDeleting}
            className="w-full min-h-[48px] rounded-xl bg-[var(--surface-2)] hover:bg-[var(--status-full-bg)] text-[var(--status-full-text)] border border-[var(--line)] font-semibold text-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.99]"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? p.deleting : p.deleteButton}</span>
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-xl mx-auto px-4 py-6 text-center text-xs text-[var(--ink-2)] border-t border-[var(--line)]">
        <p className="mb-1">{strings.app.disclaimer}</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <span>&bull;</span>
          <Link href="/privacy" className="font-semibold text-[var(--ink)] hover:underline">
            Privacy
          </Link>
          <span>&bull;</span>
          <Link href="/feedback" className="hover:underline">
            Send feedback
          </Link>
        </div>
      </footer>
    </div>
  );
}
