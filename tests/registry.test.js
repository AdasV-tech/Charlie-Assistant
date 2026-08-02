import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerPack,
  findBestCommand,
  patternMatches,
  dispatch,
} from '../src/commands/registry.js';

describe('patternMatches', () => {
  it('matches a pattern on a word boundary', () => {
    expect(patternMatches('tell me a joke please', 'joke')).toBe(true);
  });

  it('does not match a pattern hidden inside a longer word', () => {
    // "sing" must not fire inside "increasing" — see the original bug this guards against.
    expect(patternMatches('costs are increasing', 'sing')).toBe(false);
  });

  it('matches short two-letter patterns like "yo" as a whole word only', () => {
    expect(patternMatches('yo charlie', 'yo')).toBe(true);
    expect(patternMatches('new york', 'yo')).toBe(false);
  });
});

describe('findBestCommand', () => {
  beforeEach(() => {
    registerPack([
      { patterns: ['stop'], respond: () => 'short' },
      { patterns: ['stop timer'], respond: () => 'long' },
    ]);
  });

  it('picks the longer, more specific pattern when both match', () => {
    const match = findBestCommand('please stop timer now');
    expect(match.respond()).toBe('long');
  });

  it('falls back to the shorter pattern when only it matches', () => {
    const match = findBestCommand('stop please');
    expect(match.respond()).toBe('short');
  });

  it('returns null when nothing matches', () => {
    expect(findBestCommand('gibberish that matches nothing at all')).toBeNull();
  });
});

describe('dispatch', () => {
  it("speaks the matched command's response", async () => {
    registerPack([{ patterns: ['ping'], respond: () => 'pong' }]);
    const speak = vi.fn();
    await dispatch('ping', speak);
    expect(speak).toHaveBeenCalledWith('pong');
  });

  it('awaits an async respond() before speaking', async () => {
    registerPack([{ patterns: ['async ping'], respond: async () => 'async pong' }]);
    const speak = vi.fn();
    await dispatch('async ping', speak);
    expect(speak).toHaveBeenCalledWith('async pong');
  });

  it('falls back to arithmetic when no command matches', async () => {
    const speak = vi.fn();
    await dispatch('what is 2 plus 2', speak);
    expect(speak).toHaveBeenCalledWith("That's 4.");
  });
});
