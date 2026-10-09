const ROOT_SELECTOR = '[data-error]';
const RELOAD_SELECTOR = '[data-reload]';

/**
 * Страницы ошибок: кнопка «Обновить страницу» (data-reload) перезагружает текущую страницу.
 * Для ошибки 500 и 503 это то, что человек пытался бы сделать сам.
 */
export const initErrorPage = (): void => {
  const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);

  if (!root) {
    return;
  }

  for (const button of root.querySelectorAll<HTMLElement>(RELOAD_SELECTOR)) {
    button.addEventListener('click', () => location.reload());
  }
};
