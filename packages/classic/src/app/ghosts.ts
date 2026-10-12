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
  rankingSort,
  replayCompatibility,
  LEVEL_COUNT,
  RULESET_ID,
  runContentHash,
  SIM_VERSION,
  simulateReplay,
  type ContentHash,
  type Replay,
  type ReplayOutcome,
  type RunContent,
  type RunMode,
} from '@parapet/sim';
import type { GhostKind, GhostSetup, RunSetup } from '@parapet/runtime/app/RunSession.ts';
import {
  codeFromQuery,
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
import {
  loadContestRecord,
  loadRecord,
  type ContestKind,
  type RecordEntry,
} from '@parapet/runtime/storage/profile.ts';
import { MessageBox } from '@parapet/runtime/ui/MessageBox.ts';
import { formatTime, type GameContext } from './Context.ts';
import { contestCharacter, contestRecord, FIRST_BOSS_CHARACTER } from './bosses.ts';
import { CopyLinkScreen } from './screens/CopyLinkScreen.ts';
import { PlayScreen } from './screens/PlayScreen.ts';
import { countEvent } from './analytics.ts';
import { describeRace, keepOutOfSearch } from './racePage.ts';

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
    character: Math.max(0, Math.min(FIRST_BOSS_CHARACTER + 2 * LEVEL_COUNT - 1, entry.character)),
    playerName: cleanReplayName(entry.playerName || ctx.player.name),
    input: entry.input,
  };
}

/** The ghost of the local record of a mission, or null when there is none (or it is stale). */
export function bestGhost(ctx: GameContext, levelId: number, mode: RunMode): GhostSetup | null {
  return entryGhost(ctx, levelId, mode, loadRecord(levelId, mode));
}

function entryGhost(
  ctx: GameContext,
  levelId: number,
  mode: RunMode,
  record: RecordEntry | null,
): GhostSetup | null {
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

/**
 * A contest with the boss of a level, or null when this build has no record there.
 * With the record ghost option on, the player's own best contest run races along (their own
 * route; hers is never shown).
 */
export function contestSetup(
  ctx: GameContext,
  levelId: number,
  kind: ContestKind,
): RunSetup | null {
  const record = contestRecord(levelId, kind);
  if (!record) return null;
  // Development only: `?contestTime=<ms>` makes her time beatable, to try the winning screens.
  const devTime = import.meta.env.DEV
    ? Number(new URLSearchParams(location.search).get('contestTime') ?? NaN)
    : NaN;
  const timeMs = Number.isFinite(devTime) ? devTime : record.timeMs;
  const ghost = ctx.options.bestGhost
    ? entryGhost(ctx, levelId, kind, loadContestRecord(levelId, kind))
    : null;
  return {
    levelId,
    mode: kind,
    withRival: false,
    playerName: ctx.player.name,
    character: ctx.player.character,
    contest: {
      timeMs,
      splitsMs: record.splitsMs,
      character: contestCharacter(levelId, kind),
    },
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

/** What a replay's run is to beat: its time, its score, or that it never finished. */
export function replayResultText(ctx: GameContext, replay: Replay, outcome: ReplayOutcome): string {
  const { i18n } = ctx;
  if (rankingSort(replay.mode, replay.levelId) === 'score') {
    return i18n.t('replayOpen.score', { value: String(outcome.score) });
  }
  if (outcome.finished) return i18n.t('replayOpen.time', { value: formatTime(outcome.time) });
  return i18n.t('replayOpen.unfinished');
}

/** What a text holds: no replay at all, one that cannot run here, or one ready to race. */
export type ReplayCheck =
  | { kind: 'none' }
  | { kind: 'problem'; problem: GhostProblem }
  | { kind: 'ok'; code: string; ghost: GhostSetup };

/** Finds the replay in a file's text, a link or a bare code and re-runs it for its result. */
export function checkReplayText(ctx: GameContext, text: string): ReplayCheck {
  const code = extractReplayCode(text);
  if (!code) return { kind: 'none' };
  const decoded = decodeReplay(code);
  if (!decoded.ok) return { kind: 'problem', problem: 'invalid' };
  const prepared = prepareGhost(ctx, decoded.replay, 'challenger');
  if (!prepared.ok) return { kind: 'problem', problem: prepared.problem };
  return { kind: 'ok', code, ghost: prepared.ghost };
}

/** Starts the race against a checked replay. */
export function startRace(ctx: GameContext, ghost: GhostSetup): void {
  ctx.input.clear();
  countEvent('race/link');
  // A screen that only led here (the one for opening a replay) gives way to the race.
  while ((ctx.screens.top as { closesOnReplay?: boolean } | undefined)?.closesOnReplay) {
    ctx.screens.pop();
  }
  ctx.screens.push(new PlayScreen(ctx, raceSetup(ctx, ghost)));
}

/** Starts a race against the replay in a file's text, a link or a bare code, or says why not. */
export function openReplayText(ctx: GameContext, text: string): void {
  const check = checkReplayText(ctx, text);
  if (check.kind === 'ok') startRace(ctx, check.ghost);
  else showProblem(ctx, check.kind === 'problem' ? check.problem : 'invalid');
}

/**
 * Starts a race against the replay of the page's challenge link, which then describes that
 * race to search engines; or says why it cannot run, and keeps the page out of their index.
 */
export function openReplayCode(ctx: GameContext, code: string): void {
  const check = checkReplayText(ctx, code);
  if (check.kind === 'ok') {
    const { i18n } = ctx;
    const { replay, outcome } = check.ghost;
    const args = {
      name: runnerName(ctx, replay),
      level: i18n.t(`level.names.${replay.levelId}`),
      mode: i18n.t(`mode.${replay.mode}`),
      result: replayResultText(ctx, replay, outcome),
    };
    describeRace(
      check.code,
      i18n.t('race.page.title', args),
      i18n.t('race.page.description', args),
    );
    startRace(ctx, check.ghost);
    return;
  }
  keepOutOfSearch();
  showProblem(ctx, check.kind === 'problem' ? check.problem : 'invalid');
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
 * runs when it is there; when the browser refuses, the link is shown for copying by hand. A run
 * too long for a link is offered as a file instead.
 */
export function copyChallengeLink(ctx: GameContext, replay: Replay, onCopied: () => void): void {
  const link = replayLink(location.href, encodeReplay(replay));
  if (!link) {
    const { i18n, screens } = ctx;
    screens.push(
      new MessageBox(
        { viewport: ctx.viewport, fonts: ctx.fonts },
        {
          title: i18n.t('ghost.link.tooLong.title'),
          pages: [i18n.t('ghost.link.tooLong')],
          labels: { next: i18n.t('menu.next'), ok: i18n.t('menu.ok') },
          onClose: () => screens.pop(),
        },
      ),
    );
    return;
  }
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

/** Opens the file dialog and hands the chosen file's text on (null: unreadable); a gesture. */
export function pickReplayFile(onText: (text: string | null) => void): void {
  pickFile(REPLAY_FILE_ACCEPT, (file) => {
    void readText(file).then(onText);
  });
}

/** A screen that takes replays dropped or pasted while it is up, instead of racing them. */
interface ReplayTaker {
  takeReplayText?: (text: string) => void;
}

/**
 * Replays dropped onto the window or pasted (Ctrl+V) start a race from any menu; during a run
 * they are ignored. (A challenge link opens a page of its own: `takeReplayFromLocation`.)
 */
export function installReplayInputs(ctx: GameContext): void {
  const accepting = (): boolean => !(ctx.screens.top instanceof PlayScreen);
  const take = (text: string): void => {
    const taker = ctx.screens.top as ReplayTaker | undefined;
    if (taker?.takeReplayText) taker.takeReplayText(text);
    else openReplayText(ctx, text);
  };
  onFileDrop((file) => {
    if (!accepting()) return;
    void readText(file).then((text) => {
      if (text === null) showProblem(ctx, 'invalid');
      else take(text);
    });
  });
  onPasteText((text) => {
    if (accepting() && extractReplayCode(text)) take(text);
  });
}

/**
 * The replay of a challenge link (`r/?<code>`) from the page address. The address keeps it: it
 * is the race's own, to share again (a reload shows the race again).
 */
export function takeReplayFromLocation(): string | null {
  return codeFromQuery(location.search);
}
