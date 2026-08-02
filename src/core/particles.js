// Small particle bursts around the Core, varying by emotional state — see
// styles/components.css for the two motion variants (radiate/drift) this
// drives. Purely decorative on top of setState()'s real triggers; this
// module never decides *when* a state happens, only how it looks.
const CORE_WRAP_ID = 'coreWrap';

// rate: ms between spawns (lower = busier). hue matches the hue-rotate()
// degrees used for this state's Core glow in main.css, so particles read
// as the same color family as the glow they're drifting off of. States
// not listed here (sleeping, offline) get no particles at all.
const STATE_PARTICLES = {
  listening: { rate: 2600, base: 'cyan' },
  thinking: { rate: 900, base: 'amber' },
  speaking: { rate: 500, base: 'cyan' },
  connecting: { rate: 700, base: 'amber', hue: 200 },
  searching: { rate: 350, base: 'cyan', hue: 90 },
  learning: { rate: 500, base: 'cyan', hue: 280, variant: 'drift' },
  busy: { rate: 400, base: 'amber', hue: 40 },
};

let spawnTimer = null;

function spawnParticle(config) {
  const container = document.getElementById(CORE_WRAP_ID);
  if (!container) return;

  const particle = document.createElement('span');
  particle.className =
    config.variant === 'drift' ? 'core-particle core-particle--drift' : 'core-particle';
  particle.style.setProperty('--particle-color', `var(--${config.base})`);
  if (config.hue) particle.style.filter = `hue-rotate(${config.hue}deg)`;

  if (config.variant === 'drift') {
    particle.style.setProperty('--start-x', `${Math.round((Math.random() - 0.5) * 90)}px`);
  } else {
    particle.style.setProperty('--angle', `${Math.round(Math.random() * 360)}deg`);
    particle.style.setProperty('--distance', `${90 + Math.round(Math.random() * 40)}px`);
  }

  container.appendChild(particle);
  particle.addEventListener('animationend', () => particle.remove());
}

export function setParticleState(state) {
  clearInterval(spawnTimer);
  spawnTimer = null;

  const config = STATE_PARTICLES[state];
  if (!config) return;

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  spawnParticle(config); // one immediately, rather than waiting a full interval
  spawnTimer = setInterval(() => spawnParticle(config), config.rate);
}
