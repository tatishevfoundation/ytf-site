// Страницы «Стипендиаты» и «Выпускники»: один список людей (Firestore graduates),
// у каждого отметка status: 'scholar' (учится) или 'graduate' (выпустился; по умолчанию).
// Какую часть показывать, задаёт <body data-people="scholar | graduate">.
import { getPrograms, loadPrograms, programName } from '../core/programs.js';
import { AREAS } from '../config/regions.js';
import { getLang, t } from '../core/i18n.js';
import { initPage } from '../core/page.js';
import { loadGraduates, loadRegionCounts } from '../core/data.js';
import { escapeHtml, initials, localized, safeUrl } from '../core/utils.js';
import { KzMap } from '../components/kz-map.js';
import { watchButton } from '../components/cards.js';

initPage();

const MODE = document.body.dataset.people === 'scholar' ? 'scholar' : 'graduate';
const PAGE = MODE === 'scholar' ? 'scholarsPage' : 'graduatesPage';
const statusOf = (p) => (p.status === 'scholar' ? 'scholar' : 'graduate');

const state = { people: [], counts: {}, program: '', year: '', region: '', query: '' };

const el = {
  list: document.getElementById('people-list'),
  search: document.getElementById('f-search'),
  program: document.getElementById('f-program'),
  year: document.getElementById('f-year'),
  region: document.getElementById('f-region'),
  reset: document.getElementById('f-reset'),
  count: document.getElementById('f-count'),
};

// ——— Карта: клик по региону фильтрует список ———

let syncingMap = false;
const map = new KzMap(document.getElementById('kz-map'), {
  onSelect(code) {
    if (syncingMap) return;
    state.region = code ?? '';
    el.region.value = state.region;
    renderList();
    if (code) el.list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
});
const mapReady = map.init();

// Выпускники: числа из «Карты регионов» в админке, если заданы (можно указать всех, даже кого нет в списке).
// Стипендиаты и выпускники без ручных чисел — считаем по списку.
function mapCounts() {
  if (MODE === 'graduate' && Object.values(state.counts).some((n) => Number(n) > 0)) return state.counts;
  const computed = {};
  for (const p of state.people) if (p.region) computed[p.region] = (computed[p.region] ?? 0) + 1;
  return computed;
}

async function updateMap() {
  await mapReady;
  map.setCounts(mapCounts());
}

function syncMapSelection() {
  if (!map.svg) return; // карта ещё не загрузилась
  syncingMap = true;
  if (!state.region) map.clear();
  else if (map.selected !== state.region) map.select(state.region);
  syncingMap = false;
}

// ——— Фильтры ———

const option = (value, label, selected) =>
  `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;

function renderFilters() {
  const lang = getLang();
  el.program.innerHTML = option('', t('filters.all'), !state.program)
    + getPrograms({ all: true }).map((p) => option(p.key, localized(p.name, lang), state.program === p.key)).join('');
  const years = [...new Set(state.people.map((p) => p.year).filter(Boolean))].sort((a, b) => b - a);
  el.year.innerHTML = option('', t('filters.all'), !state.year)
    + years.map((y) => option(String(y), String(y), String(state.year) === String(y))).join('');
  el.region.innerHTML = option('', t('filters.all'), !state.region)
    + Object.entries(AREAS)
      .sort(([, a], [, b]) => (a[lang] ?? a.ru).localeCompare(b[lang] ?? b.ru, 'ru'))
      .map(([code, area]) => option(code, area[lang] ?? area.ru, state.region === code)).join('');
}

const normalize = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е');

function filtered() {
  const q = normalize(state.query.trim());
  return state.people.filter((p) =>
    (!state.program || p.program === state.program)
    && (!state.year || String(p.year) === String(state.year))
    && (!state.region || p.region === state.region)
    && (!q || Object.values(p.name ?? {}).some((n) => normalize(n).includes(q))));
}

function renderList() {
  const lang = getLang();
  const items = filtered();
  el.count.textContent = state.people.length ? t('graduatesPage.found', { count: items.length }) : '';
  if (!state.people.length) {
    el.list.innerHTML = `<p class="empty-state">${escapeHtml(t(`${PAGE}.none`))}</p>`;
    return;
  }
  if (!items.length) {
    el.list.innerHTML = `<p class="empty-state">${escapeHtml(t(`${PAGE}.empty`))}</p>`;
    return;
  }
  el.list.innerHTML = items.map((p) => {
    const name = localized(p.name, lang);
    const photo = safeUrl(p.photo);
    const area = AREAS[p.region];
    const region = area ? (area[lang] ?? area.ru) : '';
    return `
      <article class="grad-card">
        <div class="grad-card__head">
          ${photo
            ? `<img class="avatar" src="${escapeHtml(photo)}" alt="" loading="lazy" width="56" height="56">`
            : `<span class="avatar avatar--initials" aria-hidden="true">${escapeHtml(initials(name))}</span>`}
          <div>
            <h3 class="grad-card__name">${escapeHtml(name)}</h3>
            ${region ? `<p class="grad-card__region">${escapeHtml(region)}</p>` : ''}
          </div>
        </div>
        <div class="grad-card__tags">
          ${programName(p.program, lang) ? `<span class="tag">${escapeHtml(programName(p.program, lang))}</span>` : ''}
          ${p.year ? `<span class="tag tag--muted">${escapeHtml(p.year)}</span>` : ''}
        </div>
        ${p.workplace ? `<p class="grad-card__work">${escapeHtml(localized(p.workplace, lang))}</p>` : ''}
        ${watchButton(p.video, name)}
      </article>`;
  }).join('');
}

let searchTimer;
el.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = el.search.value; renderList(); }, 150);
});
el.program.addEventListener('change', () => { state.program = el.program.value; renderList(); });
el.year.addEventListener('change', () => { state.year = el.year.value; renderList(); });
el.region.addEventListener('change', () => {
  state.region = el.region.value;
  syncMapSelection();
  renderList();
});
el.reset.addEventListener('click', () => {
  Object.assign(state, { program: '', year: '', region: '', query: '' });
  el.search.value = '';
  syncMapSelection();
  renderFilters();
  renderList();
});

// ——— Данные ———

loadGraduates((people) => {
  state.people = people.filter((p) => statusOf(p) === MODE);
  renderFilters();
  renderList();
  updateMap();
});

if (MODE === 'graduate') {
  loadRegionCounts((counts) => {
    state.counts = counts;
    updateMap();
  });
}

loadPrograms(() => {
  renderFilters();
  renderList();
});

document.addEventListener('langchange', () => {
  renderFilters();
  renderList();
});
