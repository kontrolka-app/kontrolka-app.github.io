import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fillPhrase, pickPhrase, dayEvent, streakEvent, mistakeEvent, sanitizeCompanion } from '../js/companion.js';
import { PHRASES } from '../js/companion-phrases.js';
import { emptyStats } from '../js/stats.js';
import { sanitizeData } from '../js/storage.js';

test('16 согласованных фраз', () => {
  assert.equal(Object.values(PHRASES).reduce((n, g) => n + g.list.length, 0), 16);
});

test('подстановка имени и цели', () => {
  assert.equal(fillPhrase('Привет, {имя}! Сегодня цель — {N} вопросов. Начнём?', { name: 'Макс', goal: 20 }), 'Привет, Макс! Сегодня цель — 20 вопросов. Начнём?');
  assert.equal(fillPhrase('Привет, {имя}! Сегодня цель — {N} вопросов.', { goal: 10 }), 'Привет! Сегодня цель — 10 вопросов.');
});

test('одна и та же фраза не повторяется подряд', () => {
  const first = pickPhrase('mistake', { rng: () => 0 });
  for (let i = 0; i < 5; i++) assert.notEqual(pickPhrase('mistake', { last: first.key, rng: () => 0 }).key, first.key);
  assert.equal(pickPhrase('streak3', { last: 'streak3:0' }).key, 'streak3:0', 'единственную фразу можно повторить');
  assert.equal(pickPhrase('нет такого'), null);
  assert.equal(pickPhrase('newBadge').mood, 'happy');
});

test('события: начало дня, возвращение, серии, ошибки', () => {
  const now = new Date(2026, 9, 30, 9).getTime();
  assert.equal(dayEvent({ ...emptyStats(), days: ['2026-10-29'] }, '', now), 'dayStart');
  assert.equal(dayEvent({ ...emptyStats(), days: ['2026-10-29'] }, '2026-10-30', now), null, 'сегодня уже здоровались');
  assert.equal(dayEvent({ ...emptyStats(), days: ['2026-10-26'] }, '', now), 'returnBack');
  assert.equal(dayEvent(emptyStats(), '', now), 'dayStart');
  assert.deepEqual([2, 3, 4, 5, 10, 11].map(streakEvent), [null, 'streak3', null, 'streak5', 'streak10', null]);
  assert.deepEqual([1, 2, 3, 4, 6].map(mistakeEvent), ['mistake', null, 'mistake', null, 'mistake']);
  assert.deepEqual(sanitizeCompanion({ lastDay: 'x', lastPhrase: 'mistake:1' }), { lastDay: '', lastPhrase: 'mistake:1' });
  assert.equal(sanitizeData({ schemaVersion: 1 }).data.settings.companion, true, 'по умолчанию включён');
  assert.equal(sanitizeData({ schemaVersion: 1, settings: { companion: false } }).data.settings.companion, false);
});
