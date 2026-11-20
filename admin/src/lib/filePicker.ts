/** Opens the browser's file dialog and resolves with the chosen file, or null when the dialog is dismissed. */
export function pickFile(accept: string, capture?: 'environment'): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // On phones this opens the camera straight away (the back camera)
    if (capture) input.setAttribute('capture', capture);
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
export const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Returns a user-facing reason the file cannot be stored, or null when it is acceptable. */
export function documentFileProblem(file: File): string | null {
  if (!DOCUMENT_TYPES.includes(file.type)) return 'Only PDF, JPG, PNG or WebP files are accepted';
  if (file.size > DOCUMENT_MAX_BYTES) return 'The file is larger than 10 MB';
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Any photo the browser can open; the crop step turns it into a JPG before upload. */
export const PHOTO_ACCEPT = 'image/*';
/** Photos straight off a phone can be large; the crop step shrinks them to at most 2000 px. */
export const PHOTO_MAX_INPUT_BYTES = 40 * 1024 * 1024;
