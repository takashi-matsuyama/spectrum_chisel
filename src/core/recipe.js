// Reproducible recipe (pure, p5-independent), mirroring core/preset.js.
//
// A recipe is the self-contained, sellable/distributable package that re-renders
// an artwork deterministically WITHOUT re-analyzing the audio: the recorded
// spectrumHistory + the render params + the deterministic seed + the renderer
// version. A preset (params only) is a subset; a recipe adds history + seed.

import { isValidPreset } from './preset.js';

export const RECIPE_VERSION = '1.0.0';
// Kept in sync with package.json "version" by a unit test (test/recipe.test.js).
export const RENDERER_VERSION = '1.1.0';

/**
 * Assemble a recipe object from the live render state. Pure: the caller supplies
 * the timestamp (no Date.now here) so this stays deterministic and testable.
 * @param {object} args
 * @param {object} args.params              collectRenderParams() snapshot.
 * @param {number[][]} args.spectrumHistory Recorded spectrum frames.
 * @param {number|null} args.seed           Deterministic render seed.
 * @param {number} args.boost               Input gain captured at record time so
 *                                          the recipe reproduces self-contained.
 * @param {string} args.createdAt           ISO timestamp.
 * @param {string} [args.title]             Edition title (free text; may be '').
 * @param {string} [args.edition]           Edition string 'n/N' (unique = '1/1').
 * @returns {object}
 */
export function buildRecipe({
  params,
  spectrumHistory,
  seed,
  boost,
  createdAt,
  title = '',
  edition = '1/1',
}) {
  return {
    recipeVersion: RECIPE_VERSION,
    rendererVersion: RENDERER_VERSION,
    seed,
    boost,
    spectrumHistory,
    params,
    metadata: { title, edition, createdAt },
  };
}

/**
 * Structural check that a loaded object is a usable recipe: a non-empty spectrum
 * history, a numeric seed, and a valid preset body under `.params`. Distinguishes
 * a recipe from a plain preset (which lacks spectrumHistory/seed).
 * @param {any} data
 * @returns {boolean}
 */
export function isValidRecipe(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.spectrumHistory) || data.spectrumHistory.length === 0) return false;
  // Every frame must be an array — replay does spectrum.reduce / indexing on it,
  // which would throw on a non-array frame.
  if (!data.spectrumHistory.every((frame) => Array.isArray(frame))) return false;
  // The seed feeds the PRNG; a non-finite seed (Infinity/NaN) would poison it.
  if (!Number.isFinite(data.seed)) return false;
  return isValidPreset(data.params);
}

// --- Edition metadata (Slice D) ---------------------------------------------

/**
 * Format an 'n/N' edition string from a 1-based index and a total. A unique
 * piece is '1/1'. The caller validates the numbers; this just renders them.
 * @param {number} index
 * @param {number} total
 * @returns {string}
 */
export function formatEdition(index, total) {
  return `${index}/${total}`;
}

/**
 * Validate an edition string of the form 'n/N': both parts positive integers in
 * canonical form (no leading zeros), with 1 <= n <= N and within the safe-integer
 * range. The accepted set is exactly what formatEdition emits, so a valid edition
 * survives a load -> save round-trip without re-normalizing (which would change
 * the contentHash). Rejects floats, zero/negatives, leading zeros, and any other
 * shape.
 * @param {any} edition
 * @returns {boolean}
 */
export function isValidEdition(edition) {
  if (typeof edition !== 'string') return false;
  // [1-9]\d* rules out leading zeros and zero/empty parts in one step.
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(edition);
  if (!match) return false;
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total)) return false;
  return index <= total;
}

// --- Deterministic content hash (authenticity attachment point, Slice D) ----
//
// The contentHash is exactly what an external authenticity scheme (certificate,
// signature, NFT) attests to: a recipe that is deterministic can have any such
// scheme layered on top later (planning docs/4 §2). We do NOT sign in-app — we
// only provide the canonical bytes and their digest as the attachment point.

/**
 * Deterministic JSON serialization: object keys are sorted recursively so the
 * output never depends on insertion order (the only source of nondeterminism in
 * JSON.stringify). Array order is preserved. Used to canonicalize a recipe for
 * hashing/signing.
 * @param {any} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Canonical bytes for hashing/signing: the whole recipe minus the fields that
 * are derived from or attest to the hash itself (`metadata.contentHash` and
 * `metadata.authenticity`). Excluding them avoids circularity and lets the same
 * hash be recomputed after a signature is attached. Everything else — title,
 * edition, createdAt, seed, boost, spectrumHistory, params, versions — is bound.
 * @param {object} recipe
 * @returns {string}
 */
const HASH_EXCLUDED_META_KEYS = new Set(['contentHash', 'authenticity']);

export function canonicalRecipeString(recipe) {
  const { metadata = {}, ...rest } = recipe || {};
  const metaRest = {};
  for (const key of Object.keys(metadata)) {
    if (!HASH_EXCLUDED_META_KEYS.has(key)) metaRest[key] = metadata[key];
  }
  return stableStringify({ ...rest, metadata: metaRest });
}

/**
 * SHA-256 of the canonical recipe bytes, as 'sha256:<hex>'. Async (Web Crypto);
 * available in both the browser and Node (globalThis.crypto.subtle).
 * @param {object} recipe
 * @returns {Promise<string>}
 */
export async function computeContentHash(recipe) {
  const bytes = new TextEncoder().encode(canonicalRecipeString(recipe));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}
