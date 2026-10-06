import EmblaCarousel from 'embla-carousel';

const ROOT_SELECTOR = '[data-slider]';
const VIEWPORT_SELECTOR = '[data-slider-viewport]';
const PREV_SELECTOR = '[data-slider-prev]';
const NEXT_SELECTOR = '[data-slider-next]';
const CURRENT_SELECTOR = '[data-slider-current]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
// Длительность перелистывания в единицах Embla: чем больше, тем плавнее
const DURATION = 32;

/**
 * Слайдер: стрелки листают по одному слайду по кругу, счётчик показывает номер текущего.
 */
export const initSliders = (): void => {
  const roots = document.querySelectorAll<HTMLElement>(ROOT_SELECTOR);

  for (const root of roots) {
    const viewport = root.querySelector<HTMLElement>(VIEWPORT_SELECTOR);

    if (!viewport) {
      continue;
    }

    const current = root.querySelector<HTMLElement>(CURRENT_SELECTOR);
    const slider = EmblaCarousel(viewport, {
      loop: true,
      duration: matchMedia(REDUCED_MOTION_QUERY).matches ? 0 : DURATION,
    });

    const updateCounter = (): void => {
      if (current) {
        current.textContent = String(slider.selectedScrollSnap() + 1).padStart(2, '0');
      }
    };

    root.querySelector(PREV_SELECTOR)?.addEventListener('click', () => slider.scrollPrev());
    root.querySelector(NEXT_SELECTOR)?.addEventListener('click', () => slider.scrollNext());
    slider.on('select', updateCounter);
    updateCounter();
  }
};
