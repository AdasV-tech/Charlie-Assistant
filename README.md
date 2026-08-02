# Charlie Assistant — V2

A lightweight, browser-based personal AI assistant with a futuristic HUD-style
interface. Charlie listens to your voice, matches it against a growing set of
commands, and speaks back — plus a food scanner, a daily dashboard, and a
personal profile. Everything runs client-side using tools already built into
your browser, with an optional Gemini API key (bring your own, stored only in
your browser) so Charlie can answer open-ended questions too. No backend
server required for the web version.

There's also a [desktop version](desktop/) — a Python app that runs on your
own machine and can open apps, run shell commands, and generate/save files,
not just talk.

![status](https://img.shields.io/badge/status-v3.0.0-3ee6ff)

---

## What's new in V2

- **📷 Food Scanner** — take or upload a food photo, then look up a health
  score, nutrition estimate, pros/cons, and a recommendation from a local
  food table.
- **🧠 Personal Profile** — save your name, age, activity level, goals, and
  favourite activities. Charlie uses it to personalise greetings.
- **🌅 Daily Dashboard** — a time-aware greeting, a customizable list of daily
  suggestions/reminders, and a Study Mode / Workout Mode focus timer.
- **⚙️ Settings drawer** — voice, rate, pitch, and memory reset moved into a
  clean slide-up panel.
- **🎤 More voice commands** — open the scanner, hear your goals, start study
  or workout mode, get today's plan, and analyze a food by name, all by
  voice.
- **Tabbed interface** — Assistant / Scanner / Dashboard / Profile, all in
  one page, no reload needed.

Everything from V1 still works exactly as before: voice input/output, the
glowing animated core, the transcript log, and local memory.

---

## Features

- **Voice input** — tap the glowing core and speak; your browser's built-in
  `SpeechRecognition` API converts your speech to text.
- **Voice output** — Charlie replies out loud using the browser's built-in
  `SpeechSynthesis` API. You can change the voice, speaking rate, and pitch
  from the settings drawer.
- **100+ built-in commands** — time, date, jokes, games, math and unit
  conversions, notes and reminders, timers, website shortcuts, greetings,
  food analysis, profile/dashboard control, and more (full list below).
- **Food Scanner** — local, on-device food lookup with a health score,
  benefits, negatives, and a recommendation. No image-recognition AI is
  used — see the disclaimer on that tab for exactly how it works.
- **Personal Profile** — name, age, activity level, goals, and favourite
  activities, saved to `localStorage`.
- **Daily Dashboard** — a customizable list of daily suggestions/reminders
  and a simple Study Mode (25 min) / Workout Mode (20 min) focus timer.
- **Local memory** — Charlie remembers your name, profile, dashboard list,
  and voice preferences using `localStorage`. Nothing ever leaves your
  device.
- **HUD-style interface** — dark background, a glowing animated core, a
  reactive waveform, and four clear states: *Sleeping*, *Listening*,
  *Thinking*, *Speaking*.
- **Works on phone or PC** — open `index.html` on your computer, or serve it
  on your local network and open it from your phone's browser.

---

## Project Structure

```
Charlie-Assistant/
│
├── index.html              # Vite entry HTML
├── public/                 # Static passthrough — CNAME, favicon
├── src/
│   ├── main.js              # Boot sequence: registers command packs, inits every page module
│   ├── core/
│   │   └── assistant.js      # Voice state machine, speech synthesis/recognition, barge-in
│   ├── commands/
│   │   ├── registry.js        # Pattern matching + dispatch (falls back to math, then Gemini)
│   │   ├── math.js, text.js, gemini.js
│   │   └── packs/              # Commands grouped by theme (identity, smalltalk, games, ...)
│   ├── store/                # One localStorage-backed store factory, reused everywhere
│   ├── ui/
│   │   ├── pages/              # Food Scanner, Profile, Dashboard
│   │   └── tabs.js, settingsDrawer.js, nameModal.js, transcript.js, alertBanner.js
│   ├── data/foods.js         # Local food database used by the Food Scanner
│   └── styles/main.css       # HUD styling and animations
├── tests/                  # Vitest unit tests for the pure logic (math, matching, parsing)
└── desktop/                 # Python desktop companion — see desktop/README.md
```

Built with [Vite](https://vitejs.dev) — a small, standard build step that compiles the
`src/` modules above into a static `dist/` bundle. The *output* is still plain
HTML/CSS/JS with no backend or server required; Vite is only needed to edit
and build the source.

---

## Installation

**Running it locally:**

1. **Clone this repository** and install [Node.js](https://nodejs.org) 18+ if you don't have it.
2. **Install dependencies and start the dev server:**
   ```
   npm install
   npm run dev
   ```
   Open the printed `localhost` URL in a modern browser — Chrome or Edge give
   the most reliable speech recognition support.
3. **Allow microphone access** when the browser prompts you. If you
   accidentally block it, click the padlock/site-info icon in the address
   bar and re-enable the microphone permission for the page.
4. **Say hello!** On your first run, Charlie will ask for your name. After
   that, tap the glowing core, wait for the "LISTENING" status, and speak
   a command such as *"What time is it?"*

**Building for production:** `npm run build` writes a static site to `dist/`
— deploy that folder anywhere that serves static files (this repo's own copy
deploys to GitHub Pages via `.github/workflows/deploy-pages.yml`). Preview a
production build locally with `npm run preview`.

**Other useful scripts:** `npm run lint` / `npm run format` (ESLint +
Stylelint + Prettier) and `npm test` (Vitest) — see `package.json`.

### Using it from your phone

Browsers generally require a *secure context* (HTTPS or `localhost`) for
microphone and camera access, so opening the file directly as `file://` on a
phone may not allow the mic or the food scanner's camera button. Two easy
ways around this while running Charlie from your PC:

- **Vite's own network mode:** run `npm run dev -- --host` and it prints a
  `Network:` URL alongside the usual `localhost` one — open that on your
  phone (connected to the same Wi-Fi). Works just as well against a built
  copy: `npm run preview -- --host` serves the `dist/` output the same way.
- **Free tunnel tool** (e.g. ngrok, Cloudflare Tunnel) to get a temporary
  HTTPS URL pointing at your local server, then open that URL on your phone.

---

## How it works

- **Assistant tab** — tap the core to wake Charlie, speak a command, and it's
  matched against every registered command pack (see `src/commands/packs/`)
  using simple keyword matching (no external NLP service).
- **Scanner tab** — pick or take a photo (kept purely as a visual reference on
  your device), then type or tap a food name. Charlie looks it up in
  `src/data/foods.js` and displays a score, nutrition estimate, benefits,
  negatives, and a recommendation.
- **Dashboard tab** — shows a greeting based on the time of day, your list of
  daily suggestions (the first one doubles as "Today's focus"), and buttons
  to start a Study Mode or Workout Mode countdown timer.
- **Profile tab** — a simple form for your name, age, activity level, goals,
  and favourite activities. Saved goals also feed the dashboard and the
  "what are my goals" voice command.
- **Settings drawer** — tap the gear icon top-right for voice/rate/pitch
  controls and the "Forget me" memory reset.

---

## Built-in voice commands

Charlie ships with **100+ commands** (over 200 trigger phrases total) spread
across the themed packs in `src/commands/packs/`. Say any of these — or a
close variation, since Charlie matches on keywords, not exact phrasing. When
two commands could both match (e.g. "stop" vs. "stop timer"), the longer,
more specific phrase wins.

| Category | Say something like... | Charlie does... |
|----------|------------------------|-------------------|
| Time & date | "What time is it?" / "What year is it?" / "Day of the week" | Speaks the current time, date, month, year, or weekday |
| Identity & memory | "What is your name?" / "My name is Adas" / "Forget me" | Introduces itself, saves your name, or wipes memory |
| Small talk | "How are you?" / "Good morning" / "Compliment me" / "Roast me" | Casual replies, greetings, and playful banter |
| Personality Q&A | "Are you sentient?" / "Favorite animal?" / "What is your purpose?" | Answers ~15 personality/trivia-style questions |
| Math | "What is 5 plus 3" / "20 percent of 50" / "Square root of 81" | Arithmetic, percentages, square roots, powers |
| Unit conversion | "Convert 5 kilometers to miles" / "20 celsius to fahrenheit" | Distance, weight, and temperature conversions |
| Notes & reminders | "Take a note buy milk" / "Read my notes" / "Remind me to stretch" | Saves notes and adds items to today's plan |
| Timers | "Set a timer for 10 minutes" / "Stop timer" | Starts/stops a countdown timer on the Dashboard |
| Games & fun | "Tell me a joke" / "Rock paper scissors" / "Magic 8 ball" / "Tell me a riddle" | Jokes, coin flips, dice, riddles, and small games |
| Web shortcuts | "Open Google" / "Open Gmail" / "Search Wikipedia for octopuses" | Opens common sites or a search in a new tab |
| Health & motivation | "Give me a workout tip" / "Motivate me" / "Breathing exercise" | Short tips, quotes, and a guided breath |
| Voice control | "Speak faster" / "Speak slower" / "Repeat that" | Adjusts speaking rate or repeats the last reply |
| Assistant control | "Stop" / "Go to sleep" / "Battery level" | Sleeps Charlie or reports device battery |
| Scanner / Profile / Dashboard | "Open food scanner" / "Show my profile" / "Start study mode" / "Tell me today's plan" | Switches tabs, analyzes food, reads goals, starts focus timers |

Anything not recognized gets an honest "I don't have an answer for that
yet" reply — see **Adding your own commands** below.

---

## Adding your own commands

Pick whichever pack in `src/commands/packs/` fits best (or add a new file),
and add an entry to its exported array. Each entry looks like this:

```js
{
  patterns: ['what time is it', "what's the time"],
  respond: () => `The current time is ${new Date().toLocaleTimeString()}.`
}
```

- `patterns` is a list of lowercase substrings to match against what you said.
- `respond` returns the text Charlie will speak. It receives the raw
  transcript as an argument if you need to parse extra details out of it. It
  can also return a Promise if you need to await something (see the battery
  status command in `src/commands/packs/system.js` for an example).
- If your phrase overlaps with an existing one (e.g. your new "stop music"
  vs. the built-in "stop"), don't worry about which pack it's in or array
  order — `findBestCommand` (in `src/commands/registry.js`) always picks
  whichever matching pattern is the longest/most specific.
- A new pack needs one extra step: import it and add it to the array in
  `src/main.js` that gets passed to `registerPack`.

Refresh the dev server (`npm run dev` hot-reloads automatically) and Charlie
picks up the new command immediately.

### Adding your own foods

Open `src/data/foods.js` and add a new object to the `FOOD_DATABASE` array,
following the same shape as the existing entries (`name`, `aliases`,
`calories`, `protein`, `carbs`, `fat`, `sugar`, `fibre`, the five `*Score`
fields, `benefits`, `negatives`, `dailyRecommendation`).

---

## Browser support notes

- `SpeechRecognition` is best supported in Chrome, Edge, and other
  Chromium-based browsers. Firefox and Safari support is limited or absent
  at the time of writing.
- `SpeechSynthesis` (text-to-speech) is broadly supported, but the list of
  available voices depends on your operating system.
- The Food Scanner's camera button uses a standard `<input type="file"
  capture="environment">`, supported on essentially all modern mobile
  browsers; on desktop it just opens a file picker.
- If your browser doesn't support speech recognition, Charlie will still
  load and tell you so in the transcript log.

---

## Future Upgrade Ideas

This project is intentionally a small, understandable prototype. Some
natural next steps if you want to keep building:

- **Real AI vision model** — replace the Food Scanner's name-based lookup
  with an on-device or local image-classification model so it can identify
  food directly from the photo.
- ~~Connect to a local AI model~~ — done: unmatched commands now fall back to
  Gemini (see Settings in the app). A fully local model (e.g. via Ollama)
  is still a reasonable swap if you want zero cloud dependency.
- ~~PC control agent~~ — done, see the [desktop version](desktop/): open
  apps, run shell commands, and generate/save files from voice.
- **Wake word detection on desktop** — the web version already requires
  saying "Charlie"; a lower-power always-listening wake word library (e.g.
  Porcupine) would let the desktop version run without keeping a full STT
  session open at all times.
- **Raspberry Pi version** — run the local backend on a Raspberry Pi with a
  microphone/speaker hat for a dedicated physical assistant device.
- **Smart home control** — integrate with local smart-home APIs for voice
  control of lights, thermostats, etc.

---

## License

This is a personal/educational starter project. Use it, modify it, and
build on it freely.
