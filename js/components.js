// Повторно используемые части экранов.
import { h, icon } from './ui.js';
import { href } from './router.js';
import { content, isFavorite, toggleFavorite, topicDifficulty, settings } from './state.js';
import { countAvailable } from './quiz.js';
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

export function subjectCard(subject, grade, { hrefTo } = {}) {
  const topics = content.topics.filter((t) => t.subjectId === subject.id && t.grade === grade);
  const n = topics.reduce((s, t) => s + (content.questionsByTopic.get(t.id) || []).length, 0);
  return h(
    'a',
    { class: `card subject-card subject-card--${subject.color}`, href: hrefTo || href('topics', subject.id) },
    h('span', { class: 'subject-card__icon', 'aria-hidden': 'true' }, subject.icon || '📘'),
    h(
      'span',
      { class: 'subject-card__text' },
      h('span', { class: 'subject-card__name' }, subject.name),
      h('span', { class: 'small muted' }, `${topics.length} ${plural(topics.length, ['тема', 'темы', 'тем'])} · ${n} ${plural(n, ['вопрос', 'вопроса', 'вопросов'])}`),
    ),
    icon('arrow'),
  );
}

function radioGroup(name, legend, options, value, onChange) {
  return h(
    'fieldset',
    { class: 'field segmented' },
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
 * Форма настройки тренировки.
 * pool — доступные вопросы; onStart({ questions-настройки }) вызывается при отправке.
 * forceMode — для «пробной контрольной» режим по умолчанию «контрольная».
 */
export function setupForm({ pool, onStart, forceMode, idPrefix = 'setup' }) {
  const s = settings();
  const state = {
    count: s.defaultCount,
    difficulty: s.defaultDifficulty,
    mode: forceMode || s.defaultMode,
    order: s.defaultOrder,
    showExplanation: s.showExplanation,
  };

  const countInput = h('input', { type: 'number', id: `${idPrefix}-count`, class: 'input input--short', min: '1', inputMode: 'numeric' });
  const countHint = h('p', { class: 'field__hint', id: `${idPrefix}-count-hint` });
  countInput.setAttribute('aria-describedby', countHint.id);
  const startBtn = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, icon('play'), h('span', {}, 'Начать'));
  const explanationRow = h('div');

  const available = () => countAvailable(pool, state.difficulty);
  const refresh = () => {
    const max = available();
    countInput.max = String(max);
    if (state.count > max) state.count = max;
    if (state.count < 1 && max > 0) state.count = Math.min(10, max);
    countInput.value = String(state.count);
    countInput.disabled = max === 0;
    startBtn.disabled = max === 0;
    countHint.textContent = max === 0 ? 'С такой сложностью заданий нет — выбери другую.' : `Доступно заданий: ${max}. Повторов не будет.`;
    explanationRow.hidden = state.mode !== 'learning';
  };

  countInput.addEventListener('input', () => {
    const v = parseInt(countInput.value, 10);
    if (Number.isFinite(v)) state.count = Math.max(1, Math.min(v, available()));
  });
  countInput.addEventListener('change', refresh);

  const difficultyOptions = [
    { value: 'all', label: `Любая (${countAvailable(pool, 'all')})` },
    { value: 'easy', label: `Лёгкая (${countAvailable(pool, 'easy')})` },
    { value: 'medium', label: `Средняя (${countAvailable(pool, 'medium')})` },
    { value: 'hard', label: `Сложная (${countAvailable(pool, 'hard')})` },
  ];
  const difficultySelect = h(
    'select',
    { class: 'input', id: `${idPrefix}-difficulty`, onchange: (e) => ((state.difficulty = e.target.value), refresh()) },
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

  const quick = h(
    'div',
    { class: 'quick-counts' },
    [5, 10, 20].map((n) =>
      h('button', { type: 'button', class: 'chip-btn', onclick: () => ((state.count = Math.min(n, available())), refresh()) }, String(n)),
    ),
    h('button', { type: 'button', class: 'chip-btn', onclick: () => ((state.count = available()), refresh()) }, 'Все'),
  );

  const form = h(
    'form',
    {
      class: 'card setup-form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        refresh();
        if (available() === 0) return;
        onStart({ ...state });
      },
    },
    h('h2', { class: 'card__title' }, 'Настройка тренировки'),
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: countInput.id }, 'Количество вопросов'), h('div', { class: 'row' }, countInput, quick), countHint),
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: difficultySelect.id }, 'Сложность'), difficultySelect),
    radioGroup(
      `${idPrefix}-mode`,
      'Режим',
      [
        { value: 'learning', label: '📖 Обучение' },
        { value: 'control', label: '📝 Контрольная' },
      ],
      state.mode,
      (v) => ((state.mode = v), refresh(), (modeHint.textContent = modeText(v))),
    ),
    null,
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
    startBtn,
  );
  const modeHint = h('p', { class: 'field__hint' }, modeText(state.mode));
  form.querySelector('fieldset').appendChild(modeHint);
  refresh();
  return form;
}

function modeText(mode) {
  return mode === 'learning'
    ? 'Сразу видно, верно ли ответил, есть подсказки и объяснения.'
    : 'Как на настоящей контрольной: без подсказок, результат и разбор — в конце.';
}
