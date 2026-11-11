// Откуда взять свой текст: фото (распознаётся в браузере), файл Word/.txt или вставка.
// Общий шаг для «Учим топики» (английский) и своих стихов и текстов в «Учим стихи».
import { h, readFileText } from '../ui.js';
import { fileKind } from '../topic.js';
import { docxToText } from '../docx.js';

/**
 * header() — шапка шага выбора; lang — язык распознавания ('eng' | 'rus'); langNote — что скачивается в первый раз;
 * fileHint — подпись у «Файл Word или .txt»; hint — совет под кнопками;
 * check({ text, image }, onAgain) — экран сверки, показывается после выбора.
 */
export function sourcePicker({ header, lang, langNote, fileHint, hint, check }) {
  const slot = h('div', { class: 'stack' });
  const status = h('div', { class: 'stack', 'aria-live': 'polite' });
  const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => pick(e.target) });
  const fileInput = h('input', { type: 'file', accept: '.docx,.txt,text/plain', hidden: true, onchange: (e) => pick(e.target) });

  const fail = (text) => status.replaceChildren(h('p', { class: 'field__error', role: 'alert' }, text));
  let busy = false;

  async function pick(input) {
    const file = input.files?.[0];
    input.value = ''; // тот же файл можно выбрать ещё раз
    if (!file || busy) return;
    const kind = fileKind(file);
    if (kind === 'doc') return fail('Старый формат Word (.doc) не открывается. Сохрани файл как .docx или скопируй текст и выбери «Вставить текст».');
    if (kind === 'pdf') return fail('PDF пока не открывается. Сделай снимок экрана страницы и выбери «Фото или картинка».');
    if (kind === 'other') return fail('Такой файл не подходит. Нужны фото, картинка, файл Word (.docx) или .txt.');
    busy = true;
    try {
      if (kind === 'image') {
        const bar = h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: { width: '0%' } }));
        const label = h('p', { class: 'small muted' }, 'Загружаем распознавание…');
        status.replaceChildren(h('div', { class: 'card stack' }, label, bar, h('p', { class: 'small muted' }, langNote)));
        const { recognizeImage } = await import('../ocr.js');
        const text = await recognizeImage(file, (share, what) => {
          bar.firstChild.style.width = `${Math.round(share * 100)}%`;
          label.textContent = what;
        }, lang);
        if (!text.trim()) return fail('На картинке не нашлось текста. Сфотографируй ровнее и при хорошем свете или вставь текст вручную.');
        showCheck({ text, image: file });
      } else if (kind === 'docx') {
        showCheck({ text: await docxToText(await file.arrayBuffer()) });
      } else {
        showCheck({ text: await readFileText(file, 200_000) });
      }
    } catch (e) {
      fail(e.message || 'Не получилось прочитать файл.');
    } finally {
      busy = false;
    }
  }

  const choice = (emoji, title, text, onClick) =>
    h('button', { type: 'button', class: 'card poems-link etopic-source', onclick: onClick }, h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, emoji), h('span', { class: 'subject-card__text' }, h('span', { class: 'subject-card__name' }, title), h('span', { class: 'small muted' }, text)));

  function showCheck(src) {
    slot.replaceChildren(check(src, showChoice));
    slot.querySelector('.page-title')?.focus({ preventScroll: true });
    scrollTo(0, 0);
  }
  function showChoice() {
    status.textContent = '';
    slot.replaceChildren(
      header(),
      choice('📷', 'Фото или картинка', 'Сфотографируй страницу или выбери картинку — текст распознается сам', () => photoInput.click()),
      choice('📄', 'Файл Word или .txt', fileHint, () => fileInput.click()),
      choice('⌨️', 'Вставить текст', 'Скопируй текст и вставь его сам', () => showCheck({ text: '' })),
      status,
      h('p', { class: 'small muted' }, hint),
      photoInput,
      fileInput,
    );
  }
  showChoice();
  return slot;
}

/** Оригинал на экране сверки: фото, с которого распознан текст. Не сохраняется. */
export function originalImage(url, alt) {
  return h('details', { class: 'card etopic-image', open: true }, h('summary', {}, 'Оригинал (фото)'), h('img', { src: url, alt }));
}
