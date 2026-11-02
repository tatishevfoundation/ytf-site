// Иконки соцсетей определяются по адресу ссылки — в админке достаточно указать название и ссылку
// (или загрузить свою картинку-значок).
import { escapeHtml, safeUrl } from './utils.js';

const svg = (body) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/>'),
  facebook: svg('<path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.8 1.9-1.8H18V2.6c-.4 0-1.6-.2-3-.2-3 0-4.6 1.8-4.6 4.9v2.2H7.5V13h2.9v8"/>'),
  youtube: svg('<rect x="2.5" y="5" width="19" height="14" rx="4"/><path d="m10 9 5 3-5 3z" fill="currentColor"/>'),
  telegram: svg('<path d="M21 4 3 11.2l5.6 2.1L19 7l-8 7.6V20l3.2-3.6L18 19z"/>'),
  whatsapp: svg('<path d="M4 20l1.2-3.8A8.5 8.5 0 1 1 8 19z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a5 5 0 0 1-2.2-2.2l.8-1-1-2z"/>'),
  tiktok: svg('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2.2 4.4 5 4.6"/>'),
  linkedin: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16M8 7.8v.1M12 16v-3.2c0-1.4.9-2.3 2.1-2.3s1.9.9 1.9 2.3V16M12 10.5V16"/>'),
  x: svg('<path d="M4 4l16 16M20 4 4 20"/>'),
  vk: svg('<path d="M3 7h3.2c.6 3.6 2.3 5.6 3.6 6V7h3v3.5c1.4-.2 2.9-1.9 3.4-3.5h3c-.4 2.2-2.1 4-3.3 4.8 1.2.6 3.1 2.2 3.8 4.7h-3.3c-.6-1.7-2-3-3.6-3.2v3.2h-.4C7 16.5 3.6 13 3 7z"/>'),
  threads: svg('<path d="M16.5 11.2c-.6-2.6-2.4-3.7-4.6-3.7-3 0-4.4 2.2-4.4 4.6s1.6 4.4 4.6 4.4c2.6 0 4.6-1.6 4.6-4 0-2.7-2.8-3.4-5-2.8"/><circle cx="12" cy="12" r="9"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
};

const HOSTS = [
  ['instagram', /instagram\.com/], ['facebook', /facebook\.com|fb\.com/], ['youtube', /youtube\.com|youtu\.be/],
  ['telegram', /t\.me|telegram/], ['whatsapp', /wa\.me|whatsapp/], ['tiktok', /tiktok\.com/],
  ['linkedin', /linkedin\.com/], ['x', /twitter\.com|x\.com/], ['vk', /vk\.com/], ['threads', /threads\.net/],
];

export function socialIcon(url) {
  const found = HOSTS.find(([, re]) => re.test(String(url)));
  return ICONS[found ? found[0] : 'link'];
}

/** Значок соцсети: загруженная в админке картинка, иначе — встроенный по ссылке. */
export function socialIconHtml({ url, icon } = {}) {
  const src = safeUrl(icon);
  return src ? `<img class="social-icon-img" src="${escapeHtml(src)}" alt="" width="20" height="20">` : socialIcon(url);
}
