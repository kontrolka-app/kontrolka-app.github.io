import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRILLS, LEVELS, generateQuestion, generateSet, questionFromId, seededRandom, solveExpression, buildQuestion, fmt } from '../js/generators.js';
import { validateQuestion } from '../js/validate.js';
import { checkAnswer } from '../js/quiz.js';

const N = 1000;
const plain = (s) => s.replace(/ /g, '');

/** Независимая проверка ответа: считаем выражение из текста задания обычным JavaScript. */
function recompute(q) {
  const text = plain(q.question);
  if (q.drill === 'eq') {
    const eq = text.replace(/^Реши уравнение: /, '').replace(/\.$/, '');
    const js = (s) => s.replace(/x/g, `(${q.correctAnswer})`).replace(/×/g, '*').replace(/:/g, '/').replace(/−/g, '-');
    const [l, r] = eq.split(' = ');
    // eslint-disable-next-line no-new-func -- только в тесте, на своих данных
    return Function(`return ${js(l)} === ${js(r)}`)() ? q.correctAnswer : NaN;
  }
  if (q.drill === 'units') {
    const K = { км: 1000, м: 100, т: 1000, ц: 100, кг: 1000, ч: 60, мин: 60, сут: 24 };
    const m = /: (\d+) (\S+)(?: (\d+) \S+)?\.$/.exec(text);
    return Number(m[1]) * K[m[2]] + Number(m[3] || 0);
  }
  const expr = text.replace(/^Вычисли: /, '').replace(/\.$/, '').replace(/×/g, '*').replace(/:/g, '/').replace(/−/g, '-');
  // eslint-disable-next-line no-new-func -- только в тесте, на своих данных
  return Function(`return ${expr}`)();
}

for (const d of DRILLS) {
  for (const level of LEVELS) {
    test(`тренажёр «${d.title}», ${level}: ${N} примеров считаются верно`, () => {
      const rng = seededRandom(LEVELS.indexOf(level) * 1000 + d.id.length);
      for (let i = 0; i < N; i++) {
        const q = generateQuestion(d.id, level, rng);
        assert.ok(q, `${d.id}/${level}: пример не получился`);
        assert.ok(Number.isInteger(q.correctAnswer) && q.correctAnswer >= 0, `${q.id}: ответ ${q.correctAnswer}`);
        assert.ok(q.correctAnswer <= 10_000_000, `${q.id}: слишком большой ответ`);
        assert.equal(recompute(q), q.correctAnswer, `${q.id}: «${q.question}»`);
        assert.deepEqual(validateQuestion(q, { custom: true }), [], q.id);
        assert.equal(checkAnswer(q, fmt(q.correctAnswer).replace(/ /g, ' ')).status, 'correct', `${q.id}: ответ с пробелами`);
        assert.deepEqual(questionFromId(q.id), q, `${q.id}: по id собирается тот же пример`);
        assert.ok(q.explanation.includes(fmt(q.correctAnswer)), `${q.id}: в объяснении нет ответа`);
      }
    });
  }
}

test('набор: примеры не повторяются, их сколько просили', () => {
  for (const d of DRILLS) {
    const set = generateSet(d.id, 'medium', 20, seededRandom(7));
    assert.equal(set.length, 20, d.id);
    assert.equal(new Set(set.map((q) => q.id)).size, 20, d.id);
  }
});

test('порядок действий: скобки, потом × и : слева направо, потом + и −', () => {
  const r = solveExpression([1000, '−', '(', 325, '+', 175, ')', ':', 5, '×', 8]);
  assert.equal(r.value, 200);
  assert.deepEqual(r.steps.map((s) => s.replace(/ /g, '')), ['325 + 175 = 500', '500 : 5 = 100', '100 × 8 = 800', '1000 − 800 = 200']);
  assert.equal(solveExpression([5, '−', 8]), null, 'отрицательное нельзя');
  assert.equal(solveExpression([7, ':', 2]), null, 'деление не нацело нельзя');
  assert.equal(solveExpression([48, '+', 52, '×', 3]).value, 204);
});

test('примеры из правил приложения собираются с верным ответом', () => {
  assert.equal(buildQuestion('addsub', 'medium', ['a', 38476, 25658]).correctAnswer, 64134);
  assert.equal(buildQuestion('addsub', 'medium', ['s', 70000, 34618]).correctAnswer, 35382);
  assert.equal(buildQuestion('md1', 'medium', ['d', 2856, 7]).correctAnswer, 408);
  assert.equal(buildQuestion('zeros', 'medium', ['m', 320, 20]).correctAnswer, 6400);
  assert.equal(buildQuestion('zeros', 'medium', ['d', 36000, 400]).correctAnswer, 90);
  assert.equal(buildQuestion('mul2', 'medium', [243, 36]).correctAnswer, 8748);
  assert.equal(buildQuestion('mul2', 'hard', [317, 204]).correctAnswer, 64668);
  assert.equal(buildQuestion('div2', 'medium', [3096, 43]).correctAnswer, 72);
  assert.equal(buildQuestion('eq', 'easy', ['m', 7, 3500]).correctAnswer, 500);
  assert.equal(buildQuestion('eq', 'medium', ['v', 2400, 60]).correctAnswer, 40);
  assert.equal(buildQuestion('eq', 'hard', ['e', 3, 90, 120]).correctAnswer, 70);
  assert.equal(buildQuestion('units', 'medium', [0, 3, 250]).correctAnswer, 3250);
  assert.match(buildQuestion('mul2', 'hard', [317, 204]).explanation.replace(/ /g, ''), /317 × 4 = 1268; 317 × 200 = 63400/);
});

test('испорченные id не превращаются в задания', () => {
  for (const id of ['g-mul2-medium-243', 'g-xxx-easy-1_2', 'g-div2-easy-100_7', 'g-eq-easy-m_7_3501', 'g-units-easy-99_1_0', 'w4-nt-001', 'g-addsub-easy-s_5_8', '']) {
    assert.equal(questionFromId(id), null, id);
  }
});
