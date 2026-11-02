// «Пожертвовать»: способы перевода из админки («Контакты, реквизиты…» → «Способы пожертвования»).
// У каждого: банк, иконка, номер счёта или карты и необязательная ссылка для перевода.
import { t } from '../core/i18n.js';
import { initPage } from '../core/page.js';
import { getSettings, phoneHref } from '../core/site-content.js';
import { escapeHtml, safeUrl } from '../core/utils.js';

initPage();

const listEl = document.getElementById('requisites');
const contactsEl = document.getElementById('donate-contacts');

function methodIcon(m) {
  const src = safeUrl(m.icon);
  if (src) return `<img class="donate-method__icon" src="${escapeHtml(src)}" alt="" loading="lazy">`;
  const letter = String(m.name ?? '').trim().charAt(0).toUpperCase() || '₸';
  return `<span class="donate-method__icon donate-method__icon--letter" aria-hidden="true">${escapeHtml(letter)}</span>`;
}

function render() {
  const s = getSettings();
  const methods = s.donate.methods;

  listEl.innerHTML = methods.length
    ? methods.map((m) => {
      const link = safeUrl(m.link);
      return `
        <li class="donate-method">
          ${methodIcon(m)}
          <div class="donate-method__body">
            ${m.name ? `<p class="donate-method__name">${escapeHtml(m.name)}</p>` : ''}
            ${m.number ? `
              <p class="donate-method__number">
                <span class="requisites__value">${escapeHtml(m.number)}</span>
                <button type="button" class="requisites__copy" data-copy="${escapeHtml(m.number)}">${escapeHtml(t('donate.copy'))}</button>
              </p>` : ''}
            ${link ? `<a class="btn btn--primary donate-method__link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(m.name ? t('donate.transfer', { name: m.name }) : t('donate.button'))}</a>` : ''}
          </div>
        </li>`;
    }).join('')
    : `<li class="empty-state">${escapeHtml(t('donate.empty'))}</li>`;

  contactsEl.innerHTML = `
    <div class="contact-item">
      <span class="contact-item__label">${escapeHtml(t('donate.questions'))}</span>
      <a class="contact-item__value" href="${escapeHtml(phoneHref(s.phone))}">${escapeHtml(s.phone)}</a>
    </div>
    <div class="contact-item">
      <span class="contact-item__label">${escapeHtml(t('contacts.email'))}</span>
      <a class="contact-item__value" href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a>
    </div>`;
}

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    btn.textContent = t('donate.copied');
    setTimeout(() => { btn.textContent = t('donate.copy'); }, 1500);
  } catch {
    // буфер обмена недоступен — номер остаётся видимым для ручного копирования
  }
});

render();
document.addEventListener('langchange', render);
