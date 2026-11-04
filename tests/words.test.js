import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateWordList, unitWords, confusable, chooseOptions, normalizeEnglish, checkSpelling,
  createRound, answerRound, roundDone, roundScore, recordResult, sanitizeWords, defaultWords,
} from '../js/words.js';

const list = JSON.parse(await readFile(new URL('../data/english-words-4.json', import.meta.url), 'utf8'));
const byId = (id) => list.words.find((w) => w.id === id);
let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('список слов: без ошибок, 12 юнитов, в каждом есть слова', () => {
  assert.deepEqual(validateWordList(list), []);
  assert.equal(list.units.length, 12);
  for (const u of list.units) assert.ok(unitWords(list, u.n).length >= 10, `юнит ${u.n}`);
  assert.equal(list.verified, false);
});

test('проверка списка ловит ошибки', () => {
  const bad = { units: [{ n: 1, title: 'A', ru: 'А' }], words: [{ id: 'x', en: 'кот', ru: '', unit: 2 }, { id: 'x', en: 'cat', ru: 'кот', unit: 1 }] };
  assert.equal(validateWordList(bad).length, 4);
});

test('похожие слова не ставятся рядом вариантами', () => {
  assert.ok(confusable(byId('home'), byId('house'))); // «дом (родной)» и «дом»
  assert.ok(confusable(byId('get'), byId('get-2'))); // одно английское слово
  assert.ok(confusable(byId('city'), byId('town')));
  assert.ok(!confusable(byId('cow'), byId('goat')));
});

test('варианты: правильный есть, всего 4, путаницы нет', () => {
  const pool = unitWords(list, 2);
  for (const w of pool) {
    const opts = chooseOptions(w, pool, list.words, 4, random);
    assert.equal(opts.length, 4);
    assert.ok(opts.some((o) => o.id === w.id));
    for (const a of opts) for (const b of opts) if (a !== b) assert.ok(!confusable(a, b), `${a.id} и ${b.id}`);
  }
  // В маленьком наборе не хватает слов — добираем из всего списка.
  assert.equal(chooseOptions(byId('cow'), [byId('cow'), byId('goat')], list.words, 4, random).length, 4);
});

test('написание: регистр, пробелы, é и апостроф не важны', () => {
  assert.equal(normalizeEnglish('  CD   Player '), 'cd player');
  assert.ok(checkSpelling(byId('cafe'), 'cafe'));
  assert.ok(checkSpelling(byId('new-york'), 'new york'));
  assert.ok(!checkSpelling(byId('beans'), 'bean'));
});

test('тренировка: ошибка — слово ещё раз в конце, счёт по первой попытке', () => {
  const words = [byId('cow'), byId('goat'), byId('hen')];
  let r = createRound(words, random);
  const [a, b, c] = r.queue;
  r = answerRound(r, a, true);
  r = answerRound(r, b, false);
  r = answerRound(r, c, true);
  assert.equal(roundDone(r), false);
  assert.equal(r.queue[3], b);
  r = answerRound(r, b, false); // второй раз ошибся — больше не повторяем
  assert.equal(roundDone(r), true);
  assert.deepEqual(roundScore(r), { correct: 2, total: 3 });
});

test('результаты: лучший и последний, повреждённое отбрасывается', () => {
  let d = recordResult(defaultWords(), 3, 'write', { correct: 8, total: 10 }, 5);
  d = recordResult(d, 3, 'write', { correct: 5, total: 10 }, 6);
  assert.deepEqual(d.results['3:write'], { best: 80, last: 50, at: 6 });
  const clean = sanitizeWords({ results: { '3:write': d.results['3:write'], '1:cards': { best: 1, last: 1, at: 1 }, '2:choose': { best: 200, last: 1, at: 1 } } });
  assert.deepEqual(Object.keys(clean.results), ['3:write']);
  assert.deepEqual(sanitizeWords(null), { results: {} });
});
