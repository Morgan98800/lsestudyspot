'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Edit3,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sliders,
  X,
  FileText,
} from 'lucide-react';
import { AcademicPeriod, AcademicPeriodType, PredictionBucket } from '@/types/database';
import { DEFAULT_MULTIPLIERS } from '@/lib/algo/calendar';

interface AdminCalendarPanelProps {
  initialPeriods: AcademicPeriod[];
  initialMultipliers: Record<PredictionBucket, number>;
  adminSecret: string;
}

export function AdminCalendarPanel({
  initialPeriods,
  initialMultipliers,
  adminSecret,
}: AdminCalendarPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState(false);

  const [periods, setPeriods] = useState<AcademicPeriod[]>(initialPeriods);
  const [multipliers, setMultipliers] = useState<Record<PredictionBucket, number>>(initialMultipliers);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Add / Edit period modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null);
  const [formYear, setFormYear] = useState('2026/27');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AcademicPeriodType>('teaching');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // CSV import modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);

  // Multipliers form state
  const [multiplierForm, setMultiplierForm] = useState<Record<PredictionBucket, number>>(initialMultipliers);
  const [isSavingMultipliers, setIsSavingMultipliers] = useState(false);

  useEffect(() => {
    // If previously unlocked in session, auto-auth
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('lse_admin_unlocked');
      if (stored === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const refreshData = async () => {
    try {
      const res = await fetch('/api/admin/calendar');
      const data = await res.json();
      if (data.success) {
        if (data.periods) setPeriods(data.periods);
        if (data.multipliers) {
          setMultipliers(data.multipliers);
          setMultiplierForm(data.multipliers);
        }
      }
    } catch (err) {
      console.error('Failed to refresh calendar data:', err);
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

  const openAddModal = () => {
    setEditingPeriod(null);
    setFormYear('2026/27');
    setFormName('');
    setFormType('teaching');
    setFormStartDate('');
    setFormEndDate('');
    setFormNotes('');
    setErrorNotice(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: AcademicPeriod) => {
    setEditingPeriod(p);
    setFormYear(p.academic_year);
    setFormName(p.name);
    setFormType(p.type);
    setFormStartDate(p.start_date);
    setFormEndDate(p.end_date);
    setFormNotes(p.notes || '');
    setErrorNotice(null);
    setIsModalOpen(true);
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    const payload = {
      academic_year: formYear,
      name: formName,
      type: formType,
      start_date: formStartDate,
      end_date: formEndDate,
      notes: formNotes,
    };

    try {
      let res;
      if (editingPeriod) {
        res = await fetch('/api/admin/calendar', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPeriod.id, updates: payload }),
        });
      } else {
        res = await fetch('/api/admin/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period: payload }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorNotice(data.error || 'Failed to save period');
        return;
      }

      setIsModalOpen(false);
      setActionNotice(editingPeriod ? 'Period updated successfully' : 'Period added successfully');
      await refreshData();
    } catch {
      setErrorNotice('Network error saving period');
    }
  };

  const handleDeletePeriod = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete period "${name}"?`)) return;

    try {
      const res = await fetch('/api/admin/calendar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setActionNotice(`Period "${name}" deleted`);
        await refreshData();
      } else {
        setErrorNotice(data.error || 'Failed to delete period');
      }
    } catch {
      setErrorNotice('Network error deleting period');
    }
  };

  const handleSaveMultipliers = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMultipliers(true);
    setErrorNotice(null);

    try {
      const res = await fetch('/api/admin/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'multipliers', multipliers: multiplierForm }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMultipliers(data.multipliers);
        setActionNotice('Bucket multipliers updated successfully');
      } else {
        setErrorNotice(data.error || 'Failed to update multipliers');
      }
    } catch {
      setErrorNotice('Network error updating multipliers');
    } finally {
      setIsSavingMultipliers(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setCsvError(null);

    if (!csvContent.trim()) {
      setCsvError('Please paste CSV content or select a file.');
      return;
    }

    try {
      const res = await fetch('/api/admin/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import_csv', csvText: csvContent }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setCsvError(data.error || 'Failed to import CSV');
        return;
      }

      setIsCsvModalOpen(false);
      setCsvContent('');
      setActionNotice(`Successfully imported ${data.importedCount} periods`);
      await refreshData();
    } catch {
      setCsvError('Network error uploading CSV');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text || '');
    };
    reader.readAsText(file);
  };

  if (!isAuthenticated) {
    return (
      <main className="max-w-md mx-auto px-4 pt-24 pb-16">
        <h1 className="text-2xl font-bold font-heading text-[var(--ink)] mb-2">
          Admin Authentication
        </h1>
        <p className="text-sm text-[var(--ink-2)] mb-6">
          Enter your admin secret to manage the academic calendar.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-2">
              Admin Secret
            </label>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Enter secret..."
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              autoFocus
            />
          </div>

          {authError && (
            <p className="text-xs text-[var(--status-full-text)]">
              Incorrect admin secret.
            </p>
          )}

          <button
            type="submit"
            className="w-full min-h-[46px] rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-sm cursor-pointer"
          >
            Unlock calendar
          </button>
        </form>
      </main>
    );
  }

  // Group periods by academic year
  const groupedPeriods: Record<string, AcademicPeriod[]> = {};
  for (const p of periods) {
    if (!groupedPeriods[p.academic_year]) {
      groupedPeriods[p.academic_year] = [];
    }
    groupedPeriods[p.academic_year].push(p);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 pt-20 pb-24">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[var(--line)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin"
              className="text-xs font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Rooms</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold font-heading text-[var(--ink)]">
            Academic Calendar & Predictions
          </h1>
          <p className="text-xs text-[var(--ink-2)]">
            Configure terms, reading weeks, and exam periods for bucketed predictions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCsvError(null);
              setIsCsvModalOpen(true);
            }}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-2)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Period</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--status-full-bg)] text-[var(--status-full-text)] text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Multipliers Section */}
      <section className="mb-8 p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sliders className="w-4 h-4 text-[var(--brand)]" />
          <h2 className="text-base font-bold text-[var(--ink)]">
            Cold-Start Prediction Multipliers
          </h2>
        </div>
        <p className="text-xs text-[var(--ink-2)] mb-4">
          Applied when falling back from a bucket with no data (steps 3–5 of the fallback chain). Clamped between 0.0 and 2.0. Never applied when real historical data exists.
        </p>

        <form onSubmit={handleSaveMultipliers} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-1">
                Exam Period
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                value={multiplierForm.exam ?? 1.15}
                onChange={(e) =>
                  setMultiplierForm((prev) => ({ ...prev, exam: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-xs font-mono"
              />
              <span className="text-[10px] text-[var(--ink-2)]">Default: 1.15</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-1">
                Reading Week
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                value={multiplierForm.reading ?? 1.1}
                onChange={(e) =>
                  setMultiplierForm((prev) => ({ ...prev, reading: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-xs font-mono"
              />
              <span className="text-[10px] text-[var(--ink-2)]">Default: 1.10</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-1">
                Vacation
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                value={multiplierForm.vacation ?? 0.6}
                onChange={(e) =>
                  setMultiplierForm((prev) => ({ ...prev, vacation: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-xs font-mono"
              />
              <span className="text-[10px] text-[var(--ink-2)]">Default: 0.60</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-1">
                Early Term (W1–3)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                value={multiplierForm.early ?? 1.0}
                onChange={(e) =>
                  setMultiplierForm((prev) => ({ ...prev, early: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-xs font-mono"
              />
              <span className="text-[10px] text-[var(--ink-2)]">Default: 1.00</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-1">
                Mid Term (W4–7)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                value={multiplierForm.mid ?? 1.0}
                onChange={(e) =>
                  setMultiplierForm((prev) => ({ ...prev, mid: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-xs font-mono"
              />
              <span className="text-[10px] text-[var(--ink-2)]">Default: 1.00</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-1">
                Late Term (W8+)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="2"
                value={multiplierForm.late ?? 1.0}
                onChange={(e) =>
                  setMultiplierForm((prev) => ({ ...prev, late: parseFloat(e.target.value) || 0 }))
                }
                className="w-full px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] text-xs font-mono"
              />
              <span className="text-[10px] text-[var(--ink-2)]">Default: 1.00</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingMultipliers}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-[var(--ink)] text-[var(--surface)] hover:opacity-90 cursor-pointer transition-opacity"
            >
              {isSavingMultipliers ? 'Saving...' : 'Save Multipliers'}
            </button>
          </div>
        </form>
      </section>

      {/* Academic Periods List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-[var(--brand)]" />
            <h2 className="text-base font-bold text-[var(--ink)]">Academic Periods</h2>
          </div>
          <span className="text-xs text-[var(--ink-2)]">
            {periods.length} {periods.length === 1 ? 'period' : 'periods'} configured
          </span>
        </div>

        {Object.keys(groupedPeriods).length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-sm text-[var(--ink-2)]">
            No academic periods defined yet. Use &ldquo;Add Period&rdquo; or &ldquo;Import CSV&rdquo; above.
          </div>
        ) : (
          Object.entries(groupedPeriods).map(([year, yearPeriods]) => (
            <div
              key={year}
              className="rounded-2xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden shadow-sm"
            >
              <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  Academic Year {year}
                </span>
                <span className="text-[11px] text-[var(--ink-2)]">
                  {yearPeriods.length} periods
                </span>
              </div>

              <div className="divide-y divide-[var(--line)]">
                {yearPeriods.map((p) => {
                  const badgeColor =
                    p.type === 'exam'
                      ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
                      : p.type === 'reading'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                      : p.type === 'vacation'
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';

                  return (
                    <div
                      key={p.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-2)]/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--ink)]">
                            {p.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}`}
                          >
                            {p.type}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-[var(--ink-2)]">
                          {p.start_date} &rarr; {p.end_date}
                        </div>
                        {p.notes && (
                          <p className="text-[11px] text-[var(--ink-2)] italic">
                            {p.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="p-2 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
                          title="Edit period"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePeriod(p.id, p.name)}
                          className="p-2 rounded-lg text-[var(--status-full-text)] hover:bg-[var(--status-full-bg)] cursor-pointer"
                          title="Delete period"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Add / Edit Period Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-base font-bold text-[var(--ink)]">
                {editingPeriod ? 'Edit Academic Period' : 'Add Academic Period'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePeriod} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    required
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    placeholder="2026/27"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as AcademicPeriodType)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs"
                  >
                    <option value="teaching">Teaching</option>
                    <option value="reading">Reading Week</option>
                    <option value="exam">Exam Period</option>
                    <option value="vacation">Vacation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                  Period Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Michaelmas Term, Week 6 Reading Week"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                    Start Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                    End Date (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. TODO_VERIFY official LSE dates"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs"
                />
              </div>

              {errorNotice && (
                <p className="text-xs text-[var(--status-full-text)]">{errorNotice}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-2)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] text-xs font-semibold cursor-pointer"
                >
                  {editingPeriod ? 'Save Changes' : 'Create Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-xl w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--brand)]" />
                <h3 className="text-base font-bold text-[var(--ink)]">
                  Import Academic Periods CSV
                </h3>
              </div>
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--ink-2)]">
              CSV must include columns:{' '}
              <code className="px-1 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink)]">
                academic_year,name,type,start_date,end_date,notes
              </code>
            </p>

            <form onSubmit={handleCsvImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-[var(--ink-2)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--surface-2)] file:text-[var(--ink)] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--ink-2)] mb-1">
                  Or Paste CSV Data Directly
                </label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder={`academic_year,name,type,start_date,end_date,notes\n2026/27,Michaelmas Term,teaching,2026-09-28,2026-12-11,Autumn term\n2026/27,Autumn Reading Week,reading,2026-11-02,2026-11-06,Week 6`}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] text-xs font-mono"
                />
              </div>

              {csvError && (
                <p className="text-xs text-[var(--status-full-text)]">{csvError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--ink-2)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] text-xs font-semibold cursor-pointer"
                >
                  Import Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="mt-12 pt-6 border-t border-[var(--line)] text-center text-xs text-[var(--ink-2)] flex items-center justify-center gap-3">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span>&bull;</span>
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
