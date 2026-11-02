// Цифры фонда: круги-инфографика на главной, бегущая строка и пункт «Сегодня» в таймлайне.
// В админке («Цифры на главной») можно задать до 7 кругов: число + подпись на трёх языках.
// Пока круги не заданы — показываются 4 стандартных из site/stats (гранты, выпускники, обмен, стартапы).
import { LANGS, getLang, plural, pluralIn } from './i18n.js';
import { formatNumber, localized } from './utils.js';

export const STAT_KEYS = ['grants', 'graduates', 'exchange', 'startups'];
export const MAX_BUBBLES = 7;

/** Стандартные 4 круга с подписями на всех языках — для заполнения админки. */
export function defaultBubbles(stats) {
  return STAT_KEYS.map((key) => ({
    value: String(stats[key] ?? 0),
    label: Object.fromEntries(LANGS.map((lang) => [lang, pluralIn(lang, `stats.${key}`, Number(stats[key]) || 0)])),
  }));
}

/** [{ value: '316', label: 'грантов на обучение' }] на текущем языке. */
export function impactItems(stats) {
  const lang = getLang();
  const custom = (Array.isArray(stats?.bubbles) ? stats.bubbles : [])
    .filter((b) => String(b?.value ?? '').trim())
    .slice(0, MAX_BUBBLES);
  if (custom.length) return custom.map((b) => ({ value: String(b.value).trim(), label: localized(b.label, lang) }));
  return STAT_KEYS.map((key) => ({ value: String(stats?.[key] ?? 0), label: plural(`stats.${key}`, Number(stats?.[key]) || 0) }));
}

/**
 * Разбирает «316», «90%», «1 000+», «$2 млн» на число (для анимации счётчика) и текст вокруг него.
 * Если числа нет — number = null, значение показывается как есть.
 */
export function splitValue(value) {
  // число с пробелами-разделителями тысяч: «1 200», но в «15 лет» пробел остаётся в подписи
  const m = String(value).match(/^(\D*?)(\d+(?:[\s ]\d{3})*)(.*)$/);
  if (!m) return { prefix: '', number: null, suffix: String(value) };
  return { prefix: m[1], number: Number(m[2].replace(/\D/g, '')), suffix: m[3] };
}

/** Значение для бегущей строки и текста: числа с разделителем тысяч. */
export function formatValue(value) {
  const { prefix, number, suffix } = splitValue(value);
  return number == null ? suffix : `${prefix}${formatNumber(number)}${suffix}`;
}
