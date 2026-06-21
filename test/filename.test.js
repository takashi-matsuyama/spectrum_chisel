import { describe, it, expect } from 'vitest';
import { buildTimestampedFilename } from '../src/core/filename.js';

describe('buildTimestampedFilename', () => {
  it('builds a mic, afterimage-mode name', () => {
    const name = buildTimestampedFilename({
      extension: 'svg',
      totalFrames: 30,
      frameRate: 15,
      inputMode: 'mic',
      id: 123,
      sculptureMode: false,
    });
    expect(name).toBe('sc-mic-123-moment-t2.0s-f30.svg');
  });

  it('builds a file, sculpture-mode name with a trim annotation', () => {
    const name = buildTimestampedFilename({
      extension: 'png',
      totalFrames: 45,
      frameRate: 30,
      inputMode: 'file',
      id: 999,
      sculptureMode: true,
      trim: { start: 1.2, end: 3.4, duration: 10 },
    });
    expect(name).toBe('sc-file-trim[1.2-3.4]s-999-eternity-t1.5s-f45.png');
  });

  it('omits the trim annotation when the range covers the whole source', () => {
    const name = buildTimestampedFilename({
      extension: 'svg',
      totalFrames: 10,
      frameRate: 10,
      inputMode: 'file',
      id: 7,
      sculptureMode: false,
      trim: { start: 0, end: 9.95, duration: 10 },
    });
    expect(name).toBe('sc-file-7-moment-t1.0s-f10.svg');
  });

  it('appends a plate token for color-plate exports and omits it by default', () => {
    expect(
      buildTimestampedFilename({ extension: 'svg', totalFrames: 10, frameRate: 10, inputMode: 'mic', id: 7, sculptureMode: true })
    ).toBe('sc-mic-7-eternity-t1.0s-f10.svg');
    expect(
      buildTimestampedFilename({ extension: 'svg', totalFrames: 10, frameRate: 10, inputMode: 'mic', id: 7, sculptureMode: true, plate: 'red' })
    ).toBe('sc-mic-7-eternity-t1.0s-f10-plate[red].svg');
  });
});
