import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, href } from '../js/router.js';
import { plural, slugify, formatDuration } from '../js/utils.js';

test('разбор адреса', () => {
  assert.deepEqual(parseHash(''), { name: 'home', params: [] });
  assert.deepEqual(parseHash('#/'), { name: 'home', params: [] });
  assert.deepEqual(parseHash('#/topic/ru4-verb'), { name: 'topic', params: ['ru4-verb'] });
  assert.deepEqual(parseHash('#/topics/math?x=1'), { name: 'topics', params: ['math'] });
  assert.deepEqual(parseHash('#/topic/%E0%A4%A'), { name: 'topic', params: ['%E0%A4%A'] }, 'битая кодировка не роняет приложение');
});

test('ссылки', () => {
  assert.equal(href('home'), '#/');
  assert.equal(href('topic', 'a b'), '#/topic/a%20b');
});

test('склонение слов', () => {
  assert.equal(plural(1, ['вопрос', 'вопроса', 'вопросов']), 'вопрос');
  assert.equal(plural(3, ['вопрос', 'вопроса', 'вопросов']), 'вопроса');
  assert.equal(plural(11, ['вопрос', 'вопроса', 'вопросов']), 'вопросов');
  assert.equal(plural(21, ['вопрос', 'вопроса', 'вопросов']), 'вопрос');
  assert.equal(plural(134, ['вопрос', 'вопроса', 'вопросов']), 'вопроса');
});

test('имя файла и длительность', () => {
  assert.equal(slugify('Падежи: 4 класс!'), 'padezhi-4-klass');
  assert.equal(slugify('!!!'), 'test');
  assert.equal(formatDuration(65000), '1 мин 05 с');
  assert.equal(formatDuration(5000), '5 с');
  assert.equal(formatDuration(NaN), '—');
});
