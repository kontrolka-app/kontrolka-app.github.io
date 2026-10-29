import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentOf, computeResult, buildHistoryEntry, deltaFromPrevious, weakTopics, overallStats, correctAnswerText, givenAnswerText, verdict, shareText } from '../js/results.js';
import { createSession, submitAnswer, goNext, finishSession } from '../js/quiz.js';
import { Q } from './helpers.js';

test('процент: формула и защита от деления на ноль', () => {
  assert.equal(percentOf(0, 0), 0);
  assert.equal(percentOf(3, 4), 75);
  assert.equal(percentOf(1, 3), 33);
  assert.equal(percentOf(2, 3), 67);
  assert.equal(percentOf(10, 10), 100);
});

test('тексты ответов для разбора', () => {
  assert.equal(correctAnswerText(Q.choice), '2/4');
  assert.equal(correctAnswerText(Q.tf), 'Верно');
  assert.equal(correctAnswerText(Q.num), '16 км/ч');
  assert.equal(correctAnswerText({ ...Q.num, correctAnswer: 3.5, unit: undefined }), '3,5');
  assert.equal(givenAnswerText(Q.choice, 'c'), '3/4');
  assert.equal(givenAnswerText(Q.choice, null), 'нет ответа');
  assert.equal(givenAnswerText(Q.tf, false), 'Неверно');
});

function play(answers, questions = [Q.choice, Q.tf, Q.num]) {
  let s = createSession({ questions, source: { kind: 'topic', topicIds: ['t1'], title: 'Тема' } });
  answers.forEach((a, i) => {
    s = submitAnswer(s, a).session;
    if (i < answers.length - 1) s = goNext(s);
  });
  return finishSession(s, s.startedAt + 1000);
}

test('разбор содержит пояснение к выбранному неверному варианту', () => {
  const done = play(['c', true, '16']);
  const r = done.result.review[0];
  assert.equal(r.status, 'wrong');
  assert.equal(r.given, '3/4');
  assert.equal(r.correct, '2/4');
  assert.equal(r.feedback, 'Это больше половины.');
  assert.equal(r.explanation, '2/4 = 1/2');
});

test('статистика по темам внутри сессии', () => {
  const done = play(['b', false, '16']);
  assert.deepEqual(done.result.topicStats, { t1: { total: 2, correct: 1 }, t2: { total: 1, correct: 1 } });
});

test('история: изменение результата относительно прошлой попытки', () => {
  const first = buildHistoryEntry(play(['a', false, '1']));
  const second = buildHistoryEntry(play(['b', true, '1']));
  const history = [second, first];
  assert.equal(first.percent, 0);
  assert.equal(second.percent, 67);
  assert.equal(deltaFromPrevious(history, second), 67);
  assert.equal(deltaFromPrevious(history, first), null);
});

test('слабые темы и общая статистика', () => {
  const a = buildHistoryEntry(play(['a', false, '16']));
  const b = buildHistoryEntry(play(['b', false, '16']));
  const weak = weakTopics([b, a]);
  assert.equal(weak[0].topicId, 't1');
  assert.equal(weak[0].mistakes, 3);
  assert.ok(!weak.some((w) => w.topicId === 't2'), 'тема без ошибок не попадает в список');
  assert.deepEqual(overallStats([b, a]), { sessions: 2, answered: 6, correct: 3, percent: 50 });
  assert.deepEqual(overallStats([]), { sessions: 0, answered: 0, correct: 0, percent: 0 });
});

test('отзыв без школьной оценки', () => {
  assert.equal(verdict(100).level, 'great');
  assert.equal(verdict(0).level, 'low');
  for (const p of [0, 49, 50, 70, 90, 100]) assert.doesNotMatch(verdict(p).title, /[2-5]/);
});

test('текст для отправки результата', () => {
  const e = buildHistoryEntry(play(['b', true, '16']));
  const t = shareText(e, { title: 'Дроби', nickname: 'Макс' });
  assert.match(t, /Дроби/);
  assert.match(t, /3 из 3 \(100%\)/);
  assert.match(t, /Макс/);
});

test('computeResult на пустой сессии не делит на ноль', () => {
  const r = computeResult({ questions: [], answers: {}, startedAt: 0, finishedAt: 0 });
  assert.equal(r.percent, 0);
  assert.equal(r.total, 0);
});
