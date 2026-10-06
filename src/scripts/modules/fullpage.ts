import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

const SECTION_SELECTOR = '[data-fullpage-section]';
// Область с собственной прокруткой внутри секции. Значение main — основная: она прокручивается,
// где бы ни стоял курсор, остальные — только под курсором
const SCROLLER_SELECTOR = '[data-fullpage-scroller]';
const MAIN_SCROLLER_SELECTOR = '[data-fullpage-scroller="main"]';
const HEADER_SELECTOR = '[data-header]';
const FORM_FIELDS_SELECTOR = 'input, textarea, select, [contenteditable="true"]';
const DESKTOP_QUERY = '(min-width: 1200px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DURATION = 0.7;
// Кривая без разгона: страница трогается сразу после жеста и плавно тормозит у цели
const EASE = 'power3.out';
const INNER_DURATION = 0.6;
// Пауза между событиями колеса, после которой жест считается новым, мс
const GESTURE_GAP = 180;
const KEY_STEP = 160;
const PAGE_KEY_SHARE = 0.9;
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
 * Секция с внутренней областью прокрутки сначала плавно доматывается до края и только потом листается.
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
  let lastInputTime = 0;
  // Жест начался, когда внутренняя область уже стояла у края: только такой жест листает секцию.
  // Иначе инерция тачпада, домотав карточки до конца, тут же уводила бы на следующий экран
  let isGestureAtEdge = true;
  // Остаток жеста после перехода между секциями не должен прокручивать внутреннюю область
  let isGestureSpent = false;
  // Куда едет каждая область: новые шаги прибавляются к цели, а не к текущему положению
  const innerTargets = new Map<HTMLElement, number>();

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
    isGestureSpent = true;
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

  const canScroll = (scroller: HTMLElement, direction: number): boolean => {
    const position = innerTargets.get(scroller) ?? scroller.scrollTop;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;

    return direction > 0 ? position < maxScroll - 1 : position > 1;
  };

  // Область, которую ещё можно прокрутить в эту сторону: сначала та, что под курсором, затем основная
  const findScroller = (target: EventTarget | null | undefined, direction: number) => {
    const section = sections[Math.min(currentIndex, sections.length - 1)];
    const hovered =
      target instanceof Element ? target.closest<HTMLElement>(SCROLLER_SELECTOR) : undefined;
    const candidates = [
      hovered && section.contains(hovered) ? hovered : undefined,
      section.querySelector<HTMLElement>(MAIN_SCROLLER_SELECTOR) ?? undefined,
    ];

    return candidates.find(
      (scroller): scroller is HTMLElement => !!scroller && canScroll(scroller, direction),
    );
  };

  const scrollInner = (scroller: HTMLElement, distance: number): void => {
    const position = innerTargets.get(scroller) ?? scroller.scrollTop;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const target = gsap.utils.clamp(0, maxScroll, position + distance);

    if (reducedMotion.matches) {
      gsap.killTweensOf(scroller);
      scroller.scrollTop = target;

      return;
    }

    // Цель забывается, когда область доехала или её остановили: дальше отсчёт идёт от фактического положения
    const forgetTarget = (): void => {
      if (innerTargets.get(scroller) === target) {
        innerTargets.delete(scroller);
      }
    };

    gsap.to(scroller, {
      scrollTo: { y: target, autoKill: false },
      duration: INNER_DURATION,
      ease: EASE,
      overwrite: true,
      onComplete: forgetTarget,
      onInterrupt: forgetTarget,
    });
    innerTargets.set(scroller, target);
  };

  // Шаг прокрутки: сначала внутренняя область секции, и только у её края — переход на соседнюю секцию
  const step = (
    direction: 1 | -1,
    distance: number,
    target?: EventTarget | null,
    isGesture = true,
  ): void => {
    if (isGesture) {
      const now = performance.now();

      if (now - lastInputTime > GESTURE_GAP) {
        isGestureSpent = false;
        isGestureAtEdge = !findScroller(target, direction);
      }

      lastInputTime = now;
    }

    if (isAnimating) {
      return;
    }

    const scroller = findScroller(target, direction);

    if (scroller) {
      if (!isGesture || !isGestureSpent) {
        scrollInner(scroller, direction * distance);
      }

      return;
    }

    if (!isGesture || isGestureAtEdge) {
      goTo(currentIndex + direction);
    }
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    const target = event.target instanceof Element ? event.target : undefined;

    if (target?.closest(FORM_FIELDS_SELECTOR) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const pageDistance = innerHeight * PAGE_KEY_SHARE;
    const actionByKey: Record<string, () => void> = {
      ArrowDown: () => step(1, KEY_STEP, undefined, false),
      PageDown: () => step(1, pageDistance, undefined, false),
      ArrowUp: () => step(-1, KEY_STEP, undefined, false),
      PageUp: () => step(-1, pageDistance, undefined, false),
      Home: () => goTo(0),
      End: () => goTo(getStops().length - 1),
    };
    const action = actionByKey[event.key];

    if (!action) {
      return;
    }

    event.preventDefault();
    action();
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
      onUp: (self) => step(1, Math.abs(self.deltaY), self.event.target),
      onDown: (self) => step(-1, Math.abs(self.deltaY), self.event.target),
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
