// Альбом наклеек: страницы по 12 мест, открытые наклейки можно рассмотреть крупно.
import { h, pageHeader, linkButton } from '../ui.js';
import { href } from '../router.js';
import { getData, update } from '../state.js';
import { formatDate } from '../utils.js';
import { PAGES, STICKERS, ownedCount, albumComplete, markSeen } from '../stickers.js';

const PAGE_BY_ID = new Map(PAGES.map((p) => [p.id, p]));
export const stickerName = (s) => s.title || `Наклейка № ${s.n}`;

/** Картинка наклейки. Пока настоящей нет — кружок цвета страницы со значком и номером. */
export function stickerArt(s, { big = false } = {}) {
  const page = PAGE_BY_ID.get(s.page);
  const cls = `sticker-art${big ? ' sticker-art--big' : ''}`;
  if (s.img) return h('img', { class: cls, src: `assets/stickers/${s.id}.webp`, alt: '', width: 384, height: 384, loading: 'lazy', decoding: 'async' });
  return h('span', { class: `${cls} sticker-art--temp`, style: { background: page.color }, 'aria-hidden': 'true' }, h('span', { class: 'sticker-art__emoji' }, page.emoji), h('span', { class: 'sticker-art__n' }, String(s.n)));
}

/** Наклейка крупно: картинка, название, надпись и когда получена. */
function showSticker(s, at) {
  const dialog = h(
    'dialog',
    { class: 'dialog sticker-dialog', 'aria-labelledby': 'sticker-title' },
    stickerArt(s, { big: true }),
    h('h2', { class: 'dialog__title', id: 'sticker-title' }, stickerName(s)),
    s.text ? h('p', { class: 'sticker-dialog__text' }, s.text) : null,
    h('p', { class: 'small muted' }, `${PAGE_BY_ID.get(s.page).title} · получена ${formatDate(at)}`),
    h('div', { class: 'dialog__actions' }, h('button', { class: 'btn btn--primary', type: 'button', onclick: () => dialog.close() }, 'Закрыть')),
  );
  dialog.addEventListener('close', () => dialog.remove());
  // Нажатие мимо наклейки тоже закрывает.
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  document.body.appendChild(dialog);
  dialog.showModal();
}

/** Ряд наклеек для экрана результата и главной: только картинки с названиями. */
export function stickerRow(list) {
  return h('ul', { class: 'sticker-row' }, list.map((s) => h('li', { class: 'sticker-row__item' }, stickerArt(s), h('span', { class: 'small' }, stickerName(s)))));
}

/** Ссылка на альбом для главной и раздела «Я»: сколько собрано и есть ли новые. */
export function albumLink() {
  const state = getData().stickers;
  return h(
    'a',
    { class: 'album-link', href: href('album') },
    h('span', { class: 'album-link__emoji', 'aria-hidden': 'true' }, '📒'),
    h('span', { class: 'album-link__text' }, h('strong', {}, 'Альбом наклеек'), h('span', { class: 'small muted' }, `Собрано ${ownedCount(state)} из ${STICKERS.length}`)),
    state.fresh.length ? h('span', { class: 'album-new' }, `новых: ${state.fresh.length}`) : null,
  );
}

export function albumScreen(pageId) {
  const state = getData().stickers;
  const page = PAGE_BY_ID.get(pageId) || PAGES.find((p) => STICKERS.some((s) => s.page === p.id && state.fresh.includes(s.id))) || PAGES[0];
  const fresh = new Set(state.fresh);
  const total = STICKERS.length;
  const got = ownedCount(state);
  const onPage = (p) => STICKERS.filter((s) => s.page === p.id);
  const gotOnPage = (p) => onPage(p).filter((s) => state.owned[s.id]).length;

  const root = h(
    'div',
    { class: 'stack' },
    pageHeader('Альбом наклеек', { back: href('settings'), subtitle: `Собрано ${got} из ${total}` }),
    albumComplete(state)
      ? h('p', { class: 'card album-done' }, '🎉 Альбом собран! Все наклейки твои.')
      : h('p', { class: 'card album-how' }, 'Наклейку дают за выполненную цель дня и за тему, которую ты впервые прошёл на 80% и выше (от 5 вопросов). Какая попадётся — сюрприз, повторов не бывает.'),
    h(
      'nav',
      { class: 'album-tabs', 'aria-label': 'Страницы альбома' },
      PAGES.map((p) => {
        const hasNew = onPage(p).some((s) => fresh.has(s.id));
        return h(
          'a',
          { class: 'album-tab', href: href('album', p.id), 'aria-current': p.id === page.id ? 'page' : null },
          h('span', { class: 'album-tab__emoji', 'aria-hidden': 'true' }, p.emoji),
          h('span', { class: 'album-tab__title' }, p.title),
          h('span', { class: 'small muted' }, `${gotOnPage(p)} из ${onPage(p).length}`),
          hasNew ? h('span', { class: 'album-new' }, 'новые') : null,
        );
      }),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { class: 'card__title' }, `${page.emoji} ${page.title}`),
      h(
        'ul',
        { class: 'album-grid' },
        onPage(page).map((s) => {
          const at = state.owned[s.id];
          if (!at) return h('li', { class: 'album-slot album-slot--empty' }, h('span', { class: 'album-slot__n', 'aria-hidden': 'true' }, String(s.n)), h('span', { class: 'sr-only' }, `Место ${s.n}: наклейки пока нет`));
          return h(
            'li',
            { class: 'album-slot' },
            h(
              'button',
              { type: 'button', class: 'album-sticker', onclick: () => showSticker(s, at) },
              stickerArt(s),
              h('span', { class: 'album-sticker__title' }, stickerName(s)),
              fresh.has(s.id) ? h('span', { class: 'album-new' }, 'новая') : null,
            ),
          );
        }),
      ),
    ),
    got ? null : h('div', {}, linkButton(href('subjects'), 'К темам — за первой наклейкой', { iconName: 'arrow' })),
  );

  // Новые наклейки этой страницы показаны — отметку «новая» снимаем (на других страницах она остаётся).
  const seen = markSeen(state, onPage(page).map((s) => s.id));
  if (seen !== state) update((d) => ((d.stickers = seen), d));
  return root;
}
