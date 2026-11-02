import { SITE } from '../config/site.js';
import { getLang, t } from '../core/i18n.js';
import { initPage } from '../core/page.js';
import { loadFaq } from '../core/data.js';
import { socialLinks } from '../core/layout.js';
import { getSettings, mapEmbedUrl, phoneHref } from '../core/site-content.js';
import { escapeHtml, localized } from '../core/utils.js';

initPage();

// ——— Контакты (правятся в админке: «Контакты и соцсети») ———

const listEl = document.getElementById('contact-list');
const mapEl = document.getElementById('map-embed');

function renderContacts() {
  const s = getSettings();
  const address = s.address[getLang()] || s.address.ru;
  const items = [
    { label: t('contacts.address'), value: address },
    { label: t('contacts.phone'), value: s.phone, href: phoneHref(s.phone) },
    { label: t('contacts.email'), value: s.email, href: `mailto:${s.email}` },
  ];
  const socials = socialLinks('social-chip');
  listEl.innerHTML = items.map(({ label, value, href }) => `
    <div class="contact-item">
      <span class="contact-item__label">${escapeHtml(label)}</span>
      ${href
        ? `<a class="contact-item__value" href="${escapeHtml(href)}">${escapeHtml(value)}</a>`
        : `<span class="contact-item__value">${escapeHtml(value)}</span>`}
    </div>`).join('')
    + (socials ? `
    <div class="contact-item">
      <span class="contact-item__label">${escapeHtml(t('contacts.socials'))}</span>
      <div class="social-chips">${socials}</div>
    </div>` : '');

  // карта по точке, выбранной в админке; если её нет — по русскому адресу (его точнее находит Google)
  const mapSrc = mapEmbedUrl(s.address.ru || address, s.mapPoint);
  if (mapEl.src !== mapSrc) mapEl.src = mapSrc;
}

renderContacts();
document.addEventListener('langchange', renderContacts);

// ——— FAQ: из админки; пока там пусто — стандартные вопросы из словаря ———

const faqEl = document.getElementById('faq-list');
let faqItems = [];

function renderFaq() {
  const lang = getLang();
  const items = faqItems.length
    ? faqItems.map((f) => ({ q: localized(f.question, lang), a: localized(f.answer, lang) }))
    : [1, 2, 3, 4].map((n) => ({ q: t(`contacts.faq.q${n}`), a: t(`contacts.faq.a${n}`) }));
  faqEl.innerHTML = items.map(({ q, a }) => `
    <details class="faq__item" name="faq">
      <summary class="faq__q">${escapeHtml(q)}</summary>
      <p class="faq__a">${escapeHtml(a)}</p>
    </details>`).join('');
}

loadFaq((items) => {
  faqItems = items;
  renderFaq();
});
document.addEventListener('langchange', renderFaq);

// ——— Форма через Formspree ———

const form = document.getElementById('contact-form');
const statusEl = document.getElementById('form-status');
const submitBtn = form.querySelector('[type="submit"]');

function setStatus(kind, key) {
  statusEl.hidden = false;
  statusEl.className = `form__status form__status--${kind}`;
  statusEl.textContent = t(key);
}

if (!SITE.formspreeId) setStatus('info', 'contacts.form.notConfigured');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  if (!SITE.formspreeId) {
    setStatus('info', 'contacts.form.notConfigured');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = t('contacts.form.sending');
  try {
    const res = await fetch(`https://formspree.io/f/${encodeURIComponent(SITE.formspreeId)}`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new FormData(form),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    form.reset();
    setStatus('ok', 'contacts.form.success');
  } catch (err) {
    console.warn('[contacts] Formspree', err);
    setStatus('error', 'contacts.form.error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t('contacts.form.submit');
  }
});
