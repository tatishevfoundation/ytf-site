// «Ержан Татишев»: блок о человеке, чьё имя носит фонд (страница «О фонде»). Firestore site/founder.
import { bindUploads, formFieldsHtml, readForm } from './fields.js';
import { $, ctx, fail, sectionHead, toast } from './ui.js';

const FIELDS = [
  { key: 'name', label: 'Имя', bilingual: true, required: true, hint: 'Например: Ержан Татишев' },
  { key: 'years', label: 'Годы жизни', hint: 'Например: 1968–2004' },
  { key: 'photo', label: 'Фото', type: 'image', folder: 'founder', hint: 'Вертикальное фото, примерно 4 : 5.' },
  { key: 'bio', label: 'Биография и история', type: 'textarea', bilingual: true, hint: 'Абзацы разделяйте пустой строкой. Пока поле «Имя» пустое, блок на сайте не показывается.' },
  { key: 'video', label: 'Видео (необязательно)', type: 'video', folder: 'founder-video', hint: 'Например, документальный фильм или интервью на YouTube. Плеер появится под биографией.' },
];

export async function renderFounder() {
  const { db, fs, main } = ctx;
  main.innerHTML = `
    ${sectionHead('Ержан Татишев', 'Блок о человеке, чьё имя носит фонд, на странице «О фонде». Проекты фонда добавляются в соседнем разделе «Проекты фонда».')}
    <form class="panel admin-form" id="founder-form" novalidate><p class="loading">Загрузка…</p></form>`;

  let data = null;
  try {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'founder'));
    if (snap.exists()) data = snap.data();
  } catch (err) {
    fail(err);
  }
  if (ctx.tab !== 'founder') return;

  const form = $('founder-form');
  form.innerHTML = `
    ${formFieldsHtml(FIELDS, data)}
    <div class="form-actions"><button class="btn btn--primary" type="submit">Сохранить</button></div>`;
  const uploading = bindUploads(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (uploading()) {
      toast('Подождите, файл ещё загружается.', 'error');
      return;
    }
    if (!form.reportValidity()) return;
    try {
      await fs.setDoc(fs.doc(db, 'site', 'founder'), { ...readForm(form, FIELDS), updatedAt: fs.serverTimestamp() });
      toast('Сохранено');
    } catch (err) {
      fail(err);
    }
  });
}
