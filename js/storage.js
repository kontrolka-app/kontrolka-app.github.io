// Локальное хранилище с версией схемы, проверкой данных и восстановлением. Без DOM.
import { validateCustomTest, validateQuestion } from './validate.js';

export const STORAGE_KEY = 'kontrolka.data';
export const BACKUP_KEY = 'kontrolka.data.corrupt-backup';
export const SCHEMA_VERSION = 1;
export const BACKUP_FORMAT = 'kontrolka-backup';
export const HISTORY_LIMIT = 200;

export const SETTINGS_SCHEMA = {
  theme: ['system', 'light', 'dark'],
  fontSize: ['normal', 'large', 'xlarge'],
  defaultMode: ['learning', 'control'],
  defaultOrder: ['random', 'original'],
  defaultDifficulty: ['all', 'easy', 'medium', 'hard'],
  dailyGoal: [5, 10, 20],
};

export function defaultSettings() {
  return {
    theme: 'system',
    fontSize: 'normal',
    grade: null,
    nickname: '',
    defaultCount: 10,
    defaultMode: 'learning',
    defaultOrder: 'random',
    defaultDifficulty: 'all',
    showExplanation: true,
    introDone: false,
    dailyGoal: 10,
  };
}

export function defaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: defaultSettings(),
    favorites: [],
    history: [],
    customTests: [],
    activeSession: null,
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function sanitizeSettings(raw) {
  const s = defaultSettings();
  if (!isObj(raw)) return s;
  for (const [key, allowed] of Object.entries(SETTINGS_SCHEMA)) {
    if (allowed.includes(raw[key])) s[key] = raw[key];
  }
  if (Number.isInteger(raw.grade) && raw.grade >= 1 && raw.grade <= 11) s.grade = raw.grade;
  if (typeof raw.nickname === 'string') s.nickname = raw.nickname.slice(0, 40);
  if (Number.isInteger(raw.defaultCount) && raw.defaultCount >= 1 && raw.defaultCount <= 100) s.defaultCount = raw.defaultCount;
  if (typeof raw.showExplanation === 'boolean') s.showExplanation = raw.showExplanation;
  if (typeof raw.introDone === 'boolean') s.introDone = raw.introDone;
  return s;
}

function isValidHistoryEntry(h) {
  return (
    isObj(h) &&
    typeof h.id === 'string' &&
    Number.isFinite(h.finishedAt) &&
    Number.isInteger(h.total) && h.total >= 0 &&
    Number.isInteger(h.correct) && h.correct >= 0 && h.correct <= h.total &&
    Number.isFinite(h.percent) &&
    isObj(h.source) &&
    Array.isArray(h.review)
  );
}

function isValidActiveSession(s) {
  if (!isObj(s) || s.status !== 'active' || typeof s.id !== 'string') return false;
  if (!Array.isArray(s.questions) || s.questions.length === 0) return false;
  if (s.questions.some((q) => validateQuestion(q, { custom: true }).length > 0)) return false;
  if (!Number.isInteger(s.currentIndex) || s.currentIndex < 0 || s.currentIndex >= s.questions.length) return false;
  if (!isObj(s.answers) || !isObj(s.source) || !isObj(s.settings) || !Number.isFinite(s.startedAt)) return false;
  return true;
}

/**
 * Приводит произвольные данные к безопасному виду.
 * Возвращает { data, dropped } — dropped показывает, сколько записей пришлось отбросить.
 */
export function sanitizeData(raw) {
  const data = defaultData();
  let dropped = 0;
  if (!isObj(raw)) return { data, dropped: 1 };

  data.settings = sanitizeSettings(raw.settings);

  if (Array.isArray(raw.favorites)) {
    data.favorites = [...new Set(raw.favorites.filter((f) => typeof f === 'string' && f.length < 200))];
  }
  if (Array.isArray(raw.history)) {
    for (const h of raw.history) {
      if (isValidHistoryEntry(h)) data.history.push(h);
      else dropped++;
    }
    data.history = data.history.slice(0, HISTORY_LIMIT);
  }
  if (Array.isArray(raw.customTests)) {
    const ids = new Set();
    for (const t of raw.customTests) {
      if (validateCustomTest(t).length === 0 && !ids.has(t.id)) {
        ids.add(t.id);
        data.customTests.push(t);
      } else dropped++;
    }
  }
  if (raw.activeSession != null) {
    if (isValidActiveSession(raw.activeSession)) data.activeSession = raw.activeSession;
    else dropped++;
  }
  return { data, dropped };
}

/**
 * Создаёт хранилище поверх backend с интерфейсом localStorage.
 * Все ошибки перехватываются и возвращаются как результат, а не бросаются.
 */
export function createStorage(backend) {
  function load() {
    let text = null;
    try {
      text = backend.getItem(STORAGE_KEY);
    } catch (e) {
      return { data: defaultData(), status: 'unavailable', error: e };
    }
    if (text === null) return { data: defaultData(), status: 'empty' };
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      try {
        backend.setItem(BACKUP_KEY, text);
      } catch {
        /* не удалось сохранить копию — продолжаем с чистыми данными */
      }
      return { data: defaultData(), status: 'corrupted', error: e };
    }
    if (isObj(parsed) && Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion > SCHEMA_VERSION) {
      return { data: defaultData(), status: 'newer-version' };
    }
    const { data, dropped } = sanitizeData(parsed);
    return { data, status: dropped > 0 ? 'repaired' : 'ok', dropped };
  }

  function save(data) {
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true };
    } catch (e) {
      const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
      return { ok: false, error: e, reason: quota ? 'quota' : 'unavailable' };
    }
  }

  function clear() {
    try {
      backend.removeItem(STORAGE_KEY);
      backend.removeItem(BACKUP_KEY);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  return { load, save, clear };
}

/** Резервная копия всех данных для файла экспорта. Незавершённая сессия не экспортируется. */
export function exportData(data, now = Date.now()) {
  return {
    format: BACKUP_FORMAT,
    version: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    data: { ...data, activeSession: null },
  };
}

/** Разбор файла резервной копии. Возвращает { ok, data?, errors, dropped }. */
export function importData(fileObject) {
  if (!isObj(fileObject) || fileObject.format !== BACKUP_FORMAT) {
    return { ok: false, errors: ['Это не файл резервной копии Контрольки.'] };
  }
  if (fileObject.version !== SCHEMA_VERSION) {
    return { ok: false, errors: [`Неподдерживаемая версия резервной копии: ${fileObject.version}.`] };
  }
  if (!isObj(fileObject.data)) return { ok: false, errors: ['В файле нет данных.'] };
  const { data, dropped } = sanitizeData(fileObject.data);
  data.activeSession = null;
  return { ok: true, data, dropped, errors: [] };
}

/** Простой backend в памяти — для тестов и как запасной вариант, если localStorage недоступен. */
export function createMemoryBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    _map: map,
  };
}
