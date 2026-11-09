// Диагностика и карта знаний: подбор заданий (по 2 на тему), цвета тем, начало четверти. Без DOM.
import { shuffle } from './utils.js';

export const PER_TOPIC = 2;
/** Сборные разделы — в диагностику не берём: в них задания из разных тем. */
export const SKIP_SECTIONS = new Set(['ВПР и МЦКО', 'Олимпиада', 'Смысловое чтение']);
/** Типы, которые долго решать, — не для короткой проверки. */
const SKIP_TYPES = new Set(['find-errors']);
const SECONDS_PER_QUESTION = 45;

export const STATUS_LABELS = { know: 'знаю', unsure: 'не уверен', review: 'повторить', none: 'не проверял' };
export const STATUS_EMOJI = { know: '🟢', unsure: '🟡', review: '🔴', none: '⚪' };

/** Темы, которые можно проверять диагностикой. */
export function diagnosticTopics(topics) {
  return topics.filter((t) => !SKIP_SECTIONS.has(t.section));
}

/** Задания темы, подходящие для диагностики. */
export function suitable(questions) {
  return questions.filter((q) => !q.passageId && !SKIP_TYPES.has(q.type));
}

/**
 * По PER_TOPIC заданий из каждой темы: сначала средней сложности, потом остальные. Порядок — вперемешку.
 * questionsByTopic — Map topicId → задания.
 */
export function pickDiagnostic(questionsByTopic, topicIds, rng = Math.random) {
  const out = [];
  for (const id of topicIds) {
    const pool = shuffle(suitable(questionsByTopic.get(id) || []), rng);
    const medium = pool.filter((q) => q.difficulty === 'medium');
    const rest = pool.filter((q) => q.difficulty !== 'medium');
    out.push(...[...medium, ...rest].slice(0, PER_TOPIC));
  }
  return shuffle(out, rng);
}

/** Примерное время в минутах. */
export function estimateMinutes(count) {
  return Math.max(1, Math.round((count * SECONDS_PER_QUESTION) / 60));
}

export function diagnosticSource(subject, topicIds) {
  return { kind: 'diagnostic', subjectId: subject.id, topicIds: [...topicIds], title: `Диагностика: ${subject.name}` };
}

/** Цвет темы по результату: 2 из 2 — знаю, хотя бы половина — не уверен, меньше — повторить. */
export function statusOf(correct, total) {
  if (!total) return 'none';
  if (correct === total) return 'know';
  if (correct * 2 >= total) return 'unsure';
  return 'review';
}

const RANK = { review: 0, unsure: 1, know: 2 };

/**
 * Карта знаний: для каждой темы — последний результат диагностики и предыдущий (для стрелки).
 * history — новые сначала. Возвращает Map topicId → { status, correct, total, finishedAt, trend: 'up' | 'down' | null }.
 */
export function knowledgeMap(history) {
  const map = new Map();
  for (const h of history) {
    if (h.source?.kind !== 'diagnostic' || !h.diagStats) continue;
    for (const [topicId, s] of Object.entries(h.diagStats)) {
      if (!s.total) continue;
      const status = statusOf(s.correct, s.total);
      const cur = map.get(topicId);
      if (!cur) map.set(topicId, { status, correct: s.correct, total: s.total, finishedAt: h.finishedAt, trend: null, prevSeen: false });
      else if (!cur.prevSeen) {
        cur.prevSeen = true;
        cur.trend = RANK[cur.status] > RANK[status] ? 'up' : RANK[cur.status] < RANK[status] ? 'down' : null;
      }
    }
  }
  for (const v of map.values()) delete v.prevSeen;
  return map;
}

/** Сколько тем каждого цвета среди данных тем. */
export function mapSummary(map, topics) {
  const out = { know: 0, unsure: 0, review: 0, none: 0 };
  for (const t of topics) out[map.get(t.id)?.status || 'none']++;
  return out;
}

/** Темы для «Тренировать красные и жёлтые». */
export function weakFromMap(map, topics) {
  return topics.filter((t) => ['review', 'unsure'].includes(map.get(t.id)?.status));
}

/**
 * Начало четверти: 1–14 сентября, ноября, января, апреля. Возвращает ключ «2026-11» или null.
 * Даты примерные (в Москве учатся по модулям), поэтому карточку на главной можно закрыть.
 */
export function quarterStartKey(date = new Date()) {
  const m = date.getMonth(); // 0 — январь
  if (![8, 10, 0, 3].includes(m) || date.getDate() > 14) return null;
  return `${date.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
}
