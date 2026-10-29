import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStats, addEntry, statsFromHistory, longestStreak, masteredCount, sanitizeStats } from '../js/stats.js';
import { sanitizeData, defaultData } from '../js/storage.js';

const at = (day) => new Date(2026, 9, day, 12).getTime();
const entry = (day, total, correct, skipped = 0, topicStats = {}) => ({ id: `e${day}-${total}`, finishedAt: at(day), total, correct, skipped, topicStats, percent: Math.round((correct / total) * 100), source: { kind: 'topic' }, review: [] });

test('серия дней подряд', () => {
  assert.equal(longestStreak([]), 0);
  assert.equal(longestStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05']), 3);
  assert.equal(longestStreak(['2026-10-31', '2026-11-01']), 2, 'через границу месяца');
});

test('тренировка добавляет день, вопросы, верные и последний % по темам', () => {
  let s = addEntry(emptyStats(), entry(1, 10, 7, 2, { t1: { total: 10, correct: 7 } }));
  assert.deepEqual(s.days, ['2026-10-01']);
  assert.equal(s.questions, 8, 'пропуски не считаются');
  assert.equal(s.correct, 7);
  assert.equal(s.topicLast.t1, 70);
  s = addEntry(s, entry(2, 5, 5, 0, { t1: { total: 5, correct: 5 } }));
  assert.equal(s.bestStreak, 2);
  assert.equal(masteredCount(s), 1);
  // Всё пропущено — день не засчитывается.
  s = addEntry(s, entry(3, 4, 0, 4));
  assert.deepEqual(s.days, ['2026-10-01', '2026-10-02']);
});

test('нет счётчиков в старых данных — считаем из истории; повреждённое отбрасывается', () => {
  const history = [entry(2, 5, 5), entry(1, 10, 6)]; // новые сначала
  const s = statsFromHistory(history);
  assert.equal(s.questions, 15);
  assert.equal(s.bestStreak, 2);
  const migrated = sanitizeData({ schemaVersion: 1, history }).data.stats;
  assert.equal(migrated.questions, 15, 'старые данные без stats: счётчики из истории');
  assert.equal(migrated.days.length, 2);
  const good = { ...defaultData(), history: [] };
  assert.deepEqual(sanitizeData(good).data.stats, emptyStats());
  const r = sanitizeStats({ days: ['2026-10-01', 'мусор', '2026-10-01'], questions: 5, correct: 9, bestStreak: -1, topicLast: { a: 150, b: 40 } }, []);
  assert.deepEqual(r.days, ['2026-10-01']);
  assert.equal(r.correct, 5);
  assert.equal(r.bestStreak, 1);
  assert.deepEqual(r.topicLast, { b: 40 });
});
