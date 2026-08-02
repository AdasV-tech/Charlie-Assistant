import { randomFrom } from '../../lib/utils.js';

export const gamesPack = [
  {
    patterns: ['tell me a joke', 'joke'],
    respond: () =>
      randomFrom([
        'Why do programmers prefer dark mode? Because light attracts bugs.',
        'I would tell you a UDP joke, but you might not get it.',
        'Why did the robot go on a diet? It had too many bytes.',
      ]),
  },
  {
    patterns: ['flip a coin', 'toss a coin'],
    respond: () => (Math.random() < 0.5 ? 'Heads.' : 'Tails.'),
  },
  {
    patterns: ['roll a dice', 'roll a die', 'roll the dice'],
    respond: () => `You rolled a ${1 + Math.floor(Math.random() * 6)}.`,
  },
  {
    patterns: ['rock paper scissors'],
    respond: () => `I choose ${randomFrom(['rock', 'paper', 'scissors'])}!`,
  },
  {
    // Deliberately narrow: bare "should i" / "will i" used to catch almost
    // any real question phrased that way ("should I learn Python or JS
    // first?") and hijack it into a joke reply instead of a real answer.
    // Now it only fires when the magic 8 ball is asked for by name.
    patterns: ['magic 8 ball', 'ask the 8 ball', 'shake the 8 ball'],
    respond: () =>
      randomFrom([
        'It is certain.',
        'Without a doubt.',
        'Yes, definitely.',
        'Reply hazy, try again.',
        'Ask again later.',
        'Better not tell you now.',
        'My reply is no.',
        'Signs point to yes.',
        'Very doubtful.',
      ]),
  },
  {
    patterns: ['tell me a riddle'],
    respond: () =>
      randomFrom([
        'What has to be broken before you can use it? An egg.',
        "I'm tall when I'm young and short when I'm old. What am I? A candle.",
        'What has keys but no locks? A piano.',
        'What has a face and two hands but no arms or legs? A clock.',
      ]),
  },
  {
    patterns: ['tell me a scary story', 'tell me a story'],
    respond: () =>
      randomFrom([
        'Once, a program ran perfectly on the first try. No one who saw it ever spoke of it again.',
        "The developer said 'it works on my machine' — and then the lights flickered.",
        'There was a bug so old, nobody remembered who wrote the code around it.',
      ]),
  },
  {
    patterns: ['would you rather'],
    respond: () =>
      randomFrom([
        'Would you rather have unlimited coffee or unlimited sleep?',
        'Would you rather explore space or the deep ocean?',
        'Would you rather always know when someone is lying, or always get away with lying?',
      ]),
  },
  {
    patterns: ['truth or dare'],
    respond: () =>
      randomFrom([
        "Truth: what's the last thing you Googled?",
        'Dare: send a compliment to the next person you message.',
        "Truth: what's a skill you'd love to learn?",
      ]),
  },
  {
    patterns: ['pick a number'],
    respond: () => `I'm thinking of ${1 + Math.floor(Math.random() * 100)}.`,
  },
];
