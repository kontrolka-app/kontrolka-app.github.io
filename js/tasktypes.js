// Типы заданий «Выбери все верные» (multi-choice), «Соедини пары» (match), «Расставь по порядку» (order).
// Проверка, проверка данных и ответ текстом. Без DOM.
//
// multi-choice: options [{ id, text }], correctAnswers ['a', 'c'];   ответ — список id выбранных вариантов.
// match:        pairs [{ left, right }] — правильные пары;           ответ — given[i] = номер пары, чей right выбран к left i.
// order:        items ['…'] — в правильном порядке;                 ответ — номера пунктов в том порядке, как их расставил ребёнок.

export const MATCH_MIN = 3;
export const MATCH_MAX = 6;
export const ORDER_MIN = 3;
export const ORDER_MAX = 8;

const isStr = (v) => typeof v === 'string';
const isNonEmptyStr = (v) => isStr(v) && v.trim().length > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isIndexList = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => Number.isInteger(x) && x >= 0 && x < n);
const norm = (s) => s.trim().toLowerCase();

/** Проверка ответа. { status: 'correct' | 'wrong' | 'invalid', message? } */
export function checkTaskType(q, given) {
  switch (q.type) {
    case 'multi-choice': {
      if (!Array.isArray(given) || !given.length) return { status: 'invalid', message: 'Отметь хотя бы один вариант.' };
      const ids = new Set(q.options.map((o) => o.id));
      if (!given.every((g) => ids.has(g))) return { status: 'invalid', message: 'Такого варианта нет.' };
      const chosen = new Set(given);
      const right = new Set(q.correctAnswers);
      const same = chosen.size === right.size && [...chosen].every((g) => right.has(g));
      return { status: same ? 'correct' : 'wrong' };
    }
    case 'match': {
      const n = q.pairs.length;
      if (!Array.isArray(given) || given.length !== n || given.some((g) => g === null || g === undefined)) return { status: 'invalid', message: 'Соедини все пары.' };
      if (!isIndexList(given, n) || new Set(given).size !== n) return { status: 'invalid', message: 'Каждый ответ можно взять только один раз.' };
      return { status: given.every((g, i) => g === i) ? 'correct' : 'wrong' };
    }
    case 'order': {
      const n = q.items.length;
      if (!Array.isArray(given) || given.length < n) return { status: 'invalid', message: 'Расставь по порядку все пункты.' };
      if (!isIndexList(given, n) || new Set(given).size !== n) return { status: 'invalid', message: 'Каждый пункт можно поставить только один раз.' };
      return { status: given.every((g, k) => g === k) ? 'correct' : 'wrong' };
    }
    default:
      return { status: 'invalid', message: 'Неизвестный тип задания.' };
  }
}

/** Ошибки в данных вопроса (список строк). */
export function validateTaskType(q, where) {
  const errors = [];
  switch (q.type) {
    case 'multi-choice': {
      if (!Array.isArray(q.options) || q.options.length < 3) {
        errors.push(`${where}: для «выбери все верные» нужно минимум три варианта`);
        break;
      }
      const ids = new Set();
      const texts = new Set();
      for (const opt of q.options) {
        if (!isObj(opt) || !isNonEmptyStr(opt.id) || !isNonEmptyStr(opt.text)) {
          errors.push(`${where}: у варианта ответа должны быть id и текст`);
          continue;
        }
        if (ids.has(opt.id)) errors.push(`${where}: повторяется вариант «${opt.id}»`);
        if (texts.has(norm(opt.text))) errors.push(`${where}: повторяется текст варианта «${opt.text}»`);
        ids.add(opt.id);
        texts.add(norm(opt.text));
      }
      const ca = q.correctAnswers;
      if (!Array.isArray(ca) || !ca.length || !ca.every(isStr)) {
        errors.push(`${where}: correctAnswers — непустой список id верных вариантов`);
        break;
      }
      if (new Set(ca).size !== ca.length) errors.push(`${where}: в correctAnswers повторяется вариант`);
      for (const id of ca) if (!ids.has(id)) errors.push(`${where}: верный вариант «${id}» не найден среди вариантов`);
      if (new Set(ca).size >= ids.size) errors.push(`${where}: все варианты верные — нужен хотя бы один неверный`);
      break;
    }
    case 'match': {
      if (!Array.isArray(q.pairs) || q.pairs.length < MATCH_MIN || q.pairs.length > MATCH_MAX) {
        errors.push(`${where}: для «соедини пары» нужно от ${MATCH_MIN} до ${MATCH_MAX} пар`);
        break;
      }
      const lefts = new Set();
      const rights = new Set();
      for (const p of q.pairs) {
        if (!isObj(p) || !isNonEmptyStr(p.left) || !isNonEmptyStr(p.right)) {
          errors.push(`${where}: у пары должны быть left и right`);
          continue;
        }
        if (lefts.has(norm(p.left))) errors.push(`${where}: повторяется «${p.left}» в левом столбце`);
        if (rights.has(norm(p.right))) errors.push(`${where}: повторяется «${p.right}» в правом столбце`);
        lefts.add(norm(p.left));
        rights.add(norm(p.right));
      }
      break;
    }
    case 'order': {
      if (!Array.isArray(q.items) || q.items.length < ORDER_MIN || q.items.length > ORDER_MAX) {
        errors.push(`${where}: для «расставь по порядку» нужно от ${ORDER_MIN} до ${ORDER_MAX} пунктов`);
        break;
      }
      if (!q.items.every(isNonEmptyStr)) errors.push(`${where}: пункты должны быть непустыми строками`);
      else if (new Set(q.items.map(norm)).size !== q.items.length) errors.push(`${where}: пункты повторяются`);
      break;
    }
    default:
      break;
  }
  return errors;
}

/** Ответ ребёнка текстом — для разбора, истории и «Нашёл ошибку?». */
export function givenTaskText(q, given) {
  if (!Array.isArray(given) || !given.length) return 'нет ответа';
  switch (q.type) {
    case 'multi-choice':
      return q.options.filter((o) => given.includes(o.id)).map((o) => o.text).join('; ') || 'нет ответа';
    case 'match':
      return q.pairs.map((p, i) => `${p.left} — ${q.pairs[given[i]]?.right ?? '?'}`).join('; ');
    case 'order':
      return given.map((k) => q.items[k] ?? '?').join(' → ');
    default:
      return String(given);
  }
}

/** Правильный ответ текстом. */
export function correctTaskText(q) {
  switch (q.type) {
    case 'multi-choice':
      return q.options.filter((o) => q.correctAnswers.includes(o.id)).map((o) => o.text).join('; ');
    case 'match':
      return q.pairs.map((p) => `${p.left} — ${p.right}`).join('; ');
    case 'order':
      return q.items.join(' → ');
    default:
      return '';
  }
}

/** Простой хеш строки → число (FNV-1a), чтобы перемешивание зависело только от id вопроса. */
function hash(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619) >>> 0;
  }
  return x;
}

/**
 * Порядок показа n элементов: перемешан, но всегда одинаково для одного вопроса
 * (ответ не «прыгает» при перерисовке и после перезагрузки). Никогда не совпадает с правильным порядком.
 */
export function displayOrder(id, n) {
  const idx = Array.from({ length: n }, (_, i) => i);
  let s = hash(String(id)) || 1;
  const rng = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift());
  return idx;
}

/** Для разбора: верна ли каждая пара (match) или позиция (order). */
export function itemMarks(q, given) {
  if (!Array.isArray(given)) return [];
  if (q.type === 'match') return q.pairs.map((_, i) => given[i] === i);
  if (q.type === 'order') return given.map((g, k) => g === k);
  return [];
}
