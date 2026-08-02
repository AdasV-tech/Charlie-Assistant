import { describe, it, expect } from 'vitest';
import { stripMarkdownForSpeech } from '../src/commands/gemini.js';

describe('stripMarkdownForSpeech', () => {
  it('removes code fences entirely', () => {
    expect(stripMarkdownForSpeech('before\n```js\nconst x = 1;\n```\nafter')).toBe('before. after');
  });

  it('strips asterisks, underscores, backticks, and hashes', () => {
    expect(stripMarkdownForSpeech('**bold** and _italic_ and `code` and # heading')).toBe(
      'bold and italic and code and heading',
    );
  });

  it('strips leading bullet markers, joining single-newline-separated lines with a space', () => {
    expect(stripMarkdownForSpeech('- first\n- second')).toBe('first second');
  });

  it('turns paragraph breaks (2+ newlines) into sentence breaks', () => {
    expect(stripMarkdownForSpeech('line one\n\n\nline two')).toBe('line one. line two');
  });
});
