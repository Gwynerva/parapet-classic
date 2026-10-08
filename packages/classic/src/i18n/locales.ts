/**
 * The bundled languages (`packages/content/i18n/<code>/*.json`, found by the build)
 * and the I18n the app uses.
 */
import { I18n, detectLocale, resolveLocale, type Messages } from '@parapet/runtime/i18n/i18n.ts';
import {
  collectLocales,
  REFERENCE_LOCALE,
  type LocaleBundle,
} from '@parapet/runtime/i18n/locales.ts';

const files = import.meta.glob('@content/i18n/*/*.json', { eager: true, import: 'default' });

export const LOCALES: readonly LocaleBundle[] = collectLocales(files);

export const DEFAULT_LOCALE = REFERENCE_LOCALE;

export const DICTIONARIES: Record<string, Messages> = Object.fromEntries(
  LOCALES.map((l) => [l.code, l.messages]),
);

export const AVAILABLE_LOCALES: readonly string[] = LOCALES.map((l) => l.code);

/** The language's name in itself, for the options. */
export function localeName(code: string): string {
  return LOCALES.find((l) => l.code === code)?.meta.name ?? code;
}

/**
 * The language to start in: the stored choice when it is still bundled, otherwise (first
 * launch, or a language that is gone) the browser's preference. `detected` tells the caller
 * to store the result, so the choice is made once and then stays.
 */
export function startLocale(stored: string): { locale: string; detected: boolean } {
  const kept = stored === '' ? undefined : resolveLocale(AVAILABLE_LOCALES, [stored]);
  if (kept !== undefined && kept === stored) return { locale: kept, detected: false };
  return { locale: kept ?? detectLocale(AVAILABLE_LOCALES, DEFAULT_LOCALE), detected: true };
}

export function createI18n(locale: string): I18n {
  return new I18n(DICTIONARIES, { locale, fallbackLocale: DEFAULT_LOCALE });
}
