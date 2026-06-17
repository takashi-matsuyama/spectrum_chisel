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
    case 'point':
    default:
      pg.point(inst.x, inst.y);
      break;
  }
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

  const c = pg.color(style.color);
  c.setAlpha(style.alpha);
  pg.stroke(c);
  pg.strokeWeight(style.weight);
  pg.noFill();

  // The band's IntensityGain / AngleSpeed sliders apply uniformly to the whole
  // pattern, mirroring how the built-in styles consume them.
  pg.rotate(frameCount * 0.01 * angleSpeed);
  pg.scale(intensityGain);

  // Energy normalized to [0,1] is the primary modulation source; index is
  // resolved per-instance inside resolveInstances.
  const sources = { energy: energy / 255, time, index: 0, constant: 1 };

  spec.layers.forEach((layer) => {
    const resolved = resolveInstances(layer, sources);
    if (resolved.instances.length === 0) return;
    pg.push();
    pg.rotate(resolved.rotation);
    pg.scale(resolved.scale);
    const type = layer.primitive.type;
    resolved.instances.forEach((inst) => drawPrimitive(pg, type, inst));
    pg.pop();
  });
}
