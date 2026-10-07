import { loadCatalog, loadSpecs, originalPhotoUrl, photoUrl } from './catalog-data.ts';

const ROOT_SELECTOR = '[data-product]';
const TYPE_SELECTOR = '[data-product-type]';
const TITLE_SELECTOR = '[data-product-title]';
const CODE_SELECTOR = '[data-product-code]';
const STATUS_SELECTOR = '[data-product-status]';
const PRICE_BUTTON_SELECTOR = '[data-modal-open]';
const MEDIA_SELECTOR = '[data-product-media]';
const ICON_SELECTOR = '[data-product-icon]';
const SOON_SELECTOR = '[data-product-soon]';
const THUMBS_SELECTOR = '[data-product-thumbs]';
const ERROR_SELECTOR = '[data-product-error]';
const SPECS_SELECTOR = '[data-product-specs]';
const OPTIONS_SELECTOR = '[data-product-options]';
const OPTIONS_LIST_SELECTOR = '[data-product-options-list]';
const ID_PARAMETER = 'id';
const MAX_CELLS = 12;
const WIDE_VALUE_LENGTH = 14;
const MAX_OPTIONS = 6;
const MAX_OPTION_LENGTH = 40;
const MAX_VALUE_LENGTH = 30;
const EMPTY_VALUES = new Set(['нет', '-', '—']);
const TITLE_SUFFIX = 'Энергомаш';

interface ProductItem {
  id: string;
  model: string;
  code: string | null;
  typeLabel: string;
  icon: string;
  photos: string[];
  price: number | null;
  stock: { status: string; inStock: number; expected: number };
  specs: [string, string][];
  type: string;
  purpose: string;
  params: Record<string, unknown> & { chassisLabels?: string[] };
}

interface SpecSection {
  title: string;
  rows: [string, string][];
}

// Основные характеристики в порядке показа. Значение берётся из таблицы дампа (там подробнее: «пневматическая,
// двухосная»), а если её нет — из параметров модели, которые импорт выделил из названия и данных (рамная
// конструкция, оси, высота ССУ…). Длинные описания (конструкция цистерны, крепление) на страницу не попадают
const SPEC_ORDER = [
  'Объём',
  'Секций',
  'Материал цистерны',
  'Толщина стенки',
  'Сечение цистерны',
  'Конструкция',
  'Подвеска',
  'Осей',
  'Оси',
  'Шины',
  'Высота ССУ',
  'Тормозная система',
  'Опорные устройства',
  'Шкворень',
  'Теплоизоляция',
  'Облицовка',
  'Шасси',
  'Колёсная формула',
  'Насос',
  'Привод насоса',
  'Расположение УВТ',
  'Горловина',
  'Слив',
  'Крышка горловины',
  'Дыхательный клапан',
  'Уровень налива',
  'Донный клапан',
  'Люк для зачистки',
  'Снаряжённая масса',
  'Полная масса',
  'Габариты',
];

// Название строки в таблице дампа → заголовок на странице
const DUMP_TITLES = new Map<string, string>([
  ['Вместимость цистерны', 'Объём'],
  ['Количество секций', 'Секций'],
  ['Сечение цистерны', 'Сечение цистерны'],
  ['Подвеска', 'Подвеска'],
  ['Оси', 'Оси'],
  ['Шины', 'Шины'],
  ['Тормозная система', 'Тормозная система'],
  ['Опорные устройства', 'Опорные устройства'],
  ['Шкворень', 'Шкворень'],
  ['Материал цистерны', 'Материал цистерны'],
  ['Толщина обечайки и днищ', 'Толщина стенки'],
  ['Термоизоляция цистерны', 'Теплоизоляция'],
  ['Базовое шасси', 'Шасси'],
  ['Колесная формула', 'Колёсная формула'],
  ['Насосная установка', 'Насос'],
  ['Привод насоса', 'Привод насоса'],
  ['Горловина цистерны', 'Горловина'],
  ['Задний слив', 'Слив'],
  ['Крышка горловины', 'Крышка горловины'],
  ['Дыхательный клапан', 'Дыхательный клапан'],
  ['Указатель уровня налива', 'Уровень налива'],
  ['Донный клапан', 'Донный клапан'],
  ['Люк для зачистки цистерны', 'Люк для зачистки'],
  ['Снаряженная масса', 'Снаряжённая масса'],
  ['Полная масса', 'Полная масса'],
  ['Длина', 'Длина'],
  ['Ширина', 'Ширина'],
  ['Высота', 'Высота'],
]);

// Единица для значений, которые в дампе записаны голым числом
const DUMP_UNITS = new Map<string, string>([
  ['Снаряжённая масса', 'кг'],
  ['Полная масса', 'кг'],
  ['Длина', 'мм'],
  ['Ширина', 'мм'],
  ['Высота', 'мм'],
]);

// Подписи значений параметров фильтра (те же, что в фильтре каталога)
const PARAM_LABELS: Record<string, Record<string, string>> = {
  shape: { case: 'Чемодан', round: 'Круглое' },
  construction: { frame: 'Рамная', frameless: 'Безрамная' },
  suspension: { air: 'Пневматическая', spring: 'Рессорная' },
  drive: { cardan: 'Карданный', hydro: 'Гидравлический' },
  uvt: { side: 'Боковое', rear: 'В заднем отсеке' },
  tyres: { '385': '385/65R22,5', '425': '425/85R21' },
};

const STATUS_LABELS: Record<string, string> = {
  in: 'В наличии',
  expected: 'Ожидается поступление',
  order: 'Под заказ',
};

const isNumeric = (value: string): boolean => /^\d+([.,]\d+)?$/.test(value);

const createNode = (tag: string, className: string, text: string): HTMLElement => {
  const element = document.createElement(tag);

  element.className = className;
  element.textContent = text;

  return element;
};

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const readParameters = (item: ProductItem): Map<string, string> => {
  const parameters = new Map<string, string>();
  const { params: raw } = item;
  const label = (name: string): string | undefined => {
    const value = raw[name];

    return typeof value === 'string' ? (PARAM_LABELS[name]?.[value] ?? value) : undefined;
  };
  const add = (title: string, value: string | undefined): void => {
    if (value) {
      parameters.set(title, value);
    }
  };

  add('Объём', typeof raw.volume === 'number' ? `${raw.volume} м³` : undefined);
  add('Секций', label('sections'));
  add('Сечение цистерны', label('shape'));
  add('Конструкция', label('construction'));
  add('Подвеска', label('suspension'));
  add('Осей', label('axles'));
  add('Оси', label('axle')?.toUpperCase());
  add('Шины', label('tyres'));
  add('Высота ССУ', raw.ssu ? `${String(raw.ssu)} мм` : undefined);
  add('Теплоизоляция', raw.insulated ? 'Есть' : undefined);
  add('Привод насоса', label('drive'));
  add('Расположение УВТ', label('uvt'));
  add('Горловина', label('neck'));
  add('Шасси', item.params.chassisLabels?.join(', '));

  return parameters;
};

const readDump = (sections: SpecSection[]): Map<string, string> => {
  const dump = new Map<string, string>();

  for (const { rows } of sections) {
    for (const [name, raw] of rows) {
      const title = DUMP_TITLES.get(name.trim());
      const value = raw.trim();

      if (
        title &&
        value &&
        !EMPTY_VALUES.has(value.toLowerCase()) &&
        !dump.has(title) &&
        value.length <= MAX_VALUE_LENGTH
      ) {
        const unit = DUMP_UNITS.get(title);

        dump.set(
          title,
          unit && isNumeric(value)
            ? `${value} ${unit}`
            : value
                .replaceAll('м3', 'м³')
                .replace(/\s*грузоподъемностью\s*/i, ' · ')
                .replace(/\s*толщиной\s*/i, ' '),
        );
      }
    }
  }

  // У цистерн с теплоизоляцией сталь и толщина записаны одной строкой: «сталь 09Г2С толщиной 4 мм» —
  // раскладываем на материал и толщину стенки; наружная облицовка и теплоизоляция показываются отдельно
  for (const { rows } of sections) {
    for (const [name, raw] of rows) {
      const label = name.trim();
      const value = raw.trim();

      if (/^материал внутрен/i.test(label)) {
        const thickness = /толщиной\s*([\d.,]+)\s*мм/i.exec(value)?.[1];
        const material = value.replace(/\s*толщиной.*$/i, '');

        if (material && !dump.has('Материал цистерны')) {
          dump.set('Материал цистерны', material);
        }

        if (thickness && !dump.has('Толщина стенки')) {
          dump.set('Толщина стенки', `${thickness} мм`);
        }
      } else if (/^материал наруж/i.test(label) && !dump.has('Облицовка')) {
        dump.set('Облицовка', value.replace(/\s*с ЛКП/i, '').replace(/\s*толщиной\s*/i, ' '));
      }
    }
  }

  const size = ['Длина', 'Ширина', 'Высота'].map((title) => dump.get(title)?.replace(' мм', ''));

  if (size.every(Boolean)) {
    dump.set('Габариты', `${size.join(' × ')} мм`);
  }

  return dump;
};

const normalizeName = (name: string): string => name.toLowerCase().replaceAll(/[\s\-_.,()]/g, '');

/**
 * Таблица характеристик позиции. У позиций склада своей таблицы часто нет, но в названии зашита модель
 * («ППЦ-28/4К-П3-BPW-1350» → «ППЦ-28/4К»): тогда берётся таблица модели, чьё название совпало с началом
 * названия позиции. Хвост названия отрезается по частям, пока модель не найдётся.
 */
const findSpecs = (
  item: ProductItem,
  items: ProductItem[],
  specs: Record<string, SpecSection[]>,
): SpecSection[] => {
  const own = specs[item.id] as SpecSection[] | undefined;

  if (own) {
    return own;
  }

  const parts = item.model.split(/[\s-]+/);
  const models = items.filter(
    (candidate) => candidate.id.startsWith('model-') && specs[candidate.id],
  );

  for (let count = parts.length; count >= 2; count -= 1) {
    const name = normalizeName(parts.slice(0, count).join('-'));
    const parent = models.find((candidate) => normalizeName(candidate.model) === name);

    if (parent) {
      return specs[parent.id];
    }
  }

  return [];
};

// Короткое значение занимает одну ячейку сетки, длинное — две (плитка на всю ширину колонки)
const cellsOf = (value: string): number => (value.length > WIDE_VALUE_LENGTH ? 2 : 1);

const pickMainSpecs = (item: ProductItem, sections: SpecSection[]): [string, string][] => {
  const parameters = readParameters(item);
  const dump = readDump(sections);

  const picked: [string, string][] = [];
  let used = 0;

  for (const title of SPEC_ORDER) {
    const value = dump.get(title) ?? parameters.get(title);

    if (value && used + cellsOf(value) <= MAX_CELLS) {
      picked.push([title, capitalize(value)]);
      used += cellsOf(value);
    }
  }

  return picked;
};

// Опции модели: в таблице дампа это пункты комплектации — строки раздела «Оборудование…» и заголовки-перечисления
// («катушка заземления с тросом и клином;»). Длинные описания отбрасываются, повторы убираются
const pickOptions = (sections: SpecSection[]): string[] => {
  const options = new Set<string>();
  const add = (text: string): void => {
    const clean = text.trim().replace(/[;.]$/, '');

    if (
      clean &&
      clean.length <= MAX_OPTION_LENGTH &&
      !/^технические характеристики$/i.test(clean) &&
      !/фланж|волнорез|бронелист|сварк/i.test(clean)
    ) {
      options.add(capitalize(clean));
    }
  };

  for (const { title, rows } of sections) {
    if (rows.length === 0) {
      add(title);
    } else if (/^оборудование/i.test(title)) {
      for (const [label] of rows) {
        add(label);
      }
    }
  }

  return [...options].slice(0, MAX_OPTIONS);
};

// У части моделей перечня комплектации в таблице нет. Тогда берутся самые частые опции моделей той же категории
// (тот же тип техники и назначение: ГСМ, нефть, вода…): комплектация у них одна
const pickCategoryOptions = (
  item: ProductItem,
  items: ProductItem[],
  specs: Record<string, SpecSection[]>,
): string[] => {
  const counts = new Map<string, number>();

  for (const candidate of items) {
    const sections = candidate.id.startsWith('model-')
      ? (specs[candidate.id] as SpecSection[] | undefined)
      : undefined;

    if (sections && candidate.type === item.type && candidate.purpose === item.purpose) {
      for (const option of pickOptions(sections)) {
        counts.set(option, (counts.get(option) ?? 0) + 1);
      }
    }
  }

  return [...counts]
    .toSorted((a, b) => b[1] - a[1])
    .map(([option]) => option)
    .slice(0, MAX_OPTIONS);
};

const renderOptions = (block: HTMLElement, options: string[]): void => {
  const list = block.querySelector<HTMLElement>(OPTIONS_LIST_SELECTOR);

  if (!list || options.length === 0) {
    return;
  }

  list.replaceChildren(...options.map((option) => createNode('li', 'product__option', option)));
  block.hidden = false;
};

const renderSpecs = (list: HTMLElement, specs: [string, string][]): void => {
  list.replaceChildren(
    ...specs.map(([label, value], index) => {
      const item = createNode('div', 'product__spec', '');

      if (cellsOf(value) === 2 || (specs.length % 2 === 1 && index === specs.length - 1)) {
        item.classList.add('product__spec--wide');
      }

      item.append(
        createNode('dt', 'product__spec-label', label),
        createNode('dd', 'product__spec-value', value),
      );

      return item;
    }),
  );
};

const renderPhotos = (
  media: HTMLElement,
  thumbs: HTMLElement,
  item: ProductItem,
  hideIcon: () => void,
): void => {
  // Крупное фото — исходник; если он не открылся (пустой файл), остаётся превью
  const sources = item.photos.flatMap((name) => {
    const preview = photoUrl(name);
    const full = originalPhotoUrl(name) ?? preview;

    return preview && full ? [{ preview, full }] : [];
  });

  if (sources.length === 0) {
    return;
  }

  const image = document.createElement('img');

  image.className = 'product__image';
  image.alt = `${item.typeLabel} ${item.model}`;
  image.decoding = 'async';
  media.prepend(image);

  const show = ({ preview, full }: { preview: string; full: string }): void => {
    image.classList.remove('is-loaded');
    image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
    image.addEventListener(
      'error',
      () => {
        image.src = preview;
      },
      { once: true },
    );
    image.src = full;
  };

  image.addEventListener('load', hideIcon, { once: true });
  show(sources[0]);

  if (sources.length < 2) {
    return;
  }

  const buttons = sources.map((source, index) => {
    const button = document.createElement('button');
    const preview = document.createElement('img');

    button.className = 'product__thumb';
    button.type = 'button';
    button.ariaLabel = `Фото ${index + 1}`;
    button.classList.toggle('is-active', index === 0);
    preview.className = 'product__thumb-image';
    preview.src = source.preview;
    preview.alt = '';
    button.append(preview);
    // Фото меняется при наведении на миниатюру (и при фокусе с клавиатуры); клик оставлен для сенсорных экранов
    const select = (): void => {
      if (button.classList.contains('is-active')) {
        return;
      }

      for (const other of buttons) {
        other.classList.toggle('is-active', other === button);
      }

      show(source);
    };

    button.addEventListener('pointerenter', select);
    button.addEventListener('focus', select);
    button.addEventListener('click', select);

    return button;
  });

  thumbs.replaceChildren(...buttons);
  thumbs.hidden = false;
};

/**
 * Страница модели: по ?id= берёт карточку из catalog.json и характеристики из catalog-specs.json
 * (файлы грузятся в момент открытия, а не зашиты в страницу) и заполняет готовую разметку.
 * Нет модели с таким id — вместо фото показывается сообщение со ссылкой в каталог.
 */
export const initProduct = (): void => {
  const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);

  if (!root) {
    return;
  }

  const id = new URLSearchParams(location.search).get(ID_PARAMETER);
  const error = root.querySelector<HTMLElement>(ERROR_SELECTOR);

  const fail = (reason?: unknown): void => {
    if (error) {
      error.hidden = false;
    }

    root.querySelector<HTMLElement>(MEDIA_SELECTOR)?.setAttribute('hidden', '');

    if (reason) {
      console.error('Страница модели не загрузилась:', reason);
    }
  };

  const fill = async (): Promise<void> => {
    if (!id) {
      fail();

      return;
    }

    const [{ items }, { specs }] = await Promise.all([
      loadCatalog<ProductItem>(),
      loadSpecs<SpecSection>(),
    ]);
    const item = items.find((candidate) => candidate.id === id);

    if (!item) {
      fail();

      return;
    }

    document.title = `${item.model} — ${TITLE_SUFFIX}`;

    const type = root.querySelector<HTMLElement>(TYPE_SELECTOR);
    const title = root.querySelector<HTMLElement>(TITLE_SELECTOR);
    const code = root.querySelector<HTMLElement>(CODE_SELECTOR);
    const status = root.querySelector<HTMLElement>(STATUS_SELECTOR);
    const button = root.querySelector<HTMLElement>(PRICE_BUTTON_SELECTOR);
    const media = root.querySelector<HTMLElement>(MEDIA_SELECTOR);
    const thumbs = root.querySelector<HTMLElement>(THUMBS_SELECTOR);
    const icon = root.querySelector<SVGElement>(ICON_SELECTOR);
    const soon = root.querySelector<HTMLElement>(SOON_SELECTOR);
    const list = document.querySelector<HTMLElement>(SPECS_SELECTOR);

    if (type) {
      type.textContent = item.typeLabel;
    }

    if (title) {
      title.textContent = item.model;
    }

    if (code && item.code) {
      code.textContent = `Код ${item.code}`;
      code.hidden = false;
    }

    if (status) {
      status.textContent = STATUS_LABELS[item.stock.status] ?? '';
      status.classList.toggle('product__status--in', item.stock.status === 'in');
    }

    if (button) {
      button.dataset.modalModel = item.code ? `${item.model} (код ${item.code})` : item.model;
    }

    icon?.querySelector('use')?.setAttribute('href', `#icon-${item.icon}`);

    if (media && thumbs) {
      renderPhotos(media, thumbs, item, () => {
        icon?.remove();
        soon?.remove();
      });
    }

    if (list) {
      const sections = findSpecs(item, items, specs);
      const main = pickMainSpecs(item, sections);
      const options = document.querySelector<HTMLElement>(OPTIONS_SELECTOR);

      renderSpecs(list, main.length > 0 ? main : item.specs);

      if (options) {
        const own = pickOptions(sections);

        renderOptions(options, own.length > 0 ? own : pickCategoryOptions(item, items, specs));
      }
    }
  };

  const start = async (): Promise<void> => {
    try {
      await fill();
    } catch (loadError) {
      fail(loadError);
    }
  };

  void start();
};
