// Автотест в браузере перед выкладкой: npm run check-site
// Открывает приложение в настоящем браузере (Edge или Chrome, уже установленном на компьютере)
// на ширине телефона и компьютера и проверяет:
//   1) тренировки — по одному заданию каждого типа: все ответы верные, все неверные, пропуск;
//   2) все экраны, до которых можно дойти по ссылкам: нет ошибок в консоли, нет прокрутки вбок,
//      нет экрана «не найдено», страница не обращается к чужим адресам.
// Данные проверки живут в отдельном временном профиле браузера — на настоящий прогресс не влияют.
// Запуск с окном браузера: npm run check-site -- --headed
// Самопроверка (ловит ли автотест поломки): npm run check-site -- --selftest
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { QUESTION_TYPES, COMPARE_SIGNS } from '../js/validate.js';
import { checkAnswer, createSession } from '../js/quiz.js';
import { defaultData, STORAGE_KEY } from '../js/storage.js';
import { perfectAnswer } from '../js/finderrors.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS_DIR = path.join(root, '.check-site');
const HEADED = process.argv.includes('--headed');
// Самопроверка: нарочно ломаем страницу в браузере (файлы приложения не трогаем) и смотрим, что автотест это заметил.
const SELFTEST = process.argv.includes('--selftest');
const WIDTHS = [
  { name: 'телефон 390', width: 390, height: 844 },
  { name: 'компьютер 1366', width: 1366, height: 768 },
];
const MAX_SCREENS = 2000;
const MAX_SHOTS = 20;

/** Найденные проблемы: { kind, where, width, text }. */
const problems = [];
const seen = new Set();
/** Что сейчас проверяется — к этому месту приписываются ошибки консоли и сети. */
const now = { where: 'запуск', width: '' };
let shots = 0;

function problem(kind, text, page) {
  const key = `${kind}|${now.where}|${now.width}|${text}`;
  if (seen.has(key)) return;
  seen.add(key);
  const p = { kind, where: now.where, width: now.width, text };
  problems.push(p);
  if (page && shots < MAX_SHOTS) {
    const file = path.join(SHOTS_DIR, `${String(++shots).padStart(2, '0')}.png`);
    p.shot = page.screenshot({ path: file }).then(() => file, () => null);
  }
}

// ---------- Сервер и браузер ----------

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function startServer() {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'serve.js')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Сервер не запустился за 10 секунд')), 10000);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('запущена')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('exit', (code) => reject(new Error(`Сервер остановился с кодом ${code}`)));
  });
  return { child, base: `http://127.0.0.1:${port}/` };
}

async function launchBrowser() {
  const errors = [];
  for (const channel of ['msedge', 'chrome']) {
    try {
      return { browser: await chromium.launch({ channel, headless: !HEADED }), channel };
    } catch (e) {
      errors.push(`${channel}: ${String(e.message).split('\n')[0]}`);
    }
  }
  throw new Error(`Не найден ни Edge, ни Chrome.\n${errors.join('\n')}`);
}

/** Новый профиль браузера: слушаем ошибки и не выпускаем запросы наружу. */
async function newContext(browser, base, storageJson) {
  const context = await browser.newContext({ viewport: WIDTHS[0], locale: 'ru-RU' });
  const origin = new URL(base).origin;
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    problem('чужой адрес', `страница обратилась к ${new URL(url).origin}`);
    return route.abort();
  });
  if (SELFTEST) {
    await context.addInitScript(() => {
      window.addEventListener('load', () => {
        const wide = document.createElement('div');
        wide.style.width = '3000px';
        wide.textContent = 'самопроверка';
        const link = document.createElement('a');
        link.href = '#/takogo-ekrana-net';
        link.textContent = 'битая ссылка';
        document.body.append(wide, link);
        console.error('самопроверка: ошибка в консоли');
        fetch('net-takogo-fayla.json').catch(() => {});
        fetch('https://example.invalid/').catch(() => {});
      });
    });
  }
  if (storageJson) {
    // Данные кладём один раз: дальше приложение само их меняет, как у настоящего ученика.
    await context.addInitScript(
      ([key, json]) => {
        if (location.protocol.startsWith('http') && localStorage.getItem(key) === null) localStorage.setItem(key, json);
      },
      [STORAGE_KEY, storageJson],
    );
  }
  return context;
}

/** Счётчик незавершённых запросов страницы — чтобы дождаться догрузки данных экрана. */
const inflight = new WeakMap();

async function newPage(context, base) {
  const page = await context.newPage();
  const origin = new URL(base).origin;
  inflight.set(page, 0);
  const done = () => inflight.set(page, Math.max(0, inflight.get(page) - 1));
  page.on('request', () => inflight.set(page, inflight.get(page) + 1));
  page.on('requestfinished', done);
  page.on('requestfailed', (req) => {
    done();
    if (req.url().startsWith(origin)) problem('сеть', `не загрузилось: ${req.url().replace(origin, '')} (${req.failure()?.errorText || 'ошибка'})`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().startsWith(origin)) problem('сеть', `ответ ${res.status()}: ${res.url().replace(origin, '')}`);
  });
  page.on('console', (msg) => {
    // «Failed to load resource» уже записано как проблема сети с адресом файла.
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) problem('ошибка в консоли', msg.text().slice(0, 300), page);
  });
  page.on('pageerror', (err) => problem('ошибка в программе', String(err.message || err).slice(0, 300), page));
  return page;
}

async function setWidth(page, w) {
  now.width = w.name;
  await page.setViewportSize({ width: w.width, height: w.height });
}

/** Ждём, пока экран дорисуется: догрузятся данные и пройдут два кадра. */
async function settle(page) {
  for (let i = 0; i < 3; i++) {
    const until = Date.now() + 5000;
    while (inflight.get(page) > 0 && Date.now() < until) await page.waitForTimeout(20);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (inflight.get(page) === 0) return;
  }
}

/** Загрузка с нуля (а не переход по ссылке внутри приложения). */
async function load(page, base, hash) {
  await page.goto('about:blank');
  await page.goto(base + hash);
  await page.waitForFunction(() => document.body.dataset.route && !document.getElementById('loading'), null, { timeout: 15000 });
  await settle(page);
}

/** Переход внутри приложения, как по ссылке. Если экран спрашивает «Выйти?» — соглашаемся. */
async function go(page, hash) {
  await page.evaluate((h) => {
    document.getElementById('main').firstElementChild?.setAttribute('data-stale', '1');
    if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = h;
  }, hash);
  const ready = () => page.waitForFunction(() => !document.querySelector('#main > [data-stale]') || document.querySelector('dialog[open]'), null, { timeout: 8000 });
  await ready();
  const ok = page.locator('dialog[open] .dialog__actions button:not([data-cancel])');
  if (await ok.count()) {
    await ok.first().click();
    await ready();
  }
  await settle(page);
}

/** Общие проверки экрана. Возвращает ссылки на другие экраны приложения. */
async function inspect(page) {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const main = document.getElementById('main');
    const limit = de.clientWidth + 1;
    const wide = [];
    if (de.scrollWidth > limit) {
      for (const el of document.body.querySelectorAll('*')) {
        if (el.getBoundingClientRect().right > limit && !el.closest('.sr-only')) {
          // Самые глубокие виновники: если вылез ребёнок, родителя не называем.
          if (![...el.children].some((c) => c.getBoundingClientRect().right > limit)) wide.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''} «${(el.textContent || '').trim().slice(0, 40)}»`);
        }
        if (wide.length >= 3) break;
      }
    }
    return {
      overflow: de.scrollWidth - de.clientWidth,
      wide,
      empty: !main.textContent.trim(),
      // Экраны «не найдено» во всём приложении нарисованы с компасом.
      lost: [...main.querySelectorAll('.empty__emoji')].some((e) => e.textContent.includes('🧭')),
      title: (main.querySelector('.empty h3')?.textContent || '').trim().slice(0, 80),
      links: [...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href')),
    };
  });
  if (r.overflow > 1) problem('прокрутка вбок', `страница шире экрана на ${r.overflow}px${r.wide.length ? `; вылезает: ${r.wide.join('; ')}` : ''}`, page);
  if (r.empty) problem('пустой экран', 'на экране ничего нет', page);
  if (r.lost) problem('не найдено', `экран показывает «${r.title || 'не найдено'}»`, page);
  return r.links;
}

// ---------- Тренировки ----------

async function loadQuestions() {
  const subjects = JSON.parse(await readFile(path.join(root, 'data', 'subjects.json'), 'utf8'));
  const questions = [];
  const topics = [];
  for (const s of subjects) {
    for (const f of s.files || []) {
      const c = JSON.parse(await readFile(path.join(root, 'data', f), 'utf8'));
      questions.push(...(c.questions || []));
      topics.push(...(c.topics || []));
    }
  }
  return { questions, topics };
}

/** Ответ на задание: верный или заведомо неверный, в том виде, как его понимает checkAnswer. */
function makeAnswer(q, right) {
  switch (q.type) {
    case 'single-choice':
      return right ? q.correctAnswer : q.options.find((o) => o.id !== q.correctAnswer).id;
    case 'true-false':
      return right ? q.correctAnswer : !q.correctAnswer;
    case 'text':
      return right ? q.correctAnswer : 'ъъъ';
    case 'number':
      return String(right ? q.correctAnswer : q.correctAnswer + 1 + 2 * (q.tolerance || 0)).replace('.', ',');
    case 'digits': {
      const s = String(q.correctAnswer);
      return right ? s : s.slice(0, -1) + ((Number(s.at(-1)) + 1) % 10);
    }
    case 'compare':
      return right ? q.correctAnswer : COMPARE_SIGNS.find((s) => s !== q.correctAnswer);
    case 'multi-choice': {
      if (right) return q.correctAnswers.slice();
      const extra = q.options.find((o) => !q.correctAnswers.includes(o.id));
      return extra ? [extra.id] : q.correctAnswers.slice(0, 1);
    }
    case 'match':
      return q.pairs.map((_, i) => (right ? i : (i + 1) % q.pairs.length));
    case 'order':
      return right ? q.items.map((_, i) => i) : q.items.map((_, i) => q.items.length - 1 - i);
    case 'find-errors': {
      const a = perfectAnswer(q);
      return right ? a : { marked: a.marked, fixes: a.fixes.map(() => 'ъъъ') };
    }
    default:
      throw new Error(`Автотест не умеет отвечать на тип «${q.type}» — допишите makeAnswer и fillAnswer в scripts/check-site.js`);
  }
}

/** Вводит ответ на экране так, как это делает ребёнок: нажатиями и набором текста. */
async function fillAnswer(page, q, given) {
  const form = page.locator('.quiz__form');
  const option = (value) => form.locator(`label.option:has(input[value="${value}"])`);
  switch (q.type) {
    case 'single-choice':
    case 'true-false':
    case 'compare':
      return option(String(given)).click();
    case 'text':
    case 'number':
    case 'digits':
      return form.locator('#answer-input').fill(String(given));
    case 'multi-choice':
      for (const id of given) await option(id).click();
      return undefined;
    case 'match':
      for (let i = 0; i < given.length; i++) {
        await form.locator(`[data-side="l"][data-i="${i}"]`).click();
        await form.locator(`[data-side="r"][data-i="${given[i]}"]`).click();
      }
      return undefined;
    case 'order':
      for (const k of given) await form.locator(`[data-k="${k}"]`).click();
      return undefined;
    case 'find-errors':
      for (let n = 0; n < given.marked.length; n++) {
        await form.locator('.fe-word').nth(given.marked[n]).click();
        await form.locator(`#fe-fix-${given.marked[n]}`).fill(given.fixes[n]);
      }
      return undefined;
    default:
      throw new Error(`Нет ввода для типа «${q.type}»`);
  }
}

const readData = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);

/** Ждём следующий вопрос или экран результата. */
async function waitStep(page, index, total) {
  await page.waitForFunction(
    ([text]) => document.body.dataset.route === 'result' || document.querySelector('.quiz__counter')?.textContent === text,
    [`Вопрос ${index + 2} из ${total}`],
    { timeout: 8000 },
  );
  await settle(page);
}

/** Тренировка из заданий всех типов: кладём её как незаконченную и проходим на экране. */
async function runTypedQuiz(page, base, questions, { mode, right, width }) {
  const label = `тренировка «${mode === 'learning' ? 'с подсказками' : 'как на контрольной'}», ответы ${right ? 'верные' : 'неверные'}`;
  now.where = label;
  await setWidth(page, width);
  await load(page, base, '#/');
  const session = createSession({
    questions,
    source: { kind: 'topic', topicIds: [...new Set(questions.map((q) => q.topicId))], subjectId: questions[0].subjectId, title: 'Автотест: все типы заданий' },
    settings: { mode, showExplanation: true },
  });
  await page.evaluate(
    ([key, s]) => {
      const d = JSON.parse(localStorage.getItem(key));
      d.activeSession = s;
      localStorage.setItem(key, JSON.stringify(d));
    },
    [STORAGE_KEY, session],
  );
  await load(page, base, '#/quiz');

  const total = questions.length;
  for (let i = 0; i < total; i++) {
    const q = questions[i];
    now.where = `${label}, задание ${i + 1} (${q.type}, ${q.id})`;
    const given = makeAnswer(q, right);
    const expected = right ? 'correct' : 'wrong';
    const status = checkAnswer(q, given).status;
    if (status !== expected) {
      problem('автотест', `не удалось составить ${right ? 'верный' : 'неверный'} ответ: checkAnswer вернул «${status}»`);
      await page.getByRole('button', { name: 'Пропустить' }).click();
      await waitStep(page, i, total);
      continue;
    }
    await inspect(page);
    await fillAnswer(page, q, given);
    await page.locator('.quiz__actions button[type=submit]').click();
    if (mode === 'learning') {
      const fb = page.locator('.feedback');
      try {
        await fb.waitFor({ timeout: 5000 });
      } catch {
        const err = await page.locator('#answer-error').textContent();
        problem('тренировка', `после «Ответить» нет разбора ответа${err ? `; сообщение: «${err}»` : ''}`, page);
        return;
      }
      const ok = await fb.evaluate((el) => el.classList.contains('feedback--ok'));
      if (ok !== right) problem('тренировка', `ответ ${right ? 'верный' : 'неверный'}, а на экране «${ok ? 'Верно!' : 'Неверно'}»`, page);
      await settle(page);
      await inspect(page);
      await page.locator('.quiz__actions button[type=submit]').click();
    }
    await waitStep(page, i, total);
  }

  now.where = `${label}, экран результата`;
  if ((await page.evaluate(() => document.body.dataset.route)) !== 'result') return problem('тренировка', 'после последнего задания не открылся результат', page);
  await inspect(page);
  const entry = (await readData(page)).history[0];
  const want = right ? total : 0;
  if (!entry || entry.total !== total || entry.correct !== want) problem('тренировка', `в истории записано ${entry?.correct} из ${entry?.total}, ожидалось ${want} из ${total}`, page);
  return undefined;
}

/** Обычный путь ребёнка: открыть тему, нажать «Начать», пропустить все вопросы, увидеть результат. */
async function runTopicStart(page, base, topic, width) {
  now.where = `запуск темы «${topic.title}» кнопкой и пропуск всех вопросов`;
  await setWidth(page, width);
  await load(page, base, `#/topic/${encodeURIComponent(topic.id)}`);
  const before = (await readData(page)).history.length;
  await page.locator('.setup-form__actions button[type=submit]').click();
  await page.waitForFunction(() => document.body.dataset.route === 'quiz' && document.querySelector('.quiz__counter'), null, { timeout: 8000 });
  const total = Number((await page.locator('.quiz__counter').textContent()).match(/из (\d+)/)[1]);
  for (let i = 0; i < total; i++) {
    await page.getByRole('button', { name: 'Пропустить' }).click();
    await waitStep(page, i, total);
  }
  if ((await page.evaluate(() => document.body.dataset.route)) !== 'result') return problem('тренировка', 'после пропуска всех вопросов не открылся результат', page);
  await inspect(page);
  const d = await readData(page);
  if (d.history.length !== before + 1 || d.history[0].correct !== 0 || d.history[0].total !== total) problem('тренировка', `в истории записано ${d.history[0]?.correct} из ${d.history[0]?.total}, ожидалось 0 из ${total}`, page);
  if (d.activeSession) problem('тренировка', 'после результата осталась незаконченная тренировка', page);
  return undefined;
}

// ---------- Обход экранов ----------

async function crawl(page, base, width) {
  await setWidth(page, width);
  now.where = '#/';
  await load(page, base, '#/');
  const queue = ['#/'];
  const visited = new Set(queue);
  let count = 0;
  while (queue.length && count < MAX_SCREENS) {
    const hash = queue.shift();
    now.where = decodeURIComponent(hash);
    try {
      if (count > 0) await go(page, hash);
      for (const link of await inspect(page)) {
        if (!visited.has(link)) {
          visited.add(link);
          queue.push(link);
        }
      }
    } catch (e) {
      problem('автотест', `экран не открылся: ${String(e.message).split('\n')[0]}`, page);
      await load(page, base, '#/').catch(() => {});
    }
    count++;
    if (count % 50 === 0) console.log(`    …${count} экранов`);
  }
  if (queue.length) problem('автотест', `экранов больше ${MAX_SCREENS} — обход остановлен`);
  return count;
}

// ---------- Запуск ----------

async function main() {
  await mkdir(SHOTS_DIR, { recursive: true });
  const { questions, topics } = await loadQuestions();
  const byType = QUESTION_TYPES.map((type) => questions.find((q) => q.type === type)).filter(Boolean);
  const missingTypes = QUESTION_TYPES.filter((type) => !byType.some((q) => q.type === type));

  const server = await startServer();
  let browser;
  const summary = [];
  try {
    const launched = await launchBrowser();
    browser = launched.browser;
    console.log(`Браузер: ${launched.channel === 'msedge' ? 'Edge' : 'Chrome'} ${browser.version()}\n`);

    // 1. Первый вход: чистый браузер, экран знакомства.
    console.log('1. Первый вход (экран знакомства)');
    const fresh = await newContext(browser, server.base, null);
    const freshPage = await newPage(fresh, server.base);
    for (const w of WIDTHS) {
      await setWidth(freshPage, w);
      now.where = 'первый вход, #/';
      await load(freshPage, server.base, '#/');
      await inspect(freshPage);
      if (!(await freshPage.locator('#welcome-name').count())) problem('первый вход', 'нет экрана знакомства с полем имени', freshPage);
    }
    await fresh.close();

    // 2. Тренировки. Ученик уже познакомился с приложением.
    const start = defaultData();
    start.settings.introDone = true;
    start.settings.nickname = 'Автотест';
    start.settings.grade = 4;
    const context = await newContext(browser, server.base, JSON.stringify(start));
    const page = await newPage(context, server.base);

    console.log(`2. Тренировки: по одному заданию каждого типа (${byType.length} типов)`);
    if (missingTypes.length) problem('автотест', `в заданиях нет ни одного вопроса типа: ${missingTypes.join(', ')}`);
    const runs = [
      () => runTypedQuiz(page, server.base, byType, { mode: 'learning', right: true, width: WIDTHS[0] }),
      () => runTypedQuiz(page, server.base, byType, { mode: 'learning', right: false, width: WIDTHS[1] }),
      () => runTypedQuiz(page, server.base, byType, { mode: 'control', right: false, width: WIDTHS[0] }),
      () => runTypedQuiz(page, server.base, byType, { mode: 'control', right: true, width: WIDTHS[1] }),
      () => runTopicStart(page, server.base, topics.find((t) => t.subjectId === 'math') || topics[0], WIDTHS[0]),
    ];
    for (const run of runs) {
      try {
        await run();
      } catch (e) {
        problem('автотест', `проверка прервалась: ${String(e.message).split('\n')[0]}`, page);
      }
      console.log(`    ${now.where.split(', ')[0]} — пройдено`);
    }
    summary.push(`тренировок пройдено: ${runs.length}`);

    // 3. Все экраны по ссылкам — уже с историей тренировок, чтобы «Прогресс» и результаты были не пустыми.
    for (const w of WIDTHS) {
      console.log(`3. Обход экранов по ссылкам, ${w.name}`);
      const n = await crawl(page, server.base, w);
      summary.push(`экранов на ширине «${w.name}»: ${n}`);
    }
    await context.close();
  } finally {
    await browser?.close();
    server.child.kill();
  }

  console.log(`\nПроверено — ${summary.join('; ')}.`);
  if (SELFTEST) {
    const kinds = new Set(problems.map((p) => p.kind));
    const missed = ['прокрутка вбок', 'не найдено', 'ошибка в консоли', 'сеть', 'чужой адрес'].filter((k) => !kinds.has(k));
    console.log(missed.length ? `Самопроверка НЕ пройдена: автотест не заметил — ${missed.join(', ')}.` : `Самопроверка пройдена: автотест заметил все пять нарочных поломок (записей: ${problems.length}).`);
    process.exitCode = missed.length ? 1 : 0;
    return;
  }
  if (!problems.length) {
    console.log('Проблем не найдено.');
    return;
  }
  console.log(`\nНайдено проблем: ${problems.length}\n`);
  for (const p of problems) {
    const shot = await p.shot;
    console.log(`✗ [${p.kind}] ${p.where}${p.width ? ` — ${p.width}` : ''}\n    ${p.text}${shot ? `\n    снимок: ${path.relative(root, shot)}` : ''}`);
  }
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(`Автотест не смог запуститься: ${e.message}`);
  process.exitCode = 2;
});
