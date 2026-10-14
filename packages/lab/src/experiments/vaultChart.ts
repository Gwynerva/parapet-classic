/**
 * The chart of the vault sweep: for every step of the second UP, how long it waits in the
 * buffer and what it gives, over the runner's states during the jump.
 */
import { INK, SERIES } from '../palette.ts';
import { Svg } from '../svg.ts';
import { VAULT_JUMP, type VaultOutcome, type VaultSweepTry } from './vault.ts';

const LOOK: Record<VaultOutcome, { color: string; label: string }> = {
  vault: { color: SERIES[0], label: 'waits, then the vault starts on the landing' },
  lost: { color: INK.muted, label: 'pressed on the landing step: lost' },
  jump: { color: SERIES[1], label: 'pressed after the landing: a new jump' },
};

const STATE_NAMES: Record<number, string> = { 18: 'rising', 12: 'falling' };

export function vaultChart(tries: readonly VaultSweepTry[]): string {
  const cell = 16;
  const rowH = 13;
  const x0 = 64;
  const span = (tries.at(-1)?.press ?? VAULT_JUMP) - VAULT_JUMP + 2;
  const stripY = 80;
  const top = stripY + 34;
  const legend = (Object.keys(LOOK) as VaultOutcome[]).filter((o) =>
    tries.some((t) => t.outcome === o),
  );
  const width = x0 + span * cell + 24;
  const height = top + tries.length * rowH + 56 + legend.length * 20 + 12;
  const svg = new Svg(
    width,
    height,
    'How long a press waits',
    'The runner jumps at a low block (UP); a second UP on each of the steps after',
  );
  const xOf = (step: number): number => x0 + (step - VAULT_JUMP) * cell;
  const landing = tries.find((t) => t.outcome === 'vault')?.landing ?? -1;

  // The runner's states from the jump to the landing: the same whatever the second UP.
  const track = tries[0]!.rec.tracks[0]!;
  let from = VAULT_JUMP;
  for (let s = VAULT_JUMP; s <= landing; s++) {
    const id = track.after(s).moveId;
    if (s < landing && track.after(s + 1).moveId === id) continue;
    if (s < landing) {
      const w = (s - from + 1) * cell - 2;
      svg.rect(xOf(from), stripY, w, 14, INK.line, {
        rx: 3,
        tip: `${STATE_NAMES[id] ?? 'state'} (${id}): steps ${from - VAULT_JUMP} to ${s - VAULT_JUMP}`,
      });
      // The name where it fits (the fall is short).
      const name = STATE_NAMES[id] ?? String(id);
      if (name.length * 6.5 < w) {
        svg.text(xOf(from) + w / 2, stripY + 11, name, {
          size: 11,
          fill: INK.text,
          anchor: 'middle',
        });
      }
    }
    from = s + 1;
  }
  if (landing >= 0) {
    const x = xOf(landing) + (cell - 2) / 2;
    svg.line(x, stripY - 4, x, top + tries.length * rowH, INK.muted, { dash: '3 3' });
    svg.text(x + 4, stripY - 8, 'lands on the block', { size: 11, fill: INK.muted });
  }
  svg.text(x0 - 10, stripY + 11, 'in the air', { size: 11, fill: INK.muted, anchor: 'end' });
  svg.text(x0 - 10, top - 6, 'UP at', { size: 11, fill: INK.muted, anchor: 'end' });

  tries.forEach((t, r) => {
    const y = top + r * rowH;
    const after = t.press - VAULT_JUMP;
    const look = LOOK[t.outcome];
    svg.text(x0 - 10, y + 9, `+${after}`, { size: 11, fill: INK.muted, anchor: 'end', mono: true });
    const end = t.outcome === 'vault' ? t.vault : t.press;
    const tip =
      t.outcome === 'vault'
        ? `UP ${after} steps after the jump waits ${t.vault - t.press} steps; the vault on step ${t.vault - VAULT_JUMP}`
        : `UP ${after} steps after the jump: ${look.label}`;
    if (end > t.press) svg.rect(xOf(t.press), y + 4, (end - t.press) * cell, 3, look.color);
    svg.rect(xOf(end), y + 1, cell - 2, rowH - 4, look.color, { rx: 2, tip });
    // The press: a small arrow up.
    const px = xOf(t.press) + (cell - 2) / 2;
    svg.path(`M${px - 4} ${y + 8}L${px} ${y + 2}L${px + 4} ${y + 8}Z`, { fill: INK.text });
  });

  const axisY = top + tries.length * rowH + 6;
  for (let after = 0; after < span; after += 5) {
    const x = xOf(VAULT_JUMP + after) + (cell - 2) / 2;
    svg.line(x, axisY - 2, x, axisY + 3, INK.muted);
    svg.text(x, axisY + 16, String(after), { size: 11, fill: INK.muted, anchor: 'middle' });
  }
  svg.text(xOf(VAULT_JUMP + span / 2), axisY + 32, 'steps after the jump (30 ms each)', {
    size: 11,
    fill: INK.muted,
    anchor: 'middle',
  });
  legend.forEach((o, i) => svg.key(20, axisY + 60 + i * 20, LOOK[o].color, LOOK[o].label));
  return svg.toString();
}
