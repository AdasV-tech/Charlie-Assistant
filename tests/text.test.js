import { describe, it, expect } from 'vitest';
import { extractAfterMarkers, extractName } from '../src/commands/text.js';

describe('extractAfterMarkers', () => {
  it('returns the text after the first matching marker', () => {
    expect(extractAfterMarkers('take a note buy milk', ['take a note'])).toBe('buy milk');
  });

  it('tries markers in order and returns the first hit', () => {
    expect(extractAfterMarkers('remind me to stretch', ['remind me to', 'add a reminder'])).toBe(
      'stretch',
    );
  });

  it('returns null when no marker is present', () => {
    expect(extractAfterMarkers('what time is it', ['take a note'])).toBeNull();
  });

  it('returns null when the marker is present but nothing follows it', () => {
    expect(extractAfterMarkers('take a note', ['take a note'])).toBeNull();
  });
});

describe('extractName', () => {
  it('extracts and capitalizes a name after "my name is"', () => {
    expect(extractName('my name is adas')).toBe('Adas');
  });

  it('extracts a name after "call me"', () => {
    expect(extractName('call me Charlie')).toBe('Charlie');
  });

  it('strips punctuation from the captured word', () => {
    expect(extractName('my name is Adas!')).toBe('Adas');
  });

  it('returns null when no marker matches', () => {
    expect(extractName('what is your name')).toBeNull();
  });
});
