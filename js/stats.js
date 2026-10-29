// Счётчики за всё время: хранятся отдельно от истории (история обрезается, счётчики — нет). Без DOM.
import { dayKey, percentOf, MASTERED_PERCENT } from './results.js';

/** Пустые счётчики. topicLast — последний % по каждой теме (для «освоено тем» и значка «Рывок»). */
export function emptyStats() {
  return { days: [], bestStreak: 0, questions: 0, correct: 0, topicLast: {} };
}

/** Самая длинная серия дней подряд в отсортированном списке «2026-10-29». */
export function longestStreak(days) {
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    const t = Date.parse(`${d}T12:00:00`);
    run = prev !== null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/**
 * Добавляет завершённую тренировку (запись истории) к счётчикам; возвращает новые счётчики.
 * День засчитывается, только если решён хотя бы один вопрос (пропуски не считаются).
 */
export function addEntry(stats, entry) {
  const s = { ...stats, days: [...stats.days], topicLast: { ...stats.topicLast } };
  const answered = Math.max(0, (entry.total || 0) - (entry.skipped || 0));
  if (answered > 0 && entry.finishedAt) {
    const k = dayKey(entry.finishedAt);
    if (!s.days.includes(k)) {
      s.days.push(k);
      s.days.sort();
    }
  }
  s.questions += answered;
  s.correct += entry.correct || 0;
  for (const [topicId, t] of Object.entries(entry.topicStats || {})) {
    if (topicId !== '_custom' && t.total) s.topicLast[topicId] = percentOf(t.correct, t.total);
  }
  s.bestStreak = Math.max(s.bestStreak, longestStreak(s.days));
  return s;
}

/** Счётчики из истории — для тех, кто занимался до появления счётчиков (история — новые сначала). */
export function statsFromHistory(history) {
  return [...history].reverse().reduce(addEntry, emptyStats());
}

export function masteredCount(stats) {
  return Object.values(stats.topicLast).filter((p) => p >= MASTERED_PERCENT).length;
}

/** Проверка сохранённых счётчиков; если поля нет вовсе — считаем из истории. */
export function sanitizeStats(raw, history) {
  if (raw === undefined) return statsFromHistory(history);
  const s = emptyStats();
  if (!raw || typeof raw !== 'object') return s;
  if (Array.isArray(raw.days)) s.days = [...new Set(raw.days.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  for (const key of ['bestStreak', 'questions', 'correct']) if (Number.isInteger(raw[key]) && raw[key] >= 0) s[key] = raw[key];
  if (s.correct > s.questions) s.correct = s.questions;
  s.bestStreak = Math.max(s.bestStreak, longestStreak(s.days));
  if (raw.topicLast && typeof raw.topicLast === 'object' && !Array.isArray(raw.topicLast)) {
    for (const [id, p] of Object.entries(raw.topicLast)) if (id.length < 200 && Number.isFinite(p) && p >= 0 && p <= 100) s.topicLast[id] = p;
  }
  return s;
}
