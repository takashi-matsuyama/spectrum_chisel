import { describe, it, expect } from 'vitest';
import {
  PATTERN_SPEC_VERSION,
  MAX_LAYERS,
  MAX_INSTANCES,
  MAX_MODULATIONS,
  MAX_MOTIONS,
  MOTIONS,
  MOD_SOURCES,
  CURVES,
  isValidPatternSpec,
  normalizePatternSpec,
  isSupportedSpecVersion,
  seededUnit,
  animatedJitter,
  evalCurve,
  evalModulation,
  resolveInstances,
  expandMotions,
  instanceCount,
  patternId,
  addPattern,
  findPattern,
  removePattern,
  resolveLibraryClosure,
  parseLibrary,
  STARTER_PATTERNS,
} from '../src/core/pattern.js';

/** A minimal valid raw layer for building specs in tests. */
const layer = (over = {}) => ({
  primitive: { type: 'polygon', size: 10, sides: 3 },
  generator: { type: 'radial', count: 4, radius: 100, phase: 0 },
  rotation: 0,
  scale: 1,
  modulations: [],
  ...over,
});

const baseSources = { energy: 0, time: 0, index: 0, constant: 1 };

describe('isValidPatternSpec', () => {
  it('accepts a structurally sound spec', () => {
    expect(isValidPatternSpec({ specVersion: '1.0.0', seed: 0, layers: [layer()] })).toBe(true);
  });
  it('rejects non-objects and missing/!array layers', () => {
    expect(isValidPatternSpec(null)).toBe(false);
    expect(isValidPatternSpec({ specVersion: '1.0.0' })).toBe(false);
    expect(isValidPatternSpec({ specVersion: '1.0.0', layers: {} })).toBe(false);
  });
  it('rejects a non-string specVersion', () => {
    expect(isValidPatternSpec({ specVersion: 1, layers: [] })).toBe(false);
  });
  it('rejects a layer without primitive/generator', () => {
    expect(isValidPatternSpec({ specVersion: '1.0.0', layers: [{ primitive: {} }] })).toBe(false);
  });
});

describe('normalizePatternSpec', () => {
  it('fills defaults for an empty input without throwing', () => {
    const n = normalizePatternSpec(undefined);
    expect(n.specVersion).toBe(PATTERN_SPEC_VERSION);
    expect(n.seed).toBe(0);
    expect(n.layers).toEqual([]);
  });

  it('clamps counts, sizes, sides and coerces bad numbers', () => {
    const n = normalizePatternSpec({
      layers: [
        {
          primitive: { type: 'polygon', size: -5, sides: 999 },
          generator: { type: 'radial', count: 100000, radius: 'x', phase: NaN },
          rotation: Infinity,
          scale: 0,
          modulations: [],
        },
      ],
    });
    const l = n.layers[0];
    expect(l.primitive.size).toBe(0);
    expect(l.primitive.sides).toBe(24);
    expect(l.generator.count).toBe(MAX_INSTANCES);
    expect(l.generator.radius).toBe(0);
    expect(l.generator.phase).toBe(0);
    expect(Number.isFinite(l.rotation)).toBe(true);
    expect(l.scale).toBe(0.01);
  });

  it('drops unknown enum values gracefully (forward-compat)', () => {
    const n = normalizePatternSpec({
      layers: [
        {
          primitive: { type: 'hyperbola', size: 10, sides: 3 },
          generator: { type: 'spiral', count: 2, radius: 10, phase: 0 },
          modulations: [
            { source: 'energy', target: 'radius', curve: 'linear', gain: 1 },
            { source: 'bogus', target: 'radius', curve: 'linear', gain: 1 },
            { source: 'energy', target: 'unknownTarget', curve: 'linear', gain: 1 },
            { source: 'energy', target: 'radius', curve: 'wat', gain: 1 },
          ],
        },
      ],
    });
    const l = n.layers[0];
    expect(l.primitive.type).toBe('point'); // unknown -> default
    expect(l.generator.type).toBe('single'); // unknown -> default
    expect(l.modulations).toHaveLength(2); // two bad-enum mods dropped
    expect(l.modulations[1].curve).toBe('linear'); // unknown curve -> linear
  });

  it('caps layers and modulations to budget', () => {
    const many = Array.from({ length: MAX_LAYERS + 5 }, () => layer());
    const manyMods = Array.from({ length: MAX_MODULATIONS + 10 }, () => ({
      source: 'energy',
      target: 'radius',
      curve: 'linear',
      gain: 1,
    }));
    const n = normalizePatternSpec({ layers: [...many, layer({ modulations: manyMods })] });
    expect(n.layers).toHaveLength(MAX_LAYERS);
    expect(n.layers.every((l) => l.modulations.length <= MAX_MODULATIONS)).toBe(true);
  });

  it('preserves the layer count without padding (1 stays 1, 3 stays 3)', () => {
    // The layer-stack editor serializes only the layers the user actually has;
    // normalize must never pad empty slots, or every single-layer pattern's
    // content id would change.
    expect(normalizePatternSpec({ layers: [layer()] }).layers).toHaveLength(1);
    expect(normalizePatternSpec({ layers: [layer(), layer(), layer()] }).layers).toHaveLength(3);
  });

  it('is idempotent', () => {
    const raw = { layers: [layer({ modulations: [{ source: 'energy', target: 'size', curve: 'sqrt', gain: 3 }] })] };
    const once = normalizePatternSpec(raw);
    const twice = normalizePatternSpec(once);
    expect(twice).toEqual(once);
  });
});

describe('isSupportedSpecVersion', () => {
  it('supports same or lower major, rejects a future major', () => {
    expect(isSupportedSpecVersion({ specVersion: '1.0.0' })).toBe(true);
    expect(isSupportedSpecVersion({ specVersion: '1.9.9' })).toBe(true);
    expect(isSupportedSpecVersion({ specVersion: '2.0.0' })).toBe(false);
  });
});

describe('seededUnit', () => {
  it('is deterministic for identical inputs', () => {
    expect(seededUnit(1, 2, 3, 4)).toBe(seededUnit(1, 2, 3, 4));
  });
  it('stays within [-1, 1] and varies with inputs', () => {
    const a = seededUnit(1, 0, 0);
    const b = seededUnit(1, 0, 1);
    expect(a).toBeGreaterThanOrEqual(-1);
    expect(a).toBeLessThanOrEqual(1);
    expect(a).not.toBe(b);
  });
});

describe('evalCurve', () => {
  it('maps known points', () => {
    expect(evalCurve('linear', 0.5)).toBe(0.5);
    expect(evalCurve('square', 0.5)).toBe(0.25);
    expect(evalCurve('sqrt', 0.25)).toBe(0.5);
    expect(evalCurve('smoothstep', 0)).toBe(0);
    expect(evalCurve('smoothstep', 1)).toBe(1);
    expect(evalCurve('smoothstep', 0.5)).toBe(0.5);
    expect(evalCurve('sin', 0)).toBe(0);
    expect(evalCurve('unknown', 0.7)).toBe(0.7); // defaults to linear
  });
});

describe('evalModulation', () => {
  it('accumulates only matching targets, additively', () => {
    const mods = [
      { source: 'energy', target: 'radius', curve: 'linear', gain: 50 },
      { source: 'constant', target: 'radius', curve: 'linear', gain: 5 },
      { source: 'energy', target: 'size', curve: 'linear', gain: 999 },
    ];
    const sources = { ...baseSources, energy: 0.5 };
    // base 100 + 50*0.5 + 5*1 = 130; the 'size' mod is ignored for target 'radius'.
    expect(evalModulation(mods, 'radius', 100, sources)).toBe(130);
  });
});

describe('resolveInstances', () => {
  it('places radial instances on a circle and is deterministic', () => {
    const r1 = resolveInstances(normalizePatternSpec({ layers: [layer()] }).layers[0], baseSources);
    const r2 = resolveInstances(normalizePatternSpec({ layers: [layer()] }).layers[0], baseSources);
    expect(r1).toEqual(r2);
    expect(r1.instances).toHaveLength(4);
    expect(r1.instances[0].x).toBeCloseTo(100, 6);
    expect(r1.instances[0].y).toBeCloseTo(0, 6);
    expect(r1.instances[1].x).toBeCloseTo(0, 6);
    expect(r1.instances[1].y).toBeCloseTo(100, 6);
    expect(r1.instances[2].x).toBeCloseTo(-100, 6);
  });

  it('a single generator yields exactly one instance at the origin', () => {
    const l = normalizePatternSpec({ layers: [layer({ generator: { type: 'single', count: 9, radius: 100, phase: 0 } })] }).layers[0];
    const r = resolveInstances(l, baseSources);
    expect(r.instances).toHaveLength(1);
    expect(r.instances[0].x).toBe(0);
    expect(r.instances[0].y).toBe(0);
  });

  it('modulates count by energy and clamps to >= 1', () => {
    const l = normalizePatternSpec({
      layers: [layer({ generator: { type: 'radial', count: 2, radius: 50, phase: 0 }, modulations: [{ source: 'energy', target: 'count', curve: 'linear', gain: 10 }] })],
    }).layers[0];
    expect(resolveInstances(l, { ...baseSources, energy: 1 }).instances).toHaveLength(12);
    expect(resolveInstances(l, { ...baseSources, energy: 0 }).instances).toHaveLength(2);
  });

  it('normalizes the index source across instances', () => {
    // size = base 0 + 100*index, so first instance has size 0 and last has size 100.
    const l = normalizePatternSpec({
      layers: [layer({ primitive: { type: 'ring', size: 0, sides: 3 }, generator: { type: 'radial', count: 5, radius: 0, phase: 0 }, modulations: [{ source: 'index', target: 'size', curve: 'linear', gain: 100 }] })],
    }).layers[0];
    const r = resolveInstances(l, baseSources);
    expect(r.instances[0].size).toBeCloseTo(0, 6);
    expect(r.instances[4].size).toBeCloseTo(100, 6);
  });
});

describe('instanceCount', () => {
  it('sums resolved instances across layers', () => {
    const spec = normalizePatternSpec({ layers: [layer(), layer({ generator: { type: 'single', count: 1, radius: 0, phase: 0 } })] });
    expect(instanceCount(spec, baseSources)).toBe(4 + 1);
  });
});

describe('patternId + library helpers', () => {
  it('gives identical specs the same id, different specs different ids', () => {
    const a = { specVersion: '1.0.0', seed: 0, layers: [layer()] };
    const b = { specVersion: '1.0.0', seed: 0, layers: [layer()] };
    const c = { specVersion: '1.0.0', seed: 0, layers: [layer({ rotation: 0.1 })] };
    expect(patternId(a)).toBe(patternId(b));
    expect(patternId(a)).not.toBe(patternId(c));
  });

  it('add/find/remove round-trips by content id', () => {
    const { library, id } = addPattern({}, { specVersion: '1.0.0', seed: 0, layers: [layer()] });
    expect(findPattern(library, id)).not.toBeNull();
    // Adding the same spec again is idempotent (same id, same single entry).
    const again = addPattern(library, { specVersion: '1.0.0', seed: 0, layers: [layer()] });
    expect(again.id).toBe(id);
    expect(Object.keys(again.library)).toHaveLength(1);
    expect(Object.keys(removePattern(library, id))).toHaveLength(0);
  });

  it('resolveLibraryClosure emits only referenced patterns', () => {
    const { library: l1, id: id1 } = addPattern({}, { specVersion: '1.0.0', seed: 1, layers: [layer()] });
    const { library: l2, id: id2 } = addPattern(l1, { specVersion: '1.0.0', seed: 2, layers: [layer()] });
    const closure = resolveLibraryClosure(l2, [id1]);
    expect(Object.keys(closure)).toEqual([id1]);
    expect(closure[id2]).toBeUndefined();
  });

  it('parseLibrary accepts both envelope and bare maps, dropping invalid specs', () => {
    const { library, id } = addPattern({}, { specVersion: '1.0.0', seed: 0, layers: [layer()] });
    expect(Object.keys(parseLibrary({ version: '1.0.0', patterns: library }))).toEqual([id]);
    expect(Object.keys(parseLibrary(library))).toEqual([id]);
    expect(parseLibrary({ patterns: { bad: { nope: true } } })).toEqual({});
  });
});

describe('STARTER_PATTERNS', () => {
  it('are all valid and normalize without change', () => {
    for (const { spec } of STARTER_PATTERNS) {
      expect(isValidPatternSpec(spec)).toBe(true);
      expect(normalizePatternSpec(spec)).toEqual(normalizePatternSpec(normalizePatternSpec(spec)));
    }
  });
});

describe('2c expressive set', () => {
  it('normalize keeps the new primitives, generator, sources and targets', () => {
    const n = normalizePatternSpec({
      layers: [
        {
          primitive: { type: 'star', size: 20, sides: 5 },
          generator: { type: 'grid', count: 3, radius: 100, phase: 0 },
          modulations: [
            { source: 'jitter', target: 'size', curve: 'linear', gain: 10 },
            { source: 'frameCount', target: 'rotation', curve: 'linear', gain: 0.01 },
            { source: 'energy', target: 'strokeWeight', curve: 'linear', gain: 2 },
            { source: 'energy', target: 'alpha', curve: 'linear', gain: 100 },
            { source: 'index', target: 'hueShift', curve: 'linear', gain: 120 },
          ],
        },
      ],
    });
    const l = n.layers[0];
    expect(l.primitive.type).toBe('star');
    expect(l.generator.type).toBe('grid');
    expect(l.modulations).toHaveLength(5); // all enums valid -> none dropped
  });

  it('grid generates count*count instances', () => {
    const l = normalizePatternSpec({
      layers: [layer({ generator: { type: 'grid', count: 4, radius: 100, phase: 0 } })],
    }).layers[0];
    expect(resolveInstances(l, baseSources).instances).toHaveLength(16);
  });

  it('the jitter source is deterministic and varies per element', () => {
    const l = normalizePatternSpec({
      layers: [layer({ primitive: { type: 'ring', size: 0, sides: 3 }, generator: { type: 'radial', count: 6, radius: 0, phase: 0 }, modulations: [{ source: 'jitter', target: 'size', curve: 'linear', gain: 50 }] })],
    }).layers[0];
    const a = resolveInstances(l, baseSources, 7, 0);
    const b = resolveInstances(l, baseSources, 7, 0);
    expect(a).toEqual(b); // same seed/layer -> identical
    const sizes = a.instances.map((i) => i.size);
    expect(new Set(sizes).size).toBeGreaterThan(1); // jitter differs per element
    // A different seed gives a different (still deterministic) result.
    expect(resolveInstances(l, baseSources, 8, 0)).not.toEqual(a);
  });

  it('returns layer-level style modulation amounts', () => {
    const l = normalizePatternSpec({
      layers: [layer({ modulations: [
        { source: 'energy', target: 'strokeWeight', curve: 'linear', gain: 4 },
        { source: 'energy', target: 'alpha', curve: 'linear', gain: 200 },
        { source: 'constant', target: 'hueShift', curve: 'linear', gain: 90 },
      ] })],
    }).layers[0];
    const r = resolveInstances(l, { ...baseSources, energy: 0.5 }, 1, 0);
    expect(r.strokeWeightMod).toBeCloseTo(2, 6);
    expect(r.alphaMod).toBeCloseTo(100, 6);
    expect(r.hueShift).toBeCloseTo(90, 6);
  });

  it('the frameCount source feeds modulation', () => {
    const l = normalizePatternSpec({
      layers: [layer({ modulations: [{ source: 'frameCount', target: 'rotation', curve: 'linear', gain: 0.5 }] })],
    }).layers[0];
    const r = resolveInstances(l, { ...baseSources, frameCount: 10 }, 0, 0);
    expect(r.rotation).toBeCloseTo(5, 6); // 0.5 * 10
  });
});

describe('LFO rate/phase + waveform curves (Phase 1)', () => {
  it('evalCurve maps the new periodic waveforms (turns-based, period 1)', () => {
    // triangle: -1 at phase 0, +1 at phase 0.5
    expect(evalCurve('triangle', 0)).toBeCloseTo(-1, 10);
    expect(evalCurve('triangle', 0.25)).toBeCloseTo(0, 10);
    expect(evalCurve('triangle', 0.5)).toBeCloseTo(1, 10);
    expect(evalCurve('triangle', 0.75)).toBeCloseTo(0, 10);
    // saw: ramp -1 -> 1 across one period
    expect(evalCurve('saw', 0)).toBeCloseTo(-1, 10);
    expect(evalCurve('saw', 0.25)).toBeCloseTo(-0.5, 10);
    expect(evalCurve('saw', 0.75)).toBeCloseTo(0.5, 10);
    // pulse: +1 for the first half of the period, -1 for the second
    expect(evalCurve('pulse', 0.25)).toBe(1);
    expect(evalCurve('pulse', 0.5)).toBe(-1);
    expect(evalCurve('pulse', 0.9)).toBe(-1);
    // periodicity (period 1)
    expect(evalCurve('saw', 1.25)).toBeCloseTo(evalCurve('saw', 0.25), 10);
  });

  it('rate scales and phase offsets the modulation drive', () => {
    // constant source -> 1; linear curve is identity, so the drive passes through.
    const mod = (rate, phase) => [{ source: 'constant', target: 'radius', curve: 'linear', gain: 1, rate, phase }];
    expect(evalModulation(mod(3, 0.5), 'radius', 0, baseSources)).toBeCloseTo(3.5, 10); // 1*3 + 0.5
    // absent rate/phase default to 1/0 -> identity (back-compat)
    expect(evalModulation([{ source: 'constant', target: 'radius', curve: 'linear', gain: 2 }], 'radius', 0, baseSources)).toBeCloseTo(2, 10);
    // phase alone shifts a waveform: saw(0.25) = -0.5, saw(0.75) = 0.5
    const saw = (phase) => [{ source: 'constant', target: 'radius', curve: 'saw', gain: 1, rate: 0, phase }];
    expect(evalModulation(saw(0.25), 'radius', 0, baseSources)).toBeCloseTo(-0.5, 10);
    expect(evalModulation(saw(0.75), 'radius', 0, baseSources)).toBeCloseTo(0.5, 10);
  });

  it('normalizeModulation omits default rate/phase but keeps non-defaults', () => {
    const n = normalizePatternSpec({ layers: [layer({ modulations: [
      { source: 'time', target: 'radius', curve: 'saw', gain: 30, rate: 1, phase: 0 },
      { source: 'time', target: 'rotation', curve: 'sin', gain: 1, rate: 2, phase: 0.25 },
    ] })] });
    const [m0, m1] = n.layers[0].modulations;
    expect(m0).not.toHaveProperty('rate');
    expect(m0).not.toHaveProperty('phase');
    expect(m1.rate).toBe(2);
    expect(m1.phase).toBe(0.25);
  });

  it('omitting default rate/phase/jitterRate preserves patternId; non-defaults change it', () => {
    const base = { layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10 }] })] };
    const defaults = { layers: [layer({ jitterRate: 0, modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10, rate: 1, phase: 0 }] })] };
    expect(patternId(defaults)).toBe(patternId(base));
    const motion = { layers: [layer({ jitterRate: 5, modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10, rate: 2, phase: 0 }] })] };
    expect(patternId(motion)).not.toBe(patternId(base));
  });

  it('keeps the new waveform curves through normalize', () => {
    const n = normalizePatternSpec({ layers: [layer({ modulations: [
      { source: 'time', target: 'radius', curve: 'triangle', gain: 10 },
      { source: 'time', target: 'size', curve: 'pulse', gain: 10 },
    ] })] });
    expect(n.layers[0].modulations.map((m) => m.curve)).toEqual(['triangle', 'pulse']);
  });

  it('normalize is idempotent with rate/phase/jitterRate present', () => {
    const raw = { layers: [layer({ jitterRate: 12, modulations: [{ source: 'time', target: 'radius', curve: 'saw', gain: 30, rate: 2, phase: 0.25 }] })] };
    const once = normalizePatternSpec(raw);
    expect(normalizePatternSpec(once)).toEqual(once);
  });
});

describe('animatedJitter (Phase 1)', () => {
  it('rate <= 0 returns the frozen seededUnit value (back-compat)', () => {
    expect(animatedJitter(1, 0, 0, 100, 0)).toBe(seededUnit(1, 0, 0, 0));
    expect(animatedJitter(3, 2, 5, 999, -1)).toBe(seededUnit(3, 2, 5, 0));
  });

  it('is deterministic and stays within [-1, 1]', () => {
    expect(animatedJitter(1, 0, 0, 123, 5)).toBe(animatedJitter(1, 0, 0, 123, 5));
    for (const fc of [0, 37, 240, 1000]) {
      const v = animatedJitter(1, 0, 0, fc, 9);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('smoothstep-lerps between adjacent seeded buckets', () => {
    // phase = 10 * 15 / 60 = 2.5 -> bucket 2, fraction 0.5, smoothstep(0.5) = 0.5
    const a = seededUnit(1, 0, 0, 2);
    const b = seededUnit(1, 0, 0, 3);
    expect(animatedJitter(1, 0, 0, 10, 15)).toBeCloseTo(a + (b - a) * 0.5, 10);
  });

  it('resolveInstances animates jitter across frames only when jitterRate > 0', () => {
    const mods = [{ source: 'jitter', target: 'size', curve: 'linear', gain: 5 }];
    const gen = { type: 'single', count: 1, radius: 0, phase: 0 };
    const prim = { type: 'polygon', size: 200, sides: 3 };
    const frozen = normalizePatternSpec({ layers: [layer({ primitive: prim, generator: gen, modulations: mods })] }).layers[0];
    const f0 = resolveInstances(frozen, { ...baseSources, frameCount: 0 }, 7, 0).instances[0].size;
    const f1 = resolveInstances(frozen, { ...baseSources, frameCount: 600 }, 7, 0).instances[0].size;
    expect(f1).toBe(f0); // jitterRate defaults to 0 -> frozen

    const animated = normalizePatternSpec({ layers: [layer({ jitterRate: 20, primitive: prim, generator: gen, modulations: mods })] }).layers[0];
    const a0 = resolveInstances(animated, { ...baseSources, frameCount: 0 }, 7, 0).instances[0].size;
    const a1 = resolveInstances(animated, { ...baseSources, frameCount: 600 }, 7, 0).instances[0].size;
    expect(a1).not.toBe(a0); // shimmer changes the value across frames
  });
});

describe('Motion presets (Phase 2a)', () => {
  it('MOTIONS exposes the expected kinds', () => {
    expect(MOTIONS).toEqual(['orbit', 'pulse', 'breathe', 'drift', 'bloom', 'shimmer']);
  });

  it('normalizeLayer clamps motions, drops unknown kinds, caps, and omits empty', () => {
    const n = normalizePatternSpec({
      layers: [layer({ motions: [
        { kind: 'orbit', speed: 99, depth: -5 }, // clamped to 4 / 0
        { kind: 'nope' }, // dropped
        { kind: 'shimmer', speed: 2, depth: 1 },
        { kind: 'pulse' },
        { kind: 'bloom' },
        { kind: 'drift' }, // beyond MAX_MOTIONS -> not reached
      ] })],
    });
    const m = n.layers[0].motions;
    expect(m).toHaveLength(MAX_MOTIONS);
    expect(m[0]).toEqual({ kind: 'orbit', speed: 4, depth: 0 });
    expect(m.map((x) => x.kind)).toEqual(['orbit', 'shimmer', 'pulse', 'bloom']);
    const empty = normalizePatternSpec({ layers: [layer({ motions: [] })] });
    expect(empty.layers[0]).not.toHaveProperty('motions');
  });

  it('motions preserve patternId when empty, change it when present (idempotent)', () => {
    const base = { layers: [layer()] };
    expect(patternId({ layers: [layer({ motions: [] })] })).toBe(patternId(base));
    const withMotion = { layers: [layer({ motions: [{ kind: 'orbit', speed: 1, depth: 1 }] })] };
    expect(patternId(withMotion)).not.toBe(patternId(base));
    const once = normalizePatternSpec(withMotion);
    expect(normalizePatternSpec(once)).toEqual(once);
  });

  it('expandMotions returns the layer unchanged when there are no motions', () => {
    const l = normalizePatternSpec({ layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10 }] })] }).layers[0];
    const out = expandMotions(l);
    expect(out.modulations).toBe(l.modulations);
    expect(out.jitterRate).toBe(0);
  });

  it('expandMotions appends motion rows and shimmer raises jitterRate', () => {
    const l = normalizePatternSpec({ layers: [layer({ motions: [
      { kind: 'orbit', speed: 1, depth: 1 },
      { kind: 'shimmer', speed: 3, depth: 1 },
    ] })] }).layers[0];
    const out = expandMotions(l);
    expect(out.modulations.some((m) => m.source === 'frameCount' && m.target === 'rotation')).toBe(true);
    expect(out.modulations.filter((m) => m.source === 'jitter')).toHaveLength(2);
    expect(out.jitterRate).toBe(18); // 6 * speed(3)
  });

  it('expandMotions is deterministic and caps at MAX_MODULATIONS', () => {
    const l = normalizePatternSpec({ layers: [layer({ motions: [{ kind: 'bloom', speed: 1, depth: 1 }] })] }).layers[0];
    expect(expandMotions(l)).toEqual(expandMotions(l));
    expect(expandMotions(l).modulations.length).toBeLessThanOrEqual(MAX_MODULATIONS);
  });

  it('a motion resolves identically to its equivalent hand-written modulations', () => {
    const sources = { ...baseSources, frameCount: 100 };
    const motionLayer = normalizePatternSpec({ layers: [layer({ motions: [{ kind: 'orbit', speed: 1, depth: 1 }] })] }).layers[0];
    const handLayer = normalizePatternSpec({ layers: [layer({ modulations: [{ source: 'frameCount', target: 'rotation', curve: 'linear', gain: 0.008 }] })] }).layers[0];
    expect(resolveInstances(motionLayer, sources, 1, 0)).toEqual(resolveInstances(handLayer, sources, 1, 0));
  });
});

describe('centroid modulation source (audio feature)', () => {
  it('MOD_SOURCES includes centroid', () => {
    expect(MOD_SOURCES).toContain('centroid');
  });

  it('keeps a centroid-driven modulation through normalization', () => {
    const n = normalizePatternSpec({ layers: [layer({ modulations: [{ source: 'centroid', target: 'size', curve: 'linear', gain: 20 }] })] });
    expect(n.layers[0].modulations[0].source).toBe('centroid');
  });

  it('resolves the centroid source value through evalModulation', () => {
    const mods = [{ source: 'centroid', target: 'size', curve: 'linear', gain: 100 }];
    expect(evalModulation(mods, 'size', 0, { ...baseSources, centroid: 0.5 })).toBeCloseTo(50);
    expect(evalModulation(mods, 'size', 0, { ...baseSources, centroid: 0 })).toBe(0);
  });

  it('drives geometry from centroid in resolveInstances', () => {
    const l = normalizePatternSpec({ layers: [layer({ modulations: [{ source: 'centroid', target: 'size', curve: 'linear', gain: 40 }] })] }).layers[0];
    const dark = resolveInstances(l, { ...baseSources, centroid: 0 }, 1, 0);
    const bright = resolveInstances(l, { ...baseSources, centroid: 1 }, 1, 0);
    expect(bright.instances[0].size).toBeGreaterThan(dark.instances[0].size);
  });

  it('pins a golden id so MOD_SOURCES growth cannot silently churn shared ids', () => {
    // Frozen literal. MOD_SOURCES is a membership gate only and is never
    // serialized into the normalized spec, so a representative non-centroid
    // spec must keep this exact content-addressed id even as the enum grows.
    const spec = { layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10 }] })] };
    expect(patternId(spec)).toBe('pzpke21');
    const once = normalizePatternSpec(spec);
    expect(normalizePatternSpec(once)).toEqual(once); // normalize idempotent
    expect(patternId(once)).toBe(patternId(spec)); // stable across re-normalization
  });
});

describe('envelope curve (Phase 2b)', () => {
  it('CURVES includes envelope', () => {
    expect(CURVES).toContain('envelope');
  });

  it('evalCurve maps the attack-release contour (unipolar, period 1)', () => {
    // Quick linear attack over the first quarter, peaking at phase 0.25.
    expect(evalCurve('envelope', 0)).toBeCloseTo(0, 10);
    expect(evalCurve('envelope', 0.125)).toBeCloseTo(0.5, 10);
    expect(evalCurve('envelope', 0.25)).toBeCloseTo(1, 10);
    // Quadratic decay back to 0 by the end of the period.
    expect(evalCurve('envelope', 0.625)).toBeCloseTo(0.25, 10);
    expect(evalCurve('envelope', 1)).toBeCloseTo(0, 10);
    // Periodic (period 1) and never leaves [0, 1].
    expect(evalCurve('envelope', 1.25)).toBeCloseTo(evalCurve('envelope', 0.25), 10);
    for (let x = 0; x < 1; x += 0.05) {
      const y = evalCurve('envelope', x);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the envelope curve through normalize', () => {
    const n = normalizePatternSpec({ layers: [layer({ modulations: [{ source: 'time', target: 'scale', curve: 'envelope', gain: 1 }] })] });
    expect(n.layers[0].modulations[0].curve).toBe('envelope');
  });

  it('the golden id is unchanged by CURVES growth', () => {
    // CURVES is a membership gate, not serialized, so appending 'envelope' must
    // not re-key the representative spec pinned by the centroid suite.
    const spec = { layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10 }] })] };
    expect(patternId(spec)).toBe('pzpke21');
  });
});

describe('per-routing clamp (residual e)', () => {
  it('evalModulation clamps a row contribution to [min, max]', () => {
    // constant source, linear curve -> contribution is exactly the gain.
    const hi = [{ source: 'constant', target: 'radius', curve: 'linear', gain: 250, max: 100 }];
    expect(evalModulation(hi, 'radius', 0, baseSources)).toBe(100); // 250 clamped down to max
    const lo = [{ source: 'constant', target: 'radius', curve: 'linear', gain: -250, min: -40 }];
    expect(evalModulation(lo, 'radius', 0, baseSources)).toBe(-40); // -250 clamped up to min
    const inside = [{ source: 'constant', target: 'radius', curve: 'linear', gain: 30, min: -40, max: 100 }];
    expect(evalModulation(inside, 'radius', 0, baseSources)).toBe(30); // untouched inside the window
  });

  it('an absent clamp leaves the contribution untouched (back-compat)', () => {
    const m = [{ source: 'constant', target: 'radius', curve: 'linear', gain: 9999 }];
    expect(evalModulation(m, 'radius', 0, baseSources)).toBe(9999);
  });

  it('normalizeModulation omits open clamps but keeps explicit bounds', () => {
    const n = normalizePatternSpec({ layers: [layer({ modulations: [
      { source: 'energy', target: 'radius', curve: 'linear', gain: 10, min: -10000, max: 10000 },
      { source: 'energy', target: 'size', curve: 'linear', gain: 10, min: -40, max: 120 },
    ] })] });
    const [m0, m1] = n.layers[0].modulations;
    expect(m0).not.toHaveProperty('min');
    expect(m0).not.toHaveProperty('max');
    expect(m1.min).toBe(-40);
    expect(m1.max).toBe(120);
  });

  it('omitting the clamp preserves patternId; a bound changes it', () => {
    const base = { layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10 }] })] };
    const open = { layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10, min: -10000, max: 10000 }] })] };
    expect(patternId(open)).toBe(patternId(base));
    const bounded = { layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10, max: 80 }] })] };
    expect(patternId(bounded)).not.toBe(patternId(base));
  });

  it('normalize is idempotent with a clamp present', () => {
    const raw = { layers: [layer({ modulations: [{ source: 'energy', target: 'radius', curve: 'linear', gain: 10, min: -40, max: 120 }] })] };
    const once = normalizePatternSpec(raw);
    expect(normalizePatternSpec(once)).toEqual(once);
  });
});

describe('per-layer time controls (timeScale / phaseOffset, Slice B)', () => {
  it('omits timeScale=1 / phaseOffset=0 so existing patternIds are preserved', () => {
    const withDefaults = normalizePatternSpec({ layers: [layer({ timeScale: 1, phaseOffset: 0 })] });
    const without = normalizePatternSpec({ layers: [layer()] });
    expect(withDefaults).toEqual(without);
    expect(withDefaults.layers[0]).not.toHaveProperty('timeScale');
    expect(withDefaults.layers[0]).not.toHaveProperty('phaseOffset');
    expect(patternId(withDefaults)).toBe(patternId(without));
  });

  it('keeps non-default values and clamps them to range', () => {
    const n = normalizePatternSpec({ layers: [layer({ timeScale: -5, phaseOffset: 2 })] });
    expect(n.layers[0].timeScale).toBe(-2); // clamped to [-2, 2]
    expect(n.layers[0].phaseOffset).toBe(1); // clamped to [0, 1]
    expect(patternId(n)).not.toBe(patternId(normalizePatternSpec({ layers: [layer()] })));
  });

  it('normalize is idempotent with the time controls set', () => {
    const once = normalizePatternSpec({ layers: [layer({ timeScale: -1, phaseOffset: 0.5 })] });
    expect(normalizePatternSpec(once)).toEqual(once);
  });

  it('the identity (1, 0) resolves bit-for-bit like a layer without the fields', () => {
    const src = { energy: 0.5, time: 3, index: 0, constant: 1, frameCount: 120 };
    const mods = [{ source: 'time', target: 'rotation', curve: 'sin', gain: 1 }];
    const plain = resolveInstances(layer({ modulations: mods }), src, 7, 0);
    const ident = resolveInstances(layer({ timeScale: 1, phaseOffset: 0, modulations: mods }), src, 7, 0);
    expect(ident).toEqual(plain);
  });

  it('phaseOffset shifts a time-driven modulation', () => {
    const src = { energy: 0, time: 0, index: 0, constant: 1, frameCount: 0 };
    const mods = [{ source: 'time', target: 'rotation', curve: 'sin', gain: 1 }];
    const base = resolveInstances(layer({ modulations: mods }), src, 0, 0);
    const shifted = resolveInstances(layer({ phaseOffset: 0.5, modulations: mods }), src, 0, 0);
    expect(base.rotation).toBeCloseTo(0, 6); // sin(0)
    expect(shifted.rotation).toBeCloseTo(Math.sin(0.5), 6); // sin(time + phaseOffset)
  });

  it('negative timeScale reverses a frameCount-driven motion', () => {
    const src = { energy: 0, time: 0, index: 0, constant: 1, frameCount: 100 };
    const mods = [{ source: 'frameCount', target: 'rotation', curve: 'linear', gain: 0.01 }];
    const fwd = resolveInstances(layer({ timeScale: 1, modulations: mods }), src, 0, 0);
    const rev = resolveInstances(layer({ timeScale: -1, modulations: mods }), src, 0, 0);
    expect(fwd.rotation).toBeCloseTo(1, 6); // 0.01 * 100
    expect(rev.rotation).toBeCloseTo(-1, 6); // clock reversed
  });
});
