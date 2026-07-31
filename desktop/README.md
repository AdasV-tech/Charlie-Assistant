# Charlie — Desktop

A local, cross-platform (Windows / macOS / Linux) voice assistant that runs on
your own machine instead of in a browser tab. Same wake word ("Charlie"),
same Gemini brain as the web version — but this one can open apps, run shell
commands, and generate/save files on your PC.

**Read "Safety notes" before you rely on this for anything.** This build
executes what it hears, with no whitelist and no confirmation step — that
was a deliberate choice, not an oversight.

## Setup

1. **Install Python 3.9+** if you don't have it.
2. **Install system audio dependencies** (needed before `pip install` will work):
   - **Windows:** nothing extra — PyAudio installs from a prebuilt wheel.
   - **macOS:** `brew install portaudio`
   - **Linux (Debian/Ubuntu):** `sudo apt install portaudio19-dev espeak-ng`
     (`espeak-ng` is the offline voice `pyttsx3` uses to actually speak on Linux —
     without it Charlie still works, just as text-only output.)
3. **Install Python dependencies:**
   ```
   cd desktop
   pip install -r requirements.txt
   ```
4. **Set your Gemini API key** (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)) — either:
   - Environment variable: `export GEMINI_API_KEY=your-key-here` (recommended), or
   - Just run it — Charlie will prompt you once and save it to `charlie_config.json`,
     which is gitignored so it never gets committed.
5. **Run it:**
   ```
   python charlie_pc.py
   ```

## What you can say

| Say | What happens |
|---|---|
| "Charlie, what time is it" | Speaks the current time |
| "Charlie, open notepad" / "open chrome" | Launches the app (see `apps.json` below) |
| "Charlie, run `<any shell command>`" | Executes it directly and reads back the output |
| "Charlie, search google for cast iron recipes" | Opens a browser search |
| "Charlie, search youtube for lofi beats" | Opens a YouTube search |
| "Charlie, create a file called notes.txt with buy milk" | Saves that literal text to `~/CharlieFiles/notes.txt` |
| "Charlie, make me a python script that renames files" | Gemini generates it, saved to `~/CharlieFiles/` |
| "Charlie, open my files" | Opens the `~/CharlieFiles` folder |
| "Charlie, forget our conversation" | Clears Gemini's memory of the current session |
| "Charlie, `<anything else>`" | Answered by Gemini, same as the web version |
| "Charlie, exit" / "quit" | Shuts Charlie down |

You can talk over Charlie mid-response — saying "Charlie" again interrupts
whatever he's saying and starts on your new request immediately.

## Teaching Charlie your apps — `apps.json`

Charlie tries a reasonable OS-specific guess when you say "open X" (e.g.
`open -a X` on macOS), but the most reliable way is to add exact entries to
`apps.json`:

```json
{
  "notepad": "notepad.exe",
  "vs code": "C:\\Users\\you\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
  "spotify": "/usr/bin/spotify",
  "github": "https://github.com"
}
```

Keys are lowercase, exactly what you'd say after "open". A value starting
with `http://`/`https://` opens in your browser; anything else is launched
directly.

## Safety notes — read this

This build was built with **open-ended command execution**, meaning:

- "Charlie, run `<command>`" executes exactly what it hears via your shell —
  no whitelist, no confirmation, no undo.
- Speech recognition can mishear you. "Charlie, run **delete** the temp
  folder" transcribed wrong is still a command that runs.
- Gemini's own text answers are **never** auto-executed — only things you
  explicitly prefix with "run"/"execute" hit the shell. That boundary is
  intentional: turning free-form AI text straight into shell commands is a
  known injection risk, so it isn't wired that way here even though the
  "run" path itself is unrestricted.

If you want a safety net without giving up the open-ended design, reasonable
options going forward: run Charlie under a non-admin user account, alias
`run_shell_command` to require a confirmation phrase, or maintain a personal
denylist of destructive commands. None of that is built in right now — this
version does exactly what you asked for, unfiltered.

## Uninstalling

Charlie doesn't touch the registry, doesn't install a background service, and
doesn't add itself to startup — running it is just `python charlie_pc.py`, so
removing it is just as light:

```
python charlie_pc.py --uninstall
```

This shows exactly what it's about to delete (your saved API key, the
`~/CharlieFiles` folder it generates content into, and its `__pycache__`),
asks for a typed `yes` before touching anything, and does nothing if you
don't confirm. It then prints the two optional cleanup steps that have to
happen outside the script: deleting the `desktop/` folder itself, and
`pip uninstall`-ing the three dependencies if you don't want them for
anything else. If you built the packaged executable, the same flag works
there too: `charlie --uninstall` (or `charlie.exe --uninstall` on Windows).

## Packaging as a standalone executable

To build a double-click executable yourself:

```
pip install pyinstaller
pyinstaller --onefile --name charlie --add-data "apps.json:." charlie_pc.py
```

The binary lands in `dist/`. This has to be built **on the OS you're
targeting** (a Windows .exe needs to be built on Windows, etc.) — PyInstaller
doesn't cross-compile.

If you push this repo to GitHub, `.github/workflows/build-desktop.yml` (added
alongside this app) builds Windows, macOS, and Linux executables automatically
via GitHub Actions and attaches them to a release whenever you push a tag like
`v1.0.0` — that's the easiest way to get a real downloadable app without
needing all three OSes yourself.

## Differences from the web version

The browser version (`../index.html`) has 100+ small-talk/utility commands
and a food scanner/dashboard UI. This desktop version is intentionally
leaner — its job is PC control and Gemini Q&A, not feature parity. Add more
commands to the dispatch list in `charlie_pc.py` if you want more of the web
version's built-ins here too.
