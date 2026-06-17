// Generic interpreter for a parametric custom pattern (Phase 2 composer).
//
// This is the ONLY code that rasterizes a pattern spec; all the geometry is
// computed by the pure core (src/core/pattern.js). It follows the same
// draw-function contract as the built-in styles, so the render dispatch can call
// it like any other effect. It never calls p5 random()/noise(), so a frame
// reproduces identically in the atelier, the separate-instance viewer, and SVG.

import { normalizePatternSpec, resolveInstances } from '../core/pattern.js';

/**
 * Draw the primitive for one resolved instance. The only p5-touching switch.
 * @param {any} pg
 * @param {string} type
 * @param {{x:number,y:number,size:number,sides:number,angle:number}} inst
 */
function drawPrimitive(pg, type, inst) {
  switch (type) {
    case 'ring':
      pg.ellipse(inst.x, inst.y, inst.size * 2, inst.size * 2);
      break;
    case 'line':
      pg.line(inst.x, inst.y, inst.x + Math.cos(inst.angle) * inst.size, inst.y + Math.sin(inst.angle) * inst.size);
      break;
    case 'polygon': {
      const sides = Math.max(2, Math.round(inst.sides));
      pg.beginShape();
      for (let k = 0; k < sides; k++) {
        const a = inst.angle + (Math.PI * 2 * k) / sides;
        pg.vertex(inst.x + Math.cos(a) * inst.size, inst.y + Math.sin(a) * inst.size);
      }
      pg.endShape(pg.CLOSE);
      break;
    }
    case 'star': {
      const points = Math.max(2, Math.round(inst.sides));
      const inner = inst.size * 0.45;
      pg.beginShape();
      for (let k = 0; k < points * 2; k++) {
        const r = k % 2 === 0 ? inst.size : inner;
        const a = inst.angle + (Math.PI * k) / points;
        pg.vertex(inst.x + Math.cos(a) * r, inst.y + Math.sin(a) * r);
      }
      pg.endShape(pg.CLOSE);
      break;
    }
    case 'arc':
      // An open arc spanning three-quarters of a turn, oriented by angle.
      pg.arc(inst.x, inst.y, inst.size * 2, inst.size * 2, inst.angle, inst.angle + Math.PI * 1.5);
      break;
    case 'point':
    default:
      pg.point(inst.x, inst.y);
      break;
  }
}

/**
 * Rotate a color's hue by `degrees`, returning an RGB-mode p5.Color so a later
 * setAlpha(0-255) behaves (resolving under HSB would treat alpha as 0-1 and make
 * every mark opaque — see render.js hexColor). Reads the source color's HSB via
 * a scoped colorMode, then rebuilds from its 0-255 RGBA levels.
 * @param {any} pg
 * @param {any} rgbColor  An RGB-mode p5.Color (band color).
 * @param {number} degrees
 * @returns {any}
 */
function shiftHue(pg, rgbColor, degrees) {
  pg.push();
  pg.colorMode(HSB, 360, 100, 100);
  const h = (((pg.hue(rgbColor) + degrees) % 360) + 360) % 360;
  const shifted = pg.color(h, pg.saturation(rgbColor), pg.brightness(rgbColor));
  pg.pop();
  const [r, g, b] = shifted.levels; // p5.Color.levels is always 0-255 RGBA.
  pg.push();
  pg.colorMode(RGB, 255);
  const out = pg.color(r, g, b);
  pg.pop();
  return out;
}

/**
 * Interpret a custom pattern spec. Same signature as the built-in draw styles.
 * The render dispatch guarantees `params.spec` is a valid, supported spec, so
 * this assumes validity (it normalizes once more, idempotently, for safety).
 * @param {any} pg
 * @param {number} energy        Scaled band energy (0-255).
 * @param {number} frameCount
 * @param {number} time
 * @param {{color:any, weight:number, alpha:number}} style
 * @param {{intensityGain?:number, angleSpeed?:number, threshold?:number, spec:any}} params
 */
export function drawCustomPattern(pg, energy, frameCount, time, style, params) {
  const spec = normalizePatternSpec(params.spec);
  if (spec.layers.length === 0) return;

  const intensityGain = typeof params.intensityGain === 'number' ? params.intensityGain : 1.0;
  const angleSpeed = typeof params.angleSpeed === 'number' ? params.angleSpeed : 1.0;

  // The band's IntensityGain / AngleSpeed sliders apply uniformly to the whole
  // pattern, mirroring how the built-in styles consume them.
  pg.rotate(frameCount * 0.01 * angleSpeed);
  pg.scale(intensityGain);

  // energy normalized to [0,1] is the primary source; index and jitter are
  // resolved per-instance inside resolveInstances; frameCount drives steady drift.
  const sources = { energy: energy / 255, time, index: 0, constant: 1, frameCount };

  spec.layers.forEach((layer, layerIndex) => {
    const resolved = resolveInstances(layer, sources, spec.seed, layerIndex);
    if (resolved.instances.length === 0) return;
    pg.push();

    // Per-layer style: the base band style modulated by this layer's
    // strokeWeight / alpha / hueShift targets (each clamped to a safe range).
    const weight = Math.max(0.05, style.weight + resolved.strokeWeightMod);
    const alpha = Math.max(0, Math.min(255, style.alpha + resolved.alphaMod));
    const c = resolved.hueShift ? shiftHue(pg, style.color, resolved.hueShift) : pg.color(style.color);
    c.setAlpha(alpha);
    pg.stroke(c);
    pg.strokeWeight(weight);
    pg.noFill();

    pg.rotate(resolved.rotation);
    pg.scale(resolved.scale);
    const type = layer.primitive.type;
    resolved.instances.forEach((inst) => drawPrimitive(pg, type, inst));
    pg.pop();
  });
}
