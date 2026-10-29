// Загрузка учебного содержимого из JSON. Повреждённые файлы и вопросы пропускаются, а не ломают приложение.
import { validateContent, validateQuestion, validateTopic, validatePassage } from './validate.js';
import { content } from './state.js';
import { validatePoemCatalog } from './poem.js';

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function loadContent() {
  const errors = [];
  let subjects = [];
  try {
    subjects = await fetchJson('data/subjects.json');
  } catch (e) {
    content.loadErrors = [`Не удалось загрузить список предметов (${e.message}).`];
    return content;
  }
  subjects = subjects.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string');
  const subjectIds = new Set(subjects.map((s) => s.id));

  const files = subjects.flatMap((s) => (s.files || []).map((f) => ({ subject: s, file: f })));
  const loaded = await Promise.all(
    files.map(async ({ file }) => {
      try {
        return { file, data: await fetchJson(`data/${file}`) };
      } catch (e) {
        errors.push(`Файл ${file} не загрузился: ${e.message}`);
        return null;
      }
    }),
  );

  const topics = [];
  const questions = [];
  const passages = [];
  const seenQ = new Set();
  const seenT = new Set();
  for (const item of loaded) {
    if (!item) continue;
    const problems = validateContent(item.data, { subjectIds, seenQuestionIds: new Set(), seenTopicIds: new Set() });
    if (problems.length) {
      console.warn(`Проблемы в ${item.file}:`, problems);
      errors.push(`В файле ${item.file} есть ошибки (${problems.length}). Некорректные задания пропущены.`);
    }
    const topicIds = new Set();
    for (const t of item.data.topics || []) {
      if (validateTopic(t, { subjectIds }).length === 0 && !seenT.has(t.id)) {
        seenT.add(t.id);
        topicIds.add(t.id);
        topics.push(t);
      }
    }
    const passageIds = new Set();
    for (const p of item.data.passages || []) {
      if (validatePassage(p).length === 0 && !passageIds.has(p.id)) {
        passageIds.add(p.id);
        passages.push(p);
      }
    }
    for (const q of item.data.questions || []) {
      if (validateQuestion(q, { subjectIds, topicIds, passageIds }).length === 0 && !seenQ.has(q.id)) {
        seenQ.add(q.id);
        questions.push(q);
      }
    }
  }

  content.subjects = subjects;
  content.subjectById = new Map(subjects.map((s) => [s.id, s]));
  content.questions = questions;
  content.passageById = new Map(passages.map((p) => [p.id, p]));
  content.questionsByTopic = new Map();
  for (const q of questions) {
    if (!content.questionsByTopic.has(q.topicId)) content.questionsByTopic.set(q.topicId, []);
    content.questionsByTopic.get(q.topicId).push(q);
  }
  content.topics = topics.filter((t) => content.questionsByTopic.has(t.id));
  content.topicById = new Map(content.topics.map((t) => [t.id, t]));
  content.loadErrors = errors;
  return content;
}

let poemCatalog = null;
/** Список стихов из учебника для «Учим стихи». Загружается при первом заходе в раздел. */
export async function loadPoemCatalog() {
  if (poemCatalog) return poemCatalog;
  try {
    const cat = await fetchJson('data/poems-4.json');
    const bad = new Set();
    for (const e of validatePoemCatalog(cat)) bad.add(e.match(/«(.*?)»/)?.[1]);
    poemCatalog = { ...cat, poems: cat.poems.filter((p) => !bad.has(p.id)) };
  } catch {
    poemCatalog = { poems: [], error: true };
  }
  return poemCatalog;
}

