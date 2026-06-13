import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getTheme, setTheme, getReducedMotion, setReducedMotion, applyTheme, THEMES } from './theme';

describe('theme.js', () => {
  let matchMediaMock;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-reduced-motion');

    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMediaMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getTheme', () => {
    it('returns default light theme when nothing is stored', () => {
      expect(getTheme()).toBe('light');
    });

    it('returns stored theme if it is valid', () => {
      localStorage.setItem('db-theme', 'dark');
      expect(getTheme()).toBe('dark');

      localStorage.setItem('db-theme', 'sepia');
      expect(getTheme()).toBe('sepia');
    });

    it('returns default light theme if stored theme is invalid', () => {
      localStorage.setItem('db-theme', 'neon');
      expect(getTheme()).toBe('light');
    });

    it('returns light if localStorage throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
      expect(getTheme()).toBe('light');
      getItemSpy.mockRestore();
    });
  });

  describe('setTheme', () => {
    it('sets valid theme to localStorage and applies it', () => {
      setTheme('dark');
      expect(localStorage.getItem('db-theme')).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('does not set invalid theme to localStorage', () => {
      setTheme('dark');
      setTheme('neon');
      expect(localStorage.getItem('db-theme')).toBe('dark'); // Remains previous
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('handles localStorage throwing', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
      setTheme('sepia');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light'); // Could not save, falls back
      setItemSpy.mockRestore();
    });
  });

  describe('getReducedMotion', () => {
    it('returns true if "1" is stored', () => {
      localStorage.setItem('db-reduced-motion', '1');
      expect(getReducedMotion()).toBe(true);
    });

    it('returns false if "0" is stored', () => {
      localStorage.setItem('db-reduced-motion', '0');
      expect(getReducedMotion()).toBe(false);
    });

    it('falls back to matchMedia if nothing stored', () => {
      matchMediaMock.mockImplementation((query) => ({
        matches: true,
      }));
      expect(getReducedMotion()).toBe(true);
    });

    it('falls back to matchMedia if invalid value stored', () => {
      localStorage.setItem('db-reduced-motion', 'invalid');
      matchMediaMock.mockImplementation((query) => ({
        matches: true,
      }));
      expect(getReducedMotion()).toBe(true);
    });

    it('returns false if matchMedia throws or is missing', () => {
      vi.stubGlobal('matchMedia', undefined);
      expect(getReducedMotion()).toBe(false);
    });
  });

  describe('setReducedMotion', () => {
    it('sets "1" for true and applies it', () => {
      setReducedMotion(true);
      expect(localStorage.getItem('db-reduced-motion')).toBe('1');
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    });

    it('sets "0" for false and applies it', () => {
      setReducedMotion(false);
      expect(localStorage.getItem('db-reduced-motion')).toBe('0');
      expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
    });
  });

  describe('applyTheme', () => {
    it('sets data-theme and data-reduced-motion appropriately', () => {
      localStorage.setItem('db-theme', 'sepia');
      localStorage.setItem('db-reduced-motion', '1');
      applyTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    });

    it('removes data-reduced-motion if false', () => {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
      localStorage.setItem('db-theme', 'light');
      localStorage.setItem('db-reduced-motion', '0');
      applyTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
    });
  });
});
