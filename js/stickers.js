// Альбом наклеек: каталог, за что выдаются, хранение. Без DOM.
// Наклейка — за выполненную цель дня и за тему, впервые пройденную на 80% и выше.
// Какая именно — случайная из ещё не открытых: повторов нет, ничего не сгорает и не отнимается.
import { dayKey, dailyProgress, MASTERED_PERCENT } from './results.js';
import { FIXES_PREFIX } from './achievements.js';

export const PAGE_SIZE = 12;
/** Страницы альбома. emoji — для закладки страницы и временной картинки, пока нет настоящей. */
export const PAGES = [
  { id: 'animals', title: 'Животные России', emoji: '🦊', color: '#DDF3E6' },
  { id: 'space', title: 'Космос', emoji: '🚀', color: '#E3E9FF' },
  { id: 'dino', title: 'Динозавры', emoji: '🦕', color: '#FFF0C7' },
  { id: 'motto', title: 'Наклейки с надписями', emoji: '💬', color: '#EDE4FA' },
];

/**
 * Названия и подписи наклеек: id → { title, text? }. text — надпись на наклейках страницы «с надписями»
 * (её пишет приложение, а не картинка). Заполняется после согласования списка (docs/stickers-list.md).
 * img: true — картинка assets/stickers/<id>.webp готова.
 */
export const STICKER_INFO = {};

export const STICKERS = PAGES.flatMap((p) =>
  Array.from({ length: PAGE_SIZE }, (_, i) => {
    const id = `${p.id}-${String(i + 1).padStart(2, '0')}`;
    return { id, page: p.id, n: i + 1, title: '', text: '', img: false, ...STICKER_INFO[id] };
  }),
);
export const STICKER_IDS = new Set(STICKERS.map((s) => s.id));

/** Сколько наклеек самое большее выдаётся за занятия до появления альбома. */
export const STARTER_MAX = 6;
/** Тема засчитывается для наклейки, если в тренировке было не меньше стольких вопросов. */
export const TOPIC_MIN_QUESTIONS = 5;

/**
 * owned — id → когда получена; fresh — ещё не рассмотренные в альбоме;
 * days — дни, за которые наклейка за цель уже выдана; topics — темы, за которые уже выдана;
 * starter — стартовый набор за прошлые занятия уже посчитан.
 */
export function defaultStickers() {
  return { owned: {}, fresh: [], days: [], topics: [], starter: false };
}

export function sanitizeStickers(raw) {
  const out = defaultStickers();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (raw.owned && typeof raw.owned === 'object' && !Array.isArray(raw.owned)) {
    for (const [id, at] of Object.entries(raw.owned)) if (STICKER_IDS.has(id) && Number.isFinite(at) && at > 0) out.owned[id] = at;
  }
  if (Array.isArray(raw.fresh)) out.fresh = [...new Set(raw.fresh.filter((id) => Object.hasOwn(out.owned, id)))];
  if (Array.isArray(raw.days)) out.days = [...new Set(raw.days.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (Array.isArray(raw.topics)) out.topics = [...new Set(raw.topics.filter((t) => typeof t === 'string' && t.length < 200))];
  out.starter = raw.starter === true;
  return out;
}

export const ownedCount = (state) => Object.keys(state.owned).length;
export const albumComplete = (state) => ownedCount(state) >= STICKERS.length;

/** Выдаёт count случайных наклеек из ещё не открытых. Возвращает { state, added }. */
function give(state, count, at, rng) {
  const left = STICKERS.filter((s) => !Object.hasOwn(state.owned, s.id)).map((s) => s.id);
  const added = [];
  while (added.length < count && left.length) added.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
  if (!added.length) return { state, added };
  const owned = { ...state.owned };
  for (const id of added) owned[id] = at;
  return { state: { ...state, owned, fresh: [...state.fresh, ...added] }, added };
}

/** Тема, за которую эта тренировка даёт наклейку (или null): обычная тренировка по одной теме, от 5 вопросов, 80% и выше. */
export function stickerTopic(entry) {
  const s = entry.source || {};
  if (s.kind !== 'topic' || s.topicIds?.length !== 1) return null;
  if (String(s.title || '').startsWith(FIXES_PREFIX)) return null;
  if (entry.total < TOPIC_MIN_QUESTIONS || entry.percent < MASTERED_PERCENT) return null;
  return s.topicIds[0];
}

/**
 * Наклейки за только что завершённую тренировку. history — уже вместе с ней (новые сначала).
 * Возвращает { state, added, reasons } — reasons: 'goal' и/или 'topic'.
 * Дата получения — время окончания тренировки: по ней экран результата узнаёт «свои» наклейки.
 */
export function awardForEntry(state, { entry, history, goal, rng = Math.random }) {
  let next = state;
  const reasons = [];
  const day = dayKey(entry.finishedAt);
  if (!next.days.includes(day) && dailyProgress(history, goal, entry.finishedAt).done) {
    next = { ...next, days: [...next.days, day].sort() };
    reasons.push('goal');
  }
  const topicId = stickerTopic(entry);
  if (topicId && !next.topics.includes(topicId)) {
    next = { ...next, topics: [...next.topics, topicId] };
    reasons.push('topic');
  }
  const res = give(next, reasons.length, entry.finishedAt, rng);
  return { state: res.state, added: res.added, reasons };
}

/**
 * Стартовый набор — один раз, для тех, кто занимался до появления альбома: по наклейке за каждую
 * уже засчитанную тему и каждый день с выполненной целью, но не больше STARTER_MAX.
 * Эти темы и дни помечаются выданными, чтобы за них не получить наклейку второй раз.
 */
export function starterSet(state, { history, goal, now = Date.now(), rng = Math.random }) {
  if (state.starter) return { state, added: [] };
  const topics = new Set(state.topics);
  const perDay = new Map();
  for (const e of history) {
    const t = stickerTopic(e);
    if (t) topics.add(t);
    if (e.finishedAt) perDay.set(dayKey(e.finishedAt), (perDay.get(dayKey(e.finishedAt)) || 0) + Math.max(0, (e.total || 0) - (e.skipped || 0)));
  }
  const days = new Set(state.days);
  for (const [d, n] of perDay) if (n >= goal) days.add(d);
  const earned = topics.size - state.topics.length + (days.size - state.days.length);
  const res = give({ ...state, topics: [...topics], days: [...days].sort(), starter: true }, Math.min(STARTER_MAX, earned), now, rng);
  return { state: res.state, added: res.added };
}

/** Наклейки ids рассмотрены в альбоме — отметка «новая» с них снимается. */
export function markSeen(state, ids) {
  const seen = new Set(ids);
  const fresh = state.fresh.filter((id) => !seen.has(id));
  return fresh.length === state.fresh.length ? state : { ...state, fresh };
}

/** Наклейки, полученные за тренировку, которая закончилась в момент finishedAt. */
export function stickersOfEntry(state, finishedAt) {
  return STICKERS.filter((s) => state.owned[s.id] === finishedAt);
}
