/**
 * Tiny ICU-style message formatter and locale switcher.
 *
 * Supported message syntax:
 *   `{name}`                                             interpolation
 *   `{n, plural, offset:1 =0 {none} one {# apple} other {# apples}}`
 *   `{x, select, a {..} b {..} other {..}}`
 *   `#` inside a plural branch is the (offset-adjusted) number, `''` is a literal apostrophe and
 *   `'{'`/`'}'`/`'#'` quote the special characters. Plural categories come from
 *   `Intl.PluralRules` with a built-in fallback for the East Slavic one/few/many/other rule and
 *   the English one/other rule.
 */

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type MessageParams = Record<string, string | number | boolean>;
/** Flat dictionary: dotted keys to patterns. */
export type Messages = Record<string, string>;
/** Nested dictionary as JSON authors may prefer to write it. */
export interface NestedMessages {
  [key: string]: string | NestedMessages;
}

type Node =
  | { type: 'text'; value: string }
  | { type: 'arg'; name: string }
  | { type: 'pound' }
  | { type: 'plural'; name: string; offset: number; options: Map<string, Node[]> }
  | { type: 'select'; name: string; options: Map<string, Node[]> };

class MessageParser {
  private readonly src: string;
  private pos = 0;

  constructor(src: string) {
    this.src = src;
  }

  parse(): Node[] {
    const nodes = this.parseMessage(false, false);
    if (this.pos < this.src.length) this.fail('unexpected }');
    return nodes;
  }

  private fail(message: string): never {
    throw new SyntaxError(`i18n: ${message} at ${this.pos} in "${this.src}"`);
  }

  private parseMessage(inPlural: boolean, nested: boolean): Node[] {
    const nodes: Node[] = [];
    let text = '';
    const flush = (): void => {
      if (text !== '') nodes.push({ type: 'text', value: text });
      text = '';
    };
    const src = this.src;
    while (this.pos < src.length) {
      const ch = src[this.pos] ?? '';
      if (ch === '}') {
        if (nested) break;
        this.fail('unexpected }');
      }
      if (ch === '{') {
        flush();
        nodes.push(this.parseArgument(inPlural));
        continue;
      }
      if (ch === '#' && inPlural) {
        flush();
        nodes.push({ type: 'pound' });
        this.pos++;
        continue;
      }
      if (ch === "'") {
        const next = src[this.pos + 1];
        if (next === "'") {
          text += "'";
          this.pos += 2;
          continue;
        }
        if (next === '{' || next === '}' || (next === '#' && inPlural)) {
          // Quoted literal up to the closing apostrophe ('' inside stays an apostrophe).
          this.pos++;
          while (this.pos < src.length) {
            const c = src[this.pos] ?? '';
            if (c === "'") {
              if (src[this.pos + 1] === "'") {
                text += "'";
                this.pos += 2;
                continue;
              }
              this.pos++;
              break;
            }
            text += c;
            this.pos++;
          }
          continue;
        }
        text += "'";
        this.pos++;
        continue;
      }
      text += ch;
      this.pos++;
    }
    flush();
    return nodes;
  }

  private readUntil(stops: string): string {
    const start = this.pos;
    while (this.pos < this.src.length && !stops.includes(this.src[this.pos] ?? '')) this.pos++;
    return this.src.slice(start, this.pos);
  }

  private skipSpace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos] ?? '')) this.pos++;
  }

  private parseArgument(inPlural: boolean): Node {
    this.pos++; // '{'
    const name = this.readUntil(',}').trim();
    if (name === '') this.fail('empty argument name');
    if (this.src[this.pos] === '}') {
      this.pos++;
      return { type: 'arg', name };
    }
    if (this.pos >= this.src.length) this.fail('unterminated argument');
    this.pos++; // ','
    const kind = this.readUntil(',}').trim();
    if (this.src[this.pos] === '}') {
      // `{n, number}` and friends: plain interpolation.
      this.pos++;
      return { type: 'arg', name };
    }
    if (this.pos >= this.src.length) this.fail('unterminated argument');
    this.pos++; // ','
    if (kind === 'plural' || kind === 'selectordinal') {
      const { offset, options } = this.parseOptions(true);
      return { type: 'plural', name, offset, options };
    }
    if (kind === 'select') {
      const { options } = this.parseOptions(inPlural);
      return { type: 'select', name, options };
    }
    this.fail(`unknown argument type "${kind}"`);
  }

  private parseOptions(inPlural: boolean): { offset: number; options: Map<string, Node[]> } {
    const options = new Map<string, Node[]>();
    let offset = 0;
    for (;;) {
      this.skipSpace();
      if (this.pos >= this.src.length) this.fail('unterminated options');
      if (this.src[this.pos] === '}') {
        this.pos++;
        break;
      }
      let selector = this.readUntil('{} \t\r\n');
      if (selector === '') this.fail('expected a selector');
      if (selector.startsWith('offset:')) {
        let value = selector.slice('offset:'.length);
        if (value === '') {
          this.skipSpace();
          value = this.readUntil('{} \t\r\n');
        }
        offset = Number.parseInt(value, 10);
        if (!Number.isFinite(offset)) this.fail('bad offset');
        continue;
      }
      this.skipSpace();
      if (this.src[this.pos] !== '{') this.fail(`expected { after "${selector}"`);
      this.pos++;
      const body = this.parseMessage(inPlural, true);
      if (this.src[this.pos] !== '}') this.fail('unterminated option');
      this.pos++;
      if (selector.startsWith('=')) selector = '=' + String(Number(selector.slice(1)));
      options.set(selector, body);
    }
    if (!options.has('other')) this.fail('missing "other" option');
    return { offset, options };
  }
}

const astCache = new Map<string, Node[]>();

function parsePattern(pattern: string): Node[] {
  let nodes = astCache.get(pattern);
  if (!nodes) {
    nodes = new MessageParser(pattern).parse();
    astCache.set(pattern, nodes);
  }
  return nodes;
}

/** Plain digits for integers; the game draws numbers with bitmap fonts and has no separators. */
export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function languageOf(locale: string): string {
  return locale.toLowerCase().split(/[-_]/)[0] ?? locale.toLowerCase();
}

/** Built-in plural rules used when `Intl.PluralRules` is unavailable. */
export function fallbackPluralCategory(locale: string, n: number): PluralCategory {
  if (!Number.isFinite(n) || !Number.isInteger(n)) return 'other';
  const abs = Math.abs(n);
  switch (languageOf(locale)) {
    case 'ru':
    case 'uk':
    case 'be': {
      const mod10 = abs % 10;
      const mod100 = abs % 100;
      if (mod10 === 1 && mod100 !== 11) return 'one';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
      return 'many';
    }
    default:
      return abs === 1 ? 'one' : 'other';
  }
}

const pluralRules = new Map<string, Intl.PluralRules | null>();

function rulesFor(locale: string): Intl.PluralRules | null {
  let rules = pluralRules.get(locale);
  if (rules === undefined) {
    rules = null;
    try {
      if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
        rules = new Intl.PluralRules(locale);
      }
    } catch {
      rules = null;
    }
    pluralRules.set(locale, rules);
  }
  return rules;
}

/** Plural category of `n` in `locale` (`Intl.PluralRules`, then the built-in fallback). */
export function pluralCategory(locale: string, n: number): PluralCategory {
  const rules = rulesFor(locale);
  if (rules) {
    try {
      return rules.select(n) as PluralCategory;
    } catch {
      // fall through to the built-in rules
    }
  }
  return fallbackPluralCategory(locale, n);
}

function formatNodes(
  nodes: readonly Node[],
  params: MessageParams,
  locale: string,
  pound: number | null,
): string {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out += node.value;
        break;
      case 'pound':
        out += pound === null ? '#' : formatNumber(pound);
        break;
      case 'arg': {
        const value = params[node.name];
        if (value === undefined) out += `{${node.name}}`;
        else out += typeof value === 'number' ? formatNumber(value) : String(value);
        break;
      }
      case 'plural': {
        const raw = params[node.name];
        const value = typeof raw === 'number' ? raw : Number(raw);
        let branch: Node[] | undefined;
        let adjusted = pound;
        if (Number.isFinite(value)) {
          adjusted = value - node.offset;
          branch =
            node.options.get('=' + String(value)) ??
            node.options.get(pluralCategory(locale, adjusted));
        }
        branch ??= node.options.get('other') ?? [];
        out += formatNodes(branch, params, locale, adjusted);
        break;
      }
      case 'select': {
        const raw = params[node.name];
        const key = raw === undefined ? 'other' : String(raw);
        const branch = node.options.get(key) ?? node.options.get('other') ?? [];
        out += formatNodes(branch, params, locale, pound);
        break;
      }
    }
  }
  return out;
}

/** Formats one pattern; throws `SyntaxError` on a malformed pattern. */
export function formatMessage(pattern: string, params: MessageParams = {}, locale = 'en'): string {
  return formatNodes(parsePattern(pattern), params, locale, null);
}

/** Turns nested dictionaries into dotted keys; flat dictionaries pass through unchanged. */
export function flattenMessages(messages: Messages | NestedMessages, prefix = ''): Messages {
  const out: Messages = {};
  for (const [key, value] of Object.entries(messages)) {
    const full = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') out[full] = value;
    else if (value && typeof value === 'object') Object.assign(out, flattenMessages(value, full));
  }
  return out;
}

/** Picks the best available locale for a list of preferred language tags. */
export function resolveLocale(
  available: readonly string[],
  preferred: readonly string[],
): string | undefined {
  for (const tag of preferred) {
    const lower = tag.toLowerCase();
    const exact = available.find((a) => a.toLowerCase() === lower);
    if (exact) return exact;
    const language = languageOf(lower);
    const partial = available.find((a) => languageOf(a) === language);
    if (partial) return partial;
  }
  return undefined;
}

/** The browser's preferred locale among `available`, or `fallback`. */
export function detectLocale(available: readonly string[], fallback = 'en'): string {
  const preferred: string[] = [];
  if (typeof navigator !== 'undefined') {
    if (Array.isArray(navigator.languages)) preferred.push(...navigator.languages);
    else if (typeof navigator.language === 'string') preferred.push(navigator.language);
  }
  return resolveLocale(available, preferred) ?? fallback;
}

export interface I18nOptions {
  locale?: string;
  /** Locale whose texts fill in keys missing from the current one (default 'en'). */
  fallbackLocale?: string;
}

export type LocaleListener = (locale: string) => void;

export class I18n {
  private readonly dictionaries = new Map<string, Messages>();
  private current: string;
  private readonly fallbackLocale: string;
  private readonly listeners = new Set<LocaleListener>();
  private readonly warned = new Set<string>();

  constructor(dictionaries: Record<string, Messages | NestedMessages>, opts: I18nOptions = {}) {
    for (const [locale, messages] of Object.entries(dictionaries)) {
      this.dictionaries.set(locale, flattenMessages(messages));
    }
    const available = this.availableLocales;
    if (available.length === 0) throw new Error('I18n: no dictionaries');
    const first = available[0] ?? 'en';
    this.fallbackLocale =
      resolveLocale(available, [opts.fallbackLocale ?? 'en']) ?? (first as string);
    this.current =
      (opts.locale !== undefined ? resolveLocale(available, [opts.locale]) : undefined) ??
      this.fallbackLocale;
  }

  get locale(): string {
    return this.current;
  }

  get availableLocales(): string[] {
    return [...this.dictionaries.keys()];
  }

  /** Switches locale ('ru-RU' resolves to 'ru'); returns false and keeps the old one if unknown. */
  setLocale(locale: string): boolean {
    const resolved = resolveLocale(this.availableLocales, [locale]);
    if (resolved === undefined) return false;
    if (resolved !== this.current) {
      this.current = resolved;
      for (const listener of this.listeners) listener(resolved);
    }
    return true;
  }

  onChange(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  has(key: string): boolean {
    return this.dictionaries.get(this.current)?.[key] !== undefined;
  }

  /** The pattern for `key` in the current locale, then the fallback locale, else undefined. */
  pattern(key: string): string | undefined {
    return (
      this.dictionaries.get(this.current)?.[key] ??
      this.dictionaries.get(this.fallbackLocale)?.[key]
    );
  }

  /** Formats the message `key`; an unknown key yields the key itself. */
  t(key: string, params?: MessageParams): string {
    const pattern = this.pattern(key);
    if (pattern === undefined) return key;
    return this.format(pattern, params);
  }

  /** Formats a raw pattern in the current locale; a malformed pattern is returned verbatim. */
  format(pattern: string, params: MessageParams = {}): string {
    try {
      return formatMessage(pattern, params, this.current);
    } catch (error) {
      if (!this.warned.has(pattern)) {
        this.warned.add(pattern);
        console.warn(error instanceof Error ? error.message : String(error));
      }
      return pattern;
    }
  }
}
