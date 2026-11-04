// «Слова по юнитам» (английский): проверка списка, варианты ответа, проверка написания, результаты. Без DOM.
// Список — data/english-words-4.json: books [{ id, title, groupName, units: [{ n, title, ru, label? }] }],
// words [{ id, book, unit, en, ru, passive? }]. Учебников два: English World 3 (основной) и Spotlight 4.

export const WORD_MODES = ['choose', 'write'];

/** Проверка списка слов. Возвращает массив ошибок. */
export function validateWordList(list) {
  const errors = [];
  if (!list || !Array.isArray(list.books) || !Array.isArray(list.words)) return ['Нет books или words'];
  const units = new Set(); // 'ew3:5'
  for (const b of list.books) {
    if (typeof b?.id !== 'string' || !/^[a-z0-9]+$/.test(b.id) || !String(b?.title ?? '').trim() || !String(b?.groupName ?? '').trim() || !Array.isArray(b?.units)) {
      errors.push(`Учебник «${b?.id}»: нужны id, title, groupName и units`);
      continue;
    }
    for (const u of b.units) {
      const key = `${b.id}:${u?.n}`;
      if (!Number.isInteger(u?.n) || !String(u?.title ?? '').trim() || !String(u?.ru ?? '').trim()) errors.push(`${b.title}, ${u?.n}: нужны номер, title и ru`);
      else if (units.has(key)) errors.push(`${b.title}, ${u.n}: повторяется`);
      units.add(key);
    }
  }
  const ids = new Set();
  for (const w of list.words) {
    const where = `Слово «${w?.id}»`;
    if (typeof w?.id !== 'string' || !/^[a-z0-9-]+$/.test(w.id)) errors.push(`${where}: id — латиница, цифры и дефис`);
    else if (ids.has(w.id)) errors.push(`${where}: повторяется id`);
    ids.add(w?.id);
    if (!/^[A-Za-zé' -]+$/.test(String(w?.en ?? ''))) errors.push(`${where}: en — английские буквы`);
    if (!String(w?.ru ?? '').trim()) errors.push(`${where}: нет перевода`);
    if (!units.has(`${w?.book}:${w?.unit}`)) errors.push(`${where}: нет юнита ${w?.book} ${w?.unit}`);
    if (w?.passive !== undefined && w.passive !== true) errors.push(`${where}: passive — только true`);
  }
  return errors;
}

export const findBook = (list, id) => list.books.find((b) => b.id === id) || null;
export const bookWords = (list, book) => list.words.filter((w) => w.book === book);
export const unitWords = (list, book, n) => list.words.filter((w) => w.book === book && w.unit === n);
/** Подпись юнита: «Unit 3», «Module 2», «Starter». */
export const unitLabel = (book, unit) => unit.label || `${book.groupName} ${unit.n}`;
/** Полное название: «Unit 3. People at work»; «Starter Unit» — без повтора подписи. */
export const unitName = (book, unit) => (unit.title.startsWith(unitLabel(book, unit)) ? unit.title : `${unitLabel(book, unit)}. ${unit.title}`);

/** Значения перевода без пояснений в скобках: «город (большой)» → «город». */
const meanings = (ru) => String(ru).split(',').map((s) => s.replace(/\(.*?\)/g, '').replace(/[!?.]/g, '').trim().toLowerCase()).filter(Boolean);

/** Слова, которые нельзя ставить рядом вариантами: то же английское слово или общее значение («дом» и «дом (родной)»). */
export function confusable(a, b) {
  if (a.id === b.id) return true;
  if (a.en.toLowerCase() === b.en.toLowerCase()) return true;
  const ma = new Set(meanings(a.ru));
  return meanings(b.ru).some((m) => ma.has(m));
}

/** Перемешать (Фишер — Йейтс). random — для тестов. */
export function shuffle(arr, random = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Варианты перевода к слову: правильный и до count-1 непохожих из того же набора (если мало — из всего учебника). */
export function chooseOptions(word, pool, all = pool, count = 4, random = Math.random) {
  const picked = [];
  for (const source of [pool, all]) {
    for (const w of shuffle(source, random)) {
      if (picked.length >= count - 1) break;
      if (!confusable(word, w) && !picked.some((p) => confusable(p, w))) picked.push(w);
    }
  }
  return shuffle([word, ...picked], random);
}

/** Как сравнивать написанное: регистр, лишние пробелы, é → e, прямой и косой апостроф не важны. */
export function normalizeEnglish(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const checkSpelling = (word, typed) => normalizeEnglish(typed) === normalizeEnglish(word.en);

/**
 * Очередь тренировки: каждое слово по разу; ошибка — слово ещё раз в конце (один раз).
 * Счёт — сколько слов отвечено верно с первой попытки.
 */
export function createRound(words, random = Math.random) {
  return { queue: shuffle(words, random).map((w) => w.id), wrong: [], retried: [], pos: 0, total: words.length };
}

export function answerRound(round, id, correct) {
  const r = { ...round, queue: [...round.queue], wrong: [...round.wrong], retried: [...round.retried], pos: round.pos + 1 };
  if (!correct && !r.retried.includes(id)) {
    if (!r.wrong.includes(id)) r.wrong.push(id);
    r.retried.push(id);
    r.queue.push(id);
  }
  return r;
}

export const roundDone = (round) => round.pos >= round.queue.length;
export const roundScore = (round) => ({ correct: round.total - round.wrong.length, total: round.total });

/** Хранение: лучший и последний результат по юниту и режиму. results['ew3-3:write'] = { best, last, at } (в процентах). */
export function defaultWords() {
  return { results: {} };
}

export const resultKey = (book, unit, mode) => `${book}-${unit}:${mode}`;

export function recordResult(words, book, unit, mode, { correct, total }, now = Date.now()) {
  const key = resultKey(book, unit, mode);
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const prev = words.results[key];
  return { ...words, results: { ...words.results, [key]: { best: Math.max(prev?.best ?? 0, percent), last: percent, at: now } } };
}

export function sanitizeWords(raw) {
  const out = defaultWords();
  if (!raw || typeof raw !== 'object' || !raw.results || typeof raw.results !== 'object') return out;
  const pct = (v) => Number.isInteger(v) && v >= 0 && v <= 100;
  for (const [key, r] of Object.entries(raw.results)) {
    if (!/^[a-z0-9]{1,10}-\d{1,2}:(choose|write)$/.test(key) || !r || !pct(r.best) || !pct(r.last) || !Number.isFinite(r.at)) continue;
    out.results[key] = { best: r.best, last: r.last, at: r.at };
  }
  return out;
}
