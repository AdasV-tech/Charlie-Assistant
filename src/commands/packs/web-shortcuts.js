import { extractAfterMarkers } from '../text.js';
import { setState } from '../../core/assistant.js';

function openInNewTab(url) {
  window.open(url, '_blank');
}

export const webShortcutsPack = [
  {
    patterns: ['open google'],
    respond: () => {
      openInNewTab('https://www.google.com');
      return 'Opening Google.';
    },
  },
  {
    patterns: ['open youtube'],
    respond: () => {
      openInNewTab('https://www.youtube.com');
      return 'Opening YouTube.';
    },
  },
  {
    patterns: ['search for'],
    respond: (transcript) => {
      const query = transcript.toLowerCase().split('search for')[1];
      if (query && query.trim()) {
        setState('searching');
        openInNewTab(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`);
        return `Searching for ${query.trim()}.`;
      }
      return 'What would you like me to search for?';
    },
  },
  {
    patterns: ['open gmail'],
    respond: () => {
      openInNewTab('https://mail.google.com');
      return 'Opening Gmail.';
    },
  },
  {
    patterns: ['open maps', 'open google maps'],
    respond: () => {
      openInNewTab('https://maps.google.com');
      return 'Opening Maps.';
    },
  },
  {
    patterns: ['open spotify'],
    respond: () => {
      openInNewTab('https://open.spotify.com');
      return 'Opening Spotify.';
    },
  },
  {
    patterns: ['open netflix'],
    respond: () => {
      openInNewTab('https://www.netflix.com');
      return 'Opening Netflix.';
    },
  },
  {
    patterns: ['open amazon'],
    respond: () => {
      openInNewTab('https://www.amazon.com');
      return 'Opening Amazon.';
    },
  },
  {
    patterns: ['open wikipedia'],
    respond: () => {
      openInNewTab('https://www.wikipedia.org');
      return 'Opening Wikipedia.';
    },
  },
  {
    patterns: ['open github'],
    respond: () => {
      openInNewTab('https://github.com');
      return 'Opening GitHub.';
    },
  },
  {
    patterns: ['open reddit'],
    respond: () => {
      openInNewTab('https://www.reddit.com');
      return 'Opening Reddit.';
    },
  },
  {
    patterns: ['open twitter', 'open x'],
    respond: () => {
      openInNewTab('https://x.com');
      return 'Opening X.';
    },
  },
  {
    patterns: ['open instagram'],
    respond: () => {
      openInNewTab('https://www.instagram.com');
      return 'Opening Instagram.';
    },
  },
  {
    patterns: ['open facebook'],
    respond: () => {
      openInNewTab('https://www.facebook.com');
      return 'Opening Facebook.';
    },
  },
  {
    patterns: ['open whatsapp'],
    respond: () => {
      openInNewTab('https://web.whatsapp.com');
      return 'Opening WhatsApp.';
    },
  },
  {
    patterns: ['open chatgpt'],
    respond: () => {
      openInNewTab('https://chat.openai.com');
      return 'Opening ChatGPT.';
    },
  },
  {
    patterns: ['open translate'],
    respond: () => {
      openInNewTab('https://translate.google.com');
      return 'Opening Translate.';
    },
  },
  {
    patterns: ['search wikipedia for'],
    respond: (transcript) => {
      const query = extractAfterMarkers(transcript, ['search wikipedia for']);
      if (!query) return 'What would you like me to look up on Wikipedia?';
      setState('searching');
      openInNewTab(
        `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`,
      );
      return `Searching Wikipedia for ${query}.`;
    },
  },
  {
    patterns: ['search youtube for'],
    respond: (transcript) => {
      const query = extractAfterMarkers(transcript, ['search youtube for']);
      if (!query) return 'What would you like me to search for on YouTube?';
      setState('searching');
      openInNewTab(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
      return `Searching YouTube for ${query}.`;
    },
  },
];
