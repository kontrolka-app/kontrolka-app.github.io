// Проверка учебных данных и пользовательских тестов.
// Модуль без обращений к DOM — используется и в браузере, и в тестах Node.

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const QUESTION_TYPES = ['single-choice', 'text', 'number', 'true-false', 'compare'];
/** Знаки для заданий «поставь знак сравнения». */
export const COMPARE_SIGNS = ['<', '=', '>'];
export const MIN_GRADE = 1;
export const MAX_GRADE = 11;

const isStr = (v) => typeof v === 'string';
const isNonEmptyStr = (v) => isStr(v) && v.trim().length > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Проверяет один вопрос. Возвращает массив текстов ошибок (пустой — всё в порядке).
 * ctx.topicIds — Set допустимых тем (если задан), ctx.subjectIds — Set допустимых предметов.
 * ctx.custom — вопрос из пользовательского теста: класс/предмет/тема необязательны.
 */
export function validateQuestion(q, ctx = {}) {
  const errors = [];
  const where = isObj(q) && isStr(q.id) ? `Вопрос «${q.id}»` : 'Вопрос';
  if (!isObj(q)) return [`${where}: не является объектом`];

  if (!isNonEmptyStr(q.id)) errors.push(`${where}: нет идентификатора id`);
  if (!isNonEmptyStr(q.question)) errors.push(`${where}: пустой текст вопроса`);
  if (!QUESTION_TYPES.includes(q.type)) errors.push(`${where}: неизвестный тип «${q.type}»`);
  if (!DIFFICULTIES.includes(q.difficulty)) errors.push(`${where}: недопустимая сложность «${q.difficulty}»`);
  if (q.explanation !== undefined && !isStr(q.explanation)) errors.push(`${where}: объяснение должно быть строкой`);
  if (q.hint !== undefined && !isStr(q.hint)) errors.push(`${where}: подсказка должна быть строкой`);

  if (!ctx.custom) {
    if (!Number.isInteger(q.grade) || q.grade < MIN_GRADE || q.grade > MAX_GRADE) {
      errors.push(`${where}: класс должен быть целым числом от ${MIN_GRADE} до ${MAX_GRADE}`);
    }
    if (ctx.subjectIds && !ctx.subjectIds.has(q.subjectId)) errors.push(`${where}: предмет «${q.subjectId}» не существует`);
    if (ctx.topicIds && !ctx.topicIds.has(q.topicId)) errors.push(`${where}: тема «${q.topicId}» не существует`);
  }

  switch (q.type) {
    case 'single-choice': {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`${where}: нужно минимум два варианта ответа`);
        break;
      }
      const ids = new Set();
      for (const opt of q.options) {
        if (!isObj(opt) || !isNonEmptyStr(opt.id) || !isNonEmptyStr(opt.text)) {
          errors.push(`${where}: у варианта ответа должны быть id и текст`);
          continue;
        }
        if (ids.has(opt.id)) errors.push(`${where}: повторяется вариант «${opt.id}»`);
        ids.add(opt.id);
        if (opt.feedback !== undefined && !isStr(opt.feedback)) errors.push(`${where}: feedback варианта должен быть строкой`);
      }
      if (!isStr(q.correctAnswer) || !ids.has(q.correctAnswer)) {
        errors.push(`${where}: правильный вариант «${q.correctAnswer}» не найден среди вариантов`);
      }
      break;
    }
    case 'true-false':
      if (typeof q.correctAnswer !== 'boolean') errors.push(`${where}: для «верно/неверно» правильный ответ — true или false`);
      break;
    case 'text':
      if (!isNonEmptyStr(q.correctAnswer)) errors.push(`${where}: правильный ответ должен быть непустой строкой`);
      if (q.acceptedAnswers !== undefined && (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.every(isNonEmptyStr))) {
        errors.push(`${where}: acceptedAnswers должен быть списком непустых строк`);
      }
      if (q.caseSensitive !== undefined && typeof q.caseSensitive !== 'boolean') errors.push(`${where}: caseSensitive — true или false`);
      break;
    case 'number':
      if (typeof q.correctAnswer !== 'number' || !Number.isFinite(q.correctAnswer)) errors.push(`${where}: правильный ответ должен быть числом`);
      if (q.tolerance !== undefined && (typeof q.tolerance !== 'number' || q.tolerance < 0)) errors.push(`${where}: tolerance — неотрицательное число`);
      if (q.unit !== undefined && !isStr(q.unit)) errors.push(`${where}: unit должен быть строкой`);
      break;
    case 'compare':
      if (!COMPARE_SIGNS.includes(q.correctAnswer)) errors.push(`${where}: для сравнения правильный ответ — «<», «=» или «>»`);
      break;
    default:
      break;
  }
  return errors;
}

// Числовое выражение: число, знак действия, число… (числа могут быть с пробелами-разрядами и в скобках).
const EXPRESSION = /\(?\d[\d ]*\)?(?:\s*[+\-−–×·*:÷/]\s*\(?\d[\d ]*\)?)+/g;
const normalizeExpression = (e) => e.replace(/\s+/g, '').replace(/[−–]/g, '-').replace(/[·*]/g, '×').replace(/÷/g, ':');

/** Выражения из текста в едином виде: «48 + 52 × 3 = 204» → ['48+52×3', '204']… только с хотя бы одним знаком действия. */
export function expressionsIn(text) {
  return [...String(text).matchAll(EXPRESSION)]
    .map((m) => normalizeExpression(m[0]))
    .filter((e) => /\d[+\-×:/]\d|\)[+\-×:/]|[+\-×:/]\(/.test(e))
    .filter((e) => !/^\d+\/\d+$/.test(e)); // «1/3» — запись дроби, а не действие: ответа не выдаёт
}

/**
 * Примеры в правилах, которые подсказывают ответ: числовое выражение из примера или текста
 * правила встречается в тексте вопроса (той же или другой темы того же предмета).
 * Возвращает [{ topicId, example, questionId, expression }].
 */
export function exampleOverlaps(topics, questions) {
  const found = [];
  const qExprs = questions.map((q) => ({ q, exprs: new Set(expressionsIn(q.question)) }));
  for (const t of topics) {
    for (const example of [...(t.theory || []), ...(t.examples || [])]) {
      for (const expression of expressionsIn(example)) {
        for (const { q, exprs } of qExprs) {
          if (q.subjectId === t.subjectId && exprs.has(expression)) found.push({ topicId: t.id, example, questionId: q.id, expression });
        }
      }
    }
  }
  return found;
}

/** Проверяет тему. */
export function validateTopic(t, ctx = {}) {
  const errors = [];
  const where = isObj(t) && isStr(t.id) ? `Тема «${t.id}»` : 'Тема';
  if (!isObj(t)) return [`${where}: не является объектом`];
  if (!isNonEmptyStr(t.id)) errors.push(`${where}: нет id`);
  if (!isNonEmptyStr(t.title)) errors.push(`${where}: нет названия`);
  if (!Number.isInteger(t.grade) || t.grade < MIN_GRADE || t.grade > MAX_GRADE) errors.push(`${where}: неверный класс`);
  if (ctx.subjectIds && !ctx.subjectIds.has(t.subjectId)) errors.push(`${where}: предмет «${t.subjectId}» не существует`);
  if (t.description !== undefined && !isStr(t.description)) errors.push(`${where}: описание должно быть строкой`);
  if (t.section !== undefined && !isStr(t.section)) errors.push(`${where}: раздел должен быть строкой`);
  if (t.theory !== undefined) {
    if (!Array.isArray(t.theory) || !t.theory.every(isNonEmptyStr)) errors.push(`${where}: theory — список абзацев-строк`);
  }
  if (t.examples !== undefined) {
    if (!Array.isArray(t.examples) || !t.examples.every(isNonEmptyStr)) errors.push(`${where}: examples — список строк`);
  }
  return errors;
}

/**
 * Проверяет файл содержимого предмета: { subjectId, topics: [], questions: [] }.
 * seenIds — общий Set id вопросов между файлами, чтобы ловить дубликаты.
 */
export function validateContent(content, { subjectIds, seenQuestionIds = new Set(), seenTopicIds = new Set() } = {}) {
  const errors = [];
  if (!isObj(content)) return ['Файл содержимого: ожидается объект'];
  if (!Array.isArray(content.topics)) errors.push('Файл содержимого: нет списка topics');
  if (!Array.isArray(content.questions)) errors.push('Файл содержимого: нет списка questions');
  if (errors.length) return errors;

  const topicIds = new Set();
  for (const t of content.topics) {
    errors.push(...validateTopic(t, { subjectIds }));
    if (isObj(t) && isStr(t.id)) {
      if (seenTopicIds.has(t.id)) errors.push(`Тема «${t.id}»: повторяющийся id`);
      seenTopicIds.add(t.id);
      topicIds.add(t.id);
    }
  }
  const perTopic = new Map();
  for (const q of content.questions) {
    errors.push(...validateQuestion(q, { subjectIds, topicIds }));
    if (isObj(q) && isStr(q.id)) {
      if (seenQuestionIds.has(q.id)) errors.push(`Вопрос «${q.id}»: повторяющийся id`);
      seenQuestionIds.add(q.id);
      perTopic.set(q.topicId, (perTopic.get(q.topicId) || 0) + 1);
    }
  }
  for (const id of topicIds) {
    if (!perTopic.get(id)) errors.push(`Тема «${id}»: нет ни одного вопроса`);
  }
  return errors;
}

export const CUSTOM_TEST_FORMAT = 'kontrolka-test';
export const CUSTOM_TEST_VERSION = 1;
export const LIMITS = { titleLength: 120, questionLength: 1000, questionsPerTest: 200, optionsPerQuestion: 8 };

/** Проверяет пользовательский тест (созданный в редакторе или импортированный из файла). */
export function validateCustomTest(test) {
  const errors = [];
  if (!isObj(test)) return ['Тест: ожидается объект'];
  if (!isNonEmptyStr(test.id)) errors.push('Тест: нет id');
  if (!isNonEmptyStr(test.title)) errors.push('Тест: нет названия');
  else if (test.title.length > LIMITS.titleLength) errors.push('Тест: слишком длинное название');
  if (test.author !== undefined && !isStr(test.author)) errors.push('Тест: автор должен быть строкой');
  if (!Array.isArray(test.questions) || test.questions.length === 0) {
    errors.push('Тест: нет ни одного вопроса');
    return errors;
  }
  if (test.questions.length > LIMITS.questionsPerTest) errors.push(`Тест: больше ${LIMITS.questionsPerTest} вопросов`);
  const ids = new Set();
  test.questions.forEach((q, i) => {
    // Внутренний id вопроса ребёнку не нужен — в сообщении оставляем только номер.
    const qErrors = validateQuestion(q, { custom: true }).map((e) => `Вопрос №${i + 1}: ${e.replace(/^Вопрос( «[^»]*»)?: /, '')}`);
    errors.push(...qErrors);
    if (isObj(q)) {
      if (ids.has(q.id)) errors.push(`Вопрос №${i + 1}: повторяющийся id вопроса`);
      ids.add(q.id);
      if (isStr(q.question) && q.question.length > LIMITS.questionLength) errors.push(`Вопрос №${i + 1}: слишком длинный текст`);
      if (Array.isArray(q.options) && q.options.length > LIMITS.optionsPerQuestion) errors.push(`Вопрос №${i + 1}: слишком много вариантов`);
    }
  });
  return errors;
}

/** Проверяет файл обмена тестом: { format, version, test }. */
export function validateTestFile(data) {
  if (!isObj(data)) return ['Файл не похож на тест Контрольки'];
  if (data.format !== CUSTOM_TEST_FORMAT) return ['Файл не похож на тест Контрольки (нет отметки формата)'];
  if (data.version !== CUSTOM_TEST_VERSION) return [`Неподдерживаемая версия файла: ${data.version}`];
  return validateCustomTest(data.test);
}
