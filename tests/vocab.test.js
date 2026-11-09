import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateVocab, findGroup, plain, parts, gapped, checkWord, misspellings, spellingOptions, alphaCompare, alphabetOrder,
  createAlphabet, tapAlphabet, alphabetDone, alphabetScore, modeWords, recordVocab, groupProgress, sanitizeVocab, defaultVocab, POS_LABELS,
} from '../js/vocab.js';
import { defaultData, sanitizeData } from '../js/storage.js';

const list = JSON.parse(await readFile(new URL('../data/vocab-4.json', import.meta.url), 'utf8'));
const all = list.groups.flatMap((g) => g.words);
const byWord = (s) => all.find((w) => plain(w) === s) ?? assert.fail(`нет слова ${s}`);
let seed = 1;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test('список: 16 групп как в листе учителя, 143 слова, без ошибок', () => {
  assert.deepEqual(validateVocab(list), []);
  assert.equal(list.groups.length, 16);
  assert.equal(all.length, 143);
  assert.equal(findGroup(list, 3).words.length, 8);
  assert.deepEqual(findGroup(list, 1).words.slice(0, 2).map(plain), ['желание', 'желать']);
  assert.deepEqual(findGroup(list, 16).words.map(plain).at(-1), 'директор');
  assert.equal(list.verified, false);
});

test('у каждого слова есть запись для диктанта', async () => {
  const { readdir } = await import('node:fs/promises');
  const files = new Set(await readdir(new URL(`../${list.audio}/`, import.meta.url)));
  for (const w of all) assert.ok(files.has(`${w.id}.mp3`), `нет записи ${w.id}`);
  assert.equal(files.size, all.length, 'лишние записи');
});

test('проверка списка ловит ошибки', () => {
  const bad = { groups: [{ n: 1, words: [{ id: 'g1-1', w: 'коридор' }, { id: 'g1-1', w: 'к[о]мод', pos: 'x' }, { id: 'x', w: 'car[a]' }] }] };
  const errors = validateVocab(bad);
  assert.ok(errors.some((e) => e.includes('трудное место')));
  assert.ok(errors.some((e) => e.includes('повторяется')));
  assert.ok(errors.some((e) => e.includes('часть речи')));
  assert.ok(errors.some((e) => e.includes('русские буквы')));
  assert.deepEqual(validateVocab(null), ['Нет groups']);
});

test('у каждого слова есть хотя бы одно трудное место и хотя бы один неверный вариант', () => {
  for (const w of all) {
    assert.ok(parts(w).some((p) => p.hard), plain(w));
    const wrong = misspellings(w);
    assert.ok(wrong.length >= 1, plain(w));
    assert.ok(!wrong.includes(plain(w)), plain(w));
  }
});

test('пропуски и проверка написания', () => {
  const k = byWord('коридор');
  assert.equal(gapped(k), 'к…р…дор');
  assert.equal(gapped(byWord('потому что')), 'потому…что');
  assert.ok(checkWord(k, '  Коридор '), 'большая буква в начале (телефон ставит сам) не ошибка');
  assert.ok(!checkWord(k, 'каридор'));
  assert.ok(checkWord(byWord('шофёр'), 'шофер'), 'ё = е');
  assert.ok(checkWord(byWord('потому что'), 'потому  что'));
  assert.ok(!checkWord(byWord('потому что'), 'потомучто'));
  assert.ok(checkWord(byWord('Россия'), 'Россия'));
  assert.ok(!checkWord(byWord('Россия'), 'россия'), 'Россия — с большой буквы');
});

test('неверные написания правдоподобные', () => {
  assert.deepEqual(misspellings(byWord('ванна')), ['вана']);
  assert.ok(misspellings(byWord('потому что')).includes('потому-что'));
  assert.ok(misspellings(byWord('лёгкий')).includes('лёхкий'));
  assert.ok(misspellings(byWord('столько')).includes('столко'));
  const opts = spellingOptions(byWord('коридор'), 4, random);
  assert.equal(opts.length, 4);
  assert.ok(opts.includes('коридор'));
  assert.equal(new Set(opts).size, 4);
  assert.deepEqual(spellingOptions(byWord('грипп'), 4, random).sort(), ['грип', 'грипп']);
});

test('алфавит: ё после е, пробел раньше букв', () => {
  assert.ok(alphaCompare('легко', 'лёгкий') < 0);
  assert.ok(alphaCompare('как будто', 'какао') < 0);
  assert.ok(alphaCompare('Россия', 'салют') < 0);
  const g6 = findGroup(list, 6);
  assert.deepEqual(alphabetOrder(g6.words).map((id) => plain(g6.words.find((w) => w.id === id))),
    ['волноваться', 'каникулы', 'колесо', 'команда', 'командир', 'командовать', 'легко', 'лёгкий', 'орех']);
});

test('«По алфавиту»: неверное нажатие — ошибка, слово не ставится', () => {
  const words = findGroup(list, 4).words.slice(0, 3); // комод, портрет, газета
  let s = createAlphabet(words);
  let r = tapAlphabet(s, 'g4-2');
  assert.equal(r.ok, false);
  s = r.state;
  for (const id of ['g4-3', 'g4-1', 'g4-2']) {
    r = tapAlphabet(s, id);
    assert.equal(r.ok, true, id);
    s = r.state;
  }
  assert.ok(alphabetDone(s));
  assert.deepEqual(alphabetScore(s), { correct: 2, total: 3 });
});

test('«Часть речи»: без «потому что», «как будто», «около», «столько»', () => {
  const g3 = modeWords(findGroup(list, 3), 'pos').map(plain);
  assert.ok(!g3.includes('потому что') && !g3.includes('как будто'));
  assert.equal(byWord('около').pos, undefined);
  assert.equal(byWord('столько').pos, undefined);
  assert.equal(modeWords(findGroup(list, 3), 'gaps').length, 8);
  for (const w of all) if (w.pos) assert.ok(POS_LABELS[w.pos]);
  assert.equal(byWord('восемь').pos, 'num');
  assert.equal(byWord('жужжит').pos, 'verb');
});

test('результаты: лучший и последний, прогресс группы, очистка мусора', () => {
  let v = defaultVocab();
  v = recordVocab(v, 4, 'dictation', { correct: 9, total: 9 }, 1);
  v = recordVocab(v, 4, 'dictation', { correct: 6, total: 9 }, 2);
  v = recordVocab(v, 4, 'gaps', { correct: 3, total: 9 }, 3);
  assert.deepEqual(v.results['4:dictation'], { best: 100, last: 67, at: 2 });
  assert.deepEqual(groupProgress(v, 4), { tried: 2, perfect: 1, total: 5 });
  assert.deepEqual(groupProgress(v, 5), { tried: 0, perfect: 0, total: 5 });
  const clean = sanitizeVocab({ results: { ...v.results, '4:cards': { best: 1, last: 1, at: 1 }, '1:pos': { best: 120, last: 1, at: 1 }, x: 1 } });
  assert.deepEqual(Object.keys(clean.results).sort(), ['4:dictation', '4:gaps']);
  assert.deepEqual(sanitizeVocab('мусор'), defaultVocab());
});

test('хранилище: старые данные без vocab получают пустые результаты', () => {
  const old = defaultData();
  delete old.vocab;
  const { data } = sanitizeData(old);
  assert.deepEqual(data.vocab, defaultVocab());
  const withVocab = { ...defaultData(), vocab: recordVocab(defaultVocab(), 2, 'pos', { correct: 1, total: 2 }, 5) };
  assert.equal(sanitizeData(withVocab).data.vocab.results['2:pos'].last, 50);
});
