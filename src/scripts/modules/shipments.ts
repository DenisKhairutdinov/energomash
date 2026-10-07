import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';

const ROOT_SELECTOR = '[data-shipments]';
const ITEM_SELECTOR = '[data-shipments-item]';
const IMAGE_SELECTOR = '[data-shipments-image]';
const THUMB_SELECTOR = '[data-shipments-thumb]';
const ACTIVE_CLASS = 'is-active';
const HOVER_QUERY = '(hover: hover)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const BIG_PREFIX = 'big';
const DURATION = 0.7;
const EASE = 'power3.out';

type Side = 'left' | 'right';

const isBig = (item: HTMLElement): boolean => item.dataset.place?.startsWith(BIG_PREFIX) ?? false;

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
    // Сброс оттенка фото у каждой плитки: заполняется ниже, вместе с обработчиками миниатюр
    const resetTone = new Map<HTMLElement, () => void>();

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
        resetTone.get(other)?.();
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

    // Миниатюры: наведение на кадр ставит его оттенок на основное фото плитки (оно плавно перекрашивается,
    // transition filter в стилях). С клавиатуры то же делает фокус, а нажатие ничего не открывает: миниатюры вне ссылки
    for (const item of items) {
      const image = item.querySelector<HTMLImageElement>(IMAGE_SELECTOR);
      const thumbs = [...item.querySelectorAll<HTMLButtonElement>(THUMB_SELECTOR)];

      const select = (thumb: HTMLButtonElement): void => {
        for (const other of thumbs) {
          other.classList.toggle(ACTIVE_CLASS, other === thumb);
        }

        if (image) {
          image.style.filter = thumb.dataset.filter ?? '';
        }
      };

      for (const thumb of thumbs) {
        thumb.addEventListener('pointerenter', () => select(thumb));
        thumb.addEventListener('focus', () => select(thumb));
      }

      // Плитка перестала быть крупной (миниатюры скрылись) — на ней снова оригинальное фото
      resetTone.set(item, () => {
        if (thumbs[0]) {
          select(thumbs[0]);
        }
      });
    }

    for (const item of items) {
      item.addEventListener('pointerenter', () => activate(item));
      item.addEventListener('focusin', () => activate(item));
    }
  }
};
