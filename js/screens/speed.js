// Тренажёр скорости чтения: «Начать» — читаешь — «Стоп» — слов в минуту — вопросы на понимание без текста.
import { h, button, linkButton, pageHeader, emptyState, toast } from '../ui.js';
import { href, setLeaveGuard } from '../router.js';
import { content, getData, update } from '../state.js';
import { checkAnswer } from '../quiz.js';
import { wordCount, wordsPerMinute, speedQuestions, speedPassages, speedRecord, speedSummary, SPEED_RECORDS_LIMIT } from '../speed.js';
import { formatClock, plural } from '../utils.js';

const allPassages = () => speedPassages([...content.passageById.values()], content.questions);

export function speedListScreen() {
  const records = getData().speed;
  const list = allPassages();
  return h(
    'div',
    { class: 'stack' },
    pageHeader('⏱️ Скорость чтения', { back: href('topics', 'reading'), subtitle: 'Читай текст, засекай время — и проверь, всё ли понял.' }),
    h(
      'div',
      { class: 'card card--soft' },
      h('p', {}, 'Нажми «Начать» и читай текст вслух, как на проверке техники чтения. Дочитал — нажми «Стоп». Потом ответь на вопросы: текст уже будет закрыт.'),
      h('p', { class: 'small muted' }, 'Это тренажёр для себя: важно не только быстро, но и понятно прочитать.'),
    ),
    list.length
      ? h(
          'div',
          { class: 'grid grid--2' },
          list.map((p) => {
            const s = speedSummary(records, p.id);
            const words = wordCount(p.paragraphs);
            return h(
              'a',
              { class: 'card poem-card', href: href('speed', p.id) },
              h('span', { class: 'poem-card__title' }, p.title),
              h('span', { class: 'small muted' }, `${words} ${plural(words, ['слово', 'слова', 'слов'])}`),
              s ? h('span', { class: 'status-pill status-pill--progress' }, h('span', {}, `последний раз ${s.last.wpm} сл/мин · лучший ${s.best.wpm}`)) : null,
            );
          }),
        )
      : h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Текстов пока нет' })),
  );
}

export function speedScreen(passageId) {
  const p = content.passageById.get(passageId);
  const questions = p ? speedQuestions(content.questions, p.id) : [];
  if (!p || questions.length < 3) return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: 'Такого текста нет', action: linkButton(href('speed'), 'К текстам') }));
  const words = wordCount(p.paragraphs);
  const root = h('div', { class: 'stack speed-page' });
  const header = pageHeader(p.title, { back: href('speed'), subtitle: `${words} ${plural(words, ['слово', 'слова', 'слов'])}` });
  let startedAt = 0;
  let tick = null;

  const textCard = () => h('div', { class: 'card passage__body speed-text' }, p.paragraphs.map((t) => h('p', {}, t)));

  const ready = () => {
    setLeaveGuard(null);
    root.replaceChildren(
      header,
      h('div', { class: 'card speed-ready' }, h('p', {}, 'Текст откроется, когда нажмёшь «Начать». Сразу начинай читать — время пойдёт.'), button('Начать', reading, { iconName: 'play', size: 'lg' })),
    );
  };

  const reading = () => {
    startedAt = performance.now();
    const clock = h('span', { class: 'speed-clock', 'aria-hidden': 'true' }, '0:00');
    tick = setInterval(() => {
      if (!clock.isConnected) return clearInterval(tick);
      clock.textContent = formatClock(performance.now() - startedAt);
    }, 500);
    root.replaceChildren(
      header,
      textCard(),
      h('div', { class: 'speed-bar' }, clock, button('Стоп — дочитал', stop, { iconName: 'check', size: 'lg' })),
    );
    root.querySelector('.speed-bar .btn')?.focus({ preventScroll: true });
  };

  const stop = () => {
    clearInterval(tick);
    const ms = performance.now() - startedAt;
    const wpm = wordsPerMinute(words, ms);
    if (!wpm) {
      toast('Так быстро не читают даже взрослые — похоже, «Стоп» нажат раньше времени. Попробуй ещё раз.', 'error');
      ready();
      return;
    }
    quiz(ms, wpm);
  };

  const quiz = (ms, wpm) => {
    const groups = questions.map((q, qi) => {
      const opts = q.type === 'true-false' ? [['true', 'Верно'], ['false', 'Неверно']] : q.options.map((o) => [o.id, o.text]);
      return h(
        'fieldset',
        { class: 'card speed-q', 'data-q': String(qi) },
        h('legend', { class: 'speed-q__text' }, `${qi + 1}. ${q.question}`),
        h('div', { class: 'options' }, opts.map(([v, t]) => h('label', { class: 'option' }, h('input', { type: 'radio', name: `sq-${qi}`, value: v }), h('span', { class: 'option__text' }, t)))),
      );
    });
    const errorBox = h('p', { class: 'field__error', role: 'alert' });
    const form = h(
      'form',
      {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          const given = questions.map((q, qi) => {
            const v = form.querySelector(`input[name=sq-${qi}]:checked`)?.value;
            return v === undefined ? undefined : q.type === 'true-false' ? v === 'true' : v;
          });
          if (given.some((g) => g === undefined)) {
            errorBox.textContent = 'Ответь на все вопросы.';
            return;
          }
          const right = questions.map((q, qi) => checkAnswer(q, given[qi]).status === 'correct');
          const understood = right.filter(Boolean).length;
          update((d) => {
            d.speed = [speedRecord({ passageId: p.id, words, ms, understood, total: questions.length }), ...d.speed].slice(0, SPEED_RECORDS_LIMIT);
            return d;
          });
          result(ms, wpm, questions, given, right);
        },
      },
      groups,
      errorBox,
      button('Проверить', null, { type: 'submit', iconName: 'check', size: 'lg' }),
    );
    root.replaceChildren(header, h('div', { class: 'card speed-score' }, scoreLine(ms, wpm)), h('h2', {}, 'Что ты понял? Текст уже закрыт.'), form);
    window.scrollTo(0, 0);
  };

  const result = (ms, wpm, qs, given, right) => {
    const understood = right.filter(Boolean).length;
    const best = speedSummary(getData().speed, p.id)?.best;
    root.replaceChildren(
      header,
      h(
        'div',
        { class: 'card speed-score' },
        scoreLine(ms, wpm),
        h('p', { class: 'speed-understood' }, `Понял ${understood} из ${qs.length}`),
        best && best.wpm > wpm ? h('p', { class: 'small muted' }, `Лучший результат на этом тексте — ${best.wpm} слов в минуту.`) : null,
        understood < qs.length ? h('p', { class: 'small' }, 'Быстро — хорошо, но важнее понять. Перечитай текст и посмотри разбор ниже.') : null,
      ),
      h(
        'ol',
        { class: 'review-list' },
        qs.map((q, i) =>
          h(
            'li',
            { class: `review-item review-item--${right[i] ? 'correct' : 'wrong'}` },
            h('p', { class: 'review-item__q' }, q.question),
            h('p', {}, h('span', { class: 'muted' }, right[i] ? 'Верно: ' : 'Правильный ответ: '), h('strong', {}, q.type === 'true-false' ? (q.correctAnswer ? 'Верно' : 'Неверно') : q.options.find((o) => o.id === q.correctAnswer)?.text)),
            !right[i] && q.explanation ? h('p', { class: 'review-item__expl' }, q.explanation) : null,
          ),
        ),
      ),
      h('details', { class: 'card' }, h('summary', {}, h('strong', {}, 'Перечитать текст')), textCard()),
      h('div', { class: 'row wrap' }, button('Ещё раз', ready, { iconName: 'play' }), linkButton(href('speed'), 'Другой текст', { variant: 'secondary' })),
    );
    window.scrollTo(0, 0);
  };

  ready();
  return root;
}

function scoreLine(ms, wpm) {
  return h('p', { class: 'speed-wpm' }, h('strong', {}, `${wpm}`), ` ${plural(wpm, ['слово', 'слова', 'слов'])} в минуту`, h('span', { class: 'small muted' }, ` · время ${formatClock(ms)}`));
}
