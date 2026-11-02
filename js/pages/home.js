import { getLang, plural, t } from '../core/i18n.js';
import { initPage } from '../core/page.js';
import {
  loadFeaturedGraduates, loadHonors, loadLatestNews, loadPartners, loadStats,
} from '../core/data.js';
import {
  feedCard, honorTag, newsTag, partnerItems, watchButton,
} from '../components/cards.js';
import { getPrograms, loadPrograms, programName } from '../core/programs.js';
import { formatValue, impactItems, splitValue } from '../core/impact.js';
import { getPages } from '../core/site-content.js';
import {
  escapeHtml, initials, localized, safeUrl, truncate,
} from '../core/utils.js';
import { renderTicker } from '../components/ticker.js';
import { setCounterTarget } from '../components/counters.js';
import { initHeroStory } from '../components/hero-story.js';

initPage();
initHeroStory(document.getElementById('story'));

// Держим последние полученные данные, чтобы перерисовать их при смене языка.
const latest = { stats: null, news: [], stories: [], honors: [], partners: [] };

// ——— Первый экран: синяя кнопка ведёт на «Программы», надпись — из админки ———

const heroCta = document.getElementById('hero-cta');

function renderHeroButton() {
  heroCta.textContent = localized(getPages().heroButton.label, getLang()) || t('common.apply');
}

renderHeroButton();

// ——— Цифры: бегущая строка + круги-инфографика ———

const tickerEl = document.getElementById('stats-ticker');
const bubblesEl = document.getElementById('bubbles');
const linesEl = document.getElementById('impact-lines');

// Расстановка кругов на панели 100 × 75: [x, y, диаметр] — первый круг самый крупный.
const LAYOUTS = {
  1: [[50, 37.5, 50]],
  2: [[34, 36, 46], [76, 46, 32]],
  3: [[32, 32, 42], [74, 24, 32], [66, 60, 26]],
  4: [[32, 30, 44], [74, 22, 32], [70, 56, 26], [24, 64, 22]],
  5: [[28, 30, 38], [70, 18, 28], [80, 52, 24], [52, 60, 22], [18, 64, 20]],
  6: [[26, 28, 34], [64, 16, 24], [86, 40, 20], [66, 56, 24], [40, 64, 20], [12, 62, 18]],
  7: [[24, 26, 30], [58, 14, 22], [84, 26, 20], [76, 58, 22], [50, 48, 20], [30, 62, 20], [10, 52, 14]],
};

let bubblesKey = '';

function renderStats(stats) {
  const items = impactItems(stats);
  renderTicker(tickerEl, [
    ...items.map(({ value, label }) => ({ value: formatValue(value), text: label })),
    { text: t('home.ticker.since') },
    { text: t('home.ticker.partner') },
  ]);

  const layout = LAYOUTS[items.length];
  // линии: от главного круга ко всем остальным, при небольшом числе кругов — ещё и цепочкой
  const [[x0, y0]] = layout;
  const lines = layout.slice(1).map(([x, y]) => `M${x0} ${y0} L${x} ${y}`);
  if (items.length <= 4) layout.slice(2).forEach(([x, y], i) => lines.push(`M${layout[i + 1][0]} ${layout[i + 1][1]} L${x} ${y}`));
  linesEl.innerHTML = `<path d="${lines.join(' ')}" />`;

  // круги пересоздаём, только если изменились сами цифры (иначе — только подписи при смене языка)
  const key = items.map((i) => i.value).join('|');
  if (key !== bubblesKey) {
    bubblesKey = key;
    bubblesEl.innerHTML = items.map(({ value }, i) => {
      const [x, y, d] = layout[i];
      const { prefix, number, suffix } = splitValue(value);
      return `
        <li class="bubble" style="--x: ${x}; --y: ${y}; --d: ${d}; --i: ${i}">
          <div class="bubble__inner">
            <span class="bubble__value">${escapeHtml(prefix)}${number == null ? '' : '<span data-count></span>'}${escapeHtml(suffix)}</span>
            <span class="bubble__label"></span>
          </div>
        </li>`;
    }).join('');
    bubblesEl.querySelectorAll('.bubble').forEach((el, i) => {
      const counter = el.querySelector('[data-count]');
      // счётчик досчитает до числа, когда круг попадёт в экран
      if (counter) setCounterTarget(counter, splitValue(items[i].value).number);
    });
  }
  bubblesEl.querySelectorAll('.bubble__label').forEach((el, i) => { el.textContent = items[i].label; });
}

loadStats((stats) => {
  latest.stats = stats;
  renderStats(stats);
});

// ——— Инфографика: «Фонд за N лет», круги появляются при прокрутке ———

const FOUNDED = 2005;

function renderImpactTitle() {
  const n = new Date().getFullYear() - FOUNDED;
  document.getElementById('impact-title').innerHTML = t('home.impact.yearsTitle', { n, noun: plural('stats.years', n) });
}

const impactEl = document.querySelector('.impact');
if (impactEl.getBoundingClientRect().top > window.innerHeight) impactEl.classList.add('will-animate');
new IntersectionObserver((entries, obs) => {
  if (!entries[0].isIntersecting) return;
  impactEl.classList.add('is-visible');
  obs.disconnect();
}, { threshold: 0.25 }).observe(impactEl);

// ——— Достижения (три последние записи) и партнёры ———

const honorsSection = document.getElementById('honors');
const honorsEl = document.getElementById('honors-list');
const partnersEl = document.getElementById('partners-list');

function renderHonors() {
  const lang = getLang();
  honorsSection.hidden = !latest.honors.length;
  honorsEl.innerHTML = latest.honors.slice(0, 3)
    .map((h) => feedCard(h, lang, { href: 'achievements.html', tag: honorTag(h), textMax: 150 })).join('');
}

// ——— Программы (из админки: «Программы») ———

const programsEl = document.getElementById('home-programs');

function renderPrograms() {
  const lang = getLang();
  programsEl.innerHTML = getPrograms().map((p, i) => {
    const badge = localized(p.badge, lang);
    return `
      <li class="program-card">
        <span class="program-card__index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="program-card__title">${escapeHtml(localized(p.name, lang))}</h3>
        ${badge ? `<p class="program-card__badge">${escapeHtml(badge)}</p>` : ''}
        <p class="program-card__text">${escapeHtml(localized(p.lead, lang))}</p>
        <a class="arrow-link" href="programs.html#${encodeURIComponent(p.key)}">${escapeHtml(t('common.more'))}</a>
      </li>`;
  }).join('');
}

loadPrograms(renderPrograms);

function renderPartners() {
  partnersEl.innerHTML = partnerItems(latest.partners, getLang());
}

loadHonors((items) => { latest.honors = items; renderHonors(); });
loadPartners((items) => { latest.partners = items; renderPartners(); });

// ——— Истории выпускников ———

const storiesEl = document.getElementById('stories-list');

function renderStories(graduates) {
  const lang = getLang();
  if (!graduates.length) {
    storiesEl.innerHTML = `<p class="empty-state">${escapeHtml(t('home.stories.empty'))}</p>`;
    return;
  }
  storiesEl.innerHTML = graduates.map((g) => {
    const name = localized(g.name, lang);
    const photo = safeUrl(g.photo);
    const program = programName(g.program, lang);
    const meta = [program, g.year].filter(Boolean).join(' · ');
    return `
      <article class="story-card">
        <div class="story-card__person">
          ${photo
            ? `<img class="avatar" src="${escapeHtml(photo)}" alt="" loading="lazy" width="64" height="64">`
            : `<span class="avatar avatar--initials" aria-hidden="true">${escapeHtml(initials(name))}</span>`}
          <div>
            <h3 class="story-card__name">${escapeHtml(name)}</h3>
            ${meta ? `<p class="story-card__meta">${escapeHtml(meta)}</p>` : ''}
          </div>
        </div>
        ${g.story ? `<blockquote class="story-card__quote">${escapeHtml(truncate(localized(g.story, lang), 240))}</blockquote>` : ''}
        ${g.workplace ? `<p class="story-card__work">${escapeHtml(localized(g.workplace, lang))}</p>` : ''}
        ${watchButton(g.video, name)}
      </article>`;
  }).join('');
}

loadFeaturedGraduates(3, (graduates) => {
  latest.stories = graduates;
  renderStories(graduates);
});

// ——— Новости ———

const newsEl = document.getElementById('news-list');

function renderNews(items) {
  const lang = getLang();
  if (!items.length) {
    newsEl.innerHTML = `<p class="empty-state">${escapeHtml(t('home.news.empty'))}</p>`;
    return;
  }
  newsEl.innerHTML = items
    .map((item) => feedCard(item, lang, { href: 'news.html', tag: newsTag(item), textMax: 150 })).join('');
}

loadLatestNews(3, (items) => {
  latest.news = items;
  renderNews(items);
});

// ——— Смена языка ———

renderImpactTitle();

document.addEventListener('langchange', () => {
  renderHeroButton();
  if (latest.stats) renderStats(latest.stats);
  renderImpactTitle();
  renderStories(latest.stories);
  renderNews(latest.news);
  renderHonors();
  renderPartners();
  renderPrograms();
});
