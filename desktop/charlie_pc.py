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
  7. Entry point
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

# ---------------------------------------------------------------------------
# 1. CONFIG
# The Gemini key lives outside the repo: env var first, then a local
# gitignored config file, then an interactive first-run prompt. Never
# hardcode a real key into this file — it's meant to be shared/committed.
# ---------------------------------------------------------------------------
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
            "have me generate, and answer anything else through Gemini. Just ask."
        )

    return ask_gemini(command)


# ---------------------------------------------------------------------------
# 6. SPEECH RECOGNITION — always-on listening loop
# ---------------------------------------------------------------------------
WAKE_WORD_RE = re.compile(r"\bcharlie\b", re.IGNORECASE)
STRIP_LEAD_RE = re.compile(r"^\s*(hey|hi|hello|ok|okay)?\s*,?\s*charlie\s*,?\s*", re.IGNORECASE)
STRIP_TRAIL_RE = re.compile(r"\s*,?\s*charlie\s*[.!?]?\s*$", re.IGNORECASE)


def strip_wake_word(transcript: str) -> str:
    return STRIP_TRAIL_RE.sub("", STRIP_LEAD_RE.sub("", transcript)).strip()


def handle_heard_transcript(transcript: str) -> None:
    if not WAKE_WORD_RE.search(transcript):
        return

    # Barge-in: hearing the wake word while Charlie is talking interrupts
    # him immediately instead of waiting for the response to finish.
    if speaking_event.is_set():
        stop_speaking()

    print(f"You: {transcript}")
    command = strip_wake_word(transcript)
    reply = handle_command(command)
    speak(reply)


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

    print("Charlie is listening. Say \"Charlie\" followed by a command. Ctrl+C to quit.")
    while True:
        # Listening runs continuously, including while Charlie is speaking
        # (see handle_heard_transcript) so barge-in works.
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
# 7. ENTRY POINT
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


def main() -> None:
    global _api_key
    print("Charlie desktop assistant")
    print(f"Platform: {_os_name}")
    print(f"Files Charlie creates go to: {WORKSPACE_DIR}")
    print("Run with --uninstall at any time to remove everything Charlie has saved.")

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
    args = parser.parse_args()

    if args.uninstall:
        uninstall()
        sys.exit(0)

    main()
