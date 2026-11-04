import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateWordList, unitWords, bookWords, unitLabel, unitName, findBook, confusable, chooseOptions, normalizeEnglish, checkSpelling,
  createRound, answerRound, roundDone, roundScore, recordResult, sanitizeWords, defaultWords,
} from '../js/words.js';

const list = JSON.parse(await readFile(new URL('../data/english-words-4.json', import.meta.url), 'utf8'));
const byId = (id) => list.words.find((w) => w.id === id) ?? assert.fail(`нет слова ${id}`);
let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('список слов: без ошибок, два учебника, в каждом юните есть слова', () => {
  assert.deepEqual(validateWordList(list), []);
  assert.deepEqual(list.books.map((b) => b.id), ['ew3', 'sp4']);
  const ew3 = findBook(list, 'ew3');
  const sp4 = findBook(list, 'sp4');
  assert.equal(ew3.units.length, 12);
  for (const b of list.books) for (const u of b.units) assert.ok(unitWords(list, b.id, u.n).length >= 5, `${b.id} ${u.n}`);
  assert.equal(bookWords(list, 'ew3').length + bookWords(list, 'sp4').length, list.words.length);
  assert.equal(unitLabel(ew3, ew3.units[2]), 'Unit 3');
  assert.equal(unitLabel(sp4, sp4.units[0]), 'Starter');
  assert.equal(unitLabel(sp4, sp4.units[1]), 'Module 1');
  assert.equal(unitName(sp4, sp4.units[0]), 'Starter Unit');
  assert.equal(unitName(ew3, ew3.units[2]), 'Unit 3. People at work');
  assert.equal(list.verified, false);
});

test('проверка списка ловит ошибки', () => {
  const bad = { books: [{ id: 'b', title: 'B', groupName: 'Unit', units: [{ n: 1, title: 'A', ru: 'А' }] }], words: [{ id: 'x', book: 'b', en: 'кот', ru: '', unit: 2 }, { id: 'x', book: 'b', en: 'cat', ru: 'кот', unit: 1, passive: 1 }] };
  assert.equal(validateWordList(bad).length, 5);
});

test('похожие слова не ставятся рядом вариантами', () => {
  assert.ok(confusable(byId('ew3-home'), byId('ew3-house'))); // «дом (родной)» и «дом»
  assert.ok(confusable(byId('ew3-get'), byId('ew3-get-2'))); // одно английское слово
  assert.ok(confusable(byId('ew3-city'), byId('ew3-town')));
  assert.ok(!confusable(byId('ew3-cow'), byId('ew3-goat')));
});

test('варианты: правильный есть, всего 4, путаницы нет', () => {
  for (const [book, n] of [['ew3', 2], ['sp4', 7]]) for (const w of unitWords(list, book, n)) {
    const opts = chooseOptions(w, unitWords(list, book, n), bookWords(list, book), 4, random);
    assert.equal(opts.length, 4);
    assert.ok(opts.some((o) => o.id === w.id));
    for (const a of opts) for (const b of opts) if (a !== b) assert.ok(!confusable(a, b), `${a.id} и ${b.id}`);
  }
  // В маленьком наборе не хватает слов — добираем из всего списка.
  assert.equal(chooseOptions(byId('ew3-cow'), [byId('ew3-cow'), byId('ew3-goat')], list.words, 4, random).length, 4);
});

test('написание: регистр, пробелы, é и апостроф не важны', () => {
  assert.equal(normalizeEnglish('  CD   Player '), 'cd player');
  assert.ok(checkSpelling(byId('ew3-cafe'), 'cafe'));
  assert.ok(checkSpelling(byId('ew3-new-york'), 'new york'));
  assert.ok(checkSpelling(byId('sp4-bakers'), 'baker’s'));
  assert.ok(!checkSpelling(byId('ew3-beans'), 'bean'));
});

test('тренировка: ошибка — слово ещё раз в конце, счёт по первой попытке', () => {
  const words = [byId('ew3-cow'), byId('ew3-goat'), byId('ew3-hen')];
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
  let d = recordResult(defaultWords(), 'sp4', 3, 'write', { correct: 8, total: 10 }, 5);
  d = recordResult(d, 'sp4', 3, 'write', { correct: 5, total: 10 }, 6);
  assert.deepEqual(d.results['sp4-3:write'], { best: 80, last: 50, at: 6 });
  const clean = sanitizeWords({ results: { 'sp4-3:write': d.results['sp4-3:write'], 'ew3-1:cards': { best: 1, last: 1, at: 1 }, 'ew3-2:choose': { best: 200, last: 1, at: 1 }, '3:write': { best: 1, last: 1, at: 1 } } });
  assert.deepEqual(Object.keys(clean.results), ['sp4-3:write']);
  assert.deepEqual(sanitizeWords(null), { results: {} });
});
