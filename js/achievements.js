// Значки: за что даются, проверка после тренировки, хранение даты получения. Без DOM.
// Больше половины значков — за регулярность и исправление ошибок, а не за 100%.
import { MASTERED_PERCENT } from './results.js';
import { plural } from './utils.js';

export const BADGES = [
  { id: 'first', emoji: '👣', title: 'Первый шаг', how: 'Пройди первую тренировку.' },
  { id: 'week', emoji: '📅', title: 'Неделя', how: 'Занимайся 7 дней подряд.' },
  { id: 'month', emoji: '🗓️', title: 'Месяц занятий', how: 'Занимайся 30 дней (не обязательно подряд).' },
  { id: 'q100', emoji: '💯', title: 'Сотня', how: 'Реши 100 вопросов.' },
  { id: 'q500', emoji: '🚀', title: 'Пятисотка', how: 'Реши 500 вопросов.' },
  { id: 'q1000', emoji: '👑', title: 'Тысячник', how: 'Реши 1000 вопросов.' },
  { id: 'perfect', emoji: '⭐', title: 'Отличник', how: 'Пройди тренировку от 10 вопросов без единой ошибки.' },
  { id: 'sniper', emoji: '🎯', title: 'Снайпер', how: 'Ответь верно на 10 вопросов подряд в одной тренировке.' },
  { id: 'fixer', emoji: '🔧', title: 'Работа над ошибками', how: 'Повтори свои ошибки и исправь их все.' },
  { id: 'leap', emoji: '📈', title: 'Рывок', how: 'Подними результат по теме: было меньше 50% — стало 80% и больше.' },
  { id: 'expert', emoji: '🧠', title: 'Знаток раздела', how: 'Освой все темы одного раздела (в нём хотя бы две темы).' },
  { id: 'traveler', emoji: '🧭', title: 'Путешественник', how: 'Позанимайся по всем предметам.' },
  { id: 'olympiad', emoji: '🏅', title: 'Олимпиадник', how: 'Реши верно олимпиадную задачу.' },
  { id: 'vpr', emoji: '📝', title: 'Готов к ВПР', how: 'Пройди тренировку по ВПР от 10 вопросов.' },
  { id: 'teacher', emoji: '✏️', title: 'Учитель', how: 'Составь свой тест для класса.' },
];
export const BADGE_IDS = new Set(BADGES.map((b) => b.id));

export const FIXES_PREFIX = 'Работа над ошибками';
const SNIPER_RUN = 10;
const BIG_TEST = 10;

/**
 * Что значки должны знать о содержимом: темы олимпиады и ВПР, разделы, предметы.
 * topics — темы класса ребёнка.
 */
export function catalogInfo(topics) {
  const sections = new Map();
  const subjects = new Map();
  for (const t of topics) {
    const key = `${t.subjectId}|${t.section || ''}`;
    if (!sections.has(key)) sections.set(key, []);
    sections.get(key).push(t.id);
    if (!subjects.has(t.subjectId)) subjects.set(t.subjectId, []);
    subjects.get(t.subjectId).push(t.id);
  }
  return {
    olympiad: new Set(topics.filter((t) => t.section === 'Олимпиада').map((t) => t.id)),
    vpr: new Set(topics.filter((t) => t.section === 'ВПР и МЦКО').map((t) => t.id)),
    sections: [...sections.values()],
    subjects: [...subjects.values()],
  };
}

/** Значки за одну тренировку. prevTopicLast — последний % по темам ДО этой тренировки. */
export function badgesForEntry(entry, prevTopicLast, cat) {
  const out = new Set();
  const review = entry.review || [];
  if (entry.total >= BIG_TEST && entry.correct === entry.total) out.add('perfect');
  let run = 0;
  for (const r of review) {
    run = r.status === 'correct' ? run + 1 : 0;
    if (run >= SNIPER_RUN) out.add('sniper');
  }
  if (String(entry.source?.title || '').startsWith(FIXES_PREFIX) && entry.total > 0 && entry.correct === entry.total) out.add('fixer');
  for (const [topicId, t] of Object.entries(entry.topicStats || {})) {
    const before = prevTopicLast[topicId];
    const now = t.total ? (t.correct / t.total) * 100 : 0;
    if (before !== undefined && before < 50 && now >= MASTERED_PERCENT) out.add('leap');
  }
  if (review.some((r) => r.status === 'correct' && cat.olympiad.has(r.topicId))) out.add('olympiad');
  if (entry.total >= BIG_TEST && review.length && review.every((r) => cat.vpr.has(r.topicId))) out.add('vpr');
  return out;
}

/** Значки по накопленным счётчикам и своим тестам. */
export function badgesForTotals(stats, customTests, cat) {
  const out = new Set();
  if (stats.questions > 0) out.add('first');
  if (stats.bestStreak >= 7) out.add('week');
  if (stats.days.length >= 30) out.add('month');
  if (stats.questions >= 100) out.add('q100');
  if (stats.questions >= 500) out.add('q500');
  if (stats.questions >= 1000) out.add('q1000');
  const mastered = (id) => stats.topicLast[id] >= MASTERED_PERCENT;
  // Раздел из одной темы — слишком просто для «Знатока»: нужны хотя бы две темы.
  if (cat.sections.some((ids) => ids.length >= 2 && ids.every(mastered))) out.add('expert');
  if (cat.subjects.length > 1 && cat.subjects.every((ids) => ids.some((id) => stats.topicLast[id] !== undefined))) out.add('traveler');
  if ((customTests || []).some((t) => t.origin !== 'imported')) out.add('teacher');
  return out;
}

/** Добавляет новые значки с датой; уже полученные не трогает. Возвращает { badges, added }. */
export function award(badges, ids, at) {
  const next = { ...badges };
  const added = [];
  for (const id of ids) {
    if (BADGE_IDS.has(id) && !next[id]) {
      next[id] = at;
      added.push(id);
    }
  }
  return { badges: next, added };
}

/**
 * Значки по всей истории — для тех, кто занимался до появления значков.
 * history — новые сначала; дата значка — дата той тренировки, где он заработан.
 */
export function badgesFromHistory(history, cat) {
  const found = new Map();
  const topicLast = {};
  for (const e of [...history].reverse()) {
    for (const id of badgesForEntry(e, topicLast, cat)) if (!found.has(id)) found.set(id, e.finishedAt);
    for (const [topicId, t] of Object.entries(e.topicStats || {})) if (t.total) topicLast[topicId] = (t.correct / t.total) * 100;
  }
  return found;
}

/** Проверка сохранённых значков: только известные id и даты-числа. */
export function sanitizeBadges(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, at] of Object.entries(raw)) if (BADGE_IDS.has(id) && Number.isFinite(at) && at > 0) out[id] = at;
  return out;
}

/** Текст «похвастаться»: «Макс в Контрольке: 23 дня, 640 вопросов, 9 значков из 15». */
export function shareAchievementsText({ nickname, avatarName, stats, badges }) {
  const who = nickname ? (avatarName ? `${nickname} (${avatarName})` : nickname) : avatarName || 'Я';
  const n = (x, forms) => `${x} ${plural(x, forms)}`;
  const got = Object.keys(badges).length;
  return `${who} в Контрольке: ${n(stats.days.length, ['день', 'дня', 'дней'])}, ${n(stats.questions, ['вопрос', 'вопроса', 'вопросов'])}, ${n(got, ['значок', 'значка', 'значков'])} из ${BADGES.length}`;
}
