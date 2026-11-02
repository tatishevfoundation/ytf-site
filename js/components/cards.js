// Общие карточки: записи лент (новости, достижения), партнёры.
import { t } from '../core/i18n.js';
import { escapeHtml, formatDate, localized, safeUrl, truncate } from '../core/utils.js';
import { PLAY_BADGE, newsCover } from '../core/media.js';

/** Кнопка «▶ Смотреть видео» для карточек людей. */
export function watchButton(url, title) {
  const href = safeUrl(url);
  if (!href) return '';
  return `<button type="button" class="watch-btn" data-video="${escapeHtml(href)}" data-video-title="${escapeHtml(title)}">
    <span class="watch-btn__icon" aria-hidden="true">▶</span>${escapeHtml(t('common.watch'))}</button>`;
}

// Категории раздела «Достижения» (в базе — коллекция honors)
export const HONOR_CATEGORIES = ['foundation', 'scholars', 'graduates', 'wins', 'startups', 'trips', 'volunteering', 'achievements'];

export const honorTag = (item) => (HONOR_CATEGORIES.includes(item.category) ? t(`honors.categories.${item.category}`) : '');
export const newsTag = (item) => (item.tag ? t(`news.tags.${item.tag}`) : '');

/**
 * Карточка записи ленты со ссылкой на полный текст.
 * href — страница ленты (news.html / achievements.html), tag — подпись категории.
 */
export function feedCard(item, lang, { href, tag = '', heading = 'h3', textMax = 160 }) {
  const photo = newsCover(item);
  const person = localized(item.person, lang);
  return `
    <article class="news-card">
      <div class="news-card__media">${photo ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy">` : ''}${item.video ? PLAY_BADGE : ''}</div>
      <p class="news-card__meta">
        ${tag ? `<span class="news-card__tag">${escapeHtml(tag)}</span>` : ''}
        ${item.date ? `<time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date, lang))}</time>` : ''}
      </p>
      <${heading} class="news-card__title"><a class="news-card__link" href="${href}#${encodeURIComponent(item.id)}">${escapeHtml(localized(item.title, lang))}</a></${heading}>
      ${person ? `<p class="news-card__person">${escapeHtml(person)}</p>` : ''}
      <p class="news-card__text">${escapeHtml(truncate(localized(item.text, lang), textMax))}</p>
    </article>`;
}

// Пока в админке нет партнёров — показываем известных по программам.
export const DEFAULT_PARTNERS = [
  { name: 'AlmaU', url: 'https://almau.edu.kz/' },
  { name: { ru: 'Колледжи Казахстана', kz: 'Қазақстан колледждері', en: 'Colleges of Kazakhstan' } },
  { name: { ru: 'Школа №16 г. Кентау', kz: 'Кентау қ. №16 мектеп', en: 'School No. 16, Kentau' } },
];

export function partnerItems(partners, lang) {
  const list = partners.length ? partners : DEFAULT_PARTNERS;
  return list.map((p) => {
    const name = localized(p.name, lang);
    const logo = safeUrl(p.logo);
    const url = safeUrl(p.url);
    const inner = logo
      ? `<img class="partner__logo" src="${escapeHtml(logo)}" alt="${escapeHtml(name)}" loading="lazy">`
      : `<span class="partner__name">${escapeHtml(name)}</span>`;
    return `<li class="partner">${url ? `<a class="partner__link" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${escapeHtml(name)}">${inner}</a>` : `<span class="partner__link">${inner}</span>`}</li>`;
  }).join('');
}
