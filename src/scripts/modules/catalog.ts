import { gsap } from 'gsap';
import { loadCatalog, photoUrl } from './catalog-data.ts';
import { isSearchMatch, parseQuery } from './search-match.ts';

const FILTER_SELECTOR = '[data-catalog-filter]';
const GROUP_SELECTOR = '[data-catalog-group]';
const OPTION_SELECTOR = '[data-catalog-option]';
const LIST_SELECTOR = '[data-catalog-list]';
const TEMPLATE_SELECTOR = '[data-catalog-template]';
const SENTINEL_SELECTOR = '[data-catalog-sentinel]';
const COUNT_SELECTOR = '[data-catalog-count]';
const EMPTY_SELECTOR = '[data-catalog-empty]';
const ERROR_SELECTOR = '[data-catalog-error]';
const RESET_SELECTOR = '[data-catalog-reset]';
const MORE_SELECTOR = '[data-catalog-more]';
const MORE_COUNT_SELECTOR = '[data-catalog-more-count]';
const MORE_LABEL_SELECTOR = '[data-catalog-more-label]';
const COLLAPSED_CLASS = 'catalog__filter--collapsed';
const EXTRA_GROUP_SELECTOR = '[data-catalog-extra]';
const RESULTS_SELECTOR = '[data-catalog-results]';
const PROGRESS_SELECTOR = '[data-catalog-progress]';
const PROGRESS_BAR_SELECTOR = '[data-catalog-progress-bar]';

const SEARCH_PARAMETER = 'q';
const SEARCH_INPUT_SELECTOR = '[data-search-input]';

const TYPE_FIELD = 'type';
const VOLUME_FIELD = 'volume';
const VOLUME_FROM_SELECTOR = '[name="volume-from"]';
const VOLUME_TO_SELECTOR = '[name="volume-to"]';
const VOLUME_MAX_LENGTH = 3;
// Пока тип техники не выбран, тип в отборе не участвует
const NO_TYPE = 'none';
// Переключатель «Навесное оборудование»: выключен — такие позиции скрыты, включён — показано только навесное оборудование
const KIT_FIELD = 'kit';
const KIT_VALUE = 'kit';
// Ссылки с главной передают наличие как in-stock=1; в фильтре это значение «в наличии» группы stock
const STOCK_FLAG = 'in-stock';
const STOCK_FIELD = 'stock';
const STOCK_IN = 'in';
const STOCK_BADGE = 'В наличии';
const PRODUCT_URL = '/product.html?id=';
// Снятие одного значения может сделать недоступным другое: пересчёт повторяется, пока выбор не устоится
const NORMALIZE_PASSES = 5;
// Карточек в порции: четыре ряда по три. Следующая порция добавляется, когда до конца
// списка остаётся меньше высоты области — пользователь не упирается в пустой край
const BATCH_SIZE = 12;
const PRELOAD_MARGIN = '0px 0px 100% 0px';

type ParameterValue = string | number | string[] | null;

interface CatalogItem {
  id: string;
  photos: string[];
  model: string;
  code: string | null;
  type: string;
  typeLabel: string;
  icon: string;
  stock: { status: string };
  specs: [string, string | number][];
  params: Record<string, ParameterValue>;
}

interface FilterState {
  type: string;
  volumeFrom: number;
  volumeTo: number;
  selected: Map<string, Set<string>>;
}

// Пустое поле — «границы нет», а не ноль
const readNumber = (input: HTMLInputElement | null): number =>
  input && input.value.trim() !== '' ? Number(input.value) : NaN;

// Значение параметра всегда список строк: у машины может быть несколько подходящих шасси
const getValues = (item: CatalogItem, name: string): string[] => {
  const value = item.params[name];

  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [String(value)];
};

const getVolume = (item: CatalogItem): number => Number(item.params[VOLUME_FIELD] ?? NaN);

/**
 * Каталог: загружает модели из JSON, отбирает их по выбранным параметрам и держит выбор в адресе страницы.
 * Карточки выводятся порциями по мере прокрутки списка — моделей сотни, а видно десяток.
 * Выбрать можно только то, что даст результат: значения, которых нет у техники выбранного типа,
 * скрыты, а несовместимые с уже выбранным — заблокированы. Объём принимает только цифры
 * и не выходит за пределы доступного модельного ряда.
 * При открытии читает параметры из адреса — так работают ссылки и подбор с главной.
 */
export const initCatalog = (): void => {
  const form = document.querySelector<HTMLFormElement>(FILTER_SELECTOR);
  const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
  const template = document.querySelector<HTMLTemplateElement>(TEMPLATE_SELECTOR);

  if (!form || !list || !template) {
    return;
  }

  const groups = [...form.querySelectorAll<HTMLFieldSetElement>(GROUP_SELECTOR)];
  const optionInputs = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const volumeFromInput = form.querySelector<HTMLInputElement>(VOLUME_FROM_SELECTOR);
  const volumeToInput = form.querySelector<HTMLInputElement>(VOLUME_TO_SELECTOR);
  const sentinel = document.querySelector<HTMLElement>(SENTINEL_SELECTOR);
  const count = document.querySelector<HTMLElement>(COUNT_SELECTOR);
  const empty = document.querySelector<HTMLElement>(EMPTY_SELECTOR);
  const error = document.querySelector<HTMLElement>(ERROR_SELECTOR);
  const reset = document.querySelector<HTMLButtonElement>(RESET_SELECTOR);
  const more = document.querySelector<HTMLButtonElement>(MORE_SELECTOR);
  const moreCount = document.querySelector<HTMLElement>(MORE_COUNT_SELECTOR);
  const moreLabel = document.querySelector<HTMLElement>(MORE_LABEL_SELECTOR);
  const results = document.querySelector<HTMLElement>(RESULTS_SELECTOR);
  const progress = document.querySelector<HTMLElement>(PROGRESS_SELECTOR);
  const progressBar = document.querySelector<HTMLElement>(PROGRESS_BAR_SELECTOR);
  // Поля типа техники стоят вне формы и привязаны к ней атрибутом form
  const typeInputs = [...form.elements].filter(
    (element): element is HTMLInputElement =>
      element instanceof HTMLInputElement && element.name === TYPE_FIELD,
  );

  // Поиск по коду и названию приходит из шапки в адресе страницы (?q=…) и держится, пока его не сбросят
  let searchQuery = new URLSearchParams(location.search).get(SEARCH_PARAMETER)?.trim() ?? '';
  let searchTokens = parseQuery(searchQuery);

  let items: CatalogItem[] = [];
  // Отобранные модели и сколько из них уже выведено
  let matches: CatalogItem[] = [];
  let renderedCount = 0;

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

  // Область отбора, которую не меняют параметры справа: выбранный тип техники и поиск из шапки (?q=)
  const isTypeMatch = (item: CatalogItem, state: FilterState): boolean =>
    (state.type === NO_TYPE || item.type === state.type) && isSearchMatch(item, searchTokens);

  // skip — параметр, который не учитывается: так проверяется, что даст ещё одно значение в его группе
  const isMatch = (item: CatalogItem, state: FilterState, skip?: string): boolean => {
    const volume = getVolume(item);

    return (
      isTypeMatch(item, state) &&
      (skip === KIT_FIELD ||
        (item.params[KIT_FIELD] === KIT_VALUE) ===
          Boolean(state.selected.get(KIT_FIELD)?.has(KIT_VALUE))) &&
      (skip === VOLUME_FIELD ||
        ((Number.isNaN(state.volumeFrom) || volume >= state.volumeFrom) &&
          (Number.isNaN(state.volumeTo) || volume <= state.volumeTo))) &&
      [...state.selected].every(
        ([name, values]) =>
          name === skip ||
          name === KIT_FIELD ||
          getValues(item, name).some((value) => values.has(value)),
      )
    );
  };

  const hasValue = (item: CatalogItem, input: HTMLInputElement): boolean =>
    getValues(item, input.name).includes(input.value);

  // Крайние объёмы техники, подходящей под остальные параметры
  const getVolumeRange = (state: FilterState): [number, number] | undefined => {
    const volumes = items
      .filter((item) => isMatch(item, state, VOLUME_FIELD))
      .map((item) => getVolume(item))
      .filter((volume) => volume > 0);

    return volumes.length > 0 ? [Math.min(...volumes), Math.max(...volumes)] : undefined;
  };

  // Показываем группы параметров выбранного типа и общие для всей техники. Тип не выбран — показываем все группы:
  // фильтр максимально полный, а лишнее убирает выбор типа
  const syncGroups = (): void => {
    const type = getType();

    for (const group of groups) {
      const groupTypes = group.dataset.catalogTypes;
      const isActive = type === NO_TYPE || !groupTypes || groupTypes.split(' ').includes(type);

      group.hidden = !isActive;
      group.disabled = !isActive;
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

  // Карточка из заготовки: силуэт типа техники, плашка наличия, название, ссылка и характеристики
  const createCard = (item: CatalogItem): DocumentFragment => {
    const card = template.content.cloneNode(true) as DocumentFragment;
    const icon = card.querySelector<SVGElement>('[data-card-icon]');
    const soon = card.querySelector<HTMLElement>('[data-card-soon]');
    const code = card.querySelector<HTMLElement>('[data-card-code]');
    const badge = card.querySelector<HTMLElement>('[data-card-badge]');
    const type = card.querySelector<HTMLElement>('[data-card-type]');
    const link = card.querySelector<HTMLAnchorElement>('[data-card-link]');
    const model = card.querySelector<HTMLElement>('[data-card-model]');
    const specs = card.querySelector<HTMLElement>('[data-card-specs]');
    const sample = card.querySelector<HTMLElement>('[data-card-spec]');
    const price = card.querySelector<HTMLElement>('[data-modal-open]');

    // Окно заявки узнаёт, о какой модели спрашивают; код нужен менеджеру, чтобы отличить одноимённые модели
    if (price) {
      price.dataset.modalModel = item.code ? `${item.model} (код ${item.code})` : item.model;
    }

    icon?.querySelector('use')?.setAttribute('href', `#icon-${item.icon}`);
    icon?.setAttribute('aria-label', `${item.typeLabel} ${item.model}`);

    // Есть фото — оно занимает место силуэта и проявляется, когда загрузится. Нет фото (или оно не загрузилось) —
    // остаётся силуэт техники с подписью «фото скоро появится»
    const photoSource = item.photos.map((name) => photoUrl(name)).find((url) => url !== undefined);

    if (photoSource && icon) {
      const photo = document.createElement('img');

      photo.className = 'product-card__image';
      photo.dataset.cardPhoto = '';
      photo.src = photoSource;
      photo.alt = `${item.typeLabel} ${item.model}`;
      photo.loading = 'lazy';
      photo.decoding = 'async';
      photo.addEventListener(
        'load',
        () => {
          photo.classList.add('is-loaded');
        },
        { once: true },
      );
      photo.addEventListener(
        'error',
        () => {
          photo.replaceWith(icon);

          if (soon) {
            soon.hidden = false;
          }
        },
        { once: true },
      );
      icon.replaceWith(photo);
    } else if (soon) {
      soon.hidden = false;
    }

    // Код модели — плашкой на фото; в заголовке остаётся только название
    if (code) {
      if (item.code) {
        code.textContent = `Код ${item.code}`;
        code.hidden = false;
      } else {
        code.remove();
      }
    }

    if (badge) {
      if (item.stock.status === STOCK_IN) {
        badge.textContent = STOCK_BADGE;
      } else {
        badge.remove();
      }
    }

    if (type) {
      type.textContent = item.typeLabel;
    }

    if (link) {
      link.href = `${PRODUCT_URL}${encodeURIComponent(item.id)}`;
    }

    if (model) {
      model.textContent = item.model;
    }

    if (specs && sample) {
      sample.remove();

      for (const [label, value] of item.specs) {
        const spec = sample.cloneNode(true) as HTMLElement;
        const specLabel = spec.querySelector<HTMLElement>('[data-card-spec-label]');
        const specValue = spec.querySelector<HTMLElement>('[data-card-spec-value]');

        if (specLabel) {
          specLabel.textContent = label;
        }

        if (specValue) {
          specValue.textContent = String(value);
        }

        specs.append(spec);
      }
    }

    return card;
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

  // Следующая порция карточек. Пока метка конца списка остаётся в зоне догрузки, добавляем ещё:
  // наблюдатель сообщает только о входе в зону, а не о том, что метка всё ещё в ней
  const renderBatch = (): void => {
    const batch = matches.slice(renderedCount, renderedCount + BATCH_SIZE);

    if (batch.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of batch) {
      fragment.append(createCard(item));
    }

    list.append(fragment);
    renderedCount += batch.length;

    if (results && sentinel) {
      const resultsBox = results.getBoundingClientRect();

      if (sentinel.getBoundingClientRect().top < resultsBox.bottom + resultsBox.height) {
        renderBatch();
        return;
      }
    }

    updateProgress();
  };

  const applyFilter = (state: FilterState): void => {
    matches = items.filter((item) => isMatch(item, state));
    renderedCount = 0;
    list.replaceChildren();
    renderBatch();

    if (count) {
      count.textContent = String(matches.length);
    }

    if (empty) {
      empty.hidden = matches.length > 0;
    }

    // Адрес повторяет текущий выбор: страницу с подбором можно обновить или отправить ссылкой
    const parameters = new URLSearchParams();
    const data = new FormData(form);

    for (const [name, value] of data) {
      if (value !== '') {
        parameters.append(name, String(value));
      }
    }

    if (searchQuery !== '') {
      parameters.set(SEARCH_PARAMETER, searchQuery);
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

  // Выбранные значения в технических параметрах: показываются на кнопке, пока группы свёрнуты
  const countExtraSelected = (): number =>
    optionInputs.filter(
      (input) =>
        input.checked && isGroupActive(input) && input.closest(EXTRA_GROUP_SELECTOR) !== null,
    ).length;

  const setExpanded = (isExpanded: boolean): void => {
    form.classList.toggle(COLLAPSED_CLASS, !isExpanded);
    more?.setAttribute('aria-expanded', String(isExpanded));

    // Высота панели изменилась — область списка стала другой
    updateProgress();
  };

  const syncMore = (): void => {
    if (!moreCount) {
      return;
    }

    const selectedCount = countExtraSelected();

    moreCount.textContent = String(selectedCount);
    moreCount.hidden = selectedCount === 0;

    if (moreLabel) {
      moreLabel.textContent = form.classList.contains(COLLAPSED_CLASS)
        ? 'Все параметры'
        : 'Скрыть параметры';
    }
  };

  // Пересчёт по ходу ввода: без снятия выбора
  const refresh = (): void => {
    const state = readState();

    syncOptions(state);
    applyFilter(state);
    syncMore();
    updateProgress();
  };

  const update = (): void => {
    syncGroups();
    normalize();

    // Плавная прокрутка (fullpage.ts) могла не доехать: останавливаем её, иначе она вернёт список назад.
    // Список возвращается в начало до вывода карточек, чтобы первая порция считалась от верха
    if (results) {
      gsap.killTweensOf(results);
      results.scrollTop = 0;
    }

    refresh();
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  more?.addEventListener('click', () => {
    setExpanded(form.classList.contains(COLLAPSED_CLASS));
    syncMore();
  });

  if (results) {
    // Высота области меняется вместе с окном
    const resizeObserver = new ResizeObserver(updateProgress);

    resizeObserver.observe(results);
    resizeObserver.observe(list);

    // eslint-disable-next-line unicorn/prefer-observer-apis -- полосе нужна точная доля прокрутки, а не факт пересечения
    results.addEventListener('scroll', updateProgress, { passive: true });

    if (sentinel) {
      const loadObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            renderBatch();
          }
        },
        { root: results, rootMargin: PRELOAD_MARGIN },
      );

      loadObserver.observe(sentinel);
    }
  }

  // Выбор из адреса виден сразу, отбор включается, когда данные загрузились.
  // Если в адресе есть технические параметры, их группы раскрыты: выбор не должен быть скрыт
  applyQuery();

  if (countExtraSelected() > 0) {
    setExpanded(true);
  }

  const start = async (): Promise<void> => {
    try {
      ({ items } = await loadCatalog<CatalogItem>());
    } catch (loadError) {
      if (error) {
        error.hidden = false;
      }

      console.error('Каталог не загрузился:', loadError);
      return;
    }

    form.addEventListener('change', update);
    form.addEventListener('input', refresh);
    // Браузер очищает поля уже после события reset, поэтому пересчитываем на следующем шаге.
    // Сброс убирает и поиск: строка в шапке очищается вместе с остальными параметрами
    form.addEventListener('reset', () => {
      searchQuery = '';
      searchTokens = [];

      const searchInput = document.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR);

      if (searchInput) {
        searchInput.value = '';
      }

      setTimeout(update, 0);
    });

    update();
  };

  void start();
};
