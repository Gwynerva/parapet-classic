// Entry point: `npm run look -- <command>` — drawing and checking looks (see bosses/README.md).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AtlasData, AtlasFrame, SceneFile } from '@parapet/runtime/content/types.ts';
import {
  lookDataProblems,
  lookProblems,
  LOOK_SPRITES,
  resolveLook,
  type LookData,
  type ResolvedLook,
} from '@parapet/runtime/render/Look.ts';
import {
  applyImport,
  atlasLayout,
  exportAtlas,
  importAtlas,
  PALETTE_CHARS,
  rotateParts,
  type LookAtlasLayout,
} from '@parapet/runtime/render/LookAtlas.ts';
import { buildLookLayer, lookSwap } from '@parapet/runtime/render/LookSheet.ts';
import { packRows } from '@parapet/runtime/render/pack.ts';
import { composePose, type DrawCommand, type SpriteSwap } from '@parapet/runtime/render/Pose.ts';
import {
  drawImageScaled,
  fillRect,
  newImage,
  rasterCommands,
  sheetFrame,
  type RgbaImage,
  type RgbaSheet,
} from '@parapet/runtime/render/Raster.ts';
import { familyOf } from '@parapet/runtime/render/Rig.ts';
import { skinSwap } from '@parapet/runtime/render/CharacterRenderer.ts';
import { drawText, loadFont, textWidth } from './bitmapText.ts';
import { decodePng, encodePng } from './png.ts';

const CONTENT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
const GENERATED = join(CONTENT_ROOT, 'playman', 'extracted');
const BOSSES = join(CONTENT_ROOT, 'bosses');

const USAGE = `usage: npm run look -- <command>     (a look is a file or its id: kate)

  template <boss>/<look>           a new look file in bosses/<boss>/looks/ to draw on
           [--base <n>] [--extends <look>] [--accent <#rrggbb>]
  atlas <look.json> --out <png>    the look's parts, one cell each in reading order, to paint
        [--margin <n>]             over in any editor; writes <png>.layout.json next to it
        [--add <keys>]             (--add 17:right,25:left,cape@57: more cells to draw;
        [--changed]                 --changed: only the parts the look changes)
  import <look.json> <png>         reads an edited atlas back into the look (prints what
         [--layout <json>]         changed; --write saves the look file)
         [--write]
  sheet <look.json> --out <png>    the atlas magnified, labelled, on a checker, with each
        [--scale <n>] [--add …]    part's point marked: to look at the look
        [--changed]
  poses <look.json|base> --out <png>  the character in a row of poses (each move demo's first
        [--scale <n>] [--both]     frame and the run cycle); --both adds a row facing left;
        [--frames <k,k,...>]       --parts paints every body part in its own colour
        [--parts]
  base [--out <file>]              Blaise's body parts as text, to start a look by hand
       [--parts <id,id,...>]
  rotate <look.json> --from <keys> the turned pictures of parts made from their upright ones
         [--write]                 (--from 25,34,57,5,9:right: each key's next three ids,
                                   turned 22.5°, 45°, 67.5°); --write saves them as parts
  lineup <look> <look>... --out <png>  several looks side by side, running right then left
         [--frames <k,k>] [--scale <n>]    (--frames: keyframes, every second one facing left;
         [--columns <n>]                    --columns: looks per row)
  migrate <look.json>              moves old "near" pictures to parts["<id>:near"]`;

/** Where the command was typed (npm runs workspace scripts in the package's folder). */
const CWD = process.env.INIT_CWD ?? process.cwd();

/** A path as typed, or a look id (`kate`) → the file. */
function lookFile(arg: string): string {
  if (arg.endsWith('.json')) return resolve(CWD, arg);
  return allLooks().get(arg)?.file ?? resolve(CWD, arg);
}

function outPath(arg: string): string {
  return resolve(CWD, arg);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function loadBase(): RgbaSheet {
  const png = decodePng(new Uint8Array(readFileSync(join(GENERATED, 'atlas.png'))));
  const json = readJson<AtlasData>(join(GENERATED, 'atlas.json'));
  const frames: (AtlasFrame | undefined)[] = [];
  for (const [id, f] of Object.entries(json.frames)) frames[Number(id)] = f;
  return { image: { width: png.width, height: png.height, data: png.rgba }, frames };
}

/** Every look file in the content, by id. */
function allLooks(): Map<string, { data: LookData; file: string }> {
  const out = new Map<string, { data: LookData; file: string }>();
  const scan = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, f.name);
      if (f.isDirectory()) scan(path);
      else if (f.name.endsWith('.json') && basename(dirname(path)) === 'looks') {
        const data = readJson<LookData>(path);
        if (typeof data.id === 'string') out.set(data.id, { data, file: path });
      }
    }
  };
  scan(BOSSES);
  return out;
}

/** The look in `file` resolved against every other look; exits on problems. */
function loadLook(file: string): { data: LookData; look: ResolvedLook } | null {
  const data = readJson<LookData>(file);
  const all = new Map([...allLooks()].map(([id, v]) => [id, v.data]));
  all.set(data.id, data);
  const problems = lookDataProblems(data);
  const look = resolveLook(data.id, all, problems);
  if (look) problems.push(...lookProblems(look));
  if (problems.length > 0 || !look) {
    console.error(`${file}:\n  ${problems.join('\n  ')}`);
    return null;
  }
  return { data, look };
}

const PRETTIER = createRequire(import.meta.url).resolve('prettier/bin/prettier.cjs');

/** Writes a look as the repository keeps it: JSON through Prettier, like `npm run format`. */
function writeLook(file: string, data: LookData): void {
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  try {
    execFileSync(process.execPath, [PRETTIER, '--write', '--log-level', 'warn', file], {
      stdio: 'inherit',
    });
  } catch {
    console.warn(`${file}: not formatted, run npm run format`);
  }
}

function option(rest: readonly string[], name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

function positional(rest: readonly string[]): string[] {
  return rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
}

function savePng(file: string, img: RgbaImage): void {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  writeFileSync(
    file,
    encodePng(
      img.width,
      img.height,
      new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength),
    ),
  );
}

function addKeys(rest: readonly string[]): string[] {
  return (option(rest, '--add') ?? '').split(',').filter(Boolean);
}

function template(name: string, rest: readonly string[]): number {
  const [boss, id] = name.split('/');
  if (!boss || !id || !/^[a-z][a-z0-9-]*$/.test(id)) {
    console.error('template <boss>/<look>, both kebab-case');
    return 2;
  }
  const file = join(BOSSES, boss, 'looks', `${id}.json`);
  if (existsSync(file)) {
    console.error(`${file} exists already`);
    return 1;
  }
  const look: LookData = { id };
  const parent = option(rest, '--extends');
  if (parent) look.extends = parent;
  const base = option(rest, '--base');
  if (base !== undefined || !parent) look.base = Number(base ?? 0);
  look.accent = option(rest, '--accent') ?? '#ff3ea5';
  look.palette = {};
  look.parts = {};
  mkdirSync(dirname(file), { recursive: true });
  writeLook(file, look);
  console.log(`${file}: written; next: npm run look -- atlas ${file} --out ${id}.png`);
  return 0;
}

function atlas(file: string, out: string, rest: readonly string[]): number {
  const loaded = loadLook(file);
  if (!loaded) return 1;
  const base = loadBase();
  const layout = atlasLayout(base, loaded.look, {
    margin: Number(option(rest, '--margin') ?? 4),
    add: addKeys(rest),
    changedOnly: rest.includes('--changed'),
  });
  savePng(out, exportAtlas(base, loaded.look, layout));
  writeFileSync(`${out}.layout.json`, JSON.stringify(layout, null, 1) + '\n');
  console.log(
    `${out}: ${layout.cells.length} cells, ${layout.width}x${layout.height} (layout in ${out}.layout.json)`,
  );
  return 0;
}

function importCommand(file: string, png: string, rest: readonly string[]): number {
  const loaded = loadLook(file);
  if (!loaded) return 1;
  const given = option(rest, '--layout');
  const layoutFile = given ? resolve(CWD, given) : `${png}.layout.json`;
  if (!existsSync(layoutFile)) {
    console.error(`no layout ${layoutFile}: export the atlas with \`look atlas\` first`);
    return 1;
  }
  const layout = readJson<LookAtlasLayout>(layoutFile);
  if (layout.look !== loaded.look.id) {
    console.error(`${layoutFile} is the layout of "${layout.look}", not "${loaded.look.id}"`);
    return 1;
  }
  const img = decodePng(new Uint8Array(readFileSync(png)));
  const result = importAtlas(loadBase(), loaded.look, layout, {
    width: img.width,
    height: img.height,
    data: img.rgba,
  });
  if (result.problems.length > 0) {
    console.error(result.problems.join('\n'));
    return 1;
  }
  const changed = [...result.pictures.keys()];
  console.log(changed.length === 0 ? 'nothing changed' : `changed: ${changed.join(' ')}`);
  const added = Object.keys(result.palette).filter((k) => !(k in (loaded.look.palette ?? {})));
  if (added.length > 0)
    console.log(`new colours: ${added.map((k) => `${k} ${result.palette[k]}`).join(', ')}`);
  if (rest.includes('--write') && changed.length > 0) {
    const next = applyImport(loaded.data, result);
    writeLook(file, next);
    console.log(`${file}: saved`);
  }
  return 0;
}

const CHECKER: readonly [number, number, number, number][] = [
  [40, 44, 52, 255],
  [52, 58, 68, 255],
];

function sheet(file: string, out: string, rest: readonly string[]): number {
  const loaded = loadLook(file);
  if (!loaded) return 1;
  const base = loadBase();
  const scale = Math.max(1, Number(option(rest, '--scale') ?? 4));
  const layout = atlasLayout(base, loaded.look, {
    margin: 2,
    add: addKeys(rest),
    changedOnly: rest.includes('--changed'),
  });
  const atlasImg = exportAtlas(base, loaded.look, layout);
  const font = loadFont(join(CONTENT_ROOT, 'fonts'));
  const labelH = font.lineHeight + 2;
  const items = layout.cells.map((c, i) => ({
    key: String(i),
    w: Math.max(c.w * scale, textWidth(font, c.label) + 2),
    h: c.h * scale + labelH,
    breakBefore: i > 0 && layout.cells[i - 1]!.family !== c.family,
  }));
  const packing = packRows(items, 1400, 6);
  const img = newImage(packing.width, packing.height);
  fillRect(img, 0, 0, img.width, img.height, [24, 27, 33, 255]);
  layout.cells.forEach((c, i) => {
    const r = packing.cells.get(String(i))!;
    drawText(img, font, c.label, r.x + 1, r.y, c.mirrored ? [255, 196, 120] : [200, 208, 220]);
    const cx = r.x;
    const cy = r.y + labelH;
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        fillRect(img, cx + x * scale, cy + y * scale, scale, scale, CHECKER[(x + y) & 1]!);
      }
    }
    // The part's point: where the game centres the picture.
    const px = cx + (c.w >> 1) * scale;
    const py = cy + (c.h >> 1) * scale;
    fillRect(img, px, cy, 1, c.h * scale, [90, 110, 140, 255]);
    fillRect(img, cx, py, c.w * scale, 1, [90, 110, 140, 255]);
    const cell = newImage(c.w, c.h);
    for (let y = 0; y < c.h; y++) {
      const o = ((c.y + y) * atlasImg.width + c.x) * 4;
      cell.data.set(atlasImg.data.subarray(o, o + c.w * 4), y * c.w * 4);
    }
    drawImageScaled(img, cell, cx, cy, scale);
  });
  savePng(out, img);
  console.log(
    `${out}: ${layout.cells.length} parts (mirrored ones labelled in orange, as seen on screen)`,
  );
  return 0;
}

/** A distinct colour per body part for `--parts`. */
function partColour(id: number): [number, number, number] {
  const hue = (id * 137.508) % 360;
  const s = 0.75;
  const l = id % 2 === 0 ? 0.5 : 0.65;
  const k = (n: number): number => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** The base atlas with every character sprite painted flat in its part's colour. */
function tintedBase(base: RgbaSheet): RgbaSheet {
  const data = new Uint8ClampedArray(base.image.data);
  for (const [id, f] of base.frames.entries()) {
    if (!f || familyOf(id) < 0) continue;
    const [r, g, b] = partColour(id);
    for (let y = f.y; y < f.y + f.h; y++) {
      for (let x = f.x; x < f.x + f.w; x++) {
        const o = (y * base.image.width + x) * 4;
        if (data[o + 3]! < 128) continue;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
      }
    }
  }
  return { image: { ...base.image, data }, frames: base.frames };
}

function poses(file: string, out: string, rest: readonly string[]): number {
  let base = loadBase();
  const parts = rest.includes('--parts');
  if (parts) base = tintedBase(base);
  let sheetOf: RgbaSheet = base;
  let swap: SpriteSwap = skinSwap(0);
  if (file !== 'base') {
    const loaded = loadLook(file);
    if (!loaded) return 1;
    const layer = buildLookLayer(base, loaded.look);
    if (layer.problems.length > 0) console.warn(layer.problems.join('\n'));
    sheetOf = { image: layer, frames: layer.frames, fallback: base };
    swap = lookSwap(layer);
  }
  const k0 = readJson<SceneFile>(join(GENERATED, 'scenes', 'k0.json'));
  const obj = k0.objects[0]!;
  const anims = readJson<{
    clips: Record<string, number[]>;
    demos: { clipOffset: number }[];
  }>(join(GENERATED, 'anims.json'));
  const clip = (offset: number): number[] => anims.clips[String(offset)] ?? [];
  const pick = option(rest, '--frames');
  const keyframes = pick
    ? pick.split(',').map(Number)
    : [
        ...anims.demos.map((d) => clip(d.clipOffset)[0] ?? 0),
        ...clip(anims.demos[0]?.clipOffset ?? 0),
      ];
  const facings = rest.includes('--both') ? [false, true] : [false];
  const scale = Math.max(1, Number(option(rest, '--scale') ?? 3));
  const cellW = 74;
  const cellH = 104;
  const cols = Math.min(12, keyframes.length);
  const rowsPer = Math.ceil(keyframes.length / cols);
  const small = newImage(cols * cellW, rowsPer * facings.length * cellH);
  fillRect(small, 0, 0, small.width, small.height, [159, 179, 200, 255]);
  const sizes = {
    width: (id: number) => sheetFrame(sheetOf, id)?.frame.w ?? 0,
    height: (id: number) => sheetFrame(sheetOf, id)?.frame.h ?? 0,
  };
  const cmds: DrawCommand[] = [];
  facings.forEach((flip, fi) => {
    keyframes.forEach((frame, n) => {
      const col = n % cols;
      const row = fi * rowsPer + Math.floor(n / cols);
      if (fi > 0 && n === 0) fillRect(small, 0, row * cellH, small.width, 1, [120, 136, 156, 255]);
      const count = composePose(obj, sizes, frame, frame, 0, flip, swap, cmds);
      // Feet (the pivot) at the bottom middle of the cell.
      const ox = col * cellW + (cellW >> 1) - (flip ? obj.width - obj.pivotX : obj.pivotX);
      const oy = row * cellH + cellH - 6 - obj.pivotY;
      rasterCommands(small, sheetOf, cmds, count, ox, oy);
    });
  });
  const img = newImage(small.width * scale, small.height * scale);
  drawImageScaled(img, small, 0, 0, scale);
  savePng(out, img);
  console.log(
    `${out}: ${keyframes.length} poses${facings.length > 1 ? ', facing right then left' : ''}`,
  );
  return 0;
}

function base(out: string | undefined, only: Set<number> | null): number {
  const atlasSheet = loadBase();
  const palette = new Map<string, string>();
  const parts: Record<string, string[]> = {};
  const hex = (r: number, g: number, b: number): string =>
    '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  for (const id of [...LOOK_SPRITES].sort((a, b) => a - b)) {
    const f = atlasSheet.frames[id];
    if (!f || (only && !only.has(id))) continue;
    const rows: string[] = [];
    const img = atlasSheet.image;
    for (let y = 0; y < f.h; y++) {
      let row = '';
      for (let x = 0; x < f.w; x++) {
        const o = ((f.y + y) * img.width + f.x + x) * 4;
        if (img.data[o + 3]! < 128) {
          row += '.';
          continue;
        }
        const colour = hex(img.data[o]!, img.data[o + 1]!, img.data[o + 2]!);
        let ch = palette.get(colour);
        if (!ch) {
          ch = PALETTE_CHARS[palette.size];
          if (!ch) throw new Error(`more than ${PALETTE_CHARS.length} colours`);
          palette.set(colour, ch);
        }
        row += ch;
      }
      rows.push(row);
    }
    parts[String(id)] = rows;
  }
  const look: LookData = {
    id: 'blaise',
    base: 0,
    accent: '#ff3ea5',
    palette: Object.fromEntries([...palette].map(([colour, ch]) => [ch, colour])),
    parts,
  };
  const text = JSON.stringify(look, null, 2) + '\n';
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
  return 0;
}

/** Several looks side by side in the same poses, each labelled. */
function lineup(files: readonly string[], out: string, rest: readonly string[]): number {
  const base = loadBase();
  const k0 = readJson<SceneFile>(join(GENERATED, 'scenes', 'k0.json'));
  const obj = k0.objects[0]!;
  const anims = readJson<{ clips: Record<string, number[]>; demos: { clipOffset: number }[] }>(
    join(GENERATED, 'anims.json'),
  );
  const run = anims.clips[String(anims.demos[0]?.clipOffset ?? 0)] ?? [0];
  const pick = option(rest, '--frames');
  const frames = pick ? pick.split(',').map(Number) : [run[0] ?? 0, run[3] ?? 0];
  const scale = Math.max(1, Number(option(rest, '--scale') ?? 3));
  const font = loadFont(join(CONTENT_ROOT, 'fonts'));
  const cellW = 44;
  const cellH = 74;
  const perRow = Math.max(1, Number(option(rest, '--columns') ?? files.length));
  const rows = Math.ceil(files.length / perRow);
  const rowW = Math.min(files.length, perRow) * cellW * frames.length;
  const small = newImage(rowW, cellH * rows);
  fillRect(small, 0, 0, small.width, small.height, [159, 179, 200, 255]);
  const cmds: DrawCommand[] = [];
  const names: string[] = [];
  files.forEach((file, i) => {
    const loaded = loadLook(file);
    if (!loaded) return;
    names[i] = loaded.look.id;
    const layer = buildLookLayer(base, loaded.look);
    const sheet: RgbaSheet = { image: layer, frames: layer.frames, fallback: base };
    const swap = lookSwap(layer);
    const sizes = {
      width: (id: number) => sheetFrame(sheet, id)?.frame.w ?? 0,
      height: (id: number) => sheetFrame(sheet, id)?.frame.h ?? 0,
    };
    frames.forEach((frame, j) => {
      const flip = j % 2 === 1;
      const n = composePose(obj, sizes, frame, frame, 0, flip, swap, cmds);
      const col = (i % perRow) * frames.length + j;
      const ox = col * cellW + (cellW >> 1) - (flip ? obj.width - obj.pivotX : obj.pivotX);
      const oy = Math.floor(i / perRow) * cellH + cellH - 6 - obj.pivotY;
      rasterCommands(small, sheet, cmds, n, ox, oy);
    });
  });
  const band = font.lineHeight + 4;
  const img = newImage(small.width * scale, rows * (cellH * scale + band));
  fillRect(img, 0, 0, img.width, img.height, [24, 27, 33, 255]);
  for (let r = 0; r < rows; r++) {
    const strip = newImage(small.width, cellH);
    for (let y = 0; y < cellH; y++) {
      const from = ((r * cellH + y) * small.width) << 2;
      strip.data.set(small.data.subarray(from, from + (small.width << 2)), (y * small.width) << 2);
    }
    drawImageScaled(img, strip, 0, r * (cellH * scale + band) + band, scale);
  }
  names.forEach((name, i) =>
    drawText(
      img,
      font,
      name,
      (i % perRow) * cellW * frames.length * scale + 2,
      Math.floor(i / perRow) * (cellH * scale + band) + 1,
      [200, 208, 220],
    ),
  );
  savePng(out, img);
  console.log(`${out}: ${names.filter(Boolean).length} looks`);
  return 0;
}

function rotate(file: string, rest: readonly string[]): number {
  const loaded = loadLook(file);
  if (!loaded) return 1;
  const from = (option(rest, '--from') ?? '').split(',').filter(Boolean);
  if (from.length === 0) {
    console.error('rotate needs --from <keys>');
    return 2;
  }
  const result = rotateParts(loadBase(), loaded.look, from);
  if (result.problems.length > 0) console.error(result.problems.join('\n'));
  console.log(`turned: ${[...result.parts.keys()].join(' ') || 'nothing'}`);
  if (rest.includes('--write') && result.parts.size > 0) {
    const parts = { ...(loaded.data.parts ?? {}) };
    const attachments = { ...(loaded.data.attachments ?? {}) };
    for (const [key, rows] of result.parts) {
      const at = key.indexOf('@');
      if (at < 0) {
        parts[key] = rows;
        continue;
      }
      const name = key.slice(0, at);
      const a = attachments[name] ?? loaded.look.attachments[name];
      if (!a) continue;
      attachments[name] = { ...a, sprites: { ...a.sprites, [key.slice(at + 1)]: rows } };
    }
    const next: LookData = { ...loaded.data, palette: result.palette, parts };
    if (Object.keys(attachments).length > 0) next.attachments = attachments;
    writeLook(file, next);
    console.log(`${file}: saved`);
  }
  return result.problems.length > 0 ? 1 : 0;
}

function migrate(file: string): number {
  const data = readJson<LookData>(file);
  if (!data.near) {
    console.log(`${file}: nothing to migrate`);
    return 0;
  }
  const parts = { ...(data.parts ?? {}) };
  for (const [k, rows] of Object.entries(data.near)) parts[`${k}:near`] = rows;
  const next: LookData = { ...data, parts };
  delete next.near;
  writeLook(file, next);
  console.log(`${file}: near pictures moved to parts`);
  return 0;
}

function main(argv: readonly string[]): number {
  const [command, ...rest] = argv;
  const args = positional(rest);
  const out = option(rest, '--out');
  switch (command) {
    case 'template':
      if (args[0]) return template(args[0], rest);
      break;
    case 'atlas':
      if (args[0] && out) return atlas(lookFile(args[0]), outPath(out), rest);
      break;
    case 'import':
      if (args[0] && args[1]) return importCommand(lookFile(args[0]), outPath(args[1]), rest);
      break;
    case 'sheet':
      if (args[0] && out) return sheet(lookFile(args[0]), outPath(out), rest);
      break;
    case 'poses':
      if (args[0] && out) {
        return poses(args[0] === 'base' ? 'base' : lookFile(args[0]), outPath(out), rest);
      }
      break;
    case 'base': {
      const only = option(rest, '--parts');
      return base(out && outPath(out), only ? new Set(only.split(',').map(Number)) : null);
    }
    case 'migrate':
      if (args[0]) return migrate(lookFile(args[0]));
      break;
    case 'rotate':
      if (args[0]) return rotate(lookFile(args[0]), rest);
      break;
    case 'lineup':
      if (args.length > 0 && out) return lineup(args.map(lookFile), outPath(out), rest);
      break;
    default:
      break;
  }
  console.error(USAGE);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
