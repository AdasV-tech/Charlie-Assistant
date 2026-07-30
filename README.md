# Charlie Assistant — V2

A lightweight, browser-based personal AI assistant with a futuristic HUD-style
interface. Charlie listens to your voice, matches it against a growing set of
commands, and speaks back — plus a food scanner, a daily dashboard, and a
personal profile. Everything runs client-side using tools already built into
your browser. No paid APIs, no external AI services, no backend server
required.

![status](https://img.shields.io/badge/status-v2.0.0-3ee6ff)

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
├── index.html        # Page structure / layout (tabs, scanner, dashboard, profile)
├── style.css          # HUD styling, animations, and V2 panels
├── script.js           # Speech, brain, memory, scanner, dashboard, profile logic
├── README.md
├── data/
│   └── foods.js       # Local food database used by the Food Scanner
└── assets/            # Reserved for icons/sounds you add later
```

No frameworks, no build step, no `node_modules`. Just plain HTML/CSS/JS.

---

## Installation

1. **Download the ZIP** from this repository (or `git clone` it) and unzip it
   anywhere on your computer.
2. **Open `index.html`** in a modern browser — Google Chrome or Microsoft
   Edge on desktop give the most reliable speech recognition support.
   Double-click the file, or right-click → *Open with* → your browser.
3. **Allow microphone access** when the browser prompts you. If you
   accidentally block it, click the padlock/site-info icon in the address
   bar and re-enable the microphone permission for the page.
4. **Say hello!** On your first run, Charlie will ask for your name. After
   that, tap the glowing core, wait for the "LISTENING" status, and speak
   a command such as *"What time is it?"*

### Using it from your phone

Browsers generally require a *secure context* (HTTPS or `localhost`) for
microphone and camera access, so opening the file directly as `file://` on a
phone may not allow the mic or the food scanner's camera button. Two easy
ways around this while running Charlie from your PC:

- **Local web server:** from the project folder, run a tiny local server,
  e.g. with Python already installed:
  ```
  python -m http.server 8000
  ```
  Then, on your phone (connected to the same Wi-Fi), visit
  `http://<your-pc-local-ip>:8000` in the browser.
- **Free tunnel tool** (e.g. ngrok, Cloudflare Tunnel) to get a temporary
  HTTPS URL pointing at your local server, then open that URL on your phone.

---

## How it works

- **Assistant tab** — tap the core to wake Charlie, speak a command, and it's
  matched against the `commands` array in `script.js` using simple keyword
  matching (no external NLP service).
- **Scanner tab** — pick or take a photo (kept purely as a visual reference on
  your device), then type or tap a food name. Charlie looks it up in
  `data/foods.js` and displays a score, nutrition estimate, benefits,
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

Charlie ships with **100+ commands** (over 200 trigger phrases total) in the
`commands` array in `script.js`. Say any of these — or a close variation,
since Charlie matches on keywords, not exact phrasing. When two commands
could both match (e.g. "stop" vs. "stop timer"), the longer, more specific
phrase wins.

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

Open `script.js` and find the `commands` array (or the `commands.push(...)`
block near the bottom for V2 additions). Each entry looks like this:

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
  status command for an example).
- If your phrase overlaps with an existing one (e.g. your new "stop music"
  vs. the built-in "stop"), don't worry about array order — `findBestCommand`
  always picks whichever matching pattern is the longest/most specific.

Add a new object and Charlie will pick it up immediately — no build step
needed, just refresh the page.

### Adding your own foods

Open `data/foods.js` and add a new object to the `FOOD_DATABASE` array,
following the same shape as the existing entries (`name`, `aliases`, `score`,
`calories`, `protein`, `good`, `bad`, `recommendation`).

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
- **Connect to a local AI model** — swap the keyword-matching `handleCommand`
  function for a call to a locally hosted LLM (e.g. via Ollama) for
  open-ended conversation instead of fixed commands.
- **PC control agent** — pair the browser front end with a small local
  backend (Node.js or Python) that can open apps, control media playback,
  or run scripts on your computer in response to voice commands.
- **Wake word detection** — add an always-listening wake word (e.g. "Hey
  Charlie") using a lightweight wake-word library, instead of requiring a
  tap on the core.
- **Raspberry Pi version** — run the local backend on a Raspberry Pi with a
  microphone/speaker hat for a dedicated physical assistant device.
- **Smart home control** — integrate with local smart-home APIs for voice
  control of lights, thermostats, etc.

---

## License

This is a personal/educational starter project. Use it, modify it, and
build on it freely.
