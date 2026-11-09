// Тренажёр неправильных глаголов (английский): go — went. Проверка списка, круг, варианты, выученность. Без DOM.
// Список — data/english-verbs-4.json: verbs [{ id, base, past, ru }].
import { shuffle, normalizeEnglish } from './words.js';

export const VERB_MODES = ['cards', 'choose', 'write'];
export const ROUND_SIZE = 10;
export const LEARNED_STREAK = 2; // столько раз подряд написал правильно — глагол выучен

export function validateVerbs(list) {
  if (!list || !Array.isArray(list.verbs)) return ['Нет verbs'];
  const errors = [];
  const ids = new Set();
  for (const v of list.verbs) {
    const where = `Глагол «${v?.id}»`;
    if (typeof v?.id !== 'string' || !/^[a-z-]+$/.test(v.id)) errors.push(`${where}: id — латиница`);
    else if (ids.has(v.id)) errors.push(`${where}: повторяется id`);
    ids.add(v?.id);
    for (const key of ['base', 'past']) if (!/^[a-z]+$/.test(String(v?.[key] ?? ''))) errors.push(`${where}: ${key} — одно слово маленькими латинскими буквами`);
    if (!String(v?.ru ?? '').trim()) errors.push(`${where}: нет перевода`);
  }
  return errors;
}

/** Хранение: { [id]: { streak, at } } — сколько раз подряд форму написали верно и когда последний раз. */
export const defaultVerbs = () => ({});

export function sanitizeVerbs(raw) {
  const out = defaultVerbs();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, r] of Object.entries(raw)) {
    if (!/^[a-z-]{1,30}$/.test(id) || !r || !Number.isInteger(r.streak) || r.streak < 0 || r.streak > 100 || !Number.isFinite(r.at)) continue;
    out[id] = { streak: r.streak, at: r.at };
  }
  return out;
}

export const isLearned = (state, id) => (state[id]?.streak ?? 0) >= LEARNED_STREAK;

/** Ответ в «Напиши форму»: верно — серия +1, ошибка — серия с нуля. */
export function recordVerb(state, id, ok, now = Date.now()) {
  return { ...state, [id]: { streak: ok ? (state[id]?.streak ?? 0) + 1 : 0, at: now } };
}

/** Глаголы на круг: сначала невыученные (давно не тренированные — раньше), потом выученные. */
export function pickRound(verbs, state, size = ROUND_SIZE, random = Math.random) {
  const at = (v) => state[v.id]?.at ?? 0;
  const order = (list) => shuffle(list, random).sort((a, b) => at(a) - at(b));
  return [...order(verbs.filter((v) => !isLearned(state, v.id))), ...order(verbs.filter((v) => isLearned(state, v.id)))].slice(0, size);
}

/** Неправильная «правильная» форма — частая ошибка: buy → buyed, make → maked. */
export const regularMistake = (base) => (base.endsWith('e') ? `${base}d` : `${base}ed`);

/** Варианты прошедшего времени: верный, ошибка «по правилу» и две формы других глаголов. */
export function verbOptions(verb, all, random = Math.random) {
  const opts = [verb.past];
  const fake = regularMistake(verb.base);
  if (fake !== verb.past) opts.push(fake);
  for (const v of shuffle(all, random)) {
    if (opts.length >= 4) break;
    if (!opts.includes(v.past)) opts.push(v.past);
  }
  return shuffle(opts, random);
}

export const checkPast = (verb, typed) => normalizeEnglish(typed) === verb.past;
