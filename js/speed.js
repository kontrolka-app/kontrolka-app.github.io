// Тренажёр скорости чтения: подсчёт слов, слов в минуту, вопросы на понимание, хранение результатов. Без DOM.
// Это тренажёр для себя: проверить, что текст действительно прочитан, нельзя.

export const SPEED_RECORDS_LIMIT = 100;
export const SPEED_QUESTIONS = 4;
/** Быстрее этого не читают даже взрослые — значит, «Стоп» нажат раньше, чем дочитан текст. */
export const MAX_WPM = 400;

/** Слов в тексте: считаются только «слова» с буквами или цифрами (тире и кавычки — нет). */
export function wordCount(paragraphs) {
  return (Array.isArray(paragraphs) ? paragraphs : [paragraphs])
    .join(' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Слов в минуту, целое. Меньше 3 секунд или быстрее MAX_WPM — не считаем (нажато раньше времени). */
export function wordsPerMinute(words, ms) {
  if (!Number.isFinite(ms) || ms < 3000 || !words) return null;
  const wpm = Math.round((words * 60000) / ms);
  return wpm > MAX_WPM ? null : wpm;
}

/** Вопросы на понимание к тексту: первые несколько с выбором ответа или «верно/неверно», в порядке данных. */
export function speedQuestions(questions, passageId, n = SPEED_QUESTIONS) {
  return questions.filter((q) => q.passageId === passageId && (q.type === 'single-choice' || q.type === 'true-false')).slice(0, n);
}

/** Тексты, подходящие для тренажёра: прозаические (стихи читают иначе) и с вопросами на понимание. */
export function speedPassages(passages, questions) {
  return passages.filter((p) => !p.poem && speedQuestions(questions, p.id).length >= 3);
}

/** Запись результата: { passageId, at, words, ms, wpm, understood, total }. */
export function speedRecord({ passageId, words, ms, understood, total, now = Date.now() }) {
  return { passageId, at: now, words, ms: Math.round(ms), wpm: wordsPerMinute(words, ms), understood, total };
}

/** Лучший и последний результат по тексту (записи — новые сначала). */
export function speedSummary(records, passageId) {
  const mine = records.filter((r) => r.passageId === passageId);
  if (!mine.length) return null;
  return { last: mine[0], best: mine.reduce((b, r) => (r.wpm > b.wpm ? r : b)), count: mine.length };
}

/** Проверка сохранённых записей: повреждённое отбрасывается. */
export function sanitizeSpeed(raw) {
  if (!Array.isArray(raw)) return [];
  const ok = (r) =>
    r && typeof r.passageId === 'string' && r.passageId.length < 100 &&
    Number.isFinite(r.at) && Number.isInteger(r.words) && r.words > 0 &&
    Number.isFinite(r.ms) && r.ms > 0 && Number.isInteger(r.wpm) && r.wpm > 0 &&
    Number.isInteger(r.total) && r.total >= 0 && Number.isInteger(r.understood) && r.understood >= 0 && r.understood <= r.total;
  return raw.filter(ok).slice(0, SPEED_RECORDS_LIMIT);
}

/**
 * Норма скорости чтения вслух для 4 класса — из пособия «Тексты для проверки техники чтения»
 * (uchebniki/texty_dlya_proverki.pdf, таблица норм), согласовано 2026-10-30:
 * I полугодие — не менее 75–80 слов в минуту, II полугодие — не менее 85–95.
 */
export const SPEED_NORM_4 = { first: { min: 75, max: 80, label: 'I полугодие' }, second: { min: 85, max: 95, label: 'II полугодие' } };

/** Полугодие по дате: сентябрь–декабрь — первое, январь–август — второе (летом ориентир — конец года). */
export function speedNorm(now = Date.now()) {
  const month = new Date(now).getMonth(); // 0 — январь
  return month >= 8 ? SPEED_NORM_4.first : SPEED_NORM_4.second;
}

/** Сравнение с нормой: 'below' — пока ниже, 'ok' — в норме, 'above' — выше нормы. */
export function compareToNorm(wpm, norm) {
  if (wpm < norm.min) return 'below';
  return wpm > norm.max ? 'above' : 'ok';
}
