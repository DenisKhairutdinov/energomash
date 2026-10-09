import { gsap } from 'gsap';
import { photoUrl } from './catalog-data.ts';
import { type CardItem, createProductCard } from './product-card.ts';

const SECTION_SELECTOR = '[data-product-related]';
const LIST_SELECTOR = '[data-related-list]';
const TEMPLATE_SELECTOR = '[data-related-template]';
const MORE_SELECTOR = '[data-related-more]';
const TRUST_SELECTOR = '[data-product-trust]';
const TRUST_ITEM_SELECTOR = '[data-trust-item]';
const CTA_SELECTOR = '[data-product-cta]';
const CARD_SELECTOR = '.product-card';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CATALOG_URL = '/catalog.html?type=';
const RELATED_LIMIT = 6;
// Модель входит в подборку, когда секции видна наполовину: к этому моменту листание успевает почти закончиться
const VISIBLE_SHARE = 0.4;
const STOCK_IN = 'in';
// Признак навесного оборудования: у машин в этом поле другие значения (например, chassis)
const KIT_VALUE = 'kit';
// Весы подбора: назначение важнее всего, затем наличие и фото, затем близость по объёму
const SCORE_PURPOSE = 4;
const SCORE_STOCK = 2;
const SCORE_PHOTO = 2;
const SCORE_VOLUME = 3;
const VOLUME_STEP = 3;

export interface RelatedItem extends CardItem {
  type: string;
  purpose: string;
  params: Record<string, unknown>;
}

const volumeOf = (item: RelatedItem): number => {
  const value = Number(item.params.volume);

  return Number.isFinite(value) ? value : 0;
};

// Чем выше балл, тем больше модель похожа на текущую: тот же тип обязателен, дальше — назначение, наличие,
// наличие фото и близкий объём. Позиции с навесным оборудованием и одноимённые модели в подборку не попадают
const score = (candidate: RelatedItem, current: RelatedItem): number =>
  (candidate.purpose === current.purpose ? SCORE_PURPOSE : 0) +
  (candidate.stock.status === STOCK_IN ? SCORE_STOCK : 0) +
  (candidate.photos.length > 0 ? SCORE_PHOTO : 0) +
  Math.max(0, SCORE_VOLUME - Math.abs(volumeOf(candidate) - volumeOf(current)) / VOLUME_STEP);

const pickRelated = (current: RelatedItem, items: RelatedItem[]): RelatedItem[] => {
  const seen = new Set([current.model]);

  return items
    .filter(
      (item) =>
        item.type === current.type && item.id !== current.id && item.params.kit !== KIT_VALUE,
    )
    .toSorted((a, b) => score(b, current) - score(a, current))
    .filter((item) => {
      if (seen.has(item.model)) {
        return false;
      }

      seen.add(item.model);

      return true;
    })
    .slice(0, RELATED_LIMIT);
};

// Блок появляется, когда секция въезжает в экран: карточки и пункты поднимаются снизу по очереди.
// До этого они спрятаны, чтобы не мелькать на невидимой части страницы
const revealOnView = (section: Element, targets: Element[], delayStep: number): void => {
  if (targets.length === 0 || matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  gsap.set(targets, { opacity: 0, y: 40 });

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.every((entry) => !entry.isIntersecting)) {
        return;
      }

      observer.disconnect();
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: delayStep,
        clearProps: 'opacity,transform',
      });
    },
    { threshold: VISIBLE_SHARE },
  );

  observer.observe(section);
};

/**
 * Блоки под первым экраном страницы модели: «Похожие модели» (подборка из каталога) и «Почему Энергомаш»
 * (преимущества и порядок заказа: он статичный, здесь только появление и название модели для кнопки цены).
 */
export const renderRelated = (
  current: RelatedItem,
  items: RelatedItem[],
  modelLabel: string,
): void => {
  const section = document.querySelector<HTMLElement>(SECTION_SELECTOR);
  const list = section?.querySelector<HTMLElement>(LIST_SELECTOR);
  const template = section?.querySelector<HTMLTemplateElement>(TEMPLATE_SELECTOR);
  const more = section?.querySelector<HTMLAnchorElement>(MORE_SELECTOR);

  if (section && list && template) {
    const related = pickRelated(current, items);

    if (related.length === 0) {
      // Похожих моделей нет — блока нет совсем: экран убирается до запуска постраничной прокрутки (main.ts)
      section.remove();
    } else {
      if (more) {
        more.href = `${CATALOG_URL}${encodeURIComponent(current.type)}`;
      }

      list.replaceChildren(...related.map((item) => createProductCard(template, item)));
      revealOnView(section, [...list.querySelectorAll(CARD_SELECTOR)], 0.08);
    }
  }

  const trust = document.querySelector<HTMLElement>(TRUST_SELECTOR);
  const cta = trust?.querySelector<HTMLElement>(CTA_SELECTOR);

  if (cta) {
    cta.dataset.modalModel = modelLabel;
  }

  if (trust) {
    // Фон блока — фото текущей модели; без фото остаётся запасной кадр из стилей
    const photo = current.photos[0] ? photoUrl(current.photos[0]) : undefined;

    if (photo) {
      trust.style.setProperty('--trust-photo', `url("${photo}")`);
    }

    revealOnView(trust, [...trust.querySelectorAll(TRUST_ITEM_SELECTOR)], 0.07);
  }
};
