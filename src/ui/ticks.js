// Draws the 40 decorative tick marks around the Core's outer ring once, at
// load time — purely visual, no state.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function drawCoreTicks() {
  const tickGroup = document.getElementById('tickGroup');
  const cx = 200;
  const cy = 200;
  const r = 180;
  const count = 40;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x1 = cx + Math.cos(angle) * (r - 6);
    const y1 = cy + Math.sin(angle) * (r - 6);
    const x2 = cx + Math.cos(angle) * (r + 6);
    const y2 = cy + Math.sin(angle) * (r + 6);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    tickGroup.appendChild(line);
  }
}
