import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

const SECTION_SELECTOR = '[data-fullpage-section]';
const HEADER_SELECTOR = '[data-header]';
const FORM_FIELDS_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const DESKTOP_QUERY = '(min-width: 1200px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DURATION = 0.7;
// Кривая без разгона: страница трогается сразу после жеста и плавно тормозит у цели
const EASE = 'power3.out';
const SCROLLING_CLASS = 'is-scrolling';
const ACTIVE_CLASS = 'has-fullpage';
const INDICATOR_CLASS = 'page-indicator';

const getSections = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(SECTION_SELECTOR),
];

/**
 * Индикатор секций у правого края: по делению на секцию, текущее выделено.
 * Клик по делению переводит на секцию. Подписи берутся из data-fullpage-label.
 */
const createIndicator = (
  sections: HTMLElement[],
  onSelect: (index: number) => void,
): HTMLElement => {
  const indicator = document.createElement('nav');

  indicator.className = INDICATOR_CLASS;
  indicator.setAttribute('aria-label', 'Секции страницы');

  for (const [index, section] of sections.entries()) {
    const title = section.dataset.fullpageLabel ?? `Секция ${index + 1}`;
    const button = document.createElement('button');
    const label = document.createElement('span');

    button.type = 'button';
    button.className = `${INDICATOR_CLASS}__item`;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', () => onSelect(index));

    label.className = `${INDICATOR_CLASS}__label`;
    label.setAttribute('aria-hidden', 'true');
    label.textContent = title;

    button.append(label);
    indicator.append(button);
  }

  return indicator;
};

export const hasFullpageSections = (): boolean => getSections().length > 1;

/**
 * Постраничная прокрутка: колесо, свайп и клавиши листают секции целиком.
 * Работает только на десктопе, на остальных ширинах страница скроллится как обычно.
 */
export const initFullpage = (): void => {
  const sections = getSections();

  if (sections.length < 2) {
    return;
  }

  gsap.registerPlugin(Observer, ScrollToPlugin);

  const header = document.querySelector<HTMLElement>(HEADER_SELECTOR);
  const reducedMotion = matchMedia(REDUCED_MOTION_QUERY);

  let currentIndex = 0;
  let isAnimating = false;
  let indicator: HTMLElement | undefined;

  const updateIndicator = (): void => {
    const activeIndex = Math.min(currentIndex, sections.length - 1);

    for (const [index, button] of [...(indicator?.children ?? [])].entries()) {
      // eslint-disable-next-line unicorn/no-null -- null снимает атрибут aria-current
      button.ariaCurrent = index === activeIndex ? 'true' : null;
    }
  };

  // Точки остановки: верх каждой секции под шапкой и конец страницы, если после секций есть контент
  const getStops = (): number[] => {
    const headerHeight = header?.offsetHeight ?? 0;
    const maxScroll = Math.max(document.documentElement.scrollHeight - innerHeight, 0);
    const stops = sections.map((section) => {
      const top = section.getBoundingClientRect().top + scrollY - headerHeight;

      return gsap.utils.clamp(0, maxScroll, Math.round(top));
    });
    const lastStop = stops.at(-1) ?? 0;

    if (maxScroll - lastStop > 1) {
      stops.push(maxScroll);
    }

    return stops;
  };

  const getNearestIndex = (): number => {
    const stops = getStops();
    let nearestIndex = 0;

    for (const [index, stop] of stops.entries()) {
      if (Math.abs(stop - scrollY) < Math.abs(stops[nearestIndex] - scrollY)) {
        nearestIndex = index;
      }
    }

    return nearestIndex;
  };

  const goTo = (index: number, isImmediate = false): void => {
    const stops = getStops();
    const nextIndex = gsap.utils.clamp(0, stops.length - 1, index);

    if (isAnimating || (nextIndex === currentIndex && !isImmediate)) {
      return;
    }

    currentIndex = nextIndex;
    isAnimating = true;
    updateIndicator();
    // Пока страница едет, секции не реагируют на курсор: иначе под неподвижной мышью
    // срабатывают ховеры (аккордеон, заливки карточек) и перерисовка мешает прокрутке
    document.documentElement.classList.add(SCROLLING_CLASS);

    gsap.to(globalThis, {
      scrollTo: { y: stops[nextIndex], autoKill: false },
      duration: isImmediate || reducedMotion.matches ? 0 : DURATION,
      ease: EASE,
      overwrite: true,
      onComplete: () => {
        isAnimating = false;
        document.documentElement.classList.remove(SCROLLING_CLASS);
      },
    });
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    const target = event.target instanceof Element ? event.target : undefined;

    if (target?.closest(FORM_FIELDS_SELECTOR) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const targetIndexByKey: Record<string, number> = {
      ArrowDown: currentIndex + 1,
      PageDown: currentIndex + 1,
      ArrowUp: currentIndex - 1,
      PageUp: currentIndex - 1,
      Home: 0,
      End: getStops().length - 1,
    };
    const targetIndex = targetIndexByKey[event.key];

    if (targetIndex === undefined) {
      return;
    }

    event.preventDefault();
    goTo(targetIndex);
  };

  // После изменения размеров окна высота секций меняется — возвращаемся ровно на текущую
  const handleResize = (): void => {
    isAnimating = false;
    goTo(currentIndex, true);
  };

  gsap.matchMedia().add(DESKTOP_QUERY, () => {
    currentIndex = getNearestIndex();
    goTo(currentIndex, true);

    const observer = Observer.create({
      target: document,
      type: 'wheel,touch',
      wheelSpeed: -1,
      tolerance: 10,
      preventDefault: true,
      onUp: () => goTo(currentIndex + 1),
      onDown: () => goTo(currentIndex - 1),
    });

    // Индикатор заменяет полосу прокрутки: при постраничном листании она ничего не сообщает
    indicator = createIndicator(sections, (index) => goTo(index));
    document.body.append(indicator);
    document.documentElement.classList.add(ACTIVE_CLASS);
    updateIndicator();

    addEventListener('keydown', handleKeydown);
    addEventListener('resize', handleResize);

    return () => {
      observer.kill();
      indicator?.remove();
      indicator = undefined;
      document.documentElement.classList.remove(ACTIVE_CLASS);
      removeEventListener('keydown', handleKeydown);
      removeEventListener('resize', handleResize);
    };
  });
};
