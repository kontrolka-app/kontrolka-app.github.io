// Поле ответа для «Найди ошибки в тексте»: нажимаешь на слова, вписываешь, как правильно.
import { h } from '../ui.js';
import { parseErrorText, gradeFindErrors } from '../finderrors.js';

/**
 * given — { marked, fixes } (если ответ уже дан); answered — ответ принят;
 * showResult — показать разбор (режим «С подсказками»).
 */
export function findErrorsControl(q, given, answered, showResult) {
  const tokens = parseErrorText(q.text);
  const marked = new Map((given?.marked || []).map((i, k) => [i, given.fixes?.[k] ?? '']));

  if (answered && showResult) return { control: resultView(q, tokens, given), read: () => given };

  const fixesBox = h('div', { class: 'fe-fixes', 'aria-live': 'polite' });
  const renderFixes = () => {
    // Сохраняем уже вписанное при перерисовке.
    fixesBox.querySelectorAll('input[data-i]').forEach((inp) => marked.set(Number(inp.dataset.i), inp.value));
    fixesBox.textContent = '';
    const list = [...marked.keys()].sort((a, b) => a - b);
    if (!list.length) {
      fixesBox.appendChild(h('p', { class: 'small muted' }, 'Нажми на слово с ошибкой — здесь появится поле, чтобы написать его правильно. Нажмёшь ещё раз — отметка снимется.'));
      return;
    }
    fixesBox.appendChild(h('p', { class: 'field__label' }, 'Как правильно?'));
    for (const i of list) {
      const id = `fe-fix-${i}`;
      fixesBox.appendChild(
        h(
          'div',
          { class: 'fe-fix' },
          h('label', { for: id, class: 'fe-fix__word' }, `${tokens[i].word} →`),
          h('input', { class: 'input', id, 'data-i': String(i), value: marked.get(i), autocomplete: 'off', autocapitalize: 'off', spellcheck: false, disabled: answered }),
        ),
      );
    }
  };

  const textBox = h(
    'p',
    { class: 'fe-text' },
    tokens.map((t, i) => [
      t.before,
      h(
        'button',
        {
          type: 'button',
          class: 'fe-word',
          'aria-pressed': String(marked.has(i)),
          disabled: answered,
          onclick: (e) => {
            const btn = e.currentTarget;
            if (marked.has(i)) marked.delete(i);
            else marked.set(i, '');
            btn.setAttribute('aria-pressed', String(marked.has(i)));
            renderFixes();
            if (marked.has(i)) fixesBox.querySelector(`#fe-fix-${i}`)?.focus({ preventScroll: true });
          },
        },
        t.word,
      ),
      t.after,
      ' ',
    ]),
  );
  renderFixes();
  return {
    control: h('div', { class: 'fe' }, textBox, fixesBox),
    read: () => {
      fixesBox.querySelectorAll('input[data-i]').forEach((inp) => marked.set(Number(inp.dataset.i), inp.value));
      const list = [...marked.keys()].sort((a, b) => a - b);
      return { marked: list, fixes: list.map((i) => marked.get(i)) };
    },
  };
}

/** Разбор после ответа: весь текст с правильным написанием, разные отметки, правило у каждой ошибки. */
function resultView(q, tokens, given) {
  const g = gradeFindErrors(q, given);
  const missed = new Set(g.missed);
  const extra = new Set(g.extra);
  const wrongFix = new Set(g.wrongFix);
  const text = h(
    'p',
    { class: 'fe-text fe-text--result' },
    tokens.map((t, i) => {
      let cls = '';
      let title = '';
      if (t.error && missed.has(i)) [cls, title] = ['fe-r--missed', 'пропущенная ошибка'];
      else if (t.error && wrongFix.has(i)) [cls, title] = ['fe-r--wrongfix', `найдено, но исправлено неверно: «${g.fixByIndex.get(i)}»`];
      else if (t.error) [cls, title] = ['fe-r--found', 'найдено и исправлено'];
      else if (extra.has(i)) [cls, title] = ['fe-r--extra', 'здесь ошибки не было'];
      return [t.before, cls ? h('mark', { class: `fe-r ${cls}`, title }, t.error ? t.error.correct : t.word, h('span', { class: 'sr-only' }, ` (${title})`)) : t.word, t.after, ' '];
    }),
  );
  const rules = h(
    'ul',
    { class: 'fe-rules' },
    tokens
      .map((t, i) => [t, i])
      .filter(([t]) => t.error)
      .map(([t, i]) =>
        h(
          'li',
          { class: missed.has(i) ? 'fe-rule--missed' : wrongFix.has(i) ? 'fe-rule--wrongfix' : 'fe-rule--found' },
          h('strong', {}, `${t.error.shown} → ${t.error.correct}`),
          wrongFix.has(i) ? h('span', { class: 'small' }, ` (твой вариант: «${g.fixByIndex.get(i)}»)`) : null,
          h('br'),
          h('span', { class: 'small' }, t.error.rule),
        ),
      ),
  );
  return h(
      'div',
      { class: 'fe' },
      h('p', { class: 'fe-summary' }, `Нашёл ${g.found} из ${g.total}, исправил верно ${g.fixedRight}${g.extra.length ? `, лишних отметок: ${g.extra.length}` : ''}.`),
      text,
      h(
        'p',
        { class: 'fe-legend small' },
        h('mark', { class: 'fe-r fe-r--found' }, 'найдено'),
        ' ',
        h('mark', { class: 'fe-r fe-r--wrongfix' }, 'исправлено неверно'),
        ' ',
        h('mark', { class: 'fe-r fe-r--missed' }, 'пропущено'),
        ' ',
        h('mark', { class: 'fe-r fe-r--extra' }, 'лишняя отметка'),
      ),
      rules,
    );
}
