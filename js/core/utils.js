const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Двуязычное поле {ru, kz} → строка на текущем языке (с откатом на русский). */
export function localized(field, lang) {
  if (field == null) return '';
  if (typeof field !== 'object') return String(field);
  return field[lang] || field.ru || '';
}

const LOCALES = { ru: 'ru-RU', kz: 'kk-KZ', en: 'en-GB' };

export function formatDate(iso, lang) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALES[lang] ?? 'ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
}

export function formatNumber(n) {
  return new Intl.NumberFormat('ru-RU').format(n);
}

/** Пропускает только http(s)-ссылки и относительные пути — защита от javascript: из базы. */
export function safeUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

export function truncate(text, max) {
  const clean = String(text ?? '').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, clean.lastIndexOf(' ', max) > 0 ? clean.lastIndexOf(' ', max) : max) + '…';
}

export function initials(name) {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
