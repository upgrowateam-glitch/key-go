'use client';

import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { useThemeColors } from '../../theme';

export interface LiveMarker {
  id: string;
  lat: number;
  lng: number;
  /** First line of the popup, e.g. "KL 13 AB 1234". */
  title: string;
  /** Second line, e.g. "42 km/h · 2 min ago". */
  detail?: string;
  tone?: 'primary' | 'danger' | 'muted';
  onPress?: () => void;
}

/** Kerala, used when there is nothing to show yet. */
const DEFAULT_CENTER: [number, number] = [11.87, 75.37];

/**
 * A real street map (OpenStreetMap) with one dot per car. Leaflet needs the browser, so it is loaded only after
 * the page is on screen. The map fits all cars, and keeps the user's zoom while positions refresh.
 */
export function LiveMap({ markers, height = 360 }: { markers: LiveMarker[]; height?: number }) {
  const colors = useThemeColors();
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !box.current) return;
      if (!map.current) {
        map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      layer.current!.clearLayers();
      const tone = (t: LiveMarker['tone']) => (t === 'danger' ? colors.danger : t === 'muted' ? colors.muted : colors.primary);
      markers.forEach((m) => {
        const dot = L.circleMarker([m.lat, m.lng], { radius: 9, color: '#FFFFFF', weight: 2, fillColor: tone(m.tone), fillOpacity: 1 });
        const popup = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = m.title;
        popup.appendChild(strong);
        if (m.detail) {
          popup.appendChild(document.createElement('br'));
          popup.appendChild(document.createTextNode(m.detail));
        }
        dot.bindPopup(popup);
        dot.bindTooltip(m.title, { direction: 'top', offset: [0, -8] });
        if (m.onPress) dot.on('dblclick', m.onPress);
        dot.addTo(layer.current!);
      });
      // Fit the cars once; later refreshes keep the user's zoom and position
      if (!fitted.current && markers.length) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.current.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
        fitted.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [markers, colors]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    []
  );

  return <div ref={box} style={{ height, width: '100%', borderRadius: 14, overflow: 'hidden', border: `1px solid ${colors.line}`, zIndex: 0 }} role="region" aria-label="Map of car locations" />;
}
