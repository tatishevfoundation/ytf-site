import { BOARD, TEAM, TIMELINE } from '../config/about.js';
import { getLang, t } from '../core/i18n.js';
import { formatValue, impactItems } from '../core/impact.js';
import { initPage } from '../core/page.js';
import {
  loadFounder, loadGovDocs, loadPress, loadProjects, loadReports, loadStats, loadTeam, loadTimeline,
} from '../core/data.js';
import {
  escapeHtml, formatDate, localized, prefersReducedMotion, safeUrl, truncate,
} from '../core/utils.js';
import { isVideoUrl, videoCover, videoPlayer } from '../core/media.js';

initPage();

// Всё на странице правится в админке; пустые блоки скрываются.
const latest = {
  stats: null, reports: [], timeline: [], team: [], founder: null, projects: [], docs: [], press: [],
};
const $ = (id) => document.getElementById(id);
const paragraphs = (text) => String(text ?? '').split(/\n\s*\n/).filter((p) => p.trim())
  .map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('');

// ——— Ержан Татишев ———

function renderFounder() {
  const f = latest.founder;
  const lang = getLang();
  const name = localized(f?.name, lang);
  $('founder').hidden = !name;
  if (!name) return;
  const photo = safeUrl(f.photo);
  $('founder-body').innerHTML = `
    ${photo ? `<img class="founder__photo" src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" loading="lazy">` : ''}
    <div class="founder__text">
      <p class="eyebrow">${escapeHtml(t('about.founderLabel'))}</p>
      <h2 class="section__title">${escapeHtml(name)}</h2>
      ${f.years ? `<p class="founder__years">${escapeHtml(f.years)}</p>` : ''}
      <div class="prose">${paragraphs(localized(f.bio, lang))}</div>
      ${videoPlayer(f.video, name)}
    </div>`;
}

// ——— Проекты фонда ———

function renderProjects() {
  const lang = getLang();
  $('projects').hidden = !latest.projects.length;
  $('projects-list').innerHTML = latest.projects.map((p) => {
    const photo = safeUrl(p.photo);
    const title = localized(p.title, lang);
    const media = videoCover(p.video, { cover: photo, title, label: t('common.watch'), className: 'honor-card__media' })
      || (photo ? `<div class="honor-card__media"><img src="${escapeHtml(photo)}" alt="" loading="lazy"></div>` : '');
    return `
      <article class="honor-card">
        ${media}
        <div class="honor-card__body">
          ${p.years ? `<p class="honor-card__person">${escapeHtml(p.years)}</p>` : ''}
          <h3 class="honor-card__title">${escapeHtml(title)}</h3>
          ${p.text ? `<p class="honor-card__text">${escapeHtml(localized(p.text, lang))}</p>` : ''}
        </div>
      </article>`;
  }).join('');
}

// ——— Таймлайн: события + «Сегодня» из статистики ———

function renderTimeline() {
  const lang = getLang();
  const events = latest.timeline.length ? latest.timeline : TIMELINE;
  const items = events.map((item) => `
    <li class="timeline__item">
      <span class="timeline__year">${escapeHtml(item.year)}</span>
      <div>
        <h3 class="timeline__title">${escapeHtml(localized(item.title, lang))}</h3>
        <p class="timeline__text">${escapeHtml(localized(item.text, lang))}</p>
      </div>
    </li>`);
  if (latest.stats) {
    // те же цифры, что в кругах на главной
    const facts = impactItems(latest.stats)
      .map(({ value, label }) => `${formatValue(value)} ${label}`)
      .join(' · ');
    items.push(`
      <li class="timeline__item timeline__item--today">
        <span class="timeline__year">${new Date().getFullYear()}</span>
        <div>
          <h3 class="timeline__title">${escapeHtml(t('about.today'))}: ${escapeHtml(t('about.todayTitle'))}</h3>
          <p class="timeline__text">${escapeHtml(facts)}</p>
        </div>
      </li>`);
  }
  $('timeline').innerHTML = items.join('');
}

// ——— Органы управления ———

const photoHtml = (photo, className) => (photo
  ? `<img class="${className}" src="${escapeHtml(photo)}" alt="" loading="lazy">`
  : `<div class="${className}" aria-hidden="true"></div>`);

// Президент — крупная карточка: фото и начало биографии, полностью — во всплывающем окне
function presidentCard(p, lang, index) {
  const bio = localized(p.bio, lang);
  return `
    <article class="person-card person-card--big">
      <button type="button" class="person-card__open person-card__open--big" data-person="${index}" aria-haspopup="dialog">
        ${photoHtml(safeUrl(p.photo), 'person-card__photo')}
        <span>
          <span class="person-card__name">${escapeHtml(localized(p.name, lang))}</span>
          <span class="person-card__role">${escapeHtml(localized(p.role, lang))}</span>
          ${bio ? `<span class="person-card__bio">${escapeHtml(truncate(bio.replace(/\s*\n\s*/g, ' '), 320))}</span>` : ''}
          <span class="person-card__more">${escapeHtml(t('common.more'))} →</span>
        </span>
      </button>
    </article>`;
}

// Совет и команда — карточка-кнопка: по нажатию открывается окно с фото и биографией
function personCard(p, lang, index) {
  const hasBio = Boolean(localized(p.bio, lang));
  return `
    <article class="person-card">
      <button type="button" class="person-card__open" data-person="${index}" aria-haspopup="dialog">
        ${photoHtml(safeUrl(p.photo), 'person-card__photo')}
        <span>
          <span class="person-card__name">${escapeHtml(localized(p.name, lang))}</span>
          <span class="person-card__role">${escapeHtml(localized(p.role, lang))}</span>
          ${hasBio ? `<span class="person-card__more">${escapeHtml(t('common.more'))} →</span>` : ''}
        </span>
      </button>
    </article>`;
}

// Все, кого можно открыть во всплывающем окне (индекс = data-person)
let people = [];

function renderPeople(el, list, group) {
  const lang = getLang();
  el.innerHTML = list.length
    ? list.map((p) => {
      people.push({ ...p, groupTitle: t(group) });
      return personCard(p, lang, people.length - 1);
    }).join('')
    : `<p class="empty-state">${escapeHtml(t('about.peopleEmpty'))}</p>`;
}

const modal = document.createElement('dialog');
modal.className = 'person-modal';
document.body.append(modal);

function openPerson(p) {
  const lang = getLang();
  const name = localized(p.name, lang);
  modal.setAttribute('aria-label', name);
  modal.innerHTML = `
    <button type="button" class="person-modal__close" data-close aria-label="${escapeHtml(t('common.close'))}">✕</button>
    <div class="person-modal__inner">
      ${photoHtml(safeUrl(p.photo), 'person-modal__photo')}
      <div class="person-modal__body">
        <p class="person-modal__group">${escapeHtml(p.groupTitle)}</p>
        <h3 class="person-modal__name">${escapeHtml(name)}</h3>
        <p class="person-modal__role">${escapeHtml(localized(p.role, lang))}</p>
        ${p.bio ? `<div class="prose person-modal__bio">${paragraphs(localized(p.bio, lang))}</div>` : ''}
      </div>
    </div>`;
  modal.showModal();
  modal.querySelector('[data-close]').focus();
}

// Закрытие с короткой анимацией: крестик, клик по затемнению, Esc
function closePerson() {
  if (!modal.open || modal.classList.contains('is-closing')) return;
  if (prefersReducedMotion()) {
    modal.close();
    return;
  }
  modal.classList.add('is-closing');
  modal.addEventListener('animationend', () => {
    modal.classList.remove('is-closing');
    modal.close();
  }, { once: true });
}

modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.closest('[data-close]')) closePerson();
});
modal.addEventListener('cancel', (e) => {
  e.preventDefault();
  closePerson();
});
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-person]');
  if (btn) openPerson(people[Number(btn.dataset.person)]);
});

function renderGovernance() {
  const lang = getLang();
  const fromDb = latest.team;
  const president = fromDb.filter((p) => p.group === 'president');
  $('president-block').hidden = !president.length;
  people = [];
  $('president').innerHTML = president.map((p) => {
    people.push({ ...p, groupTitle: t('about.presidentTitle') });
    return presidentCard(p, lang, people.length - 1);
  }).join('');
  renderPeople($('board'), fromDb.length ? fromDb.filter((p) => p.group === 'board') : BOARD, 'about.boardTitle');
  const team = fromDb.length ? fromDb.filter((p) => !p.group || p.group === 'team') : TEAM;
  renderPeople($('team'), team, 'about.teamTitle');

  $('docs-block').hidden = !latest.docs.length;
  $('docs').innerHTML = latest.docs.map((d) => `
    <a class="report" href="${escapeHtml(safeUrl(d.file) || '#')}" target="_blank" rel="noopener">
      <span class="report__title">${escapeHtml(localized(d.title, lang))}</span>
      <span class="report__open">${escapeHtml(t('about.docOpen'))} ↗</span>
    </a>`).join('');
}

// ——— О нас пишут ———

function renderPress() {
  const lang = getLang();
  $('press').hidden = !latest.press.length;
  $('press-list').innerHTML = latest.press.map((p) => {
    const url = safeUrl(p.url);
    const photo = safeUrl(p.photo);
    const title = truncate(localized(p.title, lang), 140);
    // Репортаж на YouTube (ссылка или отдельное поле «Видео») играет прямо на сайте
    const video = p.video || (isVideoUrl(url) ? url : '');
    const media = videoCover(video, { cover: photo, title, label: t('common.watch'), className: 'news-card__media' })
      || `<div class="news-card__media">${photo ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy">` : ''}</div>`;
    let heading = escapeHtml(title);
    if (video) heading = `<button type="button" class="news-card__link press-card__play" data-video="${escapeHtml(safeUrl(video))}" data-video-title="${escapeHtml(title)}">${escapeHtml(title)}</button>`;
    else if (url) heading = `<a class="news-card__link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(title)} ↗</a>`;
    return `
      <article class="news-card press-card">
        ${media}
        <p class="news-card__meta">
          ${p.source ? `<span class="news-card__tag">${escapeHtml(p.source)}</span>` : ''}
          ${p.date ? `<time datetime="${escapeHtml(p.date)}">${escapeHtml(formatDate(p.date, lang))}</time>` : ''}
        </p>
        <h3 class="news-card__title">${heading}</h3>
      </article>`;
  }).join('');
}

// ——— Отчёты ———

function renderReports() {
  const lang = getLang();
  $('reports-list').innerHTML = latest.reports.length
    ? latest.reports.map((r) => `
      <a class="report" href="${escapeHtml(safeUrl(r.pdf) || '#')}" target="_blank" rel="noopener">
        <span class="report__year">${escapeHtml(r.year)}</span>
        <span class="report__title">${escapeHtml(localized(r.title, lang))}</span>
        <span class="report__open">${escapeHtml(t('about.reportOpen'))} ↗</span>
      </a>`).join('')
    : `<p class="empty-state">${escapeHtml(t('about.reportsEmpty'))}</p>`;
}

// ——— Данные ———

loadFounder((f) => { latest.founder = f; renderFounder(); });
loadProjects((items) => { latest.projects = items; renderProjects(); });
loadStats((stats) => { latest.stats = stats; renderTimeline(); });
loadTimeline((items) => { latest.timeline = items; renderTimeline(); });
loadTeam((items) => { latest.team = items; renderGovernance(); });
loadGovDocs((items) => { latest.docs = items; renderGovernance(); });
loadPress((items) => { latest.press = items; renderPress(); });
loadReports((items) => { latest.reports = items; renderReports(); });

function renderAll() {
  renderFounder();
  renderProjects();
  renderTimeline();
  renderGovernance();
  renderPress();
  renderReports();
}

renderAll();
document.addEventListener('langchange', renderAll);
