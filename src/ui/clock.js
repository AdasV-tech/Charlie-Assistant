// Live HH:MM:SS readout in the top bar.
const clockReadout = document.getElementById('clockReadout');

function tickClock() {
  clockReadout.textContent = new Date().toLocaleTimeString([], { hour12: false });
}

export function initClock() {
  tickClock();
  setInterval(tickClock, 1000);
}
