// Renders an SVG circular progress ring as an HTML string, for embedding
// directly into a template literal (see ui/pages/foodScanner.js). Kept as a
// plain string-returning helper — matching the innerHTML-template style
// already used throughout the app — rather than a DOM-building function.
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Fixed, theme-independent colors (see styles/components.css) — a "good"
// score should always read as green and a "poor" one as red, regardless of
// which of the 7 accent themes is active. That's a deliberate exception to
// this app's usual theme-reactive coloring: quality here needs a universal
// meaning, not a brand accent.
export function scoreQuality(value, max = 10) {
  const pct = (value / max) * 100;
  if (pct >= 70) return 'good';
  if (pct >= 40) return 'ok';
  return 'poor';
}

export function scoreRingHTML(value, max, { size = 88, decimals = 1, quality = '' } = {}) {
  const fraction = Math.max(0, Math.min(1, value / max));
  const offset = CIRCUMFERENCE * (1 - fraction);
  const qualityClass = quality ? ` score-ring--${quality}` : '';
  return `
    <div class="score-ring${qualityClass}" style="--score-ring-size: ${size}px;">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="score-ring-track" cx="50" cy="50" r="${RADIUS}"></circle>
        <circle
          class="score-ring-fill"
          cx="50" cy="50" r="${RADIUS}"
          stroke-dasharray="${CIRCUMFERENCE.toFixed(2)}"
          stroke-dashoffset="${offset.toFixed(2)}"
        ></circle>
      </svg>
      <div class="score-ring-value">${value.toFixed(decimals)}</div>
    </div>
  `;
}
