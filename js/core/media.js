// Видео на сайте: ссылка YouTube / Vimeo или загруженный файл (mp4, webm, mov).
// На странице новости — встроенный плеер; в карточках — обложка с ▶, по клику видео
// открывается во всплывающем плеере (js/components/video-modal.js).
import { escapeHtml, safeUrl } from './utils.js';

export function parseVideo(raw) {
  const url = safeUrl(raw);
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) {
    return {
      kind: 'youtube',
      embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`,
      thumb: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${vimeo[1]}`, thumb: '' };
  // Ссылка на видеофайл (в том числе загруженный в хранилище из админки)
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url) || /firebasestorage\.googleapis\.com/.test(url)) {
    return { kind: 'file', src: url, thumb: '' };
  }
  return null;
}

export const isVideoUrl = (raw) => Boolean(parseVideo(raw));

function playerHtml(v, title, autoplay = false) {
  if (v.kind === 'file') {
    return `<video class="video__el" src="${escapeHtml(v.src)}" controls preload="metadata" playsinline${autoplay ? ' autoplay' : ''}></video>`;
  }
  const src = autoplay ? `${v.embed}${v.embed.includes('?') ? '&' : '?'}autoplay=1` : v.embed;
  return `<iframe class="video__el" src="${escapeHtml(src)}" title="${escapeHtml(title)}"${autoplay ? '' : ' loading="lazy"'}
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
}

/** Встроенный плеер (страница новости, биография основателя). */
export function videoPlayer(raw, title = '') {
  const v = parseVideo(raw);
  return v ? `<div class="video">${playerHtml(v, title)}</div>` : '';
}

/** Плеер для всплывающего окна — сразу начинает воспроизведение. */
export function modalPlayer(raw, title = '') {
  const v = parseVideo(raw);
  return v ? playerHtml(v, title, true) : '';
}

/** Обложка карточки: фото, а если его нет — кадр из YouTube. */
export function newsCover(item) {
  return safeUrl(item.photo) || parseVideo(item.video)?.thumb || '';
}

export const PLAY_BADGE = '<span class="play-badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span>';

/**
 * Обложка-кнопка для карточки: по клику видео откроется во всплывающем плеере.
 * cover — фото карточки; если его нет, берётся кадр из YouTube.
 */
export function videoCover(raw, { cover = '', title = '', label = '', className = '' } = {}) {
  const v = parseVideo(raw);
  if (!v) return '';
  const img = safeUrl(cover) || v.thumb;
  return `
    <button type="button" class="video-cover ${className}" data-video="${escapeHtml(safeUrl(raw))}" data-video-title="${escapeHtml(title)}" aria-label="${escapeHtml(label || title)}">
      ${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy">` : ''}
      ${PLAY_BADGE}
    </button>`;
}
