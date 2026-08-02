// The command-matching engine: command packs register their {patterns,
// respond} pairs here, and dispatch() picks the best match for a heard
// phrase, falling back to arithmetic and then Gemini. Deliberately takes
// `speak` as a parameter rather than importing the assistant runtime, so
// this whole module — the trickiest part of Charlie's "brain" — can be unit
// tested with a fake speak() and no DOM at all (see tests/registry.test.js).
import { solveMathQuestion } from './math.js';
import { askGemini } from './gemini.js';

const commands = [];

// Picks the MOST SPECIFIC match rather than the first one found in
// registration order — with 100+ patterns, some are substrings of others
// (e.g. "stop" vs "stop timer"), so the longest matching pattern wins
// regardless of which pack registered it.
const patternRegexCache = new Map();

export function patternMatches(lower, pattern) {
  let re = patternRegexCache.get(pattern);
  if (!re) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word-boundary match, not a raw substring match — otherwise short
    // patterns like "yo" or "sing" fire inside unrelated words ("new YOrk",
    // "increaSING") and short-circuit real questions before they ever
    // reach Gemini. \b only applies where the pattern actually starts/ends
    // on a word character, so punctuation-adjacent patterns still work.
    const startsWord = /^\w/.test(pattern);
    const endsWord = /\w$/.test(pattern);
    re = new RegExp(`${startsWord ? '\\b' : ''}${escaped}${endsWord ? '\\b' : ''}`);
    patternRegexCache.set(pattern, re);
  }
  return re.test(lower);
}

export function findBestCommand(lower) {
  let best = null;
  let bestLength = -1;
  for (const cmd of commands) {
    for (const pattern of cmd.patterns) {
      if (pattern.length > bestLength && patternMatches(lower, pattern)) {
        best = cmd;
        bestLength = pattern.length;
      }
    }
  }
  return best;
}

// A "pack" is an array of {patterns, respond} entries — see commands/packs/.
export function registerPack(pack) {
  commands.push(...pack);
}

// onBeforeGemini is an optional callback fired right before the Gemini
// network call — the one path here slow enough to deserve its own "Core"
// state (see core/assistant.js, which passes setState('connecting')).
export async function dispatch(transcript, speak, onBeforeGemini) {
  const lower = transcript.toLowerCase();
  const match = findBestCommand(lower);

  if (match) {
    const reply = match.respond(transcript);
    // Some commands (like battery status) need to await a browser API.
    speak(reply && typeof reply.then === 'function' ? await reply : reply);
    return;
  }

  // No keyword command matched — try it as an arithmetic question
  // ("what is 5 plus 3") before falling back to Gemini for anything else.
  const mathAnswer = solveMathQuestion(transcript);
  if (mathAnswer !== null) {
    speak(mathAnswer);
    return;
  }

  onBeforeGemini?.();
  speak(await askGemini(transcript));
}
