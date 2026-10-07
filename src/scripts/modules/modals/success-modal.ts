import { pubSub } from '../global/pubsub.ts';
import { createModal } from './dialog.ts';

const MODAL_SELECTOR = '[data-success-modal]';
const PANEL_SELECTOR = '[data-modal-panel]';
const TITLE_SELECTOR = '[data-success-title]';
const TEXT_SELECTOR = '[data-success-text]';
const CLOSE_SELECTOR = '[data-modal-close]';

/**
 * Окно подтверждения: заметно сообщает, что заявка принята. Открывается событием
 * «success-modal: open-request» — его публикуют окно заявки и форма внизу страницы после отправки.
 * Без данных показывает текст из разметки, с данными { title, text } — свой.
 * Закрывается событием «success-modal: close» (его же публикуют Esc, крестик и кнопка).
 */
export const initSuccessModal = (): void => {
  const dialog = document.querySelector<HTMLDialogElement>(MODAL_SELECTOR);
  const panel = dialog?.querySelector<HTMLElement>(PANEL_SELECTOR);
  const title = dialog?.querySelector<HTMLElement>(TITLE_SELECTOR);
  const text = dialog?.querySelector<HTMLElement>(TEXT_SELECTOR);
  const closeButton = dialog?.querySelector<HTMLElement>(CLOSE_SELECTOR);

  if (!dialog || !panel || !title || !text) {
    return;
  }

  // Тексты по умолчанию запоминаем, чтобы свой текст одного вызова не остался в следующем
  const defaultTitle = title.textContent?.trim() ?? '';
  const defaultText = text.textContent?.trim() ?? '';
  const modal = createModal(dialog, panel, { closeEvent: 'success-modal: close' });

  pubSub.subscribe('success-modal: open-request', (payload) => {
    if (modal.isOpen()) {
      return;
    }

    title.textContent = payload?.title ?? defaultTitle;
    text.textContent = payload?.text ?? defaultText;
    modal.open();
    closeButton?.focus({ preventScroll: true });
  });

  pubSub.subscribe('success-modal: close', modal.close);
};
