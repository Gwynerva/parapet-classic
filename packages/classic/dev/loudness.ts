/**
 * The loudness page (dev server only): measures every track on the synthesiser and saves the
 * table through the dev server (`vite.config.ts`, POST /dev/loudness).
 */
import { parseMidi, stripEndMarker, type MidiSong } from '@parapet/runtime/audio/MidiFile.ts';
import { scoreToSong, type Score } from '@parapet/runtime/audio/Score.ts';
import { CONTEST_TRACK } from '@parapet/runtime/audio/MusicDirector.ts';
import {
  integratedLoudness,
  renderSong,
  synthFingerprint,
  type LoudnessTable,
} from '@parapet/runtime/audio/LoudnessMeter.ts';
import themeJson from '@content/bosses/theme.json';

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
  out.set(CONTEST_TRACK, scoreToSong(themeJson as unknown as Score));
  return out;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function main(): Promise<void> {
  const status = document.getElementById('status')!;
  const table = document.getElementById('out') as HTMLTableElement;
  const save = document.getElementById('save') as HTMLButtonElement;
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
    const gain = Math.pow(10, (result.target - lufs) / 20);
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
  document.getElementById('status')!.textContent = `Failed: ${String(err)}`;
});
