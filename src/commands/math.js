// Pure arithmetic/unit-conversion parsing — no DOM, no state, fully
// unit-testable in isolation (see tests/math.test.js).

// Answers simple spoken arithmetic like "what is 5 plus 3" or "what's 10
// times 4". Returns null if the phrase isn't a recognizable math question.
export function solveMathQuestion(transcript) {
  const lower = transcript.toLowerCase();
  const match = lower.match(
    /(-?\d+(?:\.\d+)?)\s*(plus|minus|times|multiplied by|divided by|over)\s*(-?\d+(?:\.\d+)?)/,
  );
  if (!match) return null;

  const a = parseFloat(match[1]);
  const b = parseFloat(match[3]);
  let result;
  switch (match[2]) {
    case 'plus':
      result = a + b;
      break;
    case 'minus':
      result = a - b;
      break;
    case 'times':
    case 'multiplied by':
      result = a * b;
      break;
    case 'divided by':
    case 'over':
      if (b === 0) return "I can't divide by zero.";
      result = a / b;
      break;
    default:
      return null;
  }
  return `That's ${result}.`;
}

// Handles percentages, square roots, powers, squaring and cubing —
// "what's 20 percent of 50", "square root of 81", "5 to the power of 3".
export function solveAdvancedMath(transcript) {
  const lower = transcript.toLowerCase();

  let match = lower.match(/(-?\d+(?:\.\d+)?)\s*percent of\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    return `That's ${(parseFloat(match[1]) / 100) * parseFloat(match[2])}.`;
  }

  match = lower.match(/square root of\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    const n = parseFloat(match[1]);
    return n < 0 ? "I can't take the square root of a negative number." : `That's ${Math.sqrt(n)}.`;
  }

  match = lower.match(/(-?\d+(?:\.\d+)?)\s*to the power of\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    return `That's ${Math.pow(parseFloat(match[1]), parseFloat(match[2]))}.`;
  }

  match = lower.match(/(-?\d+(?:\.\d+)?)\s*squared/);
  if (match) {
    const n = parseFloat(match[1]);
    return `That's ${n * n}.`;
  }

  match = lower.match(/(-?\d+(?:\.\d+)?)\s*cubed/);
  if (match) {
    const n = parseFloat(match[1]);
    return `That's ${n * n * n}.`;
  }

  return "Tell me the numbers, like 'what's 20 percent of 50' or 'square root of 81'.";
}

// Recognizes "5 km to miles" style unit conversions. Supports distance
// (km/miles), weight (kg/pounds), and temperature (celsius/fahrenheit).
export function normalizeUnit(unit) {
  if (/^(km|kilomet)/.test(unit)) return 'km';
  if (/^mi/.test(unit)) return 'miles';
  if (/^(kg|kilogram)/.test(unit)) return 'kg';
  if (/^(pound|lbs?)/.test(unit)) return 'pounds';
  return unit; // celsius / fahrenheit already match their own names
}

export function convertUnits(transcript) {
  const lower = transcript.toLowerCase();
  const unitAlternation =
    'kilometers?|kilometres?|km|miles?|mi|kilograms?|kg|pounds?|lbs?|celsius|fahrenheit';
  const re = new RegExp(
    `(-?\\d+(?:\\.\\d+)?)\\s*(${unitAlternation})\\s*(?:to|in)\\s*(${unitAlternation})`,
  );
  const match = lower.match(re);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const from = normalizeUnit(match[2]);
  const to = normalizeUnit(match[3]);
  if (from === to) return `That's already in ${to}.`;

  const conversions = {
    'km->miles': (v) => v * 0.621371,
    'miles->km': (v) => v * 1.60934,
    'kg->pounds': (v) => v * 2.20462,
    'pounds->kg': (v) => v * 0.453592,
    'celsius->fahrenheit': (v) => (v * 9) / 5 + 32,
    'fahrenheit->celsius': (v) => ((v - 32) * 5) / 9,
  };
  const fn = conversions[`${from}->${to}`];
  if (!fn) return null;
  const result = Math.round(fn(value) * 100) / 100;
  return `${value} ${from} is about ${result} ${to}.`;
}
