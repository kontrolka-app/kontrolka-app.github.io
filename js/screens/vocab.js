// «Словарные слова» (русский): 16 групп из листа учителя и режимы тренировки.
import { h, button, linkButton, pageHeader, emptyState, icon } from '../ui.js';
import { href } from '../router.js';
import { getData, update, content } from '../state.js';
import { loadVocab } from '../data.js';
import { subjectVars } from '../components.js';
import { shuffle, createRound, answerRound, roundDone, roundScore } from '../words.js';
import {
  findGroup, plain, parts, gapped, checkWord, spellingOptions, createAlphabet, tapAlphabet, alphabetDone, alphabetScore,
  modeWords, recordVocab, vocabKey, groupProgress, POS_LABELS,
} from '../vocab.js';
import { plural } from '../utils.js';

const MODES = {
  cards: { title: 'Карточки', emoji: '🃏', text: 'Слово с пропусками — вспомни буквы и проверь себя' },
  gaps: { title: 'Вставь буквы', emoji: '✏️', text: 'Слово с пропусками — напиши его целиком' },
  choose: { title: 'Выбери верное написание', emoji: '👆', text: 'Одно слово написано верно, остальные — с ошибками' },
  dictation: { title: 'Диктант на слух', emoji: '🎧', text: 'Слушаешь слово и пишешь его сам — как в школе' },
  alphabet: { title: 'По алфавиту', emoji: '🔤', text: 'Нажимай слова группы по алфавиту' },
  pos: { title: 'Часть речи', emoji: '🏷️', text: 'Определи, какая это часть речи' },
};

/** Цвет предмета «Русский язык». */
function themed(el) {
  el.classList.add('subject-themed');
  for (const [k, v] of Object.entries(subjectVars(content.subjectById.get('russian')) || {})) el.style.setProperty(k, v);
  return el;
}

const linkCard = (to, emoji, title, text, extra = null) =>
  h('a', { class: 'card poems-link', href: to }, h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, emoji), h('span', { class: 'subject-card__text' }, h('span', { class: 'subject-card__name' }, title), h('span', { class: 'small muted' }, text), extra), icon('arrow'));

/** Ссылка на тренажёр — со страницы предмета и из старой темы. */
export const vocabLinkCard = () => linkCard(href('vocab'), '📗', 'Словарные слова по группам', '16 групп из словарика класса: вставь буквы, диктант на слух, алфавит');

/** Список грузится асинхронно: сначала заглушка, потом экран. */
function later(build) {
  const slot = h('div', { class: 'stack' }, h('p', { class: 'muted', role: 'status' }, 'Загружаем слова…'));
  loadVocab().then((list) => {
    if (list.error) {
      slot.replaceChildren(h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Слова не загрузились', text: 'Обнови страницу.', action: linkButton(href('topics', 'russian'), 'Назад') })));
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

/** Слово, трудные места подсвечены. */
function marked(w, cls = 'vocab-word') {
  return h(
    'span',
    { class: cls },
    parts(w).map((p) => (p.hard ? h('mark', { class: `vocab-hard${p.text === ' ' ? ' vocab-hard--space' : ''}` }, p.text === ' ' ? ' ' : p.text) : p.text)),
  );
}

// ——— Озвучка ———
// Есть готовые записи (list.audio — папка с файлами <id>.mp3) — играем их; нет — голос браузера.
let player = null;
function canSpeak(list) {
  return Boolean(list.audio) || 'speechSynthesis' in window;
}
function speak(list, w) {
  const viaBrowser = () => {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain(w));
    u.lang = 'ru-RU';
    u.rate = 0.8;
    speechSynthesis.speak(u);
  };
  if (!list.audio) return viaBrowser();
  player ??= new Audio();
  player.pause();
  player.src = `${list.audio}/${w.id}.mp3`;
  player.play().catch(viaBrowser);
}
const sayButton = (list, w, label = 'Послушать') =>
  canSpeak(list) ? h('button', { type: 'button', class: 'btn btn--ghost btn--icon word-say', 'aria-label': `${label}: ${plain(w)}`, onclick: () => speak(list, w) }, '🔊') : null;

const wordsCount = (n) => `${n} ${plural(n, ['слово', 'слова', 'слов'])}`;
const availableModes = (list, group) => Object.keys(MODES).filter((m) => (m !== 'dictation' || canSpeak(list)) && modeWords(group, m).length >= 2);

// ——— Экраны ———

export function vocabScreen() {
  return later((list) => {
    const vocab = getData().vocab;
    return themed(
      h(
        'div',
        { class: 'stack' },
        pageHeader('📗 Словарные слова', { back: href('topics', 'russian'), subtitle: '16 групп из словарика класса — готовимся к словарному диктанту. Выбери группу.' }),
        h(
          'div',
          { class: 'grid grid--2' },
          list.groups.map((g) => {
            const p = groupProgress(vocab, g.n);
            const done = p.perfect === p.total;
            return h(
              'a',
              { class: `card poem-card${done ? ' poem-card--learned' : ''}`, href: href('vocab-group', g.n) },
              h('span', { class: 'poem-card__title' }, `Группа ${g.n}`),
              h('span', { class: 'small muted' }, g.words.slice(0, 3).map(plain).join(', ') + '…'),
              h('span', { class: 'small muted' }, p.tried ? `Без ошибок: ${p.perfect} из ${p.total} заданий` : wordsCount(g.words.length)),
            );
          }),
        ),
        h('p', { class: 'small muted' }, 'Слова — из словарика класса. Трудные места отмечены для «Контрольки». Нашёл ошибку — скажи взрослому.'),
        list.voice ? h('p', { class: 'small muted' }, `Слова для диктанта озвучены синтезатором речи: ${list.voice}.`) : null,
      ),
    );
  });
}

export function vocabGroupScreen(n) {
  return later((list) => {
    const group = findGroup(list, Number(n));
    if (!group) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Такой группы нет', action: linkButton(href('vocab'), 'К группам') }));
    const results = getData().vocab.results;
    return themed(
      h(
        'div',
        { class: 'stack' },
        pageHeader(`Группа ${group.n}`, { back: href('vocab'), subtitle: `Словарные слова · ${wordsCount(group.words.length)}` }),
        h(
          'details',
          { class: 'card', open: true },
          h('summary', { class: 'word-list__summary' }, 'Слова группы'),
          h('p', { class: 'small muted' }, 'Цветом выделены трудные места — их нужно запомнить.'),
          h('ul', { class: 'word-list' }, group.words.map((w) => h('li', {}, marked(w, 'word-list__en'), sayButton(list, w)))),
        ),
        ...availableModes(list, group).map((mode) => {
          const m = MODES[mode];
          const r = results[vocabKey(group.n, mode)];
          return linkCard(href('vocab-train', group.n, mode), m.emoji, m.title, m.text, r ? h('span', { class: 'small' }, `Лучший результат: ${r.best}% · последний: ${r.last}%`) : null);
        }),
      ),
    );
  });
}

export function vocabTrainScreen(n, mode) {
  return later((list) => {
    const group = findGroup(list, Number(n));
    if (!group || !MODES[mode] || !availableModes(list, group).includes(mode)) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Не найдено', action: linkButton(href('vocab'), 'К группам') }));
    const header = pageHeader(`${MODES[mode].emoji} ${MODES[mode].title}`, { back: href('vocab-group', group.n), subtitle: `Словарные слова · группа ${group.n}` });
    const body = h('div', { class: 'stack' });
    const view = themed(h('div', { class: 'stack words-page' }, header, body));
    const ctx = { list, group, mode, body };
    if (mode === 'cards') cards(ctx);
    else if (mode === 'alphabet') alphabet(ctx);
    else quiz(ctx);
    return view;
  });
}

const progress = (done, total) =>
  h('div', { class: 'stack stack--tight' }, h('p', { class: 'small muted' }, `${Math.min(done + 1, total)} из ${total}`), h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: { width: `${Math.round((done / total) * 100)}%` } })));

const againRow = (ctx, restart) =>
  h('div', { class: 'row wrap' }, button('Ещё раз', restart, { iconName: 'arrow', size: 'lg' }), linkButton(href('vocab-group', ctx.group.n), 'К группе', { variant: 'secondary' }));

/** Карточки: слово с пропусками → «Показать» → «Знаю» / «Ещё учу». Без счёта. */
function cards(ctx) {
  const { list, group, body } = ctx;
  const byId = new Map(group.words.map((w) => [w.id, w]));
  let queue = shuffle(group.words).map((w) => w.id);
  let pos = 0;
  let known = 0;
  const show = () => {
    if (pos >= queue.length) {
      body.replaceChildren(
        h('div', { class: 'card' }, emptyState({ emoji: '🎉', title: 'Все карточки пройдены!', text: 'Теперь проверь себя: вставь буквы или напиши диктант.', action: linkButton(href('vocab-train', group.n, 'gaps'), 'Вставь буквы') })),
        button('Ещё раз', () => ((queue = shuffle(group.words).map((w) => w.id)), (pos = 0), (known = 0), show()), { variant: 'secondary' }),
      );
      return;
    }
    const w = byId.get(queue[pos]);
    const card = h('div', { class: 'card word-card', 'aria-live': 'polite' }, h('p', { class: 'vocab-word' }, gapped(w)));
    const actions = h('div', { class: 'poem-controls' });
    const flip = button('Показать', () => {
      card.replaceChildren(h('p', {}, marked(w)), ...[sayButton(list, w)].filter(Boolean));
      actions.replaceChildren(
        button('Знаю', () => ((known += 1), (pos += 1), show()), { iconName: 'check', size: 'lg' }),
        button('Ещё учу', () => (queue.push(w.id), (pos += 1), show()), { variant: 'secondary', size: 'lg' }),
      );
    }, { size: 'lg' });
    actions.append(flip);
    body.replaceChildren(progress(known, group.words.length), card, actions);
    flip.focus({ preventScroll: true });
  };
  show();
}

/** Поле для слова: без автоисправления и подсказок — иначе телефон сам исправит ошибку. */
function wordForm(label, onAnswer) {
  const input = h('input', { class: 'input word-input', id: 'vocab-answer', lang: 'ru', autocomplete: 'off', autocapitalize: 'none', spellcheck: false, autocorrect: 'off', maxLength: 40 });
  const error = h('p', { class: 'field__error', role: 'alert' });
  const check = button('Проверить', null, { type: 'submit', iconName: 'check', size: 'lg' });
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
        onAnswer(input.value.trim());
      },
    },
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'vocab-answer' }, label), input, error),
    check,
  );
  setTimeout(() => input.focus({ preventScroll: true }), 0);
  return form;
}

/** «Вставь буквы», «Выбери верное написание», «Диктант», «Часть речи»: ошибка — слово ещё раз в конце, счёт по первой попытке. */
function quiz(ctx) {
  const { list, group, mode, body } = ctx;
  const words = modeWords(group, mode);
  const byId = new Map(words.map((w) => [w.id, w]));
  let round = createRound(words);
  let typedWrong = new Map(); // id → что написал ученик в первый раз (для итогов диктанта)

  const next = () => {
    if (roundDone(round)) return finish();
    const w = byId.get(round.queue[round.pos]);
    const feedback = h('div', { class: 'stack', 'aria-live': 'polite' });
    const nextBtn = button('Дальше', () => next(), { iconName: 'arrow', size: 'lg' });
    const answered = (ok, typed) => {
      if (!ok && typed && !typedWrong.has(w.id)) typedWrong.set(w.id, typed);
      round = answerRound(round, w.id, ok);
      const rightAnswer = mode === 'pos' ? h('strong', {}, POS_LABELS[w.pos].toLowerCase()) : marked(w, 'vocab-answer');
      feedback.replaceChildren(
        h(
          'div',
          { class: `feedback ${ok ? 'feedback--ok' : 'feedback--bad'}`, role: 'status' },
          h('p', { class: 'feedback__title' }, icon(ok ? 'check' : 'cross'), h('span', {}, ok ? 'Верно!' : 'Неверно')),
          ok && mode !== 'gaps' && mode !== 'dictation' ? null : h('p', {}, ok ? '' : 'Правильно: ', rightAnswer),
          ok ? null : h('p', { class: 'small muted' }, 'Это слово будет ещё раз в конце.'),
        ),
        nextBtn,
      );
      nextBtn.focus({ preventScroll: true });
    };

    let task;
    if (mode === 'choose' || mode === 'pos') {
      const right = mode === 'choose' ? plain(w) : w.pos;
      const opts = mode === 'choose' ? spellingOptions(w) : Object.keys(POS_LABELS);
      const text = (o) => (mode === 'choose' ? o : POS_LABELS[o]);
      const buttons = opts.map((o, i) =>
        h(
          'button',
          {
            type: 'button',
            class: 'option word-option',
            onclick: () => {
              buttons.forEach((b, j) => {
                b.disabled = true;
                if (opts[j] === right) b.classList.add('is-correct');
              });
              if (o !== right) buttons[i].classList.add('is-wrong');
              answered(o === right);
            },
          },
          h('span', { class: 'option__key', 'aria-hidden': 'true' }, String.fromCharCode(1040 + i)),
          h('span', { class: `option__text${mode === 'choose' ? ' vocab-option' : ''}` }, text(o)),
        ),
      );
      const top = mode === 'pos' ? h('div', { class: 'card word-card' }, h('p', { class: 'vocab-word' }, plain(w))) : h('p', { class: 'lead' }, 'Какое слово написано верно?');
      task = h('div', { class: 'stack' }, top, h('div', { class: 'options' }, buttons));
    } else if (mode === 'gaps') {
      task = h(
        'div',
        { class: 'stack' },
        h('div', { class: 'card word-card' }, h('p', { class: 'vocab-word' }, gapped(w))),
        wordForm('Напиши слово целиком, вставив буквы', (typed) => answered(checkWord(w, typed), typed)),
      );
    } else {
      // Диктант: слово не показываем, только слушаем. Звук — прямо из нажатия («Начать», «Дальше»):
      // иначе телефон не даст его включить.
      speak(list, w);
      task = h(
        'div',
        { class: 'stack' },
        h('div', { class: 'card word-card' }, button('🔊 Послушать ещё раз', () => speak(list, w), { variant: 'secondary', size: 'lg' })),
        wordForm('Напиши услышанное слово', (typed) => answered(checkWord(w, typed), typed)),
      );
    }
    body.replaceChildren(progress(round.pos, round.queue.length), task, feedback);
  };

  const finish = () => {
    const score = roundScore(round);
    update((d) => ((d.vocab = recordVocab(d.vocab, group.n, mode, score)), d));
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
        ? h(
            'section',
            { class: 'card' },
            h('h2', { class: 'card__title' }, 'Повтори'),
            h(
              'ul',
              { class: 'word-list' },
              missed.map((w) =>
                h(
                  'li',
                  {},
                  marked(w, 'word-list__en'),
                  mode === 'pos' ? h('span', { class: 'muted' }, POS_LABELS[w.pos].toLowerCase()) : null,
                  typedWrong.has(w.id) ? h('span', { class: 'muted' }, `твой ответ: «${typedWrong.get(w.id)}»`) : null,
                ),
              ),
            ),
          )
        : null,
      againRow(ctx, () => ((round = createRound(words)), (typedWrong = new Map()), next())),
    );
  };
  if (mode !== 'dictation') return next();
  body.replaceChildren(
    h(
      'div',
      { class: 'card' },
      emptyState({ emoji: '🎧', title: `Диктант: ${wordsCount(words.length)}`, text: 'Включи звук. Слово прозвучит само, послушать можно ещё раз. Пиши без подсказок, как в тетради.' }),
    ),
    button('Начать диктант', () => next(), { iconName: 'arrow', size: 'lg' }),
  );
}

/** «По алфавиту»: нажимай слова по порядку; поставленные встают в список сверху. */
function alphabet(ctx) {
  const { group, mode, body } = ctx;
  const byId = new Map(group.words.map((w) => [w.id, w]));
  let state = createAlphabet(group.words);
  let tiles = shuffle(group.words).map((w) => w.id);

  const render = (message = '') => {
    if (alphabetDone(state)) return finish();
    const placed = h('ol', { class: 'vocab-placed' }, state.placed.map((id) => h('li', {}, plain(byId.get(id)))));
    const status = h('p', { class: `small${message ? ' vocab-alpha-msg' : ' muted'}`, role: 'status' }, message || (state.placed.length ? 'Какое слово следующее по алфавиту?' : 'Какое слово первое по алфавиту? Нажми на него.'));
    const buttons = h(
      'div',
      { class: 'vocab-tiles' },
      tiles
        .filter((id) => !state.placed.includes(id))
        .map((id) =>
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--secondary vocab-tile',
              onclick: (e) => {
                const r = tapAlphabet(state, id);
                state = r.state;
                if (r.ok) return render();
                e.currentTarget.classList.remove('is-wrong');
                void e.currentTarget.offsetWidth; // перезапуск анимации
                e.currentTarget.classList.add('is-wrong');
                status.textContent = `«${plain(byId.get(id))}» — не сейчас. Сравни первые буквы, а если они одинаковые — вторые.`;
                status.className = 'small vocab-alpha-msg';
              },
            },
            plain(byId.get(id)),
          ),
        ),
    );
    body.replaceChildren(
      progress(state.placed.length, state.order.length),
      state.placed.length ? h('div', { class: 'card' }, placed) : null,
      status,
      buttons,
      h('p', { class: 'small muted' }, 'Подсказка: в алфавите буква ё идёт сразу после е.'),
    );
  };

  const finish = () => {
    const score = alphabetScore(state);
    update((d) => ((d.vocab = recordVocab(d.vocab, group.n, mode, score)), d));
    body.replaceChildren(
      h(
        'div',
        { class: 'card' },
        emptyState({
          emoji: state.mistakes ? '💪' : '🏆',
          title: state.mistakes ? `Готово! Ошибок: ${state.mistakes}` : 'Без единой ошибки!',
          text: 'Так слова стоят по алфавиту:',
        }),
        h('ol', { class: 'vocab-placed' }, state.order.map((id) => h('li', {}, plain(byId.get(id))))),
      ),
      againRow(ctx, () => ((state = createAlphabet(group.words)), (tiles = shuffle(group.words).map((w) => w.id)), render())),
    );
  };
  render();
}
