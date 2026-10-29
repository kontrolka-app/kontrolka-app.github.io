// Состояние приложения: данные пользователя (localStorage) и учебное содержимое.
import { createStorage, createMemoryBackend, defaultData, HISTORY_LIMIT } from './storage.js';
import { toast } from './ui.js';

let storage;
let data = defaultData();
let storageWarning = null;

export const content = {
  subjects: [],
  topics: [],
  questions: [],
  topicById: new Map(),
  subjectById: new Map(),
  questionsByTopic: new Map(),
  loadErrors: [],
};

export function initStorage() {
  let backend;
  try {
    backend = window.localStorage;
    const probe = 'kontrolka.probe';
    backend.setItem(probe, '1');
    backend.removeItem(probe);
  } catch {
    backend = createMemoryBackend();
    storageWarning = 'Браузер не разрешает сохранять данные (например, в приватном режиме). Прогресс пропадёт после закрытия страницы.';
  }
  storage = createStorage(backend);
  const res = storage.load();
  data = res.data;
  if (res.status === 'corrupted') {
    storageWarning = 'Сохранённые данные были повреждены. Приложение начало с чистого листа, а копия старых данных сохранена в браузере.';
  } else if (res.status === 'repaired') {
    storageWarning = `Часть сохранённых данных была повреждена и пропущена (записей: ${res.dropped}). Остальное восстановлено.`;
  } else if (res.status === 'newer-version') {
    storageWarning = 'Данные сохранены более новой версией приложения. Обновите страницу или приложение.';
  } else if (res.status === 'unavailable') {
    storageWarning = 'Не удалось прочитать сохранённые данные.';
  }
  return storageWarning;
}

export function getData() {
  return data;
}

export function settings() {
  return data.settings;
}

/** Изменение данных с сохранением. fn получает копию и возвращает новую версию. */
export function update(fn) {
  const next = fn(structuredClone(data)) || data;
  if (next.history.length > HISTORY_LIMIT) next.history = next.history.slice(0, HISTORY_LIMIT);
  data = next;
  const res = storage.save(data);
  if (!res.ok) {
    toast(
      res.reason === 'quota'
        ? 'Не хватает места для сохранения. Удалите старые тесты или очистите историю в настройках.'
        : 'Не удалось сохранить данные в браузере.',
      'error',
    );
  }
  return res.ok;
}

export function replaceAll(newData) {
  return update(() => newData);
}

export function resetAll() {
  storage.clear();
  data = defaultData();
  storage.save(data);
}

export function isFavorite(topicId) {
  return data.favorites.includes(topicId);
}

export function toggleFavorite(topicId) {
  const fav = isFavorite(topicId);
  update((d) => {
    d.favorites = fav ? d.favorites.filter((f) => f !== topicId) : [...d.favorites, topicId];
    return d;
  });
  return !fav;
}

/** Применяет тему и размер шрифта к документу. */
export function applyAppearance() {
  const s = data.settings;
  const root = document.documentElement;
  if (s.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  root.setAttribute('data-font', s.fontSize);
}

export function subjectsForGrade(grade) {
  return content.subjects.filter((s) => content.topics.some((t) => t.subjectId === s.id && t.grade === grade));
}

export function topicsFor(subjectId, grade) {
  return content.topics.filter((t) => t.subjectId === subjectId && t.grade === grade);
}

export function questionsForTopics(topicIds) {
  return topicIds.flatMap((id) => content.questionsByTopic.get(id) || []);
}

export function topicDifficulty(topicId) {
  const qs = content.questionsByTopic.get(topicId) || [];
  if (!qs.length) return null;
  const score = { easy: 1, medium: 2, hard: 3 };
  const avg = qs.reduce((s, q) => s + score[q.difficulty], 0) / qs.length;
  return avg < 1.6 ? 'easy' : avg < 2.3 ? 'medium' : 'hard';
}
