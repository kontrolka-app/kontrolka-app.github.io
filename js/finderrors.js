// «Найди ошибки в тексте»: разбор текста с ошибками и проверка ответа. Без DOM.
// В данных ошибка записана прямо в тексте: {как написано|как правильно|правило одной строкой}.
// Пример: «В {лису|лесу|Безударная гласная в корне: лес.} было тихо.»
import { normalizeText } from './utils.js';

const MARK = /\{([^{}|]+)\|([^{}|]+)\|([^{}|]+)\}/;

/**
 * Текст → слова, на которые можно нажать: [{ text, before, after, word, error? }].
 * before/after — знаки препинания вокруг слова; error — { shown, correct, rule }.
 * Пробелы между словами не хранятся: слова идут через один пробел.
 */
export function parseErrorText(text) {
  const out = [];
  // Метки не содержат пробелов в «как написано», но «как правильно» и правило — могут; прячем их на время разбора.
  const marks = [];
  const masked = String(text).replace(new RegExp(MARK, 'g'), (m, shown, correct, rule) => {
    marks.push({ shown: shown.trim(), correct: correct.trim(), rule: rule.trim() });
    return `\u0000${marks.length - 1}\u0000`;
  });
  for (const chunk of masked.split(/\s+/).filter(Boolean)) {
    const m = chunk.match(/^(.*?)\u0000(\d+)\u0000(.*)$/);
    if (m) {
      const error = marks[Number(m[2])];
      out.push({ before: m[1], word: error.shown, after: m[3], text: `${m[1]}${error.shown}${m[3]}`, error });
    } else {
      const w = chunk.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
      out.push({ before: w[1], word: w[2], after: w[3], text: chunk, error: null });
    }
  }
  return out;
}

/** Индексы слов с ошибками. */
export function errorIndexes(tokens) {
  return tokens.map((t, i) => (t.error ? i : -1)).filter((i) => i >= 0);
}

const clean = (s) => normalizeText(String(s ?? '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));

/**
 * Подробная проверка. given = { marked: [индексы слов], fixes: [исправление для каждого отмеченного] }.
 * Возвращает { total, found, fixedRight, missed: [], extra: [], wrongFix: [], fixByIndex: Map }.
 */
export function gradeFindErrors(question, given) {
  const tokens = parseErrorText(question.text);
  const errors = new Set(errorIndexes(tokens));
  const marked = Array.isArray(given?.marked) ? given.marked : [];
  const fixes = Array.isArray(given?.fixes) ? given.fixes : [];
  const fixByIndex = new Map(marked.map((i, k) => [i, fixes[k] ?? '']));
  const found = marked.filter((i) => errors.has(i));
  const wrongFix = found.filter((i) => clean(fixByIndex.get(i)) !== clean(tokens[i].error.correct));
  return {
    total: errors.size,
    found: found.length,
    fixedRight: found.length - wrongFix.length,
    missed: [...errors].filter((i) => !fixByIndex.has(i)),
    extra: marked.filter((i) => !errors.has(i)),
    wrongFix,
    fixByIndex,
  };
}

/** checkAnswer для этого типа: верно, только если найдены все ошибки, нет лишних отметок и все исправления верны. */
export function checkFindErrors(question, given) {
  const marked = Array.isArray(given?.marked) ? given.marked : [];
  if (!marked.length) return { status: 'invalid', message: 'Нажми на слова, в которых есть ошибки.' };
  const fixes = Array.isArray(given?.fixes) ? given.fixes : [];
  if (fixes.length !== marked.length || fixes.some((f) => !String(f ?? '').trim())) {
    return { status: 'invalid', message: 'Впиши, как правильно, у каждого отмеченного слова.' };
  }
  const g = gradeFindErrors(question, given);
  return { status: !g.missed.length && !g.extra.length && !g.wrongFix.length ? 'correct' : 'wrong' };
}

/** Ответ без единой ошибки — для проверки данных. */
export function perfectAnswer(question) {
  const tokens = parseErrorText(question.text);
  const marked = errorIndexes(tokens);
  return { marked, fixes: marked.map((i) => tokens[i].error.correct) };
}

/** Проверка данных вопроса. Возвращает массив ошибок. */
export function validateFindErrors(q, where) {
  const errors = [];
  if (typeof q.text !== 'string' || !q.text.trim()) return [`${where}: нет текста (text)`];
  if (/[{}]/.test(q.text.replace(new RegExp(MARK, 'g'), ''))) errors.push(`${where}: лишняя или незакрытая скобка в тексте — ошибка записывается как {написано|правильно|правило}`);
  const tokens = parseErrorText(q.text);
  const errs = tokens.filter((t) => t.error);
  if (errs.length < 1 || errs.length > 8) errors.push(`${where}: ошибок в тексте должно быть от 1 до 8`);
  for (const t of errs) {
    if (/\s/.test(t.error.shown)) errors.push(`${where}: «${t.error.shown}» — слово с ошибкой пишется без пробелов`);
    if (clean(t.error.shown) === clean(t.error.correct)) errors.push(`${where}: «${t.error.shown}» совпадает с правильным написанием`);
  }
  return errors;
}

/** Текст ответа ребёнка для разбора: «лису → лесу, грип → гриб». */
export function givenFindErrorsText(question, given) {
  const marked = Array.isArray(given?.marked) ? given.marked : [];
  if (!marked.length) return 'нет ответа';
  const tokens = parseErrorText(question.text);
  return marked.map((i, k) => `${tokens[i]?.word ?? '?'} → ${String(given.fixes?.[k] ?? '').trim() || '…'}`).join(', ');
}

/** Правильный ответ с правилами: «лису → лесу (Безударная гласная…)». */
export function correctFindErrorsText(question) {
  return parseErrorText(question.text)
    .filter((t) => t.error)
    .map((t) => `${t.error.shown} → ${t.error.correct} (${t.error.rule.replace(/\.$/, '')})`)
    .join('; ');
}
