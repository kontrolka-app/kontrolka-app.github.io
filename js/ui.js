// Безопасное построение DOM, уведомления и диалоги.
// Пользовательские строки всегда вставляются как текст (textContent), innerHTML не используется.

/**
 * h('button', { class: 'btn', onclick: fn }, 'Текст', childNode)
 * Атрибуты: class, on<event>, dataset, aria-*, обычные свойства. Дети: строки, числа, узлы, массивы, null.
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style' && typeof value === 'object') {
      // CSS-переменные (--имя) ставятся только через setProperty.
      for (const [prop, v] of Object.entries(value)) prop.startsWith('--') ? el.style.setProperty(prop, v) : (el.style[prop] = v);
    }
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'text') el.textContent = value;
    else if (key in el && !key.includes('-') && key !== 'list' && key !== 'form') {
      try {
        el[key] = value;
      } catch {
        el.setAttribute(key, value === true ? '' : value);
      }
    } else el.setAttribute(key, value === true ? '' : value);
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) appendChildren(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

/** SVG-иконки (только константы из кода, не пользовательские данные). */
const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zm0 0v16M8 7h7',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-7 3.3M3 4v4h4M12 7v5l3 2',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 00-2.2-1.3L14.3 3h-4l-.4 2.4a7.5 7.5 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 002.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  cross: 'M6 6l12 12M18 6L6 18',
  skip: 'M5 5l8 7-8 7zM15 5v14',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 18l-6-6 6-6',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v7h14v-7',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  play: 'M7 4l13 8-13 8z',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  link: 'M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1',
  tests: 'M9 4h6M9 4a2 2 0 00-2 2H5v15h14V6h-2a2 2 0 00-2-2M8 11l2 2 4-4M8 17h8',
  // Меню: «Прогресс» и «Я».
  chart: 'M4 20V4M4 20h16M8 15l4-5 3 3 5-6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
};

export function icon(name, { size = 20, label } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'icon');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name] || '');
  svg.appendChild(path);
  return svg;
}

let toastTimer = null;
/** Короткое уведомление, которое озвучивают экранные дикторы. */
export function toast(message, kind = 'info') {
  const region = document.getElementById('toast');
  if (!region) return;
  region.textContent = '';
  region.className = `toast toast--${kind} is-visible`;
  region.appendChild(document.createTextNode(message));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => region.classList.remove('is-visible'), kind === 'error' ? 6000 : 3000);
}

/**
 * Модальный диалог подтверждения. Возвращает Promise: true — «Да», false — «Отмена»,
 * null — окно закрыто клавишей Escape (для простых вопросов это тоже «нет»).
 * safeFirst — выделить основным стилем безопасный вариант (кнопку отмены).
 */
export function confirmDialog(message, { title = 'Подтверждение', okText = 'Да', cancelText = 'Отмена', danger = false, safeFirst = false } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') {
      resolve(window.confirm(message));
      return;
    }
    dialog.className = 'dialog';
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    const done = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.append(
      h('h2', { class: 'dialog__title', id: 'dialog-title' }, title),
      h('p', { class: 'dialog__text' }, message),
      h(
        'div',
        { class: 'dialog__actions' },
        h('button', { class: `btn ${safeFirst ? 'btn--primary' : 'btn--ghost'}`, type: 'button', 'data-cancel': '', onclick: () => done(false) }, cancelText),
        h('button', { class: `btn ${danger ? 'btn--danger' : safeFirst ? 'btn--secondary' : 'btn--primary'}`, type: 'button', onclick: () => done(true) }, okText),
      ),
    );
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      done(null);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    dialog.querySelector('[data-cancel]').focus();
  });
}

/** Скачивание JSON-файла. */
export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Отправка файла через системное меню «Поделиться» (телефоны), если оно поддерживает файлы.
 * Возвращает 'shared' | 'cancelled' | 'unsupported'.
 */
export async function shareJsonFile(obj, filename, title) {
  try {
    const file = new File([JSON.stringify(obj, null, 2)], filename, { type: 'application/json' });
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) return 'unsupported';
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (e) {
    return e && e.name === 'AbortError' ? 'cancelled' : 'unsupported';
  }
}

/** Чтение выбранного файла как текста. */
export function readFileText(file, maxBytes = 2_000_000) {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error('Файл слишком большой.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsText(file, 'utf-8');
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Пустое состояние с действием. */
export function emptyState({ emoji = '✨', title, text, action }) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty__emoji', 'aria-hidden': 'true' }, emoji), h('h3', {}, title), text ? h('p', {}, text) : null, action || null);
}

export function linkButton(href, label, { variant = 'primary', iconName, size } = {}) {
  return h('a', { class: `btn btn--${variant}${size ? ` btn--${size}` : ''}`, href }, iconName ? icon(iconName) : null, h('span', {}, label));
}

export function button(label, onClick, { variant = 'primary', iconName, size, disabled, type = 'button', ariaLabel } = {}) {
  return h(
    'button',
    { class: `btn btn--${variant}${size ? ` btn--${size}` : ''}`, type, onclick: onClick, disabled, 'aria-label': ariaLabel },
    iconName ? icon(iconName) : null,
    label ? h('span', {}, label) : null,
  );
}

/** Внешняя ссылка — открывается в новой вкладке безопасно. */
export function externalLink(href, label) {
  const safe = /^https:\/\//.test(href) ? href : '#';
  return h('a', { href: safe, target: '_blank', rel: 'noopener noreferrer', class: 'ext-link' }, icon('link', { size: 16 }), h('span', {}, label));
}

export function pageHeader(title, { back, subtitle, actions } = {}) {
  return h(
    'header',
    { class: 'page-header' },
    back ? h('a', { class: 'btn btn--icon btn--ghost', href: back, 'aria-label': 'Назад' }, icon('back')) : null,
    h('div', { class: 'page-header__text' }, h('h1', { class: 'page-title', tabindex: '-1' }, title), subtitle ? h('p', { class: 'page-subtitle' }, subtitle) : null),
    actions ? h('div', { class: 'page-header__actions' }, actions) : null,
  );
}

export function progressBar(value, max, label) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return h(
    'div',
    { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(value), 'aria-label': label },
    h('div', { class: 'progress__bar', style: { width: `${pct}%` } }),
  );
}
