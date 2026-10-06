import { gsap } from 'gsap';

const FILTER_SELECTOR = '[data-catalog-filter]';
const ITEM_SELECTOR = '[data-catalog-item]';
const GROUP_SELECTOR = '[data-catalog-group]';
const OPTION_SELECTOR = '[data-catalog-option]';
const COUNT_SELECTOR = '[data-catalog-count]';
const EMPTY_SELECTOR = '[data-catalog-empty]';
const RESET_SELECTOR = '[data-catalog-reset]';
const RESULTS_SELECTOR = '[data-catalog-results]';
const PROGRESS_SELECTOR = '[data-catalog-progress]';
const PROGRESS_BAR_SELECTOR = '[data-catalog-progress-bar]';

const TYPE_FIELD = 'type';
const VOLUME_FIELD = 'volume';
const VOLUME_FROM_SELECTOR = '[name="volume-from"]';
const VOLUME_TO_SELECTOR = '[name="volume-to"]';
const VOLUME_MAX_LENGTH = 3;
// Пока тип техники не выбран, показываются группы с этой пометкой
const NO_TYPE = 'none';
// Ссылки с главной передают наличие как in-stock=1; в фильтре это значение «в наличии» группы stock
const STOCK_FLAG = 'in-stock';
const STOCK_FIELD = 'stock';
const STOCK_IN = 'in';
// Снятие одного значения может сделать недоступным другое: пересчёт повторяется, пока выбор не устоится
const NORMALIZE_PASSES = 5;

interface FilterState {
  type: string;
  volumeFrom: number;
  volumeTo: number;
  selected: Map<string, Set<string>>;
}

// Пустое поле — «границы нет», а не ноль
const readNumber = (input: HTMLInputElement | null): number =>
  input && input.value.trim() !== '' ? Number(input.value) : NaN;

/**
 * Каталог: фильтрует карточки по выбранным параметрам и держит выбор в адресе страницы.
 * Выбрать можно только то, что даст результат: значения, которых нет у техники выбранного типа,
 * скрыты, а несовместимые с уже выбранным — заблокированы. Объём принимает только цифры
 * и не выходит за пределы доступного модельного ряда.
 * При открытии читает параметры из адреса — так работают ссылки и подбор с главной.
 */
export const initCatalog = (): void => {
  const form = document.querySelector<HTMLFormElement>(FILTER_SELECTOR);

  if (!form) {
    return;
  }

  const items = [...document.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
  const groups = [...form.querySelectorAll<HTMLFieldSetElement>(GROUP_SELECTOR)];
  const optionInputs = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const volumeFromInput = form.querySelector<HTMLInputElement>(VOLUME_FROM_SELECTOR);
  const volumeToInput = form.querySelector<HTMLInputElement>(VOLUME_TO_SELECTOR);
  const count = document.querySelector<HTMLElement>(COUNT_SELECTOR);
  const empty = document.querySelector<HTMLElement>(EMPTY_SELECTOR);
  const reset = document.querySelector<HTMLButtonElement>(RESET_SELECTOR);
  const results = document.querySelector<HTMLElement>(RESULTS_SELECTOR);
  const progress = document.querySelector<HTMLElement>(PROGRESS_SELECTOR);
  const progressBar = document.querySelector<HTMLElement>(PROGRESS_BAR_SELECTOR);
  // Поля типа техники стоят вне формы и привязаны к ней атрибутом form
  const typeInputs = [...form.elements].filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && element.name === TYPE_FIELD,
  );

  const getType = (): string => typeInputs.find((input) => input.checked)?.value ?? NO_TYPE;

  // Группа другого типа техники отключена целиком и в отборе не участвует
  const isGroupActive = (input: HTMLInputElement): boolean =>
    !input.closest<HTMLFieldSetElement>(GROUP_SELECTOR)?.disabled;

  const readState = (): FilterState => {
    const selected = new Map<string, Set<string>>();

    for (const input of optionInputs) {
      if (input.checked && isGroupActive(input)) {
        selected.set(input.name, (selected.get(input.name) ?? new Set()).add(input.value));
      }
    }

    return {
      type: getType(),
      volumeFrom: readNumber(volumeFromInput),
      volumeTo: readNumber(volumeToInput),
      selected,
    };
  };

  const isTypeMatch = (item: HTMLElement, state: FilterState): boolean =>
    state.type === NO_TYPE || item.dataset.type === state.type;

  // skip — параметр, который не учитывается: так проверяется, что даст ещё одно значение в его группе
  const isMatch = (item: HTMLElement, state: FilterState, skip?: string): boolean => {
    const volume = Number(item.dataset.volume);

    return (
      isTypeMatch(item, state) &&
      (skip === VOLUME_FIELD ||
        ((Number.isNaN(state.volumeFrom) || volume >= state.volumeFrom) &&
          (Number.isNaN(state.volumeTo) || volume <= state.volumeTo))) &&
      [...state.selected].every(
        ([name, values]) => name === skip || values.has(item.dataset[name] ?? ''),
      )
    );
  };

  const hasValue = (item: HTMLElement, input: HTMLInputElement): boolean =>
    item.dataset[input.name] === input.value;

  // Крайние объёмы техники, подходящей под остальные параметры
  const getVolumeRange = (state: FilterState): [number, number] | undefined => {
    const volumes = items
      .filter((item) => isMatch(item, state, VOLUME_FIELD))
      .map((item) => Number(item.dataset.volume));

    return volumes.length > 0 ? [Math.min(...volumes), Math.max(...volumes)] : undefined;
  };

  // Показываем только группы параметров выбранного типа. Выбор в одноимённой группе переносится:
  // «Нефть» у всей техники остаётся «Нефтью» у полуприцепов
  const syncGroups = (): void => {
    const type = getType();
    const { selected } = readState();

    for (const group of groups) {
      const groupTypes = group.dataset.catalogTypes;
      const isActive = !groupTypes || groupTypes === type;

      group.hidden = !isActive;
      group.disabled = !isActive;
    }

    for (const input of optionInputs) {
      if (isGroupActive(input) && selected.has(input.name)) {
        input.checked = selected.get(input.name)?.has(input.value) ?? false;
      }
    }
  };

  // Снимает выбор, который больше ничего не находит: значение из адреса, которого нет у этого типа,
  // или объём, оставшийся от другого типа техники
  const normalize = (): void => {
    for (let pass = 0; pass < NORMALIZE_PASSES; pass += 1) {
      const state = readState();
      const range = getVolumeRange(state);
      let isChanged = false;

      // Сначала объём: оставшись от другого типа техники, он обнулил бы весь остальной выбор
      if (
        range &&
        volumeFromInput &&
        (state.volumeFrom > range[1] || state.volumeFrom < range[0])
      ) {
        volumeFromInput.value = '';
        isChanged = true;
      }

      if (range && volumeToInput && (state.volumeTo < range[0] || state.volumeTo > range[1])) {
        volumeToInput.value = '';
        isChanged = true;
      }

      if (isChanged) {
        continue;
      }

      for (const input of optionInputs) {
        const isValid = items.some(
          (item) => hasValue(item, input) && isMatch(item, state, input.name),
        );

        if (!isValid && input.checked && isGroupActive(input)) {
          input.checked = false;
          isChanged = true;
        }
      }

      if (!isChanged) {
        return;
      }
    }
  };

  // Значение скрыто, если его нет у техники выбранного типа, и заблокировано,
  // если вместе с остальным выбором оно ничего не найдёт
  const syncOptions = (state: FilterState): void => {
    for (const input of optionInputs) {
      const option = input.closest<HTMLElement>(OPTION_SELECTOR);
      const inScope = items.filter((item) => isTypeMatch(item, state) && hasValue(item, input));
      const isAvailable = inScope.some((item) => isMatch(item, state, input.name));

      input.disabled = !isAvailable && !input.checked;

      if (option) {
        option.hidden = inScope.length === 0;
      }
    }

    // Группа без единого значения для этого типа техники не показывается
    for (const group of groups) {
      const options = [...group.querySelectorAll<HTMLElement>(OPTION_SELECTOR)];

      if (!group.disabled && options.length > 0) {
        group.hidden = options.every((option) => option.hidden);
      }
    }

    // Подсказка в полях объёма — доступные сейчас крайние значения
    const range = getVolumeRange(state);

    if (volumeFromInput) {
      volumeFromInput.placeholder = range ? String(range[0]) : '';
    }

    if (volumeToInput) {
      volumeToInput.placeholder = range ? String(range[1]) : '';
    }
  };

  const applyFilter = (state: FilterState): void => {
    let visibleCount = 0;

    for (const item of items) {
      const isVisible = isMatch(item, state);

      item.hidden = !isVisible;
      visibleCount += isVisible ? 1 : 0;
    }

    if (count) {
      count.textContent = String(visibleCount);
    }

    if (empty) {
      empty.hidden = visibleCount > 0;
    }

    // Адрес повторяет текущий выбор: страницу с подбором можно обновить или отправить ссылкой
    const parameters = new URLSearchParams();
    const data = new FormData(form);

    for (const [name, value] of data) {
      if (value !== '') {
        parameters.append(name, String(value));
      }
    }

    const query = parameters.toString();

    // Сбрасывать нечего, пока ничего не выбрано
    if (reset) {
      reset.disabled = query === '';
    }

    history.replaceState(
      undefined,
      '',
      query ? `${location.pathname}?${query}` : location.pathname,
    );
  };

  // Полоса под фильтром: доля прокрученного списка. Если список помещается целиком, полосы нет
  const updateProgress = (): void => {
    if (!results || !progress || !progressBar) {
      return;
    }

    const maxScroll = results.scrollHeight - results.clientHeight;

    progress.hidden = maxScroll <= 1;
    progressBar.style.scale = `${maxScroll > 1 ? Math.min(results.scrollTop / maxScroll, 1) : 0} 1`;
  };

  // Пересчёт по ходу ввода: без снятия выбора и без возврата списка в начало
  const refresh = (): void => {
    const state = readState();

    syncOptions(state);
    applyFilter(state);
    updateProgress();
  };

  const update = (): void => {
    syncGroups();
    normalize();
    refresh();

    // Плавная прокрутка (fullpage.ts) могла не доехать: останавливаем её, иначе она вернёт список назад
    if (results) {
      gsap.killTweensOf(results);
      results.scrollTop = 0;
    }

    updateProgress();
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

    for (const input of optionInputs) {
      if (isGroupActive(input)) {
        input.checked = parameters.getAll(input.name).includes(input.value);
      }
    }

    for (const input of [volumeFromInput, volumeToInput]) {
      if (input) {
        input.value = (parameters.get(input.name) ?? '').replaceAll(/\D/g, '');
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

  for (const input of [volumeFromInput, volumeToInput]) {
    // В поле объёма попадают только цифры: буквы, знаки и лишние разряды отбрасываются при вводе
    input?.addEventListener('input', () => {
      input.value = input.value.replaceAll(/\D/g, '').slice(0, VOLUME_MAX_LENGTH);
    });
    // По завершении ввода объём подгоняется под доступный ряд, а «от» не может оказаться больше «до»
    input?.addEventListener('change', () => {
      const state = readState();
      const range = getVolumeRange(state);
      const value = readNumber(input);

      if (!range || Number.isNaN(value)) {
        return;
      }

      const isFrom = input === volumeFromInput;
      const other = isFrom ? state.volumeTo : state.volumeFrom;
      const lowest = !isFrom && !Number.isNaN(other) ? Math.max(range[0], other) : range[0];
      const highest = isFrom && !Number.isNaN(other) ? Math.min(range[1], other) : range[1];

      input.value = String(Math.min(Math.max(value, lowest), Math.max(lowest, highest)));
    });
  }

  form.addEventListener('change', update);
  form.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });
  // Браузер очищает поля уже после события reset, поэтому пересчитываем на следующем шаге
  form.addEventListener('reset', () => {
    setTimeout(update, 0);
  });

  if (results) {
    // Высота области и списка меняется при смене размеров окна и по мере загрузки фото
    const resizeObserver = new ResizeObserver(updateProgress);

    resizeObserver.observe(results);

    if (results.firstElementChild) {
      resizeObserver.observe(results.firstElementChild);
    }

    // eslint-disable-next-line unicorn/prefer-observer-apis -- полосе нужна точная доля прокрутки, а не факт пересечения
    results.addEventListener('scroll', updateProgress, { passive: true });
  }

  applyQuery();
  update();
};
