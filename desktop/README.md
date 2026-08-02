# Charlie — Desktop

A local, cross-platform (Windows / macOS / Linux) voice assistant that runs on
your own machine instead of in a browser tab. Same wake word ("Charlie"),
same Gemini brain as the web version — but this one can open apps, run shell
commands, and generate/save files on your PC.

**Read "Safety notes" before you rely on this for anything.** This build
executes what it hears, with no whitelist and no confirmation step — that
was a deliberate choice, not an oversight.

## Setup

**Windows, easiest path:**
[**Download CharlieSetup.exe**](https://github.com/AdasV-tech/Charlie-Assistant/releases/latest/download/CharlieSetup.exe) —
starts the download immediately, no releases page or asset-picking. Run it,
done — no Python required, it's bundled inside. Skip to "What you can say"
below.

(That link always resolves to whatever the latest tagged release is — it's
GitHub's `/releases/latest/download/<asset>` redirect, not a link to a
specific version, so it never goes stale as new versions ship.)

**Everyone else (or if you want to run/edit the source directly):**

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
| "Charlie, run `<any shell command>`" | Executes it directly and reads back the output — or, if it looks destructive, asks you to say "confirm" first (see "Safety notes" below) |
| "Charlie, search google for cast iron recipes" | Opens a browser search |
| "Charlie, search youtube for lofi beats" | Opens a YouTube search |
| "Charlie, create a file called notes.txt with buy milk" | Saves that literal text to `~/CharlieFiles/notes.txt` |
| "Charlie, make me a python script that renames files" | Gemini generates it, saved to `~/CharlieFiles/` |
| "Charlie, open my files" | Opens the `~/CharlieFiles` folder |
| "Charlie, forget our conversation" | Clears Gemini's memory of the current session |
| "Charlie, go to sleep" | Ignores everything except "wake up" until you do |
| "Charlie, wake up" | Resumes normal listening |
| "Charlie, check for updates" | Checks GitHub right now instead of waiting for the next launch |
| "Charlie, `<anything else>`" | Answered by Gemini, same as the web version |
| "Charlie, exit" / "quit" | Shuts Charlie down |

You can talk over Charlie at any point — even while he's still "thinking"
about a slow request (a Gemini call, a long-running shell command) — and
saying "Charlie" again immediately drops whatever he was doing and starts on
your new request. Nothing you say is queued up behind a slow response.

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

## Auto-updates

Charlie checks GitHub for a newer version every time it starts (and on
demand — "Charlie, check for updates") and applies it automatically: no
manual re-download, no reinstalling, no resetting your setup. It only ever
replaces Charlie's own code (this script, or the packaged .exe) — your API
key (`charlie_config.json`), your `apps.json`, and everything in
`~/CharlieFiles` are never touched by an update.

A couple of things worth knowing:

- Updates only ever come from **tagged GitHub Releases**, never from
  whatever currently happens to be on `main` — the same source the packaged
  `.exe` path always used. Pushing to `main` alone no longer updates anyone;
  a maintainer has to deliberately cut and push a release tag.
- Every downloaded update — the plain script or a platform build — is
  verified against a `SHA256SUMS.txt` published in that same release
  (generated during the CI build, from the exact bytes being released) before
  it's applied. If the checksum doesn't match, or the release doesn't have
  one, Charlie refuses to update rather than guessing. The plain-script path
  is also still syntax-checked on top of that.
- If you're running the plain script, an update rewrites `charlie_pc.py` in
  place and restarts itself immediately — you'll see it happen, no action
  needed from you.
- If you're running the packaged .exe, it downloads the matching platform
  build from the latest GitHub release, verifies it, and swaps it in. This
  path is best-effort: it's implemented following the standard pattern for
  self-replacing a running Windows executable, but wasn't exercised against
  an actual published release while building this — worth a real test after
  your first tagged release, per the note in "Packaging" below.
- Pass `--no-update` to skip the check on a given launch (offline use, or if
  you're intentionally running an older/modified version).
- This narrows the trust boundary to "the release process itself" instead of
  "anyone who can push to `main`," and catches transport corruption — but a
  checksum isn't a signature. It doesn't protect against someone who can
  tamper with a release's assets and its `SHA256SUMS.txt` together (e.g. a
  compromised repo or CI). GPG-signing releases with a key kept outside the
  repo/CI entirely would close that gap, if you want to take this further.

## Safety notes — read this

This build was built with **open-ended command execution**, meaning:

- "Charlie, run `<command>`" executes exactly what it hears via your shell —
  there's still no whitelist. There is now a narrow safety net: a command
  that looks destructive (recursive deletes, disk formatting, `git push
  --force`/`reset --hard`, `shutdown`, and similar — see
  `_DESTRUCTIVE_PATTERNS` in `charlie_pc.py`) is staged instead of run
  immediately, and Charlie asks you to say "confirm" within 20 seconds before
  it actually executes. Say anything else (or nothing) and it's dropped
  without running. Anything that *doesn't* match one of those patterns still
  runs exactly as before, with no confirmation — this is a speed bump for the
  most common costly mistakes, not a real sandbox.
- Speech recognition can mishear you. "Charlie, run **delete** the temp
  folder" transcribed wrong is still a command that runs if it doesn't
  happen to match a destructive pattern — the confirmation gate reduces this
  risk for the commands it recognizes, it doesn't eliminate it.
- Gemini's own text answers are **never** auto-executed — only things you
  explicitly prefix with "run"/"execute" hit the shell. That boundary is
  intentional: turning free-form AI text straight into shell commands is a
  known injection risk, so it isn't wired that way here even though the
  "run" path itself is unrestricted.

If you want a stronger safety net than the confirmation gate, reasonable
options going forward: run Charlie under a non-admin user account, require a
confirmation phrase for *every* shell command rather than just the
recognized destructive patterns, or maintain your own denylist/allowlist on
top of `_DESTRUCTIVE_PATTERNS`.

## Uninstalling

**Installed via `CharlieSetup.exe`:** use Windows' normal "Add or Remove
Programs" like any other app — it removes the Start Menu/desktop shortcuts
and program files via a real uninstaller entry. It deliberately leaves your
saved API key and `apps.json` in place (see `installer/charlie.iss` for why).
If you also want those gone, run `charlie.exe --uninstall` yourself first
(from the install folder, e.g. `%LocalAppData%\Programs\Charlie`), then
uninstall via Add/Remove Programs.

**Installed from source / portable exe:** Charlie doesn't touch the
registry, doesn't install a background service, and doesn't add itself to
startup, so removing it is just as light:

```
python charlie_pc.py --uninstall
```

This shows exactly what it's about to delete (your saved API key, the
`~/CharlieFiles` folder it generates content into, and its `__pycache__`),
asks for a typed `yes` before touching anything, and does nothing if you
don't confirm. It then prints the two optional cleanup steps that have to
happen outside the script: deleting the `desktop/` folder itself, and
`pip uninstall`-ing the three dependencies if you don't want them for
anything else. If you built the portable executable, the same flag works
there too: `charlie --uninstall` (or `charlie.exe --uninstall` on Windows).

## Packaging as a standalone executable

To build the raw double-click executable yourself:

```
pip install pyinstaller
pyinstaller --onefile --name charlie --add-data "apps.json:." charlie_pc.py
```

The binary lands in `dist/`. This has to be built **on the OS you're
targeting** (a Windows .exe needs to be built on Windows, etc.) — PyInstaller
doesn't cross-compile.

**For a proper Windows installer** (Start Menu shortcut, optional desktop
icon, a real "Add or Remove Programs" entry — not just a bare .exe), build
the exe above first, then compile `installer/charlie.iss` with
[Inno Setup](https://jrsoftware.org/isinfo.php):

```
iscc installer\charlie.iss
```

This produces `installer/dist_installer/CharlieSetup.exe`. There's nothing
to check for or install first on the *target* machine — the bundled exe
already contains its own Python runtime, so Setup.exe just places files and
creates shortcuts, the same as any normal installer.

If you push this repo to GitHub, `.github/workflows/build-desktop.yml` (added
alongside this app) does all of the above automatically via GitHub Actions —
builds Windows, macOS, and Linux executables *and* `CharlieSetup.exe`, then
attaches them all to a release whenever you push a tag like `v1.0.0`. That's
the easiest way to get a real downloadable app without needing Windows,
macOS, Inno Setup, or all three OSes yourself. Note: the installer step was
written against Inno Setup 6, which GitHub's `windows-latest` runners ship
preinstalled — but wasn't test-compiled anywhere while building this (no
Windows/Inno Setup available in this environment), so double-check the first
CI run actually produces `CharlieSetup.exe` before relying on it.

## Differences from the web version

The browser version (`../index.html`) has 100+ small-talk/utility commands
and a food scanner/dashboard UI. This desktop version is intentionally
leaner — its job is PC control and Gemini Q&A, not feature parity. Add more
commands to the dispatch list in `charlie_pc.py` if you want more of the web
version's built-ins here too.
