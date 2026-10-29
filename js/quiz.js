// Логика тренировочной сессии и проверка ответов. Без DOM.
import { normalizeText, parseNumber, shuffle, uid } from './utils.js';
import { computeResult } from './results.js';
import { COMPARE_SIGNS } from './validate.js';

/**
 * Проверяет ответ по данным вопроса.
 * Возвращает { status: 'correct' | 'wrong' | 'invalid', message? }.
 * 'invalid' — ответ пустой или не в том формате; он не засчитывается, ребёнок может исправить.
 */
export function checkAnswer(question, given) {
  switch (question.type) {
    case 'single-choice': {
      if (typeof given !== 'string' || !given) return { status: 'invalid', message: 'Выбери один из вариантов.' };
      if (!question.options.some((o) => o.id === given)) return { status: 'invalid', message: 'Такого варианта нет.' };
      return { status: given === question.correctAnswer ? 'correct' : 'wrong' };
    }
    case 'true-false': {
      if (typeof given !== 'boolean') return { status: 'invalid', message: 'Выбери «Верно» или «Неверно».' };
      return { status: given === question.correctAnswer ? 'correct' : 'wrong' };
    }
    case 'text': {
      const opts = { caseSensitive: question.caseSensitive === true };
      const answer = normalizeText(given, opts);
      if (!answer) return { status: 'invalid', message: 'Впиши ответ.' };
      const accepted = [question.correctAnswer, ...(question.acceptedAnswers || [])].map((a) => normalizeText(a, opts));
      return { status: accepted.includes(answer) ? 'correct' : 'wrong' };
    }
    case 'number': {
      if (String(given ?? '').trim() === '') return { status: 'invalid', message: 'Впиши число.' };
      const n = parseNumber(given);
      if (Number.isNaN(n)) return { status: 'invalid', message: 'Это не похоже на число. Пиши только цифры, например 1250 или 3,5.' };
      const tolerance = question.tolerance || 0;
      return { status: Math.abs(n - question.correctAnswer) <= tolerance + 1e-9 ? 'correct' : 'wrong' };
    }
    case 'digits': {
      // Как на бланке ВПР: «3142» — порядок важен; при ordered: false — «135» и «531» одно и то же.
      const answer = String(given ?? '').replace(/[\s,.;]/g, '');
      if (!answer) return { status: 'invalid', message: 'Впиши цифры.' };
      if (!/^\d+$/.test(answer)) return { status: 'invalid', message: 'Здесь нужны только цифры, например 2413.' };
      const norm = (s) => (question.ordered === false ? [...s].sort().join('') : s);
      return { status: norm(answer) === norm(question.correctAnswer) ? 'correct' : 'wrong' };
    }
    case 'compare': {
      if (!COMPARE_SIGNS.includes(given)) return { status: 'invalid', message: 'Выбери знак: <, = или >.' };
      return { status: given === question.correctAnswer ? 'correct' : 'wrong' };
    }
    default:
      return { status: 'invalid', message: 'Неизвестный тип задания.' };
  }
}

/**
 * Выбирает вопросы для сессии без повторов.
 * difficulty: 'all' | 'easy' | 'medium' | 'hard'; order: 'random' | 'original'.
 * Количество ограничивается числом доступных заданий — дубликаты не добавляются.
 */
export function selectQuestions(pool, { count = 10, difficulty = 'all', order = 'random', rng = Math.random } = {}) {
  const seen = new Set();
  const unique = [];
  for (const q of pool) {
    if (!q || seen.has(q.id)) continue;
    if (difficulty !== 'all' && q.difficulty !== difficulty) continue;
    seen.add(q.id);
    unique.push(q);
  }
  const ordered = order === 'random' ? shuffle(unique, rng) : unique;
  const n = Math.max(0, Math.min(Math.floor(count) || 0, ordered.length));
  return ordered.slice(0, n);
}

/** Сколько вопросов доступно с учётом сложности. */
export function countAvailable(pool, difficulty = 'all') {
  const ids = new Set();
  for (const q of pool) if (difficulty === 'all' || q.difficulty === difficulty) ids.add(q.id);
  return ids.size;
}

/**
 * Создаёт новую сессию. Вопросы копируются в сессию, чтобы незавершённую
 * тренировку можно было продолжить даже после изменения данных.
 */
export function createSession({ questions, source, settings, now = Date.now() }) {
  if (!Array.isArray(questions) || questions.length === 0) throw new Error('Нет вопросов для тренировки');
  const ids = questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) throw new Error('В сессии не должно быть повторяющихся вопросов');
  return {
    id: uid('session'),
    status: 'active',
    questions: questions.map((q) => structuredCloneSafe(q)),
    questionIds: ids,
    currentIndex: 0,
    answers: {},
    startedAt: now,
    finishedAt: null,
    source: { ...source },
    settings: {
      mode: settings?.mode === 'control' ? 'control' : 'learning',
      showExplanation: settings?.showExplanation !== false,
    },
    result: null,
  };
}

function structuredCloneSafe(v) {
  return JSON.parse(JSON.stringify(v));
}

export function currentQuestion(session) {
  return session.questions[session.currentIndex] || null;
}

export function isAnswered(session, questionId) {
  return Boolean(session.answers[questionId]);
}

/**
 * Отправка ответа на текущий вопрос.
 * Возвращает { session, accepted, outcome }. Повторная отправка, ответ в завершённой сессии
 * и невалидный ответ не меняют сессию (accepted: false).
 */
export function submitAnswer(session, given, now = Date.now()) {
  const q = currentQuestion(session);
  if (session.status !== 'active' || !q) return { session, accepted: false, outcome: { status: 'invalid', message: 'Тренировка уже завершена.' } };
  if (isAnswered(session, q.id)) return { session, accepted: false, outcome: { status: 'invalid', message: 'На этот вопрос уже есть ответ.' } };
  const outcome = checkAnswer(q, given);
  if (outcome.status === 'invalid') return { session, accepted: false, outcome };
  const next = {
    ...session,
    answers: { ...session.answers, [q.id]: { status: outcome.status, given, answeredAt: now } },
  };
  return { session: next, accepted: true, outcome };
}

/** Пропуск текущего вопроса: он не считается правильным. */
export function skipQuestion(session, now = Date.now()) {
  const q = currentQuestion(session);
  if (session.status !== 'active' || !q || isAnswered(session, q.id)) return { session, accepted: false };
  return {
    session: { ...session, answers: { ...session.answers, [q.id]: { status: 'skipped', given: null, answeredAt: now } } },
    accepted: true,
  };
}

/** Переход к следующему вопросу — только после ответа или пропуска текущего. */
export function goNext(session) {
  const q = currentQuestion(session);
  if (session.status !== 'active' || !q || !isAnswered(session, q.id)) return session;
  if (session.currentIndex >= session.questions.length - 1) return session;
  return { ...session, currentIndex: session.currentIndex + 1 };
}

/** Сколько верных ответов подряд, считая назад от текущего вопроса (пропуск и ошибка обрывают серию). */
export function correctStreak(session) {
  let n = 0;
  for (let i = session.currentIndex; i >= 0; i--) {
    if (session.answers[session.questions[i].id]?.status !== 'correct') break;
    n++;
  }
  return n;
}

export function isLastQuestion(session) {
  return session.currentIndex >= session.questions.length - 1;
}

/**
 * Завершает сессию и считает результат. Неотвеченные вопросы считаются пропущенными.
 * Уже завершённая сессия возвращается без изменений.
 */
export function finishSession(session, now = Date.now()) {
  if (session.status === 'finished') return session;
  const answers = { ...session.answers };
  for (const q of session.questions) {
    if (!answers[q.id]) answers[q.id] = { status: 'skipped', given: null, answeredAt: now };
  }
  const finished = { ...session, answers, status: 'finished', finishedAt: now };
  return { ...finished, result: computeResult(finished) };
}
