// Тренажёр примеров: источник тренировки, последний результат и ошибки по истории. Без DOM.
import { DRILL_BY_ID, LEVEL_LABELS, generateSet, questionFromId } from './generators.js';

/** Источник тренировки для истории и «Пройти ещё раз». */
export function drillSource(drillId, level) {
  const d = DRILL_BY_ID.get(drillId);
  return { kind: 'drill', drillId, level, subjectId: 'math', title: `Тренажёр: ${d ? d.title : drillId} (${LEVEL_LABELS[level] || level})` };
}

/** Новый набор примеров тренажёра. */
export function drillQuestions(drillId, level, count, rng = Math.random) {
  return generateSet(drillId, level, count, rng);
}

/** Примеры по id из истории (для «Повторить ошибки»). Испорченные id пропускаются. */
export function drillQuestionsByIds(ids) {
  const qs = ids.map(questionFromId).filter(Boolean);
  return { questions: qs, missing: qs.length < ids.length };
}

const isDrillEntry = (h, drillId) => h.source?.kind === 'drill' && h.source.drillId === drillId;

/** Последняя тренировка тренажёра (история — новые сначала): { percent, level, finishedAt } или null. */
export function lastDrillResult(history, drillId) {
  const e = history.find((h) => isDrillEntry(h, drillId));
  return e ? { percent: e.percent, level: e.source.level, finishedAt: e.finishedAt } : null;
}

/**
 * Неразобранные ошибки тренажёра: примеры, на которые в последний раз ответили неверно или пропустили.
 * Если потом пример решён верно (в «Повторить ошибки») — он больше не считается ошибкой.
 */
export function drillMistakes(history, drillId, limit = 20) {
  const seen = new Set();
  const ids = [];
  for (const h of history) {
    if (!isDrillEntry(h, drillId)) continue;
    for (const r of h.review || []) {
      if (seen.has(r.questionId)) continue;
      seen.add(r.questionId);
      if (r.status !== 'correct') ids.push(r.questionId);
    }
  }
  return ids.slice(0, limit);
}
