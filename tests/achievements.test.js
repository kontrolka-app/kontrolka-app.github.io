import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGES, catalogInfo, badgesForEntry, badgesForTotals, award, badgesFromHistory, sanitizeBadges } from '../js/achievements.js';
import { emptyStats } from '../js/stats.js';
import { sanitizeData } from '../js/storage.js';

const topics = [
  { id: 'm1', subjectId: 'math', section: 'Числа' },
  { id: 'm2', subjectId: 'math', section: 'Числа' },
  { id: 'mo', subjectId: 'math', section: 'Олимпиада' },
  { id: 'mv', subjectId: 'math', section: 'ВПР и МЦКО' },
  { id: 'r1', subjectId: 'russian', section: 'Глагол' },
];
const cat = catalogInfo(topics);
const rv = (topicId, statuses) => statuses.map((s, i) => ({ questionId: `${topicId}-${i}`, topicId, status: s }));
const entry = (review, extra = {}) => {
  const topicStats = {};
  for (const r of review) {
    topicStats[r.topicId] = topicStats[r.topicId] || { total: 0, correct: 0 };
    topicStats[r.topicId].total++;
    if (r.status === 'correct') topicStats[r.topicId].correct++;
  }
  const correct = review.filter((r) => r.status === 'correct').length;
  return { id: 'e', finishedAt: 100, total: review.length, correct, skipped: 0, topicStats, review, source: { kind: 'topic', title: 'Тема' }, ...extra };
};

test('15 значков, больше половины — не за 100%', () => {
  assert.equal(BADGES.length, 15);
  const forPerfection = ['perfect', 'sniper', 'olympiad'];
  assert.ok(BADGES.length - forPerfection.length > BADGES.length / 2);
});

test('значки за тренировку', () => {
  const ten = Array(10).fill('correct');
  assert.deepEqual([...badgesForEntry(entry(rv('m1', ten)), {}, cat)].sort(), ['perfect', 'sniper']);
  assert.deepEqual([...badgesForEntry(entry(rv('m1', [...Array(9).fill('correct'), 'wrong'])), {}, cat)], []);
  assert.ok(badgesForEntry(entry(rv('m1', ['correct', 'correct']), { source: { title: 'Работа над ошибками: Тема' } }), {}, cat).has('fixer'));
  assert.ok(!badgesForEntry(entry(rv('m1', ['correct', 'wrong']), { source: { title: 'Работа над ошибками: Тема' } }), {}, cat).has('fixer'));
  assert.ok(badgesForEntry(entry(rv('m1', ['correct', 'correct', 'correct', 'correct', 'wrong'])), { m1: 40 }, cat).has('leap'));
  assert.ok(!badgesForEntry(entry(rv('m1', ['correct'])), {}, cat).has('leap'), 'без прошлой попытки рывка нет');
  assert.ok(badgesForEntry(entry(rv('mo', ['correct'])), {}, cat).has('olympiad'));
  assert.ok(badgesForEntry(entry(rv('mv', [...Array(6).fill('correct'), ...Array(4).fill('wrong')])), {}, cat).has('vpr'));
  assert.ok(!badgesForEntry(entry(rv('mv', ['correct'])), {}, cat).has('vpr'), 'вариант ВПР — от 10 вопросов');
});

test('значки по счётчикам', () => {
  const s = { ...emptyStats(), questions: 520, bestStreak: 7, days: Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`), topicLast: { m1: 90, m2: 85, r1: 10 } };
  const got = badgesForTotals(s, [{ origin: 'own' }], cat);
  assert.deepEqual([...got].sort(), ['expert', 'first', 'month', 'q100', 'q500', 'teacher', 'traveler', 'week']);
  assert.ok(!badgesForTotals(emptyStats(), [{ origin: 'imported' }], cat).has('teacher'));
  assert.ok(!badgesForTotals({ ...emptyStats(), topicLast: { m1: 90 } }, [], cat).has('traveler'));
});

test('получение: дата запоминается, повторно не выдаётся; история; проверка сохранённого', () => {
  let r = award({}, ['first', 'perfect', 'чужой'], 5);
  assert.deepEqual(r.added, ['first', 'perfect']);
  r = award(r.badges, ['first', 'week'], 9);
  assert.deepEqual(r.added, ['week']);
  assert.equal(r.badges.first, 5);
  const old = entry(rv('m1', ['wrong', 'wrong', 'correct']), { finishedAt: 10 });
  const better = entry(rv('m1', Array(10).fill('correct')), { finishedAt: 20 });
  const found = badgesFromHistory([better, old], cat);
  assert.equal(found.get('leap'), 20);
  assert.equal(found.get('perfect'), 20);
  assert.deepEqual(sanitizeBadges({ first: 5, nope: 1, week: 'x' }), { first: 5 });
  assert.deepEqual(sanitizeData({ schemaVersion: 1 }).data.badges, {});
});
