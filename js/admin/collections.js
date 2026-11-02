// Разделы-списки админки: добавить / изменить / удалить запись.
import { AREAS } from '../config/regions.js';
import { PROGRAMS } from '../config/site.js';
import { HONOR_CATEGORIES } from '../components/cards.js';
import { defaultPrograms } from '../core/programs.js';
import { setOverrides } from '../core/i18n.js';
import { escapeHtml } from '../core/utils.js';
import ru from '../i18n/ru.js';
import { bindUploads, formFieldsHtml, readForm } from './fields.js';
import { $, ctx, fail, fmtDate, sectionHead, toast } from './ui.js';

const TAGS = ['events', 'programs', 'graduates', 'foundation'];
const nextOrder = (docs) => ({ order: docs.length + 1 });
const VIDEO_HINT = 'Ссылка на YouTube (лучший вариант) или видеофайл с компьютера. На сайте появится кнопка ▶ — видео откроется в плеере.';

const LIST_HINT = 'Каждый пункт — с новой строки.';

// Программы для выбора у стипендиатов и выпускников: из раздела «Программы», а пока он пуст — стандартные.
async function programOptions() {
  const snap = await ctx.fs.getDocs(ctx.fs.query(ctx.fs.collection(ctx.db, 'programs'), ctx.fs.orderBy('order', 'asc')));
  const list = snap.docs.length ? snap.docs.map((d) => d.data()) : defaultPrograms();
  return list.map((p) => ({ value: p.key, label: p.name?.ru || p.key }));
}

export const COLLECTIONS = {
  programs: {
    title: 'Программы',
    intro: 'Всё о программах: описание, требования, документы, этапы отбора, сроки приёма и ссылка на заявку. Показываются на главной и на странице «Программы». Если указать дату «Приём заявок до», на сайте появится плашка со сроком, а после этой даты кнопка заявки скроется сама.',
    addLabel: 'Добавить программу',
    orderBy: ['order', 'asc'],
    idField: 'key',
    defaults: (docs) => ({ order: docs.length + 1, visible: true }),
    seed: {
      label: 'Перенести программы, которые сейчас на сайте',
      // учитываем правки из «Текстов сайта» и ссылки на формы из «Контактов»
      items: async () => {
        const [texts, settings] = await Promise.all([
          ctx.fs.getDoc(ctx.fs.doc(ctx.db, 'site', 'texts')),
          ctx.fs.getDoc(ctx.fs.doc(ctx.db, 'site', 'settings')),
        ]);
        if (texts.exists()) setOverrides(texts.data(), { apply: false });
        const forms = settings.exists() ? settings.data().forms ?? {} : {};
        return defaultPrograms().map((p) => ({ id: p.key, ...p, formUrl: forms[p.key] ?? p.formUrl }));
      },
      done: 'Программы перенесены — теперь их можно редактировать',
    },
    fields: [
      { key: 'name', label: 'Название', bilingual: true, required: true },
      {
        key: 'key',
        label: 'Код (латиницей)',
        required: true,
        readonlyOnEdit: true,
        pattern: '[a-z0-9-]+',
        hint: 'Короткое имя латиницей без пробелов, например it-camp. Используется в адресе страницы.',
      },
      { key: 'order', label: 'Порядок', type: 'number', required: true, min: 1 },
      { key: 'visible', label: 'Показывать на сайте', type: 'checkbox' },
      { key: 'badge', label: 'Плашка (коротко)', bilingual: true, hint: 'Например: до 90% стоимости' },
      { key: 'lead', label: 'Кратко о программе (1 предложение)', bilingual: true, required: true },
      { key: 'text', label: 'Подробное описание', type: 'textarea', bilingual: true },
      { key: 'facts', label: 'Ключевые факты', type: 'textarea', bilingual: true, hint: LIST_HINT },
      { key: 'requirements', label: 'Требования к кандидатам', type: 'textarea', bilingual: true, hint: LIST_HINT },
      { key: 'documents', label: 'Необходимые документы', type: 'textarea', bilingual: true, hint: LIST_HINT },
      { key: 'stages', label: 'Этапы отбора', type: 'textarea', bilingual: true, hint: `${LIST_HINT} Порядок строк = порядок этапов.` },
      { key: 'deadline', label: 'Приём заявок до', type: 'day', hint: 'Можно оставить пустым, если срока нет.' },
      { key: 'formUrl', label: 'Ссылка на заявку (Google Форма)', type: 'url', hint: 'Если пусто — вместо «Подать заявку» будет кнопка «Узнать условия».' },
      { key: 'regulation', label: 'Положение о программе (PDF)', type: 'pdf', folder: 'programs' },
    ],
    row: (d) => ({
      title: d.name?.ru,
      meta: [`№ ${d.order}`, d.visible === false ? 'скрыта' : 'на сайте', d.deadline ? `приём до ${d.deadline.split('-').reverse().join('.')}` : ''].filter(Boolean).join(' · '),
    }),
  },
  news: {
    title: 'Новости',
    intro: 'Три последние новости показываются на главной, все — на странице «Новости». Казахский и английский переводы можно оставить пустыми: тогда на этих языках покажется русский текст.',
    addLabel: 'Добавить новость',
    orderBy: ['date', 'desc'],
    fields: [
      { key: 'title', label: 'Заголовок', bilingual: true, required: true },
      { key: 'text', label: 'Текст', type: 'textarea', bilingual: true, required: true, hint: 'Абзацы разделяйте пустой строкой.' },
      { key: 'date', label: 'Дата', type: 'date', required: true },
      { key: 'tag', label: 'Тег', type: 'select', options: TAGS.map((v) => ({ value: v, label: ru.news.tags[v] })) },
      { key: 'photo', label: 'Фото', type: 'image', folder: 'news' },
      { key: 'video', label: 'Видео', type: 'video', folder: 'news-video', hint: 'Ссылка на YouTube или видеофайл с компьютера (до 500 МБ). Длинные видео лучше выкладывать на YouTube — так они быстрее открываются у посетителей.' },
      { key: 'attachment', label: 'Прикреплённый файл', type: 'file', folder: 'news-files', hint: 'Например, положение о конкурсе в PDF. На странице новости появится кнопка «Скачать».' },
      { key: 'attachmentName', label: 'Надпись на кнопке скачивания', hint: 'Например: «Положение о конкурсе (PDF)». Можно оставить пустым.' },
    ],
    row: (d) => ({
      title: d.title?.ru,
      meta: [fmtDate(d.date), ru.news.tags[d.tag], d.video ? '▶ видео' : '', d.attachment ? '📎 файл' : ''].filter(Boolean).join(' · '),
    }),
  },
  graduates: {
    title: 'Стипендиаты и выпускники',
    intro: 'Один список для всех. «Учится» — человек показывается на странице «Стипендиаты», «Выпустился» — на странице «Выпускники». Когда стипендиат окончит обучение, просто поменяйте отметку и год. «Показывать на главной» + история — человек появится в блоке «Лица фонда» (там помещаются три).',
    addLabel: 'Добавить человека',
    orderBy: ['year', 'desc'],
    fields: [
      { key: 'name', label: 'Имя и фамилия', bilingual: true, required: true },
      {
        key: 'status',
        label: 'Статус',
        type: 'select',
        required: true,
        options: [{ value: 'scholar', label: 'Учится (стипендиат)' }, { value: 'graduate', label: 'Выпустился (выпускник)' }],
      },
      {
        key: 'program',
        label: 'Программа',
        type: 'select',
        required: true,
        options: PROGRAMS.map((p) => ({ value: p, label: ru.programs[p] })),
        loadOptions: programOptions,
      },
      { key: 'year', label: 'Год', type: 'number', required: true, min: 2005, max: 2100, hint: 'Стипендиату — год поступления, выпускнику — год выпуска.' },
      {
        key: 'region',
        label: 'Регион',
        type: 'select',
        required: true,
        options: Object.entries(AREAS).map(([value, a]) => ({ value, label: a.ru })).sort((a, b) => a.label.localeCompare(b.label, 'ru')),
      },
      { key: 'workplace', label: 'Место работы', bilingual: true },
      { key: 'photo', label: 'Фото', type: 'image', folder: 'graduates', hint: 'Квадратное фото, лицо по центру.' },
      { key: 'video', label: 'Видео-история (необязательно)', type: 'video', folder: 'graduates-video', hint: VIDEO_HINT },
      { key: 'featured', label: 'Показывать на главной в блоке «Лица фонда»', type: 'checkbox' },
      { key: 'story', label: 'История для главной', type: 'textarea', bilingual: true, hint: 'Короткая цитата, 1–3 предложения.' },
    ],
    row: (d) => ({
      title: d.name?.ru,
      meta: [d.status === 'scholar' ? 'Учится' : 'Выпускник', ru.programs[d.program], d.year, AREAS[d.region]?.ru, d.featured ? '★ на главной' : ''].filter(Boolean).join(' · '),
    }),
  },
  reports: {
    title: 'Годовые отчёты',
    intro: 'Отчёты показываются на странице «О фонде». Загрузите PDF с компьютера или вставьте ссылку.',
    addLabel: 'Добавить отчёт',
    orderBy: ['year', 'desc'],
    fields: [
      { key: 'title', label: 'Название', bilingual: true, required: true },
      { key: 'year', label: 'Год', type: 'number', required: true, min: 2005, max: 2100 },
      { key: 'pdf', label: 'Файл отчёта (PDF)', type: 'pdf', folder: 'reports', required: true },
    ],
    row: (d) => ({ title: d.title?.ru, meta: d.year }),
  },
  timeline: {
    title: 'Таймлайн',
    intro: 'События на странице «О фонде» (блок «Путь фонда»). Порядок — по году. Последний пункт «Сегодня» с цифрами добавляется автоматически.',
    addLabel: 'Добавить событие',
    orderBy: ['year', 'asc'],
    fields: [
      { key: 'year', label: 'Год', type: 'number', required: true, min: 1990, max: 2100 },
      { key: 'title', label: 'Событие', bilingual: true, required: true },
      { key: 'text', label: 'Описание', type: 'textarea', bilingual: true },
    ],
    row: (d) => ({ title: `${d.year} — ${d.title?.ru ?? ''}`, meta: '' }),
  },
  team: {
    title: 'Органы управления и команда',
    intro: 'Блок «Органы управления» на странице «О фонде». Выберите группу: «Президент фонда», «Попечительский совет» или «Команда». Порядок задаётся числом: 1 — первым. По нажатию на карточку посетитель увидит всплывающее окно с фото и биографией.',
    addLabel: 'Добавить человека',
    orderBy: ['order', 'asc'],
    defaults: nextOrder,
    fields: [
      { key: 'name', label: 'Имя и фамилия', bilingual: true, required: true },
      { key: 'role', label: 'Должность', bilingual: true, required: true },
      {
        key: 'group',
        label: 'Группа',
        type: 'select',
        required: true,
        options: [{ value: 'president', label: 'Президент фонда' }, { value: 'board', label: 'Попечительский совет' }, { value: 'team', label: 'Команда' }],
      },
      { key: 'order', label: 'Порядок', type: 'number', required: true, min: 1 },
      { key: 'photo', label: 'Фото', type: 'image', folder: 'team', hint: 'Вертикальное фото, примерно 4 : 5.' },
      { key: 'bio', label: 'Краткая биография', type: 'textarea', bilingual: true, hint: 'Показывается во всплывающем окне при нажатии на карточку (у президента — ещё и рядом с фото). Абзацы разделяйте пустой строкой.' },
    ],
    row: (d) => ({
      title: d.name?.ru,
      meta: [{ president: 'Президент фонда', board: 'Попечительский совет' }[d.group] ?? 'Команда', d.role?.ru, `№ ${d.order}`].filter(Boolean).join(' · '),
    }),
  },
  govdocs: {
    title: 'Документы',
    intro: 'Регламент и другие документы фонда — в блоке «Органы управления» на странице «О фонде».',
    addLabel: 'Добавить документ',
    orderBy: ['order', 'asc'],
    defaults: nextOrder,
    fields: [
      { key: 'title', label: 'Название', bilingual: true, required: true, hint: 'Например: Регламент работы Попечительского совета' },
      { key: 'file', label: 'Файл (PDF)', type: 'pdf', folder: 'documents', required: true },
      { key: 'order', label: 'Порядок', type: 'number', required: true, min: 1 },
    ],
    row: (d) => ({ title: d.title?.ru, meta: `№ ${d.order}` }),
  },
  honors: {
    title: 'Достижения',
    intro: 'Публикуется как новость: события и успехи фонда, стипендиатов и выпускников — награды, победы, стартапы, поездки. Страница «Достижения» в меню «О фонде»; три последние записи показываются на главной.',
    addLabel: 'Добавить достижение',
    orderBy: ['date', 'desc'],
    fields: [
      { key: 'title', label: 'Заголовок', bilingual: true, required: true, hint: 'Например: Победа на республиканской олимпиаде по экономике' },
      { key: 'text', label: 'Текст', type: 'textarea', bilingual: true, required: true, hint: 'Абзацы разделяйте пустой строкой.' },
      { key: 'date', label: 'Дата', type: 'date', required: true },
      {
        key: 'category',
        label: 'Категория (необязательно)',
        type: 'select',
        options: HONOR_CATEGORIES.map((c) => ({ value: c, label: ru.honors.categories[c] })),
      },
      { key: 'person', label: 'О ком (необязательно)', bilingual: true, hint: 'Например: Айгерим Сапарова, стипендиат БесТірек' },
      { key: 'photo', label: 'Фото', type: 'image', folder: 'honors' },
      { key: 'video', label: 'Видео (необязательно)', type: 'video', folder: 'honors-video', hint: VIDEO_HINT },
      { key: 'attachment', label: 'Прикреплённый файл (необязательно)', type: 'file', folder: 'honors-files', hint: 'Например, диплом или сертификат в PDF.' },
      { key: 'attachmentName', label: 'Надпись на кнопке скачивания', hint: 'Можно оставить пустым.' },
      { key: 'link', label: 'Ссылка «Подробнее» (необязательно)', type: 'url', hint: 'Например, на статью в СМИ.' },
    ],
    row: (d) => ({ title: d.title?.ru, meta: [fmtDate(d.date), ru.honors.categories[d.category], d.person?.ru].filter(Boolean).join(' · ') }),
  },
  partners: {
    title: 'Партнёры',
    intro: 'Страница «Партнёры» (меню «О фонде»): фото или логотип, название, описание и кнопка «Перейти на сайт». Логотипы также показываются на главной, названия — в подвале. Порядок задаётся числом: 1 — первым.',
    addLabel: 'Добавить партнёра',
    orderBy: ['order', 'asc'],
    defaults: nextOrder,
    fields: [
      { key: 'name', label: 'Название', bilingual: true, required: true },
      { key: 'text', label: 'О партнёре', type: 'textarea', bilingual: true, hint: 'Кто это и что делаем вместе. Абзацы разделяйте пустой строкой.' },
      { key: 'logo', label: 'Логотип', type: 'image', folder: 'partners', hint: 'Для главной страницы. Лучше PNG или SVG на прозрачном фоне. Если логотипа нет, будет показано название.' },
      { key: 'photo', label: 'Фото для страницы «Партнёры» (необязательно)', type: 'image', folder: 'partners', hint: 'Например, фото здания или совместного события. Если пусто — на странице будет логотип.' },
      { key: 'url', label: 'Сайт партнёра', type: 'url' },
      { key: 'order', label: 'Порядок', type: 'number', required: true, min: 1 },
    ],
    row: (d) => ({ title: d.name?.ru, meta: [`№ ${d.order}`, d.logo ? 'логотип есть' : 'без логотипа', d.text?.ru ? 'есть описание' : ''].filter(Boolean).join(' · ') }),
  },
  press: {
    title: 'О нас пишут',
    intro: 'Статьи и репортажи о фонде — блок на странице «О фонде». Укажите издание, заголовок и ссылку на материал.',
    addLabel: 'Добавить публикацию',
    orderBy: ['date', 'desc'],
    fields: [
      { key: 'title', label: 'Заголовок материала', bilingual: true, required: true },
      { key: 'source', label: 'Издание / канал', required: true, hint: 'Например: Tengrinews, Хабар 24, Forbes Kazakhstan' },
      { key: 'date', label: 'Дата', type: 'date', required: true },
      { key: 'url', label: 'Ссылка на материал', type: 'url', required: true, hint: 'Если это ссылка на YouTube, видео будет проигрываться прямо на сайте.' },
      { key: 'photo', label: 'Картинка (необязательно)', type: 'image', folder: 'press' },
      { key: 'video', label: 'Видео репортажа (необязательно)', type: 'video', folder: 'press-video', hint: 'Если статья на сайте издания, а видеосюжет на YouTube — вставьте его сюда.' },
    ],
    row: (d) => ({ title: d.title?.ru, meta: [d.source, fmtDate(d.date)].filter(Boolean).join(' · ') }),
  },
  projects: {
    title: 'Проекты фонда',
    intro: 'Прошлые и текущие проекты — блок «Проекты фонда» на странице «О фонде». Порядок задаётся числом.',
    addLabel: 'Добавить проект',
    orderBy: ['order', 'asc'],
    defaults: nextOrder,
    fields: [
      { key: 'title', label: 'Название проекта', bilingual: true, required: true },
      { key: 'years', label: 'Годы', hint: 'Например: 2008–2015' },
      { key: 'text', label: 'Описание', type: 'textarea', bilingual: true },
      { key: 'photo', label: 'Фото', type: 'image', folder: 'projects' },
      { key: 'video', label: 'Видео (необязательно)', type: 'video', folder: 'projects-video', hint: VIDEO_HINT },
      { key: 'order', label: 'Порядок', type: 'number', required: true, min: 1 },
    ],
    row: (d) => ({ title: d.title?.ru, meta: [d.years, `№ ${d.order}`].filter(Boolean).join(' · ') }),
  },
  faq: {
    title: 'Вопросы и ответы',
    intro: 'Блок «Частые вопросы» на странице «Контакты». Пока здесь пусто, на сайте показываются стандартные вопросы.',
    addLabel: 'Добавить вопрос',
    orderBy: ['order', 'asc'],
    defaults: nextOrder,
    fields: [
      { key: 'question', label: 'Вопрос', bilingual: true, required: true },
      { key: 'answer', label: 'Ответ', type: 'textarea', bilingual: true, required: true },
      { key: 'order', label: 'Порядок', type: 'number', required: true, min: 1 },
    ],
    row: (d) => ({ title: d.question?.ru, meta: `№ ${d.order}` }),
  },
};

export async function renderCollection(name) {
  const cfg = COLLECTIONS[name];
  const { db, fs, main } = ctx;
  main.innerHTML = `
    ${sectionHead(escapeHtml(cfg.title), escapeHtml(cfg.intro), `<button class="btn btn--primary" type="button" id="add">+ ${escapeHtml(cfg.addLabel)}</button>`)}
    <div id="editor"></div>
    <div class="panel"><div class="items" id="items"><p class="loading">Загрузка…</p></div></div>`;

  const itemsEl = $('items');
  const editorEl = $('editor');
  let docs = [];

  async function loadList() {
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, name), fs.orderBy(...cfg.orderBy)));
      docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      fail(err);
      docs = [];
    }
    if (ctx.tab !== name) return;
    itemsEl.innerHTML = docs.length
      ? docs.map((d) => {
        const r = cfg.row(d);
        return `
          <div class="item">
            <div class="item__main">
              <p class="item__title">${escapeHtml(r.title || '(без названия)')}</p>
              ${r.meta ? `<p class="item__meta">${escapeHtml(r.meta)}</p>` : ''}
            </div>
            <div class="item__actions">
              <button class="btn btn--outline" type="button" data-edit="${d.id}">Изменить</button>
              <button class="btn btn--danger" type="button" data-delete="${d.id}">Удалить</button>
            </div>
          </div>`;
      }).join('')
      : `<div class="empty">
          <p>Пока пусто. Нажмите «${escapeHtml(cfg.addLabel)}».</p>
          ${cfg.seed ? `<button class="btn btn--primary" type="button" id="seed">${escapeHtml(cfg.seed.label)}</button>` : ''}
        </div>`;
    $('seed')?.addEventListener('click', async (e) => {
      const button = e.currentTarget;
      button.disabled = true;
      try {
        for (const item of await cfg.seed.items()) {
          const { id, ...values } = item;
          await fs.setDoc(fs.doc(db, name, id), { ...values, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
        }
        toast(cfg.seed.done);
        await loadList();
      } catch (err) {
        fail(err);
        button.disabled = false;
      }
    });
  }

  async function openEditor(doc = null) {
    const data = doc ?? cfg.defaults?.(docs) ?? null;
    // списки, которые зависят от данных (например, программы для выпускников)
    for (const f of cfg.fields) {
      if (f.loadOptions) {
        try { f.options = await f.loadOptions(); } catch (err) { console.warn(err); }
      }
    }
    editorEl.innerHTML = `
      <form class="panel admin-form" id="edit-form" novalidate>
        <h2>${doc ? 'Редактирование' : escapeHtml(cfg.addLabel)}</h2>
        ${formFieldsHtml(cfg.fields, data, { editing: Boolean(doc) })}
        <div class="form-actions">
          <button class="btn btn--primary" type="submit">Сохранить</button>
          <button class="btn btn--outline" type="button" id="cancel">Отмена</button>
        </div>
      </form>`;
    const form = $('edit-form');
    const uploading = bindUploads(form);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('cancel').addEventListener('click', () => { editorEl.innerHTML = ''; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (uploading()) {
        toast('Подождите, файл ещё загружается.', 'error');
        return;
      }
      if (!form.reportValidity()) return;
      const values = readForm(form, cfg.fields);
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        if (doc) {
          await fs.updateDoc(fs.doc(db, name, doc.id), { ...values, updatedAt: fs.serverTimestamp() });
        } else if (cfg.idField) {
          // запись с понятным кодом вместо случайного (нужен для ссылок вида programs.html#bestirek)
          const id = values[cfg.idField];
          if (docs.some((d) => d.id === id)) {
            toast(`Код «${id}» уже занят. Придумайте другой.`, 'error');
            button.disabled = false;
            return;
          }
          await fs.setDoc(fs.doc(db, name, id), { ...values, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
        } else {
          await fs.addDoc(fs.collection(db, name), { ...values, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
        }
        toast('Сохранено');
        editorEl.innerHTML = '';
        await loadList();
      } catch (err) {
        fail(err);
        button.disabled = false;
      }
    });
  }

  $('add').addEventListener('click', () => openEditor());
  itemsEl.addEventListener('click', async (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;
    if (editId) openEditor(docs.find((d) => d.id === editId));
    if (deleteId) {
      const d = docs.find((x) => x.id === deleteId);
      if (!window.confirm(`Удалить «${cfg.row(d).title}»? Это действие нельзя отменить.`)) return;
      try {
        await fs.deleteDoc(fs.doc(db, name, deleteId));
        toast('Удалено');
        await loadList();
      } catch (err) {
        fail(err);
      }
    }
  });

  await loadList();
}
