// Общие шапка и подвал для всех страниц: в HTML достаточно
// <header class="site-header" id="site-header"></header> и <footer class="site-footer" id="site-footer"></footer>.
import { SITE } from '../config/site.js';
import { LANGS, getLang, setLang, t } from './i18n.js';
import { loadPartners, loadReports } from './data.js';
import {
  activeAnnouncement, announcementEnd, getSettings, phoneHref,
} from './site-content.js';
import { socialIconHtml } from './socials.js';
import { escapeHtml, localized, safeUrl } from './utils.js';

// children — подпункты: на компьютере выпадают при наведении, в мобильном меню идут списком.
const NAV = [
  { href: 'index.html', key: 'nav.home' },
  {
    href: 'about.html',
    key: 'nav.about',
    children: [
      { href: 'about.html', key: 'nav.aboutFoundation' },
      { href: 'achievements.html', key: 'nav.achievements' },
      { href: 'partners.html', key: 'nav.partners' },
    ],
  },
  { href: 'programs.html', key: 'nav.programs' },
  { href: 'scholars.html', key: 'nav.scholars' },
  { href: 'graduates.html', key: 'nav.graduates' },
  { href: 'news.html', key: 'nav.news' },
  { href: 'contacts.html', key: 'nav.contacts' },
];

function currentPage() {
  const file = location.pathname.split('/').pop();
  return file === '' ? 'index.html' : file.replace(/(\.html)?$/, '.html');
}

const navLink = (className, { href, key }, page) =>
  `<a class="${className}" href="${href}"${href === page ? ' aria-current="page"' : ''} data-i18n="${key}">${escapeHtml(t(key))}</a>`;

function navLinks(className) {
  const page = currentPage();
  return NAV.map((item) => {
    if (!item.children) return `<li>${navLink(className, item, page)}</li>`;
    const active = item.children.some((c) => c.href === page);
    return `
      <li class="has-sub${active ? ' is-active' : ''}">
        <a class="${className}" href="${item.href}" data-i18n="${item.key}" aria-haspopup="true">${escapeHtml(t(item.key))}</a>
        <ul class="site-nav__sub">${item.children.map((c) => `<li>${navLink(`${className} site-nav__sublink`, c, page)}</li>`).join('')}</ul>
      </li>`;
  }).join('');
}

/** Для подвала — все страницы одним списком. */
function footerLinks() {
  const page = currentPage();
  const seen = new Set();
  return NAV.flatMap((item) => item.children ?? [item])
    .filter(({ href }) => !seen.has(href) && seen.add(href))
    .map((item) => `<li>${navLink('site-footer__link', item.href === 'about.html' ? { ...item, key: 'nav.about' } : item, page)}</li>`)
    .join('');
}

function langSwitch() {
  const lang = getLang();
  const buttons = LANGS.map(
    (code) => `<button type="button" class="lang-switch__btn" data-lang="${code}" aria-pressed="${code === lang}">${code.toUpperCase()}</button>`,
  ).join('');
  return `<div class="lang-switch" role="group" data-i18n-attr="aria-label:common.language" aria-label="${escapeHtml(t('common.language'))}">${buttons}</div>`;
}

function renderHeader(el) {
  el.innerHTML = `
    <div class="container site-header__inner">
      <a class="logo" href="index.html">
        <img class="logo__img" src="assets/brand/logo-horizontal-blue.svg" width="210" height="34"
          alt="${escapeHtml(t('common.foundation'))}" data-i18n-attr="alt:common.foundation">
      </a>
      <nav class="site-nav" id="site-nav">
        <ul class="site-nav__list">${navLinks('site-nav__link')}</ul>
      </nav>
      <div class="site-header__actions">
        ${langSwitch()}
        <a class="btn btn--primary site-header__cta" href="programs.html" data-i18n="common.apply">${escapeHtml(t('common.apply'))}</a>
        <button type="button" class="burger" aria-controls="site-nav" aria-expanded="false"
          data-i18n-attr="aria-label:common.menu" aria-label="${escapeHtml(t('common.menu'))}">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>`;

  const burger = el.querySelector('.burger');
  const setOpen = (open) => {
    el.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', t(open ? 'common.closeMenu' : 'common.menu'));
    document.body.classList.toggle('no-scroll', open);
  };
  burger.addEventListener('click', () => setOpen(!el.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.classList.contains('is-open')) setOpen(false);
  });

  el.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  document.addEventListener('langchange', ({ detail }) => {
    el.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === detail.lang));
    });
  });

  const onScroll = () => el.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/** Список соцсетей из настроек (своя иконка из админки или встроенная по ссылке). iconOnly — круглые кнопки-значки. */
export function socialLinks(className = 'social-link', { iconOnly = false } = {}) {
  return getSettings().socials.map((s) => {
    const url = safeUrl(s.url);
    if (!url) return '';
    const name = escapeHtml(s.name || url);
    return iconOnly
      ? `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${name}" aria-label="${name}">${socialIconHtml(s)}</a>`
      : `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${socialIconHtml(s)}<span>${name}</span></a>`;
  }).join('');
}

// Последний годовой отчёт — для кнопки в подвале (обновляется сам, когда в админке добавят новый).
let latestReport = null;
let footerPartners = [];

function renderFooter(el) {
  const year = new Date().getFullYear();
  const draw = () => {
    const lang = getLang();
    const s = getSettings();
    const reportUrl = safeUrl(latestReport?.pdf);
    el.innerHTML = `
      <div class="container site-footer__grid">
        <div class="site-footer__brand">
          <a class="logo" href="index.html">
            <img class="logo__img logo__img--footer" src="assets/brand/logo-vertical-white.svg" width="160" height="86"
              alt="${escapeHtml(t('common.foundation'))}">
          </a>
          <p class="site-footer__tagline">${escapeHtml(t('footer.tagline'))}</p>
          <div class="site-footer__actions">
            <a class="btn btn--light" href="donate.html">${escapeHtml(t('donate.button'))}</a>
            ${reportUrl ? `<a class="btn btn--outline-light" href="${escapeHtml(reportUrl)}" target="_blank" rel="noopener">${escapeHtml(t('footer.report', { year: latestReport.year }))} ↓</a>` : ''}
          </div>
          <div class="site-footer__socials" aria-label="${escapeHtml(t('footer.socialsTitle'))}">${socialLinks('social-btn', { iconOnly: true })}</div>
        </div>
        <div>
          <h2 class="site-footer__title">${escapeHtml(t('footer.navTitle'))}</h2>
          <ul class="site-footer__list site-footer__list--nav">
            ${footerLinks()}
            <li><a class="site-footer__link" href="donate.html">${escapeHtml(t('donate.button'))}</a></li>
          </ul>
        </div>
        <div>
          <h2 class="site-footer__title">${escapeHtml(t('footer.contactsTitle'))}</h2>
          <ul class="site-footer__list">
            <li>${escapeHtml(s.address[lang] || s.address.ru)}</li>
            <li><a class="site-footer__link" href="${escapeHtml(phoneHref(s.phone))}">${escapeHtml(s.phone)}</a></li>
            <li><a class="site-footer__link" href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></li>
          </ul>
        </div>
        <div>
          <h2 class="site-footer__title">${escapeHtml(t('footer.partnerTitle'))}</h2>
          <ul class="site-footer__list">
            ${(footerPartners.length ? footerPartners : [{ name: SITE.partner.name, url: SITE.partner.url }]).map((p) => {
              const url = safeUrl(p.url);
              const name = escapeHtml(localized(p.name, lang));
              return `<li>${url ? `<a class="site-footer__link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${name}</a>` : name}</li>`;
            }).join('')}
          </ul>
        </div>
      </div>
      <div class="container site-footer__bottom">
        <span>${escapeHtml(t('footer.rights', { year }))}</span>
        <span>${escapeHtml(SITE.domain)}</span>
      </div>`;
  };
  draw();
  document.addEventListener('langchange', draw);
  loadReports((reports) => {
    latestReport = reports[0] ?? null;
    draw();
  });
  loadPartners((partners) => {
    footerPartners = partners;
    draw();
  });
}

// ——— Полоса-объявление над шапкой (включается в админке: «Контакты и соцсети» → «Объявление») ———

const ANNOUNCE_KEY = 'ytf:announce-closed';

const pad = (n) => String(n).padStart(2, '0');

/** «3 дн. 04:12:55» до момента end; null — время вышло. */
function countdownText(end) {
  const left = Math.floor((end - Date.now()) / 1000);
  if (left <= 0) return null;
  const d = Math.floor(left / 86400);
  const time = `${pad(Math.floor((left % 86400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return d ? `${t('announce.days', { n: d })} ${time}` : time;
}

function renderAnnouncement(header) {
  const bar = document.createElement('div');
  bar.className = 'announce';
  header.before(bar);
  let timer = 0;
  const draw = () => {
    clearInterval(timer);
    const a = activeAnnouncement();
    let closed = '';
    try { closed = sessionStorage.getItem(ANNOUNCE_KEY); } catch { /* не критично */ }
    const id = a ? `${a.until}|${a.untilTime}|${a.text?.ru}` : '';
    if (!a || closed === id) {
      bar.hidden = true;
      return;
    }
    const lang = getLang();
    const text = localized(a.text, lang);
    const linkLabel = localized(a.linkLabel, lang) || t('common.apply');
    const link = safeUrl(a.link);
    const end = a.countdown !== false ? announcementEnd(a) : null;
    bar.hidden = false;
    bar.innerHTML = `
      <div class="container announce__inner">
        <p class="announce__text">${escapeHtml(text)}</p>
        ${end ? `<p class="announce__timer"><span>${escapeHtml(t('announce.left'))}</span> <time class="announce__clock" datetime="${end.toISOString()}"></time></p>` : ''}
        ${link ? `<a class="announce__link" href="${escapeHtml(link)}"${link.startsWith(location.origin) ? '' : ' target="_blank" rel="noopener"'}>${escapeHtml(linkLabel)} →</a>` : ''}
        <button type="button" class="announce__close" aria-label="${escapeHtml(t('common.close'))}">✕</button>
      </div>`;
    bar.querySelector('.announce__close').addEventListener('click', () => {
      try { sessionStorage.setItem(ANNOUNCE_KEY, id); } catch { /* не критично */ }
      clearInterval(timer);
      bar.hidden = true;
    });
    // живой обратный отсчёт; когда время вышло — полоса скрывается сама
    if (end) {
      const clock = bar.querySelector('.announce__clock');
      const tick = () => {
        const value = countdownText(end);
        if (value == null) {
          clearInterval(timer);
          bar.hidden = true;
          return;
        }
        clock.textContent = value;
      };
      tick();
      timer = setInterval(tick, 1000);
    }
  };
  draw();
  document.addEventListener('langchange', draw);
}

export function initLayout() {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) {
    renderAnnouncement(header);
    renderHeader(header);
  }
  if (footer) renderFooter(footer);
}
