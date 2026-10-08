/**
 * How replays travel: as a link (`<site>/race.html#r=<code>`: the game, with a link preview of
 * its own), as a file (`*.parapet-replay`, a small JSON document around the same code) or as
 * pasted text containing either. The code is the `encodeReplay` output; everything else in a
 * file is there for people reading it and is ignored on import, because the game re-runs the
 * replay and computes the result itself. The code rides in the fragment: it never reaches a
 * server and has no length limit. `?r=<code>` and links to the game's own page work too.
 */

export const REPLAY_FILE_FORMAT = 'parapet-classic-replay';
export const REPLAY_FILE_VERSION = 1;
export const REPLAY_FILE_EXTENSION = '.parapet-replay';
/** What the file dialog offers. */
export const REPLAY_FILE_ACCEPT = `${REPLAY_FILE_EXTENSION},application/json,.json,.txt`;

/** The link fragment key: `#r=<code>`. */
const LINK_PATTERN = /(?:^|[#&?])r=([A-Za-z0-9_-]+)/;
const BARE_CODE = /^[A-Za-z0-9_-]{16,}$/;

export interface ReplayFileInfo {
  level: number;
  mode: string;
  name: string;
  /** Finish time in ms, or the score, as the run ended (informational). */
  time?: number;
  score?: number;
}

/** The page challenge links open, next to the game's own (see `vite.config.ts`). */
export const RACE_PAGE = 'race.html';

/** The link that opens a replay, made on the game's page at `pageUrl`. */
export function replayLink(pageUrl: string, code: string): string {
  const folder = pageUrl.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  return `${folder}${RACE_PAGE}#r=${code}`;
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
  const link = LINK_PATTERN.exec(trimmed);
  if (link?.[1]) return link[1];
  return BARE_CODE.test(trimmed) ? trimmed : null;
}
