// Всплывающий видеоплеер. Любой элемент с data-video="ссылка" открывает его по клику.
// При закрытии плеер удаляется — видео останавливается.
import { t } from '../core/i18n.js';
import { escapeHtml } from '../core/utils.js';
import { modalPlayer } from '../core/media.js';

let dialog;

function ensureDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.className = 'video-modal';
  dialog.innerHTML = `
    <div class="video-modal__box">
      <button type="button" class="video-modal__close">✕</button>
      <div class="video-modal__player"></div>
      <p class="video-modal__title"></p>
    </div>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.querySelector('.video-modal__close').addEventListener('click', close);
  // клик по затемнённому фону закрывает окно
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => {
    dialog.querySelector('.video-modal__player').innerHTML = '';
    document.body.classList.remove('no-scroll');
  });
  return dialog;
}

export function openVideo(url, title = '') {
  const html = modalPlayer(url, title);
  if (!html) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const d = ensureDialog();
  d.querySelector('.video-modal__close').setAttribute('aria-label', t('common.close'));
  d.querySelector('.video-modal__player').innerHTML = html;
  d.querySelector('.video-modal__title').innerHTML = escapeHtml(title);
  d.showModal();
  document.body.classList.add('no-scroll');
}

export function initVideoModal() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-video]');
    if (!trigger) return;
    e.preventDefault();
    openVideo(trigger.dataset.video, trigger.dataset.videoTitle || '');
  });
}
