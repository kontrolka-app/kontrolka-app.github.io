import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pickDiagnostic, diagnosticTopics, suitable, statusOf, knowledgeMap, mapSummary, weakFromMap, quarterStartKey, diagnosticSource, estimateMinutes, PER_TOPIC } from '../js/diagnostics.js';
import { createSession, submitAnswer, goNext, finishSession } from '../js/quiz.js';
import { buildHistoryEntry, lastTopicResults, weakTopics } from '../js/results.js';
import { addEntry, emptyStats } from '../js/stats.js';
import { sanitizeData, defaultData } from '../js/storage.js';
import { seededRng } from './helpers.js';

async function subject(id) {
  const d = JSON.parse(await readFile(new URL(`../data/content/${id}-4.json`, import.meta.url), 'utf8'));
  const byTopic = new Map();
  for (const q of d.questions) {
    if (!byTopic.has(q.topicId)) byTopic.set(q.topicId, []);
    byTopic.get(q.topicId).push(q);
  }
  return { topics: d.topics, byTopic };
}

test('из каждой темы ровно по 2 задания, без повторов, без длинных текстов и «Найди ошибки»', async () => {
  for (const id of ['math', 'russian', 'world', 'reading', 'english']) {
    const { topics, byTopic } = await subject(id);
    const ids = diagnosticTopics(topics).map((t) => t.id);
    assert.ok(ids.length > 5, id);
    assert.ok(!ids.some((t) => /vpr|olymp|smysl/.test(t)), `${id}: сборные темы не берём`);
    const qs = pickDiagnostic(byTopic, ids, seededRng(1));
    assert.equal(new Set(qs.map((q) => q.id)).size, qs.length, `${id}: без повторов`);
    for (const t of ids) {
      const n = qs.filter((q) => q.topicId === t).length;
      assert.equal(n, Math.min(PER_TOPIC, suitable(byTopic.get(t)).length), `${id}/${t}`);
    }
    assert.ok(qs.every((q) => !q.passageId && q.type !== 'find-errors'), id);
  }
});

test('предпочитаются задания средней сложности', async () => {
  const { byTopic } = await subject('math');
  const qs = pickDiagnostic(byTopic, ['m4-mass'], seededRng(3));
  const mediumAvailable = byTopic.get('m4-mass').filter((q) => q.difficulty === 'medium').length;
  assert.equal(qs.filter((q) => q.difficulty === 'medium').length, Math.min(2, mediumAvailable));
});

test('цвет темы', () => {
  assert.equal(statusOf(2, 2), 'know');
  assert.equal(statusOf(1, 2), 'unsure');
  assert.equal(statusOf(0, 2), 'review');
  assert.equal(statusOf(1, 1), 'know');
  assert.equal(statusOf(0, 0), 'none');
});

test('время: около 45 секунд на задание', () => {
  assert.equal(estimateMinutes(36), 27);
  assert.equal(estimateMinutes(1), 1);
});

/** Диагностика: в каждой теме первые `wrong[topic]` ответов неверные. */
async function runDiagnostic(topicIds, wrong, at) {
  const { byTopic } = await subject('math');
  const qs = pickDiagnostic(byTopic, topicIds, seededRng(at));
  let s = createSession({ questions: qs, source: diagnosticSource({ id: 'math', name: 'Математика' }, topicIds), settings: { mode: 'control' }, now: at - 1000 });
  const used = {};
  qs.forEach((q, i) => {
    used[q.topicId] = (used[q.topicId] || 0) + 1;
    const bad = used[q.topicId] <= (wrong[q.topicId] || 0);
    const res = submitAnswer(s, bad ? wrongAnswer(q) : rightAnswer(q));
    assert.ok(res.accepted, `${q.id}: ответ не принят`);
    s = res.session;
    if (i < qs.length - 1) s = goNext(s);
  });
  return buildHistoryEntry(finishSession(s, at));
}
function wrongAnswer(q) {
  switch (q.type) {
    case 'number': return String(q.correctAnswer + 1);
    case 'single-choice': return q.options.find((o) => o.id !== q.correctAnswer).id;
    case 'true-false': return !q.correctAnswer;
    case 'compare': return q.correctAnswer === '<' ? '>' : '<';
    case 'digits': return q.correctAnswer === '1' ? '2' : '1';
    case 'multi-choice': return [q.options.find((o) => !q.correctAnswers.includes(o.id)).id];
    case 'match': case 'order': return [...(q.pairs || q.items).keys()].reverse();
    default: return 'заведомо неверно';
  }
}
function rightAnswer(q) {
  if (q.type === 'number') return String(q.correctAnswer);
  if (q.type === 'multi-choice') return q.correctAnswers;
  if (q.type === 'match' || q.type === 'order') return [...(q.pairs || q.items).keys()];
  return q.correctAnswer;
}

test('карта знаний: последний результат по теме, стрелка к прошлому разу, проверка частями', async () => {
  const first = await runDiagnostic(['m4-mass', 'm4-time'], { 'm4-mass': 2, 'm4-time': 1 }, 10_000);
  const second = await runDiagnostic(['m4-mass'], { 'm4-mass': 0 }, 20_000);
  const third = await runDiagnostic(['m4-geometry'], { 'm4-geometry': 0 }, 30_000);
  const map = knowledgeMap([third, second, first]);
  assert.equal(map.get('m4-mass').status, 'know');
  assert.equal(map.get('m4-mass').trend, 'up');
  assert.equal(map.get('m4-time').status, 'unsure');
  assert.equal(map.get('m4-time').trend, null);
  assert.equal(map.get('m4-geometry').status, 'know');
  assert.equal(map.has('m4-zeros'), false);
  const topics = ['m4-mass', 'm4-time', 'm4-geometry', 'm4-zeros'].map((id) => ({ id }));
  assert.deepEqual(mapSummary(map, topics), { know: 2, unsure: 1, review: 0, none: 1 });
  assert.deepEqual(weakFromMap(map, topics).map((t) => t.id), ['m4-time']);
});

test('диагностика не меняет «последний результат» тем и «освоено тем», но идёт в счётчики', async () => {
  const e = await runDiagnostic(['m4-mass', 'm4-time'], { 'm4-mass': 2 }, 40_000);
  assert.deepEqual(e.topicStats, {});
  assert.ok(e.diagStats['m4-mass']);
  assert.equal(lastTopicResults([e]).size, 0);
  assert.deepEqual(weakTopics([e]), []);
  const stats = addEntry(emptyStats(), e);
  assert.equal(stats.questions, 4);
  assert.deepEqual(stats.topicLast, {});
});

test('результаты диагностики сохраняются в хранилище', async () => {
  const e = await runDiagnostic(['m4-mass'], {}, 50_000);
  const d = { ...defaultData(), history: [e] };
  const back = sanitizeData(JSON.parse(JSON.stringify(d))).data;
  assert.deepEqual(back.history[0].diagStats, e.diagStats);
  assert.equal(knowledgeMap(back.history).get('m4-mass').status, 'know');
});

test('начало четверти: 1–14 сентября, ноября, января, апреля', () => {
  assert.equal(quarterStartKey(new Date(2026, 10, 9)), '2026-11');
  assert.equal(quarterStartKey(new Date(2026, 8, 1)), '2026-09');
  assert.equal(quarterStartKey(new Date(2027, 0, 14)), '2027-01');
  assert.equal(quarterStartKey(new Date(2027, 3, 5)), '2027-04');
  assert.equal(quarterStartKey(new Date(2026, 10, 15)), null);
  assert.equal(quarterStartKey(new Date(2026, 9, 3)), null);
});
