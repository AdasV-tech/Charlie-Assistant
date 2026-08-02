// Charlie's fallback "brain" for open-ended questions: anything that isn't
// a built-in command or a math question gets sent to Google's Gemini API.
// Requires a user-supplied API key saved in Settings — nothing is bundled
// or committed, since this is a public static site (see store/stores.js).
//
// Keeps a short rolling history so follow-up questions ("what about
// tomorrow?") work like a real conversation, and gives Gemini a system
// persona tuned for being spoken aloud (short, no markdown) rather than
// displayed as text.
import { geminiKeyStore } from '../store/stores.js';
import { openSettingsDrawer, focusGeminiKeyInput } from '../ui/settingsDrawer.js';

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_HISTORY_LIMIT = 16; // ~8 back-and-forth exchanges

const GEMINI_SYSTEM_INSTRUCTION = [
  'You are Charlie, a voice assistant. Your replies are converted to speech and read aloud, never displayed as text, and the user can interrupt you mid-sentence, so get to the point fast.',
  'Be as brief as possible: answer in one short sentence whenever you can, and never more than two sentences, unless the user explicitly asks for detail, steps, or a list.',
  'Never use markdown, asterisks, headers, bullet symbols, or code fences, since those get read aloud literally.',
  "Answer directly and confidently. Skip preamble, throat-clearing, and caveats. Don't say you don't know unless you truly have no reasonable answer.",
].join(' ');

let geminiHistory = [];

export function resetGeminiHistory() {
  geminiHistory = [];
}

// Strips markdown syntax Gemini might still slip in, so it never gets
// read out loud as literal asterisks/hashes/backticks.
export function stripMarkdownForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`#]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Quick, cheap call (no generation cost) just to confirm a key is valid —
// used right when the user saves it in Settings so they get instant
// feedback instead of finding out mid-conversation.
export async function verifyGeminiKey(apiKey) {
  try {
    const res = await fetch(`${GEMINI_API_BASE}?key=${encodeURIComponent(apiKey)}`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function askGemini(question) {
  const apiKey = geminiKeyStore.get();
  if (!apiKey) {
    openSettingsDrawer();
    focusGeminiKeyInput();
    return "I can look that up — I just need a free Gemini key first. I've opened Settings for you; paste one in and ask me again.";
  }

  try {
    const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const contents = [...geminiHistory, { role: 'user', parts: [{ text: question }] }];
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] },
        // maxOutputTokens has to cover Gemini's hidden "thinking" tokens as
        // well as the visible reply — anything much lower than this and the
        // model sometimes burns the whole budget thinking and gets cut off
        // mid-sentence (finishReason MAX_TOKENS with empty/partial text).
        generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        openSettingsDrawer();
        return "That Gemini API key doesn't seem to work. Double-check it in Settings — I've opened it for you.";
      }
      if (res.status === 429) {
        return "Gemini's rate limit kicked in — give it a few seconds and ask again.";
      }
      return 'I couldn’t reach Gemini just now. Try asking again in a moment.';
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const rawText = candidate?.content?.parts
      ?.map((part) => part.text || '')
      .join(' ')
      .trim();

    if (!rawText) {
      if (candidate?.finishReason === 'SAFETY') {
        return "I can't answer that one safely — try rephrasing.";
      }
      if (candidate?.finishReason === 'MAX_TOKENS') {
        return 'That answer ran long and got cut off — try asking it more specifically.';
      }
      return "Gemini didn't return an answer for that — try rephrasing the question.";
    }

    // Keep the real (unstripped) text in history for context, but speak a
    // version with markdown stripped so nothing gets read aloud literally.
    geminiHistory.push({ role: 'user', parts: [{ text: question }] });
    geminiHistory.push({ role: 'model', parts: [{ text: rawText }] });
    if (geminiHistory.length > GEMINI_HISTORY_LIMIT) {
      geminiHistory = geminiHistory.slice(-GEMINI_HISTORY_LIMIT);
    }

    return stripMarkdownForSpeech(rawText);
  } catch {
    return "I couldn't reach Gemini — check your internet connection and try again.";
  }
}
