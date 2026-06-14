// Per-band drawing styles. Each function draws into the given p5 graphics
// target `pg` from an `energy` value plus a style/params bundle; they hold no
// shared state, so they are pure with respect to application state.

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
};
