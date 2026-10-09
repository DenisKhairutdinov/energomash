const LOADED_CLASS = 'is-loaded';
const ACTIVE_CLASS = 'is-active';
// Старые слои убираются, когда новый уже проявился: смена кадра перетекает, а не мигает
const CLEANUP_DELAY = 1400;

export interface PhotoSource {
  /**
  Лёгкое превью: миниатюра и запасной кадр, если основной не открылся
  */
  preview: string;
  /**
  Основное фото
  */
  full: string;
}

interface SwitcherOptions {
  /**
  Контейнер, куда ложатся слои с фото
  */
  host: HTMLElement;
  /**
  Класс слоя: стили задают ему opacity: 0 и opacity: 1 для .is-loaded
  */
  layerClass: string;
  alt: string;
  /**
  Элемент, чьи inline-стили (например, --focus) копируются на каждый слой
  */
  styleFrom?: HTMLElement;
  /**
  Вызывается, когда очередной слой загрузился
  */
  onShown?: () => void;
}

/**
 * Показ фото слоями, общий для страницы модели и плиток «Недавно отгруженной техники»:
 * каждое фото — отдельный <img>, новое проявляется поверх прежнего, затем лишние слои убираются.
 */
export const createPhotoSwitcher = ({
  host,
  layerClass,
  alt,
  styleFrom,
  onShown,
}: SwitcherOptions): ((source: PhotoSource) => void) => {
  let current: HTMLImageElement | undefined;

  return ({ preview, full }) => {
    const image = document.createElement('img');

    image.className = layerClass;
    image.alt = alt;
    image.decoding = 'async';

    if (styleFrom?.getAttribute('style')) {
      image.setAttribute('style', styleFrom.getAttribute('style') ?? '');
    }

    image.addEventListener(
      'load',
      () => {
        onShown?.();
        current = image;
        image.classList.add(LOADED_CLASS);
        setTimeout(() => {
          // Убираются только слои под текущим: слой выше (он ещё грузится или открывается) нужно оставить,
          // иначе при быстром переключении фото не менялось бы
          for (const layer of host.querySelectorAll(`.${layerClass}`)) {
            if (layer === current) {
              break;
            }

            layer.remove();
          }
        }, CLEANUP_DELAY);
      },
      { once: true },
    );
    image.addEventListener(
      'error',
      () => {
        image.src = preview;
      },
      { once: true },
    );
    image.src = full;
    host.append(image);
  };
};

/**
 * Миниатюры: фото меняется при наведении (и при фокусе с клавиатуры), клик оставлен для сенсорных экранов.
 * Возвращает функцию выбора по номеру — ей же плитка возвращает первый кадр, когда миниатюры скрываются.
 */
export const bindPhotoThumbs = (
  buttons: HTMLButtonElement[],
  onSelect: (index: number) => void,
): ((index: number) => void) => {
  const select = (index: number): void => {
    if (buttons[index]?.classList.contains(ACTIVE_CLASS)) {
      return;
    }

    for (const [position, button] of buttons.entries()) {
      button.classList.toggle(ACTIVE_CLASS, position === index);
    }

    onSelect(index);
  };

  for (const [index, button] of buttons.entries()) {
    button.addEventListener('pointerenter', () => select(index));
    button.addEventListener('focus', () => select(index));
    button.addEventListener('click', () => select(index));
  }

  return select;
};
