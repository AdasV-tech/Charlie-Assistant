import { requestSleep } from '../../core/assistant.js';

export const systemPack = [
  {
    patterns: ['stop', 'stop listening', 'go to sleep', 'sleep'],
    respond: () => {
      requestSleep();
      return 'Going to sleep. Tap the core to wake me.';
    },
  },
  {
    patterns: ['turn off', 'power off', 'shut down', 'power down'],
    respond: () => {
      requestSleep();
      return 'Powering down. Tap the core when you need me again.';
    },
  },
  {
    patterns: ['battery level', 'battery status', "what's my battery", 'how much battery'],
    respond: () => {
      if (!navigator.getBattery) return "This browser doesn't expose battery information.";
      return navigator.getBattery().then((battery) => {
        const pct = Math.round(battery.level * 100);
        return `Your battery is at ${pct}%${battery.charging ? ' and charging' : ''}.`;
      });
    },
  },
];
