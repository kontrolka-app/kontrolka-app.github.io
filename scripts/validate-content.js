// Проверка учебных данных: node scripts/validate-content.js
// Читает data/subjects.json и все файлы содержимого, печатает ошибки и статистику.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateContent } from '../js/validate.js';
import { validatePoemCatalog } from '../js/poem.js';
import { validateWordList } from '../js/words.js';
import { validateVerbs } from '../js/verbs.js';
import { validateVocab } from '../js/vocab.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function loadAndValidateAll() {
  const subjects = JSON.parse(await readFile(path.join(root, 'data', 'subjects.json'), 'utf8'));
  const subjectIds = new Set(subjects.map((s) => s.id));
  const seenQuestionIds = new Set();
  const seenTopicIds = new Set();
  const report = [];
  for (const s of subjects) {
    for (const file of s.files || []) {
      let content;
      try {
        content = JSON.parse(await readFile(path.join(root, 'data', file), 'utf8'));
      } catch (e) {
        report.push({ file, topics: 0, questions: 0, byType: {}, errors: [`не удалось прочитать файл: ${e.message}`] });
        continue;
      }
      const errors = validateContent(content, { subjectIds, seenQuestionIds, seenTopicIds });
      const byType = {};
      for (const q of content.questions || []) byType[q.type] = (byType[q.type] || 0) + 1;
      report.push({ file, topics: content.topics?.length ?? 0, questions: content.questions?.length ?? 0, byType, errors });
    }
  }
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = await loadAndValidateAll();
  let failed = false;
  for (const r of report) {
    console.log(`${r.file}: тем ${r.topics}, вопросов ${r.questions}`, r.byType);
    for (const e of r.errors) {
      failed = true;
      console.log('  ОШИБКА:', e);
    }
  }
  // «Учим стихи»: список стихов из учебника.
  const poems = JSON.parse(await readFile(path.join(root, 'data', 'poems-4.json'), 'utf8'));
  console.log(`poems-4.json: стихов ${poems.poems.length}, с текстом ${poems.poems.filter((p) => !p.pasteOnly).length}`);
  for (const e of validatePoemCatalog(poems)) {
    failed = true;
    console.log('  ОШИБКА:', e);
  }
  // «Слова по юнитам» (английский).
  const words = JSON.parse(await readFile(path.join(root, 'data', 'english-words-4.json'), 'utf8'));
  console.log(`english-words-4.json: слов ${words.words.length}`, Object.fromEntries(words.books.map((b) => [b.title, words.words.filter((w) => w.book === b.id).length])));
  for (const e of validateWordList(words)) {
    failed = true;
    console.log('  ОШИБКА:', e);
  }
  // «Словарные слова» (русский) по группам.
  const vocab = JSON.parse(await readFile(path.join(root, 'data', 'vocab-4.json'), 'utf8'));
  console.log(`vocab-4.json: групп ${vocab.groups.length}, слов ${vocab.groups.reduce((n, g) => n + g.words.length, 0)}`);
  for (const e of validateVocab(vocab)) {
    failed = true;
    console.log('  ОШИБКА:', e);
  }
  // Неправильные глаголы (английский).
  const verbs = JSON.parse(await readFile(path.join(root, 'data', 'english-verbs-4.json'), 'utf8'));
  console.log(`english-verbs-4.json: глаголов ${verbs.verbs.length}`);
  for (const e of validateVerbs(verbs)) {
    failed = true;
    console.log('  ОШИБКА:', e);
  }
  console.log(failed ? '\nНайдены ошибки.' : '\nДанные в порядке.');
  process.exit(failed ? 1 : 0);
}
