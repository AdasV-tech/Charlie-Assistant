#!/usr/bin/env python3
"""
Charlie — desktop voice assistant.

Cross-platform (Windows / macOS / Linux). Always listens for the wake
word "Charlie", then either runs a built-in command or asks Gemini.
Can open apps, run shell commands, and generate/save files on this
machine — see README.md in this folder for the full command list and
the safety notes (this build runs whatever you tell it to, with no
whitelist — that was a deliberate choice, not an oversight).

File map:
  1. Config (API key)
  2. Gemini ("the brain")
  3. Text-to-speech (speaking, interruptible)
  4. System actions (open app / run command / files)
  5. Command dispatch
  6. Speech recognition (listening loop)
  7. Auto-update (checks GitHub on every startup)
  8. Entry point
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from urllib import parse as urlparse
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

VERSION = "1.0.0"

# ---------------------------------------------------------------------------
# 1. CONFIG
# The Gemini key lives outside the repo: env var first, then a local
# gitignored config file, then an interactive first-run prompt. Never
# hardcode a real key into this file — it's meant to be shared/committed.
# ---------------------------------------------------------------------------
if getattr(sys, "frozen", False):
    # PyInstaller --onefile extracts to a throwaway _MEIxxxxxx temp folder at
    # runtime and __file__ points there, not at the actual .exe — using that
    # for config would silently lose the saved API key and apps.json every
    # single run. sys.executable is the real, persistent .exe location.
    APP_DIR = Path(sys.executable).resolve().parent
else:
    APP_DIR = Path(__file__).resolve().parent
CONFIG_PATH = APP_DIR / "charlie_config.json"
APPS_PATH = APP_DIR / "apps.json"
WORKSPACE_DIR = Path.home() / "CharlieFiles"


def load_config() -> dict:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_config(config: dict) -> None:
    CONFIG_PATH.write_text(json.dumps(config, indent=2), encoding="utf-8")


def get_api_key() -> str:
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_key:
        return env_key

    config = load_config()
    if config.get("gemini_api_key"):
        return config["gemini_api_key"]

    print("No Gemini API key found (checked GEMINI_API_KEY env var and charlie_config.json).")
    key = input("Paste your Gemini API key (get one free at aistudio.google.com/apikey): ").strip()
    if key:
        config["gemini_api_key"] = key
        save_config(config)
    return key


def load_apps() -> dict:
    if APPS_PATH.exists():
        try:
            return json.loads(APPS_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


# ---------------------------------------------------------------------------
# 2. GEMINI — Charlie's brain for open-ended questions and content generation
# ---------------------------------------------------------------------------
GEMINI_MODEL = "gemini-flash-latest"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_HISTORY_LIMIT = 16  # ~8 exchanges

CHAT_SYSTEM_INSTRUCTION = (
    "You are Charlie, a voice assistant running locally on the user's own computer. "
    "Your replies are converted to speech and read aloud, never displayed as text, and "
    "the user can interrupt you mid-sentence, so get to the point fast. Be as brief as "
    "possible: one short sentence whenever you can, never more than two unless the user "
    "explicitly asks for detail or steps. Never use markdown, asterisks, headers, "
    "bullets, or code fences, since those get read aloud literally. Answer directly and "
    "confidently — skip preamble and caveats. Don't say you don't know unless you truly "
    "have no reasonable answer."
)

CONTENT_SYSTEM_INSTRUCTION = (
    "You generate raw file content on request. Output ONLY the content itself — no "
    "commentary, no markdown code fences, no explanation before or after. If the request "
    "is for code, output plain runnable code with no surrounding formatting."
)

_gemini_history: list[dict] = []
_api_key: str = ""


def _gemini_request(contents: list[dict], system_instruction: str, max_tokens: int = 1024) -> str | None:
    if not _api_key:
        return None
    url = f"{GEMINI_API_BASE}/{GEMINI_MODEL}:generateContent?key={urlparse.quote(_api_key)}"
    payload = json.dumps({
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": max_tokens},
    }).encode("utf-8")
    req = urlrequest.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlrequest.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        print(f"[gemini] HTTP {e.code}: {body[:300]}")
        return None
    except (URLError, TimeoutError) as e:
        print(f"[gemini] network error: {e}")
        return None

    candidates = data.get("candidates") or []
    if not candidates:
        return None
    parts = candidates[0].get("content", {}).get("parts", [])
    text = " ".join(p.get("text", "") for p in parts).strip()
    return text or None


def ask_gemini(question: str) -> str:
    """Conversational Q&A fallback, with rolling history for follow-ups."""
    if not _api_key:
        return "I need a Gemini API key to answer that — set the GEMINI_API_KEY environment variable and restart me."

    contents = _gemini_history + [{"role": "user", "parts": [{"text": question}]}]
    text = _gemini_request(contents, CHAT_SYSTEM_INSTRUCTION)
    if not text:
        return "I couldn't reach Gemini just now — try asking again in a moment."

    _gemini_history.append({"role": "user", "parts": [{"text": question}]})
    _gemini_history.append({"role": "model", "parts": [{"text": text}]})
    del _gemini_history[:-GEMINI_HISTORY_LIMIT]
    return text


def generate_content(description: str) -> str | None:
    """One-shot content generation for 'make me a file/script/poem ...'."""
    return _gemini_request(
        [{"role": "user", "parts": [{"text": description}]}],
        CONTENT_SYSTEM_INSTRUCTION,
        max_tokens=2048,
    )


def reset_conversation() -> None:
    _gemini_history.clear()


# ---------------------------------------------------------------------------
# 3. TEXT-TO-SPEECH — interruptible, runs on its own thread so the mic can
#    keep listening while Charlie talks (barge-in support).
# ---------------------------------------------------------------------------
def _init_tts_engine():
    """pyttsx3.init() can hang instead of raising on some Linux setups with
    no audio driver (e.g. a headless box with no espeak) — run it on a
    background thread with a timeout so a bad driver can never freeze the
    whole app at startup."""
    try:
        import pyttsx3
    except ImportError as e:
        print(f"[tts] pyttsx3 not installed ({e}). Falling back to text-only output.")
        return None

    result = {}

    def _do_init():
        try:
            result["engine"] = pyttsx3.init()
        except Exception as e:  # pragma: no cover - environment-dependent
            result["error"] = e

    t = threading.Thread(target=_do_init, daemon=True)
    t.start()
    t.join(timeout=5)
    if t.is_alive():
        print("[tts] Text-to-speech init timed out (no working audio driver?). Falling back to text-only output.")
        return None
    if "error" in result:
        print(f"[tts] Could not initialize text-to-speech ({result['error']}). Falling back to text-only output.")
        return None
    return result.get("engine")


_tts_engine = _init_tts_engine()

speaking_event = threading.Event()
_speech_lock = threading.Lock()
_speech_generation = 0


def speak(text: str) -> None:
    """Interrupts whatever Charlie is currently saying and says this instead."""
    global _speech_generation
    print(f"Charlie: {text}")

    if _tts_engine is None:
        # Text-only mode (no working TTS driver) — still leave the state
        # machine in a sane resting state instead of stuck on "speaking".
        set_state("awake" if _awake.is_set() else "sleeping")
        return

    with _speech_lock:
        _speech_generation += 1
        my_generation = _speech_generation
        try:
            _tts_engine.stop()
        except Exception:
            pass

    def _run():
        if my_generation != _speech_generation:
            return  # superseded before we even started (rapid interrupt)
        speaking_event.set()
        try:
            _tts_engine.say(text)
            _tts_engine.runAndWait()
        except Exception as e:
            print(f"[tts] speech error: {e}")
        finally:
            if my_generation == _speech_generation:
                speaking_event.clear()
                # Back to a resting state once speech genuinely finishes —
                # without this it would sit on "speaking" forever. _awake
                # and set_state live in section 6 but are safe to reach for
                # here: both exist at module scope well before this ever runs.
                set_state("awake" if _awake.is_set() else "sleeping")

    threading.Thread(target=_run, daemon=True).start()


def stop_speaking() -> None:
    global _speech_generation
    with _speech_lock:
        _speech_generation += 1
        if _tts_engine is not None:
            try:
                _tts_engine.stop()
            except Exception:
                pass
    speaking_event.clear()


# ---------------------------------------------------------------------------
# 4. SYSTEM ACTIONS — open apps, run commands, manage files.
#    Deliberately open-ended: "run <command>" executes exactly what you say,
#    with no whitelist. See README.md "Safety notes" before relying on this.
# ---------------------------------------------------------------------------
WORKSPACE_DIR.mkdir(exist_ok=True)
_apps = load_apps()
_os_name = platform.system()  # 'Windows' | 'Darwin' | 'Linux'


def _open_url(url: str) -> None:
    # webbrowser.open() can block for a long time on some setups (a
    # misconfigured $BROWSER, a headless box with no display handler) —
    # confirmed while testing this in a containerized environment. Fire it
    # on a daemon thread so a bad browser launcher can never freeze Charlie.
    threading.Thread(target=webbrowser.open, args=(url,), daemon=True).start()


def open_app(name: str) -> str:
    name = name.strip()
    if not name:
        return "Open what, exactly?"

    target = _apps.get(name.lower())

    try:
        if target:
            if target.startswith("http://") or target.startswith("https://"):
                _open_url(target)
            elif _os_name == "Windows":
                os.startfile(target)  # type: ignore[attr-defined]
            else:
                subprocess.Popen(shlex.split(target))
        elif _os_name == "Windows":
            os.startfile(name)  # type: ignore[attr-defined]
        elif _os_name == "Darwin":
            subprocess.Popen(["open", "-a", name])
        else:  # Linux and anything else
            subprocess.Popen([name.lower().replace(" ", "-")])
        return f"Opening {name}."
    except Exception as e:
        return f"I couldn't open {name}: {e}. Add it to apps.json with its exact path if this keeps happening."


def run_shell_command(command: str) -> str:
    command = command.strip()
    if not command:
        return "Run what, exactly?"
    print(f"[exec] {command}")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        output = (result.stdout or result.stderr or "").strip()
        summary = output[:280] if output else "No output."
        if result.returncode == 0:
            return f"Done. {summary}"
        return f"That command exited with an error. {summary}"
    except subprocess.TimeoutExpired:
        return "That command was still running after 30 seconds, so I gave up on it."
    except Exception as e:
        return f"I couldn't run that: {e}"


_EXTENSION_HINTS = [
    (r"\bpython\b", ".py"),
    (r"\bjavascript\b", ".js"),
    (r"\bhtml\b", ".html"),
    (r"\bcss\b", ".css"),
    (r"\bjson\b", ".json"),
    (r"\bbash\b|\bshell script\b", ".sh"),
    (r"\bpoem\b|\bstory\b|\bletter\b|\bessay\b|\bnote\b", ".txt"),
]


def _guess_extension(description: str) -> str:
    lower = description.lower()
    for pattern, ext in _EXTENSION_HINTS:
        if re.search(pattern, lower):
            return ext
    return ".txt"


def _slugify(text: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (slug[:max_len] or "charlie-file")


def write_literal_file(name: str, content: str) -> str:
    if not re.search(r"\.\w+$", name):
        name += ".txt"
    path = WORKSPACE_DIR / name
    path.write_text(content, encoding="utf-8")
    return f"Saved {name} to your Charlie Files folder."


def create_ai_file(description: str) -> str:
    content = generate_content(description)
    if not content:
        return "I couldn't generate that just now — try again in a moment."
    filename = _slugify(description) + _guess_extension(description)
    path = WORKSPACE_DIR / filename
    path.write_text(content, encoding="utf-8")
    return f"Done — saved it as {filename} in your Charlie Files folder."


def open_workspace_folder() -> str:
    try:
        if _os_name == "Windows":
            os.startfile(WORKSPACE_DIR)  # type: ignore[attr-defined]
        elif _os_name == "Darwin":
            subprocess.Popen(["open", str(WORKSPACE_DIR)])
        else:
            subprocess.Popen(["xdg-open", str(WORKSPACE_DIR)])
        return "Opening your Charlie Files folder."
    except Exception as e:
        return f"I couldn't open that folder: {e}"


# ---------------------------------------------------------------------------
# 5. COMMAND DISPATCH
# Patterns are anchored to the START of the (wake-word-stripped) command,
# checked most-specific-first, rather than "does this word appear anywhere"
# — the web version of Charlie learned the hard way that loose substring
# matching hijacks real questions (e.g. bare "open" matching "what does
# open source mean"). Anything that doesn't match falls through to Gemini.
# ---------------------------------------------------------------------------
def _extract(pattern: str, command: str):
    m = re.match(pattern, command, re.IGNORECASE)
    return m.groupdict() if m else None


def handle_command(command: str) -> str:
    command = command.strip()
    if not command:
        return f"Yes? I'm listening."

    lower = command.lower()

    if re.match(r"^(exit|quit|shut down|goodbye|stop listening)\b", lower):
        speak("Goodbye.")
        time.sleep(0.3)
        os._exit(0)

    if re.match(r"^(forget our conversation|clear the chat|start a new conversation|new conversation)\b", lower):
        reset_conversation()
        return "Fresh start — conversation cleared."

    if re.match(r"^(check for update|update yourself|update now)", lower):
        remote_version = _fetch_remote_version()
        if not remote_version:
            return "I couldn't reach GitHub to check for updates."
        if _parse_version(remote_version) <= _parse_version(VERSION):
            return f"I'm already up to date, running version {VERSION}."

        def _delayed_update():
            time.sleep(2.5)  # let the spoken confirmation actually play first
            check_for_update(auto_apply=True)

        threading.Thread(target=_delayed_update, daemon=True).start()
        return f"Version {remote_version} is available. Updating now, I'll be right back."

    if re.search(r"^(what'?s the time|what time is it|current time)\b", lower):
        return f"It's {datetime.now().strftime('%I:%M %p').lstrip('0')}."

    if re.search(r"^(what'?s the date|what'?s today'?s date|what day is it)\b", lower):
        return f"It's {datetime.now().strftime('%A, %B %d')}."

    m = _extract(r"^open\s+(my\s+)?(files|charlie folder|workspace)\s*$", lower)
    if m:
        return open_workspace_folder()

    m = re.match(r"^(?:open|launch|start)\s+(?P<name>.+)$", command, re.IGNORECASE)
    if m:
        return open_app(m.group("name"))

    m = re.match(r"^(?:run|execute)\s+(?P<cmd>.+)$", command, re.IGNORECASE)
    if m:
        return run_shell_command(m.group("cmd"))

    m = re.match(r"^search (?:google|the web) for\s+(?P<q>.+)$", command, re.IGNORECASE)
    if m:
        _open_url(f"https://www.google.com/search?q={urlparse.quote(m.group('q'))}")
        return f"Searching for {m.group('q')}."

    m = re.match(r"^search youtube for\s+(?P<q>.+)$", command, re.IGNORECASE)
    if m:
        _open_url(f"https://www.youtube.com/results?search_query={urlparse.quote(m.group('q'))}")
        return f"Searching YouTube for {m.group('q')}."

    m = re.match(
        r"^(?:create|make|write)\s+a\s+file\s+called\s+(?P<name>.+?)\s+with\s+(?P<content>.+)$",
        command, re.IGNORECASE,
    )
    if m:
        return write_literal_file(m.group("name"), m.group("content"))

    m = re.match(r"^(?:make|write|create)\s+me\s+a\s+(?P<desc>.+)$", command, re.IGNORECASE)
    if m:
        return create_ai_file(m.group("desc"))

    if re.match(r"^help\b", lower):
        return (
            "I can open apps, run commands, search the web, save files you dictate or "
            "have me generate, and answer anything else through Gemini. Say 'go to sleep' "
            "or 'wake up' to pause or resume me, and 'check for updates' any time. Just ask."
        )

    return ask_gemini(command)


# ---------------------------------------------------------------------------
# 6. SPEECH RECOGNITION — always-on listening loop
#
# State machine: sleeping -> awake -> thinking -> speaking -> awake ...
# "sleeping" ignores everything except "wake up". The mic itself never
# stops running in any state (recognizer.listen() below is always active) —
# what changes is whether a heard phrase gets acted on.
#
# Heard commands are handled on a background thread (_process_command), not
# inline in this loop. That's the fix for the real bug this had before:
# handle_command() can block for up to 30s on a Gemini call or a shell
# command, and running it directly in this loop meant the mic was
# completely dead — not just "can't interrupt", genuinely not listening —
# for that whole window. Now the loop always goes straight back to
# listening, and a generation counter discards a superseded reply if a
# newer command comes in while an older one is still "thinking".
# ---------------------------------------------------------------------------
WAKE_WORD_RE = re.compile(r"\bcharlie\b", re.IGNORECASE)
STRIP_LEAD_RE = re.compile(r"^\s*(hey|hi|hello|ok|okay)?\s*,?\s*charlie\s*,?\s*", re.IGNORECASE)
STRIP_TRAIL_RE = re.compile(r"\s*,?\s*charlie\s*[.!?]?\s*$", re.IGNORECASE)
WAKE_UP_RE = re.compile(r"\bwake up\b", re.IGNORECASE)
GO_TO_SLEEP_RE = re.compile(r"\b(go to sleep|go sleep|sleep now)\b", re.IGNORECASE)

current_state = "awake"  # sleeping | awake | thinking | speaking — matches _awake's default below
_awake = threading.Event()
_awake.set()  # Charlie starts ready to go — no extra "wake up" needed on launch
_processing_generation = 0
_generation_lock = threading.Lock()


def set_state(state: str) -> None:
    global current_state
    current_state = state
    print(f"[{state}]")


def strip_wake_word(transcript: str) -> str:
    return STRIP_TRAIL_RE.sub("", STRIP_LEAD_RE.sub("", transcript)).strip()


def _process_command(command: str, generation: int) -> None:
    set_state("thinking")
    reply = handle_command(command)
    with _generation_lock:
        if generation != _processing_generation:
            return  # a newer command came in while this one was thinking — drop it
    set_state("speaking")
    speak(reply)


def handle_heard_transcript(transcript: str) -> None:
    global _processing_generation

    if not WAKE_WORD_RE.search(transcript):
        return

    if not _awake.is_set():
        if WAKE_UP_RE.search(transcript):
            _awake.set()
            set_state("awake")
            speak("I'm awake.")
        return  # ignore anything else while asleep

    if GO_TO_SLEEP_RE.search(transcript):
        _awake.clear()
        set_state("sleeping")
        speak('Going to sleep. Say "Charlie, wake up" any time.')
        return

    # Barge-in: hearing the wake word while Charlie is talking interrupts
    # him immediately instead of waiting for the response to finish.
    if speaking_event.is_set():
        stop_speaking()

    print(f"You: {transcript}")
    command = strip_wake_word(transcript)

    with _generation_lock:
        _processing_generation += 1
        generation = _processing_generation
    threading.Thread(target=_process_command, args=(command, generation), daemon=True).start()


def listen_loop() -> None:
    try:
        import speech_recognition as sr
    except ImportError:
        print("speech_recognition isn't installed. Run: pip install SpeechRecognition pyaudio")
        sys.exit(1)

    recognizer = sr.Recognizer()
    try:
        mic = sr.Microphone()
    except OSError as e:
        print(f"No microphone available ({e}). Plug one in and restart Charlie.")
        sys.exit(1)

    with mic as source:
        print("Calibrating for background noise...")
        recognizer.adjust_for_ambient_noise(source, duration=1)

    set_state("awake")
    print("Charlie is listening. Say \"Charlie\" followed by a command. Ctrl+C to quit.")
    while True:
        # This listen() call is the only thing that ever blocks this loop —
        # heard commands are handed off to a thread (see handle_heard_transcript)
        # so the mic is back to listening again immediately, even while
        # Charlie is still thinking or speaking about the last thing.
        with mic as source:
            try:
                audio = recognizer.listen(source, timeout=6, phrase_time_limit=12)
            except sr.WaitTimeoutError:
                continue

        try:
            transcript = recognizer.recognize_google(audio)
        except sr.UnknownValueError:
            continue
        except sr.RequestError as e:
            print(f"[stt] speech recognition service error: {e}")
            time.sleep(1)
            continue

        handle_heard_transcript(transcript)


# ---------------------------------------------------------------------------
# 7. AUTO-UPDATE
# Checks GitHub for a newer version on every startup and applies it
# automatically — no manual re-download, no resetting anything. This only
# ever touches Charlie's own code (this script, or the packaged
# executable) — your API key, apps.json, and everything in ~/CharlieFiles
# are never read or written here, so an update never resets your setup.
# ---------------------------------------------------------------------------
GITHUB_REPO = "AdasV-tech/Charlie-Assistant"
RAW_BASE = f"https://raw.githubusercontent.com/{GITHUB_REPO}/main/desktop"
RELEASES_API = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

_PLATFORM_ASSET = {
    "Windows": "charlie-windows.zip",
    "Darwin": "charlie-macos.zip",
    "Linux": "charlie-linux.zip",
}


def _parse_version(v: str) -> tuple:
    parts = re.findall(r"\d+", v)
    return tuple(int(p) for p in parts) or (0,)


def _http_get(url: str, timeout: int = 6) -> bytes | None:
    try:
        with urlrequest.urlopen(url, timeout=timeout) as resp:
            return resp.read()
    except (HTTPError, URLError, TimeoutError, OSError):
        return None


def _fetch_remote_version() -> str | None:
    raw = _http_get(f"{RAW_BASE}/VERSION")
    return raw.decode("utf-8").strip() if raw else None


def _relaunch_script() -> None:
    """Re-execs the current script so the update takes effect immediately —
    no manual restart needed."""
    python = sys.executable
    os.execv(python, [python, str(Path(__file__).resolve())] + sys.argv[1:])


def _apply_script_update() -> bool:
    new_source = _http_get(f"{RAW_BASE}/charlie_pc.py")
    if not new_source:
        return False
    try:
        compile(new_source, "charlie_pc.py", "exec")
    except SyntaxError as e:
        print(f"Downloaded update failed a sanity check ({e}) — not applying it.")
        return False

    script_path = Path(__file__).resolve()
    tmp_path = script_path.with_suffix(".py.new")
    tmp_path.write_bytes(new_source)
    os.replace(tmp_path, script_path)  # atomic swap on POSIX and Windows
    return True


def _apply_frozen_update() -> None:
    """Best-effort updater for the PyInstaller-packaged executable. Exits or
    re-execs the process on success; simply returns on failure so the caller
    can fall back to the current version. Not exercised in development (no
    packaged build or published release to test against here) — verify this
    once you've published a tagged release, per README.md."""
    import tempfile
    import zipfile

    release_raw = _http_get(RELEASES_API)
    if not release_raw:
        return
    try:
        release = json.loads(release_raw)
    except json.JSONDecodeError:
        return

    asset_name = _PLATFORM_ASSET.get(_os_name)
    asset_url = next(
        (a["browser_download_url"] for a in release.get("assets", []) if a.get("name") == asset_name),
        None,
    ) if asset_name else None
    if not asset_url:
        return

    zip_bytes = _http_get(asset_url, timeout=30)
    if not zip_bytes:
        return

    current_exe = Path(sys.executable).resolve()
    with tempfile.TemporaryDirectory() as tmp_dir:
        zip_path = Path(tmp_dir) / "update.zip"
        zip_path.write_bytes(zip_bytes)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(tmp_dir)
        new_exe = next(
            (p for p in Path(tmp_dir).iterdir() if p.is_file() and p.name != "update.zip"), None
        )
        if not new_exe:
            return

        if _os_name == "Windows":
            # Can't overwrite a running .exe on Windows — hand off to a tiny
            # batch script that waits for this process to exit, swaps the
            # file, and relaunches it.
            staged = current_exe.with_name("charlie_update_staged.exe")
            shutil.copy(new_exe, staged)
            helper = current_exe.with_name("charlie_update.bat")
            helper.write_text(
                "@echo off\r\n"
                "timeout /t 2 /nobreak > NUL\r\n"
                f'del "{current_exe}"\r\n'
                f'move /y "{staged}" "{current_exe}"\r\n'
                f'start "" "{current_exe}"\r\n'
                'del "%~f0"\r\n'
            )
            subprocess.Popen(["cmd", "/c", str(helper)], creationflags=subprocess.DETACHED_PROCESS)
            os._exit(0)
        else:
            # POSIX allows replacing the file backing an already-running process.
            os.chmod(new_exe, 0o755)
            os.replace(new_exe, current_exe)
            os.execv(str(current_exe), [str(current_exe)] + sys.argv[1:])


def check_for_update(auto_apply: bool = True) -> None:
    remote_version = _fetch_remote_version()
    if not remote_version:
        return  # offline or GitHub unreachable — never block startup on this
    if _parse_version(remote_version) <= _parse_version(VERSION):
        return

    print(f"Update available: {VERSION} -> {remote_version}")
    if not auto_apply:
        print("Restart without --no-update to apply it automatically.")
        return

    print("Downloading update...")
    if getattr(sys, "frozen", False):
        _apply_frozen_update()  # exits/relaunches on success; only returns on failure
        print("Update download failed — continuing with the current version.")
        return

    if _apply_script_update():
        print(f"Updated to {remote_version}. Restarting...")
        _relaunch_script()
    else:
        print("Update download failed — continuing with the current version.")


# ---------------------------------------------------------------------------
# 8. ENTRY POINT
# ---------------------------------------------------------------------------
def uninstall() -> None:
    """Removes everything Charlie has written to this machine: the saved
    API key, generated files, and Python cache. Doesn't touch charlie_pc.py
    itself or your installed pip packages — see the printed steps for those,
    since deleting your own running script/interpreter mid-execution isn't
    something this can safely do for you."""
    pycache = APP_DIR / "__pycache__"
    targets = [
        (label, path) for label, path in [
            ("Saved API key (charlie_config.json)", CONFIG_PATH),
            (f"Generated files folder ({WORKSPACE_DIR})", WORKSPACE_DIR),
            ("Python cache (__pycache__)", pycache),
        ]
        if path.exists()
    ]

    if not targets:
        print("Nothing to remove — Charlie hasn't left anything on this machine yet.")
        return

    print("This will permanently delete:")
    for label, _ in targets:
        print(f"  - {label}")
    confirm = input("Type 'yes' to remove all of the above: ").strip().lower()
    if confirm != "yes":
        print("Cancelled — nothing was removed.")
        return

    for label, path in targets:
        try:
            shutil.rmtree(path) if path.is_dir() else path.unlink()
            print(f"Removed {label}.")
        except OSError as e:
            print(f"Couldn't remove {label}: {e}")

    print()
    print("Charlie's data is gone. To finish uninstalling completely:")
    print(f"  1. Delete this folder: {APP_DIR}")
    print("  2. (optional) pip uninstall SpeechRecognition pyttsx3 PyAudio")
    print("  3. (optional) unset the GEMINI_API_KEY environment variable, if you set one")


def main(auto_update: bool = True) -> None:
    global _api_key
    print(f"Charlie desktop assistant — v{VERSION}")
    print(f"Platform: {_os_name}")
    print(f"Files Charlie creates go to: {WORKSPACE_DIR}")
    print("Run with --uninstall at any time to remove everything Charlie has saved.")

    # "Always auto update, not that you need to reset everything": checks
    # GitHub on every launch and, if there's a newer version, downloads and
    # applies it automatically (re-launching itself so it takes effect
    # immediately) — never touching charlie_config.json, apps.json, or
    # ~/CharlieFiles. See section 7 above. If this updates and relaunches,
    # everything below this line simply doesn't run in THIS process.
    check_for_update(auto_apply=auto_update)

    _api_key = get_api_key()
    if not _api_key:
        print("No API key set — Charlie will still handle local commands (open/run/files), "
              "but general questions won't work until you set GEMINI_API_KEY.")

    try:
        listen_loop()
    except KeyboardInterrupt:
        print("\nGoodbye.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Charlie — desktop voice assistant")
    parser.add_argument(
        "--uninstall", action="store_true",
        help="remove the saved API key, generated files, and cache, then exit",
    )
    parser.add_argument(
        "--no-update", action="store_true",
        help="skip the automatic update check on startup",
    )
    args = parser.parse_args()

    if args.uninstall:
        uninstall()
        sys.exit(0)

    main(auto_update=not args.no_update)
