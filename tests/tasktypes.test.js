import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer } from '../js/quiz.js';
import { validateQuestion, validateCustomTest } from '../js/validate.js';
import { givenAnswerText, correctAnswerText, computeResult } from '../js/results.js';
import { displayOrder, itemMarks } from '../js/tasktypes.js';

const base = { grade: 4, subjectId: 'world', topicId: 't1', difficulty: 'medium' };
const MULTI = {
  ...base, id: 'q-multi', type: 'multi-choice', question: 'Выбери все хвойные деревья.',
  options: [{ id: 'a', text: 'ель' }, { id: 'b', text: 'берёза' }, { id: 'c', text: 'сосна' }, { id: 'd', text: 'дуб' }],
  correctAnswers: ['a', 'c'],
};
const MATCH = {
  ...base, id: 'q-match', type: 'match', question: 'Соедини слово и перевод.',
  pairs: [{ left: 'cat', right: 'кошка' }, { left: 'dog', right: 'собака' }, { left: 'fox', right: 'лиса' }],
};
const ORDER = {
  ...base, id: 'q-order', type: 'order', question: 'Расставь времена года, начиная с зимы.',
  items: ['зима', 'весна', 'лето', 'осень'],
};

test('выбери все верные: засчитывается только точный набор', () => {
  assert.equal(checkAnswer(MULTI, ['a', 'c']).status, 'correct');
  assert.equal(checkAnswer(MULTI, ['c', 'a']).status, 'correct');
  assert.equal(checkAnswer(MULTI, ['a']).status, 'wrong', 'не все верные');
  assert.equal(checkAnswer(MULTI, ['a', 'b', 'c']).status, 'wrong', 'лишний вариант');
  assert.equal(checkAnswer(MULTI, []).status, 'invalid');
  assert.equal(checkAnswer(MULTI, null).status, 'invalid');
  assert.equal(checkAnswer(MULTI, ['z']).status, 'invalid');
});

test('соедини пары: все пары верные — засчитано; не все соединены — не принимается', () => {
  assert.equal(checkAnswer(MATCH, [0, 1, 2]).status, 'correct');
  assert.equal(checkAnswer(MATCH, [1, 0, 2]).status, 'wrong');
  assert.equal(checkAnswer(MATCH, [0, null, 2]).status, 'invalid');
  assert.equal(checkAnswer(MATCH, [0, 0, 2]).status, 'invalid');
  assert.equal(checkAnswer(MATCH, [0, 1]).status, 'invalid');
  assert.equal(checkAnswer(MATCH, 'abc').status, 'invalid');
});

test('расставь по порядку: только полный правильный порядок', () => {
  assert.equal(checkAnswer(ORDER, [0, 1, 2, 3]).status, 'correct');
  assert.equal(checkAnswer(ORDER, [0, 2, 1, 3]).status, 'wrong');
  assert.equal(checkAnswer(ORDER, [0, 1, 2]).status, 'invalid');
  assert.equal(checkAnswer(ORDER, [0, 1, 1, 3]).status, 'invalid');
  assert.equal(checkAnswer(ORDER, [0, 1, 2, 9]).status, 'invalid');
});

test('проверка данных: правильные вопросы проходят', () => {
  for (const q of [MULTI, MATCH, ORDER]) assert.deepEqual(validateQuestion(q), [], q.id);
});

test('проверка данных: ошибки в новых типах находятся', () => {
  const has = (q, part) => assert.ok(validateQuestion(q).some((e) => e.includes(part)), `${q.id}: ждали «${part}», получили ${JSON.stringify(validateQuestion(q))}`);
  has({ ...MULTI, correctAnswers: ['a', 'x'] }, 'не найден');
  has({ ...MULTI, correctAnswers: ['a', 'b', 'c', 'd'] }, 'хотя бы один неверный');
  has({ ...MULTI, correctAnswers: [] }, 'непустой список');
  has({ ...MULTI, options: MULTI.options.slice(0, 2) }, 'минимум три');
  has({ ...MULTI, options: [...MULTI.options, { id: 'e', text: 'Ель' }] }, 'повторяется текст');
  has({ ...MATCH, pairs: MATCH.pairs.slice(0, 2) }, 'от 3 до 6');
  has({ ...MATCH, pairs: [...MATCH.pairs, { left: 'owl', right: 'Лиса' }] }, 'правом столбце');
  has({ ...MATCH, pairs: [...MATCH.pairs, { left: 'owl' }] }, 'left и right');
  has({ ...ORDER, items: ['а', 'б'] }, 'от 3 до 8');
  has({ ...ORDER, items: ['а', 'б', 'А'] }, 'повторяются');
});

test('ответ текстом для разбора', () => {
  assert.equal(givenAnswerText(MULTI, ['c', 'a']), 'ель; сосна');
  assert.equal(correctAnswerText(MULTI), 'ель; сосна');
  assert.equal(givenAnswerText(MATCH, [1, 0, 2]), 'cat — собака; dog — кошка; fox — лиса');
  assert.equal(correctAnswerText(MATCH), 'cat — кошка; dog — собака; fox — лиса');
  assert.equal(givenAnswerText(ORDER, [1, 0, 2, 3]), 'весна → зима → лето → осень');
  assert.equal(correctAnswerText(ORDER), 'зима → весна → лето → осень');
  assert.equal(givenAnswerText(ORDER, null), 'нет ответа');
  assert.equal(givenAnswerText(MULTI, []), 'нет ответа');
});

test('порядок показа: перемешан, одинаков для одного вопроса и не совпадает с правильным', () => {
  for (let n = 2; n <= 8; n++) {
    for (const id of ['a', 'q-order', 'w4-x-1', 'r4-vpr-13', 'zzz']) {
      const o = displayOrder(id, n);
      assert.deepEqual([...o].sort((x, y) => x - y), Array.from({ length: n }, (_, i) => i), 'это перестановка');
      assert.deepEqual(displayOrder(id, n), o, 'повторяется');
      assert.ok(o.some((v, i) => v !== i), `${id}/${n}: не совпадает с правильным`);
    }
  }
});

test('разбор по пунктам: какие пары и позиции верны', () => {
  assert.deepEqual(itemMarks(MATCH, [1, 0, 2]), [false, false, true]);
  assert.deepEqual(itemMarks(ORDER, [0, 2, 1, 3]), [true, false, false, true]);
});

test('свой тест с новыми типами проходит проверку', () => {
  const strip = ({ grade, subjectId, topicId, ...q }) => q;
  const t = { id: 't', title: 'Тест', questions: [strip(MULTI), strip(MATCH), strip(ORDER)] };
  assert.deepEqual(validateCustomTest(t), []);
});

test('итог сессии считает новые типы', () => {
  const session = {
    questions: [MULTI, MATCH, ORDER],
    answers: { 'q-multi': { status: 'correct', given: ['a', 'c'] }, 'q-match': { status: 'wrong', given: [1, 0, 2] } },
    startedAt: 1, finishedAt: 2,
  };
  const r = computeResult(session);
  assert.equal(r.correct, 1);
  assert.equal(r.wrong, 1);
  assert.equal(r.skipped, 1);
  assert.equal(r.review[1].given, 'cat — собака; dog — кошка; fox — лиса');
  assert.equal(r.review[2].given, 'нет ответа');
});
