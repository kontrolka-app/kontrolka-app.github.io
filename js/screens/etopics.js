// «Учим топики» (английский): список, добавление (фото, файл или вставка → сверка) и тренажёр как у стихов.
import { h, button, linkButton, pageHeader, emptyState, toast, confirmDialog } from '../ui.js';
import { href, navigate } from '../router.js';
import { getData, update, content } from '../state.js';
import { CUSTOM_POEMS_LIMIT } from '../poem.js';
import { toSentenceLines, guessTitle, validateTopicInput, TOPIC_TEXT_MAX } from '../topic.js';
import { sourcePicker, originalImage } from './textsource.js';
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
  return themed(sourcePicker({
    header: () => pageHeader('Новый топик', { back: href('etopics'), subtitle: 'Откуда взять текст?' }),
    lang: 'eng',
    langNote: 'В первый раз загрузка дольше: скачивается словарь английского языка.',
    fileHint: 'Если топик прислали файлом',
    hint: 'Печатный текст распознаётся хорошо, написанный от руки — с ошибками: их нужно будет поправить. На iPhone можно выделить текст прямо на фото, скопировать и выбрать «Вставить текст».',
    check: (src, onAgain) => themed(checkForm({ ...src, onAgain })),
  }));
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
    imageUrl ? originalImage(imageUrl, 'Фото топика') : null,
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
