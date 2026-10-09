import { gsap } from 'gsap';

const GROUP_SELECTOR = '[data-reveal-group]';
const ITEM_SELECTOR = '[data-reveal]';
const IMAGE_SELECTOR = '[data-reveal-image]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Одна сдержанная манера на весь сайт, три приёма (выбор по элементу, см. getKind):
// — lift: текст и мелкие элементы чуть поднимаются и проявляются;
// — mask: заголовки h1/h2 «открываются» сверху вниз под маской, как набранная строка на плашке;
// — wipe: крупные панели и карта раскрываются слева направо шторкой, как фото на сайте.
// Все кривые с долгим мягким торможением (expo): движение стартует резко и садится без рывка, выглядит «дорогим»
const LIFT_OFFSET = 20;
const LIFT_DURATION = 1.1;
const MASK_OFFSET = 36;
const MASK_DURATION = 1.25;
const WIPE_DURATION = 1.4;
const STAGGER = 0.08;
const LIFT_EASE = 'expo.out';
const WIPE_EASE = 'power4.inOut';
// Рамка маски чуть больше элемента, чтобы маска не срезала выносные элементы букв и межстрочный интервал
const MASK_HIDDEN = 'inset(0% 0% 100% 0%)';
const MASK_SHOWN = 'inset(-8% -2% -8% -2%)';
const WIPE_HIDDEN = 'inset(0% 100% 0% 0%)';
const WIPE_SHOWN = 'inset(0% 0% 0% 0%)';
const WIPE_VALUE = 'wipe';
const HEADING_TAGS = new Set(['H1', 'H2']);
const IMAGE_SCALE = 1.06;
const IMAGE_DURATION = 1.8;
// Секция появляется, когда вошла в экран на четверть, и уходит, когда скрылась на четверть:
// обе анимации успевают начаться, пока секция ещё хорошо видна
const ENTER_SHARE = 0.25;
const LEAVE_SHARE = 0.75;
// Уход быстрее появления: секция уезжает за полсекунды и не должна успеть мелькнуть полупустой
const LEAVE_TIME_SCALE = 1.6;

// У секции две шкалы: элементы и фоновое изображение. Они раздельные, чтобы при уходе
// элементы начинали гаснуть сразу, а не ждали, пока отыграет более долгое масштабирование фона
const timelines = new Map<Element, gsap.core.Timeline[]>();

/**
 * Подключает к секции фотографии, появившиеся уже после запуска (слайды «Техники в наличии» собираются из каталога):
 * они получают то же приближение при появлении секции, что и фон hero. Без секции или при «уменьшить движение» ничего не делает.
 */
export const addRevealImages = (group: Element, targets: Element[]): void => {
  const images = timelines.get(group)?.[1];

  if (images && targets.length > 0) {
    images.fromTo(
      targets,
      { scale: IMAGE_SCALE },
      { scale: 1, duration: IMAGE_DURATION, ease: 'power2.out' },
      0,
    );
  }
};

const getKind = (element: HTMLElement): 'lift' | 'mask' | 'wipe' => {
  if (element.dataset.reveal === WIPE_VALUE) {
    return 'wipe';
  }

  return HEADING_TAGS.has(element.tagName) ? 'mask' : 'lift';
};

const addItem = (timeline: gsap.core.Timeline, target: HTMLElement, position: number): void => {
  const kind = getKind(target);

  if (kind === 'wipe') {
    timeline.fromTo(
      target,
      { autoAlpha: 1, clipPath: WIPE_HIDDEN },
      {
        clipPath: WIPE_SHOWN,
        duration: WIPE_DURATION,
        ease: WIPE_EASE,
        // Оставшийся clip-path делает элемент «корнем фона» и ломает backdrop-filter у вложенных блоков:
        // после раскрытия обрезка снимается совсем (при обратном ходе GSAP вернёт её сам)
        onComplete: () => {
          target.style.clipPath = 'none';
        },
      },
      position,
    );
  } else if (kind === 'mask') {
    timeline.fromTo(
      target,
      { autoAlpha: 1, clipPath: MASK_HIDDEN, y: MASK_OFFSET },
      { clipPath: MASK_SHOWN, y: 0, duration: MASK_DURATION, ease: LIFT_EASE },
      position,
    );
  } else {
    timeline.fromTo(
      target,
      { autoAlpha: 0, y: LIFT_OFFSET },
      { autoAlpha: 1, y: 0, duration: LIFT_DURATION, ease: LIFT_EASE },
      position,
    );
  }
};

/**
 * Появление содержимого секций: элементы по очереди проявляются каждый раз, когда секция входит в экран,
 * и в обратном порядке возвращаются в исходное состояние, когда она уходит вверх или вниз.
 */
export const initReveal = (): void => {
  const groups = [...document.querySelectorAll<HTMLElement>(GROUP_SELECTOR)];

  if (groups.length === 0 || matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  const lastShares = new Map<Element, number>();

  for (const group of groups) {
    const itemTargets = group.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    const imageTargets = group.querySelectorAll<HTMLElement>(IMAGE_SELECTOR);
    const items = gsap.timeline({ paused: true });
    const images = gsap.timeline({ paused: true });

    // Элементы встают в шкалу в порядке разметки с одним шагом, у каждого приём по его виду
    for (const [index, target] of [...itemTargets].entries()) {
      addItem(items, target, index * STAGGER);
    }

    if (imageTargets.length > 0) {
      images.fromTo(
        imageTargets,
        { scale: IMAGE_SCALE },
        { scale: 1, duration: IMAGE_DURATION, ease: 'power2.out' },
      );
    }

    timelines.set(group, [items, images]);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const share = entry.intersectionRatio;
        const lastShare = lastShares.get(entry.target) ?? 0;
        const isEntering = share > lastShare && share >= ENTER_SHARE;
        const isLeaving = share < lastShare && share <= LEAVE_SHARE;

        const groupTimelines = timelines.get(entry.target) ?? [];

        lastShares.set(entry.target, share);

        for (const timeline of groupTimelines) {
          if (isEntering) {
            timeline.timeScale(1).play();
          } else if (isLeaving) {
            timeline.timeScale(LEAVE_TIME_SCALE).reverse();
          }
        }
      }
    },
    { threshold: [ENTER_SHARE, LEAVE_SHARE] },
  );

  for (const group of groups) {
    observer.observe(group);
  }
};
