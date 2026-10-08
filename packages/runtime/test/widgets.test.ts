import { describe, expect, it } from 'vitest';
import type { UiPointer } from '../src/app/Screen.ts';
import { Menu, type MenuItem } from '../src/ui/Menu.ts';
import { PressTracker } from '../src/ui/press.ts';
import {
  MANUAL_MS,
  RETURN_SPEED,
  SCROLL_HOLD_MS,
  SCROLL_SPEED,
  TextScroller,
} from '../src/ui/TextScroller.ts';
import { TileGrid } from '../src/ui/TileGrid.ts';
import { Button } from '../src/ui/Button.ts';
import { testFont } from './helpers/font.ts';

const mouse = (type: UiPointer['type'], x: number, y: number): UiPointer => ({
  type,
  x,
  y,
  pointerType: 'mouse',
});
const finger = (type: UiPointer['type'], x: number, y: number): UiPointer => ({
  type,
  x,
  y,
  pointerType: 'touch',
});

describe('PressTracker', () => {
  it('fires on release over the pressed target only', () => {
    const t = new PressTracker<number>();
    t.press(1, mouse('down', 0, 0));
    expect(t.pressed).toBe(1);
    expect(t.release(1)).toBe(1);
    t.press(1, mouse('down', 0, 0));
    expect(t.release(2)).toBeNull();
  });

  it('turns a long move into a drag that fires nothing', () => {
    const t = new PressTracker<number>();
    t.press(1, finger('down', 0, 0));
    expect(t.move(finger('move', 0, 3))).toBe(false);
    expect(t.move(finger('move', 0, 12))).toBe(true);
    expect(t.dragging).toBe(true);
    expect(t.release(1)).toBeNull();
  });
});

function menu(items: MenuItem[], rows = 3): Menu {
  const f = testFont();
  const m = new Menu(f, f);
  Object.assign(m.layout, { x: 0, y: 0, width: 200, rowHeight: 20 });
  m.maxVisible = rows;
  m.setItems(items);
  return m;
}

describe('Menu', () => {
  it('selects on release, not on press', () => {
    let selected = 0;
    const m = menu([{ label: 'a' }, { label: 'b', onSelect: () => selected++ }]);
    m.onPointer(mouse('down', 50, 25));
    expect(m.pressedRow).toBe(1);
    expect(selected).toBe(0);
    m.onPointer(mouse('up', 50, 25));
    expect(selected).toBe(1);
    expect(m.cursor).toBe(1);
  });

  it('does not select when the press slides off or is cancelled', () => {
    let selected = 0;
    const m = menu([{ label: 'a', onSelect: () => selected++ }, { label: 'b' }]);
    m.onPointer(mouse('down', 50, 5));
    m.onPointer(mouse('move', 50, 25));
    m.onPointer(mouse('up', 50, 25));
    m.onPointer(finger('down', 50, 5));
    m.onPointer(finger('cancel', 50, 5));
    expect(selected).toBe(0);
  });

  it('scrolls with a dragged finger instead of selecting', () => {
    let selected = 0;
    const items = Array.from({ length: 10 }, (_, i) => ({
      label: `row ${i}`,
      onSelect: () => selected++,
    }));
    const m = menu(items, 3);
    m.onPointer(finger('down', 50, 55));
    m.onPointer(finger('move', 50, 15));
    m.onPointer(finger('up', 50, 15));
    expect(selected).toBe(0);
    expect(m.firstVisible).toBe(2);
  });

  it('scrolls with the wheel and keeps the cursor on screen', () => {
    const m = menu(
      Array.from({ length: 10 }, (_, i) => ({ label: `row ${i}` })),
      3,
    );
    m.onWheel({ x: 10, y: 10, dy: 45 });
    expect(m.firstVisible).toBe(2);
    expect(m.cursor).toBe(2);
    m.onWheel({ x: 500, y: 10, dy: 45 });
    expect(m.firstVisible).toBe(2);
  });

  it('fits its rows to a height and keeps the cursor visible', () => {
    const m = menu(
      Array.from({ length: 10 }, (_, i) => ({ label: `row ${i}` })),
      10,
    );
    m.setCursor(9);
    m.fit(65);
    expect(m.maxVisible).toBe(3);
    expect(m.firstVisible).toBe(7);
  });

  it('steps and drags sliders', () => {
    const changes: [number, boolean][] = [];
    const item: MenuItem = {
      label: 'Music',
      slider: { value: 50, min: 0, max: 100, step: 5 },
      onChange: (v, final) => {
        changes.push([v, final]);
        item.slider!.value = v;
      },
    };
    const m = menu([item]);
    m.onKey({ action: 'right' });
    expect(changes.at(-1)).toEqual([55, true]);
    m.onKey({ action: 'left' });
    m.onKey({ action: 'left' });
    expect(item.slider!.value).toBe(45);
    // The bar sits left of the label on the right; a press on it jumps there and drags.
    const barRight = 200 - 8 - testFont().lineWidth('100') - 8;
    m.onPointer(mouse('down', barRight - 1, 10));
    expect(item.slider!.value).toBe(100);
    m.onPointer(mouse('move', -100, 10));
    m.onPointer(mouse('up', -100, 10));
    expect(changes.at(-1)).toEqual([0, true]);
  });

  it('moves with Tab and Shift+Tab', () => {
    const m = menu([{ label: 'a' }, { label: 'b' }]);
    m.onKey({ action: 'next' });
    expect(m.cursor).toBe(1);
    m.onKey({ action: 'prev' });
    expect(m.cursor).toBe(0);
  });

  it('reaches gesture rows with left/right inside the key handler', () => {
    const deltas: number[] = [];
    const m = menu([{ label: 'Full screen', gesture: true, onAdjust: (d) => deltas.push(d) }]);
    expect(m.onGesture({ kind: 'key', action: 'left' })).toBe(true);
    expect(m.onGesture({ kind: 'key', action: 'confirm' })).toBe(true);
    expect(deltas).toEqual([-1, 1]);
  });
});

describe('TileGrid', () => {
  it('centres its tiles and starts groups on new rows', () => {
    const g = new TileGrid(30, 4);
    g.setGroups([{ count: 10 }, { count: 6, even: true }]);
    g.layout({ x: 0, y: 0, w: 240, h: 200 });
    expect(g.cols).toBe(7);
    // 7 × 34 − 4 = 234 of 240: 3 px on each side.
    expect(g.cellRect(0)).toEqual({ x: 3, y: 0, w: 30, h: 30 });
    // The second group: an even six per row, on the row after the first group's last row.
    expect(g.cellRect(10)!.y).toBe(68);
    expect(g.rows).toBe(3);
  });

  it('selects on a tap and activates the selected tile on a second tap', () => {
    const g = new TileGrid(30, 4);
    g.setGroups([{ count: 4 }]);
    g.layout({ x: 0, y: 0, w: 136, h: 40 });
    const events: string[] = [];
    g.onSelect = (i) => events.push(`select ${i}`);
    g.onActivate = (i) => events.push(`activate ${i}`);
    g.onPointer(mouse('down', 40, 10));
    g.onPointer(mouse('up', 40, 10));
    g.onPointer(mouse('down', 40, 10));
    g.onPointer(mouse('up', 40, 10));
    expect(events).toEqual(['select 1', 'activate 1']);
  });

  it('moves between rows by the nearest column', () => {
    const g = new TileGrid(30, 4);
    g.setGroups([{ count: 5 }]);
    g.layout({ x: 0, y: 0, w: 102, h: 200 });
    g.select(2);
    g.onKey({ action: 'down' });
    expect(g.index).toBe(4);
    g.onKey({ action: 'down' });
    expect(g.index).toBe(1);
  });
});

describe('TextScroller', () => {
  const long = Array.from({ length: 12 }, (_, i) => `line ${i}`).join('\n');

  it('leaves text that fits alone', () => {
    const s = new TextScroller({ auto: true });
    s.setRect({ x: 0, y: 0, w: 100, h: 50 });
    s.setText([{ text: 'short', font: testFont(), color: '#fff' }]);
    s.update(10000);
    expect(s.overflows).toBe(false);
    expect(s.offset).toBe(0);
  });

  it('pauses, crawls down, pauses and returns', () => {
    const s = new TextScroller({ auto: true });
    s.setRect({ x: 0, y: 0, w: 100, h: 50 });
    s.setText([{ text: long, font: testFont(), color: '#fff' }]);
    expect(s.maxOffset).toBe(70);
    s.update(SCROLL_HOLD_MS - 1);
    expect(s.offset).toBe(0);
    s.update(1);
    s.update(1000);
    expect(s.offset).toBeCloseTo(1000 * SCROLL_SPEED);
    s.update(70 / SCROLL_SPEED);
    expect(s.offset).toBe(70);
    s.update(SCROLL_HOLD_MS);
    s.update(70 / RETURN_SPEED);
    expect(s.offset).toBe(0);
  });

  it('gives way to manual scrolling for a while', () => {
    const s = new TextScroller({ auto: true });
    s.setRect({ x: 0, y: 0, w: 100, h: 50 });
    s.setText([{ text: long, font: testFont(), color: '#fff' }]);
    s.onWheel({ x: 10, y: 10, dy: 30 });
    expect(s.offset).toBe(30);
    s.update(MANUAL_MS - 1);
    expect(s.offset).toBe(30);
    expect(s.onKey({ action: 'up' })).toBe(true);
    expect(s.offset).toBe(10);
    expect(s.onKey({ action: 'up' })).toBe(true);
    expect(s.onKey({ action: 'up' })).toBe(false);
  });

  it('scrolls with a dragged finger and reports the drag', () => {
    const s = new TextScroller({ auto: false });
    s.setRect({ x: 0, y: 0, w: 100, h: 50 });
    s.setText([{ text: long, font: testFont(), color: '#fff' }]);
    s.onPointer(finger('down', 10, 40));
    s.onPointer(finger('move', 10, 10));
    expect(s.offset).toBe(30);
    expect(s.onPointer(finger('up', 10, 10))).toBe(true);
  });

  it('never crawls when motion is reduced', () => {
    const s = new TextScroller({ auto: false });
    s.setRect({ x: 0, y: 0, w: 100, h: 50 });
    s.setText([{ text: long, font: testFont(), color: '#fff' }]);
    s.update(60000);
    expect(s.offset).toBe(0);
  });
});

describe('Button', () => {
  it('fires on release over it', () => {
    const b = new Button();
    b.rect = { x: 10, y: 10, w: 40, h: 20 };
    let fired = 0;
    b.onPointer(finger('down', 20, 20), () => fired++);
    expect(b.pressed).toBe(true);
    b.onPointer(finger('up', 20, 20), () => fired++);
    b.onPointer(finger('down', 20, 20), () => fired++);
    b.onPointer(finger('up', 200, 20), () => fired++);
    expect(fired).toBe(1);
  });

  it('fires gestures at once for a mouse and on release for a finger', () => {
    const b = new Button();
    b.rect = { x: 0, y: 0, w: 40, h: 20 };
    let fired = 0;
    const g = (type: 'down' | 'up', pointerType: string) =>
      b.onGesture({ kind: 'pointer', x: 5, y: 5, type, pointerType }, () => fired++);
    g('down', 'mouse');
    expect(fired).toBe(1);
    g('down', 'touch');
    expect(fired).toBe(1);
    g('up', 'touch');
    expect(fired).toBe(2);
  });
});
