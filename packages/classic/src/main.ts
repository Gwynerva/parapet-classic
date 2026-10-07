/**
 * Client bootstrap: platform objects, fonts, dictionaries, content, renderers, then the title
 * screen and the frame loop.
 */
import { buildSineTable, MoveTable } from '@parapet/sim';
import { loadContent } from './assets/content.ts';
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import { GameLoop } from '@parapet/runtime/app/GameLoop.ts';
import { ScreenStack } from '@parapet/runtime/app/Screen.ts';
import type { Fonts, GameContext, Skin } from './app/Context.ts';
import { TitleScreen } from './app/screens/TitleScreen.ts';
import { PlayScreen } from './app/screens/PlayScreen.ts';
import type { RunMode, InputRun } from '@parapet/sim';
import { Viewport } from '@parapet/runtime/render/Viewport.ts';
import { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { LevelRenderer } from '@parapet/runtime/render/LevelRenderer.ts';
import { EchoSheets } from '@parapet/runtime/render/EchoSkin.ts';
import { BitmapFont, type BitmapFontData } from '@parapet/runtime/text/BitmapFont.ts';
import { createI18n } from './i18n/locales.ts';
import { InputManager, setVibrationEnabled } from '@parapet/runtime/input/InputManager.ts';
import { TouchControls } from '@parapet/runtime/input/TouchControls.ts';
import { dropLegacyEntries, loadOptions, loadPlayer } from '@parapet/runtime/storage/profile.ts';
import { installReplayInputs, openReplayCode, takeReplayFromLocation } from './app/ghosts.ts';
import { installWebFont } from '@parapet/runtime/ui/TextInputOverlay.ts';
import { parseMidi } from '@parapet/runtime/audio/MidiFile.ts';
import { MusicPlayer, unlockOnGesture } from '@parapet/runtime/audio/MusicPlayer.ts';
import { MusicDirector } from '@parapet/runtime/audio/MusicDirector.ts';
import terminusUrl from '../../content-classic/fonts/src/terminus/TerminusTTF-4.49.3.ttf';
import text12 from '../../content-classic/fonts/text-12.json';
import text12Png from '../../content-classic/fonts/text-12.png';
import text16 from '../../content-classic/fonts/text-16.json';
import text16Png from '../../content-classic/fonts/text-16.png';
import display16 from '../../content-classic/fonts/display-16.json';
import display16Png from '../../content-classic/fonts/display-16.png';
import display24 from '../../content-classic/fonts/display-24.json';
import display24Png from '../../content-classic/fonts/display-24.png';
import skinsJson from '../../content-classic/skins/skins.json';

async function loadFonts(): Promise<Fonts> {
  const [small, text, display, title] = await Promise.all([
    BitmapFont.fromData(text12 as BitmapFontData, text12Png),
    BitmapFont.fromData(text16 as BitmapFontData, text16Png),
    BitmapFont.fromData(display16 as BitmapFontData, display16Png),
    BitmapFont.fromData(display24 as BitmapFontData, display24Png),
  ]);
  return { small, text, display, title };
}

async function main(): Promise<void> {
  dropLegacyEntries();
  const options = loadOptions();
  const playerInfo = loadPlayer();
  const viewport = new Viewport({ scaleMode: options.scaleMode });
  const i18n = createI18n(options.locale);
  setVibrationEnabled(options.vibration);

  const [content, fonts] = await Promise.all([loadContent(), loadFonts()]);
  const skins = (skinsJson as { skins: Skin[] }).skins;
  // The name field is an HTML input; it uses the bundled Terminus so no system font shows.
  installWebFont('Terminus', terminusUrl);

  // `?touch=1` forces the on-screen buttons (handy for looking at them on a desktop).
  const forceTouch = new URLSearchParams(location.search).get('touch') === '1';
  const touch = new TouchControls(viewport, {
    layout: options.touchLayout,
    enabled:
      forceTouch ||
      (options.touchControls === 'auto'
        ? viewport.isCoarsePointer
        : options.touchControls === 'on'),
  });
  const screens = new ScreenStack();
  const player = new MusicPlayer();
  const music = new MusicDirector({
    player,
    loadTrack: async (id) => {
      const url = content.music.get(id);
      if (!url) throw new Error(`music track ${id} is not bundled`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`music track ${id}: HTTP ${res.status}`);
      return parseMidi(await res.arrayBuffer());
    },
  });
  music.setVolume(options.musicVolume);
  unlockOnGesture(player);
  document.addEventListener('visibilitychange', () => {
    // Like the original's `hideNotify`: silence while the page is hidden.
    if (document.hidden) music.pause();
    else music.resume();
  });
  const sheet = new SpriteSheet(content.atlas.image, content.atlas.frames);
  const scene = new SceneRenderer(sheet, content.scenes.values());
  scene.setViewport(viewport.width, viewport.height);
  const sine = buildSineTable(10, true);
  const moves = new MoveTable(content.moves);

  const ctx: GameContext = {
    viewport,
    input: null as unknown as InputManager,
    touch,
    i18n,
    fonts,
    content,
    skins,
    render: {
      sheet,
      scene,
      level: new LevelRenderer(content, sheet, scene, sine),
      echo: new EchoSheets(scene),
      moves,
      clips: buildClipTable(content.anims.clips),
      sine,
    },
    screens,
    music,
    options,
    player: playerInfo,
    facingRight: () => true,
  };
  ctx.input = new InputManager({ viewport, facingRight: () => ctx.facingRight(), touch });
  // Clipboard, downloads and file dialogs must run inside the browser's input handler.
  ctx.input.gestureHandler = (g) => screens.onGesture(g);

  viewport.onResize(() => {
    scene.setViewport(viewport.width, viewport.height);
    screens.onResize();
  });

  if (import.meta.env.DEV) {
    // Debug handle for the browser console (development builds only).
    (window as unknown as { parapet: unknown }).parapet = { ctx, music, player };
  }
  screens.clear(new TitleScreen(ctx));
  installReplayInputs(ctx);
  // A challenge link (`#r=<code>`) goes straight into the race, over the title screen.
  const shared = takeReplayFromLocation();
  if (shared) openReplayCode(ctx, shared);
  else await startFromQuery(ctx);

  const loop = new GameLoop((dt) => {
    ctx.input.pollGamepads();
    for (const ev of ctx.input.consumeUi()) {
      if (ev.type === 'key') screens.onKey(ev.key);
      else screens.onPointer(ev.pointer);
    }
    screens.update(dt);
    screens.render(viewport.ctx, 0);
  });
  loop.start();
}

/**
 * Development shortcuts: `?level=3&mode=flags` jumps straight into a run;
 * `?replay=/dev/l0-flags.json` plays a recorded input log (`{ levelId, mode, withRival, input }`).
 */
async function startFromQuery(ctx: GameContext): Promise<void> {
  if (!import.meta.env.DEV) return;
  const params = new URLSearchParams(location.search);
  const replayUrl = params.get('replay');
  let levelId = Number(params.get('level') ?? '0');
  let mode = (params.get('mode') ?? 'free') as RunMode;
  let withRival = params.get('rival') === '1';
  let script: InputRun[] | undefined;
  if (replayUrl) {
    const res = await fetch(replayUrl);
    const data = (await res.json()) as {
      levelId: number;
      mode: RunMode;
      withRival: boolean;
      input: InputRun[];
    };
    levelId = data.levelId;
    mode = data.mode;
    withRival = data.withRival;
    script = data.input;
  } else if (!params.has('level') && !params.has('mode')) {
    return;
  }
  ctx.screens.push(
    new PlayScreen(ctx, {
      levelId,
      mode,
      withRival,
      playerName: ctx.player.name || 'dev',
      character: ctx.player.character,
      script,
    }),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  const el = document.getElementById('game');
  if (el) {
    el.textContent = `Failed to start: ${err instanceof Error ? err.message : String(err)}`;
    el.style.color = '#fff';
    el.style.fontFamily = 'monospace';
  }
});
