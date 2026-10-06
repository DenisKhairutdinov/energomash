import { gsap } from 'gsap';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const WRAPPER_SELECTOR = '[data-smooth-wrapper]';
const CONTENT_SELECTOR = '[data-smooth-content]';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SMOOTH = 1;

/**
 * Плавный скролл страницы. На тач-устройствах остаётся нативная прокрутка.
 */
export const initSmoothScroll = (): void => {
  const wrapper = document.querySelector<HTMLElement>(WRAPPER_SELECTOR);
  const content = document.querySelector<HTMLElement>(CONTENT_SELECTOR);

  if (!wrapper || !content || matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

  ScrollSmoother.create({
    wrapper,
    content,
    smooth: SMOOTH,
  });
};
