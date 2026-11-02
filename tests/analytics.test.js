import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COUNT_URL, SITE_HOST, routeCountUrl, eventCountUrl, shouldCount } from '../js/analytics.js';

test('экран отправляется только по названию', () => {
  assert.equal(routeCountUrl('home'), `${COUNT_URL}?p=%2Fhome`);
  assert.equal(routeCountUrl('poem-edit'), `${COUNT_URL}?p=%2Fpoem-edit`);
});

test('неизвестные экраны и события не отправляются', () => {
  assert.equal(routeCountUrl('Максим'), null);
  assert.equal(routeCountUrl('mytest/abc'), null);
  assert.equal(eventCountUrl('Максим'), null);
});

test('событие помечается как событие', () => {
  assert.equal(eventCountUrl('training-finished'), `${COUNT_URL}?p=training-finished&e=true`);
});

test('считаем только на опубликованном сайте и не для автоматических браузеров', () => {
  assert.equal(shouldCount(SITE_HOST), true);
  assert.equal(shouldCount('localhost'), false);
  assert.equal(shouldCount('127.0.0.1'), false);
  assert.equal(shouldCount(SITE_HOST, true), false);
});
