// «Программы»: всё содержимое — из админки (раздел «Программы»), см. js/core/programs.js.
import { getLang, t } from '../core/i18n.js';
import { initPage } from '../core/page.js';
import { deadlineState, getPrograms, listItems, loadPrograms } from '../core/programs.js';
import { escapeHtml, formatDate, localized, safeUrl } from '../core/utils.js';

initPage();

const listEl = document.getElementById('program-list');
const navEl = document.getElementById('program-nav');
let scrolled = false;

const list = (items, ordered = false) => {
  const tag = ordered ? 'ol' : 'ul';
  const cls = ordered ? 'stages' : 'program__facts';
  return `<${tag} class="${cls}">${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</${tag}>`;
};

function block(title, items, ordered = false) {
  if (!items.length) return '';
  return `<div class="program__block"><h3 class="stages__title">${escapeHtml(title)}</h3>${list(items, ordered)}</div>`;
}

function render() {
  const lang = getLang();
  const programs = getPrograms();

  navEl.innerHTML = programs.map((p) => `<a href="#${escapeHtml(p.key)}">${escapeHtml(localized(p.name, lang))}</a>`).join('');

  listEl.innerHTML = programs.map((p, i) => {
    const form = safeUrl(p.formUrl);
    const regulation = safeUrl(p.regulation);
    const state = deadlineState(p);
    const deadline = state === 'open'
      ? `<p class="deadline deadline--open">${escapeHtml(t('programsPage.deadlineOpen', { date: formatDate(p.deadline, lang) }))}</p>`
      : state === 'closed' ? `<p class="deadline deadline--closed">${escapeHtml(t('programsPage.deadlineClosed'))}</p>` : '';

    // Кнопка заявки — только пока приём не закрыт
    const apply = form && state !== 'closed'
      ? `<a class="btn btn--primary btn--lg" href="${escapeHtml(form)}" target="_blank" rel="noopener">${escapeHtml(t('programsPage.apply'))}</a>
         <span class="program__note">${escapeHtml(t('programsPage.applyNote'))}</span>`
      : `<a class="btn btn--outline btn--lg" href="contacts.html">${escapeHtml(t('programsPage.contact'))}</a>
         ${state !== 'closed' ? `<span class="program__note">${escapeHtml(t('programsPage.contactNote'))}</span>` : ''}`;

    return `
      <article class="program" id="${escapeHtml(p.key)}">
        <div>
          <p class="program__index">${String(i + 1).padStart(2, '0')}</p>
          <h2 class="program__title">${escapeHtml(localized(p.name, lang))}</h2>
          ${deadline}
          ${p.lead ? `<p class="program__lead">${escapeHtml(localized(p.lead, lang))}</p>` : ''}
          ${p.text ? `<p class="program__text">${escapeHtml(localized(p.text, lang))}</p>` : ''}
          ${listItems(p.facts ?? {}, lang).length ? list(listItems(p.facts, lang)) : ''}
          <div class="program__actions">
            ${apply}
            ${regulation ? `<a class="arrow-link" href="${escapeHtml(regulation)}" target="_blank" rel="noopener">${escapeHtml(t('programsPage.regulation'))}</a>` : ''}
          </div>
        </div>
        <div class="program__side">
          ${block(t('programsPage.requirementsTitle'), listItems(p.requirements ?? {}, lang))}
          ${block(t('programsPage.documentsTitle'), listItems(p.documents ?? {}, lang))}
          ${block(t('programsPage.stagesTitle'), listItems(p.stages ?? {}, lang), true)}
        </div>
      </article>`;
  }).join('');

  // переход по якорю (programs.html#craft) — один раз, когда программа отрисована
  if (!scrolled && location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      target.scrollIntoView();
      scrolled = true;
    }
  }
}

loadPrograms(render);
document.addEventListener('langchange', render);
