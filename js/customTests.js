// Пользовательские тесты: создание, файл для обмена, разбор импортированного файла. Без DOM.
import { CUSTOM_TEST_FORMAT, CUSTOM_TEST_VERSION, validateCustomTest, validateTestFile } from './validate.js';
import { uid, slugify } from './utils.js';

export function newQuestion(type = 'single-choice') {
  const base = { id: uid('q'), type, difficulty: 'medium', question: '', explanation: '', hint: '' };
  switch (type) {
    case 'single-choice':
      return { ...base, options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }], correctAnswer: 'a' };
    case 'true-false':
      return { ...base, correctAnswer: true };
    case 'text':
      return { ...base, correctAnswer: '', acceptedAnswers: [] };
    case 'number':
      return { ...base, correctAnswer: 0, unit: '' };
    default:
      return base;
  }
}

/** Меняет тип вопроса, сохраняя общие поля. */
export function changeQuestionType(q, type) {
  const fresh = newQuestion(type);
  return { ...fresh, id: q.id, question: q.question, explanation: q.explanation, hint: q.hint, difficulty: q.difficulty };
}

export function newTest({ author = '', subjectId = '' } = {}) {
  const now = Date.now();
  return { id: uid('test'), title: '', author, subjectId, createdAt: now, updatedAt: now, origin: 'own', questions: [newQuestion()] };
}

/** Приводит вопрос из редактора к чистому виду: убирает пустые необязательные поля. */
export function cleanQuestion(q) {
  const out = { id: q.id, type: q.type, difficulty: q.difficulty, question: (q.question || '').trim() };
  if (q.explanation && q.explanation.trim()) out.explanation = q.explanation.trim();
  if (q.hint && q.hint.trim()) out.hint = q.hint.trim();
  switch (q.type) {
    case 'single-choice':
      out.options = q.options.map((o) => ({ id: o.id, text: (o.text || '').trim() }));
      out.correctAnswer = q.correctAnswer;
      break;
    case 'true-false':
      out.correctAnswer = q.correctAnswer === true;
      break;
    case 'text': {
      out.correctAnswer = (q.correctAnswer || '').trim();
      const acc = (q.acceptedAnswers || []).map((a) => a.trim()).filter(Boolean);
      if (acc.length) out.acceptedAnswers = acc;
      break;
    }
    case 'number':
      out.correctAnswer = q.correctAnswer;
      if (q.unit && q.unit.trim()) out.unit = q.unit.trim();
      break;
    default:
      break;
  }
  return out;
}

export function cleanTest(test) {
  return {
    id: test.id,
    title: (test.title || '').trim(),
    author: (test.author || '').trim(),
    subjectId: test.subjectId || '',
    createdAt: test.createdAt,
    updatedAt: Date.now(),
    origin: test.origin || 'own',
    questions: test.questions.map(cleanQuestion),
  };
}

/** Объект для файла обмена. */
export function toShareFile(test) {
  const { origin, ...rest } = test;
  return { format: CUSTOM_TEST_FORMAT, version: CUSTOM_TEST_VERSION, test: rest };
}

export function shareFileName(test) {
  return `kontrolka-test-${slugify(test.title)}.json`;
}

/**
 * Разбор текста импортированного файла теста.
 * existingIds — id уже сохранённых тестов: при совпадении тест получает новый id, чтобы не затереть свой.
 */
export function parseTestFile(text, existingIds = new Set()) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Файл повреждён или это не JSON.'] };
  }
  const errors = validateTestFile(data);
  if (errors.length) return { ok: false, errors };
  const test = { ...data.test, origin: 'imported', importedAt: Date.now() };
  if (existingIds.has(test.id)) test.id = uid('test');
  return { ok: true, test, errors: [] };
}

export { validateCustomTest };
