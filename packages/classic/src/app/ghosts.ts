/**
 * Ghost races: a recorded run (someone's shared replay or the player's own record) re-run
 * next to the player's, on the same level and mode. Replays arrive as links, files, drops
 * and pastes; this module checks them, re-runs them headlessly for their verified result and
 * starts the race. It also sends the player's own runs out again (link to the clipboard,
 * file download).
 */
import {
  cleanReplayName,
  decodeReplay,
  encodeReplay,
  isRankedMode,
  replayCompatibility,
  RULESET_ID,
  runContentHash,
  SIM_VERSION,
  simulateReplay,
  type ContentHash,
  type Replay,
  type RunContent,
  type RunMode,
} from '@parapet/sim';
import type { GhostKind, GhostSetup, RunSetup } from '@parapet/runtime/app/RunSession.ts';
import {
  extractReplayCode,
  REPLAY_FILE_ACCEPT,
  replayFileName,
  replayFileText,
  replayLink,
} from '@parapet/runtime/app/replayFile.ts';
import { copyText } from '@parapet/runtime/platform/clipboard.ts';
import {
  downloadText,
  onFileDrop,
  onPasteText,
  pickFile,
  readText,
} from '@parapet/runtime/platform/files.ts';
import { loadRecord, type RecordEntry } from '@parapet/runtime/storage/profile.ts';
import { MessageBox } from '@parapet/runtime/ui/MessageBox.ts';
import type { GameContext } from './Context.ts';
import { CopyLinkScreen } from './screens/CopyLinkScreen.ts';
import { PlayScreen } from './screens/PlayScreen.ts';

export type GhostProblem = 'invalid' | 'version' | 'content';

/** The content a run of `levelId` is built from, or null for a level that does not exist. */
export function runContent(ctx: GameContext, levelId: number): RunContent | null {
  const level = ctx.content.levels[levelId];
  const mission = ctx.content.missions.levels[levelId];
  if (!level || !mission) return null;
  return {
    level,
    mission,
    moves: ctx.content.moves,
    tables: ctx.content.tables,
    rival: ctx.content.rivals.get(levelId) ?? null,
  };
}

const hashes = new Map<number, ContentHash>();

/** Content hashes per level; the content never changes while the page lives. */
function contentHashOf(content: RunContent, levelId: number): ContentHash {
  let hash = hashes.get(levelId);
  if (!hash) {
    hash = runContentHash(content);
    hashes.set(levelId, hash);
  }
  return hash;
}

/** Checks a replay against this build and re-runs it for its verified result and splits. */
export function prepareGhost(
  ctx: GameContext,
  replay: Replay,
  kind: GhostKind,
): { ok: true; ghost: GhostSetup } | { ok: false; problem: GhostProblem } {
  const content = runContent(ctx, replay.levelId);
  if (!content) return { ok: false, problem: 'invalid' };
  const compat = replayCompatibility(replay, contentHashOf(content, replay.levelId));
  if (compat !== 'ok') return { ok: false, problem: compat };
  return { ok: true, ghost: { kind, replay, outcome: simulateReplay(replay, content) } };
}

/** The replay of a local record (records are made on this device, with this content). */
export function recordReplay(
  ctx: GameContext,
  levelId: number,
  mode: RunMode,
  entry: RecordEntry,
): Replay | null {
  const content = runContent(ctx, levelId);
  if (!content || !isRankedMode(mode) || entry.input.length === 0) return null;
  if (entry.simVersion && entry.simVersion !== SIM_VERSION) return null;
  return {
    simVersion: SIM_VERSION,
    rulesetId: RULESET_ID,
    contentHash: contentHashOf(content, levelId),
    levelId,
    mode,
    withRival: mode === 'sprint' && entry.withRival,
    character: Math.max(0, Math.min(9, entry.character)),
    playerName: cleanReplayName(entry.playerName || ctx.player.name),
    input: entry.input,
  };
}

/** The ghost of the local record of a mission, or null when there is none (or it is stale). */
export function bestGhost(ctx: GameContext, levelId: number, mode: RunMode): GhostSetup | null {
  const record = loadRecord(levelId, mode);
  if (!record) return null;
  const replay = recordReplay(ctx, levelId, mode, record);
  if (!replay) return null;
  const prepared = prepareGhost(ctx, replay, 'best');
  return prepared.ok ? prepared.ghost : null;
}

/**
 * A mission as started from the menus: the current player, the rival when asked for (sprint
 * only), and the ghost of the local record when the option is on and there is one.
 */
export function missionSetup(
  ctx: GameContext,
  levelId: number,
  mode: RunMode,
  withRival: boolean,
): RunSetup {
  const ghost = ctx.options.bestGhost ? bestGhost(ctx, levelId, mode) : null;
  return {
    levelId,
    mode,
    withRival: mode === 'sprint' && withRival,
    playerName: ctx.player.name,
    character: ctx.player.character,
    ...(ghost ? { ghost } : {}),
  };
}

/** A run of the ghost's level and mode, played by the current player. */
export function raceSetup(ctx: GameContext, ghost: GhostSetup): RunSetup {
  const { replay } = ghost;
  return {
    levelId: replay.levelId,
    mode: replay.mode,
    withRival: replay.withRival,
    playerName: ctx.player.name,
    character: ctx.player.character,
    ghost,
  };
}

/** Plays a replay back as it was recorded (the runner's own character and name). */
export function watchSetup(replay: Replay): RunSetup {
  return {
    levelId: replay.levelId,
    mode: replay.mode,
    withRival: replay.withRival,
    playerName: replay.playerName,
    character: replay.character,
    script: replay.input,
  };
}

/** Display name of a replay's runner. */
export function runnerName(ctx: GameContext, replay: Replay): string {
  return replay.playerName || ctx.i18n.t('player.name');
}

/** Starts a race against a decoded replay code, or explains why it cannot run. */
export function openReplayCode(ctx: GameContext, code: string): void {
  const decoded = decodeReplay(code);
  if (!decoded.ok) {
    showProblem(ctx, 'invalid');
    return;
  }
  const prepared = prepareGhost(ctx, decoded.replay, 'challenger');
  if (!prepared.ok) {
    showProblem(ctx, prepared.problem);
    return;
  }
  ctx.input.clear();
  ctx.screens.push(new PlayScreen(ctx, raceSetup(ctx, prepared.ghost)));
}

/** Starts a race against the replay in a file's text, a link or a bare code. */
export function openReplayText(ctx: GameContext, text: string): void {
  const code = extractReplayCode(text);
  if (code) openReplayCode(ctx, code);
  else showProblem(ctx, 'invalid');
}

function showProblem(ctx: GameContext, problem: GhostProblem): void {
  const { i18n, screens } = ctx;
  screens.push(
    new MessageBox(
      { viewport: ctx.viewport, fonts: ctx.fonts },
      {
        title: i18n.t('ghost.problem.title'),
        tone: 'failure',
        pages: [i18n.t(`ghost.problem.${problem}`)],
        labels: { next: i18n.t('menu.next'), ok: i18n.t('menu.ok') },
        onClose: () => screens.pop(),
      },
    ),
  );
}

/**
 * Copies the challenge link of `replay` to the clipboard; call from a gesture. `onCopied`
 * runs when it is there; when the browser refuses, the link is shown for copying by hand.
 */
export function copyChallengeLink(ctx: GameContext, replay: Replay, onCopied: () => void): void {
  const link = replayLink(location.href, encodeReplay(replay));
  void copyText(link).then((copied) => {
    if (copied) onCopied();
    else ctx.screens.push(new CopyLinkScreen(ctx, link));
  });
}

/** Offers the replay as a `.parapet-replay` file; call from a gesture. */
export function saveReplayFile(replay: Replay, result: { time: number; score: number }): void {
  const text = replayFileText(encodeReplay(replay), {
    level: replay.levelId + 1,
    mode: replay.mode,
    name: replay.playerName,
    time: result.time,
    score: result.score,
  });
  downloadText(replayFileName(replay.levelId, replay.mode, replay.playerName), text);
}

/** Opens the file dialog and races the chosen replay; call from a gesture. */
export function pickReplayFile(ctx: GameContext): void {
  pickFile(REPLAY_FILE_ACCEPT, (file) => {
    void readText(file).then((text) => {
      if (text === null) showProblem(ctx, 'invalid');
      else openReplayText(ctx, text);
    });
  });
}

/**
 * Replays dropped onto the window, pasted (Ctrl+V) or opened as a link in this tab start a
 * race from any menu; during a run they are ignored.
 */
export function installReplayInputs(ctx: GameContext): void {
  const accepting = (): boolean => !(ctx.screens.top instanceof PlayScreen);
  onFileDrop((file) => {
    if (!accepting()) return;
    void readText(file).then((text) => {
      if (text === null) showProblem(ctx, 'invalid');
      else openReplayText(ctx, text);
    });
  });
  onPasteText((text) => {
    if (accepting() && extractReplayCode(text)) openReplayText(ctx, text);
  });
  // A challenge link opened in a tab that already runs the game only changes the fragment.
  window.addEventListener('hashchange', () => {
    const code = takeReplayFromLocation();
    if (code && accepting()) openReplayCode(ctx, code);
  });
}

/** Reads `#r=<code>` from the page address, removing it so a reload does not start it again. */
export function takeReplayFromLocation(): string | null {
  const code = extractReplayCode(location.hash);
  if (code) history.replaceState(null, '', location.pathname + location.search);
  return code;
}
