import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, createMemoryBackend, defaultData, sanitizeData, exportData, importData, STORAGE_KEY, BACKUP_KEY, SCHEMA_VERSION } from '../js/storage.js';
import { createSession, submitAnswer, finishSession } from '../js/quiz.js';
import { buildHistoryEntry } from '../js/results.js';
import { Q } from './helpers.js';

function sampleEntry() {
  let s = createSession({ questions: [Q.choice, Q.num], source: { kind: 'topic', topicIds: ['t1'], title: 'Тема' } });
  s = submitAnswer(s, 'b').session;
  return buildHistoryEntry(finishSession(s));
}

const customTest = {
  id: 'test-1',
  title: 'Мой тест',
  questions: [{ id: 'q1', type: 'true-false', difficulty: 'easy', question: 'Небо голубое?', correctAnswer: true }],
};

test('пустое хранилище даёт данные по умолчанию', () => {
  const st = createStorage(createMemoryBackend());
  const res = st.load();
  assert.equal(res.status, 'empty');
  assert.deepEqual(res.data, defaultData());
});

test('сохранение и восстановление истории, избранного, тестов и сессии', () => {
  const backend = createMemoryBackend();
  const st = createStorage(backend);
  const data = defaultData();
  data.history = [sampleEntry()];
  data.favorites = ['t1', 't2'];
  data.customTests = [customTest];
  data.settings.theme = 'dark';
  data.settings.grade = 4;
  data.activeSession = createSession({ questions: [Q.tf], source: { kind: 'topic', title: 'X' } });
  assert.equal(st.save(data).ok, true);
  const res = createStorage(backend).load();
  assert.equal(res.status, 'ok');
  assert.deepEqual(res.data, data);
});

test('повреждённый JSON: безопасный сброс и резервная копия', () => {
  const backend = createMemoryBackend({ [STORAGE_KEY]: '{не json' });
  const res = createStorage(backend).load();
  assert.equal(res.status, 'corrupted');
  assert.deepEqual(res.data, defaultData());
  assert.equal(backend.getItem(BACKUP_KEY), '{не json');
});

test('частично повреждённые данные: плохие записи отбрасываются, остальное сохраняется', () => {
  const good = sampleEntry();
  const raw = {
    schemaVersion: 1,
    settings: { theme: 'neon', fontSize: 'large', grade: 99, nickname: 5, defaultCount: -3 },
    favorites: ['t1', 't1', 42, null],
    history: [good, { id: 'x' }, 'мусор', { ...good, id: 'y', correct: 10, total: 2 }],
    customTests: [customTest, { id: 'bad', title: '', questions: [] }],
    activeSession: { status: 'active', questions: 'нет' },
  };
  const { data, dropped } = sanitizeData(raw);
  assert.equal(data.settings.theme, 'system');
  assert.equal(data.settings.fontSize, 'large');
  assert.equal(data.settings.grade, null);
  assert.equal(data.settings.nickname, '');
  assert.equal(data.settings.defaultCount, 10);
  assert.deepEqual(data.favorites, ['t1']);
  assert.equal(data.history.length, 1);
  assert.equal(data.customTests.length, 1);
  assert.equal(data.activeSession, null);
  assert.equal(dropped, 5);
});

test('данные не того типа целиком', () => {
  for (const raw of [null, 42, 'строка', []]) {
    const { data } = sanitizeData(raw);
    assert.deepEqual(data, defaultData());
  }
});

test('данные из более новой версии не затираются молча', () => {
  const backend = createMemoryBackend({ [STORAGE_KEY]: JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1 }) });
  assert.equal(createStorage(backend).load().status, 'newer-version');
});

test('ошибка записи (переполнение) возвращается, а не бросается', () => {
  const backend = {
    getItem: () => null,
    setItem: () => {
      const e = new Error('full');
      e.name = 'QuotaExceededError';
      throw e;
    },
    removeItem: () => {},
  };
  const res = createStorage(backend).save(defaultData());
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'quota');
});

test('недоступное хранилище при чтении', () => {
  const backend = { getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} };
  assert.equal(createStorage(backend).load().status, 'unavailable');
});

test('экспорт и импорт: круговой путь через JSON', () => {
  const data = defaultData();
  data.history = [sampleEntry()];
  data.customTests = [customTest];
  data.activeSession = createSession({ questions: [Q.tf], source: { kind: 'topic', title: 'X' } });
  const file = JSON.parse(JSON.stringify(exportData(data, 0)));
  assert.equal(file.format, 'kontrolka-backup');
  assert.equal(file.data.activeSession, null, 'незавершённая сессия не экспортируется');
  const res = importData(file);
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.history, data.history);
  assert.deepEqual(res.data.customTests, data.customTests);
});

test('импорт: чужой файл, неверная версия, мусор', () => {
  assert.equal(importData({ hello: 1 }).ok, false);
  assert.equal(importData({ format: 'kontrolka-backup', version: 999, data: {} }).ok, false);
  assert.equal(importData({ format: 'kontrolka-backup', version: 1 }).ok, false);
  assert.equal(importData(null).ok, false);
  const res = importData({ format: 'kontrolka-backup', version: 1, data: { history: ['x'], favorites: 'нет' } });
  assert.equal(res.ok, true);
  assert.equal(res.dropped, 1);
  assert.deepEqual(res.data.favorites, []);
});

test('импорт не исполняет код: строки остаются строками', () => {
  const evil = { ...customTest, title: '<img src=x onerror=alert(1)>' };
  const res = importData({ format: 'kontrolka-backup', version: 1, data: { customTests: [evil] } });
  assert.equal(res.data.customTests[0].title, '<img src=x onerror=alert(1)>');
});
