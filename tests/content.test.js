// Проверка учебных данных и пользовательских тестов.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAndValidateAll } from '../scripts/validate-content.js';
import { validateQuestion, validateContent, validateCustomTest, expressionsIn, exampleOverlaps } from '../js/validate.js';
import { findAllOverlaps } from '../scripts/check-examples.js';
import { parseTestFile, toShareFile, cleanTest, newTest, newQuestion, changeQuestionType } from '../js/customTests.js';
import { checkAnswer } from '../js/quiz.js';
import { Q } from './helpers.js';

test('все файлы учебных данных проходят проверку', async () => {
  const report = await loadAndValidateAll();
  assert.ok(report.length >= 4);
  for (const r of report) {
    assert.deepEqual(r.errors, [], `ошибки в ${r.file}`);
    assert.ok(r.questions > 0);
  }
});

test('у каждого вопроса учебных данных правильный ответ засчитывается движком', async () => {
  const { readFile } = await import('node:fs/promises');
  const subjects = JSON.parse(await readFile(new URL('../data/subjects.json', import.meta.url), 'utf8'));
  for (const s of subjects) {
    for (const f of s.files) {
      const content = JSON.parse(await readFile(new URL(`../data/${f}`, import.meta.url), 'utf8'));
      for (const q of content.questions) {
        const answers = [q.correctAnswer, ...(q.acceptedAnswers || [])];
        for (const a of answers) {
          const given = q.type === 'number' ? String(a) : a;
          assert.equal(checkAnswer(q, given).status, 'correct', `${q.id}: ответ «${a}» не засчитан`);
        }
        if (q.type === 'single-choice') {
          for (const o of q.options) if (o.id !== q.correctAnswer) assert.equal(checkAnswer(q, o.id).status, 'wrong', `${q.id}: вариант ${o.id}`);
        }
      }
    }
  }
});

test('валидатор вопросов ловит типичные ошибки', () => {
  const ctx = { subjectIds: new Set(['math', 'russian']), topicIds: new Set(['t1', 't2']) };
  for (const q of Object.values(Q)) assert.deepEqual(validateQuestion(q, ctx), [], q.id);
  const bad = [
    { ...Q.choice, options: [{ id: 'a', text: 'x' }] },
    { ...Q.choice, correctAnswer: 'z' },
    { ...Q.choice, question: '   ' },
    { ...Q.choice, grade: 12 },
    { ...Q.choice, difficulty: 'ultra' },
    { ...Q.choice, subjectId: 'chess' },
    { ...Q.choice, topicId: 'nope' },
    { ...Q.choice, explanation: 5 },
    { ...Q.tf, correctAnswer: 'true' },
    { ...Q.num, correctAnswer: '16' },
    { ...Q.text, correctAnswer: '' },
    { ...Q.choice, type: 'drawing' },
  ];
  for (const q of bad) assert.ok(validateQuestion(q, ctx).length > 0, JSON.stringify(q).slice(0, 80));
});

test('валидатор файла: повторяющиеся id и тема без вопросов', () => {
  const content = {
    topics: [{ id: 't1', subjectId: 'math', grade: 4, title: 'A' }, { id: 't2', subjectId: 'math', grade: 4, title: 'B' }],
    questions: [Q.choice, { ...Q.tf, id: 'q-choice' }],
  };
  const errors = validateContent(content, { subjectIds: new Set(['math']) });
  assert.ok(errors.some((e) => e.includes('повторяющийся id')));
  assert.ok(errors.some((e) => e.includes('t2') && e.includes('нет ни одного вопроса')));
});

test('свой тест: новый пустой не проходит проверку, заполненный проходит', () => {
  const t = newTest();
  assert.ok(validateCustomTest(cleanTest(t)).length > 0);
  t.title = 'Падежи';
  t.questions[0].question = 'Сколько падежей?';
  t.questions[0] = { ...changeQuestionType(t.questions[0], 'number'), correctAnswer: 6 };
  assert.deepEqual(validateCustomTest(cleanTest(t)), []);
});

test('свой тест: сообщения об ошибках без внутренних id', () => {
  const t = cleanTest({ ...newTest(), title: 'Т' });
  const errors = validateCustomTest(t);
  assert.ok(errors.length > 0);
  for (const e of errors) assert.doesNotMatch(e, /«q-/);
});

test('свой тест: все типы вопросов из редактора проходят проверку', () => {
  for (const type of ['single-choice', 'true-false', 'text', 'number']) {
    const q = newQuestion(type);
    q.question = 'Вопрос';
    if (type === 'single-choice') q.options.forEach((o, i) => (o.text = `Вариант ${i}`));
    if (type === 'text') q.correctAnswer = 'ответ';
    assert.deepEqual(validateCustomTest(cleanTest({ ...newTest(), title: 'Т', questions: [q] })), [], type);
  }
});

test('обмен тестом: файл → импорт', () => {
  const t = cleanTest({ ...newTest(), title: 'Т', questions: [{ ...newQuestion('true-false'), question: 'Да?' }] });
  const text = JSON.stringify(toShareFile(t));
  const res = parseTestFile(text);
  assert.equal(res.ok, true);
  assert.equal(res.test.origin, 'imported');
  assert.equal(res.test.title, 'Т');
  const again = parseTestFile(text, new Set([t.id]));
  assert.notEqual(again.test.id, t.id, 'совпадающий id заменяется, чтобы не затереть свой тест');
});

test('обмен тестом: повреждённые и чужие файлы отклоняются', () => {
  assert.equal(parseTestFile('не json').ok, false);
  assert.equal(parseTestFile('{"a":1}').ok, false);
  assert.equal(parseTestFile(JSON.stringify({ format: 'kontrolka-test', version: 2, test: {} })).ok, false);
  assert.equal(parseTestFile(JSON.stringify({ format: 'kontrolka-test', version: 1, test: { id: 'x', title: 'T', questions: [] } })).ok, false);
});

test('выражения из примеров: в едином виде, дробь-запись не считается действием', () => {
  assert.deepEqual(expressionsIn('48 + 52 × 3 = 48 + 156 = 204'), ['48+52×3', '48+156']);
  assert.deepEqual(expressionsIn('(90 − 30) : 3'), ['(90-30):3']);
  assert.deepEqual(expressionsIn('47 685 + 36 547'), ['47685+36547']);
  assert.deepEqual(expressionsIn('1/2 > 1/3'), []);
  assert.deepEqual(expressionsIn('Корень слова — общая часть'), []);
});

test('совпадение примера правила с вопросом находится', () => {
  const topics = [{ id: 't', subjectId: 'math', examples: ['48 + 52 × 3 = 204'], theory: ['Сначала умножают.'] }];
  const questions = [
    { id: 'q1', subjectId: 'math', question: 'Вычисли: 48 + 52 × 3' },
    { id: 'q2', subjectId: 'math', question: 'Вычисли: 36 + 14 × 5' },
    { id: 'q3', subjectId: 'russian', question: '48 + 52 × 3' },
  ];
  assert.deepEqual(exampleOverlaps(topics, questions).map((f) => f.questionId), ['q1']);
});

test('в учебных данных примеры правил не подсказывают ответы', async () => {
  const found = await findAllOverlaps();
  assert.deepEqual(found.map((f) => `${f.topicId}: ${f.example} → ${f.questionId}`), []);
});
