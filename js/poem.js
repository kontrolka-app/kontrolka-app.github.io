// «Учим стихи»: разбивка текста на строфы, строки и слова и что видно на шаге N. Без DOM.
// Способ: сначала текст целиком, потом у каждой строки прячется ещё одно слово с конца,
// пока не останется первое слово; затем только первая буква; затем строка пустая.

export const POEM_TEXT_MAX = 5000;

const hasLetter = (s) => /[\p{L}\p{N}]/u.test(s);

/** Слова строки: знаки препинания и тире приклеиваются к соседнему слову, чтобы не прятаться отдельно. */
export function splitWords(line) {
  const words = [];
  for (const token of String(line).trim().split(/\s+/).filter(Boolean)) {
    if (hasLetter(token) || !words.length) words.push(token);
    else words[words.length - 1] += ` ${token}`;
  }
  // Строка, начавшаяся с тире или кавычки: приклеиваем знак к первому настоящему слову.
  if (words.length > 1 && !hasLetter(words[0])) words.splice(0, 2, `${words[0]} ${words[1]}`);
  return words;
}

/** Текст → строфы (разделены пустой строкой) → строки → слова. */
export function parsePoem(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((stanza) => stanza.split('\n').map((l) => l.trim()).filter(Boolean).map(splitWords))
    .filter((stanza) => stanza.length);
}

/** Сколько шагов у набора строк: 0 — всё видно, …, предпоследний — первые буквы, последний — пусто. */
export function stepCount(lines) {
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return longest + 2; // шаги 0…longest+1
}

/**
 * Что видно в строке на шаге step: [{ text, hidden, hint }].
 * hidden — слово закрыто полоской; hint — показана только первая буква.
 */
export function lineAt(words, step, lines) {
  const firstLetterStep = stepCount(lines) - 2;
  const emptyStep = stepCount(lines) - 1;
  return words.map((w, i) => {
    if (step >= emptyStep) return { text: w, hidden: true, hint: '' };
    if (step >= firstLetterStep) return i === 0 ? { text: w, hidden: true, hint: firstLetter(w) } : { text: w, hidden: true, hint: '' };
    const visible = Math.max(1, words.length - step);
    return { text: w, hidden: i >= visible, hint: '' };
  });
}

/** Первая буква слова (с открывающими знаками перед ней, например «— Б» или «« Б»). */
export function firstLetter(word) {
  const m = String(word).match(/^[^\p{L}\p{N}]*[\p{L}\p{N}]/u);
  return m ? m[0] : '';
}

/** Проверка своего стихотворения перед сохранением. Возвращает массив ошибок. */
export function validatePoemInput({ title, text }) {
  const errors = [];
  if (!String(title ?? '').trim()) errors.push('Напиши название.');
  const t = String(text ?? '');
  if (!parsePoem(t).length) errors.push('Вставь текст стихотворения.');
  if (t.length > POEM_TEXT_MAX) errors.push(`Слишком длинный текст: не больше ${POEM_TEXT_MAX} знаков.`);
  return errors;
}

export const CUSTOM_POEMS_LIMIT = 50;

/** Пустые данные «Учим стихи» в localStorage: свои тексты и отметки «Рассказал без подсказок». */
export function defaultPoems() {
  return { custom: [], learned: {} };
}

/**
 * Проверка сохранённых данных: повреждённое отбрасывается, остальное остаётся.
 * custom: [{ id, title, author?, text, sourceId?, createdAt }] — sourceId, если текст вставлен к стиху из списка учебника.
 */
export function sanitizePoems(raw) {
  const out = defaultPoems();
  if (!raw || typeof raw !== 'object') return out;
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  if (Array.isArray(raw.custom)) {
    const ids = new Set();
    for (const p of raw.custom) {
      if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id)) continue;
      if (validatePoemInput(p).length) continue;
      ids.add(p.id);
      out.custom.push({
        id: p.id.slice(0, 100),
        title: str(p.title, 120).trim(),
        author: str(p.author, 120).trim(),
        text: p.text,
        sourceId: str(p.sourceId, 100),
        createdAt: Number.isFinite(p.createdAt) ? p.createdAt : 0,
      });
      if (out.custom.length >= CUSTOM_POEMS_LIMIT) break;
    }
  }
  if (raw.learned && typeof raw.learned === 'object' && !Array.isArray(raw.learned)) {
    for (const [id, at] of Object.entries(raw.learned)) if (id.length < 100 && Number.isFinite(at)) out.learned[id] = at;
  }
  return out;
}
