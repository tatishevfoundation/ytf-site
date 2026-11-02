// «Главная кнопка и фото страниц»: надпись синей кнопки на первом экране главной
// и фото справа в шапках страниц. Хранится в Firestore site/pages.
import { PAGE_PHOTOS, mergePages } from '../core/site-content.js';
import { bindUploads, fieldHtml } from './fields.js';
import {
  $, CONTENT_LANGS, ctx, fail, normalizeUrl, sectionHead, toast,
} from './ui.js';

const PAGE_NAMES = {
  about: 'О фонде', programs: 'Программы', scholars: 'Стипендиаты', graduates: 'Выпускники', donate: 'Пожертвовать',
};

export async function renderPages() {
  const { db, fs, main } = ctx;
  main.innerHTML = `
    ${sectionHead('Главная кнопка и фото страниц', 'Синяя кнопка на первом экране главной страницы и фото в правой части шапки на внутренних страницах.')}
    <form class="admin-form" id="pages-form" novalidate><p class="loading">Загрузка…</p></form>`;

  let data = mergePages(null);
  try {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'pages'));
    if (snap.exists()) data = mergePages(snap.data());
  } catch (err) {
    fail(err);
  }
  if (ctx.tab !== 'pages') return;

  const form = $('pages-form');
  form.innerHTML = `
    <section class="panel">
      <h2>Синяя кнопка на главной</h2>
      <p class="admin-intro">Кнопка рядом с заголовком на первом экране. Ведёт на страницу «Программы» — там у каждой программы своя кнопка заявки. Если поля пустые — на сайте «Подать заявку».</p>
      ${fieldHtml({ key: 'label', label: 'Надпись на кнопке', bilingual: true, hint: 'Например: Подать заявку' }, data.heroButton.label)}
    </section>

    <section class="panel">
      <h2>Фото в шапках страниц</h2>
      <p class="admin-intro">Фото появится справа от заголовка страницы. Лучше горизонтальное (примерно 4:3), не меньше 1200 px по ширине. Если фото нет — шапка остаётся без него.</p>
      ${PAGE_PHOTOS.map((page) => fieldHtml({ key: `photo-${page}`, label: `Страница «${PAGE_NAMES[page]}»`, type: 'image', folder: 'pages' }, data.photos[page])).join('')}
    </section>

    <div class="save-bar"><span></span><button class="btn btn--primary" type="submit">Сохранить</button></div>`;

  const uploading = bindUploads(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (uploading()) {
      toast('Подождите, фото ещё загружается.', 'error');
      return;
    }
    if (!form.reportValidity()) return;
    const value = (name) => form.elements[name].value.trim();
    const payload = {
      heroButton: {
        label: Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, value(`label.${lang}`)])),
      },
      photos: Object.fromEntries(PAGE_PHOTOS.map((page) => [page, normalizeUrl(value(`photo-${page}`), 'image')])),
      updatedAt: fs.serverTimestamp(),
    };
    try {
      await fs.setDoc(fs.doc(db, 'site', 'pages'), payload);
      toast('Сохранено. Обновите страницу сайта, чтобы увидеть изменения.');
    } catch (err) {
      fail(err);
    }
  });
}
