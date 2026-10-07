'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { RotateCw, CheckCircle2, Download, Edit3, X } from 'lucide-react';
import { Zone } from '@/types/database';

interface AdminPanelProps {
  initialZones: Zone[];
  adminSecret: string;
}

export function AdminPanel({ initialZones, adminSecret }: AdminPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [reportVolume, setReportVolume] = useState<Record<string, number>>({});
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Edit modal state
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/admin/metrics')
        .then((r) => r.json())
        .then((data) => {
          if (data.volume) setReportVolume(data.volume);
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
    try {
      const nextActive = !currentActive;
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

    setZones((prev) =>
      prev.map((z) => (z.id === editingZone.id ? editingZone : z))
    );
    setEditingZone(null);
    setActionNotice('Zone details updated locally');
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
    <main className="max-w-2xl mx-auto px-4 pt-20 pb-12">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[var(--line)]">
        <div>
          <h1 className="text-2xl font-bold font-heading text-[var(--ink)]">
            Zone management
          </h1>
          <p className="text-xs text-[var(--ink-2)]">
            Rotate tokens, activate/deactivate zones, and download posters.
          </p>
        </div>

        <Link
          href="/"
          className="text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          Back to app
        </Link>
      </div>

      {actionNotice && (
        <div className="mb-4 p-3 rounded-xl bg-[var(--status-plenty-bg)] text-[var(--status-plenty-text)] text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Zone list */}
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

            {/* Actions */}
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
    </main>
  );
}
