// Экран прохождения тренировки.
import { h, icon, button, confirmDialog, progressBar, emptyState, linkButton } from '../ui.js';
import { href, navigate, setLeaveGuard } from '../router.js';
import { getData } from '../state.js';
import { currentQuestion, submitAnswer, skipQuestion, goNext, isLastQuestion } from '../quiz.js';
import { correctAnswerText, optionFeedback } from '../results.js';
import { saveActive, completeActive } from '../session.js';
import { formatClock } from '../utils.js';

export function quizScreen() {
  let session = getData().activeSession;
  if (!session) {
    setLeaveGuard(null);
    return h(
      'div',
      { class: 'card' },
      emptyState({ emoji: '🎯', title: 'Сейчас нет начатой тренировки', text: 'Выбери тему и начни новую.', action: linkButton(href('subjects'), 'К темам') }),
    );
  }

  const root = h('div', { class: 'quiz' });
  let hintShown = false;

  // Подтверждение при уходе со страницы тренировки (через меню или кнопку «Назад»).
  setLeaveGuard(() =>
    confirmDialog('Прогресс сохранится — продолжить можно будет с главной страницы.', {
      title: 'Выйти из тренировки?',
      okText: 'Выйти',
      cancelText: 'Остаться',
    }),
  );

  function finish() {
    setLeaveGuard(null);
    const id = completeActive(session);
    navigate('result', id);
  }

  function next() {
    if (isLastQuestion(session)) return finish();
    session = goNext(session);
    hintShown = false;
    saveActive(session);
    render(true);
  }

  function render(focusQuestion = false) {
    const q = currentQuestion(session);
    const answer = session.answers[q.id];
    const learning = session.settings.mode === 'learning';
    const total = session.questions.length;
    const num = session.currentIndex + 1;
    const answeredCount = Object.keys(session.answers).length;
    root.textContent = '';

    const timer = h('span', { class: 'quiz__timer', 'aria-label': 'Время' }, icon('clock', { size: 16 }), h('span', {}, formatClock(Date.now() - session.startedAt)));
    const tick = setInterval(() => {
      if (!document.body.contains(timer)) return clearInterval(tick);
      timer.lastChild.textContent = formatClock(Date.now() - session.startedAt);
    }, 1000);

    root.appendChild(
      h(
        'header',
        { class: 'quiz__top' },
        h(
          'div',
          { class: 'quiz__topline' },
          button('', () => navigate('home'), { variant: 'ghost btn--icon', iconName: 'close', ariaLabel: 'Выйти из тренировки' }),
          h('div', { class: 'quiz__title' }, h('p', { class: 'small muted' }, session.source.title), h('p', { class: 'quiz__counter' }, `Вопрос ${num} из ${total}`)),
          timer,
        ),
        progressBar(answeredCount, total, `Отвечено ${answeredCount} из ${total}`),
        h('p', { class: 'small muted' }, learning ? '📖 Режим обучения' : '📝 Режим контрольной'),
      ),
    );

    const errorBox = h('p', { class: 'field__error', role: 'alert', id: 'answer-error' });
    const card = h('section', { class: 'card quiz__card', 'aria-labelledby': 'q-text' });
    // Длинные вопросы (например, с текстом для чтения) показываем обычным шрифтом — так легче читать.
    const long = q.question.length > 220;
    card.appendChild(h('h1', { class: `quiz__question${long ? ' quiz__question--long' : ''}`, id: 'q-text', tabindex: '-1' }, q.question));

    const answered = Boolean(answer);
    const showFeedback = answered && learning;
    const { control, read } = answerControl(q, answered ? answer.given : undefined, answered, showFeedback ? answer : null);

    const form = h(
      'form',
      {
        class: 'quiz__form',
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          if (answered) return next();
          const res = submitAnswer(session, read());
          if (!res.accepted) {
            errorBox.textContent = res.outcome.message || 'Проверь ответ.';
            control.querySelector('input')?.focus();
            return;
          }
          session = res.session;
          saveActive(session);
          if (learning) render();
          else next();
        },
      },
      control,
      errorBox,
    );

    if (showFeedback) form.appendChild(feedbackPanel(q, answer, session.settings.showExplanation));

    if (!answered && learning && q.hint) {
      const hintBox = h('p', { class: 'hint', id: 'hint-text', hidden: !hintShown }, `💡 ${q.hint}`);
      form.appendChild(hintBox);
    }

    const actions = h('div', { class: 'quiz__actions' });
    if (answered) {
      actions.appendChild(button(isLastQuestion(session) ? 'Завершить и посмотреть результат' : 'Дальше', null, { type: 'submit', size: 'lg', iconName: 'arrow' }));
    } else {
      actions.appendChild(button('Ответить', null, { type: 'submit', size: 'lg', iconName: 'check' }));
      actions.appendChild(
        button(
          'Пропустить',
          () => {
            const res = skipQuestion(session);
            if (!res.accepted) return;
            session = res.session;
            saveActive(session);
            next();
          },
          { variant: 'ghost', iconName: 'skip' },
        ),
      );
      if (learning && q.hint) {
        const hb = button(
          hintShown ? 'Скрыть подсказку' : 'Подсказка',
          () => {
            hintShown = !hintShown;
            const box = form.querySelector('#hint-text');
            box.hidden = !hintShown;
            hb.lastChild.textContent = hintShown ? 'Скрыть подсказку' : 'Подсказка';
            hb.setAttribute('aria-expanded', String(hintShown));
          },
          { variant: 'secondary', iconName: 'bulb' },
        );
        hb.setAttribute('aria-controls', 'hint-text');
        hb.setAttribute('aria-expanded', String(hintShown));
        actions.appendChild(hb);
      }
    }
    form.appendChild(actions);
    card.appendChild(form);
    root.appendChild(card);

    if (!learning && !answered) {
      root.appendChild(h('p', { class: 'small muted center' }, 'Ответы проверятся в конце. Подсказок на контрольной нет 🤪'));
    }

    // Фокус: после ответа — на кнопку «Дальше», при новом вопросе — на текст вопроса.
    requestAnimationFrame(() => {
      if (showFeedback) actions.querySelector('button')?.focus();
      else if (focusQuestion) card.querySelector('#q-text')?.focus();
    });
  }

  render();
  return root;
}

/** Поле ответа под тип задания. read() возвращает ответ в формате для checkAnswer. */
function answerControl(q, given, locked, answerInfo) {
  if (q.type === 'single-choice' || q.type === 'true-false') {
    const options = q.type === 'single-choice' ? q.options.map((o) => ({ value: o.id, text: o.text })) : [
      { value: 'true', text: 'Верно' },
      { value: 'false', text: 'Неверно' },
    ];
    const correctValue = String(q.correctAnswer);
    const givenValue = given === undefined || given === null ? null : String(given);
    const group = h(
      'fieldset',
      { class: `options${q.type === 'true-false' ? ' options--tf' : ''}`, 'aria-describedby': 'answer-error' },
      h('legend', { class: 'sr-only' }, 'Варианты ответа'),
      options.map((o, i) => {
        let state = '';
        let mark = null;
        if (answerInfo) {
          if (o.value === correctValue) {
            state = ' is-correct';
            mark = h('span', { class: 'option__mark' }, icon('check', { size: 18 }), h('span', {}, 'правильный ответ'));
          } else if (o.value === givenValue) {
            state = ' is-wrong';
            mark = h('span', { class: 'option__mark' }, icon('cross', { size: 18 }), h('span', {}, 'твой ответ'));
          }
        } else if (locked && o.value === givenValue) state = ' is-chosen';
        return h(
          'label',
          { class: `option${state}` },
          h('input', { type: 'radio', name: 'answer', value: o.value, checked: o.value === givenValue, disabled: locked }),
          h('span', { class: 'option__key', 'aria-hidden': 'true' }, q.type === 'true-false' ? (o.value === 'true' ? '✓' : '✗') : String.fromCharCode(1040 + i)),
          h('span', { class: 'option__text' }, o.text),
          mark,
        );
      }),
    );
    return {
      control: group,
      read: () => {
        const v = group.querySelector('input:checked')?.value;
        if (v === undefined) return q.type === 'true-false' ? null : '';
        return q.type === 'true-false' ? v === 'true' : v;
      },
    };
  }

  const isNumber = q.type === 'number';
  const input = h('input', {
    type: 'text',
    id: 'answer-input',
    class: `input input--answer${answerInfo ? (answerInfo.status === 'correct' ? ' is-correct' : ' is-wrong') : ''}`,
    inputMode: isNumber ? 'decimal' : 'text',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
    enterKeyHint: 'done',
    value: given ?? '',
    disabled: locked,
    'aria-describedby': 'answer-error',
  });
  const wrap = h(
    'div',
    { class: 'field' },
    h('label', { class: 'field__label', for: 'answer-input' }, isNumber ? 'Твой ответ (число)' : 'Твой ответ'),
    h('div', { class: 'answer-row' }, input, isNumber && q.unit ? h('span', { class: 'unit' }, q.unit) : null),
  );
  if (!locked) requestAnimationFrame(() => input.focus({ preventScroll: true }));
  return { control: wrap, read: () => input.value };
}

function feedbackPanel(q, answer, showExplanation) {
  const ok = answer.status === 'correct';
  const fb = ok ? '' : optionFeedback(q, answer.given);
  return h(
    'div',
    { class: `feedback ${ok ? 'feedback--ok' : 'feedback--bad'}`, role: 'status' },
    h('p', { class: 'feedback__title' }, icon(ok ? 'check' : 'cross'), h('span', {}, ok ? 'Верно!' : 'Неверно')),
    ok ? null : h('p', {}, h('strong', {}, 'Правильный ответ: '), correctAnswerText(q)),
    fb ? h('p', {}, fb) : null,
    showExplanation && q.explanation ? h('p', { class: 'feedback__explanation' }, h('strong', {}, 'Почему: '), q.explanation) : null,
  );
}
