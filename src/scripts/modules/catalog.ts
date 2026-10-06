const FILTER_SELECTOR = '[data-catalog-filter]';
const ITEM_SELECTOR = '[data-catalog-item]';
const GROUP_SELECTOR = '[data-catalog-types]';
const COUNT_SELECTOR = '[data-catalog-count]';
const EMPTY_SELECTOR = '[data-catalog-empty]';
const RESULTS_SELECTOR = '[data-catalog-results]';

const TYPE_FIELD = 'type';
const VOLUME_FROM_FIELD = 'volume-from';
const VOLUME_TO_FIELD = 'volume-to';
// Пока тип техники не выбран, показываются группы с этой пометкой
const NO_TYPE = 'none';
// Ссылки с главной передают наличие как in-stock=1; в фильтре это значение «в наличии» группы stock
const STOCK_FLAG = 'in-stock';
const STOCK_FIELD = 'stock';
const STOCK_IN = 'in';

// Пустое поле — «границы нет», а не ноль
const readNumber = (data: FormData, field: string): number => {
  const raw = String(data.get(field) ?? '')
    .trim()
    .replace(',', '.');

  return raw === '' ? NaN : Number(raw);
};

/**
 * Каталог: фильтрует карточки по выбранным параметрам и держит выбор в адресе страницы.
 * При открытии читает параметры из адреса — так работают ссылки и подбор с главной.
 */
export const initCatalog = (): void => {
  const form = document.querySelector<HTMLFormElement>(FILTER_SELECTOR);

  if (!form) {
    return;
  }

  const items = [...document.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
  const groups = [...document.querySelectorAll<HTMLFieldSetElement>(GROUP_SELECTOR)];
  const count = document.querySelector<HTMLElement>(COUNT_SELECTOR);
  const empty = document.querySelector<HTMLElement>(EMPTY_SELECTOR);
  const results = document.querySelector<HTMLElement>(RESULTS_SELECTOR);
  // Поля типа техники стоят вне формы и привязаны к ней атрибутом form
  const typeInputs = [...form.elements].filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && element.name === TYPE_FIELD,
  );

  const getType = (): string => typeInputs.find((input) => input.checked)?.value ?? NO_TYPE;

  // Показываем только группы параметров выбранного типа; скрытые отключены и не участвуют в отборе
  const syncGroups = (): void => {
    const type = getType();

    for (const group of groups) {
      const isActive = group.dataset.catalogTypes === type;

      group.hidden = !isActive;
      group.disabled = !isActive;
    }
  };

  const applyFilter = (): void => {
    const data = new FormData(form);
    const type = getType();
    const volumeFrom = readNumber(data, VOLUME_FROM_FIELD);
    const volumeTo = readNumber(data, VOLUME_TO_FIELD);
    const selected = new Map<string, Set<string>>();

    for (const [name, value] of data) {
      if (
        name === TYPE_FIELD ||
        name === VOLUME_FROM_FIELD ||
        name === VOLUME_TO_FIELD ||
        value === ''
      ) {
        continue;
      }

      selected.set(name, (selected.get(name) ?? new Set()).add(String(value)));
    }

    let visibleCount = 0;

    for (const item of items) {
      const volume = Number(item.dataset.volume);
      const isMatch =
        (type === NO_TYPE || item.dataset.type === type) &&
        (Number.isNaN(volumeFrom) || volume >= volumeFrom) &&
        (Number.isNaN(volumeTo) || volume <= volumeTo) &&
        [...selected].every(([name, values]) => values.has(item.dataset[name] ?? ''));

      item.hidden = !isMatch;
      visibleCount += isMatch ? 1 : 0;
    }

    if (count) {
      count.textContent = `Найдено: ${visibleCount}`;
    }

    if (empty) {
      empty.hidden = visibleCount > 0;
    }

    // Адрес повторяет текущий выбор: страницу с подбором можно обновить или отправить ссылкой
    const parameters = new URLSearchParams();

    for (const [name, value] of data) {
      if (value !== '') {
        parameters.append(name, String(value));
      }
    }

    const query = parameters.toString();

    history.replaceState(
      undefined,
      '',
      query ? `${location.pathname}?${query}` : location.pathname,
    );
  };

  const update = (): void => {
    syncGroups();
    applyFilter();

    if (results) {
      results.scrollTop = 0;
    }
  };

  // Предустановка из адреса: тип, затем группы этого типа, затем значения
  const applyQuery = (): void => {
    const parameters = new URLSearchParams(location.search);
    const type = parameters.get(TYPE_FIELD);

    if (parameters.get(STOCK_FLAG) === '1') {
      parameters.append(STOCK_FIELD, STOCK_IN);
    }

    for (const input of typeInputs) {
      input.checked = input.value === type;
    }

    syncGroups();

    for (const element of form.elements) {
      if (
        !(element instanceof HTMLInputElement) ||
        element.matches(':disabled') ||
        element.name === TYPE_FIELD
      ) {
        continue;
      }

      if (element.type === 'checkbox') {
        element.checked = parameters.getAll(element.name).includes(element.value);
      } else {
        element.value = parameters.get(element.name) ?? '';
      }
    }
  };

  // Повторный клик по выбранному типу снимает выбор: снова показывается вся техника
  for (const input of typeInputs) {
    let wasChecked = false;

    input.addEventListener('pointerdown', () => {
      wasChecked = input.checked;
    });
    input.addEventListener('click', () => {
      if (!wasChecked) {
        return;
      }

      input.checked = false;
      update();
    });
    // Поле стоит вне формы, поэтому его change до формы не всплывает
    input.addEventListener('change', update);
  }

  form.addEventListener('change', update);
  form.addEventListener('input', applyFilter);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });
  // Браузер очищает поля уже после события reset, поэтому пересчитываем на следующем шаге
  form.addEventListener('reset', () => {
    setTimeout(update, 0);
  });

  applyQuery();
  syncGroups();
  applyFilter();
};
