// Parametric pattern model (pure, p5-independent).
//
// A "pattern" is a JSON-serializable spec interpreted by one generic draw
// function (src/drawing/customPattern.js). This module owns everything that can
// be reasoned about without p5: the schema, validation, normalization, the
// deterministic modulation math, and the pure geometry resolver. The shell only
// rasterizes the numbers this module produces.
//
// Determinism is the contract: resolveInstances() must return identical geometry
// for identical inputs, because the same spec is rendered in the atelier, in the
// separate-p5-instance viewer, and in SVG export. No Math.random(); any
// per-element variation derives from a seeded integer hash (seededUnit).

/** The spec schema version. Distinct from the preset file version. */
export const PATTERN_SPEC_VERSION = '1.0.0';

/** Per-pattern caps (perf + SVG-size guard). A layer cannot exceed MAX_INSTANCES. */
export const MAX_LAYERS = 4;
export const MAX_INSTANCES = 256;
export const MAX_SIDES = 24;
export const MAX_MODULATIONS = 16;
export const MAX_MOTIONS = 4;

/** Closed enums. Extend by appending; normalize drops values not listed here. */
export const PRIMITIVES = ['point', 'line', 'polygon', 'ring', 'star', 'arc'];
export const GENERATORS = ['single', 'radial', 'grid'];
export const MOD_SOURCES = ['energy', 'time', 'index', 'constant', 'frameCount', 'jitter', 'centroid'];
export const MOD_TARGETS = ['count', 'radius', 'size', 'rotation', 'scale', 'sides', 'strokeWeight', 'alpha', 'hueShift'];
export const CURVES = ['linear', 'sqrt', 'square', 'smoothstep', 'sin', 'triangle', 'saw', 'pulse', 'envelope'];
export const MOTIONS = ['orbit', 'pulse', 'breathe', 'drift', 'bloom', 'shimmer'];

/**
 * @typedef {Object} Modulation
 * @property {string} source  One of MOD_SOURCES.
 * @property {string} target  One of MOD_TARGETS.
 * @property {string} curve   One of CURVES.
 * @property {number} gain    Scalar applied to curve(drive) before accumulation.
 * @property {number} [rate]  Optional frequency scale on the drive value (default 1).
 * @property {number} [phase] Optional offset added to the drive value (default 0).
 * @property {number} [min]   Optional lower clamp on this row's contribution (gain*curve).
 * @property {number} [max]   Optional upper clamp on this row's contribution (gain*curve).
 *
 * @typedef {Object} Motion
 * @property {string} kind   One of MOTIONS.
 * @property {number} speed  Motion rate scale (0-4, default 1).
 * @property {number} depth  Motion amount scale (0-2, default 1).
 *
 * @typedef {Object} Primitive
 * @property {string} type    One of PRIMITIVES.
 * @property {number} size    Drawn extent (ring radius / polygon radius / line half-length / point diameter).
 * @property {number} sides   Polygon side count (ignored by other primitives).
 *
 * @typedef {Object} PatternGenerator
 * @property {string} type    One of GENERATORS.
 * @property {number} count   Instance count (radial only; single is always 1).
 * @property {number} radius  Placement radius for radial instances.
 * @property {number} phase   Angular offset (radians) for the first radial instance.
 *
 * @typedef {Object} Layer
 * @property {Primitive} primitive
 * @property {PatternGenerator} generator
 * @property {number} rotation  Whole-layer base rotation (radians).
 * @property {number} scale     Whole-layer base scale.
 * @property {Modulation[]} modulations
 * @property {Motion[]} [motions]   Named motion presets, expanded to modulations at resolve time.
 * @property {number} [jitterRate]  Optional animated-jitter speed (0 = frozen).
 *
 * @typedef {Object} PatternSpec
 * @property {string} specVersion
 * @property {number} seed
 * @property {Layer[]} layers
 *
 * @typedef {Object} Sources
 * @property {number} energy      Band energy normalized to [0, 1].
 * @property {number} time        Slowly increasing time value (frame-derived).
 * @property {number} index       Per-instance index normalized to [0, 1].
 * @property {number} constant    Always 1.
 * @property {number} [frameCount] Raw frame counter (for steady spin/drift).
 * @property {number} [jitter]    Per-element seeded value in [-1, 1] (set per instance).
 * @property {number} [centroid]  Spectral centroid (timbral brightness) in [0, 1].
 *
 * @typedef {Object} ResolvedInstance
 * @property {number} x
 * @property {number} y
 * @property {number} size
 * @property {number} sides
 * @property {number} angle   Orientation (radians) of this instance.
 *
 * @typedef {Object} ResolvedLayer
 * @property {number} rotation
 * @property {number} scale
 * @property {number} strokeWeightMod  Additive delta for the base stroke weight.
 * @property {number} alphaMod         Additive delta for the base alpha (0-255).
 * @property {number} hueShift         Hue rotation in degrees applied to the color.
 * @property {ResolvedInstance[]} instances
 *
 * @typedef {Record<string, PatternSpec>} PatternLibrary
 */

/**
 * Coerce to a finite number and clamp to [lo, hi]; fall back when not numeric.
 * @param {unknown} n
 * @param {number} lo
 * @param {number} hi
 * @param {number} fallback
 * @returns {number}
 */
function clampNum(n, lo, hi, fallback) {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Like clampNum but rounded to an integer.
 * @param {unknown} n
 * @param {number} lo
 * @param {number} hi
 * @param {number} fallback
 * @returns {number}
 */
function clampInt(n, lo, hi, fallback) {
  return Math.round(clampNum(n, lo, hi, fallback));
}

/**
 * Deterministic integer-hash pseudo-random value in [-1, 1] from up to four
 * integer inputs. Integer-based (FNV-1a style) rather than Math.sin so it
 * reproduces bit-for-bit across engines and p5 instances. This is the project's
 * seeded-determinism primitive; jitter modulation (a later slice) builds on it.
 * @param {number} seed
 * @param {number} layerIndex
 * @param {number} elementIndex
 * @param {number} [frameBucket]
 * @returns {number}
 */
export function seededUnit(seed, layerIndex, elementIndex, frameBucket = 0) {
  let h = 2166136261 >>> 0;
  const mix = (v) => {
    h ^= v >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 16777619) >>> 0;
  };
  mix(seed | 0);
  mix(layerIndex | 0);
  mix(elementIndex | 0);
  mix(frameBucket | 0);
  return (h >>> 0) / 0xffffffff * 2 - 1;
}

/**
 * Frames-to-bucket scale for animated jitter. The seeded value steps to a new
 * bucket roughly every 1/(jitterRate * JITTER_RATE_SCALE) frames; at jitterRate
 * 1 that is ~60 frames (a slow wander), at 30 it is ~2 frames (a fast shimmer).
 */
const JITTER_RATE_SCALE = 1 / 60;

/**
 * Time-animated jitter: a deterministic, smooth walk for the per-element
 * `jitter` source. When rate <= 0 it returns the exact frozen seededUnit value
 * (so jitterRate 0 reproduces the pre-animation behavior bit-for-bit). Otherwise
 * it smoothstep-lerps between two adjacent seeded buckets indexed by the frame,
 * so it shimmers without any unseeded random()/noise() and reproduces identically
 * in the atelier, the viewer, and SVG replay (all fed the same frameCount).
 * @param {number} seed
 * @param {number} layerIndex
 * @param {number} elementIndex
 * @param {number} frameCount
 * @param {number} rate
 * @returns {number}
 */
export function animatedJitter(seed, layerIndex, elementIndex, frameCount, rate) {
  if (!(rate > 0)) return seededUnit(seed, layerIndex, elementIndex, 0);
  const phase = frameCount * rate * JITTER_RATE_SCALE;
  const bucket = Math.floor(phase);
  const f = phase - bucket;
  const eased = f * f * (3 - 2 * f);
  const a = seededUnit(seed, layerIndex, elementIndex, bucket);
  const b = seededUnit(seed, layerIndex, elementIndex, bucket + 1);
  return a + (b - a) * eased;
}

/**
 * Pure scalar response curve. Inputs are expected in [0, 1] for most sources
 * (energy/index), but the maps are total for any finite input.
 * @param {string} curve
 * @param {number} x
 * @returns {number}
 */
export function evalCurve(curve, x) {
  switch (curve) {
    case 'sqrt':
      return Math.sqrt(Math.max(0, x));
    case 'square':
      return x * x;
    case 'smoothstep': {
      const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
      return t * t * (3 - 2 * t);
    }
    case 'sin':
      return Math.sin(x);
    case 'triangle':
      return 1 - 4 * Math.abs((x - Math.floor(x)) - 0.5);
    case 'saw':
      return 2 * (x - Math.floor(x)) - 1;
    case 'pulse':
      return x - Math.floor(x) < 0.5 ? 1 : -1;
    case 'envelope': {
      // A looping attack-release contour in [0, 1]: a quick linear rise over the
      // first quarter of the period, then a slower quadratic decay back to 0. The
      // asymmetry gives a "pluck and fade" / breathing feel the symmetric waves
      // (sin/triangle) and the linear saw cannot. Unipolar like the shaping
      // curves, so with a positive gain it lifts a parameter off its baseline.
      const frac = x - Math.floor(x);
      const attack = 0.25;
      if (frac < attack) return frac / attack;
      const r = (frac - attack) / (1 - attack);
      return (1 - r) * (1 - r);
    }
    case 'linear':
    default:
      return x;
  }
}

/**
 * Resolve a modulation source to its scalar value.
 * @param {string} source
 * @param {Sources} sources
 * @returns {number}
 */
function sourceValue(source, sources) {
  switch (source) {
    case 'energy':
      return sources.energy;
    case 'time':
      return sources.time;
    case 'index':
      return sources.index;
    case 'constant':
      return 1;
    case 'frameCount':
      return typeof sources.frameCount === 'number' ? sources.frameCount : 0;
    case 'jitter':
      return typeof sources.jitter === 'number' ? sources.jitter : 0;
    case 'centroid':
      return typeof sources.centroid === 'number' ? sources.centroid : 0;
    default:
      return 0;
  }
}

/**
 * Accumulate every modulation aimed at `target` additively on top of `base`.
 * @param {Modulation[]} modulations
 * @param {string} target
 * @param {number} base
 * @param {Sources} sources
 * @returns {number}
 */
export function evalModulation(modulations, target, base, sources) {
  let value = base;
  for (const m of modulations) {
    if (m.target !== target) continue;
    const drive = sourceValue(m.source, sources) * (m.rate ?? 1) + (m.phase ?? 0);
    let contribution = m.gain * evalCurve(m.curve, drive);
    // Optional per-row clamp. Absent bounds leave the contribution untouched, so
    // unclamped rows are bit-for-bit identical to the pre-clamp behavior.
    if (typeof m.min === 'number' && contribution < m.min) contribution = m.min;
    if (typeof m.max === 'number' && contribution > m.max) contribution = m.max;
    value += contribution;
  }
  return value;
}

/**
 * Structural guard: does this look like a pattern spec the interpreter can use?
 * Band-name and version concerns are handled separately.
 * @param {any} spec
 * @returns {boolean}
 */
export function isValidPatternSpec(spec) {
  if (!spec || typeof spec !== 'object') return false;
  if (typeof spec.specVersion !== 'string') return false;
  if (!Array.isArray(spec.layers)) return false;
  return spec.layers.every(
    (l) =>
      l &&
      typeof l === 'object' &&
      l.primitive &&
      typeof l.primitive === 'object' &&
      l.generator &&
      typeof l.generator === 'object'
  );
}

/**
 * Normalize one raw layer: fill defaults, clamp ranges, drop unknown enums.
 * @param {any} raw
 * @returns {Layer}
 */
function normalizeLayer(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const p = src.primitive && typeof src.primitive === 'object' ? src.primitive : {};
  const g = src.generator && typeof src.generator === 'object' ? src.generator : {};
  const modsIn = Array.isArray(src.modulations) ? src.modulations : [];
  /** @type {Modulation[]} */
  const modulations = [];
  for (const m of modsIn) {
    const nm = normalizeModulation(m);
    if (nm) modulations.push(nm);
    if (modulations.length >= MAX_MODULATIONS) break;
  }
  const motionsIn = Array.isArray(src.motions) ? src.motions : [];
  /** @type {Motion[]} */
  const motions = [];
  for (const m of motionsIn) {
    const nm = normalizeMotion(m);
    if (nm) motions.push(nm);
    if (motions.length >= MAX_MOTIONS) break;
  }
  /** @type {Layer} */
  const layer = {
    primitive: {
      type: PRIMITIVES.includes(p.type) ? p.type : 'point',
      size: clampNum(p.size, 0, 1000, 20),
      sides: clampInt(p.sides, 2, MAX_SIDES, 3),
    },
    generator: {
      type: GENERATORS.includes(g.type) ? g.type : 'single',
      count: clampInt(g.count, 1, MAX_INSTANCES, 1),
      radius: clampNum(g.radius, 0, 2000, 0),
      phase: clampNum(g.phase, -10000, 10000, 0),
    },
    rotation: clampNum(src.rotation, -10000, 10000, 0),
    scale: clampNum(src.scale, 0.01, 100, 1),
    modulations,
  };
  // Named motions and the animated-jitter clock are optional; omit each at its
  // empty/default value to preserve the content-addressed patternId of specs
  // that don't use them.
  if (motions.length) layer.motions = motions;
  const jitterRate = clampNum(src.jitterRate, 0, 30, 0);
  if (jitterRate !== 0) layer.jitterRate = jitterRate;
  return layer;
}

/**
 * Normalize one raw modulation, or null to drop it (unknown source/target enum).
 * @param {any} raw
 * @returns {Modulation|null}
 */
function normalizeModulation(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!MOD_SOURCES.includes(raw.source)) return null;
  if (!MOD_TARGETS.includes(raw.target)) return null;
  /** @type {Modulation} */
  const out = {
    source: raw.source,
    target: raw.target,
    curve: CURVES.includes(raw.curve) ? raw.curve : 'linear',
    gain: clampNum(raw.gain, -10000, 10000, 0),
  };
  // rate/phase form an optional per-row oscillator (frequency scale + offset on
  // the drive value). Omit them at their defaults so existing specs keep their
  // content-addressed patternId (no silent re-keying of saved libraries).
  const rate = clampNum(raw.rate, 0, 16, 1);
  const phase = clampNum(raw.phase, 0, 1, 0);
  if (rate !== 1) out.rate = rate;
  if (phase !== 0) out.phase = phase;
  // min/max bound this row's contribution (gain*curve) to a window. Both are
  // optional and omitted at the fully-open sentinels (-/+10000) so a spec
  // without an explicit clamp keeps its patternId byte-for-byte and evaluates
  // exactly as before — only an author-chosen bound is serialized and applied.
  const min = clampNum(raw.min, -10000, 10000, -10000);
  const max = clampNum(raw.max, -10000, 10000, 10000);
  if (min !== -10000) out.min = min;
  if (max !== 10000) out.max = max;
  return out;
}

/**
 * Normalize one raw motion, or null to drop it (unknown kind).
 * @param {any} raw
 * @returns {Motion|null}
 */
function normalizeMotion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!MOTIONS.includes(raw.kind)) return null;
  return {
    kind: raw.kind,
    speed: clampNum(raw.speed, 0, 4, 1),
    depth: clampNum(raw.depth, 0, 2, 1),
  };
}

/**
 * Total, never-throws normalization. Fills defaults, clamps counts/sizes, drops
 * unknown enums (graceful forward-compat), caps layer/instance/modulation
 * budgets, and is idempotent: normalize(normalize(x)) deep-equals normalize(x).
 * @param {any} raw
 * @returns {PatternSpec}
 */
export function normalizePatternSpec(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const layersIn = Array.isArray(src.layers) ? src.layers : [];
  const layers = layersIn.slice(0, MAX_LAYERS).map(normalizeLayer);
  return {
    specVersion: typeof src.specVersion === 'string' ? src.specVersion : PATTERN_SPEC_VERSION,
    seed: Number.isFinite(src.seed) ? Math.trunc(src.seed) : 0,
    layers,
  };
}

/**
 * Whether the interpreter supports this spec's version. A higher major version
 * is "from the future" and must fall back rather than render partially.
 * @param {any} spec
 * @returns {boolean}
 */
export function isSupportedSpecVersion(spec) {
  const major = (v) => parseInt(String(v).split('.')[0], 10) || 0;
  return major(spec && spec.specVersion) <= major(PATTERN_SPEC_VERSION);
}

/**
 * Lower each named motion into deterministic modulation rows built only from
 * existing sources/targets/curves (plus the animated-jitter clock for shimmer).
 * Constants are tuned to the composer's visual scale. Pure data.
 * @type {Record<string, (speed: number, depth: number) => {mods: Modulation[], jitterRate?: number}>}
 */
const MOTION_DEFS = {
  orbit: (speed) => ({ mods: [{ source: 'frameCount', target: 'rotation', curve: 'linear', gain: 0.008 * speed }] }),
  pulse: (_speed, depth) => ({ mods: [{ source: 'energy', target: 'size', curve: 'square', gain: 45 * depth }] }),
  breathe: (speed, depth) => ({ mods: [{ source: 'time', target: 'scale', curve: 'sin', gain: 0.18 * depth, rate: 5 * speed }] }),
  drift: (speed, depth) => ({ mods: [{ source: 'time', target: 'rotation', curve: 'sin', gain: 0.25 * depth, rate: 3 * speed }] }),
  bloom: (_speed, depth) => ({
    mods: [
      { source: 'energy', target: 'count', curve: 'linear', gain: 8 * depth },
      { source: 'energy', target: 'radius', curve: 'sqrt', gain: 70 * depth },
    ],
  }),
  shimmer: (speed, depth) => ({
    mods: [
      { source: 'jitter', target: 'size', curve: 'linear', gain: 14 * depth },
      { source: 'jitter', target: 'alpha', curve: 'linear', gain: 70 * depth },
    ],
    jitterRate: 6 * speed,
  }),
};

/**
 * Expand a layer's named motions into a combined modulation list (the layer's
 * own rows first, then each motion's rows) plus the effective jitter rate (the
 * max of the layer's own jitterRate and any shimmer motion's). Pure and
 * deterministic, so the regression anchor (atelier == viewer == SVG) holds. The
 * combined list is capped at MAX_MODULATIONS.
 * @param {Layer} layer  A normalized layer.
 * @returns {{modulations: Modulation[], jitterRate: number}}
 */
export function expandMotions(layer) {
  const motions = Array.isArray(layer.motions) ? layer.motions : [];
  if (motions.length === 0) {
    return { modulations: layer.modulations, jitterRate: layer.jitterRate || 0 };
  }
  const modulations = layer.modulations.slice();
  let jitterRate = layer.jitterRate || 0;
  for (const m of motions) {
    const def = MOTION_DEFS[m.kind];
    if (!def) continue;
    const out = def(m.speed, m.depth);
    for (const row of out.mods) modulations.push(row);
    if (typeof out.jitterRate === 'number') jitterRate = Math.max(jitterRate, out.jitterRate);
  }
  return { modulations: modulations.slice(0, MAX_MODULATIONS), jitterRate };
}

/**
 * Resolve one normalized layer into concrete geometry — the regression anchor
 * that guarantees atelier == viewer == SVG. Pure: no drawing, no p5, no
 * Math.random(). The `jitter` source is a deterministic function of (seed,
 * layerIndex, elementIndex) and, when layer.jitterRate > 0, of frameCount too
 * (animatedJitter), so it stays reproducible across instances and contexts.
 * @param {Layer} layer        A normalized layer.
 * @param {Sources} sources
 * @param {number} [seed]       The spec seed (for the jitter source).
 * @param {number} [layerIndex] This layer's index (for the jitter source).
 * @returns {ResolvedLayer}
 */
export function resolveInstances(layer, sources, seed = 0, layerIndex = 0) {
  const fc = typeof sources.frameCount === 'number' ? sources.frameCount : 0;
  const { modulations: mods, jitterRate: jr } = expandMotions(layer);
  const layerSources = { ...sources, index: 0, jitter: animatedJitter(seed, layerIndex, 0, fc, jr) };
  const rotation = evalModulation(mods, 'rotation', layer.rotation, layerSources);
  const scale = evalModulation(mods, 'scale', layer.scale, layerSources);
  const strokeWeightMod = evalModulation(mods, 'strokeWeight', 0, layerSources);
  const alphaMod = evalModulation(mods, 'alpha', 0, layerSources);
  const hueShift = evalModulation(mods, 'hueShift', 0, layerSources);

  const gen = layer.generator;
  let count =
    gen.type === 'single'
      ? 1
      : clampInt(evalModulation(mods, 'count', gen.count, layerSources), 1, MAX_INSTANCES, 1);

  // grid: `count` is per-axis; the grid is count*count cells (capped). Its span
  // is a single layer-level radius so the lattice stays regular.
  let perAxis = 0;
  let gridRadius = 0;
  if (gen.type === 'grid') {
    perAxis = Math.max(1, Math.min(count, Math.floor(Math.sqrt(MAX_INSTANCES))));
    count = perAxis * perAxis;
    gridRadius = evalModulation(mods, 'radius', gen.radius, layerSources);
  }

  /** @type {ResolvedInstance[]} */
  const instances = [];
  for (let i = 0; i < count; i++) {
    const index = count > 1 ? i / (count - 1) : 0;
    const sourcesI = { ...sources, index, jitter: animatedJitter(seed, layerIndex, i, fc, jr) };
    const size = Math.max(0, evalModulation(mods, 'size', layer.primitive.size, sourcesI));
    const sides = clampInt(
      evalModulation(mods, 'sides', layer.primitive.sides, sourcesI),
      2,
      MAX_SIDES,
      3
    );
    let x = 0;
    let y = 0;
    let angle = 0;
    if (gen.type === 'radial') {
      const radius = evalModulation(mods, 'radius', gen.radius, sourcesI);
      angle = gen.phase + (Math.PI * 2 * i) / count;
      x = radius * Math.cos(angle);
      y = radius * Math.sin(angle);
    } else if (gen.type === 'grid') {
      const gx = i % perAxis;
      const gy = Math.floor(i / perAxis);
      const step = perAxis > 1 ? (2 * gridRadius) / (perAxis - 1) : 0;
      x = -gridRadius + gx * step;
      y = -gridRadius + gy * step;
      angle = gen.phase;
    }
    instances.push({ x, y, size, sides, angle });
  }
  return { rotation, scale, strokeWeightMod, alphaMod, hueShift, instances };
}

/**
 * Total instance count a spec resolves to right now (for the SVG-size guard and
 * tests). Sums each layer's resolved instance count.
 * @param {PatternSpec} spec  A normalized spec.
 * @param {Sources} sources
 * @returns {number}
 */
export function instanceCount(spec, sources) {
  return spec.layers.reduce(
    (sum, layer, layerIndex) => sum + resolveInstances(layer, sources, spec.seed, layerIndex).instances.length,
    0
  );
}

/**
 * Content-addressed id: a stable short hash of the normalized spec's JSON.
 * Identical specs collapse to one id (harmless dedupe); different specs
 * (practically) never collide, so merging a shared preset's patterns into a
 * local library is collision-safe by construction.
 * @param {any} rawSpec
 * @returns {string}
 */
export function patternId(rawSpec) {
  const json = JSON.stringify(normalizePatternSpec(rawSpec));
  let h = 2166136261 >>> 0;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return 'p' + (h >>> 0).toString(36);
}

/**
 * Add a pattern to a library (immutably), returning the new library and the
 * content-addressed id. An identical spec maps to the same id (idempotent).
 * @param {PatternLibrary} library
 * @param {any} rawSpec
 * @returns {{library: PatternLibrary, id: string}}
 */
export function addPattern(library, rawSpec) {
  const spec = normalizePatternSpec(rawSpec);
  const id = patternId(spec);
  return { library: { ...(library || {}), [id]: spec }, id };
}

/**
 * @param {PatternLibrary} library
 * @param {string} id
 * @returns {PatternSpec|null}
 */
export function findPattern(library, id) {
  return library && library[id] ? library[id] : null;
}

/**
 * Remove a pattern by id (immutably).
 * @param {PatternLibrary} library
 * @param {string} id
 * @returns {PatternLibrary}
 */
export function removePattern(library, id) {
  const rest = { ...(library || {}) };
  delete rest[id];
  return rest;
}

/**
 * Resolve the closure of patterns referenced by `ids` from `library`. Used to
 * emit a self-contained patternLibrary in the render params, so the viewer
 * never needs the local library.
 * @param {PatternLibrary} library
 * @param {Iterable<string>} ids
 * @returns {PatternLibrary}
 */
export function resolveLibraryClosure(library, ids) {
  /** @type {PatternLibrary} */
  const out = {};
  for (const id of ids) {
    const spec = findPattern(library, id);
    if (spec) out[id] = spec;
  }
  return out;
}

/**
 * Parse a serialized library (e.g. from a preset or localStorage) into a
 * normalized in-memory library, dropping anything structurally invalid.
 * @param {any} raw  Either a {version, patterns} envelope or a bare {id: spec} map.
 * @returns {PatternLibrary}
 */
export function parseLibrary(raw) {
  const patterns =
    raw && typeof raw === 'object'
      ? raw.patterns && typeof raw.patterns === 'object'
        ? raw.patterns
        : raw
      : {};
  /** @type {PatternLibrary} */
  const out = {};
  for (const [id, spec] of Object.entries(patterns)) {
    if (isValidPatternSpec(spec)) out[id] = normalizePatternSpec(spec);
  }
  return out;
}

/**
 * A few ready-to-use patterns to seed the composer (and to drive round-trip
 * smokes before the editor exists). Pure data; ids are derived on demand.
 * @type {Array<{name: string, spec: PatternSpec}>}
 */
export const STARTER_PATTERNS = [
  {
    name: 'Radial Bloom',
    spec: {
      specVersion: PATTERN_SPEC_VERSION,
      seed: 1,
      layers: [
        {
          primitive: { type: 'polygon', size: 24, sides: 3 },
          generator: { type: 'radial', count: 8, radius: 60, phase: 0 },
          rotation: 0,
          scale: 1,
          modulations: [
            { source: 'energy', target: 'radius', curve: 'linear', gain: 160 },
            { source: 'energy', target: 'count', curve: 'linear', gain: 16 },
            { source: 'energy', target: 'rotation', curve: 'linear', gain: 1.2 },
            { source: 'energy', target: 'size', curve: 'sqrt', gain: 30 },
          ],
        },
      ],
    },
  },
  {
    name: 'Pulse Rings',
    spec: {
      specVersion: PATTERN_SPEC_VERSION,
      seed: 2,
      layers: [
        {
          primitive: { type: 'ring', size: 20, sides: 3 },
          generator: { type: 'radial', count: 6, radius: 0, phase: 0 },
          rotation: 0,
          scale: 1,
          modulations: [
            { source: 'index', target: 'size', curve: 'linear', gain: 240 },
            { source: 'energy', target: 'size', curve: 'linear', gain: 60 },
            { source: 'energy', target: 'count', curve: 'linear', gain: 6 },
          ],
        },
      ],
    },
  },
];
