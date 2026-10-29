import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, reportRecord, isReported, sanitizeReports, REPORT_COMMENT_MAX } from '../js/reports.js';
import { sanitizeData } from '../js/storage.js';

const item = { questionId: 'm4-rep-013', subject: 'Математика', topic: 'Порядок действий', question: '456 … 465', given: '>', correct: '<' };

test('сообщение об ошибке: id, тема, вопрос и оба ответа; имя — только если подписался', () => {
  const text = buildReport(item, { kind: 'wrong-answer' });
  assert.match(text, /m4-rep-013 \(Математика · Порядок действий\)/);
  assert.match(text, /Что не так: Неверный ответ/);
  assert.match(text, /Ответ ученика: >/);
  assert.match(text, /Ответ в приложении: </);
  assert.doesNotMatch(text, /Ученик:/);
  assert.doesNotMatch(text, /Комментарий:/);
  assert.match(buildReport(item, { kind: 'typo', nickname: 'Макс' }), /Ученик: Макс/);
});

test('комментарий обрезается до лимита, неизвестный вид — «Другое»', () => {
  const text = buildReport(item, { kind: '???', comment: `  ${'а'.repeat(400)}  ` });
  assert.match(text, /Что не так: Другое/);
  assert.equal(text.split('\n').find((l) => l.startsWith('Комментарий: ')).length, 'Комментарий: '.length + REPORT_COMMENT_MAX);
});

test('отметка «уже сообщил» и проверка сохранённых записей', () => {
  const r = reportRecord('q1', 'typo', 1000);
  assert.deepEqual(r, { questionId: 'q1', kind: 'typo', at: 1000 });
  assert.equal(isReported([r], 'q1'), true);
  assert.equal(isReported([r], 'q2'), false);
  assert.deepEqual(sanitizeReports([r, { questionId: 5 }, null, { questionId: 'q3', kind: 'xxx', at: 1 }]), [r]);
  assert.deepEqual(sanitizeReports('мусор'), []);
  // Старые данные без поля reports читаются как раньше.
  assert.deepEqual(sanitizeData({ schemaVersion: 1 }).data.reports, []);
  assert.deepEqual(sanitizeData({ schemaVersion: 1, reports: [r] }).data.reports, [r]);
});
