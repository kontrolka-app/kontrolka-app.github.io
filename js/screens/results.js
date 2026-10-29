// Экран результата и история тренировок.
import { h, icon, button, linkButton, pageHeader, emptyState, copyText, toast, confirmDialog } from '../ui.js';
import { href, navigate } from '../router.js';
import { content, getData, settings, update, topicsFor } from '../state.js';
import { verdict, deltaFromPrevious, weakTopics, shareText, percentOf, lastTopicResults, topicStatus, REVIEW_PERCENT, MASTERED_PERCENT } from '../results.js';
import { selectQuestions } from '../quiz.js';
import { startTraining, questionsForEntry } from '../session.js';
import { formatDate, formatDuration, plural } from '../utils.js';
import { theoryBlock, notFound } from './browse.js';
import { nextTopic } from '../catalog.js';

const STATUS_TEXT = { correct: 'Верно', wrong: 'Ошибка', skipped: 'Пропущено' };

function ring(percent, level) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', `ring ring--${level}`);
  svg.setAttribute('aria-hidden', 'true');
  const bg = document.createElementNS(ns, 'circle');
  const fg = document.createElementNS(ns, 'circle');
  for (const el of [bg, fg]) {
    el.setAttribute('cx', '60');
    el.setAttribute('cy', '60');
    el.setAttribute('r', String(r));
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-width', '12');
  }
  bg.setAttribute('class', 'ring__bg');
  fg.setAttribute('class', 'ring__fg');
  fg.setAttribute('stroke-dasharray', `${(c * percent) / 100} ${c}`);
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('transform', 'rotate(-90 60 60)');
  svg.append(bg, fg);
  return h('div', { class: 'ring-wrap' }, svg, h('span', { class: 'ring__value' }, `${percent}%`));
}

function reviewItem(r, index) {
  return h(
    'li',
    { class: `review-item review-item--${r.status}` },
    h(
      'div',
      { class: 'review-item__head' },
      h('span', { class: 'review-item__num' }, `№${index + 1}`),
      h('span', { class: `status status--${r.status}` }, icon(r.status === 'correct' ? 'check' : r.status === 'wrong' ? 'cross' : 'skip', { size: 16 }), h('span', {}, STATUS_TEXT[r.status])),
    ),
    h('p', { class: 'review-item__q' }, r.question),
    r.status !== 'correct' ? h('p', {}, h('span', { class: 'muted' }, 'Твой ответ: '), h('span', { class: 'answer-wrong' }, r.given)) : null,
    h('p', {}, h('span', { class: 'muted' }, r.status === 'correct' ? 'Ответ: ' : 'Правильный ответ: '), h('strong', {}, r.correct)),
    r.feedback ? h('p', { class: 'review-item__fb' }, `⚠️ ${r.feedback}`) : null,
    r.explanation ? h('p', { class: 'review-item__expl' }, h('strong', {}, 'Объяснение: '), r.explanation) : null,
    content.topicById.get(r.topicId)?.theory?.length ? h('a', { class: 'small', href: href('topic', r.topicId, 'rule') }, 'Открыть правило') : null,
  );
}

export function resultScreen(entryId) {
  const data = getData();
  const entry = data.history.find((e) => e.id === entryId);
  if (!entry) return notFound('Результат не найден');
  const v = verdict(entry.percent);
  const delta = deltaFromPrevious(data.history, entry);
  const mistakes = entry.review.filter((r) => r.status !== 'correct');
  const n = mistakes.length;
  const mistakesLabel = entry.skipped && entry.wrong ? `Повторить ошибки и пропуски (${n})` : entry.skipped ? `Повторить пропущенные (${n})` : `Повторить ошибки (${n})`;
  const low = entry.percent < REVIEW_PERCENT;

  // Следующая тема того же предмета — для обычной тренировки по одной теме.
  const topic = entry.source.kind === 'topic' && entry.source.topicIds?.length === 1 ? content.topicById.get(entry.source.topicIds[0]) : null;
  const last = lastTopicResults(data.history);
  const next = topic ? nextTopic(topicsFor(topic.subjectId, topic.grade), topic.id, (id) => topicStatus(last.get(id)) === 'mastered') : null;
  const mastered = Boolean(topic) && entry.percent >= MASTERED_PERCENT;

  async function retry(onlyMistakes) {
    const ids = onlyMistakes ? mistakes.map((r) => r.questionId) : null;
    const { questions, missing } = questionsForEntry(entry, ids);
    if (!questions.length) {
      toast(entry.source.kind === 'custom' ? 'Этот тест удалён — повторить нельзя.' : 'Эти задания больше не найдены.', 'error');
      return;
    }
    if (missing) toast('Часть заданий больше не существует — они пропущены.');
    await startTraining({
      questions: selectQuestions(questions, { count: questions.length, order: onlyMistakes ? 'original' : 'random' }),
      source: { ...entry.source, title: onlyMistakes ? `Работа над ошибками: ${entry.source.title.replace(/^Работа над ошибками: /, '')}` : entry.source.title },
      settings: { mode: onlyMistakes ? 'learning' : entry.mode, showExplanation: true },
    });
  }

  // Темы, по которым результат ниже порога, — показываем правило для повторения.
  const weakTopicBlocks = Object.entries(entry.topicStats || {})
    .filter(([id, s]) => id !== '_custom' && percentOf(s.correct, s.total) < REVIEW_PERCENT)
    .map(([id]) => content.topicById.get(id))
    .filter(Boolean);

  const root = h(
    'div',
    { class: 'stack' },
    pageHeader('Результат', { back: href('home'), subtitle: `${entry.source.title} · ${formatDate(entry.finishedAt)}` }),
    h(
      'section',
      { class: `card result-hero result-hero--${v.level}${mastered ? ' result-hero--mastered' : ''}` },
      ring(entry.percent, v.level),
      h(
        'div',
        { class: 'result-hero__text' },
        h('h2', {}, mastered ? 'Тема освоена!' : v.title),
        // При низком результате сначала — что уже получилось.
        low ? h('p', {}, entry.correct ? `Уже получилось: ${entry.correct} ${plural(entry.correct, ['верный ответ', 'верных ответа', 'верных ответов'])}.` : 'С первого раза получается не у всех — это нормально.') : null,
        h('p', {}, v.text),
        delta !== null
          ? h(
              'p',
              { class: `delta${delta > 0 ? ' delta--up' : delta < 0 ? ' delta--down' : ''}` },
              `В прошлый раз ${entry.percent - delta}% → сейчас ${entry.percent}%${delta > 0 ? ' ↑' : delta < 0 ? ' ↓' : ''}`,
            )
          : null,
      ),
    ),
    h(
      'dl',
      { class: 'stats-row' },
      stat('Верно', entry.correct, 'ok'),
      stat('Ошибок', entry.wrong, 'bad'),
      stat('Пропущено', entry.skipped, 'skip'),
      stat('Время', formatDuration(entry.durationMs)),
    ),
    h(
      'div',
      { class: 'result-actions' },
      // Один главный шаг: при низком результате — повторить ошибки, иначе — следующая тема.
      low && n
        ? button(mistakesLabel, () => retry(true), { iconName: 'history', size: 'lg' })
        : next
          ? linkButton(href('topic', next.id), `Следующая тема: ${next.title}`, { iconName: 'arrow', size: 'lg' })
          : linkButton(href('home'), 'На главную', { iconName: 'home', size: 'lg' }),
    ),
    h(
      'div',
      { class: 'result-actions result-actions--secondary' },
      !low && n ? button(mistakesLabel, () => retry(true), { variant: 'secondary', iconName: 'history' }) : null,
      button('Пройти ещё раз', () => retry(false), { variant: 'secondary', iconName: 'play' }),
      low || next ? linkButton(href('home'), 'На главную', { variant: 'ghost', iconName: 'home' }) : null,
      button(
        'Скопировать результат',
        async () => {
          const ok = await copyText(shareText(entry, { title: entry.source.title, nickname: settings().nickname }));
          toast(ok ? 'Результат скопирован — можно отправить в чат класса.' : 'Не удалось скопировать.', ok ? 'info' : 'error');
        },
        { variant: 'ghost', iconName: 'copy' },
      ),
    ),
  );

  if (mistakes.length) {
    root.appendChild(
      h(
        'section',
        { class: 'stack' },
        h('h2', {}, `Разбор ошибок (${mistakes.length})`),
        h('p', { class: 'muted' }, 'Посмотри, где ошибся, и прочитай объяснение. Потом повтори ошибки — кнопка выше.'),
        h('ol', { class: 'review-list' }, entry.review.map((r, i) => (r.status !== 'correct' ? reviewItem(r, i) : null))),
      ),
    );
  } else {
    root.appendChild(h('section', { class: 'card' }, emptyState({ emoji: '🏆', title: 'Ни одной ошибки!', text: 'Можно попробовать сложные задания или другую тему.' })));
  }

  if (weakTopicBlocks.length) {
    root.appendChild(
      h(
        'section',
        { class: 'stack' },
        h('h2', {}, 'Повтори правило'),
        h('p', { class: 'muted' }, 'В этих темах больше всего ошибок. Прочитай правило и примеры.'),
        weakTopicBlocks.map((t) => theoryBlock(t, { open: weakTopicBlocks.length === 1, headingLevel: 'h3' })),
      ),
    );
  }

  const correctOnes = entry.review.map((r, i) => [r, i]).filter(([r]) => r.status === 'correct');
  if (correctOnes.length) {
    root.appendChild(
      h(
        'details',
        { class: 'card' },
        h('summary', {}, h('strong', {}, `Верные ответы (${correctOnes.length})`)),
        h('ol', { class: 'review-list' }, correctOnes.map(([r, i]) => reviewItem(r, i))),
      ),
    );
  }
  return root;
}

function stat(label, value, kind) {
  return h('div', { class: `stat${kind ? ` stat--${kind}` : ''}` }, h('dt', {}, label), h('dd', {}, String(value)));
}

export function historyScreen() {
  const data = getData();
  const history = data.history;
  if (!history.length) {
    return h(
      'div',
      { class: 'stack' },
      pageHeader('История', { back: href('home') }),
      h('div', { class: 'card' }, emptyState({ emoji: '📈', title: 'Пока нет завершённых тренировок', text: 'Здесь будут результаты и то, как они меняются.', action: linkButton(href('subjects'), 'Начать тренировку') })),
    );
  }
  const weak = weakTopics(history).filter((w) => content.topicById.has(w.topicId));
  return h(
    'div',
    { class: 'stack' },
    pageHeader('История', {
      back: href('home'),
      subtitle: `${history.length} ${plural(history.length, ['тренировка', 'тренировки', 'тренировок'])}`,
      actions: button(
        'Очистить',
        async () => {
          const ok = await confirmDialog('Удалить всю историю тренировок? Это нельзя отменить.', { title: 'Очистить историю?', okText: 'Удалить', danger: true });
          if (!ok) return;
          update((d) => ((d.history = []), d));
          navigate('history');
        },
        { variant: 'ghost', iconName: 'trash' },
      ),
    }),
    weak.length
      ? h(
          'section',
          { class: 'card' },
          h('h2', { class: 'card__title' }, 'Темы, где чаще всего ошибки'),
          h(
            'ul',
            { class: 'weak-list' },
            weak.map((w) => {
              const t = content.topicById.get(w.topicId);
              return h(
                'li',
                {},
                h('a', { href: href('topic', t.id) }, t.title),
                h('span', { class: 'small muted' }, `ошибок: ${w.mistakes} · верно ${w.percent}%`),
                h('div', { class: 'mini-bar', 'aria-hidden': 'true' }, h('div', { style: { width: `${w.percent}%` } })),
              );
            }),
          ),
        )
      : null,
    h(
      'ul',
      { class: 'history-list' },
      history.map((e) => {
        const delta = deltaFromPrevious(history, e);
        return h(
          'li',
          {},
          h(
            'a',
            { class: 'card history-item', href: href('result', e.id) },
            h(
              'div',
              { class: 'history-item__main' },
              h('strong', {}, e.source.title),
              h('span', { class: 'small muted' }, `${formatDate(e.finishedAt)} · ${content.subjectById.get(e.source.subjectId)?.name || (e.source.kind === 'custom' ? 'Свой тест' : '')} · ${e.mode === 'control' ? 'контрольная' : 'обучение'}`),
            ),
            h(
              'div',
              { class: 'history-item__score' },
              h('span', { class: 'history-item__pct' }, `${e.percent}%`),
              h('span', { class: 'small' }, `${e.correct} из ${e.total}`),
              delta ? h('span', { class: `small delta ${delta > 0 ? 'delta--up' : 'delta--down'}` }, delta > 0 ? `▲ +${delta}%` : `▼ ${delta}%`) : null,
            ),
          ),
        );
      }),
    ),
  );
}
