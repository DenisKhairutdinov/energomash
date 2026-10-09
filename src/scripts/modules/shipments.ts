import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { bindPhotoThumbs, createPhotoSwitcher } from './photo-switcher.ts';

const ROOT_SELECTOR = '[data-shipments]';
const ITEM_SELECTOR = '[data-shipments-item]';
const IMAGE_SELECTOR = '[data-shipments-image]';
const THUMB_SELECTOR = '[data-shipments-thumb]';
const HOVER_QUERY = '(hover: hover)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const BIG_PREFIX = 'big';
const DURATION = 0.7;
const EASE = 'power3.out';

type Side = 'left' | 'right';

const isBig = (item: HTMLElement): boolean => item.dataset.place?.startsWith(BIG_PREFIX) ?? false;

// Фото плитки и её миниатюры; возвращает функцию возврата к первому кадру или ничего, если у плитки нет кадров
const bindTilePhotos = (item: HTMLElement): (() => void) | undefined => {
  const image = item.querySelector<HTMLImageElement>(IMAGE_SELECTOR);
  const thumbs = [...item.querySelectorAll<HTMLButtonElement>(THUMB_SELECTOR)];

  if (!image || thumbs.length === 0) {
    return undefined;
  }

  // Адрес кадра — src картинки миниатюры: в сборке Vite подменяет пути только в src, а не в data-атрибутах
  const sources = thumbs.map((thumb) => thumb.querySelector('img')?.src ?? '');
  const show = createPhotoSwitcher({
    host: image.parentElement ?? item,
    layerClass: 'shipments-bento__layer',
    alt: image.alt,
    styleFrom: image,
  });
  const select = bindPhotoThumbs(thumbs, (index) =>
    show({ preview: sources[index], full: sources[index] }),
  );

  return () => select(0);
};

/**
 * Отгрузки: плитка под курсором раскрывается до размера крупной и показывает характеристики.
 * Она растёт от своего края, поэтому остаётся под курсором, а две другие встают столбиком
 * с противоположной стороны. Расстановку задаёт data-place, стили — в shipments-bento.scss.
 */
export const initShipments = (): void => {
  const roots = document.querySelectorAll<HTMLElement>(ROOT_SELECTOR);

  if (roots.length === 0 || !matchMedia(HOVER_QUERY).matches) {
    return;
  }

  gsap.registerPlugin(Flip);

  const reducedMotion = matchMedia(REDUCED_MOTION_QUERY);

  for (const root of roots) {
    const items = [...root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
    let isAnimating = false;
    // Возврат первого кадра у каждой плитки: заполняется ниже, вместе с обработчиками миниатюр
    const resetPhoto = new Map<HTMLElement, () => void>();

    const activate = (item: HTMLElement): void => {
      if (isAnimating || isBig(item)) {
        return;
      }

      const side: Side = item.dataset.place?.endsWith('left') ? 'left' : 'right';
      const oppositeSide: Side = side === 'left' ? 'right' : 'left';
      const others = items.filter((other) => other !== item);
      const state = Flip.getState(items);

      item.dataset.place = `${BIG_PREFIX}-${side}`;

      for (const [index, other] of others.entries()) {
        other.dataset.place = `${index === 0 ? 'top' : 'bottom'}-${oppositeSide}`;
        resetPhoto.get(other)?.();
      }

      isAnimating = true;

      Flip.from(state, {
        duration: reducedMotion.matches ? 0 : DURATION,
        ease: EASE,
        absolute: true,
        onComplete: () => {
          isAnimating = false;

          // Пока плитки ехали, курсор мог уйти на другую: раскрываем ту, что под ним сейчас
          const hovered = items.find((other) => other.matches(':hover'));

          if (hovered) {
            activate(hovered);
          }
        },
      });
    };

    // Миниатюры: тот же показ слоями и те же события (наведение, фокус, клик), что у миниатюр на странице модели.
    // Нажатие ничего не открывает: миниатюры вне ссылки
    for (const item of items) {
      // Плитка перестала быть крупной (миниатюры скрылись) — на ней снова первый кадр
      const reset = bindTilePhotos(item);

      if (reset) {
        resetPhoto.set(item, reset);
      }
    }

    for (const item of items) {
      item.addEventListener('pointerenter', () => activate(item));
      item.addEventListener('focusin', () => activate(item));
    }
  }
};
