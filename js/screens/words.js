// Английский: страница предмета и «Слова по юнитам» — карточки, выбор перевода, написание слова.
import { h, button, linkButton, pageHeader, emptyState, icon } from '../ui.js';
import { href } from '../router.js';
import { getData, update, content } from '../state.js';
import { loadWordList } from '../data.js';
import { subjectVars } from '../components.js';
import { findBook, bookWords, unitWords, unitName, resultKey, wordsForMode, WRITE_MODES, chooseOptions, checkSpelling, createRound, answerRound, roundDone, roundScore, recordResult, shuffle } from '../words.js';
import { plural } from '../utils.js';

const MODES = {
  cards: { title: 'Карточки', emoji: '🃏', text: 'Смотришь слово, вспоминаешь перевод и переворачиваешь карточку' },
  choose: { title: 'Выбери перевод', emoji: '👆', text: 'Английское слово и четыре варианта перевода' },
  write: { title: 'Напиши по-английски', emoji: '✍️', text: 'Русский перевод — пишешь слово сам' },
  listen: { title: 'Диктант на слух', emoji: '🎧', text: 'Слушаешь слово и пишешь его по-английски', voice: true },
};

const canSpeak = () => 'speechSynthesis' in window;

/** Цвет предмета «Английский язык» — как у страниц других предметов. */
function themed(el) {
  el.classList.add('subject-themed', 'etopics-page');
  for (const [k, v] of Object.entries(subjectVars(content.subjectById.get('english')) || {})) el.style.setProperty(k, v);
  return el;
}

const linkCard = (to, emoji, title, text, extra = null) =>
  h('a', { class: 'card poems-link', href: to }, h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, emoji), h('span', { class: 'subject-card__text' }, h('span', { class: 'subject-card__name' }, title), h('span', { class: 'small muted' }, text), extra), icon('arrow'));

/** Список грузится асинхронно: сначала заглушка, потом экран. */
function later(build) {
  const slot = h('div', { class: 'stack' }, h('p', { class: 'muted', role: 'status' }, 'Загружаем слова…'));
  loadWordList().then((list) => {
    if (list.error) {
      slot.replaceChildren(h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Слова не загрузились', text: 'Обнови страницу.', action: linkButton(href('english'), 'Назад') })));
      return;
    }
    const view = build(list);
    slot.replaceChildren(view);
    const title = view.querySelector('.page-title');
    if (title) document.title = `${title.textContent.replace(/^[^\p{L}«]+/u, '')} — Контролька`;
    title?.focus({ preventScroll: true });
  });
  return slot;
}

/** Произнести слово голосом браузера: британский голос, если есть, иначе любой английский. Вызывать из нажатия. */
function speak(text) {
  if (!canSpeak()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  u.voice = voices.find((v) => v.lang.replace('_', '-') === 'en-GB') || voices.find((v) => v.lang.startsWith('en')) || null;
  u.lang = u.voice?.lang || 'en-GB';
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

/** Кнопка «послушать» рядом со словом (если браузер умеет говорить). */
function sayButton(text) {
  if (!canSpeak()) return null;
  return h('button', { type: 'button', class: 'btn btn--ghost btn--icon word-say', 'aria-label': `Послушать: ${text}`, onclick: () => speak(text) }, '🔊');
}

export function englishScreen() {
  return themed(
    h(
      'div',
      { class: 'stack' },
      pageHeader('🔤 Английский язык', { back: href('subjects'), subtitle: 'English World 3 и Spotlight 4' }),
      linkCard(href('words'), '📒', 'Слова по юнитам', 'Слова из словарей учебников: карточки, перевод, написание'),
      linkCard(href('topics', 'english'), '🧩', 'Грамматика', 'Правила и задания: юниты English World 3 и модули Spotlight 4'),
      linkCard(href('etopics'), '📸', 'Учим топики', 'Загрузи свой топик и расскажи наизусть'),
    ),
  );
}

const resultText = (r) => (r ? `${r.best}%` : '—');
const wordsCount = (n) => `${n} ${plural(n, ['слово', 'слова', 'слов'])}`;
const BOOK_NOTES = { ew3: 'основной учебник', sp4: 'задания из него иногда даёт учитель' };

/** Юнит (модуль) и слова по адресу; null — нет такого. */
function findUnit(list, bookId, n) {
  const book = findBook(list, bookId);
  const unit = book?.units.find((u) => u.n === Number(n));
  return unit ? { book, unit, words: unitWords(list, book.id, unit.n) } : null;
}

export function wordsScreen() {
  return later((list) => {
    const results = getData().words.results;
    return themed(
      h(
        'div',
        { class: 'stack' },
        pageHeader('📒 Слова по юнитам', { back: href('english'), subtitle: 'Слова из словарей в конце учебников (Word list). Выбери юнит или модуль.' }),
        ...list.books.map((book) =>
          h(
            'section',
            { class: 'stack' },
            h('h2', {}, book.title, BOOK_NOTES[book.id] ? h('span', { class: 'small muted' }, ` · ${BOOK_NOTES[book.id]}`) : null),
            h(
              'div',
              { class: 'grid grid--2' },
              book.units.map((u) => {
                const r = (mode) => results[resultKey(book.id, u.n, mode)];
                return h(
                  'a',
                  { class: `card poem-card${r('write')?.best === 100 ? ' poem-card--learned' : ''}`, href: href('words-unit', book.id, u.n) },
                  h('span', { class: 'poem-card__title' }, unitName(book, u)),
                  h('span', { class: 'small muted' }, `${u.ru} · ${wordsCount(unitWords(list, book.id, u.n).length)}`),
                  r('choose') || r('write') ? h('span', { class: 'small muted' }, `Перевод: ${resultText(r('choose'))} · Написание: ${resultText(r('write'))}`) : null,
                );
              }),
            ),
          ),
        ),
        h('p', { class: 'small muted' }, 'Переводы составлены для «Контрольки» и ещё не проверены учителем. Нашёл ошибку — скажи взрослому.'),
      ),
    );
  });
}

export function wordsUnitScreen(bookId, n) {
  return later((list) => {
    const found = findUnit(list, bookId, n);
    if (!found) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Такого юнита нет', action: linkButton(href('words'), 'К юнитам') }));
    const { book, unit, words } = found;
    const results = getData().words.results;
    const hasPassive = words.some((w) => w.passive);
    return themed(
      h(
        'div',
        { class: 'stack' },
        pageHeader(unitName(book, unit), { back: href('words'), subtitle: `${book.title} · ${unit.ru} · ${wordsCount(words.length)}` }),
        ...Object.entries(MODES)
          .filter(([mode, m]) => (!m.voice || canSpeak()) && wordsForMode(words, mode).length)
          .map(([mode, m]) => {
            const r = results[resultKey(book.id, unit.n, mode)];
            const n = wordsForMode(words, mode).length;
            const text = WRITE_MODES.has(mode) && n < words.length ? `${m.text}. Без слов «узнавать»: ${wordsCount(n)}` : m.text;
            return linkCard(href('words-train', book.id, unit.n, mode), m.emoji, m.title, text, r ? h('span', { class: 'small' }, `Лучший результат: ${r.best}% · последний: ${r.last}%`) : null);
          }),
        h(
          'details',
          { class: 'card' },
          h('summary', { class: 'word-list__summary' }, 'Все слова'),
          hasPassive ? h('p', { class: 'small muted' }, '«узнавать» — в учебнике слово выделено цветом: его нужно понимать, а писать самому не обязательно.') : null,
          h(
            'ul',
            { class: 'word-list' },
            words.map((w) => h('li', {}, h('span', { class: 'word-list__en', lang: 'en' }, w.en), sayButton(w.en), h('span', { class: 'muted' }, w.ru), w.passive ? h('span', { class: 'chip' }, 'узнавать') : null)),
          ),
        ),
      ),
    );
  });
}

export function wordsTrainScreen(bookId, n, mode) {
  return later((list) => {
    const found = findUnit(list, bookId, n);
    if (!found || !MODES[mode] || (MODES[mode].voice && !canSpeak())) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Не найдено', action: linkButton(href('words'), 'К юнитам') }));
    const { book, unit } = found;
    const words = wordsForMode(found.words, mode);
    const header = pageHeader(MODES[mode].title, { back: href('words-unit', book.id, unit.n), subtitle: `${book.title} · ${unitName(book, unit)}` });
    const body = h('div', { class: 'stack' });
    const view = themed(h('div', { class: 'stack words-page' }, header, body));
    if (mode === 'cards') cards(body, words, book, unit);
    else quiz(body, words, bookWords(list, book.id), book, unit, mode);
    return view;
  });
}

const progress = (done, total) =>
  h('div', { class: 'stack stack--tight' }, h('p', { class: 'small muted' }, `${Math.min(done + 1, total)} из ${total}`), h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: { width: `${Math.round((done / total) * 100)}%` } })));

/** Карточки: без оценки. «Ещё учу» — карточка вернётся в конец. */
function cards(body, words, book, unit) {
  let ruFirst = false;
  let queue = shuffle(words).map((w) => w.id);
  let pos = 0;
  let learnedCount = 0;
  const byId = new Map(words.map((w) => [w.id, w]));
  const toggle = h(
    'label',
    { class: 'row small word-toggle' },
    h('input', { type: 'checkbox', onchange: (e) => ((ruFirst = e.target.checked), show()) }),
    h('span', {}, 'Сначала русское слово'),
  );
  const show = () => {
    if (pos >= queue.length) {
      body.replaceChildren(
        h('div', { class: 'card' }, emptyState({ emoji: '🎉', title: 'Все карточки пройдены!', text: 'Теперь проверь себя: выбери перевод или напиши слова.', action: linkButton(href('words-train', book.id, unit.n, 'choose'), 'Выбери перевод') })),
        button('Ещё раз', () => ((queue = shuffle(words).map((w) => w.id)), (pos = 0), (learnedCount = 0), show()), { variant: 'secondary' }),
      );
      return;
    }
    const w = byId.get(queue[pos]);
    const front = ruFirst ? h('p', { class: 'word-card__ru' }, w.ru) : h('p', { class: 'word-card__en', lang: 'en' }, w.en);
    const back = ruFirst ? h('p', { class: 'word-card__en', lang: 'en' }, w.en) : h('p', { class: 'word-card__ru' }, w.ru);
    const actions = h('div', { class: 'poem-controls' });
    const card = h('div', { class: 'card word-card', 'aria-live': 'polite' }, front, ruFirst ? null : sayButton(w.en));
    const flip = button('Перевернуть', () => {
      card.append(...[h('hr', { class: 'word-card__line' }), back, ruFirst ? sayButton(w.en) : null].filter(Boolean)); // append пишет null как текст
      actions.replaceChildren(
        button('Знаю', () => ((learnedCount += 1), (pos += 1), show()), { iconName: 'check', size: 'lg' }),
        button('Ещё учу', () => (queue.push(w.id), (pos += 1), show()), { variant: 'secondary', size: 'lg' }),
      );
    }, { size: 'lg' });
    actions.append(flip);
    body.replaceChildren(toggle, progress(learnedCount, words.length), card, actions);
    flip.focus({ preventScroll: true });
  };
  show();
}

/** «Выбери перевод», «Напиши по-английски» и «Диктант на слух»: ошибка — слово ещё раз в конце, счёт по первой попытке. */
function quiz(body, words, bookAll, book, unit, mode) {
  let round = createRound(words);
  const byId = new Map(words.map((w) => [w.id, w]));

  // В диктанте слово звучит само со второго слова: «Дальше» — это нажатие, телефон разрешает говорить.
  // Первое слово — по кнопке: без нажатия iPhone голос не включает.
  const next = (autoplay = false) => {
    if (roundDone(round)) return finish();
    const w = byId.get(round.queue[round.pos]);
    const feedback = h('div', { class: 'stack', 'aria-live': 'polite' });
    const nextBtn = button('Дальше', () => next(true), { iconName: 'arrow', size: 'lg' });
    const answered = (ok, shownAnswer) => {
      round = answerRound(round, w.id, ok);
      feedback.replaceChildren(
        h(
          'div',
          { class: `feedback ${ok ? 'feedback--ok' : 'feedback--bad'}`, role: 'status' },
          h('p', { class: 'feedback__title' }, icon(ok ? 'check' : 'cross'), h('span', {}, ok ? 'Верно!' : 'Неверно')),
          ok ? null : h('p', {}, 'Правильно: ', h('strong', { lang: WRITE_MODES.has(mode) ? 'en' : null }, shownAnswer), WRITE_MODES.has(mode) ? sayButton(w.en) : null),
          ok ? null : h('p', { class: 'small muted' }, 'Это слово будет ещё раз в конце.'),
        ),
        nextBtn,
      );
      nextBtn.focus({ preventScroll: true });
    };

    let task;
    if (mode === 'choose') {
      const opts = chooseOptions(w, words, bookAll);
      const buttons = opts.map((o, i) =>
        h(
          'button',
          {
            type: 'button',
            class: 'option word-option',
            onclick: () => {
              buttons.forEach((b, j) => {
                b.disabled = true;
                if (opts[j].id === w.id) b.classList.add('is-correct');
              });
              if (o.id !== w.id) buttons[i].classList.add('is-wrong');
              answered(o.id === w.id, w.ru);
            },
          },
          h('span', { class: 'option__key', 'aria-hidden': 'true' }, String.fromCharCode(1040 + i)),
          h('span', { class: 'option__text' }, o.ru),
        ),
      );
      task = h(
        'div',
        { class: 'stack' },
        h('div', { class: 'card word-card' }, h('p', { class: 'word-card__en', lang: 'en' }, w.en), sayButton(w.en)),
        h('div', { class: 'options' }, buttons),
      );
    } else {
      const input = h('input', { class: 'input word-input', id: 'word-answer', lang: 'en', autocomplete: 'off', autocapitalize: 'none', spellcheck: false, autocorrect: 'off', maxLength: 60 });
      const error = h('p', { class: 'field__error', role: 'alert' });
      const form = h(
        'form',
        {
          class: 'stack',
          onsubmit: (e) => {
            e.preventDefault();
            if (input.disabled) return;
            if (!input.value.trim()) return (error.textContent = 'Напиши слово.');
            error.textContent = '';
            input.disabled = true;
            check.disabled = true;
            answered(checkSpelling(w, input.value), w.en);
          },
        },
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'word-answer' }, mode === 'listen' ? 'Напиши, что услышал' : 'Как это по-английски?'), input, error),
      );
      const check = button('Проверить', null, { type: 'submit', iconName: 'check', size: 'lg' });
      form.append(check);
      const prompt =
        mode === 'listen'
          ? h(
              'div',
              { class: 'card word-card' },
              button(autoplay ? 'Послушать ещё раз' : 'Послушать слово', () => (speak(w.en), input.focus({ preventScroll: true })), { size: 'lg', variant: autoplay ? 'secondary' : 'primary' }),
              // Перевод снимает путаницу одинаково звучащих слов (son — sun, hare — hair).
              h('p', { class: 'small muted' }, `Подсказка: ${w.ru}`),
            )
          : h('div', { class: 'card word-card' }, h('p', { class: 'word-card__ru' }, w.ru));
      task = h('div', { class: 'stack' }, prompt, form);
      if (mode === 'listen' && autoplay) speak(w.en);
      setTimeout(() => input.focus({ preventScroll: true }), 0);
    }
    body.replaceChildren(progress(round.pos, round.queue.length), task, feedback);
  };

  const finish = () => {
    const score = roundScore(round);
    update((d) => ((d.words = recordResult(d.words, book.id, unit.n, mode, score)), d));
    const missed = round.wrong.map((id) => byId.get(id));
    body.replaceChildren(
      h(
        'div',
        { class: 'card' },
        emptyState({
          emoji: score.correct === score.total ? '🏆' : '💪',
          title: `С первого раза: ${score.correct} из ${score.total}`,
          text: score.correct === score.total ? 'Ни одной ошибки!' : 'Слова с ошибками — ниже. Повтори их и попробуй ещё раз.',
        }),
      ),
      missed.length
        ? h('section', { class: 'card' }, h('h2', { class: 'card__title' }, 'Повтори'), h('ul', { class: 'word-list' }, missed.map((w) => h('li', {}, h('span', { class: 'word-list__en', lang: 'en' }, w.en), sayButton(w.en), h('span', { class: 'muted' }, w.ru)))))
        : null,
      h('div', { class: 'row wrap' }, button('Ещё раз', () => ((round = createRound(words)), next(true)), { iconName: 'arrow', size: 'lg' }), linkButton(href('words-unit', book.id, unit.n), 'Назад к словам', { variant: 'secondary' })),
    );
  };
  next();
}
