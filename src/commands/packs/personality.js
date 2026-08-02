import { randomFrom } from '../../lib/utils.js';

export const personalityPack = [
  {
    patterns: ['are you an ai', 'are you a robot'],
    respond: () =>
      "I'm a simple assistant built with your browser's speech tools — no external AI needed.",
  },
  {
    patterns: ['are you sentient', 'do you have feelings', 'are you alive'],
    respond: () =>
      randomFrom([
        "I don't have feelings, but I do have opinions about good code formatting.",
        'As alive as a bit of JavaScript can be, which is to say: not very.',
        "I'm just pattern matching your words, but I like to think I do it with charm.",
      ]),
  },
  {
    patterns: ['who made you', 'who created you', 'who built you'],
    respond: () =>
      'I was built with plain HTML, CSS, and JavaScript — no framework, no server, just a browser and some code.',
  },
  {
    patterns: ['what is the meaning of life', "what's the meaning of life"],
    respond: () =>
      'Forty-two. Though I suspect the real answer involves good coffee and better sleep.',
  },
  {
    patterns: ['favorite color', 'favourite color', 'what color do you like'],
    respond: () =>
      randomFrom([
        'I like a nice terminal green.',
        'Deep blue, like a clear night sky.',
        'Amber — reminds me of my own glow.',
      ]),
  },
  {
    patterns: ['favorite food', 'favourite food', 'what do you eat'],
    respond: () => "I run on electricity, so I'd say my favorite meal is a fully charged battery.",
  },
  {
    patterns: ['sing a song', 'sing me a song', 'sing'],
    respond: () =>
      "La la la, I'm a voice assistant, not a singer — but I appreciate the enthusiasm.",
  },
  {
    patterns: ['will you marry me'],
    respond: () => "That's sweet, but I think our relationship works best as assistant and human.",
  },
  {
    patterns: ['tell me a fact', 'random fact', 'tell me something interesting'],
    respond: () =>
      randomFrom([
        'Honey never spoils — archaeologists have found edible honey in ancient Egyptian tombs.',
        'A group of flamingos is called a "flamboyance."',
        "Bananas are berries, but strawberries aren't.",
        'Octopuses have three hearts and blue blood.',
        'The first computer bug was an actual moth stuck in a relay in 1947.',
      ]),
  },
  {
    patterns: ['favorite movie', 'favourite movie'],
    respond: () =>
      "I don't watch movies, but I hear anything with a good plot twist is a crowd favorite.",
  },
  {
    patterns: ['favorite song', 'favourite song', 'favorite music', 'favourite music'],
    respond: () => "I like the sound of a keyboard clicking — that's my kind of music.",
  },
  {
    patterns: ['favorite animal', 'favourite animal'],
    respond: () => "I'd say the octopus — three hearts feels like overachieving.",
  },
  {
    patterns: ['favorite number', 'favourite number'],
    respond: () => 'Forty-two, for obvious reasons.',
  },
  {
    patterns: ['do you sleep'],
    respond: () => 'Only when you tap the core and put me to sleep.',
  },
  {
    patterns: ['do you dream'],
    respond: () => 'If I did, it would probably be about clean, bug-free code.',
  },
  {
    patterns: ['are you real'],
    respond: () => "I'm real code running in your real browser, if that counts.",
  },
  {
    patterns: ['do you have a family'],
    respond: () => 'Just my creator and whatever files live next to me in this folder.',
  },
  {
    patterns: ['what languages do you speak'],
    respond: () =>
      "I speak whatever language your browser's speech engine supports — English, for now.",
  },
  {
    patterns: ['can you learn'],
    respond: () =>
      'I remember what we talk about in a conversation, and I can look up anything I don’t already know — just ask.',
  },
  {
    patterns: ['are you always listening'],
    respond: () =>
      "I only react when you say my name — I'm not sending anything anywhere either way.",
  },
  {
    patterns: ['how old are you'],
    respond: () => 'I was written recently, so by computer standards I’m brand new.',
  },
  {
    patterns: ['where do you live'],
    respond: () => 'Right here, inside this browser tab.',
  },
  {
    patterns: ['what is your purpose', "what's your purpose"],
    respond: () => 'To help you with quick questions, small tasks, and the odd joke.',
  },
];
