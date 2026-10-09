import { photoUrl } from './catalog-data.ts';

const PRODUCT_URL = '/product.html?id=';
const STOCK_IN = 'in';
const STOCK_BADGE = 'В наличии';

export interface CardItem {
  id: string;
  photos: string[];
  model: string;
  code: string | null;
  typeLabel: string;
  icon: string;
  stock: { status: string };
  specs: [string, string | number][];
}

/**
 * Карточка из заготовки (templates/product-card.njk, режим template): силуэт типа техники, плашка наличия,
 * название, ссылка и характеристики. Общая для каталога и блока «Похожие модели» на странице модели.
 */
export const createProductCard = (
  template: HTMLTemplateElement,
  item: CardItem,
): DocumentFragment => {
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
