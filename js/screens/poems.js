// «Учим стихи»: список стихов из учебника и своих, тренажёр с закрыванием слов, своё стихотворение.
import { h, button, linkButton, pageHeader, emptyState, toast, confirmDialog } from '../ui.js';
import { href, navigate } from '../router.js';
import { getData, update } from '../state.js';
import { loadPoemCatalog } from '../data.js';
import { parsePoem, stepCount, lineAt, validatePoemInput, POEM_TEXT_MAX, CUSTOM_POEMS_LIMIT } from '../poem.js';
import { uid, formatDate } from '../utils.js';

const PEEK_MS = 2000;

/** Экран загружает список асинхронно: сначала заглушка, потом содержимое. */
function later(build) {
  const slot = h('div', { class: 'stack' }, h('p', { class: 'muted', role: 'status' }, 'Загружаем стихи…'));
  loadPoemCatalog().then((cat) => {
    slot.replaceChildren(build(cat));
    const title = slot.querySelector('.page-title');
    if (title) document.title = `${title.textContent.replace(/^[^\p{L}«]+/u, '')} — Контролька`; // без эмодзи в начале
    title?.focus({ preventScroll: true });
  });
  return slot;
}

/** Стих по id: из учебника (с текстом или с текстом, который вставил ребёнок) или свой. */
function findPoem(cat, id) {
  const custom = getData().poems.custom;
  const own = custom.find((p) => p.id === id);
  if (own) return { ...own, own: true };
  const book = cat.poems.find((p) => p.id === id);
  if (!book) return null;
  if (book.pasteOnly) {
    const pasted = custom.find((p) => p.sourceId === id);
    return pasted ? { ...book, text: pasted.text, pastedId: pasted.id } : { ...book, text: '' };
  }
  return book;
}

function poemRow(p, learned) {
  const where = p.page ? `часть ${p.part}, с. ${p.page}` : 'своё';
  return h(
    'a',
    { class: `card poem-card${learned ? ' poem-card--learned' : ''}`, href: href('poem', p.id) },
    h('span', { class: 'poem-card__title' }, p.title),
    h('span', { class: 'small muted' }, [p.author, where].filter(Boolean).join(' · ')),
    learned ? h('span', { class: 'status-pill status-pill--mastered' }, h('span', {}, 'рассказал без подсказок')) : null,
    p.needsText ? h('span', { class: 'status-pill' }, h('span', {}, 'текст вставишь сам')) : null,
  );
}

export function poemsScreen() {
  return later((cat) => {
    const { custom, learned } = getData().poems;
    const pasted = new Set(custom.map((p) => p.sourceId).filter(Boolean));
    const book = cat.poems.map((p) => ({ ...p, needsText: p.pasteOnly && !pasted.has(p.id) }));
    const own = custom.filter((p) => !p.sourceId);
    return h(
      'div',
      { class: 'stack poems-page' },
      pageHeader('📜 Учим стихи', { back: href('home'), subtitle: 'Прочитай целиком, потом закрывай слова по одному — и расскажи без подсказок.' }),
      cat.error ? h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Список стихов не загрузился', text: 'Обнови страницу. Свои стихи ниже работают.' })) : null,
      book.length
        ? h(
            'section',
            { class: 'stack' },
            h('h2', {}, 'Из учебника «Литературное чтение. 4 класс»'),
            h('div', { class: 'grid grid--2' }, book.map((p) => poemRow(p, learned[p.id]))),
          )
        : null,
      h(
        'section',
        { class: 'stack' },
        h('div', { class: 'section-head' }, h('h2', {}, 'Свои стихи'), own.length < CUSTOM_POEMS_LIMIT ? linkButton(href('poem-edit', 'new'), 'Добавить', { variant: 'secondary' }) : null),
        own.length
          ? h('div', { class: 'grid grid--2' }, own.map((p) => poemRow(p, learned[p.id])))
          : h('p', { class: 'muted' }, 'Задали стихотворение, которого нет в списке? Вставь его текст — он сохранится только в этом браузере.'),
      ),
    );
  });
}

export function poemScreen(id) {
  return later((cat) => {
    const poem = findPoem(cat, id);
    if (!poem) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Такого стихотворения нет', action: linkButton(href('poems'), 'К стихам') }));
    const header = pageHeader(poem.title, {
      back: href('poems'),
      subtitle: [poem.author, poem.page ? `«Литературное чтение», часть ${poem.part}, с. ${poem.page}` : ''].filter(Boolean).join(' · '),
      actions: poem.own || poem.pastedId ? linkButton(href('poem-edit', poem.pastedId || poem.id), 'Изменить', { variant: 'ghost', iconName: 'edit' }) : null,
    });
    if (!poem.text) {
      return h(
        'div',
        { class: 'stack' },
        header,
        h(
          'div',
          { class: 'card' },
          emptyState({
            emoji: '📖',
            title: 'Текст вставишь сам',
            text: `Открой учебник: часть ${poem.part}, страница ${poem.page}. Перепиши или вставь текст — он сохранится только в этом браузере.`,
            action: linkButton(href('poem-edit', `for-${poem.id}`), 'Вставить текст'),
          }),
        ),
      );
    }
    return trainer(poem, header);
  });
}

function trainer(poem, header) {
  const stanzas = parsePoem(poem.text);
  let part = 'all'; // 'all' или номер строфы
  let step = 0;
  const textBox = h('div', { class: 'card poem-text', 'aria-live': 'polite' });
  const stepInfo = h('p', { class: 'small muted' });
  const moreBtn = button('Закрыть ещё', () => go(step + 1), { iconName: 'arrow', size: 'lg' });
  const backBtn = button('Открыть обратно', () => go(step - 1), { variant: 'secondary' });
  const doneBox = h('div', { class: 'poem-done' });

  const currentLines = () => (part === 'all' ? stanzas.flat() : stanzas[part]);
  const renderText = () => {
    const lines = currentLines();
    const shown = part === 'all' ? stanzas : [stanzas[part]];
    textBox.textContent = '';
    for (const stanza of shown) {
      textBox.appendChild(
        h(
          'div',
          { class: 'poem-stanza' },
          stanza.map((words) =>
            h(
              'p',
              { class: 'poem-line' },
              lineAt(words, step, lines).map((w) => [
                w.hidden ? gap(w) : h('span', { class: 'poem-word' }, w.text),
                ' ',
              ]),
            ),
          ),
        ),
      );
    }
    const total = stepCount(lines) - 1;
    stepInfo.textContent = step === 0 ? 'Прочитай целиком, потом нажми «Закрыть ещё».' : step >= total ? 'Всё закрыто — расскажи наизусть!' : `Закрыто шагов: ${step} из ${total}. Нажми на полоску, чтобы подсмотреть слово.`;
    moreBtn.disabled = step >= total;
    backBtn.disabled = step === 0;
    doneBox.hidden = step < total;
  };
  const go = (s) => {
    step = Math.max(0, Math.min(s, stepCount(currentLines()) - 1));
    renderText();
  };

  const partOptions = [['all', 'Всё стихотворение'], ...stanzas.map((_, i) => [i, `${i + 1}-я строфа`])];
  const parts =
    stanzas.length > 6
      ? // Много строф (как в «Руси») — выпадающий список вместо ряда кнопок.
        h(
          'div',
          { class: 'field' },
          h('label', { class: 'field__label', for: 'poem-part' }, 'Что учим'),
          h(
            'select',
            { class: 'input', id: 'poem-part', onchange: (e) => ((part = e.target.value === 'all' ? 'all' : Number(e.target.value)), go(0)) },
            partOptions.map(([v, label]) => h('option', { value: v }, label)),
          ),
        )
      : stanzas.length > 1
      ? h(
          'div',
          { class: 'segmented segmented--chips' },
          h(
            'div',
            { class: 'segmented__options', role: 'radiogroup', 'aria-label': 'Что учим' },
            partOptions.map(([v, label]) =>
              h(
                'label',
                { class: 'segmented__option' },
                h('input', { type: 'radio', name: 'poem-part', checked: v === 'all', onchange: () => ((part = v), go(0)) }),
                h('span', {}, label),
              ),
            ),
          ),
        )
      : null;

  doneBox.append(
    button('Рассказал без подсказок', () => {
      update((d) => ((d.poems.learned[poem.id] = Date.now()), d));
      toast('Отлично! Отметка сохранена 🎉');
    }, { iconName: 'check', size: 'lg' }),
    button('Начать сначала', () => go(0), { variant: 'ghost' }),
  );
  const learnedAt = getData().poems.learned[poem.id];
  renderText();
  return h(
    'div',
    { class: 'stack poem-page' },
    header,
    learnedAt ? h('p', { class: 'status-pill status-pill--mastered' }, h('span', {}, `Рассказал без подсказок ${formatDate(learnedAt)}`)) : null,
    parts,
    textBox,
    stepInfo,
    h('div', { class: 'poem-controls' }, moreBtn, backBtn),
    doneBox,
  );
}

/** Закрытое слово: полоска той же длины; нажатие показывает слово на 2 секунды. */
function gap(w) {
  // Средняя буква Nunito уже, чем «ch» (ширина нуля), — 0.55em ближе к длине настоящего слова.
  const width = `${(Math.max(2, w.text.length - w.hint.length) * 0.55).toFixed(2)}em`;
  const bar = h('span', { class: 'poem-gap__bar', style: { width } });
  const el = h(
    'button',
    {
      type: 'button',
      class: 'poem-gap',
      'aria-label': 'Подсмотреть слово',
      onclick: () => {
        el.replaceChildren(h('span', { class: 'poem-gap__peek' }, w.text));
        setTimeout(() => el.isConnected && el.replaceChildren(...(w.hint ? [w.hint] : []), bar), PEEK_MS);
      },
    },
    w.hint || null,
    bar,
  );
  return el;
}

/** Своё стихотворение или текст к стиху из списка (id = 'new', 'for-<id из списка>' или id своего). */
export function poemEditScreen(id) {
  return later((cat) => {
    const custom = getData().poems.custom;
    const existing = custom.find((p) => p.id === id);
    const forBook = id.startsWith('for-') ? cat.poems.find((p) => p.id === id.slice(4) && p.pasteOnly) : null;
    const source = existing?.sourceId ? cat.poems.find((p) => p.id === existing.sourceId) : forBook;
    if (id !== 'new' && !existing && !forBook) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Не найдено', action: linkButton(href('poems'), 'К стихам') }));

    const title = h('input', { class: 'input', id: 'poem-title', maxLength: 120, value: existing?.title || source?.title || '', readOnly: Boolean(source) });
    const author = h('input', { class: 'input', id: 'poem-author', maxLength: 120, value: existing?.author || source?.author || '', readOnly: Boolean(source) });
    const text = h('textarea', { class: 'input poem-input', id: 'poem-text', rows: 12, maxLength: POEM_TEXT_MAX, value: existing?.text || '' });
    const errors = h('p', { class: 'field__error', role: 'alert' });

    const save = () => {
      const data = { title: title.value.trim(), author: author.value.trim(), text: text.value.replace(/\r\n?/g, '\n').trim() };
      const errs = validatePoemInput(data);
      if (errs.length) {
        errors.textContent = errs.join(' ');
        return;
      }
      const poemId = existing?.id || uid('poem');
      update((d) => {
        const rec = { id: poemId, ...data, sourceId: source?.id || '', createdAt: existing?.createdAt || Date.now() };
        d.poems.custom = existing ? d.poems.custom.map((p) => (p.id === poemId ? rec : p)) : [rec, ...d.poems.custom];
        return d;
      });
      toast('Сохранено');
      navigate('poem', source?.id || poemId);
    };
    const remove = async () => {
      const ok = await confirmDialog('Удалить этот текст из браузера? Вернуть его будет нельзя.', { title: 'Удалить стихотворение?', okText: 'Удалить', danger: true });
      if (!ok) return;
      update((d) => {
        d.poems.custom = d.poems.custom.filter((p) => p.id !== existing.id);
        delete d.poems.learned[existing.id];
        return d;
      });
      navigate('poems');
    };

    return h(
      'div',
      { class: 'stack' },
      pageHeader(existing ? 'Изменить стихотворение' : source ? 'Вставить текст' : 'Своё стихотворение', { back: href('poems'), subtitle: source ? `Учебник: часть ${source.part}, с. ${source.page}` : 'Текст сохранится только в этом браузере.' }),
      h(
        'form',
        { class: 'card stack', onsubmit: (e) => (e.preventDefault(), save()) },
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'poem-title' }, 'Название'), title),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'poem-author' }, 'Автор (можно не писать)'), author),
        h(
          'div',
          { class: 'field' },
          h('label', { class: 'field__label', for: 'poem-text' }, 'Текст'),
          text,
          h('p', { class: 'field__hint' }, 'Каждая строка — с новой строки, между строфами — пустая строка.'),
        ),
        errors,
        h('div', { class: 'row wrap' }, button('Сохранить', null, { type: 'submit', iconName: 'check', size: 'lg' }), existing ? button('Удалить', remove, { variant: 'danger', iconName: 'trash' }) : null),
      ),
    );
  });
}
