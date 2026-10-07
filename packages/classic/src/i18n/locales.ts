/** The bundled dictionaries (`packages/content-classic/i18n`) and the I18n factory the app uses. */
import en from '../../../content-classic/i18n/en.json';
import ru from '../../../content-classic/i18n/ru.json';
import { I18n, detectLocale, type Messages } from '@parapet/runtime/i18n/i18n.ts';

export const DEFAULT_LOCALE = 'en';

export const DICTIONARIES: Record<string, Messages> = { en, ru };

export const AVAILABLE_LOCALES: readonly string[] = Object.keys(DICTIONARIES);

/** Creates the app's I18n; 'auto' follows the browser's language preference. */
export function createI18n(locale: string = 'auto'): I18n {
  const initial = locale === 'auto' ? detectLocale(AVAILABLE_LOCALES, DEFAULT_LOCALE) : locale;
  return new I18n(DICTIONARIES, { locale: initial, fallbackLocale: DEFAULT_LOCALE });
}
