'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ZoneWithEstimate } from '@/types/database';
import {
  BUILDINGS_METADATA,
  computeBuildingSummary,
  BuildingSummary,
} from '@/lib/algo/map-color';
import { SpaceRow } from './SpaceRow';

interface CampusMapProps {
  zones: ZoneWithEstimate[];
  quietOnly: boolean;
  recommendedBuildingKey: string | null;
  openRowId: string | null;
  onToggleRow: (id: string) => void;
}

export function CampusMap({
  zones,
  quietOnly,
  recommendedBuildingKey,
  openRowId,
  onToggleRow,
}: CampusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [selectedBuildingKey, setSelectedBuildingKey] = useState<string | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [leafletError, setLeafletError] = useState(false);

  // Compute building summaries
  const buildings = useMemo(() => {
    return Object.keys(BUILDINGS_METADATA).map((bKey) => {
      return computeBuildingSummary(bKey, zones, quietOnly);
    });
  }, [zones, quietOnly]);

  // Leaflet initialization
  useEffect(() => {
    let mapInstance: any = null;

    async function initLeaflet() {
      if (!mapContainerRef.current) return;
      try {
        const L = (await import('leaflet')).default;

        const center: [number, number] = [51.5146, -0.1165];
        const southWest: [number, number] = [51.511, -0.122];
        const northEast: [number, number] = [51.518, -0.111];
        const bounds = L.latLngBounds(southWest, northEast);

        mapInstance = L.map(mapContainerRef.current, {
          center,
          zoom: 17,
          minZoom: 16,
          maxZoom: 18,
          maxBounds: bounds,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
        }).addTo(mapInstance);

        // Add building markers
        buildings.forEach((b) => {
          const isTryHere = recommendedBuildingKey === b.buildingKey;
          const tryHtml = isTryHere
            ? '<span style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--brand);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.3);">Try here</span>'
            : '';

          const borderStyle = b.isDashed ? 'dashed' : 'solid';
          const bgStyle = b.isClosed || b.offReason ? 'var(--surface-2)' : b.bgColor;
          const fgStyle = b.isClosed || b.offReason ? 'var(--ink-2)' : b.textColor;
          const subtitle = b.offReason || b.statusLabel;

          const markerHtml = `
            <div style="position:relative;width:104px;min-height:58px;padding:5px 6px;border-radius:12px;background:${bgStyle};color:${fgStyle};border:3px ${borderStyle} rgba(0,0,0,0.35);text-align:center;box-shadow:0 3px 8px rgba(0,0,0,0.25);font-family:sans-serif;line-height:1.15;cursor:pointer;">
              ${tryHtml}
              <div style="font-size:13px;font-weight:800;font-family:'Bricolage Grotesque',sans-serif;">${b.shortName}</div>
              <div style="font-size:11px;font-weight:700;">${b.bucketWord}</div>
              <div style="font-size:10.5px;font-weight:500;opacity:0.95;">${subtitle}</div>
            </div>
          `;

          const customIcon = L.divIcon({
            html: markerHtml,
            className: 'custom-building-marker',
            iconSize: [104, 58],
            iconAnchor: [52, 29],
          });

          const marker = L.marker(b.coordinates, { icon: customIcon }).addTo(mapInstance);
          marker.on('click', () => {
            setSelectedBuildingKey(b.buildingKey);
          });
        });

        setLeafletReady(true);
      } catch (err) {
        console.warn('Leaflet map load failed, using schematic SVG fallback:', err);
        setLeafletError(true);
      }
    }

    initLeaflet();

    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [buildings, recommendedBuildingKey]);

  // Handle ESC to close sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBuildingKey(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Selected building zones for bottom sheet
  const selectedBuildingZones = useMemo(() => {
    if (!selectedBuildingKey) return [];
    return zones.filter((z) => {
      const matchB =
        z.building.toLowerCase().includes(selectedBuildingKey.toLowerCase()) ||
        BUILDINGS_METADATA[selectedBuildingKey]?.name.toLowerCase() === z.building.toLowerCase();
      if (!matchB) return false;
      if (quietOnly && z.noise !== 'silent' && z.noise !== 'quiet') return false;
      return true;
    });
  }, [zones, selectedBuildingKey, quietOnly]);

  const selectedBuildingMeta = selectedBuildingKey
    ? BUILDINGS_METADATA[selectedBuildingKey]
    : null;

  return (
    <div className="relative mt-4">
      {/* MAP CONTAINER (Leaflet or Fallback) */}
      <div className="relative aspect-[360/440] w-full rounded-2xl overflow-hidden bg-[var(--map-bg)] border border-[var(--line)]">
        {/* Real Leaflet Map */}
        <div
          ref={mapContainerRef}
          className={`absolute inset-0 w-full h-full ${
            leafletReady && !leafletError ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Schematic SVG Fallback Map (Visible before Leaflet mounts or if offline) */}
        {(!leafletReady || leafletError) && (
          <div className="absolute inset-0 w-full h-full">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 360 440"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <rect x="0" y="0" width="360" height="124" fill="var(--park, #CFE5D5)" />
              <g fill="none" stroke="var(--surface)" strokeLinecap="round">
                <path d="M0 140H360" strokeWidth="12" />
                <path d="M346 0V440" strokeWidth="14" />
                <path d="M162 140V392" strokeWidth="10" />
                <path d="M0 420Q180 388 360 420" strokeWidth="14" />
              </g>
              <text x="8" y="18" fill="var(--ink-2)" fontSize="11" fontWeight="600">
                Lincoln&apos;s Inn Fields
              </text>
              <text x="8" y="134" fill="var(--ink-2)" fontSize="11" fontWeight="600">
                Portugal Street
              </text>
              <text x="170" y="384" fill="var(--ink-2)" fontSize="11" fontWeight="600">
                Houghton Street
              </text>
              <text x="130" y="436" fill="var(--ink-2)" fontSize="11" fontWeight="600">
                Aldwych
              </text>
            </svg>

            {/* Schematic building tiles */}
            {buildings.map((b) => {
              const posMap: Record<string, { left: string; top: string }> = {
                LIB: { left: '68%', top: '45%' },
                OLD: { left: '25%', top: '50%' },
                CEN: { left: '30%', top: '76%' },
                SSH: { left: '76%', top: '72%' },
                MAR: { left: '66%', top: '15%' },
                NAB: { left: '22%', top: '15%' },
              };
              const pos = posMap[b.buildingKey] || { left: '50%', top: '50%' };
              const isTryHere = recommendedBuildingKey === b.buildingKey;
              const borderClass = b.isDashed ? 'border-dashed' : 'border-solid';

              return (
                <button
                  key={b.buildingKey}
                  type="button"
                  onClick={() => setSelectedBuildingKey(b.buildingKey)}
                  style={{
                    left: pos.left,
                    top: pos.top,
                    backgroundColor: b.isClosed || b.offReason ? 'var(--surface-2)' : b.bgColor,
                    color: b.isClosed || b.offReason ? 'var(--ink-2)' : b.textColor,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 w-[100px] min-h-[60px] p-1.5 rounded-xl border-3 ${borderClass} border-black/35 shadow-md flex flex-col justify-center items-center text-center cursor-pointer transition-transform active:scale-95`}
                >
                  {isTryHere && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--brand)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                      Try here
                    </span>
                  )}
                  <strong className="block text-xs font-extrabold font-heading leading-tight">
                    {b.shortName}
                  </strong>
                  <span className="text-[11px] font-bold leading-tight">{b.bucketWord}</span>
                  <span className="text-[10px] font-medium leading-tight opacity-90">
                    {b.offReason || b.statusLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* GRADIENT LEGEND BAR */}
      <div
        className="h-3.5 rounded-full mt-4"
        style={{ background: 'linear-gradient(90deg, #2EAA70, #F5B83A, #CD302C)' }}
        role="img"
        aria-label="Colour scale from plenty of seats to full"
      />

      <div className="flex justify-between text-xs font-semibold text-[var(--ink)] mt-1.5 px-0.5">
        <span>Plenty of seats</span>
        <span>Full</span>
      </div>

      <p className="text-xs text-[var(--ink-2)] mt-2 leading-relaxed">
        Dashed outline: no recent reports, showing the usual level.
      </p>

      {/* BOTTOM SHEET FOR SELECTED BUILDING */}
      {selectedBuildingKey && selectedBuildingMeta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[48vh] overflow-y-auto bg-[var(--surface)] border-t border-[var(--line)] rounded-t-3xl p-4 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-200"
        >
          {/* Grab handle */}
          <div className="w-10 h-1 rounded-full bg-[var(--line)] mx-auto mb-3" />

          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
            <h2 id="sheet-title" className="text-lg sm:text-xl font-extrabold font-heading text-[var(--ink)]">
              {selectedBuildingMeta.name}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedBuildingKey(null)}
              className="text-sm font-bold text-[var(--brand-text)] hover:opacity-80 p-2 cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="mt-3">
            {selectedBuildingZones.length > 0 ? (
              <ul className="divide-y divide-[var(--line)]">
                {selectedBuildingZones.map((z) => (
                  <SpaceRow
                    key={z.id}
                    zone={z}
                    isOpen={openRowId === z.id}
                    onToggle={() => onToggleRow(z.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--ink-2)]">
                No quiet spaces in this building.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
