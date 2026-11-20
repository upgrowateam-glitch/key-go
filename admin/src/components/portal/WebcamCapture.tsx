'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Takes a photo with the computer's camera (or a phone's, in a browser): live preview, then Capture. Used for the
 * customer photo at the counter and for scanning ID cards and licences. The picture goes on to the crop step.
 */
export function WebcamCapture({
  title,
  facing = 'user',
  guide,
  onCancel,
  onCapture,
}: {
  title: string;
  facing?: 'user' | 'environment';
  /** "card" shows an ID-card shaped frame to line the card up with; "face" an oval. */
  guide?: 'card' | 'face';
  onCancel: () => void;
  onCapture: (file: File) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the camera here. Choose a photo instead, or use "Phone (QR)".');
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => undefined);
        }
      })
      .catch((e: Error) =>
        setError(e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site in the browser, or use "Phone (QR)".' : 'No camera found on this computer. Choose a photo instead, or use "Phone (QR)".')
      );
    return () => {
      stopped = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext('2d');
    if (!g) return;
    // The preview is mirrored for selfies; the saved picture is not
    g.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        stream.current?.getTracks().forEach((t) => t.stop());
        onCapture(new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  };

  const btn = (primary = false): React.CSSProperties => ({
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.35)',
    background: primary ? '#FFBA00' : 'transparent',
    color: primary ? '#1B1B1B' : '#FFFFFF',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 44,
  });

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#111', display: 'flex', flexDirection: 'column', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: 8 }}>
        <button type="button" onClick={onCancel} style={btn()}>
          Cancel
        </button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>
        <button type="button" onClick={capture} disabled={!ready || !!error} style={{ ...btn(true), opacity: ready && !error ? 1 : 0.5 }} aria-label="Capture">
          Capture
        </button>
      </div>
      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {error ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#FFB4A8', maxWidth: 420 }}>{error}</div>
        ) : (
          <>
            <video
              ref={video}
              playsInline
              muted
              onLoadedMetadata={() => setReady(true)}
              style={{ maxWidth: '100%', maxHeight: '100%', transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
            />
            {guide ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  border: '3px dashed rgba(255,186,0,0.9)',
                  borderRadius: guide === 'face' ? '50%' : 14,
                  width: guide === 'face' ? 'min(46vh, 60vw)' : 'min(80vw, 88vh)',
                  aspectRatio: guide === 'face' ? '3 / 4' : '1.586',
                  maxHeight: '80%',
                  pointerEvents: 'none',
                }}
              />
            ) : null}
          </>
        )}
      </div>
      <div style={{ padding: '10px 16px 18px', textAlign: 'center', fontSize: 13, opacity: 0.8 }}>
        {guide === 'card' ? 'Hold the card flat inside the frame, in good light, without glare.' : guide === 'face' ? 'Face the camera, no cap or sunglasses, in good light.' : 'Line up and press Capture.'}
      </div>
    </div>,
    document.body
  );
}
