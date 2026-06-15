// Minimal, dependency-free i18n for user-facing copy.
//
// Japanese is the default locale; English is provided alongside. The active
// locale is resolved on load from, in order: the `?lang=` query string (an
// explicit shared link), a previously saved choice (localStorage), the
// browser's preferred languages (navigator.languages), then the default.
// Developer-facing strings (identifiers, comments, console/error messages) are
// not translated. Technical parameter names shown in the UI (Gain, Threshold,
// Frame Rate, ...) stay in English in both locales and are not keyed here.

import ja from './locales/ja.json';
import en from './locales/en.json';

const LOCALES = { ja, en };
const DEFAULT_LOCALE = 'ja';
const STORAGE_KEY = 'spectrum-chisel-lang';

/** @returns {string[]} Supported locale codes. */
export function supportedLocales() {
  return Object.keys(LOCALES);
}

function fromQuery() {
  if (typeof window === 'undefined' || !window.location) return null;
  const param = new URLSearchParams(window.location.search).get('lang');
  return param && LOCALES[param] ? param : null;
}

function fromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && LOCALES[saved] ? saved : null;
  } catch {
    return null; // localStorage may be unavailable (privacy mode, etc.).
  }
}

function fromBrowser() {
  if (typeof navigator === 'undefined') return null;
  const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const tag of prefs) {
    if (!tag) continue;
    const base = tag.toLowerCase().split('-')[0]; // "en-US" -> "en"
    if (LOCALES[base]) return base;
  }
  return null;
}

function detectLocale() {
  return fromQuery() || fromStorage() || fromBrowser() || DEFAULT_LOCALE;
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
 * Switch the active locale, persist the choice, and re-localize the page in
 * place (no reload, so the artwork on the canvas is preserved).
 * @param {string} locale
 */
export function switchLocale(locale) {
  if (!LOCALES[locale] || locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Persisting is best-effort; the in-memory switch still applies.
  }
  applyStaticTranslations();
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
 * Set an element's label and tag it so it re-localizes when the locale changes.
 * Use for labels whose key changes at runtime (e.g. a record button toggling
 * between "start" and "stop"), so a later locale switch shows the right text.
 * @param {Element|{elt: Element}|null} target  An element or a p5.Element.
 * @param {string} key
 */
export function applyLabel(target, key) {
  if (!target) return;
  const el = target instanceof Element ? target : target.elt;
  if (!el) return;
  el.setAttribute('data-i18n', key);
  el.textContent = t(key);
}

/**
 * Apply translations to every element carrying a `data-i18n` attribute, and
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
  // Elements whose visible label stays (e.g. an icon) but need a localized
  // accessible name / tooltip.
  root.querySelectorAll('[data-i18n-label]').forEach((el) => {
    const label = t(el.getAttribute('data-i18n-label'));
    el.setAttribute('aria-label', label);
    el.setAttribute('title', label);
  });
}
