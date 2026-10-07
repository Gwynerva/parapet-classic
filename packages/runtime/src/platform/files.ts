/**
 * Files in and out of the page without a server: saving a text file, picking one with the
 * system dialog, files dropped onto the window and text pasted with Ctrl+V. Saving and the
 * dialog need user activation (call them from a gesture); drops and pastes are gestures
 * themselves.
 */

/** Largest file `readText` accepts (replay files are a few kilobytes). */
export const MAX_TEXT_FILE_BYTES = 1 << 20;

/** Offers `text` as a download named `filename`. */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers start the download asynchronously; keep the URL alive for a moment.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Opens the system file dialog; `onPick` gets the chosen file. Nothing happens when the
 * dialog is cancelled.
 */
export function pickFile(accept: string, onPick: (file: File) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      input.remove();
      if (file) onPick(file);
    },
    { once: true },
  );
  input.addEventListener('cancel', () => input.remove(), { once: true });
  document.body.appendChild(input);
  input.click();
}

/** Reads a small text file; null when it is too large or unreadable. */
export async function readText(file: File): Promise<string | null> {
  if (file.size > MAX_TEXT_FILE_BYTES) return null;
  try {
    return await file.text();
  } catch {
    return null;
  }
}

/** Calls `onDrop` with every file dropped onto the window; returns the unsubscribe. */
export function onFileDrop(onDrop: (file: File) => void): () => void {
  const over = (event: DragEvent): void => {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  };
  const drop = (event: DragEvent): void => {
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    event.preventDefault();
    onDrop(file);
  };
  window.addEventListener('dragover', over);
  window.addEventListener('drop', drop);
  return () => {
    window.removeEventListener('dragover', over);
    window.removeEventListener('drop', drop);
  };
}

/**
 * Calls `onPaste` with text pasted anywhere outside an editable field (those keep their own
 * paste); returns the unsubscribe.
 */
export function onPasteText(onPaste: (text: string) => void): () => void {
  const paste = (event: ClipboardEvent): void => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      return;
    }
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    event.preventDefault();
    onPaste(text);
  };
  document.addEventListener('paste', paste);
  return () => document.removeEventListener('paste', paste);
}
