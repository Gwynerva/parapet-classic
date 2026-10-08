import { describe, expect, it } from 'vitest';
import { BitmapFont, type AtlasImage, type BitmapFontData } from '../src/text/BitmapFont.ts';
import { MessageBox } from '../src/ui/MessageBox.ts';

function font(): BitmapFont {
  const glyphs: BitmapFontData['glyphs'] = {};
  for (let c = 0x20; c < 0x7f; c++)
    glyphs[c] = { x: 0, y: 0, w: 5, h: 8, xOffset: 0, yOffset: 0, advance: 6 };
  const data: BitmapFontData = {
    name: 't',
    size: 8,
    lineHeight: 10,
    baseline: 8,
    glyphs,
    fallback: 0x3f,
  };
  return new BitmapFont(data, { width: 8, height: 8 } as unknown as AtlasImage);
}

function host() {
  const f = font();
  return {
    viewport: { width: 320, height: 240, safeArea: { top: 0, right: 0, bottom: 0, left: 0 } },
    fonts: { text: f, small: f, display: f },
  };
}

describe('MessageBox', () => {
  it('splits a page too long for the screen instead of cutting it', () => {
    const long = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
    let closed = 0;
    const box = new MessageBox(host(), {
      pages: [long],
      labels: { next: 'Next', ok: 'OK' },
      onClose: () => closed++,
    });
    // 240 px high: about 16 lines of 10 px fit per page.
    expect(box.pageCount).toBeGreaterThan(2);
    for (let i = 0; i < box.pageCount; i++) box.onKey({ action: 'confirm' });
    expect(closed).toBe(1);
  });

  it('turns pages on confirm and closes after the last one', () => {
    let closed = 0;
    const box = new MessageBox(host(), {
      pages: ['one', 'two', 'three'],
      labels: { next: 'Next', ok: 'OK' },
      onClose: () => closed++,
    });
    expect(box.pageCount).toBe(3);
    box.onKey({ action: 'confirm' });
    expect(box.page).toBe(1);
    box.onKey({ action: 'back' });
    expect(box.page).toBe(0);
    box.onKey({ action: 'confirm' });
    box.onKey({ action: 'confirm' });
    expect(box.lastPage).toBe(true);
    expect(closed).toBe(0);
    box.onPointer({ x: 10, y: 10, type: 'down' });
    expect(closed).toBe(1);
    box.onKey({ action: 'confirm' });
    expect(closed).toBe(1);
  });

  it('ignores input until the delay has passed and reports frames meanwhile', () => {
    let closed = 0;
    let frames = 0;
    const box = new MessageBox(host(), {
      pages: ['hint'],
      labels: { next: 'Next', ok: 'OK' },
      delayMs: 1000,
      onClose: () => closed++,
      onFrame: () => frames++,
    });
    expect(box.visible).toBe(false);
    box.onKey({ action: 'confirm' });
    expect(closed).toBe(0);
    box.update(600);
    box.update(500);
    expect(frames).toBe(2);
    expect(box.visible).toBe(true);
    box.onKey({ action: 'confirm' });
    expect(closed).toBe(1);
  });

  it('offers retry through the back key on the first page', () => {
    let retried = 0;
    const box = new MessageBox(host(), {
      pages: ['failed'],
      labels: { next: 'Next', ok: 'OK', retry: 'Retry' },
      onClose: () => undefined,
      onRetry: () => retried++,
    });
    box.onKey({ action: 'back' });
    expect(retried).toBe(1);
  });

  it('fits the panel inside the safe area and anchors it to the bottom', () => {
    const h = host();
    h.viewport.safeArea = { top: 0, right: 0, bottom: 20, left: 0 };
    const box = new MessageBox(h, {
      title: 'Done',
      pages: ['a short page'],
      labels: { next: 'Next', ok: 'OK' },
      onClose: () => undefined,
      maxWidth: 200,
    });
    const r = box.rect;
    expect(r.w).toBe(200);
    expect(r.x).toBe(60);
    expect(r.y + r.h).toBeLessThanOrEqual(240 - 20 - 12);
  });
});
