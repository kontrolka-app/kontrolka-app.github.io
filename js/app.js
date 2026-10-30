// Точка входа: загрузка данных, навигация и отрисовка экранов.
import { h, toast, icon } from './ui.js';
import { startRouter, href, setLeaveGuard, parseHash } from './router.js';
import { initStorage, applyAppearance, content, settings, update, getData } from './state.js';
import { loadContent } from './data.js';
import { availableGrades, resolveGrade, needsWelcome } from './catalog.js';
import { catalogInfo, badgesFromHistory, badgesForTotals, award } from './achievements.js';
import { gradeTopics } from './session.js';
import { companionSay } from './screens/companion-ui.js';
import { dayEvent } from './companion.js';
import { dayKey } from './results.js';
import { homeScreen, gradeScreen, subjectsScreen, topicsScreen, topicScreen, examScreen, favoritesScreen, notFound } from './screens/browse.js';
import { quizScreen } from './screens/quiz.js';
import { resultScreen, historyScreen } from './screens/results.js';
import { settingsScreen } from './screens/settings.js';
import { myTestsScreen, myTestSetupScreen, editorScreen } from './screens/mytests.js';
import { poemsScreen, poemScreen, poemEditScreen } from './screens/poems.js';
import { speedListScreen, speedScreen } from './screens/speed.js';

const ROUTES = {
  home: () => homeScreen(),
  grade: () => gradeScreen(),
  subjects: () => subjectsScreen(),
  topics: ([id]) => topicsScreen(id),
  topic: ([id, part]) => topicScreen(id, part),
  exam: ([id]) => examScreen(id),
  quiz: () => quizScreen(),
  result: ([id]) => resultScreen(id),
  history: () => historyScreen(),
  favorites: () => favoritesScreen(),
  settings: () => settingsScreen(),
  mytests: () => myTestsScreen(),
  mytest: ([id]) => myTestSetupScreen(id),
  editor: ([id]) => editorScreen(id || 'new'),
  poems: () => poemsScreen(),
  poem: ([id]) => poemScreen(id),
  'poem-edit': ([id]) => poemEditScreen(id || 'new'),
  speed: ([id]) => (id ? speedScreen(id) : speedListScreen()),
};

// Пункт меню, который подсвечивается для каждого экрана. Результат — ни один: на него приходят и из тренировки, и из истории.
// «Я» — это настройки и «Мои тесты» (тесты по-прежнему открываются и с главной).
const NAV_SECTION = { home: 'home', favorites: 'home', grade: 'subjects', subjects: 'subjects', topics: 'subjects', topic: 'subjects', exam: 'subjects', mytests: 'me', mytest: 'me', editor: 'me', history: 'progress', settings: 'me', poems: 'subjects', poem: 'subjects', 'poem-edit': 'subjects', speed: 'subjects' };

const NAV = [
  { id: 'home', label: 'Главная', icon: 'home', to: href('home') },
  { id: 'subjects', label: 'Темы', icon: 'book', to: href('subjects') },
  { id: 'progress', label: 'Прогресс', icon: 'chart', to: href('history') },
  { id: 'me', label: 'Я', icon: 'user', to: href('settings') },
];

function buildNav() {
  const nav = document.getElementById('nav');
  nav.textContent = '';
  nav.appendChild(
    h(
      'ul',
      { class: 'nav__list' },
      NAV.map((n) => h('li', {}, h('a', { class: 'nav__link', href: n.to, dataset: { section: n.id } }, icon(n.icon), h('span', {}, n.label)))),
    ),
  );
}

/** Компаньон здоровается один раз в день (или «С возвращением!» после перерыва). Не в тренировке. */
function greet(route) {
  if (route.name === 'quiz' || needsWelcome(getData())) return;
  const d = getData();
  const ev = dayEvent(d.stats, d.companion.lastDay);
  if (!ev) return;
  update((x) => ((x.companion.lastDay = dayKey(Date.now())), x));
  companionSay(ev);
}

function render(route) {
  const main = document.getElementById('main');
  if (route.name !== 'quiz' && route.name !== 'editor') setLeaveGuard(null);
  let view;
  try {
    const fn = ROUTES[route.name];
    view = fn ? fn(route.params) : notFound();
  } catch (e) {
    console.error(e);
    view = notFound('Что-то пошло не так. Попробуй вернуться на главную.');
  }
  main.textContent = '';
  main.appendChild(view);
  document.body.dataset.route = route.name;

  const section = NAV_SECTION[route.name];
  document.querySelectorAll('.nav__link').forEach((a) => {
    if (a.dataset.section === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  window.scrollTo(0, 0);
  if (route.name === 'quiz') document.getElementById('companion')?.remove();
  greet(route);
  // Перемещаем фокус к заголовку, чтобы клавиатура и экранные дикторы начинали с нового экрана.
  if (route.name !== 'quiz') main.querySelector('.page-title')?.focus({ preventScroll: true });
  document.title = route.name === 'home' ? 'Контролька' : route.name === 'quiz' ? 'Тренировка — Контролька' : `${main.querySelector('h1')?.textContent || ''} — Контролька`;
}

/**
 * Значки, заработанные раньше (до появления значков или за тренировки, которые уже в истории).
 * Без поздравлений — просто появятся в «Моих достижениях» с датой той тренировки.
 */
function backfillBadges() {
  const d = getData();
  const cat = catalogInfo(gradeTopics(d));
  const found = badgesFromHistory(d.history, cat);
  const latest = d.history[0]?.finishedAt || Date.now();
  for (const id of badgesForTotals(d.stats, d.customTests, cat)) if (!found.has(id)) found.set(id, latest);
  const missing = [...found].filter(([id]) => !d.badges[id]);
  if (!missing.length) return;
  update((x) => {
    for (const [id, at] of missing) x.badges = award(x.badges, [id], at).badges;
    return x;
  });
}

async function boot() {
  const warning = initStorage();
  applyAppearance();
  buildNav();
  await loadContent();
  document.getElementById('loading')?.remove();
  // Класс с заданиями один — выбираем его сами, чтобы не гонять ребёнка через почти пустой экран выбора.
  const grade = settings().grade;
  const resolved = resolveGrade(grade, availableGrades(content.topics));
  if (resolved !== grade) update((d) => ((d.settings.grade = resolved), d));
  backfillBadges();
  startRouter(render);
  // На экране знакомства класс и так написан — сообщение там лишнее.
  const welcome = parseHash(location.hash).name === 'home' && needsWelcome(getData());
  if (resolved && resolved !== grade && !welcome) toast(`Выбран ${resolved} класс — сменить можно в настройках`);
  if (warning) toast(warning, 'error');
  if (content.loadErrors.length) {
    console.warn(content.loadErrors);
    if (!content.topics.length) toast('Не удалось загрузить задания. Запусти приложение через локальный сервер (см. README).', 'error');
    else toast('Часть заданий не загрузилась — остальные работают.', 'error');
  }
}

boot();
