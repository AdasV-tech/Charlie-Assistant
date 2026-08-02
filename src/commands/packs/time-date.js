export const timeDatePack = [
  {
    patterns: ['what time is it', "what's the time", 'current time'],
    respond: () =>
      `The current time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
  },
  {
    patterns: ["what's the date", 'what is the date', "today's date", 'what day is it'],
    respond: () =>
      `Today is ${new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
  },
  {
    patterns: ['what month is it', 'current month'],
    respond: () => `It's ${new Date().toLocaleDateString([], { month: 'long' })}.`,
  },
  {
    patterns: ['what year is it', 'current year'],
    respond: () => `It's ${new Date().getFullYear()}.`,
  },
  {
    patterns: ['day of the week'],
    respond: () => `Today is ${new Date().toLocaleDateString([], { weekday: 'long' })}.`,
  },
  {
    patterns: ['days until new year'],
    respond: () => {
      const now = new Date();
      const newYear = new Date(now.getFullYear() + 1, 0, 1);
      const days = Math.ceil((newYear - now) / 86400000);
      return `There are ${days} days until New Year's Day.`;
    },
  },
];
