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
 * Названия наклеек: id → { title, img }. Список согласован 2026-11-10 (docs/stickers-list.md); менять только с согласования.
 * На странице «с надписями» название — это сама надпись: её пишет приложение, на картинке текста нет.
 * img: true — картинка assets/stickers/<id>.webp готова (384×384, сгенерированы в ChatGPT).
 */
export const STICKER_INFO = {
  'animals-01': { title: 'Белый медведь', img: true },
  'animals-02': { title: 'Морж', img: true },
  'animals-03': { title: 'Тюлень', img: true },
  'animals-04': { title: 'Северный олень', img: true },
  'animals-05': { title: 'Песец', img: true },
  'animals-06': { title: 'Лемминг', img: true },
  'animals-07': { title: 'Бурый медведь', img: true },
  'animals-08': { title: 'Лось', img: true },
  'animals-09': { title: 'Рысь', img: true },
  'animals-10': { title: 'Белка', img: true },
  'animals-11': { title: 'Суслик', img: true },
  'animals-12': { title: 'Тушканчик', img: true },
  'space-01': { title: 'Ракета', img: true },
  'space-02': { title: 'Солнце', img: true },
  'space-03': { title: 'Земля', img: true },
  'space-04': { title: 'Луна', img: true },
  'space-05': { title: 'Марс', img: true },
  'space-06': { title: 'Юпитер', img: true },
  'space-07': { title: 'Сатурн', img: true },
  'space-08': { title: 'Комета', img: true },
  'space-09': { title: 'Спутник', img: true },
  'space-10': { title: 'Космонавт', img: true },
  'space-11': { title: 'Телескоп', img: true },
  'space-12': { title: 'Луноход', img: true },
  'dino-01': { title: 'Тираннозавр', img: true },
  'dino-02': { title: 'Трицератопс', img: true },
  'dino-03': { title: 'Стегозавр', img: true },
  'dino-04': { title: 'Диплодок', img: true },
  'dino-05': { title: 'Анкилозавр', img: true },
  'dino-06': { title: 'Велоцираптор', img: true },
  'dino-07': { title: 'Брахиозавр', img: true },
  'dino-08': { title: 'Спинозавр', img: true },
  'dino-09': { title: 'Птеранодон', img: true },
  'dino-10': { title: 'Плезиозавр', img: true },
  'dino-11': { title: 'Пахицефалозавр', img: true },
  'dino-12': { title: 'Малыш из яйца', img: true },
  'motto-01': { title: 'У тебя получится!', img: true },
  'motto-02': { title: 'Ошибка — это шаг вперёд', img: true },
  'motto-03': { title: 'Шаг за шагом', img: true },
  'motto-04': { title: 'Сегодня лучше, чем вчера', img: true },
  'motto-05': { title: 'Думай, пробуй, проверяй', img: true },
  'motto-06': { title: 'Не сдавайся!', img: true },
  'motto-07': { title: 'Знания — это сила', img: true },
  'motto-08': { title: 'Молодец, что стараешься!', img: true },
  'motto-09': { title: 'Трудно — значит, растёшь', img: true },
  'motto-10': { title: 'Спроси — и узнаешь', img: true },
  'motto-11': { title: 'Каждый день понемногу', img: true },
  'motto-12': { title: 'Ты можешь больше, чем думаешь', img: true },
};

export const STICKERS = PAGES.flatMap((p) =>
  Array.from({ length: PAGE_SIZE }, (_, i) => {
    const id = `${p.id}-${String(i + 1).padStart(2, '0')}`;
    return { id, page: p.id, n: i + 1, title: '', img: false, ...STICKER_INFO[id] };
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
