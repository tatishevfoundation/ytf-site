// Бегущая строка. Содержимое дублируется, чтобы анимация translateX(-50%) зацикливалась без шва.
import { escapeHtml } from '../core/utils.js';

export function renderTicker(el, items) {
  const row = items.map((item) => `
    <li class="ticker__item">
      ${item.value != null ? `<strong class="ticker__value">${escapeHtml(item.value)}</strong>` : ''}
      <span>${escapeHtml(item.text)}</span>
    </li>`).join('');

  el.innerHTML = `
    <ul class="ticker__track">
      ${row}
      ${row.replaceAll('<li class="ticker__item">', '<li class="ticker__item" aria-hidden="true">')}
    </ul>`;
}
