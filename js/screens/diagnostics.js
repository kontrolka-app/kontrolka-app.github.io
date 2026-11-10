// Диагностика и карта знаний: список предметов, карта предмета, запуск проверки, карта на экране результата.
import { h, icon, artIcon, button, linkButton, pageHeader, emptyState } from '../ui.js';
import { href, navigate } from '../router.js';
import { content, getData, settings, update, topicsFor, subjectsForGrade, questionsForTopics } from '../state.js';
import { subjectVars } from '../components.js';
import { startTraining } from '../session.js';
import { selectQuestions } from '../quiz.js';
import { formatDate, plural } from '../utils.js';
import { notFound } from './browse.js';
import {
  diagnosticTopics, pickDiagnostic, estimateMinutes, diagnosticSource, knowledgeMap, mapSummary, weakFromMap,
  statusOf, quarterStartKey, STATUS_LABELS, STATUS_EMOJI, PER_TOPIC,
} from '../diagnostics.js';

const TREND = { up: '↑ лучше, чем в прошлый раз', down: '↓ хуже, чем в прошлый раз' };

const groupBySection = (topics) => {
  const groups = [];
  for (const t of topics) {
    const name = t.section || 'Другие темы';
    let g = groups.find((x) => x.section === name);
    if (!g) groups.push((g = { section: name, topics: [] }));
    g.topics.push(t);
  }
  return groups;
};

function summaryLine(sum) {
  return h(
    'p',
    { class: 'map-summary' },
    ['know', 'unsure', 'review', 'none'].map((k) => h('span', { class: `map-chip map-chip--${k}` }, `${STATUS_EMOJI[k]} ${STATUS_LABELS[k]}: ${sum[k]}`)),
  );
}

function topicRow(t, info) {
  const st = info?.status || 'none';
  return h(
    'li',
    {},
    h(
      'a',
      { class: `map-row map-row--${st}`, href: href('topic', t.id) },
      h('span', { class: 'map-row__dot', 'aria-hidden': 'true' }, STATUS_EMOJI[st]),
      h(
        'span',
        { class: 'map-row__text' },
        h('span', { class: 'map-row__title' }, t.title),
        h('span', { class: 'small muted' }, info ? `${STATUS_LABELS[st]} · ${info.correct} из ${info.total} · ${formatDate(info.finishedAt)}${info.trend ? ` · ${TREND[info.trend]}` : ''}` : STATUS_LABELS.none),
      ),
      icon('arrow'),
    ),
  );
}

/** Ссылка «Карта знаний» — со страницы предмета и из «Прогресса». */
export function mapLinkCard(subjectId) {
  return h(
    'a',
    { class: 'card poems-link', href: subjectId ? href('map', subjectId) : href('map') },
    h('span', { class: 'poems-link__emoji', 'aria-hidden': 'true' }, artIcon('map', '🗺️')),
    h('span', { class: 'subject-card__text' }, h('span', { class: 'subject-card__name' }, 'Карта знаний'), h('span', { class: 'small muted' }, 'Короткая проверка по всем темам: что знаешь, где не уверен, что повторить')),
    icon('arrow'),
  );
}

/** Карточка на главной в начале четверти. null — не время или уже закрыли. */
export function quarterCard() {
  const key = quarterStartKey();
  if (!key || settings().quarterCardClosed === key || !settings().grade) return null;
  const card = h(
    'section',
    { class: 'card card--soft quarter-card' },
    h('h2', { class: 'card__title card__title--icon' }, artIcon('map', '🗺️'), h('span', {}, 'Новая четверть — проверь, что помнишь')),
    h('p', { class: 'muted' }, 'Короткая проверка по пройденным темам покажет, что повторить в первую очередь.'),
    h(
      'div',
      { class: 'row wrap' },
      linkButton(href('map'), 'Проверить', { iconName: 'play' }),
      button('Не сейчас', () => {
        update((d) => ((d.settings.quarterCardClosed = key), d));
        card.remove();
      }, { variant: 'ghost' }),
    ),
  );
  return card;
}

export function mapScreen(subjectId) {
  const grade = settings().grade;
  if (!grade) {
    navigate('grade');
    return h('div');
  }
  const map = knowledgeMap(getData().history);
  if (!subjectId) {
    const subjects = subjectsForGrade(grade).filter((s) => diagnosticTopics(topicsFor(s.id, grade)).length);
    return h(
      'div',
      { class: 'stack' },
      pageHeader('🗺️ Карта знаний', { back: href('history'), subtitle: `Короткая проверка: по ${PER_TOPIC} задания из каждой темы, без подсказок. Выбери предмет.` }),
      subjects.length
        ? h(
            'div',
            { class: 'grid grid--2' },
            subjects.map((s) => {
              const topics = diagnosticTopics(topicsFor(s.id, grade));
              const sum = mapSummary(map, topics);
              return h(
                'a',
                { class: 'card map-subject subject-themed', href: href('map', s.id), style: subjectVars(s) },
                h('span', { class: 'subject-card__name' }, `${s.icon || ''} ${s.name}`),
                sum.none === topics.length ? h('span', { class: 'small muted' }, `Ещё не проверял · ${topics.length} ${plural(topics.length, ['тема', 'темы', 'тем'])}`) : summaryLine(sum),
              );
            }),
          )
        : h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Для этого класса тем пока нет' })),
    );
  }
  const subject = content.subjectById.get(subjectId);
  if (!subject) return notFound('Такого предмета нет');
  const topics = diagnosticTopics(topicsFor(subjectId, grade));
  const sum = mapSummary(map, topics);
  const weak = weakFromMap(map, topics);
  const trainWeak = () => {
    const ids = weak.map((t) => t.id);
    const pool = questionsForTopics(ids);
    return startTraining({
      questions: selectQuestions(pool, { count: Math.min(20, pool.length), order: 'random' }),
      source: { kind: 'exam', topicIds: ids, subjectId, title: `Слабые темы: ${subject.name}` },
      settings: { mode: 'learning', showExplanation: settings().showExplanation !== false },
    });
  };
  return h(
    'div',
    { class: 'stack subject-themed', style: subjectVars(subject) },
    pageHeader(`🗺️ Карта знаний: ${subject.name}`, { back: href('map'), subtitle: sum.none === topics.length ? 'Пока ни одна тема не проверена' : null }),
    h(
      'section',
      { class: 'card stack-sm' },
      summaryLine(sum),
      h(
        'div',
        { class: 'row wrap' },
        linkButton(href('diag', subjectId), sum.none === topics.length ? 'Пройти диагностику' : 'Проверить снова', { iconName: 'play' }),
        weak.length ? button(`Тренировать красные и жёлтые (${weak.length} ${plural(weak.length, ['тема', 'темы', 'тем'])})`, trainWeak, { variant: 'secondary', iconName: 'history' }) : null,
      ),
    ),
    groupBySection(topics).map((g) =>
      h('section', { class: 'card' }, h('h2', { class: 'card__title' }, g.section), h('ul', { class: 'map-list' }, g.topics.map((t) => topicRow(t, map.get(t.id))))),
    ),
  );
}

export function diagSetupScreen(subjectId) {
  const grade = settings().grade;
  const subject = content.subjectById.get(subjectId);
  if (!subject || !grade) return notFound('Такого предмета нет');
  const topics = diagnosticTopics(topicsFor(subjectId, grade));
  const groups = groupBySection(topics);
  const selected = new Set(groups.map((g) => g.section));
  const info = h('p', { class: 'muted', 'aria-live': 'polite' });
  const startBtn = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'submit' }, icon('play'), h('span', {}, 'Начать проверку'));

  const chosenTopicIds = () => groups.filter((g) => selected.has(g.section)).flatMap((g) => g.topics.map((t) => t.id));
  const refresh = () => {
    const ids = chosenTopicIds();
    const n = Math.min(ids.length * PER_TOPIC, ids.reduce((acc, id) => acc + Math.min(PER_TOPIC, (content.questionsByTopic.get(id) || []).length), 0));
    startBtn.disabled = !ids.length;
    info.textContent = ids.length
      ? `${ids.length} ${plural(ids.length, ['тема', 'темы', 'тем'])}, около ${n} ${plural(n, ['задания', 'заданий', 'заданий'])} — примерно ${estimateMinutes(n)} мин. Без подсказок, ответы — в конце.`
      : 'Отметь хотя бы один раздел.';
  };
  const checks = h(
    'fieldset',
    { class: 'card topic-checks' },
    h('legend', { class: 'card__title' }, 'Какие разделы уже прошли?'),
    h('p', { class: 'small muted' }, 'Можно проверять частями: сегодня одни разделы, завтра другие. Карта соберёт всё вместе.'),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'chip-btn', onclick: () => setAll(true) }, 'Выбрать все'),
      h('button', { type: 'button', class: 'chip-btn', onclick: () => setAll(false) }, 'Снять все'),
    ),
    groups.map((g) =>
      h(
        'label',
        { class: 'check' },
        h('input', { type: 'checkbox', value: g.section, checked: true, onchange: (e) => (e.target.checked ? selected.add(g.section) : selected.delete(g.section), refresh()) }),
        h('span', {}, `${g.section} `, h('span', { class: 'small muted' }, `(${g.topics.length} ${plural(g.topics.length, ['тема', 'темы', 'тем'])})`)),
      ),
    ),
  );
  function setAll(on) {
    checks.querySelectorAll('input[type=checkbox]').forEach((c) => {
      c.checked = on;
      if (on) selected.add(c.value);
      else selected.delete(c.value);
    });
    refresh();
  }
  refresh();
  const form = h(
    'form',
    {
      class: 'card setup-form',
      novalidate: true,
      onsubmit: (e) => {
        e.preventDefault();
        const ids = chosenTopicIds();
        if (!ids.length) return;
        startTraining({
          questions: pickDiagnostic(content.questionsByTopic, ids),
          source: diagnosticSource(subject, ids),
          settings: { mode: 'control', showExplanation: true },
        });
      },
    },
    h('h2', { class: 'card__title' }, 'Как проходит проверка'),
    h('p', {}, `Из каждой темы — ${PER_TOPIC} задания. Подсказок нет, правильные ответы и объяснения — в конце. После проверки покажем карту: что знаешь, где не уверен, что повторить.`),
    info,
    h('div', { class: 'setup-form__actions' }, startBtn),
  );
  return h(
    'div',
    { class: 'stack subject-themed', style: subjectVars(subject) },
    pageHeader(`Диагностика: ${subject.name}`, { back: href('map', subjectId), subtitle: `${grade} класс` }),
    h('div', { class: 'layout-2' }, checks, form),
  );
}

/** Карта по одной проверке — на экране результата. */
export function diagResultBlock(entry) {
  const stats = entry.diagStats || {};
  const topics = Object.keys(stats).map((id) => content.topicById.get(id)).filter(Boolean);
  if (!topics.length) return null;
  const sum = { know: 0, unsure: 0, review: 0, none: 0 };
  const order = { review: 0, unsure: 1, know: 2 };
  const items = topics.map((t) => ({ t, s: stats[t.id], st: statusOf(stats[t.id].correct, stats[t.id].total) }));
  // Сначала то, что повторить.
  items.sort((a, b) => order[a.st] - order[b.st]);
  const rows = items.map(({ t, s, st }) => {
    sum[st]++;
    return topicRow(t, { status: st, correct: s.correct, total: s.total, finishedAt: entry.finishedAt, trend: null });
  });
  return h(
    'section',
    { class: 'card stack-sm' },
    h('h2', { class: 'card__title card__title--icon' }, artIcon('map', '🗺️'), h('span', {}, 'Карта по этой проверке')),
    summaryLine(sum),
    h('ul', { class: 'map-list' }, rows),
    linkButton(href('map', entry.source.subjectId), 'Вся карта знаний', { variant: 'secondary', iconName: 'arrow' }),
  );
}
