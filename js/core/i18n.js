// Двуязычность.
// В HTML тексты пишутся по-русски и помечаются ключом:
//   <h2 data-i18n="home.map.title">…</h2>
//   <h2 data-i18n-html="home.map.title">…<em>акцент</em></h2>   — строка словаря с разметкой
//   <input data-i18n-attr="placeholder:contacts.form.name, aria-label:contacts.form.name">
// При смене языка все помеченные элементы переводятся, а на document
// отправляется событие 'langchange' — по нему перерисовываются динамические блоки.
import ru from '../i18n/ru.js';
import kz from '../i18n/kz.js';
import en from '../i18n/en.js';

const DICTS = { ru, kz, en };
// Порядок = порядок кнопок на сайте; первый — язык по умолчанию.
export const LANGS = ['kz', 'ru', 'en'];
const HTML_LANG = { ru: 'ru', kz: 'kk', en: 'en' };
const STORAGE_KEY = 'ytf:lang';

function detectLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {
    // localStorage недоступен — используем язык по умолчанию.
  }
  return LANGS[0];
}

let current = detectLang();

// Тексты, изменённые в админке (Firestore site/texts): { ru: { 'nav.home': '…' }, kz: { … } }.
// Перекрывают словари; пустой перевод на казахский — берётся казахский словарь, затем русский текст.
let overrides = { ru: {}, kz: {}, en: {} };

export const getLang = () => current;

export function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

/** Применить тексты из админки. При apply = true — сразу перерисовать страницу. */
export function setOverrides(data, { apply = true } = {}) {
  overrides = { ru: data?.ru ?? {}, kz: data?.kz ?? {}, en: data?.en ?? {} };
  if (apply) refreshTexts();
}

/** Перевести страницу заново и сообщить динамическим блокам (они слушают 'langchange'). */
export function refreshTexts() {
  applyTranslations();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: current } }));
}

/** Текст на конкретном языке (с учётом правок из админки), без откатов на другие языки. */
export function tIn(lang, key) {
  const value = overrides[lang]?.[key] || lookup(DICTS[lang], key);
  return typeof value === 'string' ? value : '';
}

export function t(key, vars) {
  let value = overrides[current][key] || lookup(DICTS[current], key) || overrides.ru[key] || lookup(ru, key);
  if (value == null) {
    console.warn(`[i18n] Нет перевода: ${key}`);
    return key;
  }
  if (Array.isArray(value)) value = value[value.length - 1];
  if (vars) value = value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
  return value;
}

const PLURAL_INDEX = { one: 0, few: 1, many: 2, other: 2 };

/** Форма слова для числа. В словаре: ['выпускник', 'выпускника', 'выпускников'] или одна строка. */
export function plural(key, n) {
  return pluralIn(current, key, n);
}

/** Форма слова для числа на конкретном языке. */
export function pluralIn(lang, key, n) {
  const forms = lookup(DICTS[lang], key) ?? lookup(ru, key);
  if (!Array.isArray(forms)) return forms ?? key;
  const rule = new Intl.PluralRules(HTML_LANG[lang]).select(n);
  return forms[PLURAL_INDEX[rule] ?? 2] ?? forms[forms.length - 1];
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  // Только для строк из наших словарей (курсивные акценты <em> в заголовках) — не для данных из Firebase.
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // не критично
  }
  document.documentElement.lang = HTML_LANG[lang];
  applyTranslations();
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export function initI18n() {
  document.documentElement.lang = HTML_LANG[current];
  applyTranslations();
}
