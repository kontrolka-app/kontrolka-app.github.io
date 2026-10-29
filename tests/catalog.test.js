import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTopics, availableGrades, resolveGrade, gradeRangesText } from '../js/catalog.js';

test('классы с заданиями: без повторов, по возрастанию, только 1–11', () => {
  assert.deepEqual(availableGrades([{ grade: 4 }, { grade: 2 }, { grade: 4 }, { grade: 12 }, {}]), [2, 4]);
  assert.deepEqual(availableGrades([]), []);
});

test('выбор класса: один класс с заданиями выбирается сам', () => {
  assert.equal(resolveGrade(null, [4]), 4);
  // Раньше можно было выбрать пустой класс — теперь подставляем тот, где есть задания.
  assert.equal(resolveGrade(7, [4]), 4);
  assert.equal(resolveGrade(4, [4]), 4);
});

test('выбор класса: несколько классов — обычный выбор', () => {
  assert.equal(resolveGrade(null, [3, 4]), null);
  assert.equal(resolveGrade(3, [3, 4]), 3);
  assert.equal(resolveGrade(7, [3, 4]), null);
});

test('выбор класса: задания не загрузились — выбор не трогаем', () => {
  assert.equal(resolveGrade(4, []), 4);
  assert.equal(resolveGrade(null, []), null);
});

test('строка «Скоро»: диапазоны классов', () => {
  assert.equal(gradeRangesText([1, 2, 3, 5, 6, 7, 8, 9, 10, 11]), '1–3, 5–11');
  assert.equal(gradeRangesText([2, 5]), '2, 5');
  assert.equal(gradeRangesText([]), '');
});

const topics = [
  { id: 't1', title: 'Глагол', section: 'Части речи', description: 'Что делать? Что сделать?' },
  { id: 't2', title: 'Ёмкость сосудов', section: 'Величины', description: '' },
];

test('поиск тем: пустой запрос — все темы и без «ничего не нашлось»', () => {
  const r = searchTopics(topics, '   ');
  assert.equal(r.found.length, 2);
  assert.equal(r.nothingFound, false);
});

test('поиск тем: нет тем (класс не выбран) и пустой запрос — не «ничего не нашлось»', () => {
  const r = searchTopics([], '');
  assert.deepEqual(r.found, []);
  assert.equal(r.nothingFound, false);
});

test('поиск тем: по названию, разделу и описанию, без учёта регистра и ё', () => {
  assert.deepEqual(searchTopics(topics, 'ГЛАГ').found.map((t) => t.id), ['t1']);
  assert.deepEqual(searchTopics(topics, 'части речи').found.map((t) => t.id), ['t1']);
  assert.deepEqual(searchTopics(topics, 'сделать').found.map((t) => t.id), ['t1']);
  assert.deepEqual(searchTopics(topics, 'емкость').found.map((t) => t.id), ['t2']);
});

test('поиск тем: непустой запрос без совпадений — «ничего не нашлось»', () => {
  const r = searchTopics(topics, 'дроби');
  assert.equal(r.found.length, 0);
  assert.equal(r.nothingFound, true);
  assert.equal(r.query, 'дроби');
});
