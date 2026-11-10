// Анонимный счётчик GoatCounter: какие разделы открывают и сколько тренировок завершают.
// Уходят только названия из списков ниже. Имена, ответы, результаты и id тем и тестов не отправляются.

export const COUNT_URL = 'https://alexys.goatcounter.com/count';
/** Считаем только на опубликованном сайте: локальные запуски в статистику не попадают. */
export const SITE_HOST = 'kontrolka-app.github.io';

const ROUTE_NAMES = new Set(['home', 'grade', 'subjects', 'topics', 'topic', 'exam', 'quiz', 'result', 'history', 'favorites', 'settings', 'mytests', 'mytest', 'editor', 'poems', 'poem', 'poem-edit', 'speed', 'english', 'verbs', 'words', 'words-unit', 'words-train', 'etopics', 'etopic', 'etopic-add', 'etopic-edit', 'drills', 'drill', 'map', 'diag', 'album']);
const EVENT_NAMES = new Set(['training-finished']);

/** Адрес запроса для экрана; null — такого экрана нет в списке, ничего не отправляем. */
export function routeCountUrl(routeName) {
  return ROUTE_NAMES.has(routeName) ? `${COUNT_URL}?p=${encodeURIComponent(`/${routeName}`)}` : null;
}

/** Адрес запроса для события; null — такого события нет в списке. */
export function eventCountUrl(eventName) {
  return EVENT_NAMES.has(eventName) ? `${COUNT_URL}?p=${encodeURIComponent(eventName)}&e=true` : null;
}

export function shouldCount(hostname, webdriver = false) {
  return hostname === SITE_HOST && !webdriver;
}

// Сбой счётчика (нет сети, блокировщик рекламы) никак не влияет на приложение.
function send(url) {
  if (!url || !shouldCount(location.hostname, navigator.webdriver)) return;
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.src = `${url}&rnd=${Math.random().toString(36).slice(2)}`;
}

export const countRoute = (routeName) => send(routeCountUrl(routeName));
export const countEvent = (eventName) => send(eventCountUrl(eventName));
