import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wordCount, wordsPerMinute, speedQuestions, speedPassages, speedRecord, speedSummary, sanitizeSpeed } from '../js/speed.js';
import { sanitizeData } from '../js/storage.js';

test('слова и скорость', () => {
  assert.equal(wordCount(['— Можно я покатаюсь? — спросил Миша.', 'Да!']), 6, 'тире словами не считаются');
  assert.equal(wordsPerMinute(80, 60000), 80);
  assert.equal(wordsPerMinute(120, 90000), 80);
  assert.equal(wordsPerMinute(100, 2000), null, 'меньше 3 секунд — случайное нажатие');
  assert.equal(wordsPerMinute(0, 60000), null);
  assert.equal(wordsPerMinute(150, 10000), null, '900 слов в минуту — «Стоп» нажат раньше времени');
});

test('тексты и вопросы для тренажёра', () => {
  const qs = [
    { id: '1', passageId: 'p', type: 'single-choice' },
    { id: '2', passageId: 'p', type: 'digits' },
    { id: '3', passageId: 'p', type: 'true-false' },
    { id: '4', passageId: 'p', type: 'single-choice' },
    { id: '5', passageId: 'p', type: 'single-choice' },
    { id: '6', passageId: 'p', type: 'single-choice' },
    { id: '7', passageId: 'poem', type: 'single-choice' },
  ];
  assert.deepEqual(speedQuestions(qs, 'p').map((q) => q.id), ['1', '3', '4', '5']);
  const passages = [{ id: 'p' }, { id: 'poem', poem: true }, { id: 'empty' }];
  assert.deepEqual(speedPassages(passages, qs).map((p) => p.id), ['p']);
});

test('записи: сводка и проверка сохранённого', () => {
  const a = speedRecord({ passageId: 'p', words: 120, ms: 90000, understood: 3, total: 4, now: 1 });
  const b = speedRecord({ passageId: 'p', words: 120, ms: 72000, understood: 4, total: 4, now: 2 });
  assert.equal(a.wpm, 80);
  assert.equal(b.wpm, 100);
  const s = speedSummary([b, a], 'p');
  assert.equal(s.last, b);
  assert.equal(s.best, b);
  assert.equal(s.count, 2);
  assert.equal(speedSummary([], 'p'), null);
  assert.deepEqual(sanitizeSpeed([a, { passageId: 'p', wpm: 'x' }, null]), [a]);
  assert.deepEqual(sanitizeSpeed('мусор'), []);
  // Старые данные без поля speed читаются как раньше.
  assert.deepEqual(sanitizeData({ schemaVersion: 1 }).data.speed, []);
  assert.deepEqual(sanitizeData({ schemaVersion: 1, speed: [a] }).data.speed, [a]);
});
