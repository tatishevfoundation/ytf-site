// «Тексты сайта»: любые надписи на страницах, включая названия пунктов меню.
// Изменения хранятся в Firestore site/texts и перекрывают словари js/i18n/*.js.
import { lookup } from '../core/i18n.js';
import { escapeHtml } from '../core/utils.js';
import ru from '../i18n/ru.js';
import kz from '../i18n/kz.js';
import en from '../i18n/en.js';
import { $, CONTENT_LANGS, ctx, fail, sectionHead, toast } from './ui.js';

const DICTS = { ru, kz, en };

const GROUPS = [
  { title: 'Меню сайта (названия вкладок)', prefixes: ['nav.'] },
  { title: 'Главная страница', prefixes: ['home.'] },
  { title: 'О фонде', prefixes: ['about.'] },
  { title: 'Программы', prefixes: ['programsPage.', 'programs.'] },
  { title: 'Стипендиаты', prefixes: ['scholarsPage.'] },
  { title: 'Выпускники', prefixes: ['graduatesPage.', 'filters.'] },
  { title: 'Достижения', prefixes: ['achievementsPage.', 'honors.'] },
  { title: 'Партнёры', prefixes: ['partnersPage.'] },
  { title: 'Новости', prefixes: ['newsPage.', 'news.'] },
  { title: 'Контакты', prefixes: ['contacts.'] },
  { title: 'Пожертвовать', prefixes: ['donate.'] },
  { title: 'Подвал сайта', prefixes: ['footer.'] },
  { title: 'Страница «не найдена» (404)', prefixes: ['notFound.'] },
  { title: 'Общие кнопки и подписи', prefixes: ['common.', 'map.', 'announce.'] },
];

// Эти тексты правятся в своих разделах или служебные.
const HIDDEN = [
  /^contacts\.faq\./, /^contacts\.instagram$/, /^stats\./,
  // содержимое программ правится в разделе «Программы»
  /^programs\./, /^programsPage\.(bestirek|craft|kentau)\./, /^home\.programs\.(bestirek|craft|kentau)/,
];

const NAMES = {
  hero: 'Первый экран', ticker: 'Бегущая строка', programs: 'Блок программ', stories: 'Истории', impact: 'Цифры',
  news: 'Новости', cta: 'Призыв внизу страницы', meta: 'Для поисковиков', chapters: 'Этапы анимации', form: 'Форма',
  values: 'Ценности', bestirek: 'БесТірек', craft: 'Получи ремесло!', kentau: 'Стипендии Кентау', tags: 'Тег',
  fairness: 'Справедливость', quality: 'Устойчивость и качество', responsibility: 'Соц. ответственность', practices: 'Мировые практики',
  title: 'Заголовок', lead: 'Подзаголовок', eyebrow: 'Метка над заголовком', metaTitle: 'Название вкладки браузера',
  description: 'Описание для поисковиков', text: 'Текст', facts: 'Список фактов (каждый с новой строки)',
  stages: 'Этапы отбора (каждый с новой строки)', empty: 'Текст, если список пуст', hint: 'Подсказка', cta: 'Кнопка',
  button: 'Кнопка', contact: 'Вторая кнопка', apply: 'Кнопка заявки', more: 'Ссылка «Подробнее»',
};

function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(key);
    else if (v && !Array.isArray(v) && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}

const isHtml = (key) => /<em>/.test(lookup(ru, key) ?? '');
const isList = (key) => /\.(facts|stages)$/.test(key);

function label(key) {
  if (key.startsWith('nav.')) return `Пункт меню «${lookup(ru, key)}»`;
  const parts = key.split('.').slice(1).map((p) => NAMES[p]).filter(Boolean);
  return parts.length ? parts.join(' — ') : 'Текст';
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Значение из словаря/базы → текст для поля редактора. */
function toEditor(key, value) {
  if (value == null) return '';
  if (isList(key)) return value.split('|').map((s) => s.trim()).join('\n');
  if (isHtml(key)) return unescape(value.replace(/<em>(.*?)<\/em>/g, '*$1*').replace(/<[^>]+>/g, ''));
  return value;
}

/** Текст из редактора → значение для сайта. */
function fromEditor(key, text) {
  const clean = String(text ?? '').trim();
  if (isList(key)) return clean.split('\n').map((s) => s.trim()).filter(Boolean).join('|');
  if (isHtml(key)) return escapeHtml(clean).replace(/\*(.+?)\*/g, '<em>$1</em>');
  return clean;
}

const rows = (text) => Math.min(8, Math.max(1, Math.ceil(String(text).length / 55) + (String(text).match(/\n/g)?.length ?? 0)));

export async function renderTexts() {
  const { db, fs, main } = ctx;
  main.innerHTML = `
    ${sectionHead('Тексты сайта', 'Здесь можно изменить любую надпись на сайте — заголовки, описания, кнопки и названия пунктов меню. Измените текст и нажмите «Сохранить изменения» внизу.')}
    <div class="panel texts-tips">
      <p>• Слова в <b>*звёздочках*</b> на сайте выделяются синим курсивом. Например: <code>Новости *фонда*</code>.</p>
      <p>• Не удаляйте слова в фигурных скобках, например <code>{count}</code> или <code>{year}</code> — туда сайт сам подставляет числа.</p>
      <p>• Если казахский или английский текст оставить пустым, на этой версии сайта покажется русский.</p>
    </div>
    <label class="field texts-search"><span class="field__label">Найти текст</span>
      <input class="input" type="search" id="texts-search" placeholder="Начните вводить слово с сайта…"></label>
    <div id="texts-groups"><p class="loading">Загрузка…</p></div>
    <div class="save-bar"><span id="texts-changed"></span><button class="btn btn--primary" type="button" id="texts-save">Сохранить изменения</button></div>`;

  const empty = () => Object.fromEntries(CONTENT_LANGS.map((l) => [l, {}]));
  let saved = empty();
  try {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'texts'));
    if (snap.exists()) saved = Object.fromEntries(CONTENT_LANGS.map((l) => [l, snap.data()[l] ?? {}]));
  } catch (err) {
    fail(err);
  }
  if (ctx.tab !== 'texts') return;

  const keys = flatten(ru).filter((k) => !HIDDEN.some((re) => re.test(k)));
  const groupOf = (key) => GROUPS.find((g) => g.prefixes.some((p) => key.startsWith(p)));
  const current = (lang, key) => saved[lang][key] ?? lookup(DICTS[lang], key) ?? '';

  $('texts-groups').innerHTML = GROUPS.map((g, gi) => {
    const items = keys.filter((k) => groupOf(k) === g);
    if (!items.length) return '';
    return `
      <details class="panel texts-group"${gi === 0 ? ' open' : ''}>
        <summary class="texts-group__title">${escapeHtml(g.title)} <span class="texts-group__count">${items.length}</span></summary>
        ${items.map((key) => {

          return `
            <div class="text-item" data-key="${escapeHtml(key)}">
              <div class="text-item__head">
                <span class="text-item__label">${escapeHtml(label(key))}</span>
                <button type="button" class="admin-link" data-reset>вернуть исходный текст</button>
              </div>
              <div class="lang-pair">
                ${CONTENT_LANGS.map((lang) => {
                  const v = toEditor(key, current(lang, key));
                  return `<label class="field"><span class="field__hint"><span class="lang-pair__tag">${lang.toUpperCase()}</span></span>
                    <textarea class="textarea textarea--auto" data-lang="${lang}" rows="${rows(v)}">${escapeHtml(v)}</textarea></label>`;
                }).join('')}
              </div>
            </div>`;
        }).join('')}
      </details>`;
  }).join('');

  const groupsEl = $('texts-groups');
  const changedEl = $('texts-changed');
  const dirty = new Set();
  const markDirty = (item) => {
    dirty.add(item.dataset.key);
    item.classList.add('is-changed');
    changedEl.textContent = `Изменено текстов: ${dirty.size}`;
  };

  groupsEl.addEventListener('input', (e) => {
    const item = e.target.closest('.text-item');
    if (item) markDirty(item);
  });
  groupsEl.addEventListener('click', (e) => {
    if (!e.target.matches('[data-reset]')) return;
    const item = e.target.closest('.text-item');
    const key = item.dataset.key;
    for (const lang of CONTENT_LANGS) item.querySelector(`[data-lang="${lang}"]`).value = toEditor(key, lookup(DICTS[lang], key) ?? '');
    markDirty(item);
  });

  // Поиск: оставляем тексты, где встречается слово, и раскрываем их группы
  $('texts-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    groupsEl.querySelectorAll('.texts-group').forEach((group) => {
      let any = false;
      group.querySelectorAll('.text-item').forEach((item) => {
        const hay = [...item.querySelectorAll('textarea')].map((t) => t.value).join(' ').toLowerCase()
          + item.querySelector('.text-item__label').textContent.toLowerCase();
        const match = !q || hay.includes(q);
        item.hidden = !match;
        any ||= match;
      });
      group.hidden = !any;
      if (q) group.open = any;
    });
  });

  $('texts-save').addEventListener('click', async () => {
    // Храним только то, что отличается от исходных словарей
    const next = empty();
    groupsEl.querySelectorAll('.text-item').forEach((item) => {
      const key = item.dataset.key;
      for (const lang of CONTENT_LANGS) {
        const value = fromEditor(key, item.querySelector(`[data-lang="${lang}"]`).value);
        const original = lookup(DICTS[lang], key) ?? '';
        if (value && value !== original) next[lang][key] = value;
      }
    });
    const button = $('texts-save');
    button.disabled = true;
    try {
      await fs.setDoc(fs.doc(db, 'site', 'texts'), { ...next, updatedAt: fs.serverTimestamp() });
      saved = next;
      dirty.clear();
      groupsEl.querySelectorAll('.is-changed').forEach((el) => el.classList.remove('is-changed'));
      changedEl.textContent = '';
      toast('Тексты сохранены. Обновите страницу сайта, чтобы увидеть изменения.');
    } catch (err) {
      fail(err);
    } finally {
      button.disabled = false;
    }
  });
}
