'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area } from 'react-easy-crop';

/** Shapes the crop frame can take. "Fits the app" fills the top of the car's page in the customer app exactly. */
const SHAPES = [
  { key: 'app', label: 'Fits the app', aspect: 2 },
  { key: '4:3', label: '4 : 3', aspect: 4 / 3 },
  { key: '1:1', label: 'Square', aspect: 1 },
  { key: 'original', label: 'Original', aspect: 0 },
] as const;
type ShapeKey = (typeof SHAPES)[number]['key'];

const MAX_SIDE = 2000;
const QUALITY = 0.88;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This photo could not be opened. Choose a JPG or PNG photo.'));
    img.src = src;
  });
}

/** Rotates the whole image, cuts out the chosen area, scales it down to at most 2000 px and saves it as a JPG. */
async function render(src: string, rotation: number, area: Area, name: string): Promise<File> {
  const img = await loadImage(src);
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const boxW = Math.round(img.naturalWidth * cos + img.naturalHeight * sin);
  const boxH = Math.round(img.naturalWidth * sin + img.naturalHeight * cos);

  const turned = document.createElement('canvas');
  turned.width = boxW;
  turned.height = boxH;
  const t = turned.getContext('2d');
  if (!t) throw new Error('Your browser could not edit this photo.');
  t.translate(boxW / 2, boxH / 2);
  t.rotate(rad);
  t.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  const scale = Math.min(1, MAX_SIDE / Math.max(area.width, area.height));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(area.width * scale));
  out.height = Math.max(1, Math.round(area.height * scale));
  const o = out.getContext('2d');
  if (!o) throw new Error('Your browser could not edit this photo.');
  o.fillStyle = '#FFFFFF';
  o.fillRect(0, 0, out.width, out.height);
  o.imageSmoothingQuality = 'high';
  o.drawImage(turned, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height);

  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Your browser could not save this photo.');
  return new File([blob], `${name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' });
}

/**
 * Full-screen crop and rotate step shown after a photo is chosen or taken (on the computer and on the phone).
 * Resolves with the edited JPG through onDone; nothing is uploaded on Cancel.
 */
export function PhotoEditor({ file, title, onCancel, onDone }: { file: File; title: string; onCancel: () => void; onDone: (edited: File) => void | Promise<void> }) {
  const [src, setSrc] = useState('');
  const [natural, setNatural] = useState({ w: 4, h: 3 });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [shape, setShape] = useState<ShapeKey>('app');
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    loadImage(url).then(
      (img) => setNatural({ w: img.naturalWidth, h: img.naturalHeight }),
      (e: Error) => setError(e.message)
    );
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // "Original" keeps the photo's own shape (turned on its side when rotated a quarter turn)
  const sideways = Math.round(rotation / 90) % 2 !== 0;
  const original = sideways ? natural.h / natural.w : natural.w / natural.h;
  const aspect = SHAPES.find((s) => s.key === shape)?.aspect || original;

  const turn = (by: number) => {
    setRotation((r) => {
      const next = (((Math.round(r / 90) * 90 + by) % 360) + 360) % 360;
      return next > 180 ? next - 360 : next;
    });
  };

  const save = async () => {
    if (!area) return;
    setBusy(true);
    setError('');
    try {
      await onDone(await render(src, rotation, area, file.name));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const btn = (primary = false): React.CSSProperties => ({
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.35)',
    background: primary ? '#FFBA00' : 'transparent',
    color: primary ? '#1B1B1B' : '#FFFFFF',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 44,
  });
  const chip = (on: boolean): React.CSSProperties => ({
    border: '1px solid ' + (on ? '#FFBA00' : 'rgba(255,255,255,0.3)'),
    background: on ? 'rgba(255,186,0,0.18)' : 'transparent',
    color: '#FFFFFF',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Edit ${title}`} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#111', display: 'flex', flexDirection: 'column', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', color: '#fff', gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={busy} style={btn()}>
          Cancel
        </button>
        <div style={{ fontWeight: 700, fontSize: 16, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        <button type="button" onClick={save} disabled={busy || !area || !!error} style={{ ...btn(true), opacity: busy || !area ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 240 }}>
        {src && !error ? (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            minZoom={1}
            maxZoom={4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={(_, px) => setArea(px)}
            objectFit="contain"
          />
        ) : null}
        {error ? <div style={{ color: '#FFB4A8', padding: 24, textAlign: 'center' }}>{error}</div> : null}
      </div>

      <div style={{ padding: '12px 16px 20px', color: '#fff', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} role="radiogroup" aria-label="Crop shape">
          {SHAPES.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={shape === s.key} onClick={() => setShape(s.key)} style={chip(shape === s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ width: 64 }}>Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} aria-label="Zoom" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ width: 64 }}>Straighten</span>
          <input type="range" min={-180} max={180} step={0.5} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} style={{ flex: 1 }} aria-label="Rotation angle" />
          <span style={{ width: 44, textAlign: 'right' }}>{Math.round(rotation)}°</span>
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => turn(-90)} style={btn()} aria-label="Rotate left">
            ⟲ Rotate left
          </button>
          <button type="button" onClick={() => turn(90)} style={btn()} aria-label="Rotate right">
            Rotate right ⟳
          </button>
          <button
            type="button"
            onClick={() => {
              setRotation(0);
              setZoom(1);
              setCrop({ x: 0, y: 0 });
            }}
            style={btn()}>
            Reset
          </button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>Drag the photo to move it inside the frame. Pinch or use Zoom to get closer.</div>
      </div>
    </div>,
    document.body
  );
}
