// Подсчёт результатов, разбор ошибок и статистика истории. Без DOM.

/** Процент выполнения; при нуле заданий — 0 (без деления на ноль). */
export function percentOf(correct, total) {
  if (!total || total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

/** Текст ответа ребёнка для разбора. */
export function givenAnswerText(question, given) {
  if (given === null || given === undefined || given === '') return 'нет ответа';
  switch (question.type) {
    case 'single-choice': {
      const opt = question.options.find((o) => o.id === given);
      return opt ? opt.text : String(given);
    }
    case 'true-false':
      return given ? 'Верно' : 'Неверно';
    case 'number':
      return question.unit ? `${String(given).trim()} ${question.unit}` : String(given).trim();
    default:
      return String(given).trim();
  }
}

/** Текст правильного ответа. */
export function correctAnswerText(question) {
  switch (question.type) {
    case 'single-choice': {
      const opt = question.options.find((o) => o.id === question.correctAnswer);
      return opt ? opt.text : String(question.correctAnswer);
    }
    case 'true-false':
      return question.correctAnswer ? 'Верно' : 'Неверно';
    case 'number': {
      const n = String(question.correctAnswer).replace('.', ',');
      return question.unit ? `${n} ${question.unit}` : n;
    }
    default:
      return String(question.correctAnswer);
  }
}

/** Пояснение к выбранному неправильному варианту, если оно есть в данных. */
export function optionFeedback(question, given) {
  if (question.type !== 'single-choice' || given === question.correctAnswer) return '';
  const opt = question.options.find((o) => o.id === given);
  return opt?.feedback || '';
}

/** Итог по завершённой сессии. Считает только по сохранённым данным вопросов и ответам. */
export function computeResult(session) {
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const topicStats = {};
  const review = session.questions.map((q) => {
    const a = session.answers[q.id];
    const status = a ? a.status : 'skipped';
    if (status === 'correct') correct++;
    else if (status === 'wrong') wrong++;
    else skipped++;
    const key = q.topicId || '_custom';
    topicStats[key] = topicStats[key] || { total: 0, correct: 0 };
    topicStats[key].total++;
    if (status === 'correct') topicStats[key].correct++;
    return {
      questionId: q.id,
      topicId: q.topicId || null,
      question: q.question,
      status,
      given: givenAnswerText(q, a?.given ?? null),
      correct: correctAnswerText(q),
      explanation: q.explanation || '',
      feedback: status === 'wrong' ? optionFeedback(q, a?.given) : '',
    };
  });
  const total = session.questions.length;
  return {
    total,
    correct,
    wrong,
    skipped,
    percent: percentOf(correct, total),
    durationMs: session.finishedAt && session.startedAt ? session.finishedAt - session.startedAt : 0,
    topicStats,
    review,
  };
}

/** Короткий отзыв без перевода в школьную оценку. */
export function verdict(percent) {
  if (percent >= 90) return { level: 'great', title: 'Отлично!', text: 'Ты хорошо знаешь эту тему.' };
  if (percent >= 70) return { level: 'good', title: 'Хорошо!', text: 'Осталось разобрать несколько ошибок.' };
  if (percent >= 50) return { level: 'ok', title: 'Неплохо, но надо повторить', text: 'Прочитай правило и разбор ошибок ниже, потом попробуй ещё раз.' };
  return { level: 'low', title: 'Тему стоит повторить', text: 'Не расстраивайся: прочитай объяснения ниже, повтори правило и пройди тренировку ещё раз.' };
}

/** Запись в историю: компактный снимок завершённой сессии. */
export function buildHistoryEntry(session) {
  const r = session.result;
  return {
    id: session.id,
    finishedAt: session.finishedAt,
    startedAt: session.startedAt,
    source: { ...session.source },
    mode: session.settings.mode,
    total: r.total,
    correct: r.correct,
    wrong: r.wrong,
    skipped: r.skipped,
    percent: r.percent,
    durationMs: r.durationMs,
    topicStats: r.topicStats,
    review: r.review,
  };
}

/** Ключ «того же самого» теста — для сравнения повторных попыток. */
export function sourceKey(source) {
  if (!source) return 'unknown';
  if (source.kind === 'custom') return `custom:${source.testId}`;
  return `${source.kind}:${(source.topicIds || []).slice().sort().join(',')}`;
}

/** Изменение процента относительно предыдущей попытки того же теста (история — новые сначала). */
export function deltaFromPrevious(history, entry) {
  const key = sourceKey(entry.source);
  const idx = history.findIndex((h) => h.id === entry.id);
  for (let i = idx + 1; i < history.length; i++) {
    if (sourceKey(history[i].source) === key) return entry.percent - history[i].percent;
  }
  return null;
}

/** Темы, в которых чаще всего ошибаются: по всем попыткам из истории. */
export function weakTopics(history, { limit = 5 } = {}) {
  const agg = {};
  for (const h of history) {
    for (const [topicId, s] of Object.entries(h.topicStats || {})) {
      if (topicId === '_custom') continue;
      agg[topicId] = agg[topicId] || { topicId, total: 0, correct: 0 };
      agg[topicId].total += s.total;
      agg[topicId].correct += s.correct;
    }
  }
  return Object.values(agg)
    .map((t) => ({ ...t, mistakes: t.total - t.correct, percent: percentOf(t.correct, t.total) }))
    .filter((t) => t.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes || a.percent - b.percent)
    .slice(0, limit);
}

/** Общая статистика для главной. */
export function overallStats(history) {
  const sessions = history.length;
  let answered = 0;
  let correct = 0;
  for (const h of history) {
    answered += h.total;
    correct += h.correct;
  }
  return { sessions, answered, correct, percent: percentOf(correct, answered) };
}

/** Текст результата, который можно отправить однокласснику или учителю. */
export function shareText(entry, { title, nickname } = {}) {
  const lines = [
    `Контролька: ${title || 'тренировка'}`,
    nickname ? `Ученик: ${nickname}` : null,
    `Результат: ${entry.correct} из ${entry.total} (${entry.percent}%)`,
    entry.skipped ? `Пропущено: ${entry.skipped}` : null,
    `Дата: ${new Date(entry.finishedAt).toLocaleString('ru-RU')}`,
  ];
  return lines.filter(Boolean).join('\n');
}
