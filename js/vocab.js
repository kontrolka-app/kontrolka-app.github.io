// «Словарные слова» (русский, 4 класс): 16 групп из листа учителя, режимы тренировки, результаты. Без DOM.
// Список — data/vocab-4.json: groups [{ n, words: [{ id, w, pos? }] }].
// В w трудные места в квадратных скобках: «к[о]р[и]дор», «а[кк]уратно», «потому[ ]что» (раздельно).
// pos — часть речи (noun, adj, verb, num, adv); нет поля — слово не попадает в задание «Часть речи».

import { shuffle } from './words.js';

/** Режимы, у которых есть счёт. Карточки — без счёта. */
export const VOCAB_MODES = ['gaps', 'choose', 'dictation', 'alphabet', 'pos'];

export const POS_LABELS = {
  noun: 'Имя существительное',
  adj: 'Имя прилагательное',
  verb: 'Глагол',
  num: 'Имя числительное',
  adv: 'Наречие',
};

const WORD_RE = /^[А-ЯЁа-яё[\] -]+$/;

/** Проверка списка. Возвращает массив ошибок. */
export function validateVocab(list) {
  const errors = [];
  if (!list || !Array.isArray(list.groups)) return ['Нет groups'];
  const ids = new Set();
  list.groups.forEach((g, i) => {
    if (g?.n !== i + 1) errors.push(`Группа ${i + 1}: n должно быть ${i + 1}`);
    if (!Array.isArray(g?.words) || g.words.length < 2) {
      errors.push(`Группа ${g?.n}: нужно хотя бы 2 слова`);
      return;
    }
    for (const w of g.words) {
      const where = `Группа ${g.n}, «${w?.w}»`;
      if (typeof w?.id !== 'string' || !/^g\d{1,2}-\d{1,2}$/.test(w.id)) errors.push(`${where}: id вида g1-1`);
      else if (ids.has(w.id)) errors.push(`${where}: повторяется id`);
      ids.add(w?.id);
      const s = String(w?.w ?? '');
      if (!WORD_RE.test(s)) errors.push(`${where}: только русские буквы, пробел, дефис и скобки`);
      else if (!/^[^[\]]*(\[[^[\]]+\][^[\]]*)+$/.test(s)) errors.push(`${where}: нужно хотя бы одно трудное место в [ ], скобки парные`);
      if (w?.pos !== undefined && !POS_LABELS[w.pos]) errors.push(`${where}: неизвестная часть речи ${w.pos}`);
    }
  });
  return errors;
}

export const findGroup = (list, n) => list.groups.find((g) => g.n === n) || null;

/** Слово без скобок: «к[о]р[и]дор» → «коридор». */
export const plain = (w) => w.w.replace(/[[\]]/g, '');

/** Части слова: [{ text, hard }]. */
export function parts(w) {
  return w.w.split(/(\[[^\]]+\])/).filter(Boolean).map((p) => (p.startsWith('[') ? { text: p.slice(1, -1), hard: true } : { text: p, hard: false }));
}

/** Слово с пропусками: «к…р…дор», «потому…что». */
export const gapped = (w) => parts(w).map((p) => (p.hard ? '…' : p.text)).join('');

/** Как сравнивать написанное: лишние пробелы, ё = е; регистр важен, только если в слове есть большая буква («Россия»). */
export function normalizeRussian(s, keepCase = false) {
  const t = String(s ?? '').replace(/[ёЁ]/g, (c) => (c === 'ё' ? 'е' : 'Е')).replace(/\s+/g, ' ').trim();
  return keepCase ? t : t.toLowerCase();
}

export function checkWord(w, typed) {
  const right = plain(w);
  const keepCase = /[А-ЯЁ]/.test(right);
  return normalizeRussian(typed, keepCase) === normalizeRussian(right, keepCase);
}

/** Как можно ошибиться в трудном месте. */
const VOWEL_SWAP = { о: ['а'], а: ['о'], е: ['и'], и: ['е'], я: ['е'], ю: ['у'], э: ['е'] };
const CONSONANT_SWAP = { д: ['т'], з: ['с'], г: ['х'] };

function wrongSpots(text) {
  if (text === ' ') return ['', '-'];
  if (text.length === 2 && text[0] === text[1]) return [text[0]];
  if (text.length === 2 && text[1] === 'ь') return [text[0]];
  if (text.length === 1) return VOWEL_SWAP[text] || CONSONANT_SWAP[text] || [];
  return [];
}

/** Неверные написания: { text, errors } — сначала с одной ошибкой, потом с двумя. Без повторов и без верного слова. */
function wrongVariants(w) {
  const ps = parts(w);
  const right = plain(w);
  const out = [];
  const add = (text, errors) => {
    if (text !== right && !out.some((v) => v.text === text)) out.push({ text, errors });
  };
  const hard = ps.map((p, i) => (p.hard ? i : -1)).filter((i) => i >= 0);
  const build = (changes) => ps.map((p, i) => (i in changes ? changes[i] : p.text)).join('');
  for (const i of hard) for (const alt of wrongSpots(ps[i].text)) add(build({ [i]: alt }), 1);
  for (const i of hard) {
    for (const j of hard) {
      if (j <= i) continue;
      for (const a of wrongSpots(ps[i].text)) for (const b of wrongSpots(ps[j].text)) add(build({ [i]: a, [j]: b }), 2);
    }
  }
  return out;
}

export const misspellings = (w) => wrongVariants(w).map((v) => v.text);

/** Варианты для «Выбери верное написание»: верное и до count-1 неверных (сначала с одной ошибкой). */
export function spellingOptions(w, count = 4, random = Math.random) {
  const all = wrongVariants(w);
  const ones = shuffle(all.filter((v) => v.errors === 1), random);
  const twos = shuffle(all.filter((v) => v.errors === 2), random);
  const picked = [...ones, ...twos].slice(0, count - 1).map((v) => v.text);
  return shuffle([plain(w), ...picked], random);
}

/** Алфавитный порядок по русскому алфавиту: ё — отдельная буква после е, пробел раньше букв. */
const ALPHABET = ' абвгдеёжзийклмнопрстуфхцчшщъыьэюя-';
export function alphaCompare(a, b) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = ALPHABET.indexOf(x[i]) - ALPHABET.indexOf(y[i]);
    if (d) return d;
  }
  return x.length - y.length;
}

export const alphabetOrder = (words) => [...words].sort((a, b) => alphaCompare(plain(a), plain(b))).map((w) => w.id);

/**
 * «По алфавиту»: ребёнок нажимает слова по порядку. Неверное нажатие — ошибка, слово не ставится.
 * Счёт: слов минус ошибки (не меньше 0).
 */
export function createAlphabet(words) {
  return { order: alphabetOrder(words), placed: [], mistakes: 0 };
}

export function tapAlphabet(state, id) {
  const expected = state.order[state.placed.length];
  if (id === expected) return { state: { ...state, placed: [...state.placed, id] }, ok: true };
  return { state: { ...state, mistakes: state.mistakes + 1 }, ok: false };
}

export const alphabetDone = (state) => state.placed.length >= state.order.length;
export const alphabetScore = (state) => ({ correct: Math.max(0, state.order.length - state.mistakes), total: state.order.length });

/** Слова группы для режима: в «Части речи» — только те, где она указана. */
export const modeWords = (group, mode) => (mode === 'pos' ? group.words.filter((w) => w.pos) : group.words);

/** Хранение: лучший и последний результат по группе и режиму. results['3:dictation'] = { best, last, at } (в процентах). */
export function defaultVocab() {
  return { results: {} };
}

export const vocabKey = (n, mode) => `${n}:${mode}`;

export function recordVocab(vocab, n, mode, { correct, total }, now = Date.now()) {
  const key = vocabKey(n, mode);
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const prev = vocab.results[key];
  return { ...vocab, results: { ...vocab.results, [key]: { best: Math.max(prev?.best ?? 0, percent), last: percent, at: now } } };
}

/** Сколько режимов группы пройдено хотя бы раз и сколько — на 100 %. */
export function groupProgress(vocab, n) {
  const rs = VOCAB_MODES.map((m) => vocab.results[vocabKey(n, m)]).filter(Boolean);
  return { tried: rs.length, perfect: rs.filter((r) => r.best === 100).length, total: VOCAB_MODES.length };
}

const KEY_RE = new RegExp(`^\\d{1,2}:(${VOCAB_MODES.join('|')})$`);

export function sanitizeVocab(raw) {
  const out = defaultVocab();
  if (!raw || typeof raw !== 'object' || !raw.results || typeof raw.results !== 'object') return out;
  const pct = (v) => Number.isInteger(v) && v >= 0 && v <= 100;
  for (const [key, r] of Object.entries(raw.results)) {
    if (!KEY_RE.test(key) || !r || !pct(r.best) || !pct(r.last) || !Number.isFinite(r.at)) continue;
    out.results[key] = { best: r.best, last: r.last, at: r.at };
  }
  return out;
}
