import { loadCatalog, originalPhotoUrl, photoUrl } from './catalog-data.ts';

const ROOT_SELECTOR = '[data-slider]';
const COUNT_SELECTOR = '[data-stock-count]';
const COUNT_VALUE_SELECTOR = '[data-stock-count-value]';
const COUNT_LABEL_SELECTOR = '[data-stock-count-label]';
const TRACK_SELECTOR = '[data-stock-track]';
const TEMPLATE_SELECTOR = '[data-stock-slide-template]';
const REST_SELECTOR = '[data-stock-rest]';
const REST_TITLE_SELECTOR = '[data-stock-rest-title]';
const ACTIVE_CLASS = 'is-active';
const PRODUCT_URL = '/product.html?id=';
const MAX_SPECS = 4;
const SHAPES: Record<string, string> = { case: 'чемодан', round: 'круг' };

interface StockItem {
  id: string;
  model: string;
  typeLabel: string;
  photos: string[];
  specs: [string, string][];
  params: {
    volume: number | null;
    axles: string | null;
    shape: string | null;
    sections: string | null;
  };
  stock: { status: string };
}

// «модель» в нужной форме после числа: 1 модель, 3 модели, 24 модели, 120 моделей
const modelsWord = (count: number): string => {
  const tail = count % 100;

  if (tail > 10 && tail < 20) {
    return 'моделей';
  }

  const last = count % 10;

  if (last === 1) {
    return 'модель';
  }

  return last > 1 && last < 5 ? 'модели' : 'моделей';
};

const query = <Element extends HTMLElement>(
  parent: ParentNode,
  selector: string,
): Element | undefined => parent.querySelector<Element>(selector) ?? undefined;

// Подборка слайдера выбрана вручную, по порядку показа: полуприцеп для технической воды, ППЦ-28, АЦПТ-10, АТЗ
// и большой круглый полуприцеп для нефти (ППЦН-38ТК: такой модели на складе нет, она под заказ — плашка на слайде
// это показывает). Каждая запись — шаблон названия модели; берётся первая подходящая техника с фото,
// в наличии — вперёд. Нет такой — слайд пропускается
const SLIDE_MODELS = [/^ППЦТВ-26/, /^ППЦ-28/, /^АЦПТ-10\//, /^АТЗ-12/, /^ППЦН-38ТК-П3-BPW/];
const BADGES: Record<string, string> = {
  in: 'В наличии',
  expected: 'Ожидается',
  order: 'Под заказ',
};

const STOCK_IN = 'in';

const pickSlides = (available: StockItem[]): StockItem[] =>
  SLIDE_MODELS.flatMap((pattern) => {
    const matches = available.filter((candidate) => pattern.test(candidate.model));
    const item = matches.find((candidate) => candidate.stock.status === STOCK_IN) ?? matches[0];

    return item ? [item] : [];
  });

const normalizeName = (name: string): string => name.toLowerCase().replaceAll(/[\s\-_.,()]/g, '');

// Сечение у позиции склада берётся у модели каталога, чьё название — начало названия позиции
// («ППЦ-28/3-Р3-PLT-1500» → модель «ППЦ-28/3-Р»); из подходящих выбирается самая длинная
const findShape = (item: StockItem, items: StockItem[]): string | undefined => {
  const name = normalizeName(item.model);
  const parents = items
    .filter(
      (candidate) =>
        candidate.params.shape !== null &&
        candidate.id.startsWith('model-') &&
        name.startsWith(normalizeName(candidate.model)),
    )
    .toSorted((a, b) => b.model.length - a.model.length);

  return parents[0]?.params.shape ?? undefined;
};

// У позиций склада без модели сечения в данных нет, но «ТК» в названии (ППЦН-32ТК) у всех таких моделей
// каталога означает круглую цистерну — у остальных моделей с этим суффиксом сечение «круг»
const shapeFromName = (model: string): string | undefined =>
  /\dТК/.test(model) ? SHAPES.round : undefined;

// Те же четыре характеристики и в том же порядке, что в плитках «Недавно отгруженной техники»:
// объём, оси, сечение, секции. У техники на шасси осей и сечения в данных нет — их место занимают
// другие характеристики из карточки (шасси, привод насоса…), чтобы ряд оставался полным
const buildSpecs = (item: StockItem, parentShape: string | undefined): [string, string][] => {
  const { volume, axles, shape, sections } = item.params;
  const wanted: [string, string | undefined][] = [
    ['Объём', volume ? `${volume} м³` : undefined],
    ['Осей', axles ?? undefined],
    ['Сечение', SHAPES[shape ?? parentShape ?? ''] ?? shapeFromName(item.model)],
    ['Секций', sections ?? undefined],
  ];
  const specs = wanted.filter((spec): spec is [string, string] => spec[1] !== undefined);
  const used = new Set(specs.map(([label]) => label));

  for (const spec of item.specs) {
    if (specs.length < MAX_SPECS && !used.has(spec[0])) {
      specs.push(spec);
    }
  }

  return specs.slice(0, MAX_SPECS);
};

const createSlide = (
  template: HTMLTemplateElement,
  item: StockItem,
  parentShape: string | undefined,
): HTMLElement | undefined => {
  const slide = (template.content.cloneNode(true) as DocumentFragment).firstElementChild;
  // Максимальное качество: исходный снимок; если он не открылся (пустой файл) — превью
  const source = item.photos
    .map((name) => originalPhotoUrl(name) ?? photoUrl(name))
    .find((url) => url !== undefined);

  if (!source || !(slide instanceof HTMLElement)) {
    return undefined;
  }

  const image = query<HTMLImageElement>(slide, '[data-slide-image]');
  const link = query<HTMLAnchorElement>(slide, '[data-slide-link]');
  const specs = query(slide, '[data-slide-specs]');
  const sample = query(slide, '[data-slide-spec]');

  if (image) {
    image.src = source;
    image.alt = `${item.typeLabel} ${item.model}`;
  }

  if (link) {
    link.href = `${PRODUCT_URL}${encodeURIComponent(item.id)}`;
  }

  query(slide, '[data-slide-badge]')?.replaceChildren(BADGES[item.stock.status] ?? BADGES.in);
  query(slide, '[data-slide-type]')?.replaceChildren(item.typeLabel);
  query(slide, '[data-slide-model]')?.replaceChildren(item.model);

  if (specs && sample) {
    specs.replaceChildren(
      ...buildSpecs(item, parentShape).map(([label, value]) => {
        const spec = sample.cloneNode(true) as HTMLElement;

        query(spec, '[data-slide-spec-label]')?.replaceChildren(label);
        query(spec, '[data-slide-spec-value]')?.replaceChildren(value);

        return spec;
      }),
    );
  }

  return slide;
};

/**
 * Блок «Техника в наличии» собирается из каталога, а не из разметки: слайды — разная техника в наличии с фото,
 * слева — сколько моделей на складе, на последнем слайде — «Ещё N моделей» (всё, чего нет в подборке).
 * Возвращает промис, который выполняется, когда слайды на месте: после него можно запускать слайдер.
 */
export const initStockSlides = async (): Promise<void> => {
  const root = query(document, ROOT_SELECTOR);
  const track = root ? query(root, TRACK_SELECTOR) : undefined;
  const template = root ? query<HTMLTemplateElement>(root, TEMPLATE_SELECTOR) : undefined;

  if (!root || !track || !template) {
    return;
  }

  try {
    const { items } = await loadCatalog<StockItem>();
    const inStock = items.filter((item) => item.stock.status === STOCK_IN);
    const picked = pickSlides(items.filter((item) => item.photos.some((name) => photoUrl(name))));
    const slides = picked
      .map((item) => createSlide(template, item, findShape(item, items)))
      .filter((slide): slide is HTMLElement => slide !== undefined);

    for (const [index, slide] of slides.entries()) {
      slide.classList.toggle(ACTIVE_CLASS, index === 0);

      // Переход к остальной технике остаётся только на последнем слайде
      if (index < slides.length - 1) {
        query(slide, REST_SELECTOR)?.remove();
      }
    }

    track.replaceChildren(...slides);

    // Панель на всех слайдах одной ширины — по самой широкой: иначе от слайда к слайду она прыгала бы.
    // Мерить можно только после загрузки шрифтов, иначе ширина названий окажется чужой
    void document.fonts.ready.then(() => {
      const widths = slides.map((slide) => query(slide, '[data-slider-panel]')?.offsetWidth ?? 0);

      track.style.setProperty('--stock-panel-width', `${Math.max(...widths)}px`);
    });

    const count = query(root, COUNT_SELECTOR);
    const value = count ? query(count, COUNT_VALUE_SELECTOR) : undefined;
    const label = count ? query(count, COUNT_LABEL_SELECTOR) : undefined;

    if (count && value && label) {
      value.textContent = String(inStock.length);
      label.textContent = `${modelsWord(inStock.length)} на складе`;
      count.hidden = false;
    }

    // Остальное — то, что не попало в подборку слайдера
    const others = inStock.length - picked.filter((item) => item.stock.status === STOCK_IN).length;
    const rest = query<HTMLAnchorElement>(root, REST_SELECTOR);
    const title = rest ? query(rest, REST_TITLE_SELECTOR) : undefined;

    if (rest && title && others > 0) {
      title.textContent = `Ещё ${others} ${modelsWord(others)}`;
      rest.hidden = false;
    }
  } catch (error) {
    console.error('Техника в наличии не загрузилась:', error);
  }
};
