import { gsap } from 'gsap';

const ROOT_SELECTOR = '[data-blog]';
const SLIDE_SELECTOR = '[data-blog-slide]';
const LIST_SELECTOR = '[data-blog-list]';
const ITEM_SELECTOR = '[data-blog-item]';
const IMAGE_SELECTOR = '[data-blog-image]';
const TEXT_SELECTOR = '[data-blog-text]';
const HOVER_QUERY = '(hover: hover)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const ACTIVE_CLASS = 'is-active';

const WIPE_DURATION = 0.8;
const IMAGE_DURATION = 1.1;
// Новый кадр въезжает увеличенным и со сдвигом, как в слайдере наличия
const IMAGE_SCALE = 1.15;
const IMAGE_SHIFT = 6;
const TEXT_DELAY = 0.25;
const TEXT_DURATION = 0.6;
const TEXT_OFFSET = 24;
const TEXT_STAGGER = 0.06;
const HIDDEN_CLIP = { down: 'inset(100% 0% 0% 0%)', up: 'inset(0% 0% 100% 0%)' };
const VISIBLE_CLIP = 'inset(0% 0% 0% 0%)';

/**
 * Блог: строка списка под курсором открывает свою публикацию на большом экране слева.
 * Новая публикация выезжает шторкой снизу или сверху — по тому, ниже или выше её строка в списке, —
 * а рубрика, дата и заголовок появляются по очереди. Когда курсор уходит со списка,
 * на большой экран возвращается самая свежая публикация. Номер публикации строки — в data-blog-item.
 */
export const initBlog = (): void => {
  const roots = document.querySelectorAll<HTMLElement>(ROOT_SELECTOR);

  if (roots.length === 0 || !matchMedia(HOVER_QUERY).matches) {
    return;
  }

  const reducedMotion = matchMedia(REDUCED_MOTION_QUERY);

  for (const root of roots) {
    const slides = [...root.querySelectorAll<HTMLElement>(SLIDE_SELECTOR)];
    const items = [...root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
    let index = Math.max(
      slides.findIndex((slide) => slide.classList.contains(ACTIVE_CLASS)),
      0,
    );
    // Строка, на которую курсор перешёл во время смены: откроется, как только смена закончится
    let pendingIndex: number | undefined;
    let isAnimating = false;

    const show = (nextIndex: number): void => {
      if (isAnimating) {
        pendingIndex = nextIndex;

        return;
      }

      if (nextIndex === index || nextIndex >= slides.length) {
        return;
      }

      const from = slides[index];
      const to = slides[nextIndex];
      const isDown = nextIndex > index;
      const shift = isDown ? IMAGE_SHIFT : -IMAGE_SHIFT;

      index = nextIndex;

      for (const item of items) {
        item.classList.toggle(ACTIVE_CLASS, Number(item.dataset.blogItem) === index);
      }

      // С клавиатуры и для скринридера доступна только открытая публикация
      for (const slide of slides) {
        slide.toggleAttribute('aria-hidden', slide !== to);
        slide.tabIndex = slide === to ? 0 : -1;
      }

      to.classList.add(ACTIVE_CLASS);

      if (reducedMotion.matches) {
        from.classList.remove(ACTIVE_CLASS);

        return;
      }

      const fromTexts = from.querySelectorAll(TEXT_SELECTOR);
      const toTexts = to.querySelectorAll(TEXT_SELECTOR);
      const animated = [
        from,
        to,
        ...fromTexts,
        ...toTexts,
        ...root.querySelectorAll(IMAGE_SELECTOR),
      ];

      isAnimating = true;
      gsap.set(to, { zIndex: 1 });

      gsap
        .timeline({
          onComplete: () => {
            from.classList.remove(ACTIVE_CLASS);
            gsap.set(animated, { clearProps: 'all' });
            isAnimating = false;

            if (pendingIndex !== undefined) {
              const queuedIndex = pendingIndex;

              pendingIndex = undefined;
              show(queuedIndex);
            }
          },
        })
        .fromTo(
          to,
          { clipPath: isDown ? HIDDEN_CLIP.down : HIDDEN_CLIP.up },
          { clipPath: VISIBLE_CLIP, duration: WIPE_DURATION, ease: 'power3.inOut' },
          0,
        )
        .fromTo(
          to.querySelector(IMAGE_SELECTOR),
          { scale: IMAGE_SCALE, yPercent: shift },
          { scale: 1, yPercent: 0, duration: IMAGE_DURATION, ease: 'power3.out' },
          0,
        )
        .to(
          from.querySelector(IMAGE_SELECTOR),
          { yPercent: -shift, duration: WIPE_DURATION, ease: 'power3.inOut' },
          0,
        )
        // Старый текст гаснет сразу: иначе он просвечивал бы рядом с новым, пока шторка не закрылась
        .to(fromTexts, { autoAlpha: 0, duration: TEXT_DELAY, ease: 'power2.in' }, 0)
        .fromTo(
          toTexts,
          { autoAlpha: 0, y: TEXT_OFFSET },
          {
            autoAlpha: 1,
            y: 0,
            duration: TEXT_DURATION,
            ease: 'power3.out',
            stagger: TEXT_STAGGER,
          },
          TEXT_DELAY,
        );
    };

    for (const item of items) {
      const itemIndex = Number(item.dataset.blogItem);

      item.addEventListener('pointerenter', () => show(itemIndex));
      item.addEventListener('focusin', () => show(itemIndex));
    }

    const list = root.querySelector<HTMLElement>(LIST_SELECTOR);

    // Курсор или фокус ушли со списка — на большом экране снова самая свежая публикация
    list?.addEventListener('pointerleave', () => show(0));
    list?.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !list.contains(event.relatedTarget)) {
        show(0);
      }
    });
  }
};
