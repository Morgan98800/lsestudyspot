'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { RotateCw, CheckCircle2, Download, Edit3, X, Plus, Trash2, Clock, Calendar } from 'lucide-react';
import { OpeningException, TimeInterval, WeekdayIntervals, WeekdayKey, Zone } from '@/types/database';
import { normalizeDayIntervals } from '@/lib/algo/opening-hours';

interface AdminPanelProps {
  initialZones: Zone[];
  adminSecret: string;
}

const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

export function AdminPanel({ initialZones, adminSecret }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [activeTab, setActiveTab] = useState<'zones' | 'hours' | 'exceptions'>('zones');

  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [reportVolume, setReportVolume] = useState<Record<string, number>>({});
  const [exceptions, setExceptions] = useState<OpeningException[]>([]);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Edit details modal
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  // Edit hours modal
  const [editingHoursZone, setEditingHoursZone] = useState<Zone | null>(null);
  const [hoursForm, setHoursForm] = useState<Record<WeekdayKey, TimeInterval[]>>({
    mon: [],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  });
  const [hoursError, setHoursError] = useState<string | null>(null);

  // Add exception modal
  const [isAddingException, setIsAddingException] = useState(false);
  const [excZoneId, setExcZoneId] = useState<string>('ALL');
  const [excStartDate, setExcStartDate] = useState('');
  const [excEndDate, setExcEndDate] = useState('');
  const [excIsClosed, setExcIsClosed] = useState(true);
  const [excOpenTime, setExcOpenTime] = useState('');
  const [excCloseTime, setExcCloseTime] = useState('');
  const [excReason, setExcReason] = useState('');
  const [excError, setExcError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch metrics
      fetch('/api/admin/metrics')
        .then((r) => r.json())
        .then((data) => {
          if (data.volume) setReportVolume(data.volume);
        })
        .catch(() => {});

      // Fetch exceptions
      fetch('/api/admin/exceptions')
        .then((r) => r.json())
        .then((data) => {
          if (data.exceptions) setExceptions(data.exceptions);
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secretInput === adminSecret) {
      setIsAuthenticated(true);
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  const handleRotate = async (zoneId: string) => {
    try {
      const res = await fetch('/api/admin/rotate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId }),
      });
      const data = await res.json();
      if (data.new_token) {
        setZones((prev) =>
          prev.map((z) => (z.id === zoneId ? { ...z, qr_token: data.new_token } : z))
        );
        setActionNotice('Rotated QR token successfully');
      }
    } catch {
      setActionNotice('Failed to rotate token');
    }
  };

  const handleToggle = async (zoneId: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    try {
      const res = await fetch('/api/admin/toggle-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, is_active: nextActive }),
      });
      if (res.ok) {
        setZones((prev) =>
          prev.map((z) => (z.id === zoneId ? { ...z, is_active: nextActive } : z))
        );
        setActionNotice(`Zone ${nextActive ? 'activated' : 'deactivated'}`);
      }
    } catch {
      setActionNotice('Failed to update zone status');
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;

    setZones((prev) => prev.map((z) => (z.id === editingZone.id ? editingZone : z)));
    setEditingZone(null);
    setActionNotice('Zone details updated locally');
  };

  // Hours editing
  const openHoursEditor = (zone: Zone) => {
    setEditingHoursZone(zone);
    setHoursError(null);

    const initial: Record<WeekdayKey, TimeInterval[]> = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    };

    if (zone.opening_hours) {
      for (const { key } of WEEKDAYS) {
        const raw = (zone.opening_hours as Record<string, any>)[key];
        initial[key] = normalizeDayIntervals(raw);
      }
    }
    setHoursForm(initial);
  };

  const handleAddInterval = (day: WeekdayKey) => {
    setHoursForm((prev) => ({
      ...prev,
      [day]: [...prev[day], { open: '08:00', close: '22:00' }],
    }));
  };

  const handleRemoveInterval = (day: WeekdayKey, idx: number) => {
    setHoursForm((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== idx),
    }));
  };

  const handleIntervalChange = (
    day: WeekdayKey,
    idx: number,
    field: 'open' | 'close',
    val: string
  ) => {
    setHoursForm((prev) => {
      const updated = [...prev[day]];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, [day]: updated };
    });
  };

  const handleSaveHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoursZone) return;
    setHoursError(null);

    try {
      const res = await fetch('/api/admin/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: editingHoursZone.id,
          opening_hours: hoursForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHoursError(data.error || 'Failed to update hours');
        return;
      }

      setZones((prev) =>
        prev.map((z) => (z.id === editingHoursZone.id ? { ...z, opening_hours: hoursForm } : z))
      );
      setEditingHoursZone(null);
      setActionNotice('Opening hours updated and validated successfully');
    } catch {
      setHoursError('Network error updating hours');
    }
  };

  // Exceptions handling
  const handleSaveException = async (e: React.FormEvent) => {
    e.preventDefault();
    setExcError(null);

    try {
      const payload = {
        zone_id: excZoneId === 'ALL' ? null : excZoneId,
        start_date: excStartDate,
        end_date: excEndDate,
        is_closed: excIsClosed,
        open_time: excIsClosed ? null : excOpenTime || null,
        close_time: excIsClosed ? null : excCloseTime || null,
        reason: excReason,
      };

      const res = await fetch('/api/admin/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setExcError(data.error || 'Failed to save exception');
        return;
      }

      setExceptions((prev) => [...prev, data.exception]);
      setIsAddingException(false);
      setExcReason('');
      setExcStartDate('');
      setExcEndDate('');
      setActionNotice('Exception created successfully');
    } catch {
      setExcError('Network error saving exception');
    }
  };

  const handleDeleteException = async (id: string) => {
    try {
      const res = await fetch('/api/admin/exceptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setExceptions((prev) => prev.filter((e) => e.id !== id));
        setActionNotice('Exception deleted');
      }
    } catch {
      setActionNotice('Failed to delete exception');
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
            Enter administrator secret to manage zones and signage.
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
    <main className="max-w-3xl mx-auto px-4 pt-20 pb-16">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--line)]">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--ink)]">
            Admin Control Room
          </h1>
          <p className="text-xs text-[var(--ink-2)]">
            Manage study zones, weekly opening hours, exceptions, and signage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/calendar"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surface-2)] inline-flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Academic Calendar</span>
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-[var(--brand)] hover:underline"
          >
            Back to app
          </Link>
        </div>
      </div>

      {actionNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-[var(--line)] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('zones')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
            activeTab === 'zones'
              ? 'bg-[var(--ink)] text-[var(--surface)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          Zones ({zones.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hours')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
            activeTab === 'hours'
              ? 'bg-[var(--ink)] text-[var(--surface)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          Weekly Opening Hours
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exceptions')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
            activeTab === 'exceptions'
              ? 'bg-[var(--ink)] text-[var(--surface)]'
              : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
          }`}
        >
          Opening Exceptions ({exceptions.length})
        </button>
      </div>

      {/* TAB 1: ZONES */}
      {activeTab === 'zones' && (
        <div className="flex flex-col gap-3">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col gap-3 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        zone.is_active ? 'bg-emerald-500' : 'bg-zinc-400'
                      }`}
                    />
                    <span className="font-bold text-sm text-[var(--ink)]">
                      {zone.name}
                    </span>
                  </div>
                  <div className="text-[var(--ink-2)] mt-0.5">
                    {zone.building} · {zone.descriptor} · {zone.noise}
                  </div>
                </div>

                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-2)]">
                  {reportVolume[zone.id] || 0} reports
                </span>
              </div>

              <div className="text-[11px] text-[var(--ink-2)] font-mono truncate">
                Token: {zone.qr_token}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => handleRotate(zone.id)}
                  className="min-h-[38px] px-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] font-medium inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rotate token</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingZone(zone)}
                  className="min-h-[38px] px-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] font-medium inline-flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit details</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggle(zone.id, zone.is_active)}
                  className={`min-h-[38px] px-3 rounded-lg font-medium cursor-pointer ${
                    zone.is_active
                      ? 'border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)]'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  {zone.is_active ? 'Deactivate' : 'Activate'}
                </button>

                <a
                  href={`/api/admin/posters?zoneId=${zone.id}&size=a5`}
                  className="min-h-[38px] px-3 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1 ml-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>A5 PDF</span>
                </a>

                <a
                  href={`/api/admin/posters?zoneId=${zone.id}&size=a6`}
                  className="min-h-[38px] px-3 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>A6 PDF</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: OPENING HOURS */}
      {activeTab === 'hours' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--ink-2)] mb-2">
            Weekly intervals evaluated in Europe/London timezone. Multi-interval and overnight hours (e.g. 18:00 to 02:00) are supported.
          </p>

          {zones.map((zone) => (
            <div
              key={zone.id}
              className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex flex-col gap-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[var(--ink)]">{zone.name}</h3>
                  <span className="text-[var(--ink-2)]">{zone.building}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openHoursEditor(zone)}
                  className="min-h-[36px] px-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--line)] cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Edit Schedule</span>
                </button>
              </div>

              {/* Weekly summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--line)] font-mono text-[11px]">
                {WEEKDAYS.map(({ key, label }) => {
                  const raw = (zone.opening_hours as Record<string, any>)?.[key];
                  const intervals = normalizeDayIntervals(raw);
                  return (
                    <div key={key} className="p-2 rounded-lg bg-[var(--surface-2)]">
                      <span className="font-semibold text-[var(--ink)] block">{label.slice(0, 3)}:</span>
                      <span className="text-[var(--ink-2)]">
                        {intervals.length === 0
                          ? 'Closed'
                          : intervals.map((i) => `${i.open}-${i.close}`).join(', ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: OPENING EXCEPTIONS */}
      {activeTab === 'exceptions' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--ink-2)]">
              Exceptions override weekly schedules for bank holidays, building closures, or extended exam periods.
            </p>
            <button
              type="button"
              onClick={() => setIsAddingException(true)}
              className="min-h-[38px] px-3.5 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Exception</span>
            </button>
          </div>

          {exceptions.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[var(--surface)] border border-[var(--line)] text-xs text-[var(--ink-2)]">
              No active opening exceptions configured.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {exceptions.map((exc) => {
                const targetZone = zones.find((z) => z.id === exc.zone_id);
                return (
                  <div
                    key={exc.id}
                    className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--ink)]">
                          {exc.reason}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            exc.is_closed
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          }`}
                        >
                          {exc.is_closed
                            ? 'Closed'
                            : `Hours: ${exc.open_time} - ${exc.close_time}`}
                        </span>
                      </div>
                      <div className="text-[var(--ink-2)] mt-1">
                        Dates: <span className="font-mono">{exc.start_date}</span> to{' '}
                        <span className="font-mono">{exc.end_date}</span> · Scope:{' '}
                        <span className="font-semibold">
                          {targetZone ? targetZone.name : 'All campus spaces'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteException(exc.id)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                      title="Delete exception"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Details Modal */}
      {editingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl flex flex-col gap-4 text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h2 className="text-base font-bold font-heading text-[var(--ink)]">
                Edit zone details
              </h2>
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="p-1 text-[var(--ink-2)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="font-semibold block mb-1">Name</label>
              <input
                type="text"
                value={editingZone.name}
                onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Descriptor</label>
              <input
                type="text"
                value={editingZone.descriptor}
                onChange={(e) => setEditingZone({ ...editingZone, descriptor: e.target.value })}
                className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Noise policy</label>
              <select
                value={editingZone.noise}
                onChange={(e) =>
                  setEditingZone({
                    ...editingZone,
                    noise: e.target.value as 'silent' | 'quiet' | 'social',
                  })
                }
                className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm"
              >
                <option value="silent">Silent</option>
                <option value="quiet">Quiet</option>
                <option value="social">Social / Talking fine</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingZone(null)}
                className="min-h-[42px] px-4 rounded-xl text-[var(--ink-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold"
              >
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Hours Modal */}
      {editingHoursZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveHours}
            className="w-full max-w-lg my-8 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl flex flex-col gap-4 text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <div>
                <h2 className="text-base font-bold font-heading text-[var(--ink)]">
                  Edit Hours: {editingHoursZone.name}
                </h2>
                <p className="text-[11px] text-[var(--ink-2)]">
                  Format: HH:MM (e.g. 08:30 to 22:00, or 18:00 to 02:00 for overnight)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingHoursZone(null)}
                className="p-1 text-[var(--ink-2)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {hoursError && (
              <p className="p-3 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs font-semibold">
                {hoursError}
              </p>
            )}

            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {WEEKDAYS.map(({ key, label }) => (
                <div key={key} className="p-3 rounded-xl bg-[var(--surface-2)] flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--ink)]">{label}</span>
                    <button
                      type="button"
                      onClick={() => handleAddInterval(key)}
                      className="text-xs font-semibold text-[var(--brand)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add interval</span>
                    </button>
                  </div>

                  {hoursForm[key].length === 0 ? (
                    <p className="text-[11px] text-[var(--ink-2)] italic">Closed all day</p>
                  ) : (
                    hoursForm[key].map((interval, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={interval.open}
                          onChange={(e) => handleIntervalChange(key, idx, 'open', e.target.value)}
                          placeholder="08:00"
                          className="w-20 min-h-[36px] px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-mono text-center text-xs"
                        />
                        <span className="text-[var(--ink-2)]">to</span>
                        <input
                          type="text"
                          value={interval.close}
                          onChange={(e) => handleIntervalChange(key, idx, 'close', e.target.value)}
                          placeholder="22:00"
                          className="w-20 min-h-[36px] px-2 rounded-lg bg-[var(--surface)] border border-[var(--line)] font-mono text-center text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveInterval(key, idx)}
                          className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setEditingHoursZone(null)}
                className="min-h-[42px] px-4 rounded-xl text-[var(--ink-2)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Exception Modal */}
      {isAddingException && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveException}
            className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--line)] shadow-xl flex flex-col gap-4 text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <h2 className="text-base font-bold font-heading text-[var(--ink)]">
                Add Opening Exception
              </h2>
              <button
                type="button"
                onClick={() => setIsAddingException(false)}
                className="p-1 text-[var(--ink-2)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {excError && (
              <p className="p-3 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs font-semibold">
                {excError}
              </p>
            )}

            <div>
              <label className="font-semibold block mb-1">Target space</label>
              <select
                value={excZoneId}
                onChange={(e) => setExcZoneId(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm"
              >
                <option value="ALL">All campus spaces</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.building})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={excStartDate}
                  onChange={(e) => setExcStartDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm font-mono"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">End Date (inclusive)</label>
                <input
                  type="date"
                  required
                  value={excEndDate}
                  onChange={(e) => setExcEndDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Closure status</label>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="excType"
                    checked={excIsClosed}
                    onChange={() => setExcIsClosed(true)}
                  />
                  <span>Closed all day</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="excType"
                    checked={!excIsClosed}
                    onChange={() => setExcIsClosed(false)}
                  />
                  <span>Custom / extended hours</span>
                </label>
              </div>
            </div>

            {!excIsClosed && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-semibold block mb-1">Open time</label>
                  <input
                    type="text"
                    placeholder="06:00"
                    value={excOpenTime}
                    onChange={(e) => setExcOpenTime(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Close time</label>
                  <input
                    type="text"
                    placeholder="23:30"
                    value={excCloseTime}
                    onChange={(e) => setExcCloseTime(e.target.value)}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="font-semibold block mb-1">Reason / Note</label>
              <input
                type="text"
                required
                placeholder="e.g. Bank holiday closure or Exam season extended hours"
                value={excReason}
                onChange={(e) => setExcReason(e.target.value)}
                className="w-full min-h-[40px] px-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsAddingException(false)}
                className="min-h-[42px] px-4 rounded-xl text-[var(--ink-2)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-[var(--brand)] text-[var(--brand-ink)] font-semibold cursor-pointer"
              >
                Save Exception
              </button>
            </div>
          </form>
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
