import { pubSub } from '../global/pubsub.ts';
import { bindForm, clearFormErrors } from './form.ts';

const FORM_SELECTOR = '[data-request-form]';

/**
 * Форма заявки внизу страницы. Проверка полей общая с окном заявки (form.ts); после неё форма
 * публикует «request-form: submit» с полями, очищается и просит показать окно подтверждения
 * («success-modal: open-request»). Отправка на сервер подключится отдельным подписчиком
 * на «request-form: submit».
 */
export const initRequestForm = (): void => {
  const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);

  if (!form) {
    return;
  }

  bindForm(form, (data) => {
    pubSub.publish('request-form: submit', data);
  });

  pubSub.subscribe('request-form: submit', () => {
    form.reset();
    clearFormErrors(form);
    pubSub.publish('success-modal: open-request');
  });
};
