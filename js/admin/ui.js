// Общие помощники админ-панели.
export const $ = (id) => document.getElementById(id);

// Языки контента в формах админки.
export const CONTENT_LANGS = ['ru', 'kz', 'en'];
export const LANG_HINTS = { ru: 'русский', kz: 'қазақша (можно оставить пустым)', en: 'English (можно оставить пустым)' };

// Подключения Firebase и текущий раздел — заполняются при входе (js/pages/admin.js).
export const ctx = { db: null, fs: null, tab: 'news', main: null };

export function toast(message, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast${kind === 'error' ? ' toast--error' : ''}`;
  el.textContent = message;
  $('toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3500);
}

export function fail(err) {
  console.error(err);
  const messages = {
    'permission-denied': 'Нет прав на изменение данных. Если раздел новый — опубликуйте обновлённые правила Firestore (Rules → Publish).',
    'storage/unauthorized': 'Нет прав на загрузку файла.',
    'storage/unknown': 'Хранилище файлов не настроено. Обратитесь к разработчику.',
    'storage/bucket-not-found': 'Хранилище файлов не настроено. Обратитесь к разработчику.',
    'storage/canceled': 'Загрузка отменена.',
  };
  toast(messages[err?.code] ?? 'Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.', 'error');
}

export const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

export function fmtDate(v) {
  const d = toDate(v);
  return d ? d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

export function isoDay(v) {
  const d = toDate(v) ?? new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ссылки Google Drive «Поделиться» превращаем в прямые: картинка — превью, остальное — просмотр. */
export function normalizeUrl(raw, kind) {
  const url = String(raw ?? '').trim();
  if (!url) return '';
  const id = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/)?.[1];
  if (id) {
    return kind === 'image'
      ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600`
      : `https://drive.google.com/file/d/${id}/view`;
  }
  // ссылка «редактировать» на Google Форму → ссылка для заполнения (иначе посетитель увидит запрос доступа)
  const form = url.match(/docs\.google\.com\/forms\/d\/(?!e\/)([\w-]+)\/edit/)?.[1];
  if (form) return `https://docs.google.com/forms/d/${form}/viewform`;
  return url;
}

/** Шапка раздела: заголовок, пояснение, кнопки справа. */
export function sectionHead(title, intro, actions = '') {
  return `
    <div class="admin-head"><h1>${title}</h1><div class="admin-head__actions">${actions}</div></div>
    ${intro ? `<p class="admin-intro">${intro}</p>` : ''}`;
}
