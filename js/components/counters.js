// Анимированные счётчики. Анимация стартует, когда счётчик попадает в экран.
// Если данные из Firebase пришли позже — счётчик плавно досчитывает до нового значения.
import { formatNumber, prefersReducedMotion } from '../core/utils.js';

const DURATION = 1800;
const easeOutCubic = (x) => 1 - (1 - x) ** 3;

const state = new WeakMap(); // el → { shown, target, visible, frame }

function animate(el) {
  const s = state.get(el);
  cancelAnimationFrame(s.frame);
  if (prefersReducedMotion() || s.shown === s.target) {
    s.shown = s.target;
    el.textContent = formatNumber(s.target);
    return;
  }
  const from = s.shown;
  const start = performance.now();
  const step = (now) => {
    // время кадра бывает чуть меньше времени старта — без нижней границы счётчик уходил в минус
    const progress = Math.min(Math.max((now - start) / DURATION, 0), 1);
    s.shown = Math.round(from + (s.target - from) * easeOutCubic(progress));
    el.textContent = formatNumber(s.shown);
    if (progress < 1) s.frame = requestAnimationFrame(step);
  };
  s.frame = requestAnimationFrame(step);
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    state.get(entry.target).visible = true;
    observer.unobserve(entry.target);
    animate(entry.target);
  });
}, { threshold: 0.4 });

export function initCounter(el, target) {
  state.set(el, { shown: 0, target, visible: false, frame: 0 });
  el.textContent = formatNumber(0);
  observer.observe(el);
}

export function setCounterTarget(el, target) {
  const s = state.get(el);
  if (!s) return initCounter(el, target);
  s.target = target;
  if (s.visible) animate(el);
}
