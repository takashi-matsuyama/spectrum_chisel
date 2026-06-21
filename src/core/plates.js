/**
 * Color-plate separation for printmaking export (pure, p5-independent).
 *
 * A "plate" is one band's marks (or a global layer) rendered alone, mirroring
 * multi-color relief / screen printmaking where each color is its own plate or
 * screen. The 7-band rainbow makes band == plate a natural correspondence.
 *
 * derivePlateSet() decides which plates exist and their render-time band filter;
 * combinePlatesSvg() assembles the per-plate SVG fragments into a single
 * document with one labeled <g> layer per plate. Both are pure so the plate set
 * and the assembled markup are deterministic and unit-testable; the actual p5
 * rendering of each plate lives in the shell (export.js).
 *
 * @typedef {Object} PlateDescriptor
 * @property {string} id      Stable plate id (band name, or 'ring'/'diff').
 * @property {string} label   Human/layer label.
 * @property {'band'|'ring'|'diff'} kind
 * @property {string} filter  bandFilter value passed to renderFrame: a band
 *   name, or the '__ring__' / '__diff__' sentinels for the global layers.
 */

import { BAND_CONFIG } from './bands.js';

/**
 * Ordered plate descriptors for the enabled content of a render-params snapshot:
 * one per enabled band (in BAND_CONFIG order), then the ring and diff global
 * layers if enabled. Empty when nothing is enabled. Pure.
 * @param {any} params  collectRenderParams() snapshot.
 * @returns {PlateDescriptor[]}
 */
export function derivePlateSet(params) {
  /** @type {PlateDescriptor[]} */
  const plates = [];
  if (params && params.bands) {
    for (const band of BAND_CONFIG) {
      const bp = params.bands[band.name];
      if (bp && bp.enabled) plates.push({ id: band.name, label: band.name, kind: 'band', filter: band.name });
    }
  }
  if (params && params.spectrumRing && params.spectrumRing.enabled) {
    plates.push({ id: 'ring', label: 'ring', kind: 'ring', filter: '__ring__' });
  }
  if (params && params.spectrumDiff && params.spectrumDiff.enabled) {
    plates.push({ id: 'diff', label: 'diff', kind: 'diff', filter: '__diff__' });
  }
  return plates;
}

/** Escape XML-significant characters for use inside a double-quoted attribute. */
function escapeXmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Assemble per-plate SVG fragments into one document, each wrapped in an
 * Inkscape-style layer group. All plates share the same width/height/viewBox so
 * they register exactly when overlaid (each was drawn in the same coordinate
 * space). Pure string building.
 * @param {number} width
 * @param {number} height
 * @param {{label: string, inner: string}[]} plates  Per-plate inner SVG markup.
 * @returns {string} A complete <svg> document string.
 */
export function combinePlatesSvg(width, height, plates) {
  const w = Math.max(1, Math.round(width || 0));
  const h = Math.max(1, Math.round(height || 0));
  const groups = (plates || [])
    .map(
      (p) =>
        `<g inkscape:groupmode="layer" inkscape:label="${escapeXmlAttr(p.label)}" id="plate-${escapeXmlAttr(
          p.label
        )}">${p.inner || ''}</g>`
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${groups}</svg>`;
}
