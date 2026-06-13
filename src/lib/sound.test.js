import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sound module', () => {
  let originalAudioContext;
  let originalWebkitAudioContext;

  beforeEach(() => {
    originalAudioContext = window.AudioContext;
    originalWebkitAudioContext = window.webkitAudioContext;
    vi.resetModules();
  });

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    window.webkitAudioContext = originalWebkitAudioContext;
  });

  it('handles AudioContext initialization failure gracefully', async () => {
    // Mock AudioContext to throw
    window.AudioContext = class {
      constructor() {
        throw new Error('Not supported');
      }
    };
    window.webkitAudioContext = undefined;

    const { sfx } = await import('./sound.js');

    // If it throws, this expect will fail.
    // If it handles it gracefully, it will pass.
    expect(() => sfx.click()).not.toThrow();
  });

  it('handles webkitAudioContext initialization failure gracefully', async () => {
    window.AudioContext = undefined;
    window.webkitAudioContext = class {
      constructor() {
        throw new Error('Not supported');
      }
    };

    const { sfx } = await import('./sound.js');

    expect(() => sfx.click()).not.toThrow();
  });

  it('handles missing AudioContext completely gracefully', async () => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;

    const { sfx } = await import('./sound.js');

    expect(() => sfx.click()).not.toThrow();
  });
});
