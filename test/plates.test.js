import { describe, it, expect } from 'vitest';
import { derivePlateSet, combinePlatesSvg } from '../src/core/plates.js';

const band = (over = {}) => ({ enabled: true, color: '#ff0000', ...over });

describe('derivePlateSet', () => {
  it('returns one plate per enabled band in BAND_CONFIG order', () => {
    const params = {
      bands: { red: band(), orange: band({ enabled: false }), yellow: band() },
      spectrumRing: { enabled: false },
      spectrumDiff: { enabled: false },
    };
    const plates = derivePlateSet(params);
    expect(plates.map((p) => p.id)).toEqual(['red', 'yellow']);
    expect(plates.every((p) => p.kind === 'band')).toBe(true);
    expect(plates[0].filter).toBe('red');
  });

  it('appends ring/diff plates when enabled, with sentinel filters', () => {
    const params = { bands: { red: band() }, spectrumRing: { enabled: true }, spectrumDiff: { enabled: true } };
    const plates = derivePlateSet(params);
    expect(plates.map((p) => p.filter)).toEqual(['red', '__ring__', '__diff__']);
    expect(plates.map((p) => p.kind)).toEqual(['band', 'ring', 'diff']);
  });

  it('returns an empty set when nothing is enabled or params are missing', () => {
    expect(derivePlateSet({ bands: {}, spectrumRing: { enabled: false }, spectrumDiff: { enabled: false } })).toEqual([]);
    expect(derivePlateSet({})).toEqual([]);
    expect(derivePlateSet(null)).toEqual([]);
  });
});

describe('combinePlatesSvg', () => {
  it('wraps each plate in a labeled layer group sharing one viewBox', () => {
    const svg = combinePlatesSvg(800, 600, [
      { label: 'red', inner: '<circle/>' },
      { label: 'ring', inner: '<line/>' },
    ]);
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('xmlns:inkscape');
    expect(svg).toContain('inkscape:label="red"');
    expect(svg).toContain('inkscape:label="ring"');
    expect(svg).toContain('<circle/>');
    expect(svg).toContain('<line/>');
    expect((svg.match(/<g /g) || []).length).toBe(2);
  });

  it('escapes XML-significant characters in labels', () => {
    const svg = combinePlatesSvg(10, 10, [{ label: 'a&b"<', inner: '' }]);
    expect(svg).toContain('a&amp;b&quot;&lt;');
  });

  it('clamps degenerate dimensions to >= 1 and handles no plates', () => {
    const svg = combinePlatesSvg(0, 0, []);
    expect(svg).toContain('viewBox="0 0 1 1"');
    expect(svg).toContain('</svg>');
  });
});
