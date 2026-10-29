import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchTopics, availableGrades, resolveGrade, gradeRangesText, needsWelcome, groupBySection, nextTopic, suggestNext } from '../js/catalog.js';

test('совет на главной: сначала ошибки, потом следующая тема раздела', () => {
  const topics = [
    { id: 'a1', subjectId: 'm', grade: 4, section: 'A' },
    { id: 'a2', subjectId: 'm', grade: 4, section: 'A' },
    { id: 'b1', subjectId: 'm', grade: 4, section: 'B' },
    { id: 'r1', subjectId: 'r', grade: 4, section: 'R' },
  ];
  const entry = (id) => ({ source: { kind: 'topic', topicIds: [id] } });
  const exam = { source: { kind: 'exam', topicIds: ['r1'] } };
  const started = (ids) => (id) => ids.includes(id);

  // Ошибки в недавней теме — повторить их.
  let s = suggestNext([entry('a1')], topics, { pendingCount: (id) => (id === 'a1' ? 3 : 0), isStarted: started(['a1']) });
  assert.deepEqual([s.kind, s.topic.id, s.count], ['mistakes', 'a1', 3]);

  // Ошибок нет — следующая не начатая тема того же раздела.
  s = suggestNext([entry('a1')], topics, { pendingCount: () => 0, isStarted: started(['a1']) });
  assert.deepEqual([s.kind, s.topic.id], ['next', 'a2']);

  // Раздел пройден — следующая тема предмета; пробная контрольная не считается «последней темой».
  s = suggestNext([exam, entry('a2'), entry('a1')], topics, { pendingCount: () => 0, isStarted: started(['a1', 'a2', 'r1']) });
  assert.deepEqual([s.kind, s.topic.id], ['next', 'b1']);

  // Всё начато или истории нет — совета нет.
  assert.equal(suggestNext([entry('b1')], topics, { pendingCount: () => 0, isStarted: () => true }), null);
  assert.equal(suggestNext([], topics, { pendingCount: () => 0, isStarted: () => false }), null);
});

test('следующая тема: дальше по порядку, пропуская освоенные', () => {
  const topics = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const mastered = (ids) => (id) => ids.includes(id);
  assert.equal(nextTopic(topics, 'a', mastered([])).id, 'b');
  assert.equal(nextTopic(topics, 'a', mastered(['b'])).id, 'c');
  // Дальше всё освоено — возвращаемся к первой неосвоенной с начала.
  assert.equal(nextTopic(topics, 'c', mastered(['d', 'c'])).id, 'a');
  assert.equal(nextTopic(topics, 'b', mastered(['a', 'b', 'c', 'd'])), null);
  // Текущей темы нет в списке — первая неосвоенная.
  assert.equal(nextTopic(topics, 'x', mastered(['a'])).id, 'b');
});

test('темы по разделам: порядок сохраняется, без раздела — «Другие темы»', () => {
  const groups = groupBySection([
    { id: 'a', section: 'Числа' },
    { id: 'b', section: 'Величины' },
    { id: 'c', section: 'Числа' },
    { id: 'd' },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.section, g.topics.map((t) => t.id)]),
    [['Числа', ['a', 'c']], ['Величины', ['b']], ['Другие темы', ['d']]],
  );
  assert.deepEqual(groupBySection([]), []);
});
import { defaultData } from '../js/storage.js';

test('знакомство: только при первом входе', () => {
  const fresh = defaultData();
  assert.equal(needsWelcome(fresh), true);
  const withName = defaultData();
  withName.settings.nickname = 'Макс';
  assert.equal(needsWelcome(withName), false);
  const withHistory = defaultData();
  withHistory.history = [{ id: 'h1' }];
  assert.equal(needsWelcome(withHistory), false);
  const skipped = defaultData();
  skipped.settings.introDone = true;
  assert.equal(needsWelcome(skipped), false);
});

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
