import { bindForm, clearFormErrors } from '../forms/form.ts';
import { pubSub, type RequestKind, type RequestModalPayload } from '../global/pubsub.ts';
import { createModal } from './dialog.ts';

const MODAL_SELECTOR = '[data-request-modal]';
const PANEL_SELECTOR = '[data-modal-panel]';
const OPEN_SELECTOR = '[data-modal-open="request"]';
const FORM_SELECTOR = '[data-modal-form]';
const LABEL_SELECTOR = '[data-modal-label]';
const TITLE_SELECTOR = '[data-modal-title]';
const DESCRIPTION_SELECTOR = '[data-modal-description]';
const MODEL_ROW_SELECTOR = '[data-modal-model-row]';
const MODEL_NAME_SELECTOR = '[data-modal-model]';

const KINDS: Record<RequestKind, { label: string; title: string; description: string }> = {
  price: {
    label: 'Заявка на расчёт',
    title: 'Узнать стоимость',
    description:
      'Оставьте контакты — рассчитаем стоимость, подберём комплектацию и пришлём коммерческое предложение.',
  },
  call: {
    label: 'Обратный звонок',
    title: 'Заказать звонок',
    description:
      'Перезвоним в рабочее время и ответим на вопросы по технике, срокам производства и поставки.',
  },
  contact: {
    label: 'Связаться с нами',
    title: 'Напишите нам',
    description:
      'Расскажите, что вас интересует: подберём технику, ответим по срокам, лизингу и условиям поставки.',
  },
};

// Значение data-modal-kind на кнопке → вид окна; всё незнакомое открывает расчёт стоимости
const isRequestKind = (value: string | undefined): value is RequestKind =>
  value !== undefined && Object.hasOwn(KINDS, value);

/**
 * Окно заявки. Всё общение с ним идёт через pubSub:
 *  - «request-modal: open-request» { kind, model } — открыть окно;
 *  - «request-modal: close» — закрыть;
 *  - «request-modal: submit» (поля формы) — публикуется после проверки (form.ts); окно закрывается,
 *    а после закрытия открывается окно подтверждения («success-modal: open-request»).
 * Кнопки на странице с data-modal-open="request" только публикуют открытие и ничего не знают об окне.
 * Отправка на сервер подключится отдельным подписчиком на «request-modal: submit».
 */
export const initRequestModal = (): void => {
  const dialog = document.querySelector<HTMLDialogElement>(MODAL_SELECTOR);
  const panel = dialog?.querySelector<HTMLElement>(PANEL_SELECTOR);
  const form = dialog?.querySelector<HTMLFormElement>(FORM_SELECTOR);

  if (!dialog || !panel || !form) {
    return;
  }

  const label = dialog.querySelector<HTMLElement>(LABEL_SELECTOR);
  const title = dialog.querySelector<HTMLElement>(TITLE_SELECTOR);
  const description = dialog.querySelector<HTMLElement>(DESCRIPTION_SELECTOR);
  const modelRow = dialog.querySelector<HTMLElement>(MODEL_ROW_SELECTOR);
  const modelName = dialog.querySelector<HTMLElement>(MODEL_NAME_SELECTOR);
  const kindInput = form.querySelector<HTMLInputElement>('[name="kind"]');
  const modelInput = form.querySelector<HTMLInputElement>('[name="model"]');
  const nameInput = form.querySelector<HTMLInputElement>('[name="name"]');

  // Заявка отправлена, окно закрывается: когда закроется, покажем подтверждение
  let isSubmitted = false;

  const modal = createModal(dialog, panel, {
    closeEvent: 'request-modal: close',
    onClosed: () => {
      if (!isSubmitted) {
        return;
      }

      isSubmitted = false;
      pubSub.publish('success-modal: open-request');
    },
  });

  const setText = (element: HTMLElement | null, text: string): void => {
    if (element) {
      element.textContent = text;
    }
  };

  // Тексты окна и показ модели зависят от того, что человек хочет узнать
  const applyKind = (kind: RequestKind, model = ''): void => {
    const texts = KINDS[kind];

    setText(label, texts.label);
    setText(title, texts.title);
    setText(description, texts.description);
    setText(modelName, model);

    if (modelRow) {
      modelRow.hidden = kind !== 'price' || model === '';
    }

    if (kindInput) {
      kindInput.value = kind;
    }

    if (modelInput) {
      modelInput.value = model;
    }
  };

  const open = (payload?: RequestModalPayload): void => {
    if (modal.isOpen()) {
      return;
    }

    isSubmitted = false;
    form.reset();
    clearFormErrors(form);
    applyKind(payload?.kind ?? 'price', payload?.model);
    modal.open();
    nameInput?.focus({ preventScroll: true });
  };

  // Маска телефона, обязательность и ошибки — общие с формой внизу страницы (forms/form.ts)
  bindForm(form, (data) => {
    pubSub.publish('request-modal: submit', data);
  });

  pubSub.subscribe('request-modal: open-request', open);
  pubSub.subscribe('request-modal: close', modal.close);
  pubSub.subscribe('request-modal: submit', () => {
    isSubmitted = true;
    modal.close();
  });

  // Кнопки страницы только сообщают, что окно нужно открыть и с чем
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const trigger = target?.closest<HTMLElement>(OPEN_SELECTOR);

    if (!trigger) {
      return;
    }

    event.preventDefault();
    pubSub.publish('request-modal: open-request', {
      kind: isRequestKind(trigger.dataset.modalKind) ? trigger.dataset.modalKind : 'price',
      model: trigger.dataset.modalModel,
    });
  });
};
