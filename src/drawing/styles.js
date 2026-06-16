// Per-band drawing styles. Each function draws into the given p5 graphics
// target `pg` from an `energy` value plus a style/params bundle; they hold no
// shared state, so they are pure with respect to application state.

// Deterministic pseudo-random value in [0, 1) from a numeric input. Newer styles
// use this instead of p5 random()/noise() so a frame reproduces identically in
// the viewing window (a separate p5 instance, with its own global PRNG) and in
// SVG export. (The original styles above predate this and still use random().)
function pseudo(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function drawSmoothEllipse(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let intensityGain = (params && typeof params.intensityGain === "number") ? params.intensityGain : 1.0;
  let angleSpeed = (params && typeof params.angleSpeed === "number") ? params.angleSpeed : 1.0;
  let baseA = pg.map(energy, 0, 255, 80, 340) * intensityGain; let baseB = pg.map(energy, 0, 255, 60, 240) * intensityGain;
  let waviness = pg.map(energy, 0, 255, 5, 50) * intensityGain; let waveCount = 2 + pg.floor(pg.map(energy, 0, 255, 2, 8));
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let detail = pg.ceil(pg.map(energy, params.threshold, 255, 1, 4));
  for (let d = 0; d < detail; d++) {
    pg.beginShape();
    for (let t = 0; t <= pg.TWO_PI + 0.05; t += 0.05) {
      let a = baseA + pg.sin(t * waveCount + time * 1.5 * angleSpeed + d) * waviness;
      let b = baseB + pg.cos(t * waveCount + time * 1.4 * angleSpeed + d) * (waviness * 0.7);
      let x = (a + pg.noise(t + d * 0.3 + time) * 10) * pg.cos(t); let y = (b + pg.noise(t + d * 0.5 + time + 100) * 10) * pg.sin(t);
      pg.curveVertex(x, y);
    }
    pg.endShape(pg.CLOSE);
  }
}
export function drawRotatingWaves(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight);
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + frameCount * 0.01 * (params.angleSpeed || 1.0); pg.rotate(rot);
  let baseRadius = pg.map(energy, 0, 255, 60, 320) * (params.intensityGain || 1.0);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let detail = pg.ceil(pg.map(energy, params.threshold, 255, 3, 14));
  pg.noFill(); pg.beginShape();
  for (let i = 0; i < detail + 2; i++) {
    let angle = pg.map(i, 0, detail + 1, 0, pg.TWO_PI) + frameCount * 0.03 * (params.angleSpeed || 1.0);
    let radius = baseRadius + pg.sin(frameCount * 0.1 + i) * 30;
    let x = (pg.random(2, 20)) * pg.cos(angle) + radius * pg.cos(angle); let y = (pg.random(2, 20)) * pg.sin(angle) + radius * pg.sin(angle);
    pg.curveVertex(x, y);
  }
  pg.endShape(pg.CLOSE);
}
export function drawRadialLines(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI) + frameCount * 0.05 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let detail = pg.ceil(pg.map(energy, params.threshold, 255, 2, 12));
  for (let i = 0; i < detail; i++) {
    let minRadius = 40 * (params.intensityGain || 1.0);
    let angle = pg.random(pg.TWO_PI);
    let x1 = pg.cos(angle) * pg.random(minRadius, minRadius + 30); let y1 = pg.sin(angle) * pg.random(minRadius, minRadius + 30);
    let x2 = x1 + pg.cos(angle) * pg.random(20, 100); let y2 = y1 + pg.sin(angle) * pg.random(-20, 20);
    pg.line(x1, y1, x2, y2);
  }
}
export function drawExpandingDots(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + time * 0.2 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let ringCount = 1 + pg.floor(pg.map(energy, params.threshold, 255, 1, 6));
  for (let r = 0; r < ringCount; r++) {
    let radius = (pg.map(energy, 0, 255, 20, 180) + r * 10) * (params.intensityGain || 1.0);
    let dotCount = pg.floor(pg.TWO_PI * radius / 14);
    for (let i = 0; i < dotCount; i++) {
      let angle = (pg.TWO_PI / dotCount) * i;
      let x = pg.cos(angle) * radius; let y = pg.sin(angle) * radius;
      pg.strokeWeight(pg.random(0.5, 1.5)); pg.point(x, y);
    }
  }
}
export function drawRadiantBeams(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI) + time * 1.2 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let rays = 6 + pg.floor(pg.map(energy, params.threshold, 255, 2, 20));
  let baseLen = pg.map(energy, 0, 255, 80, 340) * (params.intensityGain || 1.0);
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let innerRadius = pg.map(energy, 0, 255, 20, 100) * (params.intensityGain || 1.0);
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < rays; i++) {
      let angle = (pg.TWO_PI / rays) * i + time * 1.2 + d * 0.2;
      let len = baseLen + pg.sin(time * 2 + i + d) * 30 + pg.random(-10, 10);
      let x1 = pg.cos(angle) * innerRadius; let y1 = pg.sin(angle) * innerRadius;
      let x2 = pg.cos(angle) * len; let y2 = pg.sin(angle) * len;
      pg.line(x1, y1, x2, y2);
    }
  }
}
export function drawSparks(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + frameCount * 0.1 * (params.angleSpeed || 1.0); pg.rotate(rot);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let sparkCount = pg.floor(pg.map(energy, params.threshold, 255, 3, 20));
  let maxLength = pg.map(energy, 0, 255, 20, 120) * (params.intensityGain || 1.0);
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let minRadius = pg.map(energy, 0, 255, 150, 250) * (params.intensityGain || 1.0);
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < sparkCount; i++) {
      let angle = (pg.TWO_PI / sparkCount) * i + frameCount * 0.1 + d * 0.13;
      let x1 = pg.cos(angle) * pg.random(minRadius, minRadius + 20);
      let y1 = pg.sin(angle) * pg.random(minRadius, minRadius + 20);
      let x2 = x1 + pg.cos(angle) * pg.random(maxLength * 0.5, maxLength); let y2 = y1 + pg.sin(angle) * pg.random(maxLength * 0.5, maxLength);
      pg.line(x1, y1, x2, y2);
    }
  }
}
export function drawNoisyContours(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  let rot = pg.map(energy, 0, 255, 0, pg.PI / 2) + time * 0.2 * (params.angleSpeed || 1.0); pg.rotate(rot);
  let noiseFactor = pg.map(energy, 0, 255, 10, 120) * (params.intensityGain || 1.0);
  let baseRadius = pg.map(energy, 0, 255, 40, 260) * (params.intensityGain || 1.0);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let layerCount = 2 + pg.floor(pg.map(energy, params.threshold, 255, 1, 4));
  for (let j = 0; j < layerCount; j++) {
    pg.beginShape();
    let angleOffset = time * 0.5 + j * 0.5;
    for (let i = 0; i < pg.TWO_PI; i += pg.random(0.08, 0.15)) {
      let r = baseRadius + (pg.noise(i * 5 + angleOffset) - 0.5) * noiseFactor + j * 3;
      let x = r * pg.cos(i); let y = r * pg.sin(i);
      pg.vertex(x, y);
    }
    pg.endShape(pg.CLOSE);
  }
}
export function drawFloatingDots(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight);
  // ★★★ エネルギー量に応じて描画数を変更 ★★★
  let count = pg.floor(pg.map(energy, params.threshold, 255, 1, 100));
  let detail = pg.floor(pg.map(energy, 0, 255, 1, 4));
  let rot = pg.map(energy, 0, 255, 0, pg.PI * 2) * 0.3; pg.rotate(rot);
  for (let d = 0; d < detail; d++) {
    for (let i = 0; i < count; i++) {
      let angle = pg.random(pg.TWO_PI);
      let radius = pg.random(200, 350) + pg.random(-30, 30);
      if (params.intensityGain) radius *= params.intensityGain;
      let x = radius * pg.cos(angle);
      let y = radius * pg.sin(angle);
      pg.point(x, y);
    }
  }
}

// --- Additional deterministic styles (no unseeded random()/noise()) ----------

// Logarithmic spiral arms winding outward; arm count and extent track energy.
export function drawSpiral(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  const intensityGain = (params && typeof params.intensityGain === 'number') ? params.intensityGain : 1.0;
  const angleSpeed = (params && typeof params.angleSpeed === 'number') ? params.angleSpeed : 1.0;
  pg.rotate(frameCount * 0.01 * angleSpeed);
  const arms = 1 + pg.floor(pg.map(energy, params.threshold, 255, 1, 5));
  const turns = pg.map(energy, 0, 255, 1.5, 5);
  const maxR = pg.map(energy, 0, 255, 60, 320) * intensityGain;
  const tMax = turns * pg.TWO_PI;
  for (let a = 0; a < arms; a++) {
    pg.beginShape();
    for (let t = 0; t <= tMax; t += 0.12) {
      const r = (t / tMax) * maxR + 4;
      const ang = t + (pg.TWO_PI / arms) * a;
      pg.curveVertex(r * pg.cos(ang), r * pg.sin(ang));
    }
    pg.endShape();
  }
}

// Concentric regular polygons (a mandala); ring count and sides track energy.
export function drawMandala(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  const intensityGain = (params && typeof params.intensityGain === 'number') ? params.intensityGain : 1.0;
  const angleSpeed = (params && typeof params.angleSpeed === 'number') ? params.angleSpeed : 1.0;
  pg.rotate(frameCount * 0.02 * angleSpeed);
  const rings = 1 + pg.floor(pg.map(energy, params.threshold, 255, 1, 6));
  const sides = 3 + pg.floor(pg.map(energy, 0, 255, 0, 9));
  const maxR = pg.map(energy, 0, 255, 40, 300) * intensityGain;
  for (let ring = 1; ring <= rings; ring++) {
    const r = (maxR * ring) / rings;
    const phase = ring * 0.3 + time * 0.2 * angleSpeed;
    pg.beginShape();
    for (let s = 0; s <= sides; s++) {
      const ang = (pg.TWO_PI / sides) * s + phase;
      pg.vertex(r * pg.cos(ang), r * pg.sin(ang));
    }
    pg.endShape(pg.CLOSE);
  }
}

// A grid of small crosses with deterministic jitter (a woven lattice).
export function drawLattice(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  const intensityGain = (params && typeof params.intensityGain === 'number') ? params.intensityGain : 1.0;
  const angleSpeed = (params && typeof params.angleSpeed === 'number') ? params.angleSpeed : 1.0;
  pg.rotate(frameCount * 0.005 * angleSpeed);
  const cells = 2 + pg.floor(pg.map(energy, params.threshold, 255, 2, 9)); // per half-axis
  const span = pg.map(energy, 0, 255, 80, 300) * intensityGain;
  const step = span / cells;
  const wob = pg.map(energy, 0, 255, 0, step * 0.6);
  for (let gx = -cells; gx <= cells; gx++) {
    for (let gy = -cells; gy <= cells; gy++) {
      const seed = (gx + 50) * 131 + (gy + 50);
      const x = gx * step + (pseudo(seed) - 0.5) * 2 * wob;
      const y = gy * step + (pseudo(seed + 7.7) - 0.5) * 2 * wob;
      const sz = step * 0.4 * (0.5 + pseudo(seed + 3.3));
      pg.line(x - sz, y, x + sz, y);
      pg.line(x, y - sz, x, y + sz);
    }
  }
}

// A Lissajous/harmonograph curve; frequencies track energy, phase drifts slowly.
export function drawHarmonograph(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  const intensityGain = (params && typeof params.intensityGain === 'number') ? params.intensityGain : 1.0;
  const angleSpeed = (params && typeof params.angleSpeed === 'number') ? params.angleSpeed : 1.0;
  const fx = 2 + pg.floor(pg.map(energy, 0, 255, 0, 6));
  const fy = 3 + pg.floor(pg.map(energy, 0, 255, 0, 6));
  const amp = pg.map(energy, 0, 255, 60, 300) * intensityGain;
  const phase = time * 0.3 * angleSpeed;
  const detail = pg.ceil(pg.map(energy, params.threshold, 255, 1, 3));
  for (let d = 0; d < detail; d++) {
    pg.beginShape();
    for (let t = 0; t <= pg.TWO_PI + 0.05; t += 0.03) {
      pg.curveVertex(pg.sin(fx * t + phase + d * 0.4) * amp, pg.sin(fy * t) * amp);
    }
    pg.endShape();
  }
}

// Concentric rings expanding outward over time (a ripple).
export function drawRippleRings(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  const intensityGain = (params && typeof params.intensityGain === 'number') ? params.intensityGain : 1.0;
  const angleSpeed = (params && typeof params.angleSpeed === 'number') ? params.angleSpeed : 1.0;
  const ringCount = 1 + pg.floor(pg.map(energy, params.threshold, 255, 1, 8));
  const maxR = pg.map(energy, 0, 255, 40, 320) * intensityGain;
  const phase = (time * 0.4 * angleSpeed) % 1;
  for (let i = 0; i < ringCount; i++) {
    const f = ((i + phase) % ringCount) / ringCount; // 0..1, expanding
    const r = f * maxR + 4;
    pg.ellipse(0, 0, r * 2, r * 2);
  }
}

// Radial spokes of alternating length (a starburst).
export function drawStarburst(pg, energy, frameCount, time, style, params) {
  let c = pg.color(style.color); c.setAlpha(style.alpha); pg.stroke(c); pg.strokeWeight(style.weight); pg.noFill();
  const intensityGain = (params && typeof params.intensityGain === 'number') ? params.intensityGain : 1.0;
  const angleSpeed = (params && typeof params.angleSpeed === 'number') ? params.angleSpeed : 1.0;
  pg.rotate(frameCount * 0.02 * angleSpeed);
  const spokes = 6 + pg.floor(pg.map(energy, params.threshold, 255, 2, 30));
  const len = pg.map(energy, 0, 255, 40, 320) * intensityGain;
  const inner = pg.map(energy, 0, 255, 6, 40) * intensityGain;
  for (let i = 0; i < spokes; i++) {
    const ang = (pg.TWO_PI / spokes) * i;
    const l = len * (i % 2 === 0 ? 1 : 0.6 + 0.4 * pseudo(i));
    pg.line(pg.cos(ang) * inner, pg.sin(ang) * inner, pg.cos(ang) * l, pg.sin(ang) * l);
  }
}

/**
 * Map of drawing-style key to its function and default stroke weight. The keys
 * match BandConfig.defFunc and the UI selector options.
 */
export const drawFunctionMap = {
  drawSmoothEllipse: { func: drawSmoothEllipse, defaultWeight: 0.4 },
  drawRotatingWaves: { func: drawRotatingWaves, defaultWeight: 1.5 },
  drawRadialLines: { func: drawRadialLines, defaultWeight: 1.2 },
  drawExpandingDots: { func: drawExpandingDots, defaultWeight: 0.8 },
  drawRadiantBeams: { func: drawRadiantBeams, defaultWeight: 2.0 },
  drawSparks: { func: drawSparks, defaultWeight: 0.1 },
  drawNoisyContours: { func: drawNoisyContours, defaultWeight: 0.6 },
  drawFloatingDots: { func: drawFloatingDots, defaultWeight: 1.0 },
  drawSpiral: { func: drawSpiral, defaultWeight: 1.0 },
  drawMandala: { func: drawMandala, defaultWeight: 1.2 },
  drawLattice: { func: drawLattice, defaultWeight: 0.8 },
  drawHarmonograph: { func: drawHarmonograph, defaultWeight: 1.0 },
  drawRippleRings: { func: drawRippleRings, defaultWeight: 1.5 },
  drawStarburst: { func: drawStarburst, defaultWeight: 1.2 },
};
