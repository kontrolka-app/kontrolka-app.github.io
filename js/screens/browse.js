// Экраны выбора: главная, класс, предметы, темы, тема (правило + настройка), пробная контрольная, избранное.
import { h, icon, emptyState, linkButton, button, pageHeader, externalLink, toast, progressBar } from '../ui.js';
import { href, navigate } from '../router.js';
import { content, getData, settings, update, subjectsForGrade, topicsFor, questionsForTopics } from '../state.js';
import { topicCard, topicRow, subjectCard, setupForm, favoriteButton, difficultyBadge } from '../components.js';
import { selectQuestions } from '../quiz.js';
import { overallStats, dailyProgress, lastTopicResults, pendingMistakes, topicStatus, REVIEW_PERCENT } from '../results.js';
import { startTraining } from '../session.js';
import { searchTopics, availableGrades, gradeRangesText, ALL_GRADES, needsWelcome, groupBySection, suggestNext } from '../catalog.js';
import { plural } from '../utils.js';

function logo() {
  return h(
    'div',
    { class: 'hero__logo', 'aria-hidden': 'true' },
    h('img', { src: 'assets/icons/logo.svg', alt: '', width: 64, height: 64 }),
  );
}

export function homeScreen() {
  const data = getData();
  if (needsWelcome(data)) return welcomeScreen();
  const s = settings();
  const grade = s.grade;
  const history = data.history;
  const last = lastTopicResults(history);
  const gradeTopics = grade ? content.topics.filter((t) => t.grade === grade) : [];
  const root = h('div', { class: 'stack' });

  // Главное действие — одно: продолжить начатое, повторить ошибки, следующая тема или начать.
  let main;
  const a = data.activeSession;
  if (a) {
    const done = Object.keys(a.answers).length;
    main = {
      title: `Продолжить: «${a.source.title}»`,
      text: `${a.settings.mode === 'control' ? 'Как на контрольной' : 'С подсказками'} · вопрос ${Math.min(done + 1, a.questions.length)} из ${a.questions.length}`,
      action: linkButton(href('quiz'), 'Продолжить', { iconName: 'arrow', size: 'lg' }),
    };
  } else {
    const tip = grade
      ? suggestNext(history, gradeTopics, {
          pendingCount: (id) => pendingFor(history, id).questions.length,
          isStarted: (id) => last.has(id),
        })
      : null;
    if (tip?.kind === 'mistakes') {
      main = {
        title: `Повтори ошибки: «${tip.topic.title}»`,
        text: 'Разбери то, что не получилось в прошлый раз.',
        action: button(pendingFor(history, tip.topic.id).label, () => startMistakes(tip.topic, pendingFor(history, tip.topic.id).questions, { mode: 'learning', showExplanation: s.showExplanation }), { iconName: 'history', size: 'lg' }),
      };
    } else if (tip?.kind === 'next') {
      main = {
        title: `Следующая тема: «${tip.topic.title}»`,
        text: content.subjectById.get(tip.topic.subjectId)?.name || '',
        action: linkButton(href('topic', tip.topic.id), 'Следующая тема', { iconName: 'arrow', size: 'lg' }),
      };
    } else {
      main = {
        title: null,
        text: 'Выбери предмет и тему, потренируйся и разберись в ошибках. Всё сохраняется прямо в браузере.',
        action: linkButton(grade ? href('subjects') : href('grade'), 'Начать подготовку', { iconName: 'play', size: 'lg' }),
      };
    }
  }

  root.appendChild(
    h(
      'section',
      { class: 'hero' },
      logo(),
      h(
        'div',
        { class: 'hero__body' },
        h('h1', { class: 'hero__title page-title', tabindex: '-1' }, s.nickname ? `Привет, ${s.nickname}!` : 'Готовимся к контрольной!'),
        main.title ? h('p', { class: 'hero__next' }, main.title) : null,
        main.text ? h('p', { class: 'hero__text' }, main.text) : null,
      ),
      h('div', { class: 'hero__actions' }, main.action, linkButton(grade ? href('exam') : href('grade'), 'Пробная контрольная', { variant: 'secondary', iconName: 'tests' })),
    ),
  );

  // Прогресс — только если уже что-то проходили; пустую заглушку не показываем.
  if (history.length) {
    const day = dailyProgress(history, s.dailyGoal);
    root.appendChild(
      h(
        'section',
        { class: `card today${day.done ? ' today--done' : ''}` },
        h(
          'div',
          { class: 'today__head' },
          h('h2', { class: 'card__title' }, day.done ? 'Цель на сегодня выполнена!' : `Сегодня ${Math.min(day.today, day.goal)} из ${day.goal} ${plural(day.goal, ['вопроса', 'вопросов', 'вопросов'])}`),
          day.streak >= 2 ? h('span', { class: 'streak-badge' }, icon('star', { size: 16 }), h('span', {}, `${day.streak} ${plural(day.streak, ['день', 'дня', 'дней'])} подряд`)) : null,
        ),
        progressBar(day.today, day.goal, `Сегодня отвечено ${day.today} из ${day.goal}`),
      ),
    );
    const stats = overallStats(history);
    const masteredCount = gradeTopics.filter((t) => topicStatus(last.get(t.id)) === 'mastered').length;
    const toReview = gradeTopics
      .filter((t) => last.get(t.id)?.percent < REVIEW_PERCENT)
      .sort((x, y) => last.get(x.id).percent - last.get(y.id).percent)
      .slice(0, 3);
    root.appendChild(
      h(
        'section',
        { class: 'grid grid--2' },
        h(
          'a',
          { class: 'card stat-card', href: href('history') },
          h('h2', { class: 'card__title' }, 'Мой прогресс'),
          h(
            'dl',
            { class: 'progress-facts' },
            h('div', {}, h('dt', {}, plural(stats.sessions, ['тренировка', 'тренировки', 'тренировок'])), h('dd', {}, String(stats.sessions))),
            h('div', {}, h('dt', {}, 'верных ответов'), h('dd', {}, `${stats.percent}%`)),
            grade ? h('div', {}, h('dt', {}, 'тем освоено'), h('dd', {}, `${masteredCount} из ${gradeTopics.length}`)) : null,
          ),
        ),
        toReview.length
          ? h(
              'section',
              { class: 'card' },
              h('h2', { class: 'card__title' }, 'Стоит повторить'),
              h('ul', { class: 'topic-list' }, toReview.map((t) => h('li', {}, topicRow(t, last.get(t.id))))),
            )
          : null,
      ),
    );
  }

  if (grade) {
    const subjects = subjectsForGrade(grade);
    root.appendChild(
      h(
        'section',
        { class: 'stack' },
        h('div', { class: 'section-head' }, h('h2', {}, `Предметы · ${grade} класс`), h('a', { href: href('grade'), class: 'small' }, 'Сменить класс')),
        subjects.length
          ? h('div', { class: 'grid grid--2' }, subjects.map((sub) => subjectCard(sub, grade)))
          : h('div', { class: 'card' }, emptyState({ emoji: '📭', title: `Для ${grade} класса заданий пока нет`, text: 'Сейчас есть материалы только для 4 класса. Можно выбрать другой класс или составить свой тест.', action: linkButton(href('grade'), 'Выбрать класс') })),
      ),
    );

    // ВПР — сразу под предметами, олимпиада — скромнее.
    const special = [
      { section: 'ВПР и МЦКО', emoji: '🎯', title: 'Подготовка к ВПР и МЦКО', text: 'Задания в формате проверочных работ 4 класса.', cls: 'card card--accent stack' },
      { section: 'Олимпиада', emoji: '🏅', title: 'Олимпиадные задачи', text: 'Задачи на смекалку для тех, кто хочет посложнее.', cls: 'card stack' },
    ]
      .map((x) => ({ ...x, topics: gradeTopics.filter((t) => t.section === x.section) }))
      .filter((x) => x.topics.length);
    for (const x of special) {
      root.appendChild(
        h(
          'section',
          { class: x.cls },
          h('div', {}, h('h2', { class: 'card__title' }, `${x.emoji} ${x.title}`), h('p', { class: 'muted' }, x.text)),
          h(
            'div',
            { class: 'row wrap' },
            x.topics.map((t) => linkButton(href('topic', t.id), content.subjectById.get(t.subjectId)?.name || t.title, { variant: 'secondary' })),
          ),
        ),
      );
    }
  }

  // Избранное — только если есть: звёздочка «в избранное» есть на странице темы.
  const favTopics = data.favorites.map((id) => content.topicById.get(id)).filter(Boolean);
  if (favTopics.length) {
    root.appendChild(
      h(
        'section',
        { class: 'stack' },
        h('div', { class: 'section-head' }, h('h2', {}, 'Избранные темы'), h('a', { href: href('favorites'), class: 'small' }, 'Все')),
        h('div', { class: 'grid grid--2' }, favTopics.slice(0, 4).map((t) => topicCard(t, { showSubject: true, onFavChange: () => navigate('home') }))),
      ),
    );
  }

  root.appendChild(
    h(
      'p',
      { class: 'home-mytests' },
      h('a', { href: href('mytests') }, icon('edit'), h('span', {}, 'Составь тест для класса')),
      h('span', { class: 'muted' }, ' — придумай свои вопросы и отправь одноклассникам.'),
    ),
  );
  return root;
}

/** Работа над ошибками по теме: вопросы по порядку, режим — из настроек запуска. */
function startMistakes(topic, questions, opts) {
  return startTraining({
    questions,
    source: { kind: 'topic', topicIds: [topic.id], subjectId: topic.subjectId, title: `Работа над ошибками: ${topic.title}` },
    settings: { ...opts, count: questions.length, order: 'original' },
  });
}

/** Неразобранные ошибки и пропуски по теме — только вопросы, которые ещё есть в заданиях, и подпись для кнопки. */
function pendingFor(history, topicId) {
  const byId = new Map((content.questionsByTopic.get(topicId) || []).map((q) => [q.id, q]));
  const p = pendingMistakes(history, topicId);
  const wrong = p.wrong.map((id) => byId.get(id)).filter(Boolean);
  const skipped = p.skipped.map((id) => byId.get(id)).filter(Boolean);
  const n = wrong.length + skipped.length;
  const label = !skipped.length
    ? `Повторить ${n} ${plural(n, ['ошибку', 'ошибки', 'ошибок'])}`
    : wrong.length
      ? `Повторить ошибки и пропуски (${n})`
      : `Повторить пропущенные (${n})`;
  return { questions: [...wrong, ...skipped], label };
}

/** Знакомство при первом входе: имя (необязательно) и класс, если есть из чего выбирать. */
export function welcomeScreen() {
  const grades = availableGrades(content.topics);
  const current = settings().grade;
  const name = h('input', { class: 'input', id: 'welcome-name', maxLength: 40, autocomplete: 'off', placeholder: 'Например: Макс' });
  const gradeSelect =
    grades.length > 1
      ? h('select', { class: 'input', id: 'welcome-grade' }, h('option', { value: '' }, 'Выбери класс'), grades.map((g) => h('option', { value: g, selected: g === current }, `${g} класс`)))
      : null;
  const finish = (nickname) => {
    const grade = gradeSelect ? Number(gradeSelect.value) || null : current;
    update((d) => {
      d.settings.introDone = true;
      if (nickname) d.settings.nickname = nickname;
      d.settings.grade = grade;
      return d;
    });
    navigate(grade ? 'subjects' : 'grade');
  };
  return h(
    'div',
    { class: 'stack' },
    h(
      'section',
      { class: 'hero' },
      logo(),
      h('div', {}, h('h1', { class: 'hero__title page-title', tabindex: '-1' }, 'Привет! Давай знакомиться'), h('p', { class: 'hero__text' }, 'Здесь можно тренироваться перед контрольной и разбирать ошибки.')),
    ),
    h(
      'form',
      {
        class: 'card stack',
        onsubmit: (e) => {
          e.preventDefault();
          finish(name.value.trim().slice(0, 40));
        },
      },
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'welcome-name' }, 'Как тебя зовут?'), name, h('p', { class: 'field__hint' }, 'Можно не писать. Имя останется только в этом браузере.')),
      gradeSelect
        ? h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'welcome-grade' }, 'В каком ты классе?'), gradeSelect)
        : current
          ? h('p', { class: 'muted' }, `Твой класс: ${current}. Сменить можно в настройках.`)
          : null,
      h('div', { class: 'row wrap' }, button('Дальше', null, { type: 'submit', iconName: 'arrow', size: 'lg' }), button('Пропустить', () => finish(''), { variant: 'secondary', size: 'lg' })),
    ),
  );
}

export function gradeScreen() {
  const current = settings().grade;
  const available = availableGrades(content.topics);
  const soon = ALL_GRADES.filter((g) => !available.includes(g));
  return h(
    'div',
    { class: 'stack' },
    pageHeader('Выбери класс', { back: href('home') }),
    available.length
      ? h(
          'div',
          { class: 'grade-grid', role: 'list' },
          available.map((g) =>
            h(
              'button',
              {
                type: 'button',
                role: 'listitem',
                class: `grade-card${g === current ? ' is-selected' : ''}`,
                'aria-pressed': String(g === current),
                onclick: () => {
                  update((d) => ((d.settings.grade = g), d));
                  toast(`Выбран ${g} класс`);
                  navigate('subjects');
                },
              },
              h('span', { class: 'grade-card__num' }, String(g)),
              h('span', { class: 'grade-card__label' }, 'класс'),
            ),
          ),
        )
      : h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Задания не загрузились', text: 'Обнови страницу. Если не помогло — попробуй позже.' })),
    soon.length && available.length ? h('p', { class: 'muted' }, `Скоро: ${gradeRangesText(soon)} класс`) : null,
  );
}

export function subjectsScreen() {
  const grade = settings().grade;
  if (!grade) {
    navigate('grade');
    return h('div');
  }
  const subjects = subjectsForGrade(grade);
  return h(
    'div',
    { class: 'stack' },
    pageHeader('Предметы', { back: href('home'), subtitle: `${grade} класс`, actions: h('a', { class: 'btn btn--ghost', href: href('grade') }, 'Сменить класс') }),
    subjects.length
      ? h('div', { class: 'grid grid--2' }, subjects.map((s) => subjectCard(s, grade)))
      : h('div', { class: 'card' }, emptyState({ emoji: '📭', title: `Для ${grade} класса заданий пока нет`, text: 'Сейчас материалы есть только для 4 класса.', action: linkButton(href('grade'), 'Выбрать другой класс') })),
  );
}

export function topicsScreen(subjectId) {
  const subject = content.subjectById.get(subjectId);
  const grade = settings().grade;
  if (!subject) return notFound('Такого предмета нет');
  if (!grade) {
    navigate('grade');
    return h('div');
  }
  const topics = topicsFor(subjectId, grade);
  const lastResults = lastTopicResults(getData().history);
  const masteredIn = (list) => list.filter((t) => topicStatus(lastResults.get(t.id)) === 'mastered').length;
  // Раскрыт раздел с последней пройденной темой; если ничего не проходили — первый.
  let openSection = null;
  let lastAt = -1;
  for (const t of topics) {
    const r = lastResults.get(t.id);
    if (r && r.finishedAt > lastAt) [lastAt, openSection] = [r.finishedAt, t.section || 'Другие темы'];
  }
  const groups = groupBySection(topics);
  if (!openSection && groups.length) openSection = groups[0].section;
  const toReview = topics.filter((t) => lastResults.get(t.id)?.percent < REVIEW_PERCENT);

  const reviewBlock = toReview.length
    ? h(
        'section',
        { class: 'card topic-review' },
        h('h2', { class: 'card__title' }, 'Стоит повторить'),
        h('ul', { class: 'topic-list' }, toReview.map((t) => h('li', {}, topicRow(t, lastResults.get(t.id))))),
      )
    : null;
  const list = h('div', { class: 'stack topic-sections', id: 'topic-list' });
  const status = h('p', { class: 'small muted', 'aria-live': 'polite' });
  const input = h('input', { type: 'search', class: 'input', id: 'topic-search', placeholder: subject.searchExample ? `Например: ${subject.searchExample}` : 'Название темы', autocomplete: 'off' });
  const render = () => {
    const { query: q, found, nothingFound } = searchTopics(topics, input.value);
    list.textContent = '';
    if (reviewBlock) reviewBlock.hidden = Boolean(q);
    if (!topics.length) {
      list.appendChild(h('div', { class: 'card' }, emptyState({ emoji: '📭', title: `Для ${grade} класса тем по этому предмету пока нет`, action: linkButton(href('subjects'), 'К предметам') })));
    } else if (nothingFound) {
      list.appendChild(
        h(
          'div',
          { class: 'card' },
          emptyState({
            emoji: '🔍',
            title: 'Темы не найдены',
            text: `По запросу «${input.value.trim()}» ничего нет.`,
            action: h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => ((input.value = ''), render(), input.focus()) }, 'Очистить поиск'),
          }),
        ),
      );
    } else {
      // Разделы учебника сворачиваются; при поиске раскрыты все разделы с совпадениями.
      for (const g of groupBySection(found)) {
        const all = groups.find((x) => x.section === g.section)?.topics || g.topics;
        list.appendChild(
          h(
            'details',
            { class: 'card topic-section', open: Boolean(q) || g.section === openSection },
            h('summary', { class: 'topic-section__summary' }, h('h2', { class: 'topic-section__title' }, g.section), h('span', { class: 'topic-section__count small' }, `освоено ${masteredIn(all)} из ${all.length}`)),
            h('ul', { class: 'topic-list' }, g.topics.map((t) => h('li', {}, topicRow(t, lastResults.get(t.id))))),
          ),
        );
      }
    }
    status.textContent = q ? `Найдено тем: ${found.length}` : '';
  };
  input.addEventListener('input', render);
  render();
  return h(
    'div',
    { class: 'stack topics-page' },
    pageHeader(`${subject.icon || ''} ${subject.name}`, { back: href('subjects'), subtitle: `Освоено ${masteredIn(topics)} из ${topics.length} ${plural(topics.length, ['темы', 'тем', 'тем'])}` }),
    reviewBlock,
    h('div', { class: 'field search' }, h('label', { class: 'field__label', for: 'topic-search' }, 'Поиск темы'), h('div', { class: 'search__box' }, icon('search'), input), status),
    list,
    linksBlock(subject),
  );
}

function linksBlock(subject) {
  if (!subject.links?.length) return null;
  return h(
    'section',
    { class: 'card card--soft' },
    h('h2', { class: 'card__title' }, 'Полезные материалы'),
    h('ul', { class: 'link-list' }, subject.links.map((l) => h('li', {}, externalLink(l.url, l.title)))),
  );
}

/** Блок с правилом по теме — используется и на странице темы, и в разборе результатов. */
export function theoryBlock(topic, { open = true, headingLevel = 'h2', title = `📘 Правило: ${topic.title}` } = {}) {
  if (!topic.theory?.length) return null;
  return h(
    'details',
    { class: 'card theory', open },
    h('summary', { class: 'theory__summary' }, h(headingLevel, { class: 'card__title' }, title)),
    h(
      'div',
      { class: 'theory__body' },
      topic.theory.map((p) => h('p', {}, p)),
      topic.examples?.length ? h('div', { class: 'examples' }, h('h3', {}, 'Примеры'), h('ul', {}, topic.examples.map((e) => h('li', {}, e)))) : null,
    ),
  );
}

/** part === 'rule' — открыть сразу на правиле (ссылка «Открыть правило» из разбора ошибок). */
export function topicScreen(topicId, part) {
  const topic = content.topicById.get(topicId);
  if (!topic) return notFound('Такой темы нет');
  const showRule = part === 'rule';
  const subject = content.subjectById.get(topic.subjectId);
  const pool = content.questionsByTopic.get(topic.id) || [];
  const history = getData().history;
  const last = lastTopicResults(history).get(topic.id);

  const { questions: mistakeQs, label: mistakesLabel } = pendingFor(history, topic.id);
  const n = mistakeQs.length;

  const theory = theoryBlock(topic, { open: !last || showRule, title: 'Вспомнить правило' });
  if (showRule && theory) requestAnimationFrame(() => theory.scrollIntoView({ block: 'start' }));
  const miniStat = (label, value) => h('div', { class: 'mini-stats__item' }, h('dt', {}, label), h('dd', {}, value));
  return h(
    'div',
    { class: 'stack' },
    pageHeader(topic.title, {
      back: href('topics', topic.subjectId),
      subtitle: [subject?.name, topic.section].filter(Boolean).join(' · '),
      actions: favoriteButton(topic.id),
    }),
    topic.description ? h('p', { class: 'lead' }, topic.description) : null,
    h(
      'dl',
      { class: 'mini-stats' },
      miniStat('Последний результат', last ? `${last.percent}%` : '—'),
      miniStat('Ошибок к разбору', String(n)),
      miniStat('Всего заданий', String(pool.length)),
    ),
    h(
      'div',
      { class: 'topic-main' },
      setupForm({
        pool,
        idPrefix: 'topic',
        primaryAction: n
          ? {
              label: mistakesLabel,
              onClick: (opts) => startMistakes(topic, mistakeQs, opts),
            }
          : null,
        // Правило раскрыто, пока тему ни разу не проходили.
        beforeMore: theory,
        onStart: (opts) =>
          startTraining({
            questions: selectQuestions(pool, opts),
            source: { kind: 'topic', topicIds: [topic.id], subjectId: topic.subjectId, title: topic.title },
            settings: opts,
          }),
      }),
      subject ? linksBlock(subject) : null,
    ),
  );
}

/** Пробная контрольная: несколько тем одного предмета вперемешку. */
export function examScreen(subjectId) {
  const grade = settings().grade;
  if (!grade) {
    navigate('grade');
    return h('div');
  }
  if (!subjectId) {
    const subjects = subjectsForGrade(grade);
    return h(
      'div',
      { class: 'stack' },
      pageHeader('Пробная контрольная', { back: href('home'), subtitle: 'Вопросы из нескольких тем вперемешку — как на настоящей контрольной. Выбери предмет.' }),
      subjects.length
        ? h('div', { class: 'grid grid--2' }, subjects.map((s) => subjectCard(s, grade, { hrefTo: href('exam', s.id) })))
        : h('div', { class: 'card' }, emptyState({ emoji: '📭', title: 'Для этого класса заданий пока нет', action: linkButton(href('grade'), 'Выбрать класс') })),
    );
  }
  const subject = content.subjectById.get(subjectId);
  if (!subject) return notFound('Такого предмета нет');
  const topics = topicsFor(subjectId, grade);
  const selected = new Set(topics.map((t) => t.id));
  const formSlot = h('div');
  const renderForm = () => {
    formSlot.textContent = '';
    const ids = topics.filter((t) => selected.has(t.id)).map((t) => t.id);
    if (!ids.length) {
      formSlot.appendChild(h('div', { class: 'card' }, h('p', { role: 'alert' }, 'Отметь хотя бы одну тему.')));
      return;
    }
    const pool = questionsForTopics(ids);
    formSlot.appendChild(
      setupForm({
        pool,
        idPrefix: 'exam',
        forceMode: 'control',
        onStart: (opts) =>
          startTraining({
            questions: selectQuestions(pool, opts),
            source: { kind: 'exam', topicIds: ids, subjectId, title: `Пробная контрольная: ${subject.name}` },
            settings: opts,
          }),
      }),
    );
  };
  const checks = h(
    'fieldset',
    { class: 'card topic-checks' },
    h('legend', { class: 'card__title' }, 'Какие темы будут на контрольной?'),
    h(
      'div',
      { class: 'row' },
      h('button', { type: 'button', class: 'chip-btn', onclick: () => setAll(true) }, 'Выбрать все'),
      h('button', { type: 'button', class: 'chip-btn', onclick: () => setAll(false) }, 'Снять все'),
    ),
    topics.map((t) =>
      h(
        'label',
        { class: 'check' },
        h('input', { type: 'checkbox', value: t.id, checked: true, onchange: (e) => (e.target.checked ? selected.add(t.id) : selected.delete(t.id), renderForm()) }),
        h('span', {}, t.title),
      ),
    ),
  );
  function setAll(on) {
    checks.querySelectorAll('input[type=checkbox]').forEach((c) => {
      c.checked = on;
      if (on) selected.add(c.value);
      else selected.delete(c.value);
    });
    renderForm();
  }
  renderForm();
  return h('div', { class: 'stack' }, pageHeader(`Пробная контрольная: ${subject.name}`, { back: href('exam'), subtitle: `${grade} класс` }), h('div', { class: 'layout-2' }, checks, formSlot));
}

export function favoritesScreen() {
  const favTopics = getData().favorites.map((id) => content.topicById.get(id)).filter(Boolean);
  return h(
    'div',
    { class: 'stack' },
    pageHeader('Избранные темы', { back: href('home') }),
    favTopics.length
      ? h('div', { class: 'grid grid--2' }, favTopics.map((t) => topicCard(t, { showSubject: true, onFavChange: () => navigate('favorites') })))
      : h('div', { class: 'card' }, emptyState({ emoji: '⭐', title: 'Пока пусто', text: 'Нажми на звёздочку у темы, чтобы быстро возвращаться к ней.', action: linkButton(href('subjects'), 'К предметам') })),
  );
}

export function notFound(text = 'Страница не найдена') {
  return h('div', { class: 'card' }, emptyState({ emoji: '🧭', title: text, action: linkButton(href('home'), 'На главную') }));
}
