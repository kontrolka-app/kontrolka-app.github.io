// Аватарки: персонажи и наряды как данные. Без DOM.
// Картинки — assets/avatars/<персонаж>-<вид>.webp (256×256, нарисованы в ChatGPT, нарезаны и сжаты нами).
// У каждого персонажа 7 видов: три настроения без наряда (normal, happy, think) и четыре наряда со спокойным лицом.
// Часть персонажей и нарядов открывается значками. Рисует их avatarPic() в components.js.

/** Персонажи: bg — цвет кружка под картинкой. */
export const AVATARS = [
  { id: 'raccoon', name: 'Енот Профессор', bg: '#E3E9FF' },
  { id: 'cactus', name: 'Кактус-отличник', bg: '#DDF3E6' },
  { id: 'cat', name: 'Сонный Кот', bg: '#FFF0C7' },
  { id: 'dino', name: 'Динозаврик Рюкзачок', bg: '#DDF3E6' },
  { id: 'penguin', name: 'Пингвин Пушок', bg: '#E3E9FF' },
  { id: 'hedgehog', name: 'Ёжик Колючкин', bg: '#FFF0C7' },
  { id: 'fox', name: 'Лисёнок Рыжик', bg: '#FDE3DA' },
  { id: 'lamb', name: 'Барашек Карандашик', bg: '#E3E9FF' },
  { id: 'notebook', name: 'Тетрадь в кружок', bg: '#FFF0C7' },
  { id: 'ruler', name: 'Линейка Ботаник', bg: '#DDF3E6' },
  { id: 'owl', name: 'Сова Умница', bg: '#EEE7FB', unlock: 'expert' },
  { id: 'robot', name: 'Робот Счётик', bg: '#E3E9FF', unlock: 'q500' },
  { id: 'frog', name: 'Лягушонок Квак', bg: '#DDF3E6', unlock: 'traveler' },
];

/** Наряды: у каждого персонажа своя картинка в этом наряде. */
export const ACCESSORIES = [
  { id: 'scarf', name: 'шарф', unlock: 'week' },
  { id: 'hat', name: 'шапка', unlock: 'month' },
  { id: 'bow', name: 'бантик', unlock: 'perfect' },
  { id: 'crown', name: 'корона', unlock: 'q1000' },
];

/** Настроения компаньона, для которых есть своя картинка (без наряда). */
export const MOODS = ['normal', 'happy', 'think'];

/**
 * Какая картинка нужна: в наряде — картинка наряда (лицо спокойное), без наряда — по настроению.
 * Возвращает путь от корня сайта.
 */
export function avatarImage(avatar, accessory, mood) {
  const view = accessory ? accessory.id : MOODS.includes(mood) ? mood : 'normal';
  return `assets/avatars/${avatar.id}-${view}.webp`;
}

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
