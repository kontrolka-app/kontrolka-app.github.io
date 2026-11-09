// Поля ответа для «Выбери все верные», «Соедини пары», «Расставь по порядку».
// Всё нажатиями (без перетаскивания) — чтобы было удобно на телефоне.
import { h, icon } from '../ui.js';
import { displayOrder, itemMarks } from '../tasktypes.js';

/**
 * given — ответ (если уже дан), locked — ответ принят, showResult — показать разбор (режим «С подсказками»).
 * Возвращает { control, read }.
 */
export function taskTypeControl(q, given, locked, showResult) {
  if (q.type === 'multi-choice') return multiControl(q, given, locked, showResult);
  if (q.type === 'match') return matchControl(q, given, locked, showResult);
  return orderControl(q, given, locked, showResult);
}

/** Подсказка об ошибке («Соедини все пары.») исчезает, как только ребёнок продолжил отвечать. */
const clearError = () => {
  const box = document.getElementById('answer-error');
  if (box) box.textContent = '';
};

const mark = (ok, text) => h('span', { class: 'option__mark' }, icon(ok ? 'check' : 'cross', { size: 18 }), h('span', {}, text));

function multiControl(q, given, locked, showResult) {
  const chosen = new Set(Array.isArray(given) ? given : []);
  const right = new Set(q.correctAnswers);
  const group = h(
    'fieldset',
    { class: 'options options--multi', 'aria-describedby': 'answer-error' },
    h('legend', { class: 'field__hint' }, 'Можно отметить несколько вариантов.'),
    q.options.map((o) => {
      let state = '';
      let m = null;
      if (showResult) {
        if (right.has(o.id)) [state, m] = [' is-correct', mark(true, chosen.has(o.id) ? 'верно отмечено' : 'нужно было отметить')];
        else if (chosen.has(o.id)) [state, m] = [' is-wrong', mark(false, 'лишний')];
      } else if (locked && chosen.has(o.id)) state = ' is-chosen';
      return h(
        'label',
        { class: `option option--multi${state}` },
        h('input', { type: 'checkbox', name: 'answer', value: o.id, checked: chosen.has(o.id), disabled: locked }),
        h('span', { class: 'option__key option__key--box', 'aria-hidden': 'true' }, icon('check', { size: 18 })),
        h('span', { class: 'option__text' }, o.text),
        m,
      );
    }),
  );
  return { control: group, read: () => [...group.querySelectorAll('input:checked')].map((i) => i.value) };
}

function matchControl(q, given, locked, showResult) {
  const n = q.pairs.length;
  const rightOrder = displayOrder(q.id, n);
  // links[i] = номер пары, чей правый ответ соединён с левым i (или null).
  const links = Array.isArray(given) && given.length === n ? given.slice() : Array(n).fill(null);

  if (locked) {
    const marks = itemMarks(q, links);
    return {
      control: h(
        'ul',
        { class: 'match-result' },
        q.pairs.map((p, i) =>
          h(
            'li',
            { class: `match-result__row${showResult ? (marks[i] ? ' is-correct' : ' is-wrong') : ''}` },
            h('span', { class: 'match-result__left' }, p.left),
            h('span', { class: 'match-result__dash', 'aria-hidden': 'true' }, '—'),
            h('span', { class: 'match-result__right' }, q.pairs[links[i]]?.right ?? '?', showResult && !marks[i] ? h('span', { class: 'match-result__fix' }, `надо: ${p.right}`) : null),
            showResult ? h('span', { class: 'match-result__icon' }, icon(marks[i] ? 'check' : 'cross', { size: 18, label: marks[i] ? 'верно' : 'неверно' })) : null,
          ),
        ),
      ),
      read: () => given,
    };
  }

  let pickedLeft = null;
  let pickedRight = null;
  const box = h('div', { class: 'match', 'aria-describedby': 'answer-error' });
  const status = h('p', { class: 'sr-only', 'aria-live': 'polite' });

  const render = (focus) => {
    box.textContent = '';
    const leftCol = h('div', { class: 'match__col' });
    const rightCol = h('div', { class: 'match__col' });
    q.pairs.forEach((p, i) => {
      const num = links[i] === null ? null : i + 1;
      leftCol.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: `match__item${num ? ` is-linked c${num}` : ''}${pickedLeft === i ? ' is-picked' : ''}`,
            'data-side': 'l',
            'data-i': String(i),
            'aria-pressed': String(pickedLeft === i),
            'aria-label': `${p.left}${num ? `, соединено с «${q.pairs[links[i]].right}»` : ''}`,
            onclick: () => pick('l', i),
          },
          num ? h('span', { class: 'match__num', 'aria-hidden': 'true' }, String(num)) : null,
          h('span', {}, p.left),
        ),
      );
    });
    rightOrder.forEach((j) => {
      const owner = links.indexOf(j);
      const num = owner === -1 ? null : owner + 1;
      rightCol.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: `match__item match__item--right${num ? ` is-linked c${num}` : ''}${pickedRight === j ? ' is-picked' : ''}`,
            'data-side': 'r',
            'data-i': String(j),
            'aria-pressed': String(pickedRight === j),
            'aria-label': `${q.pairs[j].right}${num ? `, соединено с «${q.pairs[owner].left}»` : ''}`,
            onclick: () => pick('r', j),
          },
          num ? h('span', { class: 'match__num', 'aria-hidden': 'true' }, String(num)) : null,
          h('span', {}, q.pairs[j].right),
        ),
      );
    });
    box.append(leftCol, rightCol);
    if (focus) box.querySelector(`[data-side="${focus[0]}"][data-i="${focus[1]}"]`)?.focus({ preventScroll: true });
  };

  function pick(side, i) {
    clearError();
    if (side === 'l') {
      if (links[i] !== null) {
        status.textContent = `Пара «${q.pairs[i].left}» разъединена.`;
        links[i] = null;
        pickedLeft = null;
      } else pickedLeft = pickedLeft === i ? null : i;
    } else {
      const owner = links.indexOf(i);
      if (owner !== -1) {
        status.textContent = `Пара «${q.pairs[owner].left}» разъединена.`;
        links[owner] = null;
        pickedRight = null;
      } else pickedRight = pickedRight === i ? null : i;
    }
    if (pickedLeft !== null && pickedRight !== null) {
      links[pickedLeft] = pickedRight;
      status.textContent = `Соединено: ${q.pairs[pickedLeft].left} — ${q.pairs[pickedRight].right}.`;
      pickedLeft = null;
      pickedRight = null;
    }
    render([side, i]);
  }

  render();
  return {
    control: h('div', {}, h('p', { class: 'field__hint' }, 'Нажми слово слева, потом подходящее справа. Нажмёшь на пару ещё раз — она разъединится.'), box, status),
    read: () => links.slice(),
  };
}

function orderControl(q, given, locked, showResult) {
  const n = q.items.length;
  const shown = displayOrder(q.id, n);
  // seq — номера пунктов в том порядке, как их нажали.
  const seq = Array.isArray(given) ? given.slice() : [];

  if (locked) {
    const marks = itemMarks(q, seq);
    return {
      control: h(
        'ol',
        { class: 'order-result' },
        seq.map((k, pos) =>
          h(
            'li',
            { class: `order-result__row${showResult ? (marks[pos] ? ' is-correct' : ' is-wrong') : ''}` },
            h('span', { class: 'order__num', 'aria-hidden': 'true' }, String(pos + 1)),
            h('span', { class: 'order-result__text' }, q.items[k]),
            showResult ? h('span', { class: 'match-result__icon' }, icon(marks[pos] ? 'check' : 'cross', { size: 18, label: marks[pos] ? 'на своём месте' : 'не на своём месте' })) : null,
          ),
        ),
      ),
      read: () => given,
    };
  }

  const list = h('div', { class: 'order', 'aria-describedby': 'answer-error' });
  const status = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const render = (focusK) => {
    list.textContent = '';
    for (const k of shown) {
      const pos = seq.indexOf(k);
      list.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: `order__item${pos === -1 ? '' : ' is-set'}`,
            'data-k': String(k),
            'aria-label': `${q.items[k]}${pos === -1 ? '' : `, номер ${pos + 1}`}`,
            onclick: () => {
              clearError();
              const at = seq.indexOf(k);
              if (at === -1) {
                seq.push(k);
                status.textContent = `${q.items[k]} — номер ${seq.length}.`;
              } else {
                seq.splice(at, 1);
                status.textContent = `Номер снят с пункта «${q.items[k]}».`;
              }
              render(k);
            },
          },
          h('span', { class: 'order__num', 'aria-hidden': 'true' }, pos === -1 ? '' : String(pos + 1)),
          h('span', { class: 'order__text' }, q.items[k]),
        ),
      );
    }
    if (focusK !== undefined) list.querySelector(`[data-k="${focusK}"]`)?.focus({ preventScroll: true });
  };
  const reset = h('button', { type: 'button', class: 'btn btn--ghost order__reset', onclick: () => ((seq.length = 0), (status.textContent = 'Все номера сняты.'), render()) }, 'Сначала');
  render();
  return {
    control: h('div', {}, h('p', { class: 'field__hint' }, 'Нажимай пункты по порядку: первый, второй, третий… Нажмёшь ещё раз — номер снимется.'), list, reset, status),
    read: () => seq.slice(),
  };
}
