// «Нашёл ошибку?» под вопросом: короткая форма и копирование сообщения автору.
import { h, icon, copyText, toast } from '../ui.js';
import { content, getData, settings, update } from '../state.js';
import { buildReport, reportRecord, isReported, REPORT_KINDS, REPORT_COMMENT_MAX, REPORTS_LIMIT } from '../reports.js';

/**
 * Кнопка «Нашёл ошибку?» или пометка «Ты уже сообщил об ошибке».
 * item: { questionId, topicId, question, given, correct } — тексты ответов уже для показа.
 */
export function reportControl(item) {
  const slot = h('div', { class: 'report' });
  const paint = () => {
    slot.textContent = '';
    if (isReported(getData().reports, item.questionId)) {
      slot.appendChild(h('p', { class: 'small muted report__done' }, icon('check', { size: 16 }), h('span', {}, 'Ты уже сообщил об ошибке в этом задании')));
    } else {
      slot.appendChild(h('button', { type: 'button', class: 'link-btn small', onclick: () => openReportDialog(item, paint) }, 'Нашёл ошибку?'));
    }
  };
  paint();
  return slot;
}

function openReportDialog(item, onDone) {
  const topic = content.topicById.get(item.topicId);
  const nickname = settings().nickname;
  const dialog = document.createElement('dialog');
  dialog.className = 'dialog report-dialog';
  dialog.setAttribute('aria-labelledby', 'report-title');
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  const kinds = h(
    'fieldset',
    { class: 'field segmented segmented--chips' },
    h('legend', { class: 'field__label' }, 'Что не так?'),
    h(
      'div',
      { class: 'segmented__options' },
      Object.entries(REPORT_KINDS).map(([value, label], i) =>
        h('label', { class: 'segmented__option' }, h('input', { type: 'radio', name: 'report-kind', value, checked: i === 0 }), h('span', {}, label)),
      ),
    ),
  );
  const comment = h('textarea', { class: 'input', id: 'report-comment', maxLength: REPORT_COMMENT_MAX, rows: 3 });
  const sign = nickname ? h('input', { type: 'checkbox', id: 'report-sign' }) : null;
  const send = async () => {
    const kind = kinds.querySelector('input:checked')?.value || 'other';
    const text = buildReport(
      { ...item, subject: content.subjectById.get(topic?.subjectId)?.name, topic: topic?.title },
      { kind, comment: comment.value, nickname: sign?.checked ? nickname : '' },
    );
    const ok = await copyText(text);
    if (!ok) {
      toast('Не удалось скопировать. Попробуй ещё раз.', 'error');
      return;
    }
    update((d) => {
      d.reports = [reportRecord(item.questionId, kind), ...d.reports].slice(0, REPORTS_LIMIT);
      return d;
    });
    close();
    onDone();
    toast('Сообщение скопировано — отправь его автору, например в чате класса. Спасибо!');
  };
  // append (в отличие от h) превращает null в текст «null» — пустые части отбрасываем.
  const parts = [
    h('h2', { class: 'dialog__title', id: 'report-title' }, 'Нашёл ошибку в задании?'),
    h('p', { class: 'dialog__text' }, 'Твой ответ не пересчитается — автор проверит задание и исправит его. Сообщение скопируется, и ты отправишь его сам.'),
    kinds,
    h('div', { class: 'field' }, h('label', { class: 'field__label', for: 'report-comment' }, 'Напиши, как правильно (можно не писать)'), comment),
    sign ? h('label', { class: 'check' }, sign, h('span', {}, `Подписаться: добавить имя «${nickname}»`)) : null,
    h(
      'div',
      { class: 'dialog__actions' },
      h('button', { type: 'button', class: 'btn btn--ghost', onclick: close }, 'Отмена'),
      h('button', { type: 'button', class: 'btn btn--primary', onclick: send }, icon('copy'), h('span', {}, 'Скопировать сообщение')),
    ),
  ];
  dialog.append(...parts.filter(Boolean));
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  document.body.appendChild(dialog);
  dialog.showModal();
  kinds.querySelector('input').focus();
}
