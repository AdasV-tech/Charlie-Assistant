import { randomFrom } from '../../lib/utils.js';

export const healthMotivationPack = [
  {
    patterns: ['motivate me', 'inspire me', 'give me a quote'],
    respond: () =>
      randomFrom([
        'Small steps every day still get you there.',
        'The best time to start was yesterday. The next best time is now.',
        'Progress, not perfection.',
        "You don't have to see the whole staircase, just take the first step.",
      ]),
  },
  {
    patterns: ['give me a workout tip', 'workout tip'],
    respond: () =>
      randomFrom([
        'Warm up for five minutes before lifting heavy — cold muscles get injured muscles.',
        'Progressive overload beats a perfect program. Small increases, every week.',
        'Rest days are part of training, not a break from it.',
      ]),
  },
  {
    patterns: ['give me a diet tip', 'diet tip'],
    respond: () =>
      randomFrom([
        'Protein at every meal keeps you fuller for longer.',
        'Drinking water before a meal can help you notice when you are actually full.',
        'Whole foods first, supplements second.',
      ]),
  },
  {
    patterns: ['breathing exercise', 'help me relax'],
    respond: () =>
      "Let's try it: breathe in for four seconds, hold for four, breathe out for four. Repeat that a few times.",
  },
];
