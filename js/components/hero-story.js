// Первый экран главной: история стипендиата, привязанная к прокрутке.
//
// Секция .story выше экрана на --story-scroll (задаётся в index.html); внутри неё
// .story__sticky закреплён, пока прокрутка проходит этот участок. Прогресс 0…1 считается
// из положения секции, поэтому при остановке прокрутки сцена замирает, а при прокрутке
// вверх события идут назад. Кадр перерисовывается только когда прогресс изменился.
//
// Без WebGL — статичная картинка; при prefers-reduced-motion — один статичный кадр без закрепления.
import { CHAPTERS, chapterAt } from '../story/timeline.js';
import { prefersReducedMotion } from '../core/utils.js';

const STATIC_PROGRESS = 0.1; // кадр для статичной версии: вручение гранта

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export async function initHeroStory(section) {
  if (!section) return;
  const sticky = section.querySelector('.story__sticky');
  const stage = section.querySelector('.story__stage');
  const canvas = section.querySelector('.story__canvas');
  const chapters = [...section.querySelectorAll('[data-chapter]')];
  const bar = section.querySelector('.story__bar');

  const useFallback = () => section.classList.add('story--static', 'story--fallback');

  if (!webglAvailable()) {
    useFallback();
    return;
  }

  const isStatic = prefersReducedMotion();
  if (isStatic) section.classList.add('story--static');

  let story;
  try {
    const { createStoryScene } = await import('../story/scene.js');
    story = createStoryScene(canvas);
  } catch (err) {
    console.warn('[story] 3D-сцена недоступна, показываем картинку', err);
    useFallback();
    return;
  }

  // ?story=0.42 — зафиксировать кадр (для проверки отдельных моментов истории)
  const pinned = Number.parseFloat(new URLSearchParams(location.search).get('story'));
  const hasPinned = Number.isFinite(pinned);

  let progress = -1;
  let size = '';

  function measureProgress() {
    if (hasPinned) return Math.min(1, Math.max(0, pinned));
    if (isStatic) return STATIC_PROGRESS;
    const rect = section.getBoundingClientRect();
    // отступ закрепления (= высота шапки); offsetTop у sticky-элемента не годится — он уже «прилип»
    const top = Number.parseFloat(getComputedStyle(sticky).top) || 0;
    const distance = section.offsetHeight - sticky.offsetHeight;
    if (distance <= 0) return 0;
    return Math.min(1, Math.max(0, (top - rect.top) / distance));
  }

  function setChapter(p) {
    const current = chapterAt(p);
    chapters.forEach((el) => el.classList.toggle('is-active', el.dataset.chapter === current));
    if (bar) bar.style.transform = `scaleX(${p})`;
    section.style.setProperty('--story-p', p.toFixed(4));
  }

  function frame() {
    const rect = stage.getBoundingClientRect();
    const nextSize = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
    const p = measureProgress();
    const resized = nextSize !== size;
    if (resized) {
      size = nextSize;
      story.resize(rect.width, rect.height);
    }
    if (resized || Math.abs(p - progress) > 1e-5) {
      progress = p;
      story.render(p);
      setChapter(p);
    }
  }

  // Браузер присылает scroll не чаще одного раза за кадр, поэтому рисуем прямо в обработчике.
  window.addEventListener('scroll', frame, { passive: true });
  new ResizeObserver(() => { size = ''; frame(); }).observe(stage);
  story.ready.then(() => { size = ''; frame(); });
  section.classList.add('story--ready');
  frame();

  // Проверка истории в консоли: __ytfStory.render(0.5)
  if (hasPinned) window.__ytfStory = { render: (p) => { story.render(p); setChapter(p); }, chapters: CHAPTERS };
}
