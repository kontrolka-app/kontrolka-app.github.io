// «Нашёл ошибку в задании?» — текст сообщения автору и учёт отправленных. Без DOM.
// Ответ ученика не пересчитывается: решение принимает автор и правит данные сам.

export const REPORT_KINDS = {
  'wrong-answer': 'Неверный ответ',
  typo: 'Опечатка',
  unclear: 'Непонятный вопрос',
  other: 'Другое',
};
export const REPORT_COMMENT_MAX = 300;
export const REPORTS_LIMIT = 500;

/**
 * Текст сообщения для копирования.
 * item: { questionId, subject?, topic?, question, given, correct }; nickname — только если ученик подписался.
 */
export function buildReport(item, { kind, comment = '', nickname = '' } = {}) {
  const note = String(comment).trim().slice(0, REPORT_COMMENT_MAX);
  const where = [item.subject, item.topic].filter(Boolean).join(' · ');
  return [
    'Контролька: ошибка в задании',
    `Что не так: ${REPORT_KINDS[kind] || REPORT_KINDS.other}`,
    `Задание: ${item.questionId}${where ? ` (${where})` : ''}`,
    `Вопрос: ${item.question}`,
    `Ответ ученика: ${item.given}`,
    `Ответ в приложении: ${item.correct}`,
    note ? `Комментарий: ${note}` : null,
    nickname ? `Ученик: ${nickname}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Запись об отправленном сообщении — чтобы у вопроса появилась пометка «Ты уже сообщил». */
export function reportRecord(questionId, kind, now = Date.now()) {
  return { questionId, kind: REPORT_KINDS[kind] ? kind : 'other', at: now };
}

export function isReported(reports, questionId) {
  return reports.some((r) => r.questionId === questionId);
}

/** Проверка сохранённых записей: лишнее и повреждённое отбрасывается. */
export function sanitizeReports(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r.questionId === 'string' && r.questionId.length > 0 && r.questionId.length < 200 && REPORT_KINDS[r.kind] && Number.isFinite(r.at))
    .slice(0, REPORTS_LIMIT);
}
