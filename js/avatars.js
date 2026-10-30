// Аватарки: свои персонажи из простых фигур (SVG-разметка как данные) и аксессуары. Без DOM.
// Часть персонажей и аксессуаров открывается значками. Рисует их avatarSvg() в components.js.

const INK = '#1b1f3b';
const s = (extra = {}) => ({ stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
const eye = (cx, cy, r = 4) => [['circle', { cx, cy, r: r + 3, fill: '#fff', ...s({ 'stroke-width': 2 }) }], ['circle', { cx, cy, r, fill: INK }]];
const smile = (d) => ['path', { d, fill: 'none', ...s() }];

/** Персонажи: фон-круг bg и фигуры [тег, атрибуты]. viewBox 0 0 100 100. */
export const AVATARS = [
  {
    id: 'raccoon', name: 'Енот Профессор', bg: '#E3E9FF',
    shapes: [
      ['path', { d: 'M24 30 L30 12 L42 26 Z', fill: '#9aa0ad', ...s() }], ['path', { d: 'M76 30 L70 12 L58 26 Z', fill: '#9aa0ad', ...s() }],
      ['circle', { cx: 50, cy: 54, r: 30, fill: '#b9bcc6', ...s() }],
      ['path', { d: 'M22 50 Q50 36 78 50 Q72 64 50 58 Q28 64 22 50 Z', fill: '#4b4f5c' }],
      ...eye(39, 50), ...eye(61, 50),
      ['circle', { cx: 39, cy: 50, r: 10, fill: 'none', ...s({ 'stroke-width': 2.5 }) }], ['circle', { cx: 61, cy: 50, r: 10, fill: 'none', ...s({ 'stroke-width': 2.5 }) }],
      ['path', { d: 'M49 50 L51 50', ...s({ 'stroke-width': 2.5 }) }],
      ['ellipse', { cx: 50, cy: 66, rx: 5, ry: 3.5, fill: INK }], smile('M42 73 Q50 78 58 73'),
    ],
  },
  {
    id: 'cactus', name: 'Кактус-отличник', bg: '#DDF3E6',
    shapes: [
      ['path', { d: 'M28 62 Q16 60 18 44', fill: 'none', ...s({ 'stroke-width': 9, stroke: '#3f9a5c' }) }], ['path', { d: 'M72 56 Q84 54 82 40', fill: 'none', ...s({ 'stroke-width': 9, stroke: '#3f9a5c' }) }],
      ['rect', { x: 30, y: 24, width: 40, height: 64, rx: 20, fill: '#4fb46c', ...s() }],
      ['path', { d: 'M40 34 L40 38 M60 34 L60 38 M50 30 L50 34 M38 78 L38 82 M62 78 L62 82', ...s({ 'stroke-width': 2 }) }],
      ...eye(42, 50, 3.5), ...eye(58, 50, 3.5), smile('M42 62 Q50 69 58 62'),
      ['circle', { cx: 50, cy: 20, r: 6, fill: '#ff8fb1', ...s({ 'stroke-width': 2 }) }],
    ],
  },
  {
    id: 'cat', name: 'Сонный Кот', bg: '#FFF0C7',
    shapes: [
      ['path', { d: 'M24 36 L28 14 L44 28 Z', fill: '#f2a03d', ...s() }], ['path', { d: 'M76 36 L72 14 L56 28 Z', fill: '#f2a03d', ...s() }],
      ['circle', { cx: 50, cy: 54, r: 30, fill: '#f6b45c', ...s() }],
      ['path', { d: 'M34 50 Q40 55 46 50 M54 50 Q60 55 66 50', fill: 'none', ...s() }],
      ['path', { d: 'M47 61 L53 61 L50 65 Z', fill: '#e8738f', ...s({ 'stroke-width': 2 }) }], smile('M44 70 Q50 74 56 70'),
      ['path', { d: 'M20 60 L36 62 M20 68 L36 66 M80 60 L64 62 M80 68 L64 66', ...s({ 'stroke-width': 2 }) }],
      ['text', { x: 74, y: 24, 'font-size': 14, 'font-weight': 800, fill: INK, 'font-family': 'inherit' }, 'z'],
    ],
  },
  {
    id: 'dino', name: 'Динозаврик Рюкзачок', bg: '#DDF3E6',
    shapes: [
      ['path', { d: 'M30 30 L36 18 L42 28 L48 14 L54 27 L62 17 L64 30', fill: '#e9c46a', ...s() }],
      ['ellipse', { cx: 50, cy: 56, rx: 30, ry: 28, fill: '#7ccf8b', ...s() }],
      ['path', { d: 'M24 72 Q20 86 34 86 L66 86 Q80 86 76 72', fill: 'none', ...s({ stroke: '#d1495b', 'stroke-width': 5 }) }],
      ...eye(40, 50), ...eye(62, 50), ['circle', { cx: 46, cy: 64, r: 1.8, fill: INK }], ['circle', { cx: 56, cy: 64, r: 1.8, fill: INK }],
      smile('M40 70 Q50 77 60 70'),
    ],
  },
  {
    id: 'penguin', name: 'Пингвин Пушок', bg: '#E3E9FF',
    shapes: [
      ['ellipse', { cx: 50, cy: 54, rx: 30, ry: 32, fill: '#2b2f45', ...s() }],
      ['ellipse', { cx: 50, cy: 60, rx: 20, ry: 22, fill: '#ffffff' }],
      ...eye(41, 46), ...eye(59, 46),
      ['path', { d: 'M44 56 L56 56 L50 64 Z', fill: '#f4a261', ...s({ 'stroke-width': 2 }) }],
      ['ellipse', { cx: 36, cy: 64, rx: 4, ry: 2.5, fill: '#ffb3c1' }], ['ellipse', { cx: 64, cy: 64, rx: 4, ry: 2.5, fill: '#ffb3c1' }],
    ],
  },
  {
    id: 'hedgehog', name: 'Ёжик Колючкин', bg: '#FFF0C7',
    shapes: [
      ['path', { d: 'M18 64 L14 46 L26 50 L24 32 L36 40 L40 22 L50 34 L58 20 L64 36 L76 28 L76 44 L88 44 L82 62 Z', fill: '#8d6346', ...s() }],
      ['ellipse', { cx: 52, cy: 62, rx: 26, ry: 20, fill: '#f1d3a8', ...s() }],
      ...eye(44, 58, 3.5), ...eye(60, 58, 3.5),
      ['circle', { cx: 78, cy: 64, r: 4, fill: INK }], smile('M46 70 Q52 75 58 70'),
    ],
  },
  {
    id: 'fox', name: 'Лисёнок Рыжик', bg: '#FDE3DA',
    shapes: [
      ['path', { d: 'M22 40 L24 12 L44 30 Z', fill: '#e76f36', ...s() }], ['path', { d: 'M78 40 L76 12 L56 30 Z', fill: '#e76f36', ...s() }],
      ['path', { d: 'M20 40 Q50 22 80 40 Q78 70 50 84 Q22 70 20 40 Z', fill: '#f08a4b', ...s() }],
      ['path', { d: 'M30 58 Q50 66 70 58 Q66 74 50 84 Q34 74 30 58 Z', fill: '#fff4ea' }],
      ...eye(40, 50), ...eye(60, 50), ['ellipse', { cx: 50, cy: 70, rx: 4.5, ry: 3.5, fill: INK }],
    ],
  },
  {
    id: 'lamb', name: 'Барашек Карандашик', bg: '#E3E9FF',
    shapes: [
      ['path', { d: 'M30 54 Q14 50 14 60 Q20 66 32 60 Z M70 54 Q86 50 86 60 Q80 66 68 60 Z', fill: '#e8d2b6', ...s() }],
      ['path', { d: 'M28 44 Q22 30 36 28 Q40 16 52 20 Q62 14 68 26 Q80 28 76 42 Q84 52 74 60 Q76 72 62 72 Q52 82 40 74 Q26 76 26 62 Q16 54 28 44 Z', fill: '#ffffff', ...s() }],
      ['ellipse', { cx: 50, cy: 60, rx: 15, ry: 17, fill: '#f3dcc0', ...s() }],
      ...eye(44, 56, 3), ...eye(56, 56, 3), smile('M45 70 Q50 74 55 70'),
      // Карандаш за ухом: ластик, корпус, заточка и грифель, повёрнуты вместе
      ['rect', { x: 48, y: 18, width: 7, height: 8, rx: 2, fill: '#ff8fb1', transform: 'rotate(35 68 22)', ...s({ 'stroke-width': 2 }) }],
      ['rect', { x: 55, y: 18, width: 23, height: 8, fill: '#f9c74f', transform: 'rotate(35 68 22)', ...s({ 'stroke-width': 2 }) }],
      ['path', { d: 'M78 18 L87 22 L78 26 Z', fill: '#f1d3a8', transform: 'rotate(35 68 22)', ...s({ 'stroke-width': 2 }) }],
      ['path', { d: 'M84 20.7 L87 22 L84 23.3 Z', fill: INK, transform: 'rotate(35 68 22)' }],
    ],
  },
  {
    id: 'notebook', name: 'Тетрадь в кружок', bg: '#FFF0C7',
    shapes: [
      ['path', { d: 'M50 34 Q34 26 14 32 L14 86 Q34 80 50 88 Q66 80 86 86 L86 32 Q66 26 50 34 Z', fill: '#4d7cfe', ...s() }],
      ['path', { d: 'M50 30 Q34 22 16 28 L16 80 Q34 74 50 82 Q66 74 84 80 L84 28 Q66 22 50 30 Z', fill: '#ffffff', ...s() }],
      // Кружочки вместо клеток — по краям страниц, чтобы не закрывать лицо
      ...[22, 30, 70, 78].flatMap((x) => [38, 48, 58, 68].map((y) => ['circle', { cx: x, cy: y, r: 2.4, fill: 'none', stroke: '#8fa9f0', 'stroke-width': 1.2 }])),
      ['path', { d: 'M50 30 L50 82', ...s({ 'stroke-width': 2 }) }],
      ...eye(40, 46, 3.5), ...eye(60, 46, 3.5),
      ['ellipse', { cx: 38, cy: 58, rx: 4, ry: 2.5, fill: '#ffb3c1' }], ['ellipse', { cx: 62, cy: 58, rx: 4, ry: 2.5, fill: '#ffb3c1' }],
      smile('M42 60 Q50 68 58 60'),
    ],
  },
  {
    id: 'ruler', name: 'Линейка Ботаник', bg: '#DDF3E6',
    shapes: [
      ['rect', { x: 34, y: 12, width: 32, height: 80, rx: 4, fill: '#f9d56e', ...s() }],
      ['path', { d: 'M34 72 L40 72 M34 77 L38 77 M34 82 L40 82 M34 87 L38 87 M66 72 L60 72 M66 77 L62 77 M66 82 L60 82 M66 87 L62 87', ...s({ 'stroke-width': 2 }) }],
      ...eye(43, 36, 3), ...eye(57, 36, 3),
      ['circle', { cx: 43, cy: 36, r: 7, fill: 'none', ...s({ 'stroke-width': 2.5 }) }], ['circle', { cx: 57, cy: 36, r: 7, fill: 'none', ...s({ 'stroke-width': 2.5 }) }],
      ['path', { d: 'M49.5 36 L50.5 36', ...s({ 'stroke-width': 2.5 }) }],
      smile('M45 49 Q50 53 55 49'),
      ['path', { d: 'M50 61 L42 56 L42 66 Z M50 61 L58 56 L58 66 Z', fill: '#4d7cfe', ...s({ 'stroke-width': 2 }) }],
    ],
  },
  {
    id: 'owl', name: 'Сова Умница', bg: '#EEE7FB', unlock: 'expert',
    shapes: [
      ['path', { d: 'M24 34 L30 18 L40 30 M76 34 L70 18 L60 30', fill: '#9c7b5b', ...s() }],
      ['ellipse', { cx: 50, cy: 56, rx: 30, ry: 30, fill: '#a98563', ...s() }],
      ['circle', { cx: 38, cy: 48, r: 11, fill: '#fff', ...s() }], ['circle', { cx: 62, cy: 48, r: 11, fill: '#fff', ...s() }],
      ['circle', { cx: 38, cy: 48, r: 5, fill: INK }], ['circle', { cx: 62, cy: 48, r: 5, fill: INK }],
      ['path', { d: 'M45 60 L55 60 L50 68 Z', fill: '#f4a261', ...s({ 'stroke-width': 2 }) }],
      ['path', { d: 'M36 74 Q42 70 48 74 M52 74 Q58 70 64 74', fill: 'none', ...s({ 'stroke-width': 2 }) }],
    ],
  },
  {
    id: 'robot', name: 'Робот Счётик', bg: '#E3E9FF', unlock: 'q500',
    shapes: [
      ['path', { d: 'M50 22 L50 12', ...s() }], ['circle', { cx: 50, cy: 10, r: 4, fill: '#e63946', ...s({ 'stroke-width': 2 }) }],
      ['rect', { x: 22, y: 24, width: 56, height: 54, rx: 12, fill: '#c9d1e3', ...s() }],
      ['rect', { x: 30, y: 36, width: 40, height: 22, rx: 6, fill: '#2b2f45' }],
      ['circle', { cx: 41, cy: 47, r: 4, fill: '#7cf3c4' }], ['circle', { cx: 59, cy: 47, r: 4, fill: '#7cf3c4' }],
      ['path', { d: 'M38 68 L62 68', ...s() }], ['path', { d: 'M16 46 L22 46 M78 46 L84 46', ...s({ 'stroke-width': 4 }) }],
    ],
  },
  {
    id: 'frog', name: 'Лягушонок Квак', bg: '#DDF3E6', unlock: 'traveler',
    shapes: [
      ['circle', { cx: 34, cy: 34, r: 12, fill: '#6cc070', ...s() }], ['circle', { cx: 66, cy: 34, r: 12, fill: '#6cc070', ...s() }],
      ['ellipse', { cx: 50, cy: 60, rx: 34, ry: 24, fill: '#6cc070', ...s() }],
      ...eye(34, 34), ...eye(66, 34),
      smile('M30 62 Q50 78 70 62'), ['ellipse', { cx: 28, cy: 70, rx: 4, ry: 2.5, fill: '#ffb3c1' }], ['ellipse', { cx: 72, cy: 70, rx: 4, ry: 2.5, fill: '#ffb3c1' }],
    ],
  },
];

/** Аксессуары поверх персонажа. */
export const ACCESSORIES = [
  {
    id: 'scarf', name: 'шарф', unlock: 'week',
    shapes: [['path', { d: 'M26 80 Q50 92 74 80 L74 88 Q50 98 26 88 Z', fill: '#e63946', ...s({ 'stroke-width': 2.5 }) }], ['path', { d: 'M62 88 L66 99 L74 97 L70 86', fill: '#e63946', ...s({ 'stroke-width': 2.5 }) }]],
  },
  {
    id: 'hat', name: 'шапка', unlock: 'month',
    shapes: [['path', { d: 'M28 26 Q50 -6 72 26 Z', fill: '#4d7cfe', ...s({ 'stroke-width': 2.5 }) }], ['rect', { x: 24, y: 22, width: 52, height: 9, rx: 4, fill: '#fff', ...s({ 'stroke-width': 2.5 }) }], ['circle', { cx: 50, cy: 4, r: 5, fill: '#fff', ...s({ 'stroke-width': 2.5 }) }]],
  },
  {
    id: 'bow', name: 'бантик', unlock: 'perfect',
    shapes: [['path', { d: 'M70 16 L60 10 L60 24 Z M70 16 L80 10 L80 24 Z', fill: '#ff6fa8', ...s({ 'stroke-width': 2.5 }) }], ['circle', { cx: 70, cy: 17, r: 3.5, fill: '#ff6fa8', ...s({ 'stroke-width': 2 }) }]],
  },
  {
    id: 'crown', name: 'корона', unlock: 'q1000',
    shapes: [['path', { d: 'M32 24 L34 6 L42 16 L50 4 L58 16 L66 6 L68 24 Z', fill: '#f9c74f', ...s({ 'stroke-width': 2.5 }) }], ['circle', { cx: 50, cy: 17, r: 2.5, fill: '#e63946' }]],
  },
];

export const DEFAULT_AVATAR = 'raccoon';

export const isUnlocked = (item, badges) => !item.unlock || Boolean(badges[item.unlock]);

/**
 * Кто компаньон: свой персонаж (settings.companionId), если он есть и открыт; иначе — как аватарка ребёнка
 * (вместе с её аксессуаром). Пустой companionId — «как моя аватарка».
 */
export function resolveCompanion(settings, badges) {
  const own = AVATARS.find((a) => a.id === settings.companionId && isUnlocked(a, badges));
  if (own) return { avatar: own, accessory: null, sameAsAvatar: false };
  const me = resolveAvatar(settings, badges);
  return { avatar: me.avatar, accessory: me.accessory, sameAsAvatar: true };
}

/** Что показать: выбранное, если оно есть и открыто; иначе — енот без аксессуара. */
export function resolveAvatar(settings, badges) {
  const avatar = AVATARS.find((a) => a.id === settings.avatar && isUnlocked(a, badges)) || AVATARS.find((a) => a.id === DEFAULT_AVATAR);
  const accessory = ACCESSORIES.find((x) => x.id === settings.accessory && isUnlocked(x, badges)) || null;
  return { avatar, accessory, chosen: avatar.id === settings.avatar };
}
