import { loadCatalog } from './catalog-data.ts';
import { isSearchMatch, parseQuery, searchRank, type Searchable } from './search-match.ts';

const FORM_SELECTOR = '[data-search]';
const INPUT_SELECTOR = '[data-search-input]';
const RESULTS_SELECTOR = '[data-search-results]';

const PRODUCT_URL = '/product.html?id=';
const CATALOG_URL = '/catalog.html?q=';
const SEARCH_PARAMETER = 'q';
const MAX_RESULTS = 8;

interface SearchItem extends Searchable {
  id: string;
  typeLabel: string;
}

// Модели и позиции склада: файл один на страницу (catalog-data.ts), повторно не грузится
const load = async (): Promise<SearchItem[]> => {
  const { items } = await loadCatalog<SearchItem>();

  return items;
};

const createNode = (tag: string, className: string, text?: string): HTMLElement => {
  const element = document.createElement(tag);

  element.className = className;

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
};

/**
 * Поиск по коду и названию модели в шапке. Под полем появляются подсказки (до восьми) со ссылками
 * на страницы моделей и строка «все результаты в каталоге». Enter без выбранной подсказки отправляет форму
 * в каталог (?q=), который показывает только найденное. Правила сопоставления — в search-match.ts.
 */
export const initSearch = (): void => {
  const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);
  const input = form?.querySelector<HTMLInputElement>(INPUT_SELECTOR);
  const results = form?.querySelector<HTMLElement>(RESULTS_SELECTOR);

  if (!form || !input || !results) {
    return;
  }

  let links: HTMLAnchorElement[] = [];
  let activeIndex = -1;

  // Текущий поиск каталога виден в поле: после перехода из шапки строка остаётся заполненной
  const currentQuery = new URLSearchParams(location.search).get(SEARCH_PARAMETER);

  if (currentQuery) {
    input.value = currentQuery;
  }

  const setActive = (index: number): void => {
    activeIndex = index;

    for (const [position, link] of links.entries()) {
      link.setAttribute('aria-selected', String(position === index));
    }

    // Пустое значение — ни один вариант не выбран
    input.setAttribute('aria-activedescendant', links[index]?.id ?? '');
  };

  const close = (): void => {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    setActive(-1);
  };

  const render = (found: SearchItem[], query: string): void => {
    links = [];

    if (found.length === 0) {
      results.replaceChildren(
        createNode('p', 'search__empty', 'Ничего не найдено. Проверьте код или название'),
      );
    } else {
      const nodes = found.slice(0, MAX_RESULTS).map((item, index) => {
        const link = createNode('a', 'search__item') as HTMLAnchorElement;
        const row = createNode('span', 'search__row');

        link.href = `${PRODUCT_URL}${encodeURIComponent(item.id)}`;
        link.id = `search-result-${index}`;
        link.setAttribute('role', 'option');
        row.append(createNode('span', 'search__name', item.model));

        if (item.code) {
          row.append(createNode('span', 'search__code', `Код ${item.code}`));
        }

        link.append(row, createNode('span', 'search__type', item.typeLabel));
        links.push(link);

        return link;
      });

      const all = createNode('a', 'search__all') as HTMLAnchorElement;

      all.href = `${CATALOG_URL}${encodeURIComponent(query)}`;
      all.id = 'search-result-all';
      all.setAttribute('role', 'option');
      all.append(createNode('span', '', `Все результаты в каталоге: ${found.length}`));
      links.push(all);
      results.replaceChildren(...nodes, all);
    }

    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  };

  const search = async (): Promise<void> => {
    const query = input.value.trim();
    const tokens = parseQuery(query);

    if (tokens.length === 0) {
      close();

      return;
    }

    const items = await load();

    // Пока грузились данные, человек мог продолжить вводить: показываем только актуальный запрос
    if (input.value.trim() !== query) {
      return;
    }

    const found = items
      .filter((item) => isSearchMatch(item, tokens))
      .toSorted(
        (a, b) =>
          searchRank(a, tokens) - searchRank(b, tokens) ||
          a.model.length - b.model.length ||
          a.model.localeCompare(b.model, 'ru'),
      );

    render(found, query);
  };

  input.addEventListener('input', () => {
    void search();
  });

  // Данные подгружаются заранее, как только человек встал в поле: к первой букве они уже готовы
  input.addEventListener('focus', () => {
    void load();

    if (input.value.trim() !== '' && results.hidden) {
      void search();
    }
  });

  // Горячая клавиша «/» переводит фокус в поле, если печатать больше негде (подсказка в поле — search__hint)
  document.addEventListener('keydown', (event) => {
    const isTyping =
      event.target instanceof HTMLElement &&
      (event.target.isContentEditable ||
        ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName));

    const hasModifier = event.metaKey || event.ctrlKey || event.altKey;

    if (!hasModifier && !isTyping && event.key === '/') {
      event.preventDefault();
      input.focus();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();

      return;
    }

    if (results.hidden || links.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();

      const step = event.key === 'ArrowDown' ? 1 : -1;

      // Позиции 0…N — подсказки, 0 в сдвинутой шкале — «ничего не выбрано» (поле ввода)
      const slots = links.length + 1;

      setActive(((activeIndex + 1 + step + slots) % slots) - 1);

      return;
    }

    // Enter на выбранной подсказке открывает её; без выбора форма уйдёт в каталог сама
    const active = links[activeIndex];

    if (active && event.key === 'Enter') {
      event.preventDefault();
      location.assign(active.href);
    }
  });

  // Панель закрывается, когда фокус и курсор ушли из поиска; переход по подсказке фокус не теряет
  form.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node && form.contains(event.relatedTarget))) {
      close();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Node && form.contains(event.target))) {
      close();
    }
  });
};
