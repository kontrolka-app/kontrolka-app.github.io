// Английский: неправильные глаголы — таблица с отметками «выучен», карточки, «выбери форму», «напиши форму».
import { h, button, linkButton, pageHeader, emptyState, icon } from '../ui.js';
import { href } from '../router.js';
import { getData, update } from '../state.js';
import { loadVerbs } from '../data.js';
import { createRound, answerRound, roundDone, roundScore, shuffle } from '../words.js';
import { isLearned, recordVerb, pickRound, verbOptions, checkPast, LEARNED_STREAK } from '../verbs.js';
import { themed, sayButton } from './words.js';
import { plural } from '../utils.js';

const MODES = {
  cards: { title: 'Карточки', emoji: '🃏', text: 'Глагол — вспоминаешь прошедшее время и переворачиваешь' },
  choose: { title: 'Выбери форму', emoji: '👆', text: 'Четыре варианта, среди них ловушка вроде buyed' },
  write: { title: 'Напиши форму', emoji: '✍️', text: `Пишешь сам. ${LEARNED_STREAK} раза подряд верно — глагол выучен` },
};

const verbsCount = (n) => `${n} ${plural(n, ['глагол', 'глагола', 'глаголов'])}`;

function later(build) {
  const slot = h('div', { class: 'stack' }, h('p', { class: 'muted', role: 'status' }, 'Загружаем глаголы…'));
  loadVerbs().then((list) => {
    if (list.error) {
      slot.replaceChildren(h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Глаголы не загрузились', text: 'Обнови страницу.', action: linkButton(href('english'), 'Назад') })));
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

export function verbsScreen() {
  return later(({ verbs }) => {
    const state = getData().verbs;
    const learned = verbs.filter((v) => isLearned(state, v.id)).length;
    const modeCard = (mode, m) =>
      h('a', { class: 'card poems-link', href: href('verbs', mode) }, h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, m.emoji), h('span', { class: 'subject-card__text' }, h('span', { class: 'subject-card__name' }, m.title), h('span', { class: 'small muted' }, m.text)), icon('arrow'));
    return themed(
      h(
        'div',
        { class: 'stack' },
        pageHeader('🔁 Неправильные глаголы', { back: href('english'), subtitle: `Выучено ${learned} из ${verbsCount(verbs.length)}. За раз — 10 глаголов, сначала невыученные.` }),
        h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Выучено глаголов', 'aria-valuemin': '0', 'aria-valuemax': String(verbs.length), 'aria-valuenow': String(learned) }, h('div', { class: 'progress__bar', style: { width: `${Math.round((learned / verbs.length) * 100)}%` } })),
        ...Object.entries(MODES).map(([mode, m]) => modeCard(mode, m)),
        h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card__title' }, 'Таблица'),
          h(
            'table',
            { class: 'verbs-table' },
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Глагол'), h('th', { scope: 'col' }, 'Прошедшее'), h('th', { scope: 'col' }, 'Перевод'), h('th', { scope: 'col' }, h('span', { class: 'sr-only' }, 'Выучен')))),
            h(
              'tbody',
              {},
              verbs.map((v) =>
                h(
                  'tr',
                  { class: isLearned(state, v.id) ? 'is-learned' : '' },
                  h('td', { lang: 'en' }, h('strong', {}, v.base)),
                  h('td', { lang: 'en' }, h('strong', {}, v.past), sayButton(`${v.base}, ${v.past}`)),
                  h('td', { class: 'muted' }, v.ru),
                  h('td', {}, isLearned(state, v.id) ? h('span', { 'aria-label': 'выучен', title: 'выучен' }, '✓') : null),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

export function verbsTrainScreen(mode) {
  return later(({ verbs }) => {
    if (!MODES[mode]) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Не найдено', action: linkButton(href('verbs'), 'К глаголам') }));
    const body = h('div', { class: 'stack' });
    const view = themed(h('div', { class: 'stack words-page' }, pageHeader(MODES[mode].title, { back: href('verbs'), subtitle: 'Неправильные глаголы' }), body));
    if (mode === 'cards') cards(body, verbs);
    else quiz(body, verbs, mode);
    return view;
  });
}

const progress = (done, total) =>
  h('div', { class: 'stack' }, h('p', { class: 'small muted' }, `${Math.min(done + 1, total)} из ${total}`), h('div', { class: 'progress' }, h('div', { class: 'progress__bar', style: { width: `${Math.round((done / total) * 100)}%` } })));

/** Карточки: глагол → прошедшее время. Все глаголы, «Ещё учу» — карточка вернётся в конец. */
function cards(body, verbs) {
  let queue = shuffle(verbs);
  let pos = 0;
  let known = 0;
  const show = () => {
    if (pos >= queue.length) {
      body.replaceChildren(
        h('div', { class: 'card' }, emptyState({ emoji: '🎉', title: 'Все карточки пройдены!', text: 'Теперь проверь себя: напиши формы сам.', action: linkButton(href('verbs', 'write'), 'Напиши форму') })),
        button('Ещё раз', () => ((queue = shuffle(verbs)), (pos = 0), (known = 0), show()), { variant: 'secondary' }),
      );
      return;
    }
    const v = queue[pos];
    const card = h('div', { class: 'card word-card', 'aria-live': 'polite' }, h('p', { class: 'word-card__en', lang: 'en' }, v.base), h('p', { class: 'small muted' }, v.ru));
    const actions = h('div', { class: 'poem-controls' });
    const flip = button('Перевернуть', () => {
      card.append(h('hr', { class: 'word-card__line' }), h('p', { class: 'word-card__en', lang: 'en' }, v.past), sayButton(`${v.base}, ${v.past}`));
      actions.replaceChildren(
        button('Знаю', () => ((known += 1), (pos += 1), show()), { iconName: 'check', size: 'lg' }),
        button('Ещё учу', () => (queue.push(v), (pos += 1), show()), { variant: 'secondary', size: 'lg' }),
      );
    }, { size: 'lg' });
    actions.append(flip);
    body.replaceChildren(progress(known, verbs.length), card, actions);
    flip.focus({ preventScroll: true });
  };
  show();
}

/** «Выбери форму» и «Напиши форму»: круг из 10 глаголов, ошибка — глагол ещё раз в конце. «Напиши» ведёт счёт выученности. */
function quiz(body, verbs, mode) {
  let set = pickRound(verbs, getData().verbs);
  let round = createRound(set);
  const byId = new Map(verbs.map((v) => [v.id, v]));

  const next = () => {
    if (roundDone(round)) return finish();
    const v = byId.get(round.queue[round.pos]);
    const firstTry = !round.retried.includes(v.id);
    const feedback = h('div', { class: 'stack', 'aria-live': 'polite' });
    const nextBtn = button('Дальше', () => next(), { iconName: 'arrow', size: 'lg' });
    const answered = (ok) => {
      round = answerRound(round, v.id, ok);
      // Выученность считаем только по первой попытке в «Напиши»: повтор после подсказки не в счёт.
      if (mode === 'write' && firstTry) update((d) => ((d.verbs = recordVerb(d.verbs, v.id, ok)), d));
      feedback.replaceChildren(
        h(
          'div',
          { class: `feedback ${ok ? 'feedback--ok' : 'feedback--bad'}`, role: 'status' },
          h('p', { class: 'feedback__title' }, icon(ok ? 'check' : 'cross'), h('span', {}, ok ? 'Верно!' : 'Неверно')),
          h('p', { lang: 'en' }, h('strong', {}, `${v.base} — ${v.past}`), sayButton(`${v.base}, ${v.past}`)),
          ok ? null : h('p', { class: 'small muted' }, 'Этот глагол будет ещё раз в конце.'),
        ),
        nextBtn,
      );
      nextBtn.focus({ preventScroll: true });
    };

    let task;
    const prompt = h('div', { class: 'card word-card' }, h('p', { class: 'word-card__en', lang: 'en' }, v.base), h('p', { class: 'small muted' }, v.ru));
    if (mode === 'choose') {
      const opts = verbOptions(v, verbs);
      const buttons = opts.map((o, i) =>
        h(
          'button',
          {
            type: 'button',
            class: 'option word-option',
            lang: 'en',
            onclick: () => {
              buttons.forEach((b, j) => {
                b.disabled = true;
                if (opts[j] === v.past) b.classList.add('is-correct');
              });
              if (o !== v.past) buttons[i].classList.add('is-wrong');
              answered(o === v.past);
            },
          },
          h('span', { class: 'option__key', 'aria-hidden': 'true' }, String.fromCharCode(1040 + i)),
          h('span', { class: 'option__text' }, o),
        ),
      );
      task = h('div', { class: 'stack' }, prompt, h('p', { class: 'small muted' }, 'Выбери прошедшее время:'), h('div', { class: 'options' }, buttons));
    } else {
      const input = h('input', { class: 'input word-input', id: 'verb-answer', lang: 'en', autocomplete: 'off', autocapitalize: 'none', spellcheck: false, autocorrect: 'off', maxLength: 30 });
      const error = h('p', { class: 'field__error', role: 'alert' });
      const check = button('Проверить', null, { type: 'submit', iconName: 'check', size: 'lg' });
      const form = h(
        'form',
        {
          class: 'stack',
          onsubmit: (e) => {
            e.preventDefault();
            if (input.disabled) return;
            if (!input.value.trim()) return (error.textContent = 'Напиши форму глагола.');
            error.textContent = '';
            input.disabled = true;
            check.disabled = true;
            answered(checkPast(v, input.value));
          },
        },
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'verb-answer' }, 'Прошедшее время:'), input, error),
        check,
      );
      task = h('div', { class: 'stack' }, prompt, form);
      setTimeout(() => input.focus({ preventScroll: true }), 0);
    }
    body.replaceChildren(progress(round.pos, round.queue.length), task, feedback);
  };

  const finish = () => {
    const score = roundScore(round);
    const state = getData().verbs;
    const learned = verbs.filter((v) => isLearned(state, v.id)).length;
    const missed = round.wrong.map((id) => byId.get(id));
    body.replaceChildren(
      h(
        'div',
        { class: 'card' },
        emptyState({
          emoji: score.correct === score.total ? '🏆' : '💪',
          title: `С первого раза: ${score.correct} из ${score.total}`,
          text: mode === 'write' ? `Выучено ${learned} из ${verbsCount(verbs.length)}.` : 'Чтобы глаголы считались выученными, напиши их сам в «Напиши форму».',
        }),
      ),
      missed.length
        ? h('section', { class: 'card' }, h('h2', { class: 'card__title' }, 'Повтори'), h('ul', { class: 'word-list' }, missed.map((v) => h('li', { lang: 'en' }, h('span', { class: 'word-list__en' }, `${v.base} — ${v.past}`), sayButton(`${v.base}, ${v.past}`), h('span', { class: 'muted', lang: 'ru' }, v.ru)))))
        : null,
      h(
        'div',
        { class: 'row wrap' },
        button('Ещё 10 глаголов', () => ((set = pickRound(verbs, getData().verbs)), (round = createRound(set)), next()), { iconName: 'arrow', size: 'lg' }),
        linkButton(href('verbs'), 'К таблице', { variant: 'secondary' }),
      ),
    );
  };
  next();
}
