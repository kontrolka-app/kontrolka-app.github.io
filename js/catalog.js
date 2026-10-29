// Каталог заданий: какие классы есть, выбор класса, поиск тем. Без DOM.

export const ALL_GRADES = Array.from({ length: 11 }, (_, i) => i + 1);

/** Классы, по которым есть задания, по возрастанию. */
export function availableGrades(topics) {
  return [...new Set(topics.map((t) => t.grade))].filter((g) => ALL_GRADES.includes(g)).sort((a, b) => a - b);
}

/**
 * С каким классом работать: выбранный, если по нему есть задания;
 * иначе единственный класс с заданиями; иначе null (пусть ребёнок выберет сам).
 * Пустой список классов (задания не загрузились) — выбор не трогаем.
 */
export function resolveGrade(selected, grades) {
  if (!grades.length || grades.includes(selected)) return selected ?? null;
  return grades.length === 1 ? grades[0] : null;
}

/** [1, 2, 3, 5, 6, 7] → «1–3, 5–7». */
export function gradeRangesText(grades) {
  const sorted = [...grades].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    parts.push(start === sorted[i] ? String(start) : `${start}–${sorted[i]}`);
  }
  return parts.join(', ');
}

const fold = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

/**
 * Поиск тем по названию, разделу и описанию.
 * nothingFound — только при непустом запросе: пустой список без запроса — это не «ничего не нашлось».
 */
export function searchTopics(topics, query) {
  const q = fold(String(query ?? '').trim());
  const found = q ? topics.filter((t) => fold(`${t.title} ${t.section || ''} ${t.description || ''}`).includes(q)) : topics.slice();
  return { query: q, found, nothingFound: q !== '' && found.length === 0 };
}
