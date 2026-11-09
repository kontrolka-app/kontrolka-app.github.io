import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateVerbs, sanitizeVerbs, recordVerb, isLearned, pickRound, verbOptions, regularMistake, checkPast, LEARNED_STREAK } from '../js/verbs.js';

const list = JSON.parse(await readFile(new URL('../data/english-verbs-4.json', import.meta.url), 'utf8'));
const verb = (id) => list.verbs.find((v) => v.id === id) ?? assert.fail(id);
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('список глаголов: без ошибок, формы неправильные', () => {
  assert.deepEqual(validateVerbs(list), []);
  assert.ok(list.verbs.length >= 30);
  for (const v of list.verbs) assert.notEqual(v.past, regularMistake(v.base), `${v.id}: это правильный глагол`);
  assert.equal(validateVerbs({ verbs: [{ id: 'go', base: 'go', past: 'Went', ru: '' }, { id: 'go', base: 'go', past: 'went', ru: 'идти' }] }).length, 3);
});

test('выученность: два раза подряд верно, ошибка сбрасывает', () => {
  let s = recordVerb({}, 'buy', true, 1);
  assert.equal(isLearned(s, 'buy'), false);
  s = recordVerb(s, 'buy', true, 2);
  assert.equal(LEARNED_STREAK, 2);
  assert.equal(isLearned(s, 'buy'), true);
  s = recordVerb(s, 'buy', false, 3);
  assert.deepEqual(s.buy, { streak: 0, at: 3 });
  assert.deepEqual(sanitizeVerbs({ buy: { streak: 2, at: 5 }, BAD: { streak: 1, at: 1 }, go: { streak: -1, at: 1 }, see: null }), { buy: { streak: 2, at: 5 } });
  assert.deepEqual(sanitizeVerbs('мусор'), {});
});

test('круг: 10 глаголов, сначала невыученные', () => {
  const state = {};
  for (const v of list.verbs.slice(0, list.verbs.length - 5)) state[v.id] = { streak: 2, at: 1 };
  const round = pickRound(list.verbs, state, 10, random);
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map((v) => v.id)).size, 10);
  assert.ok(round.slice(0, 5).every((v) => !isLearned(state, v.id)));
});

test('варианты: верная форма, ловушка по правилу, без повторов', () => {
  for (const v of list.verbs) {
    const opts = verbOptions(v, list.verbs, random);
    assert.equal(opts.length, 4);
    assert.equal(new Set(opts).size, 4);
    assert.ok(opts.includes(v.past));
    assert.ok(opts.includes(regularMistake(v.base)));
  }
  assert.equal(regularMistake('make'), 'maked');
  assert.equal(regularMistake('buy'), 'buyed');
});

test('проверка формы: регистр и пробелы не важны', () => {
  assert.ok(checkPast(verb('buy'), ' Bought '));
  assert.ok(!checkPast(verb('buy'), 'buyed'));
});
