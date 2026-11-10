import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathStops, pathHeight, pathLine, currentStopId, masteredStops, PATH_STEP, PATH_PAD, TOPIC_VIEWS } from '../js/path.js';
import { sanitizeData, defaultData } from '../js/storage.js';

const topics = [
  { id: 'a', title: 'А', section: 'Числа' },
  { id: 'b', title: 'Б', section: 'Числа' },
  { id: 'c', title: 'В', section: 'Величины' },
  { id: 'd', title: 'Г', section: 'Геометрия' },
  { id: 'e', title: 'Д', section: 'Геометрия' },
  { id: 'v', title: 'ВПР', section: 'ВПР и МЦКО' },
];
const res = (obj) => new Map(Object.entries(obj).map(([id, [percent, finishedAt]]) => [id, { percent, finishedAt }]));

test('остановки идут в порядке тем, змейкой, с шагом по вертикали', () => {
  const stops = pathStops(topics, new Map());
  assert.deepEqual(stops.map((s) => s.topic.id), ['a', 'b', 'c', 'd', 'e', 'v']);
  assert.deepEqual(stops.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(stops.map((s) => s.x), [26, 50, 74, 50, 26, 50]);
  assert.equal(stops[1].y - stops[0].y, PATH_STEP);
  assert.equal(stops[0].y, PATH_PAD + PATH_STEP / 2);
  assert.ok(stops.at(-1).y < pathHeight(stops.length));
});

test('подпись стоит с той стороны, где больше места', () => {
  const stops = pathStops(topics, new Map());
  assert.deepEqual(stops.map((s) => s.side), ['right', 'right', 'left', 'right', 'right', 'right']);
});

test('статус и процент берутся из последнего результата темы', () => {
  const stops = pathStops(topics, res({ a: [90, 1], b: [60, 2] }));
  assert.deepEqual(stops.slice(0, 3).map((s) => [s.status, s.percent]), [['mastered', 90], ['progress', 60], ['new', null]]);
  assert.equal(masteredStops(stops), 1);
});

test('название раздела — только у первой темы раздела из нескольких тем', () => {
  const stops = pathStops(topics, new Map());
  assert.deepEqual(stops.map((s) => s.sectionStart), [true, false, false, true, false, false]);
});

test('ВПР и олимпиада — бонусные остановки', () => {
  const stops = pathStops(topics, new Map());
  assert.deepEqual(stops.filter((s) => s.bonus).map((s) => s.topic.id), ['v']);
});

test('«ты здесь»: новичок — на первой теме', () => {
  assert.equal(currentStopId(topics, new Map()), 'a');
  assert.equal(pathStops(topics, new Map()).filter((s) => s.here).length, 1);
});

test('«ты здесь»: последняя тема не освоена — остаёмся на ней', () => {
  assert.equal(currentStopId(topics, res({ a: [90, 1], c: [50, 5] })), 'c');
});

test('«ты здесь»: последняя тема освоена — следующая неосвоенная, по кругу', () => {
  assert.equal(currentStopId(topics, res({ a: [90, 1], b: [85, 2] })), 'c');
  assert.equal(currentStopId(topics, res({ v: [100, 9], a: [100, 1] })), 'b');
});

test('«ты здесь»: всё освоено — отметки нет', () => {
  const all = res(Object.fromEntries(topics.map((t, i) => [t.id, [100, i + 1]])));
  assert.equal(currentStopId(topics, all), null);
  assert.equal(pathStops(topics, all).some((s) => s.here), false);
});

test('линия дорожки проходит через все остановки', () => {
  const stops = pathStops(topics, new Map());
  const d = pathLine(stops);
  assert.ok(d.startsWith(`M ${stops[0].x} ${stops[0].y}`));
  assert.equal(d.match(/ C /g).length, stops.length - 1);
  assert.ok(d.endsWith(`${stops.at(-1).x} ${stops.at(-1).y}`));
  assert.equal(pathLine([]), '');
});

test('пустой предмет — пустой путь', () => {
  assert.deepEqual(pathStops([], new Map()), []);
  assert.equal(currentStopId([], new Map()), null);
});

test('вид тем сохраняется в настройках; по умолчанию — путь', () => {
  assert.deepEqual(TOPIC_VIEWS, ['path', 'list']);
  assert.equal(defaultData().settings.topicsView, 'path');
  const d = defaultData();
  d.settings.topicsView = 'list';
  assert.equal(sanitizeData(d).data.settings.topicsView, 'list');
  d.settings.topicsView = 'карта';
  assert.equal(sanitizeData(d).data.settings.topicsView, 'path');
  delete d.settings.topicsView;
  assert.equal(sanitizeData(d).data.settings.topicsView, 'path');
});
