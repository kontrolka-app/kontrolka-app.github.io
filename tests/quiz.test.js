import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, selectQuestions, countAvailable, createSession, submitAnswer, skipQuestion, goNext, finishSession, correctStreak } from '../js/quiz.js';
import { normalizeText, parseNumber } from '../js/utils.js';
import { validateQuestion } from '../js/validate.js';
import { Q, ALL, seededRng } from './helpers.js';

test('выбор ответа: верный, неверный, пустой, несуществующий вариант', () => {
  assert.equal(checkAnswer(Q.choice, 'b').status, 'correct');
  assert.equal(checkAnswer(Q.choice, 'a').status, 'wrong');
  assert.equal(checkAnswer(Q.choice, '').status, 'invalid');
  assert.equal(checkAnswer(Q.choice, 'z').status, 'invalid');
});

test('верно/неверно: принимает только булево значение', () => {
  assert.equal(checkAnswer(Q.tf, true).status, 'correct');
  assert.equal(checkAnswer(Q.tf, false).status, 'wrong');
  assert.equal(checkAnswer(Q.tf, 'true').status, 'invalid');
  assert.equal(checkAnswer(Q.tf, null).status, 'invalid');
});

test('текстовый ответ: регистр, пробелы, ё/е и дополнительные варианты', () => {
  assert.equal(checkAnswer(Q.text, '  москва ').status, 'correct');
  assert.equal(checkAnswer(Q.text, 'МОСКВА').status, 'correct');
  assert.equal(checkAnswer(Q.text, 'город   москва').status, 'correct');
  assert.equal(checkAnswer(Q.text, 'Петербург').status, 'wrong');
  assert.equal(checkAnswer(Q.text, '   ').status, 'invalid');
  const yo = { ...Q.text, correctAnswer: 'ёлка', acceptedAnswers: [] };
  assert.equal(checkAnswer(yo, 'елка').status, 'correct');
});

test('текстовый ответ: знаки препинания значимы, регистр учитывается по флагу', () => {
  const sign = { ...Q.text, correctAnswer: '<', acceptedAnswers: [] };
  assert.equal(checkAnswer(sign, '<').status, 'correct');
  assert.equal(checkAnswer(sign, '>').status, 'wrong');
  const cs = { ...Q.text, correctAnswer: 'Ока', acceptedAnswers: [], caseSensitive: true };
  assert.equal(checkAnswer(cs, 'ока').status, 'wrong');
  assert.equal(checkAnswer(cs, 'Ока').status, 'correct');
});

test('нормализация текста не удаляет символы выражений', () => {
  assert.equal(normalizeText(' 2 + 2 = 4 '), '2 + 2 = 4');
  assert.equal(normalizeText('Ёж  Иван'), 'еж иван');
});

test('числовой ответ: точное сравнение, запятая, разряды, мусор', () => {
  assert.equal(checkAnswer(Q.num, '16').status, 'correct');
  assert.equal(checkAnswer(Q.num, ' 16 ').status, 'correct');
  assert.equal(checkAnswer(Q.num, '16,0').status, 'correct');
  assert.equal(checkAnswer(Q.num, '15').status, 'wrong');
  assert.equal(checkAnswer(Q.num, '16.1').status, 'wrong', 'приблизительный ответ без tolerance не засчитывается');
  assert.equal(checkAnswer(Q.num, 'шестнадцать').status, 'invalid');
  assert.equal(checkAnswer(Q.num, '').status, 'invalid');
  const tol = { ...Q.num, correctAnswer: 3.14, tolerance: 0.01 };
  assert.equal(checkAnswer(tol, '3,15').status, 'correct');
  assert.equal(checkAnswer(tol, '3,2').status, 'wrong');
});

test('разбор чисел', () => {
  assert.equal(parseNumber('12 500'), 12500);
  assert.equal(parseNumber('1 000 000'), 1000000);
  assert.equal(parseNumber('-7'), -7);
  assert.ok(Number.isNaN(parseNumber('1 2')));
  assert.ok(Number.isNaN(parseNumber('2+2')));
  assert.ok(Number.isNaN(parseNumber('1e3')));
});

test('выбор вопросов: без дубликатов и не больше доступного', () => {
  const pool = [...ALL, Q.choice, Q.num];
  const picked = selectQuestions(pool, { count: 50, rng: seededRng() });
  assert.equal(picked.length, 4);
  assert.equal(new Set(picked.map((q) => q.id)).size, 4);
  for (let seed = 1; seed < 30; seed++) {
    const p = selectQuestions(pool, { count: 3, rng: seededRng(seed) });
    assert.equal(new Set(p.map((q) => q.id)).size, p.length);
  }
});

test('выбор вопросов: сложность и исходный порядок', () => {
  assert.deepEqual(selectQuestions(ALL, { count: 10, difficulty: 'medium', order: 'original' }).map((q) => q.id), ['q-tf', 'q-text']);
  assert.deepEqual(selectQuestions(ALL, { count: 2, order: 'original' }).map((q) => q.id), ['q-choice', 'q-tf']);
  assert.equal(selectQuestions(ALL, { count: 0 }).length, 0);
  assert.equal(countAvailable(ALL, 'hard'), 1);
  assert.equal(countAvailable([], 'all'), 0);
});

test('сессия: нельзя создать пустую или с повторами', () => {
  assert.throws(() => createSession({ questions: [], source: {} }));
  assert.throws(() => createSession({ questions: [Q.choice, Q.choice], source: {} }));
});

test('сессия: ответ засчитывается один раз', () => {
  let s = createSession({ questions: [Q.choice, Q.tf], source: { kind: 'topic', title: 'T' }, settings: { mode: 'learning' } });
  let r = submitAnswer(s, 'b');
  assert.equal(r.accepted, true);
  s = r.session;
  r = submitAnswer(s, 'a');
  assert.equal(r.accepted, false, 'повторная отправка отклоняется');
  assert.equal(r.session.answers['q-choice'].status, 'correct', 'первый ответ не перезаписан');
  r = submitAnswer(s, 'b');
  assert.equal(r.accepted, false);
});

test('сессия: невалидный ответ не тратит попытку', () => {
  const s = createSession({ questions: [Q.num], source: {} });
  const r = submitAnswer(s, 'abc');
  assert.equal(r.accepted, false);
  assert.equal(Object.keys(r.session.answers).length, 0);
  assert.equal(submitAnswer(s, '16').outcome.status, 'correct');
});

test('сессия: переход только после ответа, пропуск не считается правильным', () => {
  let s = createSession({ questions: [Q.choice, Q.tf, Q.num], source: {} });
  assert.equal(goNext(s).currentIndex, 0, 'без ответа дальше не идём');
  s = skipQuestion(s).session;
  assert.equal(s.answers['q-choice'].status, 'skipped');
  assert.equal(skipQuestion(s).accepted, false, 'повторный пропуск игнорируется');
  s = goNext(s);
  assert.equal(s.currentIndex, 1);
  s = submitAnswer(s, true).session;
  s = goNext(s);
  s = submitAnswer(s, '15').session;
  assert.equal(goNext(s).currentIndex, 2, 'за последним вопросом не уходим');
  const done = finishSession(s, s.startedAt + 65000);
  assert.equal(done.status, 'finished');
  assert.deepEqual(
    { correct: done.result.correct, wrong: done.result.wrong, skipped: done.result.skipped, percent: done.result.percent },
    { correct: 1, wrong: 1, skipped: 1, percent: 33 },
  );
  assert.equal(done.result.durationMs, 65000);
});

test('сессия: досрочное завершение — неотвеченные считаются пропущенными', () => {
  let s = createSession({ questions: [Q.choice, Q.tf, Q.num], source: {} });
  s = submitAnswer(s, 'b').session;
  const done = finishSession(s);
  assert.equal(done.result.correct, 1);
  assert.equal(done.result.skipped, 2);
  assert.equal(done.result.total, 3);
});

test('завершённая сессия не меняется', () => {
  let s = createSession({ questions: [Q.choice], source: {} });
  s = submitAnswer(s, 'b').session;
  const done = finishSession(s, 1000);
  assert.equal(finishSession(done, 999999), done);
  assert.equal(submitAnswer(done, 'a').accepted, false);
  assert.equal(skipQuestion(done).accepted, false);
});

test('проверка идёт по данным, сохранённым в сессии', () => {
  const q = { ...Q.choice };
  let s = createSession({ questions: [q], source: {} });
  q.correctAnswer = 'a'; // изменение исходного объекта после старта не влияет на сессию
  s = submitAnswer(s, 'b').session;
  assert.equal(s.answers['q-choice'].status, 'correct');
});

test('серия верных ответов подряд', () => {
  const qs = [Q.choice, Q.tf, Q.num, Q.text];
  let s = createSession({ questions: qs, source: {} });
  assert.equal(correctStreak(s), 0, 'ещё нет ответов');
  s = submitAnswer(s, 'b').session; // верно
  assert.equal(correctStreak(s), 1);
  s = goNext(s);
  s = submitAnswer(s, true).session; // верно
  assert.equal(correctStreak(s), 2);
  s = goNext(s);
  s = submitAnswer(s, '16').session; // верно
  assert.equal(correctStreak(s), 3);
  s = goNext(s);
  s = skipQuestion(s).session; // пропуск обрывает серию
  assert.equal(correctStreak(s), 0);
});

test('сравнение: знак <, = или >, остальное — не засчитывается как ответ', () => {
  const q = { id: 'q-cmp', type: 'compare', difficulty: 'easy', question: '456 … 465', correctAnswer: '<' };
  assert.equal(checkAnswer(q, '<').status, 'correct');
  assert.equal(checkAnswer(q, '>').status, 'wrong');
  assert.equal(checkAnswer(q, '=').status, 'wrong');
  for (const bad of ['', null, undefined, 'меньше', '≤']) assert.equal(checkAnswer(q, bad).status, 'invalid');
  assert.deepEqual(validateQuestion(q, { custom: true }), []);
  assert.equal(validateQuestion({ ...q, correctAnswer: '≤' }, { custom: true }).length, 1);
});
