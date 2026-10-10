import { createRobotScene } from './robot-scene.js?v=20261011';

const motion = matchMedia('(prefers-reduced-motion: reduce)');
const button = document.getElementById('animationToggle');
let paused = motion.matches;
let frame;
let previous;
const avatars = [...document.querySelectorAll('[data-robot-state]')].map(element => ({
  element, visible: false, time: 0, stage: null, loading: false
}));

function schedule() {
  if (!frame && !paused && !document.hidden && avatars.some(item => item.visible && item.stage)) {
    previous = undefined;
    frame = requestAnimationFrame(tick);
  }
}

function tick(now) {
  frame = undefined;
  if (paused || document.hidden) return;
  const elapsed = previous === undefined ? 0 : Math.min((now - previous) / 1000, .1);
  previous = now;
  for (const item of avatars) {
    if (!item.visible || !item.stage) continue;
    item.time = (item.time + elapsed) % item.stage.duration;
    item.stage.renderAt(item.time);
  }
  if (avatars.some(item => item.visible && item.stage)) frame = requestAnimationFrame(tick);
}

function syncButton() {
  const action = paused ? 'Resume robot animations' : 'Pause robot animations';
  button.setAttribute('aria-label', action);
  button.setAttribute('title', action);
  button.setAttribute('aria-pressed', String(paused));
  button.querySelector('.theme-toggle__label').textContent = paused ? 'Resume' : 'Pause';
}

button.hidden = false;
syncButton();
button.addEventListener('click', () => {
  paused = !paused;
  syncButton();
  for (const item of avatars) if (item.visible) load(item);
  schedule();
});

async function load(item) {
  if (item.stage || item.loading || paused) return;
  item.loading = true;
  const canvas = item.element.querySelector('canvas');
  try {
    const size = Math.max(1, item.element.clientWidth);
    const stage = await createRobotScene(canvas, size, size);
    stage.setState(item.element.dataset.robotState);
    stage.renderAt(0);
    item.stage = canvas.robotStage = stage;
    item.element.classList.add('is-ready');
    new ResizeObserver(() => {
      const width = Math.max(1, item.element.clientWidth);
      stage.resize(width, width);
      stage.renderAt(item.time);
    }).observe(item.element);
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      item.stage = null;
      item.element.classList.remove('is-ready');
    });
    schedule();
  } catch (error) {
    // Keep the approved static pose if WebGL or the model is unavailable.
    console.warn('Robot animation unavailable; showing its static pose.', error);
  }
}

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = avatars.find(avatar => avatar.element === entry.target);
      item.visible = entry.isIntersecting;
      if (item.visible) load(item);
    }
    schedule();
  });
  for (const item of avatars) observer.observe(item.element);
} else {
  for (const item of avatars) { item.visible = true; load(item); }
}

motion.addEventListener('change', () => {
  paused = motion.matches;
  syncButton();
  for (const item of avatars) if (item.visible) load(item);
  schedule();
});
document.addEventListener('visibilitychange', schedule);
