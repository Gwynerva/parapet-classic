/**
 * What's in the jar: the original's 265 KB, file by file. The sprites ship as raw palette indices
 * and become PNGs only in memory, built the original's way (rebuilt here and decoded back to
 * the same pixels); the music is fourteen MIDI files in one resource, whose stored durations are
 * mostly not their lengths; and a tenth of the jar is not the game at all. Read in Node from the
 * jar itself, so this finding lives with the tools.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Facts, Finding } from '@parapet/lab/finding.ts';
import { INK, SERIES } from '@parapet/lab/palette.ts';
import { Svg } from '@parapet/lab/svg.ts';
import { decodePalettes, type Palette } from '../decodePalettes.ts';
import { decodeSprites, spriteToRgba, type SpriteRecord } from '../decodeSprites.ts';
import { EXTRACTED_DIR, ORIGINAL_JAR, readJson } from '../files.ts';
import { decodePng } from '../png.ts';
import { ZipArchive } from '../zip.ts';
import { readMidi, type MidiSummary } from './midi.ts';
import { originalPng } from './originalPng.ts';

/** The jar's files by what they are. */
const GROUPS: { name: string; test: RegExp; color: string }[] = [
  { name: 'code (classes)', test: /\.class$/, color: SERIES[0] },
  { name: 'sprites (g0–g8)', test: /^g\d$/, color: SERIES[1] },
  { name: 'vector scenes (k0–k13)', test: /^k\d+$/, color: SERIES[2] },
  { name: 'music (s)', test: /^s$/, color: SERIES[4] },
  { name: 'text (l)', test: /^l$/, color: SERIES[5] },
  { name: 'palettes, index, icon', test: /^(p|i|i\.png)$/, color: INK.muted },
  { name: 'not the game (a distributor’s GIF)', test: /\.gif$/, color: SERIES[6] },
];

interface Jar {
  bytes: number;
  entries: { name: string; size: number; compressed: number }[];
  sprites: SpriteRecord[];
  palettes: Palette[];
  tracks: { id: number; stored: number; midi: MidiSummary }[];
}

let cached: Jar | null = null;

function jar(): Jar {
  if (cached) return cached;
  const zip = ZipArchive.fromFile(ORIGINAL_JAR);
  const music = readJson<{ tracks: { id: number; file: string; duration: number }[] }>(
    join(EXTRACTED_DIR, 'music.json'),
  );
  cached = {
    bytes: statSync(ORIGINAL_JAR).size,
    entries: [...zip.entries.values()].map((e) => ({
      name: e.name,
      size: e.size,
      compressed: e.compressedSize,
    })),
    sprites: decodeSprites(Array.from({ length: 9 }, (_, g) => zip.read(`g${g}`))),
    palettes: decodePalettes(zip.read('p')),
    tracks: music.tracks.map((t) => ({
      id: t.id,
      stored: t.duration,
      midi: readMidi(new Uint8Array(readFileSync(join(EXTRACTED_DIR, t.file)))),
    })),
  };
  return cached;
}

interface JarFacts extends Facts {
  jarBytes: number;
  files: number;
  /** Bytes of each group inside the jar (compressed), in `GROUPS` order. */
  groups: readonly number[];
  sprites: number;
  rgbaSprites: number;
  /** PNGs built the original's way that decode to the sprite's pixels. */
  pngsEqual: number;
  pngBytes: number;
  rawBytes: number;
  mostIdats: number;
  /** Stored durations and lengths (ms) of the prize track, the menu track, an in-game track. */
  prize: readonly number[];
  menu: readonly number[];
  inGame: readonly number[];
  /** In-game tracks stored as 43157 ms. */
  sameStored: number;
  menuVolume: number;
}

function anatomyChart(sprite: SpriteRecord, palettes: readonly Palette[]): string {
  const png = originalPng(sprite, palettes);
  const total = png.bytes.length;
  const x0 = 20;
  const plotW = 680;
  const top = 80;
  const barH = 30;
  const width = x0 * 2 + plotW;
  const height = top + barH + 150;
  const svg = new Svg(
    width,
    height,
    `The PNG the game builds for sprite ${sprite.id}`,
    `${sprite.w} × ${sprite.h} pixels, ${total} bytes: every chunk in order; the pixel data is stored, not compressed`,
  );
  const color = (type: string, i: number): string =>
    type === 'IDAT'
      ? i % 2 === 0
        ? SERIES[0]
        : '#2f6fbd'
      : type === 'IEND'
        ? INK.muted
        : SERIES[3];
  let x = x0;
  const labels: { x: number; text: string }[] = [];
  png.chunks.forEach((c, i) => {
    const w = (c.bytes / total) * plotW;
    svg.rect(x, top, Math.max(1.5, w - 1), barH, color(c.type, i), {
      tip: `${c.type}: ${c.bytes} bytes`,
    });
    labels.push({ x, text: `${c.type} ${c.bytes}` });
    x += w;
  });
  // The small chunks' labels in steps under the bar.
  labels.forEach((l, i) => {
    const y = top + barH + 18 + (i % 6) * 16;
    svg.line(l.x + 1, top + barH, l.x + 1, y - 10, INK.line);
    svg.text(l.x + 3, y, l.text, { size: 11, fill: INK.text, mono: true });
  });
  return svg.toString();
}

function jarChart(f: JarFacts, entries: Jar['entries']): string {
  const x0 = 250;
  const plotW = 400;
  const top = 72;
  const rowH = 26;
  const width = x0 + plotW + 90;
  const height = top + GROUPS.length * rowH + 50;
  const svg = new Svg(
    width,
    height,
    `The original jar: ${Math.round(f.jarBytes / 1024)} KB`,
    'What each kind of file takes in the jar (compressed); faint: its size unpacked',
  );
  const unpacked = GROUPS.map((g) =>
    entries.filter((e) => g.test.test(e.name)).reduce((n, e) => n + e.size, 0),
  );
  const max = Math.max(...unpacked);
  GROUPS.forEach((g, i) => {
    const y = top + i * rowH;
    const packed = f.groups[i]!;
    svg.text(x0 - 8, y + 16, g.name, { size: 12, fill: INK.text, anchor: 'end' });
    svg.rect(x0, y + 4, (unpacked[i]! / max) * plotW, rowH - 8, g.color, { rx: 2, opacity: 0.3 });
    svg.rect(x0, y + 4, Math.max(2, (packed / max) * plotW), rowH - 8, g.color, {
      rx: 2,
      tip: `${g.name}: ${packed} bytes in the jar, ${unpacked[i]} unpacked`,
    });
    svg.text(x0 + (unpacked[i]! / max) * plotW + 6, y + 16, `${(packed / 1024).toFixed(1)} KB`, {
      size: 11,
      fill: INK.muted,
    });
  });
  svg.text(x0, height - 18, 'KB in the jar; the faint bar runs to the unpacked size', {
    size: 11,
    fill: INK.muted,
  });
  return svg.toString();
}

function musicChart(tracks: Jar['tracks']): string {
  const x0 = 110;
  const plotW = 520;
  const top = 72;
  const rowH = 20;
  const max = Math.max(...tracks.map((t) => Math.max(t.stored, t.midi.ms)));
  const width = x0 + plotW + 40;
  const height = top + tracks.length * rowH + 60;
  const svg = new Svg(
    width,
    height,
    'The music: what the index says and what plays',
    'Each MIDI file’s length (bar) against the duration the game’s index stores for it (dot)',
  );
  const xOf = (ms: number): number => x0 + (ms / max) * plotW;
  tracks.forEach((t, i) => {
    const y = top + i * rowH;
    const name = t.id === 0 ? 'prize' : t.id === 1 ? 'menu' : `run ${t.id - 1}`;
    svg.text(x0 - 8, y + 13, `${t.id} ${name}`, { size: 11, fill: INK.text, anchor: 'end' });
    svg.rect(x0, y + 4, xOf(t.midi.ms) - x0, rowH - 8, SERIES[0], {
      rx: 2,
      tip: `track ${t.id}: plays ${(t.midi.ms / 1000).toFixed(1)} s, stored ${t.stored} ms`,
    });
    svg.circle(xOf(t.stored), y + rowH / 2, 4, SERIES[1]);
  });
  for (let s = 0; s * 1000 <= max; s += 20) {
    svg.text(xOf(s * 1000), top + tracks.length * rowH + 14, `${s} s`, {
      size: 11,
      fill: INK.muted,
      anchor: 'middle',
    });
  }
  const ly = height - 18;
  svg.rect(20, ly - 9, 14, 10, SERIES[0], { rx: 2 });
  svg.text(40, ly, 'how long it plays', { size: 12, fill: INK.text });
  svg.circle(180, ly - 4, 4, SERIES[1]);
  svg.text(190, ly, 'the duration stored in the index', { size: 12, fill: INK.text });
  return svg.toString();
}

export const whatsInTheJar: Finding<JarFacts> = {
  slug: '14-whats-in-the-jar',
  title: 'What’s in the jar',
  claim:
    'The sprites ship as raw pixels and become PNGs in memory, built byte by byte; the stored music lengths are mostly wrong; a tenth of the jar is not the game.',

  facts(): JarFacts {
    const j = jar();
    let equal = 0;
    let pngBytes = 0;
    let mostIdats = 0;
    for (const s of j.sprites) {
      const png = originalPng(s, j.palettes);
      const back = decodePng(png.bytes).rgba;
      const want = spriteToRgba(s, j.palettes);
      if (back.length === want.length && back.every((v, i) => v === want[i])) equal++;
      pngBytes += png.bytes.length;
      mostIdats = Math.max(mostIdats, png.chunks.filter((c) => c.type === 'IDAT').length);
    }
    const t = (id: number): number[] => {
      const x = j.tracks.find((k) => k.id === id)!;
      return [x.stored, x.midi.ms];
    };
    const inGame = j.tracks.filter((x) => x.id >= 2);
    return {
      jarBytes: j.bytes,
      files: j.entries.length,
      groups: GROUPS.map((g) =>
        j.entries.filter((e) => g.test.test(e.name)).reduce((n, e) => n + e.compressed, 0),
      ),
      sprites: j.sprites.length,
      rgbaSprites: j.sprites.filter((s) => s.paletteIndex === null).length,
      pngsEqual: equal,
      pngBytes,
      rawBytes: j.sprites.reduce((n, s) => n + s.pixels.length, 0),
      mostIdats,
      prize: t(0),
      menu: t(1),
      inGame: [
        Math.min(...inGame.map((x) => x.midi.ms)),
        Math.max(...inGame.map((x) => x.midi.ms)),
      ],
      sameStored: inGame.filter((x) => x.stored === inGame[0]!.stored).length,
      menuVolume: j.tracks.find((x) => x.id === 1)!.midi.volume,
    };
  },

  measured(f: JarFacts): [string, string][] {
    const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;
    const notGame = f.groups.at(-1)!;
    return [
      ['The jar, and its files', `${kb(f.jarBytes)}, ${f.files}`],
      ['Of it the code', kb(f.groups[0]!)],
      [
        'A distributor’s GIF the game never reads',
        `${kb(notGame)} (${Math.round((notGame / f.jarBytes) * 100)} %)`,
      ],
      ['Sprites, of them 32-bit', `${f.sprites}, ${f.rgbaSprites}`],
      [
        'PNGs built the original’s way that decode to the same pixels',
        `${f.pngsEqual} of ${f.sprites}`,
      ],
      ['Their bytes, against the raw pixels', `${kb(f.pngBytes)}, ${kb(f.rawBytes)}`],
      ['Most IDAT chunks in one of them', String(f.mostIdats)],
      ['Prize track: stored, plays', `${f.prize[0]} ms, ${(f.prize[1]! / 1000).toFixed(1)} s`],
      ['Menu track: stored, plays', `${f.menu[0]} ms, ${(f.menu[1]! / 1000).toFixed(1)} s`],
      [
        'The twelve run tracks: stored, play',
        `${f.sameStored} × 43157 ms; ${(f.inGame[0]! / 1000).toFixed(1)} to ${(f.inGame[1]! / 1000).toFixed(1)} s`,
      ],
      ['Volume changes in the menu track', String(f.menuVolume)],
    ];
  },

  checks(f: JarFacts): string[] {
    const out: string[] = [];
    if (f.pngsEqual !== f.sprites) out.push(`${f.sprites - f.pngsEqual} rebuilt PNGs differ`);
    if (f.sameStored !== 12) out.push(`${f.sameStored} run tracks share their stored duration`);
    if (f.prize[0] !== 0) out.push('the prize track has a duration');
    return out;
  },

  clips() {
    return [];
  },

  charts(_lab, f) {
    const j = jar();
    // The sprite whose PNG has the most chunks, as an example.
    const shown = j.sprites.reduce((a, b) =>
      originalPng(b, j.palettes).chunks.length > originalPng(a, j.palettes).chunks.length ? b : a,
    );
    return [
      {
        name: 'jar',
        alt: 'The original jar by kind of file: the code, the sprite packs, the vector scenes, the music, the text, the small files, and a distributor’s GIF that is not part of the game.',
        svg: jarChart(f, j.entries),
      },
      {
        name: 'png',
        alt: 'The chunks of a PNG the game builds in memory: signature, IHDR, PLTE, tRNS, an IDAT with the zlib header, one IDAT per stored block of pixels, an IDAT with the Adler-32, and IEND.',
        svg: anatomyChart(shown, j.palettes),
      },
      {
        name: 'music',
        alt: 'Fourteen MIDI tracks: the prize track plays 87 seconds and is stored as 0; the menu track plays 44 seconds and is stored as 127; the twelve run tracks play about 43.6 seconds and are all stored as 43.157.',
        svg: musicChart(j.tracks),
      },
    ];
  },
};
