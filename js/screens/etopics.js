// «Учим топики» (английский): список, добавление (фото, файл или вставка → сверка) и тренажёр как у стихов.
import { h, button, linkButton, pageHeader, emptyState, toast, confirmDialog, readFileText } from '../ui.js';
import { href, navigate } from '../router.js';
import { getData, update, content } from '../state.js';
import { CUSTOM_POEMS_LIMIT } from '../poem.js';
import { toSentenceLines, guessTitle, validateTopicInput, fileKind, TOPIC_TEXT_MAX } from '../topic.js';
import { docxToText } from '../docx.js';
import { subjectVars } from '../components.js';
import { uid, formatDate } from '../utils.js';
import { trainer } from './poems.js';

/** Цвет предмета «Английский язык» на экране (шапка, значки) — как у страниц других предметов. */
function themed(el) {
  el.classList.add('subject-themed', 'etopics-page');
  for (const [k, v] of Object.entries(subjectVars(content.subjectById.get('english')) || {})) el.style.setProperty(k, v);
  return el;
}

export function etopicsScreen() {
  const { custom, learned } = getData().topics;
  return themed(h(
    'div',
    { class: 'stack' },
    pageHeader('🔤 Учим топики', { back: href('english'), subtitle: 'Английский язык. Загрузи свой топик, проверь текст — и учи по предложениям.' }),
    h(
      'section',
      { class: 'stack' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Мои топики'), custom.length < CUSTOM_POEMS_LIMIT ? linkButton(href('etopic-add'), 'Добавить', { variant: 'secondary' }) : null),
      custom.length
        ? h(
            'div',
            { class: 'grid grid--2' },
            custom.map((t) =>
              h(
                'a',
                { class: `card poem-card${learned[t.id] ? ' poem-card--learned' : ''}`, href: href('etopic', t.id) },
                h('span', { class: 'poem-card__title' }, t.title),
                h('span', { class: 'small muted' }, `добавлен ${formatDate(t.createdAt)}`),
                learned[t.id] ? h('span', { class: 'status-pill status-pill--mastered' }, h('span', {}, 'рассказал без подсказок')) : null,
              ),
            ),
          )
        : h(
            'div',
            { class: 'card' },
            emptyState({
              emoji: '📸',
              title: 'Пока нет топиков',
              text: 'Сфотографируй топик из учебника или тетради, загрузи файл Word или вставь текст. Всё сохранится только в этом браузере.',
              action: linkButton(href('etopic-add'), 'Добавить топик', { iconName: 'plus' }),
            }),
          ),
    ),
  ));
}

export function etopicScreen(id) {
  const topic = getData().topics.custom.find((t) => t.id === id);
  if (!topic) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Такого топика нет', action: linkButton(href('etopics'), 'К топикам') }));
  const header = pageHeader(topic.title, {
    back: href('etopics'),
    subtitle: 'Английский язык',
    actions: linkButton(href('etopic-edit', topic.id), 'Изменить', { variant: 'ghost', iconName: 'edit' }),
  });
  return themed(trainer(topic, header, { store: 'topics', whole: 'Весь топик', partLabel: (n) => `${n}-й абзац` }));
}

/** Новый топик: сначала откуда взять текст, потом сверка. */
export function etopicAddScreen() {
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
        status.replaceChildren(h('div', { class: 'card stack' }, label, bar, h('p', { class: 'small muted' }, 'В первый раз загрузка дольше: скачивается словарь английского языка.')));
        const { recognizeImage } = await import('../ocr.js');
        const text = await recognizeImage(file, (share, what) => {
          bar.firstChild.style.width = `${Math.round(share * 100)}%`;
          label.textContent = what;
        });
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
    slot.replaceChildren(themed(checkForm({ ...src, onAgain: showChoice })));
    slot.querySelector('.page-title')?.focus({ preventScroll: true });
    scrollTo(0, 0);
  }
  function showChoice() {
    status.textContent = '';
    slot.replaceChildren(
      pageHeader('Новый топик', { back: href('etopics'), subtitle: 'Откуда взять текст?' }),
      choice('📷', 'Фото или картинка', 'Сфотографируй страницу или выбери картинку — текст распознается сам', () => photoInput.click()),
      choice('📄', 'Файл Word или .txt', 'Если топик прислали файлом', () => fileInput.click()),
      choice('⌨️', 'Вставить текст', 'Скопируй текст и вставь его сам', () => showCheck({ text: '' })),
      status,
      h('p', { class: 'small muted' }, 'Печатный текст распознаётся хорошо, написанный от руки — с ошибками: их нужно будет поправить. На iPhone можно выделить текст прямо на фото, скопировать и выбрать «Вставить текст».'),
      photoInput,
      fileInput,
    );
  }
  showChoice();
  return themed(slot);
}

export function etopicEditScreen(id) {
  const existing = getData().topics.custom.find((t) => t.id === id);
  if (!existing) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Такого топика нет', action: linkButton(href('etopics'), 'К топикам') }));
  return themed(checkForm({ existing, text: existing.text }));
}

/**
 * Сверка: картинка (если была) и текст по предложению на строку. Ребёнок правит и нажимает «Всё верно».
 * Картинка не сохраняется — живёт только пока открыт экран.
 */
function checkForm({ text: raw, image, existing, onAgain }) {
  const prepared = existing ? existing.text : toSentenceLines(raw);
  const title = h('input', { class: 'input', id: 'topic-title', maxLength: 120, value: existing?.title || guessTitle(prepared), placeholder: 'Например: My Family' });
  const text = h('textarea', { class: 'input poem-input', id: 'topic-text', rows: 14, maxLength: TOPIC_TEXT_MAX, value: prepared, lang: 'en', spellcheck: true, autocapitalize: 'sentences' });
  const errors = h('p', { class: 'field__error', role: 'alert' });
  let imageUrl = image ? URL.createObjectURL(image) : null;

  const save = () => {
    const data = { title: title.value.trim(), text: text.value.replace(/\r\n?/g, '\n').trim() };
    const errs = validateTopicInput(data);
    if (errs.length) {
      errors.textContent = errs.join(' ');
      return;
    }
    const topicId = existing?.id || uid('topic');
    update((d) => {
      const rec = { id: topicId, ...data, author: '', sourceId: '', createdAt: existing?.createdAt || Date.now() };
      d.topics.custom = existing ? d.topics.custom.map((t) => (t.id === topicId ? rec : t)) : [rec, ...d.topics.custom];
      return d;
    });
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    toast('Сохранено');
    navigate('etopic', topicId);
  };
  const remove = async () => {
    const ok = await confirmDialog('Удалить этот топик из браузера? Вернуть его будет нельзя.', { title: 'Удалить топик?', okText: 'Удалить', danger: true });
    if (!ok) return;
    update((d) => {
      d.topics.custom = d.topics.custom.filter((t) => t.id !== existing.id);
      delete d.topics.learned[existing.id];
      return d;
    });
    navigate('etopics');
  };

  return h(
    'div',
    { class: 'stack' },
    pageHeader(existing ? 'Изменить топик' : raw ? 'Проверь текст' : 'Вставь текст', {
      back: href('etopics'),
      subtitle: raw ? 'Сравни с оригиналом. Если где-то ошибка — исправь прямо в тексте.' : 'Текст сохранится только в этом браузере.',
    }),
    imageUrl
      ? h('details', { class: 'card etopic-image', open: true }, h('summary', {}, 'Оригинал (фото)'), h('img', { src: imageUrl, alt: 'Фото топика' }))
      : null,
    h(
      'form',
      { class: 'card stack', onsubmit: (e) => (e.preventDefault(), save()) },
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'topic-title' }, 'Название'), title),
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field__label', for: 'topic-text' }, 'Текст'),
        text,
        h('p', { class: 'field__hint' }, 'Каждое предложение — с новой строки, между абзацами — пустая строка.'),
        button('Разложить по предложениям', () => (text.value = toSentenceLines(text.value)), { variant: 'ghost' }),
      ),
      errors,
      h(
        'div',
        { class: 'row wrap' },
        button(existing ? 'Сохранить' : 'Всё верно, учить', null, { type: 'submit', iconName: 'check', size: 'lg' }),
        onAgain ? button('Выбрать другой', () => (imageUrl && URL.revokeObjectURL(imageUrl), (imageUrl = null), onAgain()), { variant: 'secondary' }) : null,
        existing ? button('Удалить', remove, { variant: 'danger', iconName: 'trash' }) : null,
      ),
    ),
  );
}
