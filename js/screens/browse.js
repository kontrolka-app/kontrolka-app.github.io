// Экраны выбора: главная, класс, предметы, темы, тема (правило + настройка), пробная контрольная, избранное.
import { h, icon, emptyState, linkButton, button, pageHeader, externalLink, toast } from '../ui.js';
import { href, navigate } from '../router.js';
import { content, getData, settings, update, subjectsForGrade, topicsFor, questionsForTopics } from '../state.js';
import { topicCard, subjectCard, setupForm, favoriteButton, difficultyBadge } from '../components.js';
import { selectQuestions } from '../quiz.js';
import { overallStats, weakTopics, lastTopicResults, pendingMistakes } from '../results.js';
import { startTraining } from '../session.js';
import { searchTopics, availableGrades, gradeRangesText, ALL_GRADES, needsWelcome } from '../catalog.js';
import { formatDate, plural } from '../utils.js';

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
  const stats = overallStats(data.history);
  const last = data.history[0];
  const root = h('div', { class: 'stack' });

  root.appendChild(
    h(
      'section',
      { class: 'hero' },
      logo(),
      h('div', {}, h('h1', { class: 'hero__title page-title', tabindex: '-1' }, s.nickname ? `Привет, ${s.nickname}!` : 'Готовимся к контрольной!'), h('p', { class: 'hero__text' }, 'Выбери тему, потренируйся и разберись в ошибках. Всё сохраняется прямо в браузере.')),
      h(
        'div',
        { class: 'hero__actions' },
        linkButton(grade ? href('subjects') : href('grade'), 'Начать подготовку', { iconName: 'play', size: 'lg' }),
        linkButton(grade ? href('exam') : href('grade'), 'Пробная контрольная', { variant: 'secondary', iconName: 'tests', size: 'lg' }),
      ),
    ),
  );

  if (data.activeSession) {
    const a = data.activeSession;
    const done = Object.keys(a.answers).length;
    root.appendChild(
      h(
        'section',
        { class: 'card card--accent continue' },
        h('div', {}, h('h2', { class: 'card__title' }, 'Продолжить обучение'), h('p', {}, `«${a.source.title}» — отвечено ${done} из ${a.questions.length}`)),
        linkButton(href('quiz'), 'Продолжить', { iconName: 'arrow' }),
      ),
    );
  }

  if (!data.history.length) {
    root.appendChild(
      h(
        'section',
        { class: 'card' },
        emptyState({
          emoji: '🚀',
          title: 'Здесь появится твой прогресс',
          text: grade ? 'Пройди первую тренировку — и мы покажем результат и темы, которые стоит повторить.' : 'Сначала выбери свой класс, потом тему — и начинай первую тренировку.',
          action: linkButton(grade ? href('subjects') : href('grade'), grade ? 'Выбрать тему' : 'Выбрать класс'),
        }),
      ),
    );
  } else {
    const weak = weakTopics(data.history, { limit: 3 }).filter((w) => content.topicById.has(w.topicId));
    root.appendChild(
      h(
        'section',
        { class: 'grid grid--2' },
        h(
          'a',
          { class: 'card stat-card', href: href('result', last.id) },
          h('h2', { class: 'card__title' }, 'Последний результат'),
          h('p', { class: 'stat-card__big' }, `${last.percent}%`),
          h('p', {}, `${last.source.title}: ${last.correct} из ${last.total}`),
          h('p', { class: 'small muted' }, formatDate(last.finishedAt)),
        ),
        h(
          'a',
          { class: 'card stat-card', href: href('history') },
          h('h2', { class: 'card__title' }, 'Мой прогресс'),
          h('p', { class: 'stat-card__big' }, `${stats.percent}%`),
          h('p', {}, `${stats.sessions} ${plural(stats.sessions, ['тренировка', 'тренировки', 'тренировок'])}, верных ответов: ${stats.correct} из ${stats.answered}`),
          weak.length ? h('p', { class: 'small muted' }, `Повторить: ${weak.map((w) => content.topicById.get(w.topicId).title).join(', ')}`) : null,
        ),
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
  }

  if (grade) {
    // Быстрый доступ к темам подготовки к ВПР/МЦКО и олимпиадным заданиям.
    const special = [
      { section: 'ВПР и МЦКО', emoji: '🎯', title: 'Подготовка к ВПР и МЦКО', text: 'Задания в формате проверочных работ 4 класса.' },
      { section: 'Олимпиада', emoji: '🏅', title: 'Олимпиадные задачи', text: 'Задачи на смекалку для тех, кто хочет посложнее.' },
    ]
      .map((s) => ({ ...s, topics: content.topics.filter((t) => t.grade === grade && t.section === s.section) }))
      .filter((s) => s.topics.length);
    for (const s of special) {
      root.appendChild(
        h(
          'section',
          { class: 'card card--accent stack' },
          h('div', {}, h('h2', { class: 'card__title' }, `${s.emoji} ${s.title}`), h('p', { class: 'muted' }, s.text)),
          h(
            'div',
            { class: 'row wrap' },
            s.topics.map((t) => linkButton(href('topic', t.id), content.subjectById.get(t.subjectId)?.name || t.title, { variant: 'secondary' })),
          ),
        ),
      );
    }
  }

  const favTopics = data.favorites.map((id) => content.topicById.get(id)).filter(Boolean);
  root.appendChild(
    h(
      'section',
      { class: 'stack' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Избранные темы'), favTopics.length ? h('a', { href: href('favorites'), class: 'small' }, 'Все') : null),
      favTopics.length
        ? h('div', { class: 'grid grid--2' }, favTopics.slice(0, 4).map((t) => topicCard(t, { showSubject: true, onFavChange: () => navigate('home') })))
        : h('p', { class: 'muted' }, 'Нажми ☆ у темы, чтобы она появилась здесь.'),
    ),
  );

  root.appendChild(
    h(
      'section',
      { class: 'card card--soft' },
      h('h2', { class: 'card__title' }, '✏️ Составь тест для класса'),
      h('p', {}, 'Придумай свои вопросы, сохрани тест в файл и отправь одноклассникам. Чтобы придумать хороший вопрос, тему нужно понять — это тоже подготовка!'),
      linkButton(href('mytests'), 'Мои тесты', { variant: 'secondary', iconName: 'edit' }),
    ),
  );
  return root;
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
  const list = h('div', { class: 'grid grid--2', id: 'topic-list' });
  const status = h('p', { class: 'small muted', 'aria-live': 'polite' });
  const input = h('input', { type: 'search', class: 'input', id: 'topic-search', placeholder: 'Например: глагол', autocomplete: 'off' });
  const render = () => {
    const { query: q, found, nothingFound } = searchTopics(topics, input.value);
    list.textContent = '';
    if (!topics.length) {
      list.appendChild(h('div', { class: 'card span-all' }, emptyState({ emoji: '📭', title: `Для ${grade} класса тем по этому предмету пока нет`, action: linkButton(href('subjects'), 'К предметам') })));
    } else if (nothingFound) {
      list.appendChild(
        h(
          'div',
          { class: 'card span-all' },
          emptyState({
            emoji: '🔍',
            title: 'Темы не найдены',
            text: `По запросу «${input.value.trim()}» ничего нет.`,
            action: h('button', { type: 'button', class: 'btn btn--secondary', onclick: () => ((input.value = ''), render(), input.focus()) }, 'Очистить поиск'),
          }),
        ),
      );
    } else {
      // Группируем по разделам учебника.
      let lastSection = null;
      for (const t of found) {
        if (t.section && t.section !== lastSection) {
          list.appendChild(h('h2', { class: 'section-label span-all' }, t.section));
          lastSection = t.section;
        }
        list.appendChild(topicCard(t));
      }
    }
    status.textContent = q ? `Найдено тем: ${found.length}` : `Всего тем: ${topics.length}`;
  };
  input.addEventListener('input', render);
  render();
  return h(
    'div',
    { class: 'stack' },
    pageHeader(`${subject.icon || ''} ${subject.name}`, { back: href('subjects'), subtitle: `${grade} класс · выбери тему` }),
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

export function topicScreen(topicId) {
  const topic = content.topicById.get(topicId);
  if (!topic) return notFound('Такой темы нет');
  const subject = content.subjectById.get(topic.subjectId);
  const pool = content.questionsByTopic.get(topic.id) || [];
  const history = getData().history;
  const last = lastTopicResults(history).get(topic.id);

  // Ошибки к разбору — только те вопросы, что ещё есть в заданиях.
  const byId = new Map(pool.map((q) => [q.id, q]));
  const pending = pendingMistakes(history, topic.id);
  const wrongQs = pending.wrong.map((id) => byId.get(id)).filter(Boolean);
  const skippedQs = pending.skipped.map((id) => byId.get(id)).filter(Boolean);
  const mistakeQs = [...wrongQs, ...skippedQs];
  const n = mistakeQs.length;
  const mistakesLabel = skippedQs.length ? `Повторить ошибки и пропуски (${n})` : `Повторить ${n} ${plural(n, ['ошибку', 'ошибки', 'ошибок'])}`;

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
              onClick: (opts) =>
                startTraining({
                  questions: mistakeQs,
                  source: { kind: 'topic', topicIds: [topic.id], subjectId: topic.subjectId, title: `Работа над ошибками: ${topic.title}` },
                  settings: { ...opts, count: n, order: 'original' },
                }),
            }
          : null,
        // Правило раскрыто, пока тему ни разу не проходили.
        beforeMore: theoryBlock(topic, { open: !last, title: 'Вспомнить правило' }),
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
