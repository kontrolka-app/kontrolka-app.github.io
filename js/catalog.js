// Каталог заданий: какие классы есть, выбор класса, поиск тем. Без DOM.

export const ALL_GRADES = Array.from({ length: 11 }, (_, i) => i + 1);

/** Классы, по которым есть задания, по возрастанию. */
export function availableGrades(topics) {
  return [...new Set(topics.map((t) => t.grade))].filter((g) => ALL_GRADES.includes(g)).sort((a, b) => a - b);
}

/**
 * С каким классом работать: выбранный, если по нему есть задания;
 * иначе единственный класс с заданиями; иначе null (пусть ребёнок выберет сам).
 * Пустой список классов (задания не загрузились) — выбор не трогаем.
 */
export function resolveGrade(selected, grades) {
  if (!grades.length || grades.includes(selected)) return selected ?? null;
  return grades.length === 1 ? grades[0] : null;
}

/** [1, 2, 3, 5, 6, 7] → «1–3, 5–7». */
export function gradeRangesText(grades) {
  const sorted = [...grades].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    parts.push(start === sorted[i] ? String(start) : `${start}–${sorted[i]}`);
  }
  return parts.join(', ');
}

/** Темы по разделам учебника в исходном порядке: [{ section, topics }]. Темы без раздела — в «Другие темы». */
export function groupBySection(topics) {
  const groups = new Map();
  for (const t of topics) {
    const key = t.section || 'Другие темы';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups].map(([section, list]) => ({ section, topics: list }));
}

/**
 * Следующая тема после текущей: первая дальше по порядку, которую ещё не освоили;
 * если дальше всё освоено — первая неосвоенная с начала; всё освоено — null.
 * isMastered(topicId) — освоена ли тема.
 */
export function nextTopic(topics, currentId, isMastered) {
  const i = topics.findIndex((t) => t.id === currentId);
  const after = topics.slice(i + 1);
  const before = i >= 0 ? topics.slice(0, i) : [];
  return [...after, ...before].find((t) => !isMastered(t.id)) || null;
}

/**
 * Что предложить на главной, когда нет незаконченной тренировки (история — новые сначала):
 * { kind: 'mistakes', topic, count } — самая недавняя тема, где остались неразобранные ошибки;
 * { kind: 'next', topic } — следующая не начатая тема того же раздела (потом — того же предмета);
 * null — истории нет или всё уже начато.
 * pendingCount(topicId) — сколько ошибок к разбору; isStarted(topicId) — проходили ли тему.
 */
export function suggestNext(history, topics, { pendingCount, isStarted }) {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const recent = [];
  for (const h of history) {
    if (h.source?.kind !== 'topic') continue;
    for (const id of h.source.topicIds || []) if (byId.has(id) && !recent.includes(id)) recent.push(id);
  }
  for (const id of recent) {
    const count = pendingCount(id);
    if (count > 0) return { kind: 'mistakes', topic: byId.get(id), count };
  }
  const last = byId.get(recent[0]);
  if (!last) return null;
  const subject = topics.filter((t) => t.subjectId === last.subjectId && t.grade === last.grade);
  const section = subject.filter((t) => t.section === last.section);
  const pick = (list) => list.find((t) => !isStarted(t.id));
  const next = pick(section.slice(section.indexOf(last) + 1)) || pick(subject.slice(subject.indexOf(last) + 1)) || pick(subject);
  return next ? { kind: 'next', topic: next } : null;
}

/** Первый вход: ещё не знакомились, нет имени и ни одной тренировки. */
export function needsWelcome(data) {
  return !data.settings.introDone && !data.settings.nickname && !data.history.length;
}

const fold = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

/**
 * Поиск тем по названию, разделу и описанию.
 * nothingFound — только при непустом запросе: пустой список без запроса — это не «ничего не нашлось».
 */
export function searchTopics(topics, query) {
  const q = fold(String(query ?? '').trim());
  const found = q ? topics.filter((t) => fold(`${t.title} ${t.section || ''} ${t.description || ''}`).includes(q)) : topics.slice();
  return { query: q, found, nothingFound: q !== '' && found.length === 0 };
}
