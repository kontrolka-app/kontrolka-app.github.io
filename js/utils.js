// Общие вспомогательные функции без обращений к DOM.

/** Нормализация текстового ответа: обрезка, схлопывание пробелов, регистр, ё→е. Знаки препинания не трогаем. */
export function normalizeText(value, { caseSensitive = false, strictYo = false } = {}) {
  let s = String(value ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!caseSensitive) s = s.toLowerCase();
  if (!strictYo) s = s.replace(/ё/g, 'е').replace(/Ё/g, 'Е');
  return s;
}

/**
 * Разбор числа, введённого ребёнком: «1 250», «3,5», «-7».
 * Пробелы допускаются только как разделители разрядов. Возвращает NaN, если это не число.
 */
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let s = String(value ?? '').replace(/[   ]/g, ' ').trim();
  if (!s) return NaN;
  // Разрешаем пробелы между группами из трёх цифр: «12 500», «1 000 000».
  if (/\s/.test(s)) {
    if (!/^-?\d{1,3}( \d{3})+([.,]\d+)?$/.test(s)) return NaN;
    s = s.replace(/ /g, '');
  }
  s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

/** Перемешивание Фишера–Йетса; возвращает новый массив. */
export function shuffle(items, rng = Math.random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/** Склонение: plural(5, ['вопрос', 'вопроса', 'вопросов']) → «вопросов». */
export function plural(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${String(s).padStart(2, '0')} с`;
  return `${s} с`;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Превращает строку в безопасное имя файла. */
export function slugify(s) {
  const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  const out = String(s || '')
    .toLowerCase()
    .split('')
    .map((c) => (c in map ? map[c] : c))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return out || 'test';
}

export const MODE_LABELS = { learning: 'с подсказками', control: 'как на контрольной' };
export const DIFFICULTY_LABELS ={ easy: 'лёгкая', medium: 'средняя', hard: 'сложная' };
export const TYPE_LABELS = {
  'single-choice': 'Выбор ответа',
  text: 'Ввод слова',
  number: 'Ввод числа',
  'true-false': 'Верно или неверно',
};
