import { describe, it, expect } from 'vitest';
import {
  pickVideoFormat,
  baseMimeType,
  VIDEO_FORMAT_CANDIDATES,
} from '../src/core/video-format.js';

describe('pickVideoFormat', () => {
  it('prefers WebM VP9 when everything is supported (Chromium)', () => {
    const format = pickVideoFormat(() => true);
    expect(format).toEqual({ mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' });
  });

  it('falls back to WebM VP8 when VP9 is unsupported (Firefox)', () => {
    const format = pickVideoFormat((type) => !type.includes('vp9'));
    expect(format).toEqual({ mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' });
  });

  it('falls back to MP4 when WebM is unsupported (Safari)', () => {
    const format = pickVideoFormat((type) => type.startsWith('video/mp4'));
    expect(format?.extension).toBe('mp4');
  });

  it('returns null when nothing is supported', () => {
    expect(pickVideoFormat(() => false)).toBeNull();
  });

  it('treats a throwing predicate as unsupported', () => {
    expect(
      pickVideoFormat(() => {
        throw new Error('bad type');
      })
    ).toBeNull();
  });

  it('only offers webm and mp4 extensions', () => {
    for (const candidate of VIDEO_FORMAT_CANDIDATES) {
      expect(['webm', 'mp4']).toContain(candidate.extension);
    }
  });
});

describe('baseMimeType', () => {
  it('strips the codecs parameter', () => {
    expect(baseMimeType('video/webm;codecs=vp8,opus')).toBe('video/webm');
  });

  it('returns the type unchanged when there is no codecs parameter', () => {
    expect(baseMimeType('video/mp4')).toBe('video/mp4');
  });
});
