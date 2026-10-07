/**
 * Copying text to the clipboard. Browsers allow it only while handling a user gesture, so
 * call `copyText` synchronously from one (`Screen.onGesture`, gesture menu items); it starts
 * the copy right away and reports later whether it worked. When it did not (no permission,
 * an old browser, a gamepad press, which grants no activation), show the text for copying by
 * hand instead.
 */

/** Copies `text`; resolves to true when the clipboard has it. */
export function copyText(text: string): Promise<boolean> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboard && typeof clipboard.writeText === 'function') {
    let pending: Promise<void>;
    try {
      pending = clipboard.writeText(text);
    } catch {
      return Promise.resolve(copyWithSelection(text));
    }
    return pending.then(
      () => true,
      () => copyWithSelection(text),
    );
  }
  return Promise.resolve(copyWithSelection(text));
}

/** The pre-Clipboard-API way: select a hidden field and run the copy command. */
function copyWithSelection(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  const s = field.style;
  s.position = 'fixed';
  s.top = '0';
  s.left = '-10000px';
  s.opacity = '0';
  // iOS zooms into fields with a font under 16 px.
  s.fontSize = '16px';
  document.body.appendChild(field);
  const active = document.activeElement as HTMLElement | null;
  try {
    field.select();
    field.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    active?.focus?.();
  }
}
