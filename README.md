# Charlie Assistant

A lightweight, browser-based voice assistant with a futuristic HUD-style
interface. Charlie listens to your voice, matches it against ~20 built-in
commands, and speaks back — all using tools already built into your browser.
No paid APIs, no external AI services, no backend server required.

![status](https://img.shields.io/badge/status-MVP%20prototype-3ee6ff)

---

## Features

- **Voice input** — tap the glowing core and speak; your browser's built-in
  `SpeechRecognition` API converts your speech to text.
- **Voice output** — Charlie replies out loud using the browser's built-in
  `SpeechSynthesis` API. You can change the voice, speaking rate, and pitch.
- **~20 built-in commands** — time, date, jokes, coin flips, dice rolls,
  simple web searches, greetings, and more (full list below).
- **Local memory** — Charlie remembers your name and voice preferences using
  `localStorage`. Nothing ever leaves your device.
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
├── index.html      # Page structure / layout
├── style.css        # HUD styling and animations
├── script.js         # Speech recognition, brain, speech synthesis, memory
├── README.md
└── assets/           # Reserved for icons/sounds you add later
```

No frameworks, no build step, no `node_modules`. Just three files.

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
microphone access, so opening the file directly as `file://` on a phone may
not allow the mic. Two easy ways around this while running Charlie from
your PC:

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

## Built-in commands

Say any of these (or close variations — Charlie matches on keywords, not
exact phrasing):

| Say something like...            | Charlie does...                              |
|-----------------------------------|-----------------------------------------------|
| "What time is it?"               | Tells the current time                        |
| "What's the date?"               | Tells today's date                            |
| "Hello Charlie" / "Hi Charlie"   | Greets you by name                            |
| "What can you do?"               | Lists its abilities                           |
| "What is your name?"             | Introduces itself                             |
| "My name is Adas"                | Saves your name to memory                     |
| "What is my name?"               | Recalls your saved name                       |
| "Forget me"                      | Wipes saved memory                            |
| "Tell me a joke"                 | Tells a short joke                            |
| "Flip a coin"                    | Heads or tails                                |
| "Roll a dice"                    | Random number 1–6                             |
| "Thank you"                      | Replies politely                              |
| "How are you?"                   | Small talk reply                              |
| "Good morning" / "Good night"    | Time-appropriate greeting                     |
| "Open Google" / "Open YouTube"   | Opens the site in a new tab                   |
| "Search for [anything]"          | Opens a Google search for that phrase         |
| "Stop" / "Go to sleep"           | Stops speaking and returns to sleeping state  |
| "Are you an AI?"                 | Explains how Charlie works                    |

Anything not recognized gets an honest "I don't have an answer for that
yet" reply — see **Adding your own commands** below.

---

## Adding your own commands

Open `script.js` and find the `commands` array. Each entry looks like this:

```js
{
  patterns: ['what time is it', "what's the time"],
  respond: () => `The current time is ${new Date().toLocaleTimeString()}.`
}
```

- `patterns` is a list of lowercase substrings to match against what you said.
- `respond` returns the text Charlie will speak. It receives the raw
  transcript as an argument if you need to parse extra details out of it
  (see the `search for` or `my name is` commands for examples).

Add a new object to the array and Charlie will pick it up immediately —
no build step needed, just refresh the page.

---

## Browser support notes

- `SpeechRecognition` is best supported in Chrome, Edge, and other
  Chromium-based browsers. Firefox and Safari support is limited or absent
  at the time of writing.
- `SpeechSynthesis` (text-to-speech) is broadly supported, but the list of
  available voices depends on your operating system.
- If your browser doesn't support speech recognition, Charlie will still
  load and tell you so in the transcript log.

---

## Future Upgrade Ideas

This project is intentionally a small, understandable MVP. Some natural
next steps if you want to keep building:

- **Connect to a local AI model** — swap the keyword-matching `handleCommand`
  function for a call to a locally hosted LLM (e.g. via Ollama) for open-ended
  conversation instead of fixed commands.
- **PC control agent** — pair the browser front end with a small local
  backend (Node.js or Python) that can open apps, control media playback,
  or run scripts on your computer in response to voice commands.
- **Wake word detection** — add an always-listening wake word (e.g. "Hey
  Charlie") using a lightweight wake-word library, instead of requiring a
  tap on the core.
- **Raspberry Pi version** — run the local backend on a Raspberry Pi with a
  microphone/speaker hat for a dedicated physical assistant device.
- **Phone app** — wrap the interface in a WebView-based Android/iOS app (or
  rebuild with a framework like React Native) for a native app icon and
  background access.

---

## License

This is a personal/educational starter project. Use it, modify it, and
build on it freely.
