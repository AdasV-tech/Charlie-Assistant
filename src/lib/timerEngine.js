// Minimal countdown engine shared by every Pomodoro-style timer in the app
// (Dashboard's Study/Workout Mode, the Study Center's subject-aware
// Pomodoro) — deliberately DOM-agnostic so each caller owns its own
// readout element instead of this module reaching into specific IDs.
export function createCountdown({ onTick, onComplete }) {
  let intervalId = null;
  let secondsLeft = 0;

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function start(totalSeconds) {
    stop();
    secondsLeft = totalSeconds;
    onTick(secondsLeft);
    intervalId = setInterval(() => {
      secondsLeft -= 1;
      onTick(secondsLeft);
      if (secondsLeft <= 0) {
        stop();
        onComplete();
      }
    }, 1000);
  }

  function isRunning() {
    return intervalId !== null;
  }

  return { start, stop, isRunning };
}

export function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
