// Программы фонда. Хранятся в Firestore (programs/{key}) и правятся в админке: «Программы».
// Пока в базе пусто — показываем программы из словарей (как было до появления раздела).
import { PROGRAMS } from '../config/site.js';
import { LANGS, tIn } from './i18n.js';
import { loadProgramDocs } from './data.js';
import { getSettings } from './site-content.js';
import { localized } from './utils.js';

const perLang = (key, transform = (s) => s) => Object.fromEntries(LANGS.map((l) => [l, transform(tIn(l, key))]));
const toLines = (s) => s.split('|').map((x) => x.trim()).filter(Boolean).join('\n');

/** Программы «как сейчас на сайте» — для показа по умолчанию и для переноса в базу. */
export function defaultPrograms() {
  return PROGRAMS.map((key, i) => ({
    key,
    order: i + 1,
    visible: true,
    name: perLang(`programs.${key}`),
    badge: perLang(`home.programs.${key}Badge`),
    lead: perLang(`programsPage.${key}.lead`),
    text: perLang(`programsPage.${key}.text`),
    facts: perLang(`programsPage.${key}.facts`, toLines),
    stages: perLang(`programsPage.${key}.stages`, toLines),
    requirements: {},
    documents: {},
    deadline: '',
    formUrl: getSettings().forms?.[key] ?? '',
    regulation: '',
  }));
}

let fromDb = null;

export function loadPrograms(render) {
  return loadProgramDocs((list, meta) => {
    fromDb = list.length ? list : null;
    render(getPrograms(), meta);
  });
}

/** Программы по порядку; без all — только видимые на сайте. */
export function getPrograms({ all = false } = {}) {
  return (fromDb ?? defaultPrograms())
    .filter((p) => all || p.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function programName(key, lang) {
  const p = (fromDb ?? defaultPrograms()).find((x) => x.key === key);
  return p ? localized(p.name, lang) : '';
}

/** Многострочное поле → пункты списка. */
export const listItems = (field, lang) =>
  localized(field, lang).split('\n').map((s) => s.trim()).filter(Boolean);

/** 'open' — приём идёт до даты, 'closed' — дата прошла, null — срок не указан. */
export function deadlineState(p) {
  if (!p.deadline) return null;
  return new Date(`${p.deadline}T23:59:59`) >= new Date() ? 'open' : 'closed';
}
