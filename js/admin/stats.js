// «Цифры на главной» (круги-инфографика) и «Карта регионов».
import { AREAS } from '../config/regions.js';
import { DEFAULT_STATS } from '../core/data.js';
import { MAX_BUBBLES, defaultBubbles } from '../core/impact.js';
import { escapeHtml } from '../core/utils.js';
import {
  $, CONTENT_LANGS, ctx, fail, fmtDate, sectionHead, toast,
} from './ui.js';

const bubbleRow = (b = { value: '', label: {} }) => `
  <div class="social-row bubble-row">
    <label class="field"><span class="field__label">Цифра</span>
      <input class="input input--big" name="b-value" value="${escapeHtml(b.value)}" placeholder="316" required></label>
    <div class="field">
      <span class="field__label">Подпись под цифрой</span>
      <div class="lang-pair">
        ${CONTENT_LANGS.map((lang) => `
          <label class="field"><span class="field__hint"><span class="lang-pair__tag">${lang.toUpperCase()}</span></span>
            <input class="input" name="b-label-${lang}" value="${escapeHtml(b.label?.[lang] ?? '')}"${lang === 'ru' ? ' required' : ''}></label>`).join('')}
      </div>
    </div>
    <div class="social-row__actions">
      <button type="button" class="btn btn--outline" data-move="-1" title="Выше">↑</button>
      <button type="button" class="btn btn--outline" data-move="1" title="Ниже">↓</button>
      <button type="button" class="btn btn--danger" data-remove title="Удалить">✕</button>
    </div>
  </div>`;

export async function renderStats() {
  const { db, fs, main } = ctx;
  main.innerHTML = `
    ${sectionHead('Цифры на главной', `Круги в блоке «Фонд за N лет» на главной: цифра и подпись на трёх языках. Можно от 1 до ${MAX_BUBBLES} кругов — первый в списке самый крупный. Эти же цифры идут в бегущей строке и в пункте «Сегодня» на странице «О фонде».`)}
    <form class="panel admin-form" id="stats-form"><p class="loading">Загрузка…</p></form>`;
  const form = $('stats-form');
  let data = { ...DEFAULT_STATS };
  try {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'stats'));
    if (snap.exists()) data = { ...data, ...snap.data() };
  } catch (err) {
    fail(err);
  }
  if (ctx.tab !== 'stats') return;
  // пока свои круги не сохранены — показываем 4 стандартных, чтобы их было удобно поправить
  const bubbles = Array.isArray(data.bubbles) && data.bubbles.length ? data.bubbles : defaultBubbles(data);
  form.innerHTML = `
    <p class="field__hint">В цифре можно писать и знаки: «90%», «1 000+», «15 лет» — число на сайте красиво досчитается, знаки останутся.</p>
    <div class="social-list" id="bubble-list">${bubbles.map(bubbleRow).join('')}</div>
    <button type="button" class="btn btn--outline" id="bubble-add">+ Добавить круг</button>
    ${data.updatedAt ? `<p class="field__hint">Последнее обновление: ${escapeHtml(fmtDate(data.updatedAt))}</p>` : ''}
    <div class="form-actions"><button class="btn btn--primary" type="submit">Сохранить</button></div>`;

  const list = $('bubble-list');
  const addBtn = $('bubble-add');
  const refresh = () => {
    const n = list.children.length;
    addBtn.disabled = n >= MAX_BUBBLES;
    addBtn.textContent = n >= MAX_BUBBLES ? `Максимум ${MAX_BUBBLES} кругов` : '+ Добавить круг';
  };
  refresh();
  addBtn.addEventListener('click', () => {
    list.insertAdjacentHTML('beforeend', bubbleRow());
    list.lastElementChild.querySelector('input').focus();
    refresh();
  });
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.bubble-row');
    if (!row) return;
    if (e.target.closest('[data-remove]')) row.remove();
    const move = Number(e.target.closest('[data-move]')?.dataset.move);
    if (move === -1 && row.previousElementSibling) row.previousElementSibling.before(row);
    if (move === 1 && row.nextElementSibling) row.nextElementSibling.after(row);
    refresh();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const rows = [...list.querySelectorAll('.bubble-row')];
    if (!rows.length) {
      toast('Добавьте хотя бы один круг.', 'error');
      return;
    }
    const value = (row, name) => row.querySelector(`[name="${name}"]`).value.trim();
    const items = rows.map((row) => ({
      value: value(row, 'b-value'),
      label: Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, value(row, `b-label-${lang}`)])),
    }));
    try {
      await fs.setDoc(fs.doc(db, 'site', 'stats'), { bubbles: items, updatedAt: fs.serverTimestamp() }, { merge: true });
      toast('Цифры сохранены');
    } catch (err) {
      fail(err);
    }
  });
}

export async function renderRegions() {
  const { db, fs, main } = ctx;
  main.innerHTML = `
    ${sectionHead('Карта регионов', 'Сколько выпускников из каждого региона — для карты на странице «Выпускники» (удобно, если в списке пока не все выпускники). Если везде нули, карта считается по списку автоматически. На странице «Стипендиаты» карта всегда считается по списку.',
      '<button class="btn btn--outline" type="button" id="count-from-list">Посчитать по списку выпускников</button>')}
    <form class="panel admin-form" id="regions-form"><p class="loading">Загрузка…</p></form>`;
  const form = $('regions-form');
  let counts = {};
  try {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'regions'));
    if (snap.exists()) counts = snap.data().counts ?? {};
  } catch (err) {
    fail(err);
  }
  if (ctx.tab !== 'regions') return;

  const areas = Object.entries(AREAS).sort(([, a], [, b]) => a.ru.localeCompare(b.ru, 'ru'));
  form.innerHTML = `
    <div class="region-grid">
      ${areas.map(([code, a]) => `
        <label class="field"><span class="field__label">${escapeHtml(a.ru)}</span>
          <input class="input" type="number" min="0" name="${code}" value="${Number(counts[code]) || 0}"></label>`).join('')}
    </div>
    <div class="form-actions"><button class="btn btn--primary" type="submit">Сохранить</button></div>`;

  $('count-from-list').addEventListener('click', async () => {
    try {
      const snap = await fs.getDocs(fs.collection(db, 'graduates'));
      const computed = {};
      snap.forEach((d) => {
        const r = d.data().region;
        if (r) computed[r] = (computed[r] ?? 0) + 1;
      });
      for (const [code] of areas) form.elements[code].value = computed[code] ?? 0;
      toast(`Посчитано по ${snap.size} выпускникам. Проверьте и нажмите «Сохранить».`);
    } catch (err) {
      fail(err);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(areas.map(([code]) => [code, Math.max(0, Number(form.elements[code].value) || 0)]));
    try {
      await fs.setDoc(fs.doc(db, 'site', 'regions'), { counts: values, updatedAt: fs.serverTimestamp() });
      toast('Данные карты сохранены');
    } catch (err) {
      fail(err);
    }
  });
}
