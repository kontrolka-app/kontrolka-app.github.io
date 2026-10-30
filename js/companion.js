// Компаньон: какую фразу сказать и когда. Без DOM. Ответы не подсказывает — только настроение.
import { PHRASES } from './companion-phrases.js';
import { dayKey } from './results.js';

export const RETURN_AFTER_DAYS = 3;

/** Подставляет имя и цель; без имени обращение убирается аккуратно: «Привет, {имя}!» → «Привет!». */
export function fillPhrase(template, { name = '', goal = 10 } = {}) {
  let t = template.replace(/\{N\}/g, String(goal));
  t = name ? t.replace(/\{имя\}/g, name) : t.replace(/,\s*\{имя\}/g, '').replace(/\{имя\},?\s*/g, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Фраза на событие: { text, mood, key } или null. Одна и та же фраза не повторяется подряд
 * (last — key прошлой фразы). rng — для тестов.
 */
export function pickPhrase(event, { last = '', name = '', goal = 10, rng = Math.random } = {}) {
  const group = PHRASES[event];
  if (!group) return null;
  let options = group.list.map((tpl, i) => ({ tpl, key: `${event}:${i}` }));
  if (options.length > 1) options = options.filter((o) => o.key !== last);
  const pick = options[Math.floor(rng() * options.length)] || options[0];
  return { text: fillPhrase(pick.tpl, { name, goal }), mood: group.mood, key: pick.key };
}

/** Событие начала дня: null — сегодня уже здоровались; returnBack — перерыв от 3 дней; иначе dayStart. */
export function dayEvent(stats, lastGreetDay, now = Date.now()) {
  const today = dayKey(now);
  if (lastGreetDay === today) return null;
  const lastActive = stats.days[stats.days.length - 1];
  if (lastActive && lastActive !== today) {
    const gap = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${lastActive}T12:00:00`)) / 86400000);
    if (gap >= RETURN_AFTER_DAYS) return 'returnBack';
  }
  return 'dayStart';
}

/** Серия верных ответов: фраза только на ровно 3, 5 и 10 подряд. */
export function streakEvent(streak) {
  return { 3: 'streak3', 5: 'streak5', 10: 'streak10' }[streak] || null;
}

/** Ошибки: не после каждой, чтобы не надоедать, — после первой и затем каждой третьей в тренировке. */
export function mistakeEvent(wrongCount) {
  return wrongCount === 1 || (wrongCount > 1 && wrongCount % 3 === 0) ? 'mistake' : null;
}

export function sanitizeCompanion(raw) {
  const out = { lastDay: '', lastPhrase: '' };
  if (!raw || typeof raw !== 'object') return out;
  if (typeof raw.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastDay)) out.lastDay = raw.lastDay;
  if (typeof raw.lastPhrase === 'string') out.lastPhrase = raw.lastPhrase.slice(0, 40);
  return out;
}
