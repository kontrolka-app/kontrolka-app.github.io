// Связка логики сессии с хранилищем: запуск, сохранение прогресса, завершение.
import { createSession, finishSession } from './quiz.js';
import { buildHistoryEntry } from './results.js';
import { addEntry } from './stats.js';
import { catalogInfo, badgesForEntry, badgesForTotals, award } from './achievements.js';
import { getData, update, content } from './state.js';
import { confirmDialog, toast } from './ui.js';
import { navigate } from './router.js';
import { MODE_LABELS } from './utils.js';

/** Запускает тренировку. Если есть незавершённая — спрашивает, можно ли её заменить. */
export async function startTraining({ questions, source, settings }) {
  if (!questions.length) {
    toast('Нет заданий с такими настройками.', 'error');
    return false;
  }
  const active = getData().activeSession;
  if (active) {
    const done = Object.keys(active.answers).length;
    const ok = await confirmDialog(
      `У тебя есть незаконченная тренировка «${active.source.title}» (${MODE_LABELS[active.settings.mode] || 'с подсказками'}): отвечено ${done} из ${active.questions.length}. Если начать новую, прогресс старой пропадёт.`,
      { title: 'Начать заново?', okText: 'Начать новую', cancelText: 'Продолжить старую', safeFirst: true },
    );
    // «Продолжить старую» сразу открывает незаконченную тренировку; Escape просто закрывает окно.
    if (ok === false) navigate('quiz');
    if (!ok) return false;
  }
  let session;
  try {
    session = createSession({ questions, source, settings });
  } catch (e) {
    toast(e.message, 'error');
    return false;
  }
  update((d) => {
    d.activeSession = session;
    return d;
  });
  navigate('quiz');
  return true;
}

export function saveActive(session) {
  update((d) => {
    d.activeSession = session;
    return d;
  });
}

/** Завершает сессию, кладёт итог в историю и возвращает id записи. */
export function completeActive(session) {
  const finished = finishSession(session);
  const entry = buildHistoryEntry(finished);
  update((d) => {
    d.activeSession = null;
    if (!d.history.some((h) => h.id === entry.id)) {
      const prevTopicLast = d.stats.topicLast;
      d.history.unshift(entry);
      d.stats = addEntry(d.stats, entry);
      // Значки: за эту тренировку и по накопленным счётчикам. Дата — время окончания тренировки,
      // по ней экран результата узнаёт, какие значки получены именно сейчас.
      const cat = catalogInfo(gradeTopics(d));
      const ids = [...badgesForEntry(entry, prevTopicLast, cat), ...badgesForTotals(d.stats, d.customTests, cat)];
      d.badges = award(d.badges, ids, entry.finishedAt).badges;
    }
    return d;
  });
  return entry.id;
}

/** Темы класса ребёнка — для значков «Знаток раздела» и «Путешественник». */
export function gradeTopics(d) {
  const grade = d.settings.grade;
  return grade ? content.topics.filter((t) => t.grade === grade) : content.topics;
}

export function abandonActive() {
  update((d) => {
    d.activeSession = null;
    return d;
  });
}

/** Подбирает исходные вопросы для истории: встроенные — по id, пользовательские — из сохранённого теста. */
export function questionsForEntry(entry, onlyIds) {
  const ids = onlyIds || entry.review.map((r) => r.questionId);
  if (entry.source.kind === 'custom') {
    const test = getData().customTests.find((t) => t.id === entry.source.testId);
    if (!test) return { questions: [], missing: true };
    const map = new Map(test.questions.map((q) => [q.id, q]));
    const qs = ids.map((id) => map.get(id)).filter(Boolean);
    return { questions: qs, missing: qs.length < ids.length };
  }
  const map = new Map(content.questions.map((q) => [q.id, q]));
  const qs = ids.map((id) => map.get(id)).filter(Boolean);
  return { questions: qs, missing: qs.length < ids.length };
}

/** Человекочитаемое название источника тренировки. */
export function sourceTitle(source) {
  return source?.title || 'Тренировка';
}
