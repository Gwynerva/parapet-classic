/**
 * Client bootstrap: platform objects, fonts, dictionaries, content, renderers, then the title
 * screen and the frame loop.
 */
import { buildSineTable, decodeReplay, MoveTable } from '@parapet/sim';
import { loadContent } from './assets/content.ts';
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import { GameLoop } from '@parapet/runtime/app/GameLoop.ts';
import { ScreenStack } from '@parapet/runtime/app/Screen.ts';
import type { Fonts, GameContext, Skin } from './app/Context.ts';
import { TitleScreen } from './app/screens/TitleScreen.ts';
import { createPlatform, FullscreenCorner } from './app/platform.ts';
import { countVisit } from './app/analytics.ts';
import { MenuBackdrop } from './app/ui/MenuBackdrop.ts';
import { PlayScreen } from './app/screens/PlayScreen.ts';
import type { RunMode, InputRun } from '@parapet/sim';
import { Viewport } from '@parapet/runtime/render/Viewport.ts';
import { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { LevelRenderer } from '@parapet/runtime/render/LevelRenderer.ts';
import { EchoSheets } from '@parapet/runtime/render/EchoSkin.ts';
import { SkinLibrary } from '@parapet/runtime/render/SkinLibrary.ts';
import { registerBosses, upgradeCharacter } from './app/bosses.ts';
import { BitmapFont, type BitmapFontData } from '@parapet/runtime/text/BitmapFont.ts';
import { createI18n, startLocale } from './i18n/locales.ts';
import { InputManager, setVibrationEnabled } from '@parapet/runtime/input/InputManager.ts';
import { TouchControls } from '@parapet/runtime/input/TouchControls.ts';
import {
  dropLegacyEntries,
  loadContestProgress,
  loadOptions,
  loadPlayer,
  saveOptions,
} from '@parapet/runtime/storage/profile.ts';
import {
  contestSetup,
  installReplayInputs,
  openReplayCode,
  takeReplayFromLocation,
  watchSetup,
} from './app/ghosts.ts';
import type { ContestKind } from '@parapet/runtime/storage/profile.ts';
import { installWebFont } from '@parapet/runtime/ui/TextInputOverlay.ts';
import { parseMidi, stripEndMarker, type MidiSong } from '@parapet/runtime/audio/MidiFile.ts';
import { tableGain, type LoudnessTable } from '@parapet/runtime/audio/LoudnessMeter.ts';
import loudnessJson from '@content/audio/loudness.json';
import { MusicPlayer, unlockOnGesture } from '@parapet/runtime/audio/MusicPlayer.ts';
import { CONTEST_TRACK, MusicDirector } from '@parapet/runtime/audio/MusicDirector.ts';
import { scoreToSong, type Score } from '@parapet/runtime/audio/Score.ts';
import themeJson from '@content/bosses/theme.json';
import terminusUrl from '../../content/fonts/src/terminus/TerminusTTF-4.49.3.ttf';
import text12 from '../../content/fonts/text-12.json';
import text12Png from '../../content/fonts/text-12.png';
import text16 from '../../content/fonts/text-16.json';
import text16Png from '../../content/fonts/text-16.png';
import display16 from '../../content/fonts/display-16.json';
import display16Png from '../../content/fonts/display-16.png';
import display24 from '../../content/fonts/display-24.json';
import display24Png from '../../content/fonts/display-24.png';
import skinsJson from '../../content/skins/skins.json';

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
  let options = loadOptions();
  // The first launch picks the language from the browser and keeps it as the player's choice.
  const start = startLocale(options.locale);
  if (start.detected) options = saveOptions({ locale: start.locale });
  const playerInfo = loadPlayer();
  // A boss chosen plain wears its effect once its Flag hunt record is beaten.
  playerInfo.character = upgradeCharacter(playerInfo.character, loadContestProgress());
  const viewport = new Viewport({ scaleMode: options.scaleMode, ...devViewport() });
  const i18n = createI18n(start.locale);
  document.documentElement.lang = i18n.locale;
  i18n.onChange((locale) => {
    document.documentElement.lang = locale;
  });
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
      let song: MidiSong;
      if (id === CONTEST_TRACK) {
        // The contests' theme is a score of ours, not one of the original's MIDI files.
        song = scoreToSong(themeJson as unknown as Score);
      } else {
        const url = content.music.get(id);
        if (!url) throw new Error(`music track ${id} is not bundled`);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`music track ${id}: HTTP ${res.status}`);
        song = stripEndMarker(parseMidi(await res.arrayBuffer()));
      }
      // Every track at the same measured loudness (packages/content/audio/loudness.json).
      song.gain = tableGain(loudnessJson as LoudnessTable, id) ?? undefined;
      return song;
    },
  });
  music.setVolume(options.musicLevel);
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
  const skinLibrary = new SkinLibrary(scene);
  registerBosses(skinLibrary);

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
      skins: skinLibrary,
      moves,
      clips: buildClipTable(content.anims.clips),
      sine,
    },
    screens,
    music,
    options,
    player: playerInfo,
    platform: null as unknown as GameContext['platform'],
    backdrop: null as unknown as MenuBackdrop,
    facingRight: () => true,
  };
  ctx.input = new InputManager({ viewport, facingRight: () => ctx.facingRight(), touch });
  ctx.backdrop = new MenuBackdrop(ctx);
  ctx.platform = createPlatform(ctx, {
    isAtRoot: () => screens.size === 1 && screens.top instanceof TitleScreen,
    back: () => ctx.input.action('back', 'system'),
    onFullscreenLost: () => {
      if (screens.top instanceof PlayScreen) ctx.input.action('pause', 'system');
    },
  });
  const corner = new FullscreenCorner(ctx, ctx.platform);
  // Clipboard, downloads, file dialogs and full screen must run inside the browser's input
  // handler. The corner button and F come first.
  ctx.input.gestureHandler = (g) => corner.onGesture(g) || screens.onGesture(g);

  viewport.onResize(() => {
    scene.setViewport(viewport.width, viewport.height);
    if (options.touchControls === 'auto') touch.enabled = viewport.isCoarsePointer;
    screens.onResize();
  });

  if (import.meta.env.DEV) {
    // Debug handle for the browser console (development builds only).
    (window as unknown as { parapet: unknown }).parapet = { ctx, music, player };
  }
  screens.clear(new TitleScreen(ctx));
  countVisit();
  installReplayInputs(ctx);
  // A challenge link (`#r=<code>`) goes straight into the race, over the title screen.
  const shared = takeReplayFromLocation();
  if (shared) openReplayCode(ctx, shared);
  else await startFromQuery(ctx);

  const loop = new GameLoop((dt) => {
    // Resizing clears the canvas: it happens here, right before the frame is drawn again.
    viewport.sync();
    ctx.input.pollGamepads();
    for (const ev of ctx.input.consumeUi()) {
      if (ev.type === 'key') screens.onKey(ev.key);
      else if (ev.type === 'wheel') screens.onWheel(ev.wheel);
      else screens.onPointer(ev.pointer);
    }
    ctx.backdrop.frame(dt);
    screens.update(dt);
    screens.render(viewport.ctx, 0);
    corner.draw(viewport.ctx);
    ctx.platform.toast.draw(viewport.ctx, fonts.small, viewport);
  });
  loop.start();
}

/**
 * Development: `?vp=292x633` fixes the logical size (a phone's layout on a desktop) and
 * `?coarse=1` treats the mouse as a finger.
 */
function devViewport(): {
  forceLogical?: { width: number; height: number };
  forceCoarse?: boolean;
} {
  if (!import.meta.env.DEV) return {};
  const params = new URLSearchParams(location.search);
  const vp = /^(\d+)x(\d+)$/.exec(params.get('vp') ?? '');
  return {
    ...(vp ? { forceLogical: { width: Number(vp[1]), height: Number(vp[2]) } } : {}),
    forceCoarse: params.get('coarse') === '1',
  };
}

/**
 * Development shortcuts: `?level=3&mode=flags` jumps straight into a run;
 * `?replay=/dev/l0-flags.json` plays a recorded input log (`{ levelId, mode, withRival, input }`).
 */
async function startFromQuery(ctx: GameContext): Promise<void> {
  if (!import.meta.env.DEV) return;
  const params = new URLSearchParams(location.search);
  // `?tas=<level>-<mode>` plays a boss's local run (packages/tools/tas-out, never published);
  // with `&autopilot=1` it drives a contest as if the player ran it.
  const tas = params.get('tas');
  if (tas) {
    const res = await fetch(`/@fs/${TAS_OUT}/${tas}.json`);
    if (!res.ok) throw new Error(`no local TAS run ${tas} (run npm run tas)`);
    const run = (await res.json()) as { replay: string };
    const decoded = decodeReplay(run.replay);
    if (!decoded.ok) throw new Error(`TAS run ${tas}: ${decoded.error}`);
    const replay = decoded.replay;
    if (params.get('autopilot') === '1') {
      const setup = contestSetup(ctx, replay.levelId, replay.mode as ContestKind);
      if (setup) ctx.screens.push(new PlayScreen(ctx, { ...setup, autopilot: replay.input }));
    } else {
      ctx.screens.push(new PlayScreen(ctx, watchSetup(replay)));
    }
    return;
  }
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
