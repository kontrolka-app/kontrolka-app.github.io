// Свои тесты: список, импорт файла, обмен, запуск и редактор.
import { h, icon, button, linkButton, pageHeader, emptyState, confirmDialog, toast, downloadJson, shareJsonFile, readFileText } from '../ui.js';
import { href, navigate, setLeaveGuard } from '../router.js';
import { content, getData, settings, update } from '../state.js';
import { newTest, newQuestion, changeQuestionType, cleanTest, toShareFile, shareFileName, parseTestFile } from '../customTests.js';
import { validateCustomTest, LIMITS } from '../validate.js';
import { selectQuestions } from '../quiz.js';
import { startTraining } from '../session.js';
import { setupForm } from '../components.js';
import { DIFFICULTY_LABELS, TYPE_LABELS, formatDate, plural, parseNumber } from '../utils.js';
import { notFound } from './browse.js';

async function shareTest(test) {
  const file = toShareFile(test);
  const name = shareFileName(test);
  const res = await shareJsonFile(file, name, test.title);
  if (res === 'shared') toast('Тест отправлен.');
  else if (res === 'unsupported') {
    downloadJson(file, name);
    toast(`Файл «${name}» сохранён. Отправь его одноклассникам в мессенджере.`);
  }
}

export function myTestsScreen() {
  const tests = getData().customTests;
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'test-file' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let text;
    try {
      text = await readFileText(file, 1_000_000);
    } catch (e) {
      toast(e.message, 'error');
      return;
    }
    const res = parseTestFile(text, new Set(getData().customTests.map((t) => t.id)));
    if (!res.ok) {
      toast(`Не удалось открыть тест: ${res.errors.slice(0, 3).join('; ')}`, 'error');
      return;
    }
    update((d) => ((d.customTests = [res.test, ...d.customTests]), d));
    toast(`Тест «${res.test.title}» добавлен.`);
    navigate('mytests');
  });

  return h(
    'div',
    { class: 'stack' },
    pageHeader('Мои тесты', { back: href('settings'), subtitle: 'Составляй тесты сам и открывай тесты от одноклассников.' }),
    h(
      'div',
      { class: 'row wrap' },
      linkButton(href('editor', 'new'), 'Создать тест', { iconName: 'plus' }),
      h('label', { class: 'btn btn--secondary', for: 'test-file', tabindex: '0', role: 'button', onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.click()) }, icon('upload'), h('span', {}, 'Открыть тест из файла')),
      fileInput,
    ),
    tests.length
      ? h(
          'ul',
          { class: 'grid grid--2 plain-list' },
          tests.map((t) =>
            h(
              'li',
              { class: 'card test-card' },
              h(
                'div',
                {},
                h('span', { class: `chip ${t.origin === 'imported' ? 'chip--teal' : 'chip--violet'}` }, t.origin === 'imported' ? 'Получен' : 'Мой'),
                content.subjectById.get(t.subjectId) ? h('span', { class: 'chip' }, content.subjectById.get(t.subjectId).name) : null,
              ),
              h('h3', { class: 'test-card__title' }, t.title),
              h('p', { class: 'small muted' }, `${t.questions.length} ${plural(t.questions.length, ['вопрос', 'вопроса', 'вопросов'])}${t.author ? ` · автор: ${t.author}` : ''}${t.updatedAt ? ` · ${formatDate(t.updatedAt)}` : ''}`),
              h(
                'div',
                { class: 'row wrap' },
                linkButton(href('mytest', t.id), 'Пройти', { iconName: 'play' }),
                button('Поделиться', () => shareTest(t), { variant: 'secondary', iconName: 'share' }),
                linkButton(href('editor', t.id), 'Изменить', { variant: 'ghost', iconName: 'edit' }),
                button(
                  '',
                  async () => {
                    const ok = await confirmDialog(`Удалить тест «${t.title}»? Его результаты в истории останутся.`, { title: 'Удалить тест?', okText: 'Удалить', danger: true });
                    if (!ok) return;
                    update((d) => ((d.customTests = d.customTests.filter((x) => x.id !== t.id)), d));
                    navigate('mytests');
                  },
                  { variant: 'ghost btn--icon', iconName: 'trash', ariaLabel: `Удалить тест ${t.title}` },
                ),
              ),
            ),
          ),
        )
      : h(
          'div',
          { class: 'card' },
          emptyState({
            emoji: '✏️',
            title: 'Своих тестов пока нет',
            text: 'Создай тест по теме ближайшей контрольной и отправь файл одноклассникам. Или открой тест, который прислали тебе.',
            action: linkButton(href('editor', 'new'), 'Создать первый тест', { iconName: 'plus' }),
          }),
        ),
    h(
      'section',
      { class: 'card card--soft' },
      h('h2', { class: 'card__title' }, 'Как поделиться тестом с классом'),
      h(
        'ol',
        { class: 'steps' },
        h('li', {}, 'Создай тест и нажми «Поделиться» — на телефоне откроется меню отправки, на компьютере сохранится файл.'),
        h('li', {}, 'Отправь файл в чат класса.'),
        h('li', {}, 'Одноклассник открывает Контрольку → «Мои тесты» → «Открыть тест из файла».'),
        h('li', {}, 'После прохождения он может нажать «Скопировать результат» и прислать его тебе.'),
      ),
    ),
  );
}

export function myTestSetupScreen(testId) {
  const test = getData().customTests.find((t) => t.id === testId);
  if (!test) return notFound('Тест не найден');
  return h(
    'div',
    { class: 'stack' },
    pageHeader(test.title, { back: href('mytests'), subtitle: `${test.questions.length} ${plural(test.questions.length, ['вопрос', 'вопроса', 'вопросов'])}${test.author ? ` · автор: ${test.author}` : ''}` }),
    h(
      'div',
      { class: 'layout-2' },
      setupForm({
        pool: test.questions,
        idPrefix: 'custom',
        onStart: (opts) =>
          startTraining({
            questions: selectQuestions(test.questions, opts),
            source: { kind: 'custom', testId: test.id, subjectId: test.subjectId || '', title: test.title },
            settings: opts,
          }),
      }),
    ),
  );
}

/* ---------- Редактор ---------- */

export function editorScreen(testId) {
  let test;
  if (testId === 'new') {
    test = newTest({ author: settings().nickname || '', subjectId: '' });
  } else {
    const existing = getData().customTests.find((t) => t.id === testId);
    if (!existing) return notFound('Тест не найден');
    test = structuredClone(existing);
    for (const q of test.questions) {
      q.explanation = q.explanation || '';
      q.hint = q.hint || '';
      if (q.type === 'text') q.acceptedAnswers = q.acceptedAnswers || [];
      if (q.type === 'number') q.unit = q.unit || '';
    }
  }
  let dirty = false;
  const markDirty = () => {
    if (!dirty) {
      dirty = true;
      setLeaveGuard(() => confirmDialog('Несохранённые изменения пропадут.', { title: 'Выйти без сохранения?', okText: 'Выйти', cancelText: 'Остаться' }));
    }
  };

  const root = h('div', { class: 'stack editor' });
  const errorsBox = h('div', { class: 'errors', role: 'alert' });
  const list = h('ol', { class: 'editor__questions' });

  const titleInput = h('input', { class: 'input', id: 'test-title', value: test.title, maxLength: LIMITS.titleLength, placeholder: 'Например: Падежи существительных', oninput: (e) => ((test.title = e.target.value), markDirty()) });
  const authorInput = h('input', { class: 'input', id: 'test-author', value: test.author, maxLength: 40, placeholder: 'Имя или прозвище', oninput: (e) => ((test.author = e.target.value), markDirty()) });
  const subjectSelect = h(
    'select',
    { class: 'input', id: 'test-subject', onchange: (e) => ((test.subjectId = e.target.value), markDirty()) },
    h('option', { value: '' }, 'Без предмета'),
    content.subjects.map((s) => h('option', { value: s.id, selected: s.id === test.subjectId }, s.name)),
  );

  function renderList() {
    list.textContent = '';
    test.questions.forEach((q, i) => list.appendChild(questionEditor(q, i)));
  }

  function questionEditor(q, index) {
    const id = (s) => `q${index}-${s}`;
    const field = (label, control, hint) => h('div', { class: 'field' }, h('label', { class: 'field__label', for: control.id }, label), control, hint ? h('p', { class: 'field__hint' }, hint) : null);
    const area = (key, label, placeholder, rows = 2) =>
      field(label, h('textarea', { class: 'input', id: id(key), rows, value: q[key] || '', placeholder, oninput: (e) => ((q[key] = e.target.value), markDirty()) }));

    const typeSelect = h(
      'select',
      {
        class: 'input',
        id: id('type'),
        onchange: (e) => {
          test.questions[index] = changeQuestionType(q, e.target.value);
          markDirty();
          renderList();
          list.children[index]?.querySelector('select')?.focus();
        },
      },
      Object.entries(TYPE_LABELS).map(([v, t]) => h('option', { value: v, selected: v === q.type }, t)),
    );
    const diffSelect = h(
      'select',
      { class: 'input', id: id('diff'), onchange: (e) => ((q.difficulty = e.target.value), markDirty()) },
      Object.entries(DIFFICULTY_LABELS).map(([v, t]) => h('option', { value: v, selected: v === q.difficulty }, t)),
    );

    let answerPart;
    if (q.type === 'single-choice') {
      answerPart = h(
        'fieldset',
        { class: 'field' },
        h('legend', { class: 'field__label' }, 'Варианты ответа (отметь правильный)'),
        q.options.map((o, oi) =>
          h(
            'div',
            { class: 'option-edit' },
            h('input', { type: 'radio', name: id('correct'), checked: q.correctAnswer === o.id, 'aria-label': `Вариант ${oi + 1} правильный`, onchange: () => ((q.correctAnswer = o.id), markDirty()) }),
            h('input', { class: 'input', value: o.text, placeholder: `Вариант ${oi + 1}`, 'aria-label': `Текст варианта ${oi + 1}`, oninput: (e) => ((o.text = e.target.value), markDirty()) }),
            q.options.length > 2
              ? button('', () => {
                  q.options.splice(oi, 1);
                  if (!q.options.some((x) => x.id === q.correctAnswer)) q.correctAnswer = q.options[0].id;
                  markDirty();
                  renderList();
                }, { variant: 'ghost btn--icon', iconName: 'close', ariaLabel: `Удалить вариант ${oi + 1}` })
              : null,
          ),
        ),
        q.options.length < LIMITS.optionsPerQuestion
          ? button('Добавить вариант', () => {
              const used = new Set(q.options.map((o) => o.id));
              let code = 97;
              while (used.has(String.fromCharCode(code))) code++;
              q.options.push({ id: String.fromCharCode(code), text: '' });
              markDirty();
              renderList();
            }, { variant: 'ghost', iconName: 'plus' })
          : null,
      );
    } else if (q.type === 'true-false') {
      answerPart = h(
        'fieldset',
        { class: 'field segmented' },
        h('legend', { class: 'field__label' }, 'Правильный ответ'),
        h(
          'div',
          { class: 'segmented__options' },
          [true, false].map((v) =>
            h('label', { class: 'segmented__option' }, h('input', { type: 'radio', name: id('tf'), checked: q.correctAnswer === v, onchange: () => ((q.correctAnswer = v), markDirty()) }), h('span', {}, v ? 'Верно' : 'Неверно')),
          ),
        ),
      );
    } else if (q.type === 'text') {
      answerPart = h(
        'div',
        { class: 'stack-sm' },
        field('Правильный ответ', h('input', { class: 'input', id: id('ans'), value: q.correctAnswer, oninput: (e) => ((q.correctAnswer = e.target.value), markDirty()) }), 'Большие и маленькие буквы, «е» и «ё» не различаются.'),
        field(
          'Другие правильные варианты (через точку с запятой)',
          h('input', { class: 'input', id: id('acc'), value: (q.acceptedAnswers || []).join('; '), placeholder: 'например: тетрадь; тетрадка', oninput: (e) => ((q.acceptedAnswers = e.target.value.split(';').map((s) => s.trim()).filter(Boolean)), markDirty()) }),
        ),
      );
    } else {
      const numInput = h('input', { class: 'input', id: id('num'), inputMode: 'decimal', value: String(q.correctAnswer).replace('.', ',') });
      numInput.addEventListener('input', () => {
        const n = parseNumber(numInput.value);
        q.correctAnswer = Number.isNaN(n) ? NaN : n;
        markDirty();
      });
      answerPart = h(
        'div',
        { class: 'row wrap' },
        field('Правильный ответ (число)', numInput),
        field('Единица измерения (необязательно)', h('input', { class: 'input', id: id('unit'), value: q.unit || '', placeholder: 'км, кг, шт.', oninput: (e) => ((q.unit = e.target.value), markDirty()) })),
      );
    }

    return h(
      'li',
      { class: 'card q-edit' },
      h(
        'div',
        { class: 'q-edit__head' },
        h('h3', {}, `Вопрос ${index + 1}`),
        h(
          'div',
          { class: 'row' },
          index > 0 ? button('', () => move(index, -1), { variant: 'ghost btn--icon', iconName: 'back', ariaLabel: `Поднять вопрос ${index + 1} выше` }) : null,
          test.questions.length > 1
            ? button('', async () => {
                const ok = await confirmDialog(`Удалить вопрос ${index + 1}?`, { title: 'Удалить вопрос?', okText: 'Удалить', danger: true });
                if (!ok) return;
                test.questions.splice(index, 1);
                markDirty();
                renderList();
              }, { variant: 'ghost btn--icon', iconName: 'trash', ariaLabel: `Удалить вопрос ${index + 1}` })
            : null,
        ),
      ),
      h('div', { class: 'row wrap' }, field('Тип задания', typeSelect), field('Сложность', diffSelect)),
      area('question', 'Текст вопроса', 'Например: В каком падеже стоит слово «лесом»?', 3),
      answerPart,
      area('explanation', 'Объяснение (покажется после ответа)', 'Почему ответ именно такой?'),
      area('hint', 'Подсказка (необязательно)', 'Наводящая подсказка, без ответа', 1),
    );
  }

  function move(index, dir) {
    const j = index + dir;
    [test.questions[index], test.questions[j]] = [test.questions[j], test.questions[index]];
    markDirty();
    renderList();
  }

  function save() {
    const cleaned = cleanTest(test);
    const errors = validateCustomTest(cleaned);
    errorsBox.textContent = '';
    if (errors.length) {
      errorsBox.append(h('p', {}, h('strong', {}, 'Тест пока нельзя сохранить:')), h('ul', {}, errors.slice(0, 10).map((e) => h('li', {}, e))));
      errorsBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const ok = update((d) => {
      const i = d.customTests.findIndex((t) => t.id === cleaned.id);
      if (i >= 0) d.customTests[i] = cleaned;
      else d.customTests.unshift(cleaned);
      return d;
    });
    if (!ok) return;
    setLeaveGuard(null);
    toast('Тест сохранён.');
    navigate('mytests');
  }

  renderList();
  root.append(
    pageHeader(testId === 'new' ? 'Новый тест' : 'Изменить тест', { back: href('mytests') }),
    h(
      'section',
      { class: 'card stack' },
      h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'test-title' }, 'Название теста'), titleInput),
      h('div', { class: 'row wrap' }, h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'test-subject' }, 'Предмет'), subjectSelect), h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'test-author' }, 'Автор'), authorInput)),
      h('p', { class: 'field__hint' }, 'Не пиши фамилию и другие личные данные — тест может уйти всему классу.'),
    ),
    list,
    h(
      'div',
      { class: 'row wrap editor__bar' },
      button('Добавить вопрос', () => {
        if (test.questions.length >= LIMITS.questionsPerTest) return toast('В тесте уже максимум вопросов.', 'error');
        const last = test.questions[test.questions.length - 1];
        test.questions.push(newQuestion(last?.type || 'single-choice'));
        markDirty();
        renderList();
        list.lastElementChild?.querySelector('textarea')?.focus();
      }, { variant: 'secondary', iconName: 'plus' }),
      button('Сохранить тест', save, { iconName: 'check', size: 'lg' }),
    ),
    errorsBox,
  );
  return root;
}
