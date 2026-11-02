// «Контакты и соцсети»: адрес, телефон, почта, любые соцсети (со своими иконками),
// ссылки на формы заявок, объявление над шапкой, способы пожертвования.
// Хранится в Firestore site/settings; на сайте — подвал, страница контактов, кнопки заявок.
import { DEFAULT_SETTINGS, mergeSettings } from '../core/site-content.js';
import { socialIcon } from '../core/socials.js';
import { escapeHtml } from '../core/utils.js';
import ru from '../i18n/ru.js';
import { bindIconUploads, iconFieldHtml } from './fields.js';
import { initMapPicker } from './map-picker.js';
import { $, CONTENT_LANGS, ctx, fail, sectionHead, toast } from './ui.js';

const rowActions = `
  <div class="social-row__actions">
    <button type="button" class="btn btn--outline" data-move="-1" title="Выше">↑</button>
    <button type="button" class="btn btn--outline" data-move="1" title="Ниже">↓</button>
    <button type="button" class="btn btn--danger" data-remove title="Удалить">✕</button>
  </div>`;

const socialRow = (s = { name: '', url: '', icon: '' }) => `
  <div class="social-row">
    ${iconFieldHtml(s.icon, { folder: 'socials', fallback: socialIcon(s.url) })}
    <input class="input" name="social-name" value="${escapeHtml(s.name)}" placeholder="Название, например Facebook" aria-label="Название соцсети">
    <input class="input" type="url" name="social-url" value="${escapeHtml(s.url)}" placeholder="https://…" aria-label="Ссылка">
    ${rowActions}
  </div>`;

const letterIcon = (name) => `<span class="icon-field__letter">${escapeHtml(String(name ?? '').trim().charAt(0).toUpperCase() || '₸')}</span>`;

const donateRow = (m = { name: '', icon: '', number: '', link: '' }) => `
  <div class="social-row donate-row">
    ${iconFieldHtml(m.icon, { folder: 'banks', fallback: letterIcon(m.name) })}
    <input class="input" name="don-name" value="${escapeHtml(m.name)}" placeholder="Банк, например Kaspi или БЦК" aria-label="Банк">
    <input class="input" name="don-number" value="${escapeHtml(m.number)}" placeholder="Номер карты или счёта" aria-label="Номер карты или счёта">
    <input class="input" type="url" name="don-link" value="${escapeHtml(m.link)}" placeholder="Ссылка для перевода (необязательно)" aria-label="Ссылка для перевода">
    ${rowActions}
  </div>`;

/** Кнопки ↑ ↓ ✕ в строках списка. */
function bindRowList(list) {
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.social-row');
    if (!row) return;
    if (e.target.closest('[data-remove]')) row.remove();
    const move = Number(e.target.closest('[data-move]')?.dataset.move);
    if (move === -1 && row.previousElementSibling) row.previousElementSibling.before(row);
    if (move === 1 && row.nextElementSibling) row.nextElementSibling.after(row);
  });
}

const rowValue = (row, name) => row.querySelector(`[name="${name}"]`).value.trim();

// Поле на нескольких языках: name-ru, name-kz.
const pair = (name, label, value = {}, placeholder = '') => `
  <div class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <div class="lang-pair">
      ${CONTENT_LANGS.map((lang) => `
        <label class="field"><span class="field__hint"><span class="lang-pair__tag">${lang.toUpperCase()}</span></span>
          <input class="input" name="${name}-${lang}" value="${escapeHtml(value?.[lang] ?? '')}"${lang === 'ru' && placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}></label>`).join('')}
    </div>
  </div>`;

const readPair = (form, name) =>
  Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, form.elements[`${name}-${lang}`].value.trim()]));

export async function renderSettings() {
  const { db, fs, main } = ctx;
  main.innerHTML = `
    ${sectionHead('Контакты и соцсети', 'Эти данные показываются в подвале каждой страницы и на странице «Контакты». Точку на карте «Контакты» можно отметить вручную — ниже, под адресом.')}
    <form class="admin-form" id="settings-form" novalidate><p class="loading">Загрузка…</p></form>`;

  let s = DEFAULT_SETTINGS;
  try {
    const snap = await fs.getDoc(fs.doc(db, 'site', 'settings'));
    if (snap.exists()) s = mergeSettings(snap.data());
  } catch (err) {
    fail(err);
  }
  if (ctx.tab !== 'settings') return;

  const form = $('settings-form');
  form.innerHTML = `
    <section class="panel">
      <h2>Контакты</h2>
      ${pair('address', 'Адрес', s.address)}
      <div class="form-grid">
        <label class="field"><span class="field__label">Телефон <span class="req">*</span></span>
          <input class="input" name="phone" value="${escapeHtml(s.phone)}" required></label>
        <label class="field"><span class="field__label">Email <span class="req">*</span></span>
          <input class="input" type="email" name="email" value="${escapeHtml(s.email)}" required></label>
      </div>
      <div class="field">
        <span class="field__label">Точка на карте (страница «Контакты»)</span>
        <p class="field__hint">Нажмите на карте, где находится офис, — там появится метка, её можно перетащить. Кнопка «Найти по адресу» перенесёт карту к адресу выше. Если метку убрать, карта на сайте будет искать офис по адресу.</p>
        <div class="map-picker" id="map-picker"><p class="loading">Загрузка карты…</p></div>
        <div class="map-picker__bar">
          <span id="map-coords" class="field__hint"></span>
          <button type="button" class="btn btn--outline" id="map-find">Найти по адресу</button>
          <button type="button" class="btn btn--outline" id="map-clear">Убрать метку</button>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Соцсети</h2>
      <p class="admin-intro">Добавьте любую соцсеть: название и ссылку. Значок для Instagram, Facebook, YouTube, Telegram, WhatsApp, TikTok, LinkedIn и других подберётся сам. Для новой соцсети нажмите «загрузить» под значком и выберите свою картинку (лучше квадратную PNG или SVG).</p>
      <div class="social-list" id="social-list">${s.socials.map(socialRow).join('')}</div>
      <button type="button" class="btn btn--outline" id="social-add">+ Добавить соцсеть</button>
    </section>

    <section class="panel">
      <h2>Ссылки на заявки</h2>
      <p class="admin-intro">Куда ведёт кнопка «Подать заявку» у каждой программы. <b>После переноса программ в раздел «📚 Программы» ссылки правятся там</b> — эти поля тогда не используются.</p>
      ${['bestirek', 'craft', 'kentau'].map((key) => `
        <label class="field"><span class="field__label">${escapeHtml(ru.programs[key])}</span>
          <input class="input" type="url" name="form-${key}" value="${escapeHtml(s.forms[key] ?? '')}" placeholder="https://docs.google.com/forms/…"></label>`).join('')}
    </section>

    <section class="panel">
      <h2>Объявление над шапкой сайта</h2>
      <p class="admin-intro">Тонкая синяя полоса над меню на всех страницах — например, на время приёма заявок. В указанные дату и время (по Алматы) она скроется сама, а до этого момента на ней идёт живой обратный отсчёт. Посетитель может закрыть её крестиком.</p>
      <label class="check"><input type="checkbox" name="ann-enabled"${s.announcement.enabled ? ' checked' : ''}> Показывать объявление</label>
      ${pair('ann-text', 'Текст объявления', s.announcement.text, 'Например: Приём заявок на БесТірек открыт до 14 октября')}
      ${pair('ann-label', 'Надпись на кнопке', s.announcement.linkLabel, 'Например: Подать заявку')}
      <label class="field"><span class="field__label">Куда ведёт кнопка</span>
        <input class="input" type="url" name="ann-link" value="${escapeHtml(s.announcement.link)}" placeholder="https://… (можно ссылку на Google Форму)"></label>
      <div class="form-grid form-grid--3">
        <label class="field"><span class="field__label">Показывать до (дата)</span>
          <input class="input" type="date" name="ann-until" value="${escapeHtml(s.announcement.until)}"></label>
        <label class="field"><span class="field__label">Время (по Алматы)</span>
          <input class="input" type="time" name="ann-time" value="${escapeHtml(s.announcement.untilTime)}">
          <span class="field__hint">Пусто — до конца дня (23:59).</span></label>
        <label class="check check--field"><input type="checkbox" name="ann-countdown"${s.announcement.countdown !== false ? ' checked' : ''}> Показывать обратный отсчёт</label>
      </div>
    </section>

    <section class="panel">
      <h2>Способы пожертвования</h2>
      <p class="admin-intro">Показываются на странице «Пожертвовать» (кнопка в подвале сайта). Для каждого банка: название, номер карты или счёта и, если есть, ссылка для перевода — тогда под номером появится кнопка «Перевести». Иконку банка можно загрузить под значком слева; без неё будет первая буква названия.</p>
      <div class="social-list" id="donate-list">${s.donate.methods.map(donateRow).join('')}</div>
      <button type="button" class="btn btn--outline" id="donate-add">+ Добавить банк</button>
    </section>

    <div class="save-bar"><span></span><button class="btn btn--primary" type="submit">Сохранить</button></div>`;

  const map = initMapPicker({
    el: $('map-picker'),
    coordsEl: $('map-coords'),
    findBtn: $('map-find'),
    clearBtn: $('map-clear'),
    point: s.mapPoint,
    getAddress: () => form.elements['address-ru'].value.trim(),
  });

  const list = $('social-list');
  const donateList = $('donate-list');
  const addRow = (target, html) => {
    target.insertAdjacentHTML('beforeend', html);
    target.lastElementChild.querySelector('input:not([type="hidden"])').focus();
  };
  $('social-add').addEventListener('click', () => addRow(list, socialRow()));
  $('donate-add').addEventListener('click', () => addRow(donateList, donateRow()));
  bindRowList(list);
  bindRowList(donateList);

  // Значок по умолчанию (пока своя иконка не загружена) обновляется вместе со ссылкой / названием
  const socialFallback = (field) => socialIcon(rowValue(field.closest('.social-row'), 'social-url'));
  const bankFallback = (field) => letterIcon(rowValue(field.closest('.social-row'), 'don-name'));
  const uploading = [bindIconUploads(list, socialFallback), bindIconUploads(donateList, bankFallback)];
  const refreshFallback = (e, name, fallback) => {
    if (e.target.name !== name) return;
    const field = e.target.closest('.social-row').querySelector('[data-icon-upload]');
    if (!field.querySelector('input[name="icon"]').value) field.querySelector('.icon-field__preview').innerHTML = fallback(field);
  };
  list.addEventListener('change', (e) => refreshFallback(e, 'social-url', socialFallback));
  donateList.addEventListener('input', (e) => refreshFallback(e, 'don-name', bankFallback));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (uploading.some((busy) => busy())) {
      toast('Подождите, иконка ещё загружается.', 'error');
      return;
    }
    if (!form.reportValidity()) return;
    const value = (name) => form.elements[name].value.trim();
    const socials = [...list.querySelectorAll('.social-row')]
      .map((row) => ({ name: rowValue(row, 'social-name'), url: rowValue(row, 'social-url'), icon: rowValue(row, 'icon') }))
      .filter((x) => x.url);
    const methods = [...donateList.querySelectorAll('.social-row')]
      .map((row) => ({
        name: rowValue(row, 'don-name'), icon: rowValue(row, 'icon'), number: rowValue(row, 'don-number'), link: rowValue(row, 'don-link'),
      }))
      .filter((m) => m.number || m.link);
    const data = {
      address: readPair(form, 'address'),
      phone: value('phone'),
      email: value('email'),
      socials,
      forms: { bestirek: value('form-bestirek'), craft: value('form-craft'), kentau: value('form-kentau') },
      announcement: {
        enabled: form.elements['ann-enabled'].checked,
        text: readPair(form, 'ann-text'),
        linkLabel: readPair(form, 'ann-label'),
        link: value('ann-link'),
        until: value('ann-until'),
        untilTime: value('ann-time'),
        countdown: form.elements['ann-countdown'].checked,
      },
      mapPoint: map.point(),
      donate: { methods },
      updatedAt: fs.serverTimestamp(),
    };
    try {
      await fs.setDoc(fs.doc(db, 'site', 'settings'), data);
      toast('Контакты сохранены');
    } catch (err) {
      fail(err);
    }
  });
}
