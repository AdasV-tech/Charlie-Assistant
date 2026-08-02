import { solveAdvancedMath, convertUnits } from '../math.js';

export const mathUnitsPack = [
  {
    patterns: ['percent of', 'square root of', 'to the power of', 'squared', 'cubed'],
    respond: (transcript) => solveAdvancedMath(transcript),
  },
  {
    patterns: [
      'convert',
      'to miles',
      'to km',
      'to kilometers',
      'to kg',
      'to pounds',
      'to celsius',
      'to fahrenheit',
    ],
    respond: (transcript) => {
      const result = convertUnits(transcript);
      return (
        result ||
        "Try something like 'convert 5 kilometers to miles' or '20 celsius to fahrenheit'."
      );
    },
  },
];
