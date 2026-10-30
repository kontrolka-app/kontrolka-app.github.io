import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WONDERS, pickWonder, crossedWonder } from '../js/wonders.js';
import { emptyStats } from '../js/stats.js';

const st = (o) => ({ ...emptyStats(), ...o });

test('9 согласованных удивлялок, у каждой есть источник', () => {
  assert.equal(WONDERS.length, 9);
  for (const w of WONDERS) assert.ok(w.text && w.source && w.min > 0, w.id);
});

test('выбирается самая «крупная» из подходящих', () => {
  assert.equal(pickWonder(st({})), null);
  assert.equal(pickWonder(st({ days: Array(7).fill('d') })).id, 'days7');
  assert.equal(pickWonder(st({ days: Array(9).fill('d') })).id, 'days8');
  assert.equal(pickWonder(st({ days: Array(9).fill('d'), questions: 170 })).id, 'q160');
  assert.equal(pickWonder(st({ questions: 400, bestStreak: 31 })).id, 'q365');
  assert.equal(pickWonder(st({ questions: 1200 })).id, 'q1000');
  assert.equal(pickWonder(st({ questions: 1200 }), 21).id, 'poems21');
});

test('рубеж, перейдённый этой тренировкой', () => {
  assert.equal(crossedWonder(st({ questions: 165 }), 10).id, 'q160');
  assert.equal(crossedWonder(st({ questions: 175 }), 10), null, 'рубеж был перейдён раньше');
  assert.equal(crossedWonder(st({ questions: 1005 }), 10).id, 'q1000');
});
