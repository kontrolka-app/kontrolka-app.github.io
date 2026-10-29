// Ищет примеры в правилах, совпадающие с вопросами: node scripts/check-examples.js
// Пример «48 + 52 × 3 = 204» рядом с вопросом «Вычисли: 48 + 52 × 3» — готовый ответ.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { exampleOverlaps } from '../js/validate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function findAllOverlaps() {
  const subjects = JSON.parse(await readFile(path.join(root, 'data', 'subjects.json'), 'utf8'));
  const topics = [];
  const questions = [];
  for (const s of subjects) {
    for (const file of s.files || []) {
      const content = JSON.parse(await readFile(path.join(root, 'data', file), 'utf8'));
      topics.push(...(content.topics || []));
      questions.push(...(content.questions || []));
    }
  }
  return exampleOverlaps(topics, questions);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const found = await findAllOverlaps();
  if (!found.length) {
    console.log('Совпадений примеров с вопросами нет.');
  } else {
    for (const f of found) console.log(`Тема ${f.topicId}: пример «${f.example}» — вопрос ${f.questionId} (выражение ${f.expression})`);
    console.log(`\nНайдено совпадений: ${found.length}. Замени числа в примерах правил.`);
    process.exitCode = 1;
  }
}
