// Карта пути: темы предмета — остановки на дорожке в порядке учебника. Без DOM.
// Все остановки открыты: путь показывает, что пройдено и куда идти дальше, но ничего не запирает.
import { topicStatus } from './results.js';
import { nextTopic } from './catalog.js';

/** Как показывать темы предмета: дорожкой или списком по разделам. */
export const TOPIC_VIEWS = ['path', 'list'];
/** Расстояние между остановками по вертикали, px. */
export const PATH_STEP = 108;
/** Отступ дорожки сверху и снизу, px. */
export const PATH_PAD = 28;
/** Положение остановок по горизонтали, % ширины: дорожка идёт змейкой. */
const XS = [26, 50, 74, 50];
/** Разделы-«бонусы» в конце пути: не темы учебника, а подготовка к проверочным и олимпиадам. */
export const BONUS_SECTIONS = new Set(['ВПР и МЦКО', 'Олимпиада']);

/**
 * Нарисованные карты под дорожкой: предмет → сколько частей (assets/path/<предмет>-<номер>.webp, сверху вниз).
 * Предмета нет в списке — фон рисуется цветом предмета.
 */
export const PATH_MAPS = { russian: 3, math: 3, world: 3, reading: 3, english: 3 };

/**
 * Где на пути «ты здесь»: следующая неосвоенная тема после той, которой занимались последней;
 * ещё ничего не проходили — первая тема; всё освоено — null.
 */
export function currentStopId(topics, lastResults) {
  if (!topics.length) return null;
  let lastId = null;
  let lastAt = -1;
  for (const t of topics) {
    const r = lastResults.get(t.id);
    if (r && r.finishedAt > lastAt) [lastAt, lastId] = [r.finishedAt, t.id];
  }
  const mastered = (id) => topicStatus(lastResults.get(id)) === 'mastered';
  if (lastId === null) return topics[0].id;
  if (!mastered(lastId)) return lastId;
  return nextTopic(topics, lastId, mastered)?.id ?? null;
}

/**
 * Остановки пути: { topic, n, x (% ширины), y (px от верха до центра кружка), side — с какой стороны подпись,
 * status, percent, bonus, here, sectionStart — с этой темы начинается раздел из нескольких тем }.
 */
export function pathStops(topics, lastResults) {
  const here = currentStopId(topics, lastResults);
  const sizes = new Map();
  for (const t of topics) sizes.set(t.section, (sizes.get(t.section) || 0) + 1);
  return topics.map((topic, i) => {
    const last = lastResults.get(topic.id) || null;
    const x = XS[i % XS.length];
    return {
      topic,
      n: i + 1,
      x,
      y: PATH_PAD + PATH_STEP / 2 + i * PATH_STEP,
      side: x > 50 ? 'left' : 'right',
      status: topicStatus(last),
      percent: last ? last.percent : null,
      bonus: BONUS_SECTIONS.has(topic.section),
      here: topic.id === here,
      sectionStart: Boolean(topic.section) && sizes.get(topic.section) > 1 && topics[i - 1]?.section !== topic.section,
    };
  });
}

export function pathHeight(count) {
  return PATH_PAD * 2 + count * PATH_STEP;
}

/** Линия дорожки через все остановки для SVG (ось x — проценты 0–100, ось y — px). */
export function pathLine(stops) {
  if (!stops.length) return '';
  let d = `M ${stops[0].x} ${stops[0].y}`;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const mid = (a.y + b.y) / 2;
    d += ` C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
  }
  return d;
}

/** Сколько остановок освоено — для подписи над дорожкой. */
export function masteredStops(stops) {
  return stops.filter((s) => s.status === 'mastered').length;
}
