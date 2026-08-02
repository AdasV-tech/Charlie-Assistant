// Small text-extraction helpers used by note/reminder/name commands — pure
// string parsing, no DOM or state.

// Pulls the text following whichever marker phrase appears first, used for
// commands like "take a note [text]" or "remind me to [text]".
export function extractAfterMarkers(transcript, markers) {
  const lower = transcript.toLowerCase();
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const raw = transcript.slice(idx + marker.length).trim();
      if (raw) return raw;
    }
  }
  return null;
}

// Very small helper to pull a name out of phrases like
// "my name is Adas" / "call me Adas".
export function extractName(transcript) {
  const lower = transcript.toLowerCase();
  const markers = ['my name is', 'call me', 'remember my name is'];
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      const raw = transcript.slice(idx + marker.length).trim();
      if (raw) {
        // Capitalize the first letter for a tidy display name.
        const firstWord = raw.split(' ')[0].replace(/[^a-zA-Z-]/g, '');
        if (firstWord) return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
      }
    }
  }
  return null;
}
