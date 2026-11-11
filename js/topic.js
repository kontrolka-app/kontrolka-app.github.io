// «Учим топики» (английский): распознанный или вставленный текст → по предложению на строку. Без DOM.
// Готовый текст хранится в том же виде, что стихи: строки, между абзацами пустая строка,
// поэтому тренажёр и разбивка на слова — из poem.js.
import { parsePoem, POEM_TEXT_MAX } from './poem.js';

// После этих сокращений точка не заканчивает предложение никогда.
const TITLES = new Set(['mr', 'mrs', 'ms', 'dr', 'st', 'prof', 'jr', 'sr', 'mt', 'e.g', 'i.e', 'eg', 'ie', 'vs']);
const END = /[.!?…]+["'”’»)\]]*(?=\s|$)/gu;

/** Абзац (уже одной строкой) → предложения. */
export function splitSentences(paragraph) {
  const text = String(paragraph).replace(/\s+/g, ' ').trim();
  const out = [];
  let start = 0;
  for (const m of text.matchAll(END)) {
    const end = m.index + m[0].length;
    const before = text.slice(start, m.index).match(/(\S+)$/)?.[1] ?? '';
    const next = text.slice(end).trimStart();
    if (!next) break;
    const word = before.replace(/^[^\p{L}]+/u, '').toLowerCase();
    const dotOnly = /^\.+$/.test(m[0].replace(/["'”’»)\]]/g, ''));
    if (dotOnly && (TITLES.has(word) || /^\p{Lu}$/u.test(before))) continue; // Mr. Smith, J. K. Rowling
    if (dotOnly && (word === 'no' || word === 'p') && /^\d/.test(next)) continue; // school No. 5, p. 34
    if (/^(?:[—–-]\s*)?\p{Ll}/u.test(next)) continue; // дальше маленькая буква (в том числе «— сказал он») — это не конец предложения
    out.push(text.slice(start, end).trim());
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/**
 * Текст из распознавания, файла или вставки → по предложению на строку, абзацы через пустую строку.
 * Внутри абзаца переносы строк считаются просто пробелами (так распознаётся страница),
 * перенос слова через дефис в конце строки склеивается.
 */
export function toSentenceLines(raw) {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]/g, ' ')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/(\p{L})-\n\s*(\p{Ll})/gu, '$1$2').replace(/\n/g, ' '))
    .map(splitSentences)
    .filter((s) => s.length)
    .map((s) => s.join('\n'))
    .join('\n\n');
}

/**
 * Стихотворение из распознавания, файла или вставки: строки остаются как есть,
 * убираются лишние пробелы и повторы пустых строк (строфы — через одну пустую строку).
 */
export function toPoemLines(raw) {
  return String(raw ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Название по умолчанию: первое предложение, коротко. */
export function guessTitle(text) {
  const first = String(text ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const short = first.replace(/[.!?…]+$/u, '');
  return short.length > 40 ? `${short.slice(0, 40).replace(/\s+\S*$/u, '')}…` : short;
}

export const TOPIC_TEXT_MAX = POEM_TEXT_MAX;

/** Проверка топика перед сохранением (хранится там же и так же, как свои стихи). */
export function validateTopicInput({ title, text }) {
  const errors = [];
  if (!String(title ?? '').trim()) errors.push('Напиши название.');
  const t = String(text ?? '');
  if (!parsePoem(t).length) errors.push('Нет текста топика.');
  if (t.length > TOPIC_TEXT_MAX) errors.push(`Слишком длинный текст: не больше ${TOPIC_TEXT_MAX} знаков.`);
  return errors;
}

/** Какой файл выбрали: 'image' | 'docx' | 'text' | 'doc' | 'pdf' | 'other'. */
export function fileKind(file) {
  const name = String(file?.name ?? '').toLowerCase();
  const type = String(file?.type ?? '');
  if (type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/.test(name)) return 'image';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.txt') || type === 'text/plain') return 'text';
  if (name.endsWith('.doc') || name.endsWith('.rtf') || name.endsWith('.odt')) return 'doc';
  if (name.endsWith('.pdf') || type === 'application/pdf') return 'pdf';
  return 'other';
}
