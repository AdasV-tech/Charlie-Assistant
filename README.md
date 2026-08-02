# Charlie Assistant — V3

A browser-based personal AI assistant with a futuristic HUD-style interface.
Charlie listens to your voice, matches it against 100+ commands, and speaks
back — plus a full Food Analyzer, a Project Manager, a Study Center, a
Fitness Center, a Smart Memory viewer, global search, a notification center,
and seven visual themes. Everything runs client-side using APIs already
built into your browser, with an optional Gemini API key (bring your own,
stored only in your browser) so Charlie can answer open-ended questions too.
No backend server, no bundled API keys, no paid services required.

There's also a [desktop version](desktop/) — a Python app that runs on your
own machine and can open apps, run shell commands, and generate/save files,
not just talk.

![status](https://img.shields.io/badge/status-v3.0.0-3ee6ff)

---

## Features

### Charlie Core

A single animated core that visibly reflects what Charlie is doing, with ten
distinct states — _Sleeping_, _Listening_, _Thinking_, _Speaking_, _Busy_,
_Searching_, _Learning_, _Offline_, _Connecting_, _Updating_ — each with its
own color, particle behavior, and status text, wired to a real trigger
(network calls, `navigator.onLine`, active timers) rather than shown for
decoration.

### Voice experience

- **Voice input/output** via the browser's built-in `SpeechRecognition` /
  `SpeechSynthesis` APIs — no external speech service.
- **Live transcript** while you're still talking, a persisted conversation
  history, and a real speech queue so a timer completion doesn't barge in
  over an active conversation.
- **Barge-in** — interrupt Charlie mid-sentence and it stops immediately.
- **100+ built-in commands** (200+ trigger phrases) across time/date, math
  and unit conversion, notes/reminders, timers, web shortcuts, games,
  health/motivation tips, and full navigation into every module below — see
  [Built-in voice commands](#built-in-voice-commands).
- **Gemini fallback** for anything that isn't a built-in command — bring
  your own free API key (Settings → Voice), stored only in `localStorage`.

### Food Analyzer Pro

Photo/upload reference (kept on-device only — see the scanner tab's own
disclaimer for exactly how the lookup works), a local 15-food nutrition
table, six real scores (health, energy, protein, fibre, sugar, **and
recovery**), micronutrient highlights, a hydration estimate, computed
warnings/suggestions from the actual macros, favourites, history with
filtering, and a trend chart over your saved history.

### Project Manager

Full CRUD projects with status, priority, category, tags, deadlines,
progress, notes, a local file/link reference in place of a cloud upload,
search/filter/sort, and real statistics (total, in progress, completed,
overdue, average progress).

### Study Center

Subjects, assignments (with due dates and priority), flashcards on a real
Leitner-box spaced-repetition schedule (not a random shuffle), a
subject-aware Pomodoro timer, daily/weekly/monthly goals measured against
actual logged study minutes, achievements computed from that same real data
(streaks, session counts, mastered cards), and a GitHub-style activity
heatmap.

### Fitness Center

A manual workout log (type, duration, calories), habit tracking with weekly
targets and streaks, a water tracker, a weight trend chart, a manual sleep
log (honestly not device-synced — there's no wearable integration to fake),
goals measured against real logged workout minutes, achievements, and an
activity heatmap. Quick-starting Workout Mode from the Dashboard also logs
here, so the two stay in sync.

### Smart Memory

One page surfacing everything Charlie has stored, grouped by feature —
export or clear any category on its own. The same real data (name, goals,
active projects, pending/overdue assignments, streaks, habits due today) is
also compiled into a compact summary fed into Gemini's system prompt, so
open-ended answers can reference what's actually going on instead of
staying generic.

### Dashboard

A time-of-day greeting, a customizable daily suggestions list, a Study
Mode / Workout Mode focus timer, productivity and health scores computed
from real focus-session and food-history data (never fabricated), a real
weather widget (Geolocation + Open-Meteo, no key required), a deterministic
daily quote/challenge, quick actions into every module, and a recent
conversations feed.

### Global search & notifications

`Ctrl/Cmd+K` (or the search icon) searches every page, your notes, food
history, projects, subjects, assignments, flashcards, workouts, and habits
in one place. The bell icon opens an in-app notification feed, optionally
mirrored to real browser notifications once you opt in and grant
permission.

### Settings & themes

Seven full visual themes (Default, Midnight, Cyber Blue, Emerald, Purple,
Orange, Minimal — all documented as WCAG AA-passing for body text, see
`src/styles/themes.css`), reduced-motion and large-text accessibility
toggles, developer mode, and a full JSON export/import/backup of every
store (the Gemini key is deliberately excluded — see
`src/lib/dataPortability.js`).

### Security & accessibility

- A hash-allowlisted Content-Security-Policy (script injection defence-in-depth
  on top of the app's own HTML-escaping discipline — see the `<meta>` tag
  in `index.html` for the full policy and its reasoning).
- A skip-to-content link, a theme-consistent focus ring on every interactive
  element, and Escape-to-close on every drawer/overlay/popover.
- Every theme's text/background contrast is computed and documented (see
  `src/styles/themes.css`) — all seven clear WCAG AA for body text.

---

## Project Structure

```
Charlie-Assistant/
├── index.html                 # Vite entry HTML + CSP meta tag + anti-flash theme script
├── public/                    # Static passthrough — CNAME, favicon
├── src/
│   ├── main.js                 # Boot sequence: registers command packs, inits every page module
│   ├── core/
│   │   ├── assistant.js          # Voice state machine, speech synthesis/recognition, barge-in
│   │   ├── particles.js          # Per-state particle config for the Core
│   │   ├── accessibility.js      # Reduced-motion / large-text stores + toggles
│   │   ├── developerMode.js
│   │   └── userContext.js        # Builds the real-data summary fed into Gemini's system prompt
│   ├── commands/
│   │   ├── registry.js            # Pattern matching + dispatch (falls back to math, then Gemini)
│   │   ├── math.js, text.js, gemini.js
│   │   └── packs/                  # Commands grouped by theme — see "Adding your own commands"
│   ├── store/
│   │   ├── createStore.js          # One localStorage-backed store factory, reused everywhere
│   │   └── stores.js                # Every store in the app, one place
│   ├── study/                  # Spaced repetition (Leitner) + achievements — pure, unit-tested
│   ├── fitness/                 # Achievements — pure, unit-tested
│   ├── food/                    # Warning/suggestion logic from real macros — pure, unit-tested
│   ├── dashboard/               # Weather (Open-Meteo) + deterministic daily quote/challenge
│   ├── notifications/           # In-app feed + gated browser Notification API
│   ├── search/                  # Global search index (static pages + dynamic store content)
│   ├── theme/                   # Theme registry + applyTheme()
│   ├── lib/                     # escapeHtml, date-range/streak/label helpers, data export
│   ├── ui/
│   │   ├── pages/                  # One module per tab — Assistant lives in main.js/transcript.js
│   │   ├── components/              # Shared components (calendar heatmap, more as they're needed)
│   │   └── tabs.js, settingsDrawer.js, nameModal.js, transcript.js, toast.js, ticks.js, clock.js
│   ├── data/foods.js            # Local food database used by the Food Analyzer
│   └── styles/                  # main.css (components), components.css (shared), themes.css
├── tests/                      # Vitest unit tests for every pure-logic module above
└── desktop/                     # Python desktop companion — see desktop/README.md
```

Built with [Vite](https://vitejs.dev) — a small, standard build step that compiles the
`src/` modules above into a static `dist/` bundle. The _output_ is still plain
HTML/CSS/JS with no backend or server required; Vite is only needed to edit
and build the source. The whole app currently builds to about 33KB of
gzipped JS and 9KB of gzipped CSS — no images, no heavy dependencies.

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
   a command such as _"What time is it?"_

**Building for production:** `npm run build` writes a static site to `dist/`
— deploy that folder anywhere that serves static files (this repo's own copy
deploys to GitHub Pages via `.github/workflows/deploy-pages.yml`). Preview a
production build locally with `npm run preview`.

**Other useful scripts:** `npm run lint` / `npm run lint:fix` (ESLint +
Stylelint) and `npm run format` / `npm run format:check` (Prettier), and
`npm test` / `npm run test:watch` (Vitest) — see `package.json`.

### Using it from your phone

Browsers generally require a _secure context_ (HTTPS or `localhost`) for
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
  using keyword matching — no external NLP service, no cloud speech-to-text
  beyond the browser's own built-in API.
- **Scanner tab** — pick or take a photo (kept purely as a visual reference
  on your device — there's no image-recognition model), then type or tap a
  food name. Charlie looks it up in `src/data/foods.js` and shows six
  scores, a macro/micronutrient breakdown, a hydration estimate, computed
  warnings/suggestions, and a trend chart over your saved history.
- **Dashboard tab** — a real greeting, weather, quote/challenge, quick
  actions, and productivity/health scores computed from your actual data.
- **Projects tab** — create/edit/delete projects with status, priority,
  deadlines, tags, and progress; search, filter, and sort the list.
- **Study tab** — manage subjects, assignments, and flashcards (with real
  spaced repetition), run a subject-aware Pomodoro, set goals, and see your
  achievements and activity heatmap.
- **Fitness tab** — log workouts, track habits/water/weight/sleep, set
  goals, and see your achievements and activity heatmap.
- **Memory tab** — see everything Charlie has stored, grouped by feature,
  with export/clear per category.
- **Profile tab** — your name, age, activity level, goals, and favourite
  activities. Saved goals also feed the Dashboard, the "what are my goals"
  voice command, and Gemini's context summary.
- **Settings drawer** — tap the gear icon top-right for voice/rate/pitch,
  theme, accessibility, data export/import/backup, and the "Forget me"
  memory reset.
- **Search** — tap the magnifier icon or press `Ctrl/Cmd+K` from anywhere.

---

## Built-in voice commands

Charlie ships with **100+ commands** (200+ trigger phrases) spread across
the themed packs in `src/commands/packs/`. Say any of these — or a close
variation, since Charlie matches on keywords, not exact phrasing. When two
commands could both match (e.g. "stop" vs. "stop timer"), the longer, more
specific phrase wins.

| Category            | Say something like...                                                                 | Charlie does...                                                     |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Time & date         | "What time is it?" / "What year is it?" / "Day of the week"                           | Speaks the current time, date, month, year, or weekday              |
| Identity & memory   | "What is your name?" / "My name is Adas" / "Forget me"                                | Introduces itself, saves your name, or wipes memory                 |
| Small talk          | "How are you?" / "Good morning" / "Compliment me" / "Roast me"                        | Casual replies, greetings, and playful banter                       |
| Personality Q&A     | "Are you sentient?" / "Favorite animal?" / "What is your purpose?"                    | Answers ~15 personality/trivia-style questions                      |
| Math                | "What is 5 plus 3" / "20 percent of 50" / "Square root of 81"                         | Arithmetic, percentages, square roots, powers                       |
| Unit conversion     | "Convert 5 kilometers to miles" / "20 celsius to fahrenheit"                          | Distance, weight, and temperature conversions                       |
| Notes & reminders   | "Take a note buy milk" / "Read my notes" / "Remind me to stretch"                     | Saves notes and adds items to today's plan                          |
| Timers              | "Set a timer for 10 minutes" / "Stop timer"                                           | Starts/stops a countdown timer on the Dashboard                     |
| Games & fun         | "Tell me a joke" / "Rock paper scissors" / "Magic 8 ball" / "Tell me a riddle"        | Jokes, coin flips, dice, riddles, and small games                   |
| Web shortcuts       | "Open Google" / "Open Gmail" / "Search Wikipedia for octopuses"                       | Opens common sites or a search in a new tab                         |
| Health & motivation | "Give me a workout tip" / "Motivate me" / "Breathing exercise"                        | Short tips, quotes, and a guided breath                             |
| Voice control       | "Speak faster" / "Speak slower" / "Repeat that"                                       | Adjusts speaking rate or repeats the last reply                     |
| Assistant control   | "Stop" / "Go to sleep" / "Battery level"                                              | Sleeps Charlie or reports device battery                            |
| Navigation          | "Open food scanner" / "Show my profile" / "Start study mode" / "Tell me today's plan" | Switches tabs, analyzes food, reads goals, starts focus timers      |
| Projects            | "Show my projects" / "Open project manager"                                           | Switches to Projects and reports real counts (in progress, overdue) |
| Study Center        | "Open study center" / "Study center"                                                  | Switches to Study and reports pending assignments / cards due       |
| Fitness Center      | "Open fitness center" / "Fitness center"                                              | Switches to Fitness and reports workout count / streak / habits due |
| Smart Memory        | "What do you remember?" / "Open memory"                                               | Switches to Memory                                                  |

Anything not recognized falls back to arithmetic, then to Gemini (if you've
added a key) — see [Adding your own commands](#adding-your-own-commands).

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
macros, the six `*Score` fields, `micronutrients`, `hydrationPercent`,
`benefits`, `negatives`, `dailyRecommendation`).

### Adding a whole new page/module

This is the same seam every module from Projects onward was built through:

1. **Store** — add one or more `createStore(key, defaultValue)` entries to
   `src/store/stores.js`. That's the entire persistence layer; no custom
   load/save code needed.
2. **Pure logic** (optional but recommended for anything with real rules —
   scheduling, scoring, achievements) — write it as functions that take
   plain data and return plain data, in its own folder (see `src/study/` or
   `src/fitness/`), and add a Vitest file in `tests/` for it. This is what
   made every achievement/streak/spaced-repetition rule in this app
   actually verifiable instead of "trust me, it works."
3. **HTML** — add a `<button class="tab-btn" data-tab="yourmodule">` to the
   `.tabbar` nav and a `<section class="tab-panel" id="tab-yourmodule"
data-tab-panel="yourmodule">` in `index.html`, following the existing
   `panel-card`/`panel-title`/`panel-sub` structure.
4. **UI module** — `src/ui/pages/yourModule.js` exporting `initYourModule()`
   (wires listeners, called once at boot) and `renderYourModule()` (redraws
   from the store, called every time the tab is switched into view).
5. **Wire it in**: add the render call to `switchTab()` in `src/ui/tabs.js`,
   the init call to `src/main.js`, a voice command in
   `src/commands/packs/navigation.js`, a static + dynamic entry in
   `src/search/globalSearch.js`, and (optionally) a quick action on the
   Dashboard.
6. **CSS** — reuse existing classes before inventing new ones (`.project-form`
   /`.study-form`, `.project-stats`, `.goal-list`, `.achievement-grid`,
   `.priority-dot`, `.status-badge` all already exist and are designed to be
   shared); add anything new to the bottom of `src/styles/main.css` in its
   own banner-commented section, or to `src/styles/components.css` if it's
   generic enough for other future modules to reuse too.

Nothing above requires touching the Core state machine, the voice pipeline,
or any other module — this is the plugin seam the whole "future modules"
roadmap below is meant to grow through.

---

## Browser support notes

- `SpeechRecognition` is best supported in Chrome, Edge, and other
  Chromium-based browsers. Firefox and Safari support is limited or absent
  at the time of writing.
- `SpeechSynthesis` (text-to-speech) is broadly supported, but the list of
  available voices depends on your operating system.
- The Food Analyzer's camera button uses a standard `<input type="file"
capture="environment">`, supported on essentially all modern mobile
  browsers; on desktop it just opens a file picker.
- The Dashboard's weather widget uses the Geolocation API + Open-Meteo (free,
  no key); if location access is denied, it honestly says so instead of
  showing fake data.
- The "Large text" accessibility toggle uses CSS `zoom`, which is
  Chromium/Safari-only — Firefox users see no change, not a crash (the same
  browser-support boundary `SpeechRecognition` already has).
- If your browser doesn't support speech recognition, Charlie will still
  load and tell you so in the transcript log.

---

## Roadmap / Future Upgrade Ideas

Every module through Fitness Center and Smart Memory is now real and
working. Natural next steps if you want to keep building, roughly in order
of how much new plumbing they'd need:

- **Real AI vision model** — replace the Food Analyzer's name-based lookup
  with an on-device or local image-classification model so it can identify
  food directly from the photo.
- **Wake word detection on desktop** — the web version already requires
  saying "Charlie"; a lower-power always-listening wake word library (e.g.
  Porcupine) would let the desktop version run without keeping a full STT
  session open at all times.
- **Calendar / email / music integration** — read-only widgets on the
  Dashboard first (via each service's own OAuth), following the same
  "bring your own key/token, stored only locally" pattern already
  established for Gemini.
- **Raspberry Pi version** — run the desktop backend on a Raspberry Pi with
  a microphone/speaker hat for a dedicated physical assistant device.
- **Smart home control** — integrate with local smart-home APIs for voice
  control of lights, thermostats, etc., as a new command pack plus a
  Dashboard widget.
- **Discord / GitHub / VS Code integration** — bot/extension companions that
  read from and write to the same local stores (or a synced backend, if one
  ever gets built) rather than duplicating Charlie's data model.

~~Connect to a local AI model~~ — done: unmatched commands fall back to
Gemini (see Settings). A fully local model (e.g. via Ollama) is still a
reasonable swap if you want zero cloud dependency.
~~PC control agent~~ — done, see the [desktop version](desktop/).
~~Project/Study/Fitness management, Smart Memory~~ — done, see Features above.

---

## License

This is a personal/educational starter project. Use it, modify it, and
build on it freely.
