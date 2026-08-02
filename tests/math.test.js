import { describe, it, expect } from 'vitest';
import {
  solveMathQuestion,
  solveAdvancedMath,
  convertUnits,
  normalizeUnit,
} from '../src/commands/math.js';

describe('solveMathQuestion', () => {
  it('adds two numbers', () => {
    expect(solveMathQuestion('what is 5 plus 3')).toBe("That's 8.");
  });

  it('subtracts', () => {
    expect(solveMathQuestion('10 minus 4')).toBe("That's 6.");
  });

  it('multiplies with either phrasing', () => {
    expect(solveMathQuestion('6 times 7')).toBe("That's 42.");
    expect(solveMathQuestion('6 multiplied by 7')).toBe("That's 42.");
  });

  it('divides with either phrasing', () => {
    expect(solveMathQuestion('20 divided by 4')).toBe("That's 5.");
    expect(solveMathQuestion('20 over 4')).toBe("That's 5.");
  });

  it('refuses to divide by zero', () => {
    expect(solveMathQuestion('5 divided by 0')).toBe("I can't divide by zero.");
  });

  it('returns null for non-math phrases', () => {
    expect(solveMathQuestion('what is your name')).toBeNull();
  });
});

describe('solveAdvancedMath', () => {
  it('computes a percentage', () => {
    expect(solveAdvancedMath("what's 20 percent of 50")).toBe("That's 10.");
  });

  it('computes a square root', () => {
    expect(solveAdvancedMath('square root of 81')).toBe("That's 9.");
  });

  it('refuses a negative square root', () => {
    expect(solveAdvancedMath('square root of -4')).toBe(
      "I can't take the square root of a negative number.",
    );
  });

  it('computes a power', () => {
    expect(solveAdvancedMath('5 to the power of 3')).toBe("That's 125.");
  });

  it('computes squared and cubed', () => {
    expect(solveAdvancedMath('4 squared')).toBe("That's 16.");
    expect(solveAdvancedMath('3 cubed')).toBe("That's 27.");
  });

  it('falls back to a hint when nothing matches', () => {
    expect(solveAdvancedMath('tell me a joke')).toMatch(/percent of/);
  });
});

describe('normalizeUnit', () => {
  it('normalizes distance/weight aliases', () => {
    expect(normalizeUnit('kilometers')).toBe('km');
    expect(normalizeUnit('miles')).toBe('miles');
    expect(normalizeUnit('kg')).toBe('kg');
    expect(normalizeUnit('lbs')).toBe('pounds');
  });

  it('passes temperature units through unchanged', () => {
    expect(normalizeUnit('celsius')).toBe('celsius');
    expect(normalizeUnit('fahrenheit')).toBe('fahrenheit');
  });
});

describe('convertUnits', () => {
  it('converts km to miles', () => {
    expect(convertUnits('5 kilometers to miles')).toBe('5 km is about 3.11 miles.');
  });

  it('converts celsius to fahrenheit', () => {
    expect(convertUnits('20 celsius to fahrenheit')).toBe('20 celsius is about 68 fahrenheit.');
  });

  it('returns null when no conversion phrase is present', () => {
    expect(convertUnits('what time is it')).toBeNull();
  });

  it('short-circuits when units already match', () => {
    expect(convertUnits('5 km to km')).toBe("That's already in km.");
  });
});
