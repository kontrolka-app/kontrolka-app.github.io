import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drillSource, drillQuestions, drillQuestionsByIds, lastDrillResult, drillMistakes } from '../js/drills.js';
import { createSession, submitAnswer, goNext, finishSession } from '../js/quiz.js';
import { buildHistoryEntry, sourceKey, lastTopicResults, weakTopics } from '../js/results.js';
import { addEntry, emptyStats, masteredCount } from '../js/stats.js';
import { seededRandom } from '../js/generators.js';

/** Проходит тренировку: первые wrongCount примеров — неверно, остальные — верно. */
function play(drillId, level, count, wrongCount, finishedAt) {
  const questions = drillQuestions(drillId, level, count, seededRandom(finishedAt));
  let s = createSession({ questions, source: drillSource(drillId, level), settings: { mode: 'learning' }, now: finishedAt - 1000 });
  questions.forEach((q, i) => {
    s = submitAnswer(s, String(i < wrongCount ? q.correctAnswer + 1 : q.correctAnswer)).session;
    if (i < questions.length - 1) s = goNext(s);
  });
  return buildHistoryEntry(finishSession(s, finishedAt));
}

test('тренировка тренажёра: результат, ошибки и повтор по id', () => {
  const e = play('mul2', 'medium', 10, 3, 2000);
  assert.equal(e.correct, 7);
  assert.equal(e.source.kind, 'drill');
  const history = [e];
  assert.deepEqual(lastDrillResult(history, 'mul2'), { percent: 70, level: 'medium', finishedAt: 2000 });
  assert.equal(lastDrillResult(history, 'div2'), null);
  const ids = drillMistakes(history, 'mul2');
  assert.equal(ids.length, 3);
  const { questions, missing } = drillQuestionsByIds(ids);
  assert.equal(missing, false);
  assert.deepEqual(questions.map((q) => q.id), ids);
});

test('ошибка, исправленная позже, больше не считается', () => {
  const first = play('eq', 'easy', 5, 2, 1000);
  const wrongIds = drillMistakes([first], 'eq');
  // «Повторить ошибки»: те же примеры, теперь верно.
  let s = createSession({ questions: drillQuestionsByIds(wrongIds).questions, source: drillSource('eq', 'easy'), settings: { mode: 'learning' }, now: 1500 });
  s.questions.forEach((q, i) => {
    s = submitAnswer(s, String(q.correctAnswer)).session;
    if (i < s.questions.length - 1) s = goNext(s);
  });
  const fix = buildHistoryEntry(finishSession(s, 2500));
  assert.deepEqual(drillMistakes([fix, first], 'eq'), []);
});

test('тренажёр не влияет на темы и «освоено тем», но считается в решённых заданиях', () => {
  const e = play('order', 'hard', 10, 0, 3000);
  const stats = addEntry(emptyStats(), e);
  assert.equal(stats.questions, 10);
  assert.deepEqual(stats.topicLast, {});
  assert.equal(masteredCount(stats), 0);
  assert.equal(lastTopicResults([e]).size, 0);
  assert.deepEqual(weakTopics([play('order', 'easy', 5, 5, 4000)]), []);
});

test('тот же тренажёр и уровень — «та же тренировка» для сравнения попыток', () => {
  assert.equal(sourceKey(drillSource('mul2', 'easy')), sourceKey(drillSource('mul2', 'easy')));
  assert.notEqual(sourceKey(drillSource('mul2', 'easy')), sourceKey(drillSource('mul2', 'hard')));
  assert.notEqual(sourceKey(drillSource('mul2', 'easy')), sourceKey(drillSource('div2', 'easy')));
});
