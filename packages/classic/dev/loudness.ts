/**
 * The loudness page (dev server only): measures every track of the original on the
 * synthesiser, with the patches of its own a track has (`trackPatches`), and saves the table
 * through the dev server (`build/devEndpoints.ts`, POST /dev/loudness). A track's trim
 * (`trackTrim`) is left out: the table levels the tracks, the trim then keeps one below the
 * rest on purpose. Our scores are measured on `live.html`.
 */
import { parseMidi, stripEndMarker, type MidiSong } from '@parapet/runtime/audio/MidiFile.ts';
import { trackPatches } from '@parapet/runtime/audio/MusicDirector.ts';
import {
  integratedLoudness,
  renderSong,
  synthFingerprint,
  tableGain,
  type LoudnessTable,
} from '@parapet/runtime/audio/LoudnessMeter.ts';
import { $ } from './dom.ts';

const musicModules = import.meta.glob('@playman/music/*.mid', {
  eager: true,
  query: '?url',
  import: 'default',
});

async function tracks(): Promise<Map<number, MidiSong>> {
  const out = new Map<number, MidiSong>();
  for (const [path, url] of Object.entries(musicModules)) {
    const id = Number(/(\d+)\.mid$/.exec(path)?.[1]);
    if (!Number.isInteger(id) || typeof url !== 'string') continue;
    const bytes = await (await fetch(url)).arrayBuffer();
    out.set(id, stripEndMarker(parseMidi(bytes)));
  }
  for (const [id, song] of out) song.patches = trackPatches(id);
  return out;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function main(): Promise<void> {
  const status = $<HTMLParagraphElement>('status');
  const table = $<HTMLTableElement>('out');
  const save = $<HTMLButtonElement>('save');
  table.innerHTML = '<tr><th>track</th><th>LUFS</th><th>gain</th></tr>';
  const measured: Record<string, number> = {};
  for (const [id, song] of [...(await tracks())].sort((a, b) => a[0] - b[0])) {
    status.textContent = `Measuring track ${id}…`;
    const lufs = integratedLoudness(await renderSong(song));
    measured[String(id)] = Math.round(lufs * 100) / 100;
  }
  // The game tracks (2-13) set the level the others are brought to.
  const game = Object.entries(measured)
    .filter(([id]) => Number(id) >= 2 && Number(id) <= 13)
    .map(([, v]) => v);
  const result: LoudnessTable = {
    synth: synthFingerprint(),
    target: Math.round(median(game) * 100) / 100,
    tracks: measured,
  };
  for (const [id, lufs] of Object.entries(measured)) {
    const gain = tableGain(result, id) ?? 1;
    table.insertAdjacentHTML(
      'beforeend',
      `<tr><td>${id}</td><td>${lufs.toFixed(2)}</td><td>${gain.toFixed(2)}</td></tr>`,
    );
  }
  status.textContent = `Done. Target ${result.target} LUFS (median of the game tracks).`;
  (window as unknown as { loudness: LoudnessTable }).loudness = result;
  save.disabled = false;
  save.onclick = async () => {
    const res = await fetch('/dev/loudness', { method: 'POST', body: JSON.stringify(result) });
    status.textContent = res.ok ? 'Saved.' : `Save failed: HTTP ${res.status}`;
  };
}

main().catch((err: unknown) => {
  $('status').textContent = `Failed: ${String(err)}`;
});
