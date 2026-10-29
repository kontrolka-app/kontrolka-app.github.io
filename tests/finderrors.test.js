import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseErrorText, gradeFindErrors, checkFindErrors, perfectAnswer, validateFindErrors, givenFindErrorsText, correctFindErrorsText } from '../js/finderrors.js';
import { checkAnswer } from '../js/quiz.js';
import { validateQuestion } from '../js/validate.js';

const q = {
  id: 'fe-1',
  type: 'find-errors',
  difficulty: 'medium',
  question: 'Найди и исправь ошибки.',
  text: '{Влису|В лесу|Предлог пишется отдельно.} тихо. Ёжик нашёл {грип|гриб|Парная согласная: грибы.}, а рядом — {ёжык|ёжик|ЖИ пиши с буквой И.}.',
};

test('разбор: слова, знаки препинания, ошибки', () => {
  const t = parseErrorText(q.text);
  assert.deepEqual(t.map((x) => x.word), ['Влису', 'тихо', 'Ёжик', 'нашёл', 'грип', 'а', 'рядом', '', 'ёжык']);
  assert.equal(t[4].after, ',');
  assert.equal(t[8].after, '.');
  assert.equal(t[0].error.correct, 'В лесу');
  assert.equal(t[1].error, null);
});

test('проверка: все найдены и исправлены — верно; регистр и ё не важны', () => {
  assert.equal(checkAnswer(q, perfectAnswer(q)).status, 'correct');
  assert.equal(checkFindErrors(q, { marked: [8, 0, 4], fixes: ['ЕЖИК', 'в лесу', 'гриб'] }).status, 'correct');
});

test('проверка: пропуск, лишняя отметка, неверное исправление — неверно, с подробностями', () => {
  const g = gradeFindErrors(q, { marked: [0, 4, 3], fixes: ['в лесу', 'грибб', 'нашёл'] });
  assert.equal(g.total, 3);
  assert.equal(g.found, 2);
  assert.equal(g.fixedRight, 1);
  assert.deepEqual(g.missed, [8]);
  assert.deepEqual(g.extra, [3]);
  assert.deepEqual(g.wrongFix, [4]);
  assert.equal(checkFindErrors(q, { marked: [0, 4, 3], fixes: ['в лесу', 'грибб', 'нашёл'] }).status, 'wrong');
});

test('проверка: без отметок или без исправлений ответ не принимается', () => {
  assert.equal(checkFindErrors(q, { marked: [], fixes: [] }).status, 'invalid');
  assert.equal(checkFindErrors(q, { marked: [0], fixes: [' '] }).status, 'invalid');
  assert.equal(checkFindErrors(q, null).status, 'invalid');
});

test('тексты для разбора и проверка данных', () => {
  assert.equal(givenFindErrorsText(q, { marked: [4], fixes: ['гриб'] }), 'грип → гриб');
  assert.match(correctFindErrorsText(q), /^Влису → В лесу \(Предлог пишется отдельно\); грип → гриб/);
  assert.deepEqual(validateQuestion(q, { custom: true }), []);
  assert.equal(validateFindErrors({ text: 'Без ошибок.' }, 'x').length, 1);
  assert.equal(validateFindErrors({ text: '{лес|лес|правило}' }, 'x').length, 1);
  assert.equal(validateFindErrors({ text: 'Открыта {скобка' }, 'x').length, 2);
});
