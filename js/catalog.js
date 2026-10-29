// Каталог заданий: поиск тем. Без DOM.

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
