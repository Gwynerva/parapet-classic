/**
 * How replays travel: as a link (`<site>/r/?<code>`: the game, with a link preview of its own),
 * as a file (`*.parapet-replay`, a small JSON document around the same code) or as pasted text
 * containing either. The code is the `encodeReplay` output; everything else in a file is there
 * for people reading it and is ignored on import, because the game re-runs the replay and
 * computes the result itself.
 *
 * The code is the whole query of the link: chats keep a query where some drop a fragment, and a
 * race page with an address of its own can be found by search engines. A query reaches the
 * server, so a link has a length limit (`MAX_LINK_LENGTH`, minutes of busy play); a longer run
 * travels as a file.
 */

export const REPLAY_FILE_FORMAT = 'parapet-classic-replay';
export const REPLAY_FILE_VERSION = 1;
export const REPLAY_FILE_EXTENSION = '.parapet-replay';
/** The file names a replay may come in. */
const REPLAY_FILE_NAMES = [REPLAY_FILE_EXTENSION, '.json', '.txt'];
/** What the file dialog offers. */
export const REPLAY_FILE_ACCEPT = [...REPLAY_FILE_NAMES, 'application/json'].join(',');

/** Whether a file may hold a replay, by its name (a pasted picture does not). */
export function mayBeReplayFile(name: string): boolean {
  const lower = name.toLowerCase();
  return REPLAY_FILE_NAMES.some((ext) => lower.endsWith(ext));
}

/** A challenge link: `…/r/?<code>`. */
const RACE_LINK = /\/r\/\?([A-Za-z0-9_-]{12,})/;
const BARE_CODE = /^[A-Za-z0-9_-]{12,}$/;

/**
 * The longest link offered, in characters: servers take about 8 KB of address, a Telegram
 * message 4096 characters.
 */
export const MAX_LINK_LENGTH = 4000;

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

/**
 * The link that opens a replay, made on the game's page at `pageUrl` (or its race page); null
 * when it would be longer than `MAX_LINK_LENGTH` (the run then travels as a file).
 */
export function replayLink(pageUrl: string, code: string): string | null {
  const folder = pageUrl.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
  const site = folder.endsWith(`/${RACE_FOLDER}`) ? folder.slice(0, -RACE_FOLDER.length) : folder;
  const link = `${site}${RACE_FOLDER}?${code}`;
  return link.length <= MAX_LINK_LENGTH ? link : null;
}

/**
 * The replay code of a page's query (`location.search`): its first `&`-separated part when
 * that is a bare code (apps may append parameters of their own). Null otherwise.
 */
export function codeFromQuery(search: string): string | null {
  const first = search.replace(/^\?/, '').split('&')[0] ?? '';
  return BARE_CODE.test(first) ? first : null;
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
  return BARE_CODE.test(trimmed) ? trimmed : null;
}
