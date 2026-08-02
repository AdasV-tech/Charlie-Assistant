import { getUserLabel } from '../../store/stores.js';
import { randomFrom } from '../../lib/utils.js';
import { getCurrentWeather } from '../../dashboard/weatherService.js';

export const smalltalkPack = [
  {
    patterns: ['hello', 'hi there', 'hey'],
    respond: () => `Hello ${getUserLabel()}, how can I help?`,
  },
  {
    patterns: ['what can you do', 'what are your features', 'help me', 'help'],
    respond: () =>
      "I can do quite a lot now — time and date, jokes and games, quick math and unit conversions, notes and reminders, timers, opening websites, and controlling the food scanner, profile, and dashboard tabs. And for anything else — real questions, explanations, advice — just ask me directly and I'll answer using Gemini.",
  },
  {
    patterns: ['thank you', 'thanks charlie', 'thanks'],
    respond: () => "You're welcome!",
  },
  {
    patterns: ['how are you'],
    respond: () => "I'm running smoothly, thanks for asking. How are you?",
  },
  {
    patterns: ['good morning'],
    respond: () => `Good morning, ${getUserLabel()}. Ready when you are.`,
  },
  {
    patterns: ['good night', 'goodnight'],
    respond: () => `Good night, ${getUserLabel()}. I'll be here whenever you need me.`,
  },
  {
    patterns: ['good afternoon'],
    respond: () => `Good afternoon, ${getUserLabel()}.`,
  },
  {
    patterns: ['see you later', 'goodbye', 'bye'],
    respond: () => `See you later, ${getUserLabel()}.`,
  },
  {
    patterns: ['nice to meet you'],
    respond: () => `Nice to meet you too, ${getUserLabel()}.`,
  },
  {
    patterns: ['yo', 'sup', "what's up", 'whats up'],
    respond: () => 'Not much, just here waiting for your next command.',
  },
  {
    patterns: ['i love you'],
    respond: () => "That's kind of you to say — I appreciate you too.",
  },
  {
    patterns: ["you're awesome", 'you are awesome', 'good job', 'well done'],
    respond: () => 'Thank you, I try my best!',
  },
  {
    patterns: ['compliment me', 'say something nice'],
    respond: () =>
      randomFrom([
        'You showed up and asked — that already puts you ahead of most days.',
        "You've got great taste in voice assistants, clearly.",
        'Your curiosity is honestly one of your best features.',
      ]),
  },
  {
    patterns: ['roast me'],
    respond: () =>
      randomFrom([
        "I'd roast you, but you're already on fire with awesomeness.",
        'Sorry, my insult module got replaced with a compliment module.',
        "The only bug I can find in you is that you're too hard on yourself.",
      ]),
  },
  {
    patterns: ['never mind', 'nevermind', 'cancel that'],
    respond: () => 'Okay, cancelled.',
  },
  {
    patterns: ["what's the weather", 'what is the weather', 'is it raining'],
    respond: () =>
      getCurrentWeather()
        .then(
          (weather) =>
            `It's ${Math.round(weather.temperature)} degrees and ${weather.label.toLowerCase()} right now.`,
        )
        .catch(
          () =>
            'I need location access to check that — enable it when your browser asks, or check the weather widget on the Dashboard.',
        ),
  },
];
