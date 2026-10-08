/**
 * How replays travel: as a link (`<site>/r/#<code>`: the game, with a link preview of its own),
 * as a file (`*.parapet-replay`, a small JSON document around the same code) or as pasted text
 * containing either. The code is the `encodeReplay` output; everything else in a file is there
 * for people reading it and is ignored on import, because the game re-runs the replay and
 * computes the result itself. The code rides in the fragment: it never reaches a server and has
 * no length limit. The game's own page takes `#r=<code>` and `?r=<code>` too (older links).
 */

export const REPLAY_FILE_FORMAT = 'parapet-classic-replay';
export const REPLAY_FILE_VERSION = 1;
export const REPLAY_FILE_EXTENSION = '.parapet-replay';
/** What the file dialog offers. */
export const REPLAY_FILE_ACCEPT = `${REPLAY_FILE_EXTENSION},application/json,.json,.txt`;

/** A challenge link: `…/r/#<code>`. */
const RACE_LINK = /\/r\/#([A-Za-z0-9_-]{12,})/;
/** The older form and the query: `#r=<code>`, `?r=<code>`. */
const LINK_PATTERN = /(?:^|[#&?])r=([A-Za-z0-9_-]+)/;
const BARE_CODE = /^[A-Za-z0-9_-]{12,}$/;

export interface ReplayFileInfo {
  level: number;
  mode: string;
  name: string;
  /** Finish time in ms, or the score, as the run ended (informational). */
  time?: number;
  score?: number;
}

/** The folder challenge links open, under the game's own (see `vite.config.ts`). */
export const RACE_FOLDER = 'r/';

/** The link that opens a replay, made on the game's page at `pageUrl` (or its race page). */
export function replayLink(pageUrl: string, code: string): string {
  const folder = pageUrl.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  const site = folder.endsWith(`/${RACE_FOLDER}`) ? folder.slice(0, -RACE_FOLDER.length) : folder;
  return `${site}${RACE_FOLDER}#${code}`;
}

/** The contents of a replay file. */
export function replayFileText(code: string, info: ReplayFileInfo): string {
  return `${JSON.stringify(
    { format: REPLAY_FILE_FORMAT, version: REPLAY_FILE_VERSION, ...info, code },
    null,
    2,
  )}\n`;
}

/** A file name such as `parapet-l3-sprint-blaise.parapet-replay`. */
export function replayFileName(levelId: number, mode: string, name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return `parapet-l${levelId + 1}-${mode}${slug ? `-${slug}` : ''}${REPLAY_FILE_EXTENSION}`;
}

/**
 * Finds a replay code in a file's contents, a link or a bare code; null when there is none.
 * Says nothing about whether the code decodes.
 */
export function extractReplayCode(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const doc = JSON.parse(trimmed) as { format?: unknown; code?: unknown };
      if (doc.format === REPLAY_FILE_FORMAT && typeof doc.code === 'string') {
        return BARE_CODE.test(doc.code) ? doc.code : null;
      }
    } catch {
      // not JSON after all
    }
    return null;
  }
  const race = RACE_LINK.exec(trimmed);
  if (race?.[1]) return race[1];
  const link = LINK_PATTERN.exec(trimmed);
  if (link?.[1]) return link[1];
  return BARE_CODE.test(trimmed) ? trimmed : null;
}
