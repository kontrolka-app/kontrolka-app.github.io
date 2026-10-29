// Повторно используемые части экранов.
import { h, icon } from './ui.js';
import { href } from './router.js';
import { content, isFavorite, toggleFavorite, topicDifficulty, settings, getData } from './state.js';
import { countAvailable } from './quiz.js';
import { topicStatus, lastTopicResults } from './results.js';
import { DIFFICULTY_LABELS, plural } from './utils.js';

export function difficultyBadge(level) {
  if (!level) return null;
  const dots = { easy: 1, medium: 2, hard: 3 }[level];
  return h(
    'span',
    { class: `badge badge--${level}` },
    h('span', { class: 'dots', 'aria-hidden': 'true' }, '●'.repeat(dots) + '○'.repeat(3 - dots)),
    h('span', {}, DIFFICULTY_LABELS[level]),
  );
}

export function favoriteButton(topicId, { onChange } = {}) {
  const btn = h('button', { class: 'btn btn--icon btn--ghost fav-btn', type: 'button' });
  const paint = () => {
    const fav = isFavorite(topicId);
    btn.classList.toggle('is-active', fav);
    btn.setAttribute('aria-pressed', String(fav));
    btn.setAttribute('aria-label', fav ? 'Убрать из избранного' : 'Добавить в избранное');
    btn.title = fav ? 'Убрать из избранного' : 'В избранное';
  };
  btn.appendChild(icon('star'));
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(topicId);
    paint();
    onChange?.();
  });
  paint();
  return btn;
}

export function topicCard(topic, { showSubject = false, onFavChange } = {}) {
  const subject = content.subjectById.get(topic.subjectId);
  const n = (content.questionsByTopic.get(topic.id) || []).length;
  return h(
    'article',
    { class: 'card topic-card' },
    h(
      'a',
      { class: 'topic-card__link', href: href('topic', topic.id) },
      h(
        'div',
        { class: 'topic-card__meta' },
        showSubject && subject ? h('span', { class: `chip chip--${subject.color}` }, subject.name) : null,
        topic.section ? h('span', { class: 'muted small' }, topic.section) : null,
      ),
      h('h3', { class: 'topic-card__title' }, topic.title),
      topic.description ? h('p', { class: 'topic-card__desc' }, topic.description) : null,
      h(
        'div',
        { class: 'topic-card__footer' },
        h('span', { class: 'small muted' }, `${topic.grade} класс · ${n} ${plural(n, ['вопрос', 'вопроса', 'вопросов'])}`),
        difficultyBadge(topicDifficulty(topic.id)),
      ),
    ),
    favoriteButton(topic.id, { onChange: onFavChange }),
  );
}

const STATUS_LABELS = { new: 'не начата', progress: 'в процессе', mastered: 'освоена' };

/** Строка темы в списке: значок статуса, название, последний процент. */
export function topicRow(topic, lastResult) {
  const status = topicStatus(lastResult);
  return h(
    'a',
    { class: `topic-row topic-row--${status}`, href: href('topic', topic.id) },
    h('span', { class: 'topic-row__status', 'aria-hidden': 'true' }, status === 'mastered' ? icon('check') : null),
    h('span', { class: 'topic-row__title' }, topic.title),
    ' ', // пробел для экранного диктора: «название 70%», а не «название70%»
    lastResult ? h('span', { class: 'topic-row__percent' }, `${lastResult.percent}%`) : null,
    h('span', { class: 'sr-only' }, `, ${STATUS_LABELS[status]}`),
  );
}

export function subjectCard(subject, grade, { hrefTo } = {}) {
  const topics = content.topics.filter((t) => t.subjectId === subject.id && t.grade === grade);
  const last = lastTopicResults(getData().history);
  const mastered = topics.filter((t) => topicStatus(last.get(t.id)) === 'mastered').length;
  return h(
    'a',
    { class: `card subject-card subject-card--${subject.color}`, href: hrefTo || href('topics', subject.id) },
    h('span', { class: 'subject-card__icon', 'aria-hidden': 'true' }, subject.icon || '📘'),
    h(
      'span',
      { class: 'subject-card__text' },
      h('span', { class: 'subject-card__name' }, subject.name),
      h('span', { class: 'small muted' }, `Освоено ${mastered} из ${topics.length} ${plural(topics.length, ['темы', 'тем', 'тем'])}`),
    ),
    icon('arrow'),
  );
}

function radioGroup(name, legend, options, value, onChange, extraClass = '') {
  return h(
    'fieldset',
    { class: `field segmented ${extraClass}`.trim() },
    h('legend', { class: 'field__label' }, legend),
    h(
      'div',
      { class: 'segmented__options' },
      options.map((o) =>
        h(
          'label',
          { class: 'segmented__option' },
          h('input', { type: 'radio', name, value: o.value, checked: o.value === value, onchange: () => onChange(o.value) }),
          h('span', {}, o.label),
        ),
      ),
    ),
  );
}

/**
 * Форма запуска тренировки: режим, главная кнопка «Начать — N вопросов»,
 * остальные настройки свёрнуты в «Ещё настройки».
 * pool — доступные вопросы; onStart(настройки) вызывается при отправке.
 * forceMode — для «пробной контрольной» режим по умолчанию «контрольная».
 * primaryAction — { label, onClick(настройки) }: главная кнопка вместо «Начать» (например, «Повторить ошибки»).
 * beforeMore — блок между кнопками и «Ещё настройками» (например, правило).
 */
export function setupForm({ pool, onStart, forceMode, idPrefix = 'setup', primaryAction, beforeMore }) {
  const s = settings();
  const state = {
    count: s.defaultCount,
    difficulty: s.defaultDifficulty,
    mode: forceMode || s.defaultMode,
    order: s.defaultOrder,
    showExplanation: s.showExplanation,
  };
  // Чипы количества: 5 / 10 / 20 и число из настроек, если оно другое (15, 30).
  const presets = [...new Set([5, 10, 20, s.defaultCount])].sort((a, b) => a - b);

  const countSlot = h('div');
  const countHint = h('p', { class: 'field__hint' });
  const startBtn = h('button', { class: `btn btn--${primaryAction ? 'secondary' : 'primary'} btn--lg btn--block`, type: 'submit' }, icon('play'), h('span', {}));
  const explanationRow = h('div');

  const available = () => countAvailable(pool, state.difficulty);
  const effectiveCount = () => Math.min(state.count, available());
  const refresh = () => {
    const max = available();
    if (state.count < 1 && max > 0) state.count = Math.min(10, max);
    const n = effectiveCount();
    startBtn.disabled = max === 0;
    startBtn.lastChild.textContent = max === 0 ? 'Нет заданий' : `Начать — ${n} ${plural(n, ['вопрос', 'вопроса', 'вопросов'])}`;
    countHint.textContent = max === 0 ? 'С такой сложностью заданий нет — выбери другую.' : `Доступно заданий: ${max}. Повторов не будет.`;
    explanationRow.hidden = state.mode !== 'learning';
  };
  // Чипы перерисовываем только при смене сложности — иначе после выбора числа терялся бы фокус.
  const renderCount = () => {
    const max = available();
    countSlot.textContent = '';
    const options = presets.filter((p) => p < max).map((p) => ({ value: String(p), label: String(p) }));
    options.push({ value: 'all', label: `Все (${max})` });
    const checked = state.count >= max ? 'all' : String(state.count);
    countSlot.appendChild(
      radioGroup(`${idPrefix}-count`, 'Количество вопросов', options, checked, (v) => ((state.count = v === 'all' ? Infinity : Number(v)), refresh()), 'segmented--chips'),
    );
  };

  const difficultyOptions = [
    { value: 'all', label: `Любая (${countAvailable(pool, 'all')})` },
    { value: 'easy', label: `Лёгкая (${countAvailable(pool, 'easy')})` },
    { value: 'medium', label: `Средняя (${countAvailable(pool, 'medium')})` },
    { value: 'hard', label: `Сложная (${countAvailable(pool, 'hard')})` },
  ];
  const difficultySelect = h(
    'select',
    { class: 'input', id: `${idPrefix}-difficulty`, onchange: (e) => ((state.difficulty = e.target.value), renderCount(), refresh()) },
    difficultyOptions.map((o) => h('option', { value: o.value, selected: o.value === state.difficulty }, o.label)),
  );

  explanationRow.appendChild(
    h(
      'label',
      { class: 'check' },
      h('input', { type: 'checkbox', checked: state.showExplanation, onchange: (e) => (state.showExplanation = e.target.checked) }),
      h('span', {}, 'Показывать объяснение сразу после ответа'),
    ),
  );

  const modeGroup = radioGroup(
    `${idPrefix}-mode`,
    'Как тренируемся?',
    [
      { value: 'learning', label: 'С подсказками' },
      { value: 'control', label: 'Как на контрольной' },
    ],
    state.mode,
    (v) => ((state.mode = v), refresh(), (modeHint.textContent = modeText(v))),
  );
  const modeHint = h('p', { class: 'field__hint' }, modeText(state.mode));
  modeGroup.appendChild(modeHint);

  const form = h(
    'form',
    {
      class: 'setup-form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        refresh();
        if (available() === 0) return;
        onStart({ ...state, count: effectiveCount() });
      },
    },
    modeGroup,
    h(
      'div',
      { class: 'setup-form__actions' },
      primaryAction
        ? h('button', { type: 'button', class: 'btn btn--primary btn--lg btn--block', onclick: () => primaryAction.onClick({ ...state }) }, icon('history'), h('span', {}, primaryAction.label))
        : null,
      startBtn,
    ),
    beforeMore || null,
    h(
      'details',
      { class: 'card setup-more' },
      h('summary', { class: 'setup-more__summary' }, 'Ещё настройки: количество, сложность, порядок'),
      h(
        'div',
        { class: 'setup-more__body' },
        h('div', { class: 'field' }, countSlot, countHint),
        h('div', { class: 'field' }, h('label', { class: 'field__label', for: difficultySelect.id }, 'Сложность'), difficultySelect),
        radioGroup(
          `${idPrefix}-order`,
          'Порядок вопросов',
          [
            { value: 'random', label: 'Случайный' },
            { value: 'original', label: 'По порядку' },
          ],
          state.order,
          (v) => (state.order = v),
        ),
        explanationRow,
      ),
    ),
  );
  renderCount();
  refresh();
  return form;
}

function modeText(mode) {
  return mode === 'learning'
    ? 'Сразу видно, верно ли ответил, есть подсказки и объяснения.'
    : 'Как на настоящей контрольной: без подсказок, результат и разбор — в конце.';
}
