// Компаньон на экране: свой выбранный персонаж (или аватарка ребёнка) с облачком текста.
// В углу экрана (сворачивается сам) или строкой под заданием в тренировке — чтобы ничего не закрывать.
import { h } from '../ui.js';
import { getData, update } from '../state.js';
import { avatarSvg } from '../components.js';
import { resolveCompanion } from '../avatars.js';
import { pickPhrase } from '../companion.js';

const COLLAPSE_MS = 7000;
let collapseTimer = null;

/** Говорит фразу на событие. inline — вернуть элемент для вставки (тренировка); иначе — в углу экрана. */
export function companionSay(event, { inline = false } = {}) {
  const d = getData();
  if (!d.settings.companion || !event) return null;
  const phrase = pickPhrase(event, { last: d.companion.lastPhrase, name: d.settings.nickname, goal: d.settings.dailyGoal });
  if (!phrase) return null;
  update((x) => ((x.companion.lastPhrase = phrase.key), x));
  const me = resolveCompanion(d.settings, d.badges);
  if (inline) {
    return h('div', { class: `companion-inline companion--${phrase.mood}`, role: 'status' }, avatarSvg(me.avatar, me.accessory, { size: 40 }), h('p', { class: 'companion__bubble' }, phrase.text));
  }
  showCorner(me, phrase);
  return null;
}

function showCorner(me, phrase) {
  document.getElementById('companion')?.remove();
  clearTimeout(collapseTimer);
  const bubble = h(
    'div',
    { class: 'companion__bubble', role: 'status' },
    h('p', {}, phrase.text),
    h('button', { type: 'button', class: 'companion__close', 'aria-label': 'Свернуть', onclick: () => collapse(true) }, '×'),
  );
  const toggle = h(
    'button',
    { type: 'button', class: 'companion__avatar', 'aria-label': `${me.avatar.name}: показать, что он сказал`, 'aria-expanded': 'true', onclick: () => (box.classList.contains('is-collapsed') ? expand() : collapse(true)) },
    avatarSvg(me.avatar, me.accessory, { size: 52 }),
  );
  const box = h('aside', { id: 'companion', class: `companion companion--${phrase.mood}`, 'aria-label': 'Компаньон' }, bubble, toggle);
  const collapse = () => {
    box.classList.add('is-collapsed');
    toggle.setAttribute('aria-expanded', 'false');
  };
  const expand = () => {
    box.classList.remove('is-collapsed');
    toggle.setAttribute('aria-expanded', 'true');
  };
  document.body.appendChild(box);
  collapseTimer = setTimeout(collapse, COLLAPSE_MS);
}

/** Убрать компаньона (например, если его выключили в настройках). */
export function companionHide() {
  document.getElementById('companion')?.remove();
}
