// Minimal, dependency-free i18n for user-facing copy.
//
// Japanese is the default locale; English is provided alongside and selectable
// with the `?lang=en` query string. Developer-facing strings (identifiers,
// comments, console/error messages) are not translated. Technical parameter
// names shown in the UI (Gain, Threshold, Frame Rate, ...) stay in English in
// both locales and are intentionally not keyed here.

import ja from './locales/ja.json';
import en from './locales/en.json';

const LOCALES = { ja, en };
const DEFAULT_LOCALE = 'ja';

function detectLocale() {
  if (typeof window !== 'undefined' && window.location) {
    const param = new URLSearchParams(window.location.search).get('lang');
    if (param && LOCALES[param]) return param;
  }
  return DEFAULT_LOCALE;
}

let current = detectLocale();

/** @returns {string} The active locale code. */
export function getLocale() {
  return current;
}

/** @param {string} locale */
export function setLocale(locale) {
  if (LOCALES[locale]) current = locale;
}

/**
 * Translate a key. Falls back to the default locale and then to the key itself.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  return LOCALES[current]?.[key] ?? LOCALES[DEFAULT_LOCALE]?.[key] ?? key;
}

/**
 * Apply translations to static elements carrying a `data-i18n` attribute, and
 * sync the document language so assistive tech and translation tools see the
 * active locale.
 * @param {ParentNode} [root]
 */
export function applyStaticTranslations(root = document) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = current;
  }
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
}
