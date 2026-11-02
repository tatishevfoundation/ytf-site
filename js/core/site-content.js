// Настройки и тексты, которые правятся в админке: контакты, соцсети, ссылки на формы, тексты страниц,
// кнопка на главной и фото в шапках страниц.
// Значения из js/config/site.js — запасные, пока в базе ничего не сохранено.
import { SITE } from '../config/site.js';
import { loadPagesDoc, loadSiteSettings, loadTexts } from './data.js';
import { refreshTexts, setOverrides } from './i18n.js';
import { escapeHtml, safeUrl } from './utils.js';

export const DEFAULT_SETTINGS = {
  address: SITE.address,
  phone: SITE.phone,
  email: SITE.email,
  // Точка на карте «Контакты», выбранная в админке: { lat, lng }. Пока её нет — карта ищет по адресу.
  mapPoint: null,
  socials: [{ name: 'Instagram', url: SITE.instagram.url }],
  forms: { bestirek: SITE.forms.bestirek, craft: SITE.forms.craft, kentau: '' },
  // Способы перевода для страницы «Пожертвовать»: [{ name, icon, number, link }]
  donate: { methods: [] },
  // Полоса-объявление над шапкой (например, приём заявок). until — дата, untilTime — время (Алматы), countdown — таймер
  announcement: { enabled: false, text: {}, linkLabel: {}, link: '', until: '', untilTime: '', countdown: true },
};

// site/pages: надпись синей кнопки на первом экране главной (ведёт на «Программы») и фото справа в шапках страниц
export const PAGE_PHOTOS = ['about', 'programs', 'scholars', 'graduates', 'donate'];
export const DEFAULT_PAGES = { heroButton: { label: {} }, photos: {} };

let settings = DEFAULT_SETTINGS;
let pages = DEFAULT_PAGES;

export const getSettings = () => settings;
export const getPages = () => pages;

/** «+7 (700) 331 13 14» → «tel:+77003311314» */
export const phoneHref = (phone) => `tel:${String(phone ?? '').replace(/[^\d+]/g, '')}`;

/** Встраиваемая карта Google — по точке из админки или по адресу, без ключа API. */
export function mapEmbedUrl(address, point = null) {
  const q = point && Number.isFinite(point.lat) && Number.isFinite(point.lng) ? `${point.lat},${point.lng}` : address;
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

// Раньше здесь были полные реквизиты (БИН, IBAN, ссылка Kaspi) — превращаем их в способы перевода.
function legacyMethods(d = {}) {
  const methods = [];
  if (d.iban) methods.push({ name: d.bank?.ru || 'Банковский счёт', icon: '', number: d.iban, link: '' });
  if (d.kaspi) methods.push({ name: 'Kaspi', icon: '', number: '', link: d.kaspi });
  return methods;
}

/** Сохранённые в базе настройки + значения по умолчанию для того, чего ещё нет. */
export function mergeSettings(saved) {
  if (!saved) return DEFAULT_SETTINGS;
  const methods = saved.donate?.methods;
  return {
    address: { ...DEFAULT_SETTINGS.address, ...saved.address },
    phone: saved.phone || DEFAULT_SETTINGS.phone,
    email: saved.email || DEFAULT_SETTINGS.email,
    mapPoint: saved.mapPoint ?? null,
    socials: Array.isArray(saved.socials) ? saved.socials.filter((s) => s?.url) : DEFAULT_SETTINGS.socials,
    forms: { ...DEFAULT_SETTINGS.forms, ...saved.forms },
    donate: { methods: Array.isArray(methods) ? methods.filter((m) => m?.number || m?.link) : legacyMethods(saved.donate) },
    announcement: { ...DEFAULT_SETTINGS.announcement, ...saved.announcement },
  };
}

export function mergePages(saved) {
  return {
    heroButton: { ...DEFAULT_PAGES.heroButton, ...saved?.heroButton },
    photos: { ...saved?.photos },
  };
}

/** Момент, когда объявление скрывается: дата + время по Алматы (UTC+5), без времени — конец дня. */
export function announcementEnd(a) {
  if (!a?.until) return null;
  const end = new Date(`${a.until}T${a.untilTime || '23:59'}:${a.untilTime ? '00' : '59'}+05:00`);
  return Number.isNaN(end.getTime()) ? null : end;
}

/** Объявление показывается, если включено и срок ещё не прошёл. */
export function activeAnnouncement() {
  const a = settings.announcement;
  if (!a?.enabled || !(a.text?.ru || a.text?.kz || a.text?.en)) return null;
  const end = announcementEnd(a);
  if (end && end < new Date()) return null;
  return a;
}

// ——— Фото справа в шапке страницы: <section class="page-hero" data-photo="about"> ———

function applyPagePhoto() {
  const hero = document.querySelector('.page-hero[data-photo]');
  if (!hero) return;
  const src = safeUrl(pages.photos?.[hero.dataset.photo]);
  const container = hero.querySelector('.container');
  let media = hero.querySelector('.page-hero__media');
  hero.classList.toggle('page-hero--photo', Boolean(src));
  if (!src) {
    media?.remove();
    return;
  }
  // текст шапки собираем в левую колонку, фото — в правую
  if (!container.querySelector(':scope > .page-hero__text')) {
    const text = document.createElement('div');
    text.className = 'page-hero__text';
    text.append(...container.childNodes);
    container.append(text);
  }
  if (!media) {
    media = document.createElement('div');
    media.className = 'page-hero__media';
    container.append(media);
  }
  if (media.dataset.src !== src) {
    media.dataset.src = src;
    media.innerHTML = `<img src="${escapeHtml(src)}" alt="">`;
  }
}

/**
 * Запускается до отрисовки страницы: сохранённые в браузере значения применяются сразу,
 * свежие из базы — когда придут (страница перерисуется сама).
 */
export function initSiteContent() {
  loadTexts((texts, { fresh }) => setOverrides(texts, { apply: fresh }));
  loadSiteSettings((saved, { fresh }) => {
    settings = mergeSettings(saved);
    if (fresh) refreshTexts();
  });
  loadPagesDoc((saved, { fresh }) => {
    pages = mergePages(saved);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyPagePhoto, { once: true });
    else applyPagePhoto();
    if (fresh) refreshTexts();
  });
}
