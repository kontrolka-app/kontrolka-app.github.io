import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitWords, parsePoem, stepCount, lineAt, firstLetter, validatePoemInput } from '../js/poem.js';

const text = `Мороз и солнце; день чудесный!
Ещё ты дремлешь, друг прелестный —

Пора, красавица, проснись.`;

const view = (words, step, lines) => lineAt(words, step, lines).map((w) => (w.hidden ? (w.hint ? `${w.hint}…` : '_') : w.text)).join(' ');

test('разбивка: строфы по пустой строке, тире приклеено к слову', () => {
  const p = parsePoem(text);
  assert.equal(p.length, 2);
  assert.equal(p[0].length, 2);
  assert.deepEqual(p[0][1], ['Ещё', 'ты', 'дремлешь,', 'друг', 'прелестный —']);
  assert.deepEqual(splitWords('— Ты куда?'), ['— Ты', 'куда?']);
  assert.deepEqual(parsePoem('  \n\n '), []);
  assert.deepEqual(parsePoem('a\r\nb'), [[['a'], ['b']]]);
});

test('шаги: по слову с конца, потом первая буква, потом пусто', () => {
  const lines = parsePoem(text)[0];
  const [l1, l2] = lines; // 5 и 5 слов
  assert.equal(stepCount(lines), 7);
  assert.equal(view(l1, 0, lines), 'Мороз и солнце; день чудесный!');
  assert.equal(view(l1, 1, lines), 'Мороз и солнце; день _');
  assert.equal(view(l1, 4, lines), 'Мороз _ _ _ _');
  assert.equal(view(l2, 4, lines), 'Ещё _ _ _ _');
  assert.equal(view(l1, 5, lines), 'М… _ _ _ _');
  assert.equal(view(l1, 6, lines), '_ _ _ _ _');
});

test('короткая строка держит первое слово, пока длинные ещё закрываются', () => {
  const lines = [['Раз', 'два'], ['Один', 'два', 'три', 'четыре']];
  assert.equal(view(lines[0], 3, lines), 'Раз _');
  assert.equal(view(lines[1], 3, lines), 'Один _ _ _');
  assert.equal(view(lines[0], 4, lines), 'Р… _');
});

test('первая буква и проверка своего стихотворения', () => {
  assert.equal(firstLetter('«Буря'), '«Б');
  assert.equal(firstLetter('— Ты'), '— Т');
  assert.deepEqual(validatePoemInput({ title: 'Моё', text: 'строка' }), []);
  assert.equal(validatePoemInput({ title: ' ', text: '' }).length, 2);
  assert.equal(validatePoemInput({ title: 'x', text: 'а'.repeat(6000) }).length, 1);
});
