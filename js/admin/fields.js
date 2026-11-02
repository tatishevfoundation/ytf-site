// Поля форм админки: текст на двух языках, списки, даты, числа и загрузка файлов.
import { getStorage } from '../core/firebase.js';
import { parseVideo } from '../core/media.js';
import { escapeHtml } from '../core/utils.js';
import { CONTENT_LANGS, LANG_HINTS, ctx, fail, isoDay, normalizeUrl, toast } from './ui.js';

// Типы файлов: что принимает кнопка «Загрузить», лимит размера, подсказка.
const UPLOAD = {
  image: { accept: 'image/*', maxMb: 15, placeholder: 'Ссылка на фото или загрузите с компьютера' },
  pdf: { accept: 'application/pdf,.pdf', maxMb: 50, placeholder: 'Ссылка на PDF или загрузите с компьютера' },
  file: { accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf', maxMb: 50, placeholder: 'Ссылка на файл или загрузите с компьютера' },
  video: { accept: 'video/*', maxMb: 500, placeholder: 'Ссылка на YouTube или загрузите видеофайл' },
};

const req = (f) => (f.required ? ' <span class="req">*</span>' : '');
const hintHtml = (f) => (f.hint ? `<span class="field__hint">${escapeHtml(f.hint)}</span>` : '');

function previewHtml(kind, url) {
  if (!url) return '';
  const safe = escapeHtml(url);
  if (kind === 'image') return `<img class="preview" src="${safe}" alt="">`;
  if (kind === 'video') {
    const v = parseVideo(url);
    if (!v) return '';
    if (v.kind === 'file') return `<video class="preview preview--video" src="${safe}" controls preload="metadata"></video>`;
    return v.thumb
      ? `<img class="preview" src="${escapeHtml(v.thumb)}" alt=""><span class="field__hint">Видео с YouTube</span>`
      : '<span class="field__hint">Видео подключено</span>';
  }
  return `<a class="admin-link" href="${safe}" target="_blank" rel="noopener">Открыть файл ↗</a>`;
}

export function fieldHtml(f, value, { editing = false } = {}) {
  const label = `${escapeHtml(f.label)}${req(f)}`;
  const required = f.required ? ' required' : '';
  // Код записи (например, код программы) после создания менять нельзя — на него ссылаются другие записи
  if (f.readonlyOnEdit && editing) {
    return `<label class="field"><span class="field__label">${label}</span>
      <input class="input" name="${f.key}" value="${escapeHtml(value ?? '')}" readonly>
      <span class="field__hint">Код не меняется после создания.</span></label>`;
  }

  if (f.bilingual) {
    const v = value ?? {};
    const control = (lang) => {
      const name = `${f.key}.${lang}`;
      const r = lang === 'ru' ? required : '';
      return f.type === 'textarea'
        ? `<textarea class="textarea" name="${name}"${r}>${escapeHtml(v[lang] ?? '')}</textarea>`
        : `<input class="input" name="${name}" value="${escapeHtml(v[lang] ?? '')}"${r}>`;
    };
    return `
      <div class="field">
        <span class="field__label">${label}</span>
        <div class="lang-pair">
          ${CONTENT_LANGS.map((lang) => `
            <label class="field"><span class="field__hint"><span class="lang-pair__tag">${lang.toUpperCase()}</span>${LANG_HINTS[lang]}</span>${control(lang)}</label>`).join('')}
        </div>
        ${hintHtml(f)}
      </div>`;
  }

  if (f.type === 'checkbox') {
    return `<label class="check"><input type="checkbox" name="${f.key}"${value ? ' checked' : ''}> ${escapeHtml(f.label)}</label>`;
  }

  if (UPLOAD[f.type]) {
    const u = UPLOAD[f.type];
    return `
      <div class="field" data-upload="${f.type}" data-folder="${escapeHtml(f.folder ?? 'files')}">
        <span class="field__label">${label}</span>
        <div class="upload">
          <input class="input" type="url" name="${f.key}" value="${escapeHtml(value ?? '')}" placeholder="${u.placeholder}"${required}>
          <label class="btn btn--outline upload__btn">Загрузить с компьютера
            <input type="file" accept="${u.accept}" hidden>
          </label>
          ${value ? '<button type="button" class="btn btn--outline upload__clear" title="Убрать файл">Убрать</button>' : ''}
        </div>
        <div class="upload__progress" hidden><span></span><em>0%</em></div>
        <div class="upload__preview">${previewHtml(f.type, value)}</div>
        ${hintHtml(f)}
      </div>`;
  }

  let control;
  if (f.type === 'select') {
    control = `<select class="select" name="${f.key}"${required}>
      ${f.required ? '<option value="">— выберите —</option>' : '<option value="">—</option>'}
      ${f.options.map((o) => `<option value="${escapeHtml(o.value)}"${o.value === value ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
    </select>`;
  } else if (f.type === 'textarea') {
    control = `<textarea class="textarea" name="${f.key}"${required}>${escapeHtml(value ?? '')}</textarea>`;
  } else if (f.type === 'date') {
    control = `<input class="input" type="date" name="${f.key}" value="${isoDay(value)}"${required}>`;
  } else if (f.type === 'day') {
    // дата без времени, может быть пустой (хранится строкой ГГГГ-ММ-ДД)
    control = `<input class="input" type="date" name="${f.key}" value="${escapeHtml(value ?? '')}"${required}>`;
  } else if (f.type === 'number') {
    const range = `${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}`;
    control = `<input class="input" type="number" name="${f.key}" value="${escapeHtml(value ?? '')}"${range}${required}>`;
  } else if (f.type === 'url') {
    control = `<input class="input" type="url" name="${f.key}" value="${escapeHtml(value ?? '')}" placeholder="https://…"${required}>`;
  } else {
    const pattern = f.pattern ? ` pattern="${escapeHtml(f.pattern)}"` : '';
    control = `<input class="input" name="${f.key}" value="${escapeHtml(value ?? '')}"${pattern}${required}>`;
  }
  return `<label class="field"><span class="field__label">${label}</span>${control}${hintHtml(f)}</label>`;
}

/** Короткие поля (дата, число, список) ставим в ряд, остальные — на всю ширину. */
export function formFieldsHtml(fields, data, options = {}) {
  const out = [];
  let row = [];
  const flush = () => {
    if (row.length) out.push(`<div class="form-grid form-grid--3">${row.join('')}</div>`);
    row = [];
  };
  for (const f of fields) {
    const html = fieldHtml(f, data?.[f.key], options);
    if (!f.bilingual && ['date', 'day', 'number', 'select'].includes(f.type)) row.push(html);
    else {
      flush();
      out.push(html);
    }
  }
  flush();
  return out.join('');
}

export function readForm(form, fields) {
  const fd = new FormData(form);
  const data = {};
  for (const f of fields) {
    if (f.bilingual) {
      data[f.key] = Object.fromEntries(CONTENT_LANGS.map((lang) => [lang, String(fd.get(`${f.key}.${lang}`) ?? '').trim()]));
    } else if (f.type === 'checkbox') {
      data[f.key] = fd.get(f.key) === 'on';
    } else if (f.type === 'number') {
      const v = fd.get(f.key);
      data[f.key] = v === '' || v == null ? null : Number(v);
    } else if (f.type === 'date') {
      data[f.key] = ctx.fs.Timestamp.fromDate(new Date(`${fd.get(f.key)}T12:00:00`));
    } else if (f.type === 'day') {
      data[f.key] = String(fd.get(f.key) ?? '');
    } else if (UPLOAD[f.type] || f.type === 'url') {
      data[f.key] = normalizeUrl(fd.get(f.key), f.type);
    } else {
      data[f.key] = String(fd.get(f.key) ?? '').trim();
    }
  }
  return data;
}

// ——— Загрузка файлов в Firebase Storage ———

async function uploadFile(file, folder, onProgress) {
  const conn = await getStorage();
  const { storage, st } = conn;
  const ext = (file.name.match(/\.[a-z0-9]{1,6}$/i)?.[0] ?? '').toLowerCase();
  const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file';
  const ref = st.ref(storage, `uploads/${folder}/${Date.now()}-${base}${ext}`);
  const task = st.uploadBytesResumable(ref, file, { contentType: file.type || undefined });
  return new Promise((resolve, reject) => {
    task.on('state_changed',
      (snap) => onProgress(snap.bytesTransferred / snap.totalBytes),
      reject,
      async () => resolve(await st.getDownloadURL(task.snapshot.ref)));
  });
}

// ——— Маленькая иконка в строке списка (соцсеть, банк) ———

/** fallback — что показать, пока своя иконка не загружена (например, встроенный значок соцсети). */
export function iconFieldHtml(value, { folder, fallback = '' }) {
  const src = escapeHtml(value ?? '');
  return `
    <div class="icon-field" data-icon-upload data-folder="${escapeHtml(folder)}">
      <span class="icon-field__preview">${value ? `<img src="${src}" alt="">` : fallback}</span>
      <input type="hidden" name="icon" value="${src}">
      <label class="admin-link icon-field__btn" title="Загрузить свою иконку (PNG, SVG, JPG)">${value ? 'заменить' : 'загрузить'}
        <input type="file" accept="image/*" hidden></label>
      <button type="button" class="admin-link icon-field__clear"${value ? '' : ' hidden'}>убрать</button>
    </div>`;
}

/**
 * Оживляет иконки во всём контейнере, включая строки, добавленные позже.
 * fallbackOf(field) — значок по умолчанию после «убрать». Возвращает «идёт ли загрузка».
 */
export function bindIconUploads(container, fallbackOf = () => '') {
  let pending = 0;
  const setIcon = (field, url) => {
    field.querySelector('input[name="icon"]').value = url;
    field.querySelector('.icon-field__preview').innerHTML = url ? `<img src="${escapeHtml(url)}" alt="">` : fallbackOf(field);
    field.querySelector('.icon-field__btn').firstChild.textContent = url ? 'заменить' : 'загрузить';
    field.querySelector('.icon-field__clear').hidden = !url;
  };
  container.addEventListener('click', (e) => {
    const clear = e.target.closest('.icon-field__clear');
    if (clear) setIcon(clear.closest('[data-icon-upload]'), '');
  });
  container.addEventListener('change', async (e) => {
    const input = e.target;
    if (input.type !== 'file' || !input.closest('[data-icon-upload]')) return;
    const field = input.closest('[data-icon-upload]');
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('Иконка слишком большая. Максимум — 5 МБ.', 'error');
      return;
    }
    pending++;
    field.classList.add('is-loading');
    try {
      setIcon(field, await uploadFile(file, field.dataset.folder, () => {}));
      toast('Иконка загружена. Не забудьте нажать «Сохранить».');
    } catch (err) {
      fail(err);
    } finally {
      pending--;
      field.classList.remove('is-loading');
    }
  });
  return () => pending > 0;
}

/**
 * Оживляет поля загрузки в форме. Возвращает функцию «идёт ли загрузка» —
 * пока файл грузится, форму сохранять нельзя.
 */
export function bindUploads(form) {
  let pending = 0;
  form.querySelectorAll('[data-upload]').forEach((field) => {
    const kind = field.dataset.upload;
    const folder = field.dataset.folder;
    const urlInput = field.querySelector('input[type="url"]');
    const fileInput = field.querySelector('input[type="file"]');
    const progress = field.querySelector('.upload__progress');
    const bar = progress.querySelector('span');
    const pct = progress.querySelector('em');
    const preview = field.querySelector('.upload__preview');
    const refresh = () => { preview.innerHTML = previewHtml(kind, normalizeUrl(urlInput.value, kind)); };

    urlInput.addEventListener('change', refresh);
    field.querySelector('.upload__clear')?.addEventListener('click', (e) => {
      urlInput.value = '';
      refresh();
      e.currentTarget.remove();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const limit = UPLOAD[kind].maxMb;
      if (file.size > limit * 1024 * 1024) {
        toast(`Файл слишком большой: ${Math.round(file.size / 1024 / 1024)} МБ. Максимум — ${limit} МБ.${kind === 'video' ? ' Длинные видео лучше выложить на YouTube и вставить ссылку.' : ''}`, 'error');
        return;
      }
      pending++;
      progress.hidden = false;
      bar.style.width = '0%';
      try {
        urlInput.value = await uploadFile(file, folder, (p) => {
          bar.style.width = `${Math.round(p * 100)}%`;
          pct.textContent = `${Math.round(p * 100)}%`;
        });
        refresh();
        toast('Файл загружен. Не забудьте нажать «Сохранить».');
      } catch (err) {
        fail(err);
      } finally {
        pending--;
        progress.hidden = true;
      }
    });
  });
  return () => pending > 0;
}
