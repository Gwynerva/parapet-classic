/**
 * The looks page (dev server only, `dev/looks.html`): a boss's outfit running both ways with
 * its effect in its world, a sheet of poses and its atlas. A painted atlas dropped on the page is
 * read back at once, as `npm run look -- import` reads it (`importAtlas`); Save sends the outfit
 * to the dev server (`vite.config.ts`, POST /dev/save-look), which writes the look's file.
 */
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import { drawPose, type CharacterPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import { EchoSheets, makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx, type FxStyle } from '@parapet/runtime/render/fx/CharacterFx.ts';
import { compileFx } from '@parapet/runtime/render/fx/FxSheet.ts';
import {
  lookDataProblems,
  lookProblems,
  resolveLook,
  type LookData,
  type ResolvedLook,
} from '@parapet/runtime/render/Look.ts';
import {
  applyImport,
  atlasLayout,
  exportAtlas,
  importAtlas,
  type LookAtlasLayout,
} from '@parapet/runtime/render/LookAtlas.ts';
import { buildLookLayer, lookSwap } from '@parapet/runtime/render/LookSheet.ts';
import type { RgbaImage, RgbaSheet } from '@parapet/runtime/render/Raster.ts';
import { SceneRenderer, type SpriteSwap } from '@parapet/runtime/render/SceneRenderer.ts';
import { readPixels } from '@parapet/runtime/render/SkinLibrary.ts';
import { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import { StageRenderer } from '@parapet/runtime/render/Stage.ts';
import { allBosses, type Boss } from '../src/app/bosses.ts';
import { loadContent } from '../src/assets/content.ts';

const lookFiles = import.meta.glob('@content/bosses/*/looks/*.json', {
  eager: true,
  import: 'default',
});

/** World units per pixel. */
const UNITS = 32;
const PANEL_W = 200;
const PANEL_H = 112;
const FEET_Y = PANEL_H - 14;
/** How fast the world goes by (px/s), how long a keyframe lasts, a simulation step. */
const RUN_PX = 120;
const FRAME_MS = 110;
const STEP_MS = 30;
const CELL_W = 74;
const CELL_H = 104;
const POSE_COLUMNS = 10;
const SKY = '#9fb3c8';
const GROUND = '#3a3f4b';
const BACKGROUNDS = ['world', 'light', 'dark', 'checker'] as const;
type Background = (typeof BACKGROUNDS)[number];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** A look being shown: as written (and as last saved), resolved and built. */
interface Shown {
  id: string;
  boss: Boss | null;
  saved: LookData;
  data: LookData;
  look: ResolvedLook | null;
  scene: SceneRenderer;
  swap: SpriteSwap;
  problems: string[];
}

/** One of the two runners: facing right, or left. */
interface Runner {
  dir: 1 | -1;
  x: number;
  fx: CharacterFx;
  key: object;
}

async function main(): Promise<void> {
  const content = await loadContent();
  const sheet = new SpriteSheet(content.atlas.image, content.atlas.frames);
  const baseScene = new SceneRenderer(sheet, content.scenes.values());
  const pixels = readPixels(content.atlas.image);
  if (!pixels) throw new Error('no 2D canvas');
  const base: RgbaSheet = {
    image: { width: pixels.width, height: pixels.height, data: pixels.data },
    frames: content.atlas.frames,
  };
  const echo = new EchoSheets(baseScene);
  const clips = buildClipTable(content.anims.clips);
  const run = content.anims.demos[0];
  const clip = (offset: number): number[] => content.anims.clips[String(offset)] ?? [];
  const keyframes = [
    ...content.anims.demos.map((d) => clip(d.clipOffset)[0] ?? 0),
    ...clip(run?.clipOffset ?? 0),
  ];

  // Every look as written, and the boss wearing it.
  const written = new Map<string, LookData>();
  for (const data of Object.values(lookFiles)) {
    const look = data as LookData;
    written.set(look.id, look);
  }
  const bossOf = new Map<string, Boss>();
  for (const boss of allBosses()) for (const id of boss.data.looks) bossOf.set(id, boss);
  const stages = new Map<string, StageRenderer>();

  // Controls, remembered in the address (#look=kate&zoom=3&bg=world&fx=1&margin=4).
  const lookSelect = $<HTMLSelectElement>('look');
  const zoomSelect = $<HTMLSelectElement>('zoom');
  const bgSelect = $<HTMLSelectElement>('bg');
  const fxBox = $<HTMLInputElement>('fx');
  const marginInput = $<HTMLInputElement>('margin');
  const status = $<HTMLParagraphElement>('status');
  for (const boss of allBosses()) {
    const group = document.createElement('optgroup');
    group.label = `${boss.levelId + 1}. ${boss.id}`;
    for (const id of boss.data.looks) group.append(new Option(id, id));
    lookSelect.append(group);
  }
  for (const z of [1, 2, 3, 4]) zoomSelect.append(new Option(`${z}×`, String(z)));
  for (const b of BACKGROUNDS) bgSelect.append(new Option(b, b));
  const hash = new URLSearchParams(location.hash.slice(1));
  lookSelect.value = written.has(hash.get('look') ?? '') ? hash.get('look')! : lookSelect.value;
  zoomSelect.value = hash.get('zoom') ?? '3';
  bgSelect.value = hash.get('bg') ?? 'world';
  fxBox.checked = hash.get('fx') !== '0';
  marginInput.value = hash.get('margin') ?? '4';
  const remember = (): void => {
    const h = new URLSearchParams({
      look: lookSelect.value,
      zoom: zoomSelect.value,
      bg: bgSelect.value,
      fx: fxBox.checked ? '1' : '0',
      margin: marginInput.value,
    });
    history.replaceState(null, '', `#${h.toString()}`);
  };
  const say = (text: string, bad = false): void => {
    status.textContent = text;
    status.classList.toggle('bad', bad);
  };

  let shown: Shown;
  /** What an atlas is read against: the outfit it was exported from, and its layout. */
  let exported: { data: LookData; look: ResolvedLook; layout: LookAtlasLayout } | null = null;
  /** The atlas picture dropped last (shown instead of the outfit's own). */
  let dropped: RgbaImage | null = null;
  const runners: Runner[] = [1, -1].map((dir) => ({
    dir: dir as 1 | -1,
    x: 0,
    fx: new CharacterFx(echo),
    key: {},
  }));
  let clock = 0;

  const margin = (): number => Math.max(0, Math.min(32, Number(marginInput.value) || 0));

  /** Resolves and builds `data` as the look `id`. */
  const build = (id: string, saved: LookData, data: LookData): Shown => {
    const all = new Map(written);
    all.set(id, data);
    const problems = lookDataProblems(data);
    const look = resolveLook(id, all, problems);
    if (look) problems.push(...lookProblems(look));
    let scene = baseScene;
    let swap: SpriteSwap = (sprite) => sprite;
    if (look) {
      const layer = buildLookLayer(base, look);
      problems.push(...layer.problems);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, layer.width);
      canvas.height = Math.max(1, layer.height);
      const c = canvas.getContext('2d')!;
      const img = c.createImageData(canvas.width, canvas.height);
      img.data.set(layer.data.subarray(0, img.data.length));
      c.putImageData(img, 0, 0);
      scene = baseScene.withSheet(new SpriteSheet(canvas, layer.frames, sheet));
      swap = lookSwap(layer);
    }
    return { id, boss: bossOf.get(id) ?? null, saved, data, look, scene, swap, problems };
  };

  /** The effects and cloth of the outfit (the effect only with the box ticked). */
  const style = (s: Shown): FxStyle | null => {
    const look = s.look;
    if (!look) return null;
    const fx = fxBox.checked && s.boss?.fx ? compileFx(s.boss.fx, look.accent) : null;
    return {
      fx,
      variants: fx ? (look.effect ?? s.boss?.data.effect ?? []) : [],
      color: makeEchoColor(look.id, look.accent),
      source: s.scene,
      swap: () => s.swap,
      ribbons: Object.values(look.ribbons),
      ribbonColor: (token) => look.palette[token] ?? token,
      seed: 1,
    };
  };

  const frameAt = (k: number): number => {
    const count = Math.max(1, run?.frameCount ?? 1);
    const i = (((Math.floor(clock / FRAME_MS) - k) % count) + count) % count;
    return clips[(run?.clipOffset ?? 0) + 1 + i] ?? 0;
  };
  const poseOf = (r: Runner): CharacterPose => ({
    x: r.x,
    y: 0,
    a: frameAt(1),
    b: frameAt(0),
    t: Math.floor(((clock % FRAME_MS) / FRAME_MS) * 65536),
    flipX: r.dir < 0,
    anchored: false,
  });

  const show = (next: Shown): void => {
    shown = next;
    for (const r of runners) {
      r.fx.clear();
      const st = style(next);
      if (st) r.fx.add(r.key, { pose: () => poseOf(r), move: () => 2 }, st);
    }
    $<HTMLButtonElement>('save').disabled = JSON.stringify(next.data) === JSON.stringify(next.saved);
    $<HTMLButtonElement>('reset').disabled = $<HTMLButtonElement>('save').disabled;
    drawPoses();
    drawAtlas();
  };

  const select = (id: string): void => {
    const data = written.get(id);
    if (!data) return;
    const s = build(id, data, data);
    exported = s.look
      ? { data, look: s.look, layout: atlasLayout(base, s.look, { margin: margin() }) }
      : null;
    dropped = null;
    show(s);
    say(s.problems.length ? s.problems.join('\n') : `${id}: as saved`, s.problems.length > 0);
    remember();
  };

  // ------------------------------------------------------------------- the canvases
  const runCanvas = $<HTMLCanvasElement>('run');
  const posesCanvas = $<HTMLCanvasElement>('poses');
  const atlasCanvas = $<HTMLCanvasElement>('atlas');
  /** Sizes a canvas to `w × h` logical pixels at the zoom; returns its context, scaled. */
  const prepare = (canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D => {
    const zoom = Number(zoomSelect.value) || 3;
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const per = zoom * dpr;
    if (canvas.width !== w * per) canvas.width = w * per;
    if (canvas.height !== h * per) canvas.height = h * per;
    canvas.style.width = `${w * zoom}px`;
    canvas.style.height = `${h * zoom}px`;
    const c = canvas.getContext('2d')!;
    c.setTransform(per, 0, 0, per, 0, 0);
    c.imageSmoothingEnabled = false;
    return c;
  };
  const checker = (c: CanvasRenderingContext2D, w: number, h: number): void => {
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        c.fillStyle = ((x + y) >> 2) & 1 ? '#343a44' : '#282c34';
        c.fillRect(x, y, 4, 4);
      }
    }
  };
  const stageOf = (s: Shown): StageRenderer | null => {
    const boss = s.boss;
    if (!boss?.stage) return null;
    let stage = stages.get(boss.id);
    if (!stage) {
      stage = new StageRenderer(boss.stage, boss.data.color);
      stages.set(boss.id, stage);
    }
    return stage;
  };

  const drawRunners = (now: number): void => {
    const c = prepare(runCanvas, PANEL_W * 2 + 4, PANEL_H);
    c.fillStyle = '#101418';
    c.fillRect(0, 0, PANEL_W * 2 + 4, PANEL_H);
    const bg = bgSelect.value as Background;
    const stage = bg === 'world' ? stageOf(shown) : null;
    runners.forEach((r, i) => {
      const ox = i * (PANEL_W + 4);
      c.save();
      c.beginPath();
      c.rect(ox, 0, PANEL_W, PANEL_H);
      c.clip();
      c.translate(ox, 0);
      // Facing right the runner stands left of the middle, room for its cloth behind it.
      const feetX = Math.round(PANEL_W * (r.dir > 0 ? 0.42 : 0.58));
      const scroll = 100_000 + r.x / UNITS;
      if (bg === 'checker') checker(c, PANEL_W, PANEL_H);
      else if (stage?.hasSky) stage.drawSky(c, 0, PANEL_W, FEET_Y, clock);
      else {
        c.fillStyle = bg === 'dark' ? '#1b2129' : SKY;
        c.fillRect(0, 0, PANEL_W, PANEL_H);
      }
      if (stage) stage.draw(c, 0, PANEL_W, FEET_Y, scroll, false, 0, clock);
      else if (bg !== 'checker') {
        c.fillStyle = GROUND;
        c.fillRect(0, FEET_Y, PANEL_W, PANEL_H - FEET_Y);
      }
      const cam = { x: r.x - feetX * UNITS, y: -FEET_Y * UNITS };
      const view = { width: PANEL_W, height: PANEL_H };
      r.fx.drawBehind(c, cam, clock, now, view);
      shown.scene.setViewport(PANEL_W, PANEL_H);
      drawPose(c, shown.scene, poseOf(r), cam, shown.swap);
      r.fx.drawFront(c, cam);
      if (stage) stage.draw(c, 0, PANEL_W, FEET_Y, scroll, true, 0, clock);
      c.restore();
    });
  };

  const drawPoses = (): void => {
    const rows = Math.ceil(keyframes.length / POSE_COLUMNS);
    const w = POSE_COLUMNS * CELL_W;
    const h = rows * 2 * CELL_H;
    const c = prepare(posesCanvas, w, h);
    c.fillStyle = SKY;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#788ca0';
    c.fillRect(0, rows * CELL_H, w, 1);
    shown.scene.setViewport(w, h);
    for (const flip of [false, true]) {
      keyframes.forEach((frame, n) => {
        const col = n % POSE_COLUMNS;
        const row = (flip ? rows : 0) + Math.floor(n / POSE_COLUMNS);
        const pose: CharacterPose = {
          x: (col * CELL_W + CELL_W / 2) * UNITS,
          y: (row * CELL_H + CELL_H - 8) * UNITS,
          a: frame,
          b: frame,
          t: 0,
          flipX: flip,
          anchored: false,
        };
        drawPose(c, shown.scene, pose, { x: 0, y: 0 }, shown.swap);
      });
    }
  };

  /** The atlas on show: the one dropped last, else the outfit's own in the export layout. */
  const atlasPicture = (): RgbaImage | null => {
    if (dropped) return dropped;
    if (!exported || !shown.look) return null;
    return exportAtlas(base, shown.look, exported.layout);
  };
  const drawAtlas = (): void => {
    const pic = atlasPicture();
    if (!pic || !exported) {
      prepare(atlasCanvas, 1, 1);
      return;
    }
    const c = prepare(atlasCanvas, pic.width, pic.height);
    checker(c, pic.width, pic.height);
    c.strokeStyle = '#4a5563';
    c.lineWidth = 1 / (Number(zoomSelect.value) || 3);
    for (const cell of exported.layout.cells) c.strokeRect(cell.x, cell.y, cell.w, cell.h);
    const tmp = document.createElement('canvas');
    tmp.width = pic.width;
    tmp.height = pic.height;
    const t = tmp.getContext('2d')!;
    const img = t.createImageData(pic.width, pic.height);
    img.data.set(pic.data.subarray(0, img.data.length));
    t.putImageData(img, 0, 0);
    c.drawImage(tmp, 0, 0);
  };
  atlasCanvas.addEventListener('mousemove', (e) => {
    const zoom = Number(zoomSelect.value) || 3;
    const rect = atlasCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const cell = exported?.layout.cells.find(
      (k) => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h,
    );
    $('cell').textContent = cell ? `${cell.label}   (${cell.key})` : '';
  });

  // ------------------------------------------------------------------- files
  const download = (name: string, blob: Blob): void => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const exportNow = (): LookAtlasLayout | null => {
    if (!shown.look) return null;
    // From now on dropped pictures are read against this outfit and this layout.
    exported = {
      data: shown.data,
      look: shown.look,
      layout: atlasLayout(base, shown.look, { margin: margin() }),
    };
    dropped = null;
    drawAtlas();
    return exported.layout;
  };
  $('download').addEventListener('click', () => {
    const layout = exportNow();
    if (!layout || !shown.look) return;
    const pic = exportAtlas(base, shown.look, layout);
    const canvas = document.createElement('canvas');
    canvas.width = pic.width;
    canvas.height = pic.height;
    const c = canvas.getContext('2d')!;
    const img = c.createImageData(pic.width, pic.height);
    img.data.set(pic.data.subarray(0, img.data.length));
    c.putImageData(img, 0, 0);
    canvas.toBlob((blob) => blob && download(`${shown.id}.png`, blob), 'image/png');
  });
  $('layout').addEventListener('click', () => {
    const layout = exported?.layout;
    if (!layout) return;
    const text = JSON.stringify(layout, null, 1) + '\n';
    download(`${shown.id}.png.layout.json`, new Blob([text], { type: 'application/json' }));
  });

  const decode = async (file: File): Promise<RgbaImage> => {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const c = canvas.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(bitmap, 0, 0);
    const data = c.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: data.width, height: data.height, data: data.data };
  };
  const readDropped = async (files: File[]): Promise<void> => {
    const png = files.find((f) => f.type === 'image/png' || f.name.endsWith('.png'));
    const json = files.find((f) => f.name.endsWith('.json'));
    if (!png) return say('drop a PNG (and its .layout.json)', true);
    // An atlas from the command line comes with its layout and was cut from the saved look.
    let against = exported;
    if (json) {
      const layout = JSON.parse(await json.text()) as LookAtlasLayout;
      const saved = build(shown.id, shown.saved, shown.saved).look;
      if (!saved) return say('the saved look does not resolve', true);
      against = { data: shown.saved, look: saved, layout };
    }
    if (!against) return say('this look does not resolve: nothing to read the atlas against', true);
    if (against.layout.look !== shown.id) {
      return say(`the layout is the atlas of "${against.layout.look}", not "${shown.id}"`, true);
    }
    const image = await decode(png);
    const result = importAtlas(base, against.look, against.layout, image);
    if (result.problems.length > 0) return say(result.problems.join('\n'), true);
    dropped = image;
    const data = applyImport(against.data, result);
    const s = build(shown.id, shown.saved, data);
    show(s);
    const changed = [...result.pictures.keys()];
    const added = Object.keys(result.palette).filter((k) => !(k in (against.data.palette ?? {})));
    const lines = [
      changed.length ? `changed: ${changed.join(' ')}` : 'nothing changed',
      ...(added.length
        ? [`new colours: ${added.map((k) => `${k} ${result.palette[k]}`).join(', ')}`]
        : []),
      ...s.problems,
    ];
    say(lines.join('\n'), s.problems.length > 0);
  };
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
  });
  document.addEventListener('dragleave', () => document.body.classList.remove('dragging'));
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    const files = [...(e.dataTransfer?.files ?? [])];
    readDropped(files).catch((err: unknown) => say(String(err), true));
  });

  $('save').addEventListener('click', () => {
    const body = JSON.stringify({ id: shown.id, data: shown.data });
    fetch('/dev/save-look', { method: 'POST', body })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        written.set(shown.id, shown.data);
        // The dev server reloads the page as the look's file changes; until then:
        select(shown.id);
        say(`${shown.id}: saved`);
      })
      .catch((err: unknown) => say(`not saved: ${String(err)}`, true));
  });
  $('reset').addEventListener('click', () => select(shown.id));

  lookSelect.addEventListener('change', () => select(lookSelect.value));
  marginInput.addEventListener('change', () => {
    exportNow();
    remember();
  });
  fxBox.addEventListener('change', () => {
    show(shown);
    remember();
  });
  bgSelect.addEventListener('change', remember);
  zoomSelect.addEventListener('change', () => {
    drawPoses();
    drawAtlas();
    remember();
  });

  select(lookSelect.value);
  let last = performance.now();
  let acc = 0;
  const frame = (now: number): void => {
    const dt = Math.min(100, now - last);
    last = now;
    clock += dt;
    for (const r of runners) r.x += (r.dir * RUN_PX * UNITS * dt) / 1000;
    acc += dt;
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      for (const r of runners) r.fx.step({ clock });
    }
    drawRunners(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch((err: unknown) => {
  document.getElementById('status')!.textContent = String(err);
});
