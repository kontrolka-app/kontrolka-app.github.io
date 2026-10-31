// Настройки, экспорт/импорт и сброс.
import { h, pageHeader, button, confirmDialog, toast, downloadJson, readFileText, icon, copyText, nameFieldDetails } from '../ui.js';
import { href, navigate } from '../router.js';
import { getData, settings, update, replaceAll, resetAll, applyAppearance, content } from '../state.js';
import { exportData, importData } from '../storage.js';
import { availableGrades } from '../catalog.js';
import { masteredCount } from '../stats.js';
import { pickWonder } from '../wonders.js';
import { companionHide } from './companion-ui.js';
import { badgeGrid, avatarSvg, unlockHint, unlockShort } from '../components.js';
import { AVATARS, ACCESSORIES, resolveAvatar, resolveCompanion, isUnlocked } from '../avatars.js';
import { BADGES, shareAchievementsText } from '../achievements.js';

export const APP_VERSION = '1.0.0';

/** Аватарка и выбор: персонажи и аксессуары; закрытые — серые, с подсказкой, каким значком открываются. */
function avatarPicker(data) {
  const me = resolveAvatar(data.settings, data.badges);
  const choose = (key, value) => {
    update((d) => ((d.settings[key] = value), d));
    navigate('settings');
  };
  // Компаньон: свой персонаж, «как моя аватарка» (companionId = '') или выключен (companion = false).
  const buddy = resolveCompanion(data.settings, data.badges);
  const chooseBuddy = (id, on = true) => {
    update((d) => ((d.settings.companionId = id), (d.settings.companion = on), d));
    if (!on) companionHide();
    navigate('settings');
  };
  const buddyOn = data.settings.companion;
  const tile = (item, selected, onPick, preview) => {
    const open = isUnlocked(item, data.badges);
    return h(
      'button',
      { type: 'button', class: `avatar-tile${selected ? ' is-selected' : ''}${open ? '' : ' is-locked'}`, 'aria-pressed': String(selected), disabled: !open, title: open ? item.name : unlockHint(item.unlock), onclick: onPick },
      preview,
      h('span', { class: 'avatar-tile__name small' }, open ? item.name : `🔒 ${unlockShort(item.unlock)}`),
    );
  };
  return h(
    'div',
    { class: 'stack-sm' },
    h('div', { class: 'avatar-me' }, avatarSvg(me.avatar, me.accessory, { size: 88, label: me.avatar.name }), h('p', { class: 'avatar-me__name' }, me.chosen ? me.avatar.name : 'Выбери себе персонажа')),
    h(
        'details',
        { class: 'avatar-picker' },
        h('summary', {}, 'Сменить персонажа'),
        h('div', { class: 'avatar-grid' }, AVATARS.map((a) => tile(a, me.chosen && a.id === me.avatar.id, () => choose('avatar', a.id), avatarSvg(a, null, { size: 56 })))),
        h('p', { class: 'field__label' }, 'Аксессуар'),
        h(
          'div',
          { class: 'avatar-grid' },
          tile({ id: '', name: 'без аксессуара' }, !me.accessory, () => choose('accessory', ''), avatarSvg(me.avatar, null, { size: 56 })),
          ACCESSORIES.map((x) => tile(x, me.accessory?.id === x.id, () => choose('accessory', x.id), avatarSvg(me.avatar, x, { size: 56 }))),
        ),
      ),
    h(
      'details',
      { class: 'avatar-picker' },
      h('summary', {}, buddyOn ? `Компаньон: ${buddy.sameAsAvatar ? 'как моя аватарка' : buddy.avatar.name} — сменить` : 'Компаньон выключен — выбрать'),
      h('p', { class: 'small muted' }, 'Компаньон подбадривает в углу экрана и под заданием. Подсказок к ответам не даёт, на контрольной молчит.'),
      h(
        'div',
        { class: 'avatar-grid' },
        tile({ name: 'как моя аватарка' }, buddyOn && buddy.sameAsAvatar, () => chooseBuddy(''), avatarSvg(me.avatar, me.accessory, { size: 56 })),
        tile({ name: 'без компаньона' }, !buddyOn, () => chooseBuddy(data.settings.companionId, false), h('span', { class: 'avatar-tile__off', 'aria-hidden': 'true' }, '🔕')),
        AVATARS.map((a) => tile(a, buddyOn && !buddy.sameAsAvatar && a.id === buddy.avatar.id, () => chooseBuddy(a.id), avatarSvg(a, null, { size: 56 }))),
      ),
    ),
  );
}

/** «Мои достижения»: счётчики за всё время (не пропадают, когда старая история обрезается). */
function achievementsBlock(data) {
  const st = data.stats;
  const fact = (value, label) => h('div', {}, h('dt', {}, label), h('dd', {}, String(value)));
  return h(
    'section',
    { class: 'card stack', id: 'achievements' },
    h('h2', { class: 'card__title' }, '🏆 Мои достижения'),
    avatarPicker(data),
    h(
      'dl',
      { class: 'progress-facts progress-facts--wide' },
      // Подписи не зависят от числа — так не бывает «2 темы освоено».
      fact(st.days.length, 'дней с занятиями'),
      fact(st.bestStreak, 'лучшая серия дней подряд'),
      fact(st.questions, 'решено вопросов'),
      fact(st.correct, 'верных ответов'),
      fact(masteredCount(st), 'освоено тем'),
    ),
    (() => {
      const w = pickWonder(st, Object.keys(data.poems.learned).length);
      return w ? h('p', { class: 'wonder' }, '✨ ', w.text) : null;
    })(),
    h('h3', {}, `Значки: ${Object.keys(data.badges).length} из ${BADGES.length}`),
    badgeGrid(data.badges),
    h(
      'div',
      {},
      button(
        'Поделиться достижениями',
        async () => {
          const me = resolveAvatar(data.settings, data.badges);
          const ok = await copyText(shareAchievementsText({ nickname: data.settings.nickname, avatarName: me.chosen ? me.avatar.name : '', stats: data.stats, badges: data.badges }));
          toast(ok ? 'Скопировано — отправь другу или в чат класса.' : 'Не удалось скопировать.', ok ? 'info' : 'error');
        },
        { variant: 'secondary', iconName: 'copy' },
      ),
    ),
  );
}

/** В списке только классы с заданиями; «Не выбран» — когда есть из чего выбирать. */
function gradeOptions(current) {
  const grades = availableGrades(content.topics);
  if (current && !grades.includes(current)) grades.push(current);
  const options = grades.map((g) => [g, `${g} класс`]);
  return grades.length > 1 || !current ? [['', 'Не выбран'], ...options] : options;
}

function select(id, label, value, options, onChange, hint) {
  return h(
    'div',
    { class: 'field' },
    h('label', { class: 'field__label', for: id }, label),
    h('select', { class: 'input', id, onchange: (e) => onChange(e.target.value) }, options.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t))),
    hint ? h('p', { class: 'field__hint' }, hint) : null,
  );
}

export function settingsScreen() {
  const s = settings();
  const set = (key, value) => {
    update((d) => ((d.settings[key] = value), d));
    applyAppearance();
  };

  const nickname = h('input', { class: 'input', id: 'nickname', value: s.nickname, maxLength: 40, autocomplete: 'off', placeholder: 'Например: Макс' });
  nickname.addEventListener('change', () => {
    set('nickname', nickname.value.trim().slice(0, 40));
    toast('Имя сохранено');
  });

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: 'import-file' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await readFileText(file));
    } catch (e) {
      toast(e.message === 'Файл слишком большой.' ? e.message : 'Файл повреждён или это не JSON.', 'error');
      return;
    }
    const res = importData(parsed);
    if (!res.ok) {
      toast(res.errors.join(' '), 'error');
      return;
    }
    const ok = await confirmDialog(
      `В файле: тренировок ${res.data.history.length}, своих тестов ${res.data.customTests.length}, избранных тем ${res.data.favorites.length}. Текущие данные на этом устройстве будут заменены.`,
      { title: 'Восстановить из файла?', okText: 'Восстановить' },
    );
    if (!ok) return;
    replaceAll(res.data);
    applyAppearance();
    toast(res.dropped ? `Данные восстановлены. Пропущено повреждённых записей: ${res.dropped}.` : 'Данные восстановлены.');
    navigate('settings');
  });

  const data = getData();
  const totalQuestions = content.questions.length;
  return h(
    'div',
    { class: 'stack' },
    pageHeader('Я', { back: href('home'), subtitle: s.nickname ? `${s.nickname} · мои тесты и настройки` : 'Мои тесты и настройки' }),
    achievementsBlock(data),
    h(
      'section',
      { class: 'card stack' },
      h('h2', { class: 'card__title card__title--icon' }, icon('tests'), h('span', {}, 'Мои тесты')),
      h(
        'p',
        { class: 'muted' },
        data.customTests.length
          ? `Тестов: ${data.customTests.length}. Составляй свои и открывай тесты от одноклассников.`
          : 'Составь свой тест для класса или открой тест, который прислали одноклассники.',
      ),
      h('div', {}, h('a', { class: 'btn btn--secondary', href: href('mytests') }, icon('arrow'), h('span', {}, 'Открыть «Мои тесты»'))),
    ),
    h('h2', {}, 'Настройки'),
    h(
      'section',
      { class: 'card stack' },
      h('h2', { class: 'card__title' }, 'Внешний вид'),
      select('theme', 'Тема', s.theme, [['system', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], (v) => set('theme', v)),
      select('font', 'Размер текста', s.fontSize, [['normal', 'Обычный'], ['large', 'Крупный'], ['xlarge', 'Очень крупный']], (v) => set('fontSize', v)),
    ),
    h(
      'section',
      { class: 'card stack' },
      h('h2', { class: 'card__title' }, 'Учёба'),
      select('grade', 'Класс', s.grade ?? '', gradeOptions(s.grade), (v) => set('grade', v ? Number(v) : null)),
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'field__label', for: 'nickname' }, 'Как тебя называть'),
        nickname,
        nameFieldDetails(nickname),
        h('p', { class: 'field__hint' }, 'Только имя или прозвище — без фамилии. Оно видно в приветствии и в скопированном результате.'),
      ),
      select('def-count', 'Вопросов в тренировке по умолчанию', s.defaultCount, [5, 10, 15, 20, 30].map((n) => [n, String(n)]), (v) => set('defaultCount', Number(v))),
      select('def-mode', 'Режим по умолчанию', s.defaultMode, [['learning', 'С подсказками'], ['control', 'Как на контрольной']], (v) => set('defaultMode', v)),
      select('daily-goal', 'Цель на день', s.dailyGoal, [5, 10, 20].map((n) => [n, `${n} вопросов`]), (v) => set('dailyGoal', Number(v)), 'На главной будет видно, сколько уже сделано сегодня. Пропустил день — ничего страшного, серия просто начнётся заново.'),
      h(
        'label',
        { class: 'check' },
        h('input', { type: 'checkbox', checked: s.showExplanation, onchange: (e) => set('showExplanation', e.target.checked) }),
        h('span', {}, 'В режиме «С подсказками» сразу показывать объяснение'),
      ),
      h(
        'label',
        { class: 'check' },
        h('input', { type: 'checkbox', checked: s.companion, onchange: (e) => (set('companion', e.target.checked), e.target.checked || companionHide()) }),
        h('span', {}, 'Компаньон: персонаж в углу экрана подбадривает (подсказок к ответам не даёт)'),
      ),
    ),
    h(
      'section',
      { class: 'card stack' },
      h('h2', { class: 'card__title' }, 'Мои данные'),
      h('p', { class: 'muted' }, 'Всё хранится только в этом браузере на этом устройстве. Если очистить данные браузера, история пропадёт. Сохрани копию в файл, чтобы перенести прогресс на другое устройство.'),
      h(
        'div',
        { class: 'row wrap' },
        button('Сохранить копию в файл', () => {
          const d = new Date();
          downloadJson(exportData(getData()), `kontrolka-backup-${d.toISOString().slice(0, 10)}.json`);
          toast('Файл с копией данных сохранён.');
        }, { variant: 'secondary', iconName: 'download' }),
        h('label', { class: 'btn btn--secondary', for: 'import-file', tabindex: '0', role: 'button', onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.click()) }, icon('upload'), h('span', {}, 'Восстановить из файла')),
        fileInput,
      ),
      h('p', { class: 'small muted' }, `Сейчас сохранено: тренировок ${data.history.length}, своих тестов ${data.customTests.length}, избранных тем ${data.favorites.length}.`),
      button(
        'Удалить весь прогресс',
        async () => {
          const ok = await confirmDialog('Будут удалены история, избранное, свои тесты и настройки на этом устройстве. Отменить это нельзя. Сначала можно сохранить копию в файл.', {
            title: 'Удалить все данные?',
            okText: 'Удалить всё',
            danger: true,
          });
          if (!ok) return;
          resetAll();
          applyAppearance();
          toast('Все данные удалены.');
          navigate('home');
        },
        { variant: 'danger', iconName: 'trash' },
      ),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card__title' }, 'О приложении'),
      h('p', {}, `Контролька, версия ${APP_VERSION}. Заданий в базе: ${totalQuestions}.`),
      h('p', { class: 'small muted' }, 'Задания оригинальные, составлены по темам программы «Школа России» для 4 класса и сверены с учебниками. Они не копируют учебники. Если нашли ошибку в задании — сообщите взрослому, который ведёт проект.'),
      h('p', { class: 'small muted' }, 'Приложение не собирает личные данные и ничего не отправляет в интернет.'),
    ),
  );
}
