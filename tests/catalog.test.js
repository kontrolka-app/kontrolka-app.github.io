import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTopics } from '../js/catalog.js';

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
