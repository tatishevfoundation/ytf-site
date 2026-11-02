// «Партнёры»: фото или логотип в колонке слева, справа — название, описание и ссылка на сайт.
// Правится в админке: «О фонде» → «Партнёры».
import { getLang, t } from '../core/i18n.js';
import { initPage } from '../core/page.js';
import { loadPartners } from '../core/data.js';
import { escapeHtml, localized, safeUrl } from '../core/utils.js';
import { DEFAULT_PARTNERS } from '../components/cards.js';

initPage();

const listEl = document.getElementById('partner-list');
let partners = [];

const paragraphs = (text) => String(text ?? '').split(/\n\s*\n/).filter((p) => p.trim())
  .map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('');

function render() {
  const lang = getLang();
  const list = partners.length ? partners : DEFAULT_PARTNERS;
  listEl.innerHTML = list.map((p) => {
    const name = localized(p.name, lang);
    const photo = safeUrl(p.photo);
    const logo = safeUrl(p.logo);
    const url = safeUrl(p.url);
    let media = `<span class="partner-row__name-badge">${escapeHtml(name)}</span>`;
    if (photo) media = `<img class="partner-row__photo" src="${escapeHtml(photo)}" alt="" loading="lazy">`;
    else if (logo) media = `<img class="partner-row__logo" src="${escapeHtml(logo)}" alt="" loading="lazy">`;
    return `
      <article class="partner-row">
        <div class="partner-row__media${photo ? ' partner-row__media--photo' : ''}">${media}</div>
        <div class="partner-row__body">
          ${photo && logo ? `<img class="partner-row__mini-logo" src="${escapeHtml(logo)}" alt="" loading="lazy">` : ''}
          <h2 class="partner-row__title">${escapeHtml(name)}</h2>
          ${p.text ? `<div class="prose partner-row__text">${paragraphs(localized(p.text, lang))}</div>` : ''}
          ${url ? `<a class="btn btn--outline partner-row__link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(t('partnersPage.visit'))} ↗</a>` : ''}
        </div>
      </article>`;
  }).join('');
}

loadPartners((items) => {
  partners = items;
  render();
});

render();
document.addEventListener('langchange', render);
