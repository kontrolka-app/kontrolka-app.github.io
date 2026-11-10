// Карта пути по темам предмета: дорожка змейкой, остановки — темы. Нажатие на остановку открывает тему.
import { h, icon } from '../ui.js';
import { href } from '../router.js';
import { getData } from '../state.js';
import { avatarSvg } from '../components.js';
import { resolveCompanion } from '../avatars.js';
import { pathStops, pathHeight, pathLine, PATH_MAPS } from '../path.js';

const NS = 'http://www.w3.org/2000/svg';
const STATUS_TEXT = { new: 'не начата', progress: 'в процессе', mastered: 'освоена' };

/** Дорога: широкая песочная полоса с пунктиром посередине. Толщина в px не зависит от растяжения рисунка. */
function road(stops, height) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'path__road');
  svg.setAttribute('viewBox', `0 0 100 ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  for (const cls of ['path__road-edge', 'path__road-fill', 'path__road-dash']) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pathLine(stops));
    p.setAttribute('class', cls);
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(p);
  }
  return svg;
}

/** Нарисованная карта под дорожкой: части делят высоту поровну и мягко перетекают одна в другую. */
function background(subjectId) {
  const parts = PATH_MAPS[subjectId] || 0;
  if (!parts) return null;
  return h(
    'div',
    { class: 'path__bg', 'aria-hidden': 'true', style: { '--parts': String(parts) } },
    Array.from({ length: parts }, (_, i) => h('img', { class: 'path__tile', src: `assets/path/${subjectId}-${i + 1}.webp`, alt: '', decoding: 'async', style: { '--i': String(i) } })),
  );
}

function stopNode(s, buddy) {
  const mark = s.status === 'mastered' ? icon('check', { size: 22 }) : s.bonus ? icon('star', { size: 22 }) : String(s.n);
  return h(
    'li',
    { class: `path-stop path-stop--${s.side}`, style: { top: `${s.y}px`, '--x': `${s.x}%` } },
    h(
      'a',
      { class: `path-stop__link path-stop__link--${s.status}${s.bonus ? ' path-stop__link--bonus' : ''}${s.here ? ' is-here' : ''}`, href: href('topic', s.topic.id) },
      h('span', { class: 'path-stop__dot', 'aria-hidden': 'true' }, mark),
      h(
        'span',
        { class: 'path-stop__label' },
        s.sectionStart ? h('span', { class: 'path-stop__section' }, s.topic.section) : null,
        h('span', { class: 'path-stop__title' }, s.topic.title),
        s.percent !== null ? h('span', { class: 'path-stop__percent' }, `${s.percent}%`) : null,
        h('span', { class: 'sr-only' }, `, ${STATUS_TEXT[s.status]}${s.here ? ', ты здесь' : ''}`),
      ),
    ),
    s.here && buddy ? h('span', { class: 'path-stop__buddy', 'aria-hidden': 'true' }, avatarSvg(buddy.avatar, buddy.accessory, { size: 46 })) : null,
  );
}

export function pathView(subject, topics, lastResults) {
  const data = getData();
  const stops = pathStops(topics, lastResults);
  const height = pathHeight(stops.length);
  const buddy = resolveCompanion(data.settings, data.badges);
  const here = stops.find((s) => s.here);
  const view = h(
    'section',
    { class: `path${PATH_MAPS[subject.id] ? ' path--map' : ''}`, 'aria-label': `Путь по темам: ${subject.name}` },
    h('div', { class: 'path__canvas', style: { height: `${height}px` } }, background(subject.id), road(stops, height), h('ol', { class: 'path__stops' }, stops.map((s) => stopNode(s, buddy)))),
  );
  // Открываем путь там, где ребёнок сейчас, а не с самого начала (первую остановку и так видно).
  if (here && here.n > 3) {
    requestAnimationFrame(() => view.querySelector('.is-here')?.scrollIntoView({ block: 'center' }));
  }
  return view;
}
