import { gsap } from 'gsap';

const GROUP_SELECTOR = '[data-reveal-group]';
const ITEM_SELECTOR = '[data-reveal]';
const IMAGE_SELECTOR = '[data-reveal-image]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Одна сдержанная манера на весь сайт: короткий подъём с проявлением и плавным торможением
const OFFSET = 24;
const DURATION = 0.9;
const STAGGER = 0.07;
const EASE = 'power3.out';
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

    // В секции может не быть элементов или фона: пустую цель GSAP не принимает и пишет предупреждение
    if (itemTargets.length > 0) {
      items.fromTo(
        itemTargets,
        { autoAlpha: 0, y: OFFSET },
        { autoAlpha: 1, y: 0, duration: DURATION, ease: EASE, stagger: STAGGER },
      );
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
