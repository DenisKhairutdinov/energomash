const ITEM_SELECTOR = '.home-faq__item';
const QUESTION_SELECTOR = '.home-faq__question';
const OPEN_CLASS = 'is-open';
// Чуть больше $faq-time в стилях: после этого времени закрытая строка теряет атрибут open
const CLOSE_DELAY = 440;

/**
 * Вопросы и ответы на главной: плавное раскрытие и закрытие строк, одновременно открыт один ответ.
 * Стили держат состояние по классу is-open, а атрибут open (он нужен семантике details и клавиатуре) снимается
 * только по окончании анимации закрытия.
 */
export const initHomeFaq = (): void => {
  const items = [...document.querySelectorAll<HTMLDetailsElement>(ITEM_SELECTOR)];

  if (items.length === 0) {
    return;
  }

  const close = (item: HTMLDetailsElement): void => {
    item.classList.remove(OPEN_CLASS);
    setTimeout(() => {
      if (!item.classList.contains(OPEN_CLASS)) {
        item.open = false;
      }
    }, CLOSE_DELAY);
  };

  const open = (item: HTMLDetailsElement): void => {
    item.open = true;

    // Принудительный пересчёт стилей: закрытое состояние учитывается без ожидания кадра, и переход от 0fr к 1fr
    // стартует в том же кадре, что закрытие соседней строки. Иначе между ними высота на пару кадров рассинхронизировалась,
    // и остальные строки дёргались
    void item.offsetHeight;
    item.classList.add(OPEN_CLASS);
  };

  for (const item of items) {
    item.querySelector<HTMLElement>(QUESTION_SELECTOR)?.addEventListener('click', (event) => {
      event.preventDefault();

      if (item.classList.contains(OPEN_CLASS)) {
        close(item);

        return;
      }

      for (const other of items) {
        if (other !== item && other.classList.contains(OPEN_CLASS)) {
          close(other);
        }
      }

      open(item);
    });
  }
};
