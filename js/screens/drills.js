// «Тренажёр примеров» по математике: список тренажёров и запуск тренировки.
import { h, icon, button, pageHeader } from '../ui.js';
import { href } from '../router.js';
import { content, getData, settings } from '../state.js';
import { subjectVars, radioGroup } from '../components.js';
import { startTraining } from '../session.js';
import { DRILLS, DRILL_BY_ID, LEVELS, LEVEL_LABELS, DRILL_COUNTS, generateQuestion } from '../generators.js';
import { drillSource, drillQuestions, drillQuestionsByIds, lastDrillResult, drillMistakes } from '../drills.js';
import { plural } from '../utils.js';
import { notFound } from './browse.js';

const FIXES_PREFIX = 'Работа над ошибками: ';

/** Ссылка на тренажёр — со страницы математики и с главной. */
export function drillsLinkCard() {
  return h(
    'a',
    { class: 'card poems-link', href: href('drills') },
    h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, '🧮'),
    h('span', { class: 'subject-card__text' }, h('span', { class: 'subject-card__name' }, 'Тренажёр примеров'), h('span', { class: 'small muted' }, 'Столбики, порядок действий, уравнения, величины — примеры не кончаются')),
    icon('arrow'),
  );
}

async function startMistakes(drillId, ids) {
  const { questions } = drillQuestionsByIds(ids);
  const src = drillSource(drillId, 'medium');
  const s = settings();
  return startTraining({
    questions,
    source: { ...src, level: lastDrillResult(getData().history, drillId)?.level || 'medium', title: `${FIXES_PREFIX}${DRILL_BY_ID.get(drillId).title}` },
    settings: { mode: 'learning', showExplanation: s.showExplanation !== false },
  });
}

export function drillsScreen() {
  const history = getData().history;
  const math = content.subjectById.get('math');
  return h(
    'div',
    { class: 'stack subject-themed', style: math ? subjectVars(math) : null },
    pageHeader('🧮 Тренажёр примеров', { back: href('topics', 'math'), subtitle: 'Примеры придумывает программа — они не кончаются' }),
    h('p', { class: 'muted' }, 'Выбери, что тренировать. После ответа покажем решение по шагам.'),
    h(
      'div',
      { class: 'grid grid--2' },
      DRILLS.map((d) => {
        const last = lastDrillResult(history, d.id);
        const mistakes = drillMistakes(history, d.id);
        return h(
          'div',
          { class: 'card drill-card' },
          h(
            'a',
            { class: 'drill-card__link', href: href('drill', d.id) },
            h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, d.icon),
            h(
              'span',
              { class: 'subject-card__text' },
              h('span', { class: 'subject-card__name' }, d.title),
              h('span', { class: 'small muted' }, `Например: ${d.sample}`),
              last ? h('span', { class: 'small' }, `Последний раз: ${last.percent}% (${LEVEL_LABELS[last.level] || ''})`) : null,
            ),
            icon('arrow'),
          ),
          mistakes.length ? button(`Повторить ошибки (${mistakes.length})`, () => startMistakes(d.id, mistakes), { variant: 'secondary', iconName: 'history' }) : null,
        );
      }),
    ),
  );
}

export function drillScreen(drillId) {
  const d = DRILL_BY_ID.get(drillId);
  if (!d) return notFound('Такого тренажёра нет');
  const history = getData().history;
  const s = settings();
  const last = lastDrillResult(history, drillId);
  const mistakes = drillMistakes(history, drillId);
  const state = { level: last?.level || 'easy', count: 10, mode: s.defaultMode === 'control' ? 'control' : 'learning' };
  const math = content.subjectById.get('math');

  const sample = h('p', { class: 'drill-sample', 'aria-live': 'polite' });
  const showSample = () => {
    const q = generateQuestion(drillId, state.level);
    sample.textContent = q ? `Например: ${q.question.replace(/^(Вычисли|Реши уравнение): /, '')}` : '';
  };
  const startBtn = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, icon('play'), h('span', {}));
  const refresh = () => (startBtn.lastChild.textContent = `Начать — ${state.count} ${plural(state.count, ['пример', 'примера', 'примеров'])}`);
  const modeHint = h('p', { class: 'field__hint' });
  const modeText = (m) => (m === 'learning' ? 'Сразу видно, верно ли ответил, и решение по шагам.' : 'Ответы и решения — в конце. Есть таймер.');

  const levelGroup = radioGroup('drill-level', 'Уровень', LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l][0].toUpperCase() + LEVEL_LABELS[l].slice(1) })), state.level, (v) => ((state.level = v), showSample()));
  levelGroup.appendChild(sample);
  const countGroup = radioGroup('drill-count', 'Сколько примеров', DRILL_COUNTS.map((n) => ({ value: String(n), label: String(n) })), String(state.count), (v) => ((state.count = Number(v)), refresh()), 'segmented--chips');
  const modeGroup = radioGroup('drill-mode', 'Как тренируемся?', [{ value: 'learning', label: 'С подсказками' }, { value: 'control', label: 'Как на контрольной' }], state.mode, (v) => ((state.mode = v), (modeHint.textContent = modeText(v))));
  modeHint.textContent = modeText(state.mode);
  modeGroup.appendChild(modeHint);
  showSample();
  refresh();

  const form = h(
    'form',
    {
      class: 'card setup-form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        startTraining({
          questions: drillQuestions(drillId, state.level, state.count),
          source: drillSource(drillId, state.level),
          settings: { mode: state.mode, showExplanation: s.showExplanation !== false },
        });
      },
    },
    levelGroup,
    countGroup,
    modeGroup,
    h('div', { class: 'setup-form__actions' }, startBtn),
  );

  return h(
    'div',
    { class: 'stack subject-themed', style: math ? subjectVars(math) : null },
    pageHeader(`${d.icon} ${d.title}`, { back: href('drills'), subtitle: last ? `Последний раз: ${last.percent}% (${LEVEL_LABELS[last.level] || ''})` : 'Тренажёр примеров' }),
    h(
      'div',
      { class: 'layout-2' },
      form,
      h(
        'div',
        { class: 'stack' },
        mistakes.length
          ? h(
              'section',
              { class: 'card' },
              h('h2', { class: 'card__title' }, 'Работа над ошибками'),
              h('p', { class: 'small muted' }, `${mistakes.length} ${plural(mistakes.length, ['пример', 'примера', 'примеров'])}, где была ошибка или пропуск.`),
              button(`Повторить ошибки (${mistakes.length})`, () => startMistakes(drillId, mistakes), { variant: 'secondary', iconName: 'history' }),
            )
          : null,
        content.topicById.get(d.ruleTopicId) ? h('a', { class: 'card poems-link', href: href('topic', d.ruleTopicId, 'rule') }, h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, '📖'), h('span', { class: 'subject-card__text' }, h('span', { class: 'subject-card__name' }, 'Вспомнить правило'), h('span', { class: 'small muted' }, content.topicById.get(d.ruleTopicId).title)), icon('arrow')) : null,
      ),
    ),
  );
}
