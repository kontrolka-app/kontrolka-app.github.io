import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGES, PAGE_SIZE, STICKERS, STARTER_MAX, defaultStickers, sanitizeStickers, awardForEntry, starterSet, stickerTopic, markSeen, stickersOfEntry, ownedCount, albumComplete } from '../js/stickers.js';
import { sanitizeData, defaultData } from '../js/storage.js';
import { seededRng } from './helpers.js';

const DAY = 86400000;
const T0 = Date.parse('2026-11-10T12:00:00');
/** Тренировка по одной теме: total вопросов, correct верных. */
const entry = (topicId, total, correct, extra = {}) => ({
  id: `e-${topicId}-${extra.finishedAt || T0}`,
  finishedAt: T0,
  total,
  correct,
  skipped: 0,
  percent: Math.round((correct / total) * 100),
  source: { kind: 'topic', topicIds: [topicId], title: 'Тема' },
  ...extra,
});
const award = (state, e, history = [e], goal = 10) => awardForEntry(state, { entry: e, history, goal, rng: seededRng(1) });

test('в альбоме 4 страницы по 12 наклеек, id не повторяются', () => {
  assert.equal(PAGES.length, 4);
  assert.equal(STICKERS.length, PAGES.length * PAGE_SIZE);
  assert.equal(new Set(STICKERS.map((s) => s.id)).size, STICKERS.length);
  for (const p of PAGES) assert.equal(STICKERS.filter((s) => s.page === p.id).length, PAGE_SIZE);
});

test('цель дня выполнена — одна наклейка, второй раз за тот же день не дают', () => {
  const first = entry('t1', 10, 5);
  const a = award(defaultStickers(), first);
  assert.deepEqual(a.reasons, ['goal']);
  assert.equal(a.added.length, 1);
  assert.equal(a.state.owned[a.added[0]], T0);
  assert.deepEqual(a.state.fresh, a.added);
  const second = entry('t2', 10, 5, { finishedAt: T0 + 1000 });
  const b = award(a.state, second, [second, first]);
  assert.deepEqual(b.added, []);
  assert.equal(ownedCount(b.state), 1);
});

test('цель дня набирается из нескольких тренировок; пропуски не считаются', () => {
  const e1 = entry('t1', 6, 2);
  assert.deepEqual(award(defaultStickers(), e1).added, []);
  const e2 = entry('t1', 6, 2, { finishedAt: T0 + 1000, skipped: 3 });
  assert.deepEqual(award(defaultStickers(), e2, [e2, e1]).added, [], '6 + 3 отвеченных — меньше 10');
  const e3 = entry('t1', 6, 2, { finishedAt: T0 + 2000 });
  assert.equal(award(defaultStickers(), e3, [e3, e1]).added.length, 1);
});

test('на следующий день за цель снова дают наклейку', () => {
  const e1 = entry('t1', 10, 5);
  const a = award(defaultStickers(), e1);
  const e2 = entry('t1', 10, 5, { finishedAt: T0 + DAY });
  const b = award(a.state, e2, [e2, e1]);
  assert.equal(b.added.length, 1);
  assert.notEqual(b.added[0], a.added[0], 'повторов нет');
});

test('тема на 80% и выше — наклейка, но только первый раз', () => {
  const e1 = entry('t1', 5, 4);
  const a = award(defaultStickers(), e1, [e1], 20);
  assert.deepEqual(a.reasons, ['topic']);
  assert.equal(a.added.length, 1);
  const e2 = entry('t1', 5, 5, { finishedAt: T0 + 1000 });
  assert.deepEqual(award(a.state, e2, [e2, e1], 20).added, []);
});

test('цель дня и тема в одной тренировке — две наклейки', () => {
  const a = award(defaultStickers(), entry('t1', 10, 9));
  assert.deepEqual(a.reasons, ['goal', 'topic']);
  assert.equal(new Set(a.added).size, 2);
});

test('за тему не дают: меньше 80%, меньше 5 вопросов, работа над ошибками, контрольная, свой тест, тренажёр', () => {
  assert.equal(stickerTopic(entry('t1', 10, 7)), null);
  assert.equal(stickerTopic(entry('t1', 4, 4)), null);
  assert.equal(stickerTopic(entry('t1', 5, 5, { source: { kind: 'topic', topicIds: ['t1'], title: 'Работа над ошибками: Тема' } })), null);
  assert.equal(stickerTopic(entry('t1', 10, 10, { source: { kind: 'exam', topicIds: ['t1', 't2'], title: 'Контрольная' } })), null);
  assert.equal(stickerTopic(entry('t1', 10, 10, { source: { kind: 'custom', testId: 'x', title: 'Мой тест' } })), null);
  assert.equal(stickerTopic(entry('t1', 10, 10, { source: { kind: 'drill', drillId: 'd', title: 'Тренажёр' } })), null);
  assert.equal(stickerTopic(entry('t1', 5, 4)), 't1');
});

test('альбом собирается целиком без повторов, после этого наклейки не выдаются', () => {
  let state = defaultStickers();
  const history = [];
  for (let i = 0; i < STICKERS.length; i++) {
    const e = entry(`t${i}`, 5, 5, { finishedAt: T0 + i * 1000 });
    history.unshift(e);
    const res = award(state, e, history, 20);
    assert.equal(res.added.length, i === 3 ? 2 : 1, `тренировка ${i}`); // на четвёртой набралось 20 вопросов — ещё и цель дня
    state = res.state;
    if (albumComplete(state)) break;
  }
  assert.ok(albumComplete(state));
  assert.equal(ownedCount(state), STICKERS.length);
  const extra = entry('new-topic', 5, 5, { finishedAt: T0 + DAY });
  const res = award(state, extra, [extra, ...history], 5);
  assert.deepEqual(res.added, []);
  assert.equal(ownedCount(res.state), STICKERS.length);
});

test('стартовый набор: не больше 6, один раз, прошлые темы и дни второй раз не засчитываются', () => {
  const history = [];
  for (let i = 0; i < 10; i++) history.unshift(entry(`t${i}`, 10, 9, { finishedAt: T0 - (10 - i) * DAY }));
  const a = starterSet(defaultStickers(), { history, goal: 10, now: T0, rng: seededRng(2) });
  assert.equal(a.added.length, STARTER_MAX);
  assert.equal(a.state.starter, true);
  assert.equal(a.state.topics.length, 10);
  assert.equal(a.state.days.length, 10);
  assert.deepEqual(starterSet(a.state, { history, goal: 10, now: T0 }).added, []);
  // Та же тема ещё раз — уже не даёт наклейку, а цель нового дня даёт.
  const again = entry('t3', 10, 10, { finishedAt: T0 });
  const b = award(a.state, again, [again, ...history]);
  assert.deepEqual(b.reasons, ['goal']);
});

test('стартовый набор: новичку ничего, одна прошлая тема — одна наклейка', () => {
  const a = starterSet(defaultStickers(), { history: [], goal: 10, now: T0 });
  assert.deepEqual(a.added, []);
  assert.equal(a.state.starter, true);
  const b = starterSet(defaultStickers(), { history: [entry('t1', 5, 5, { finishedAt: T0 - DAY })], goal: 10, now: T0, rng: seededRng(3) });
  assert.equal(b.added.length, 1);
});

test('отметка «новая» снимается только с рассмотренных наклеек', () => {
  const a = award(defaultStickers(), entry('t1', 10, 9));
  const [x, y] = a.added;
  const seen = markSeen(a.state, [x]);
  assert.deepEqual(seen.fresh, [y]);
  assert.equal(markSeen(seen, [x]), seen, 'нечего снимать — состояние то же');
});

test('наклейки тренировки находятся по времени её окончания', () => {
  const a = award(defaultStickers(), entry('t1', 10, 9));
  assert.deepEqual(stickersOfEntry(a.state, T0).map((s) => s.id).sort(), [...a.added].sort());
  assert.deepEqual(stickersOfEntry(a.state, T0 + 1), []);
});

test('проверка сохранённых данных: мусор отбрасывается, старые данные без альбома открываются', () => {
  const id = STICKERS[0].id;
  const s = sanitizeStickers({ owned: { [id]: 5, 'no-such': 5, [STICKERS[1].id]: 'x' }, fresh: [id, 'no-such', id], days: ['2026-11-10', 'вчера'], topics: ['t1', 7], starter: 1 });
  assert.deepEqual(s, { owned: { [id]: 5 }, fresh: [id], days: ['2026-11-10'], topics: ['t1'], starter: false });
  assert.deepEqual(sanitizeStickers(null), defaultStickers());
  const old = defaultData();
  delete old.stickers;
  const { data, dropped } = sanitizeData(old);
  assert.deepEqual(data.stickers, defaultStickers());
  assert.equal(dropped, 0);
});
