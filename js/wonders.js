// «Удивлялки»: сравнения с проверенными числами (согласовано 2026-10-30, docs/stage-f-soglasovanie.md). Без DOM.

/**
 * metric — что сравниваем: days (дней с занятиями), streak (лучшая серия), questions (решено вопросов),
 * poems (стихов «рассказал без подсказок»). Порядок — от самой «крупной» к самой простой:
 * показываем первую подходящую.
 */
export const WONDERS = [
  { id: 'poems21', metric: 'poems', min: 21, text: 'Ты выучил все 21 стихотворение из учебника в «Учим стихи»!', source: 'список стихов в приложении (docs/poems-list.md)' },
  { id: 'q1000', metric: 'questions', min: 1000, text: 'Тысяча вопросов — это как тысяча метров: целый километр знаний!', source: '«Математика. 4 класс», единицы длины: 1 км = 1000 м' },
  { id: 'streak60', metric: 'streak', min: 60, text: 'Твоя серия длиннее полярной ночи в тундре — а она длится около двух месяцев!', source: '«Окружающий мир. 4 класс», ч. 1, с. 64' },
  { id: 'q365', metric: 'questions', min: 365, text: 'Ты решил больше вопросов, чем дней в году!', source: 'календарь' },
  { id: 'q320', metric: 'questions', min: 320, text: 'Столько вопросов — больше, чем страниц в обеих частях «Литературного чтения» (160 + 160)!', source: '«Литературное чтение. 4 класс», ч. 1 и ч. 2 — по 160 страниц' },
  { id: 'streak30', metric: 'streak', min: 30, text: 'Твоя серия длиннее месяца!', source: 'календарь' },
  { id: 'q160', metric: 'questions', min: 160, text: 'Ты решил больше вопросов, чем страниц в первой части учебника «Окружающий мир» — а там их 160!', source: '«Окружающий мир. 4 класс», ч. 1: «Ч. 1. — 160 с.»' },
  { id: 'days8', metric: 'days', min: 8, text: 'Ты занимался дольше, чем длится зима в тундре в месяцах (7–8)… только в днях — но это начало!', source: '«Окружающий мир. 4 класс», ч. 1, с. 64' },
  { id: 'days7', metric: 'days', min: 7, text: 'Ты занимался больше дней, чем их в неделе!', source: 'календарь' },
];

const value = (metric, stats, poemsLearned) =>
  ({ days: stats.days.length, streak: stats.bestStreak, questions: stats.questions, poems: poemsLearned })[metric];

/** Самая «крупная» подходящая удивлялка или null. */
export function pickWonder(stats, poemsLearned = 0) {
  return WONDERS.find((w) => value(w.metric, stats, poemsLearned) >= w.min) || null;
}

/** Удивлялка, рубеж которой перейдён именно этой тренировкой (answered — решено в ней вопросов). */
export function crossedWonder(stats, answered) {
  const before = stats.questions - answered;
  return WONDERS.find((w) => w.metric === 'questions' && before < w.min && stats.questions >= w.min) || null;
}
