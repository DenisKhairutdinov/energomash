import { gsap } from 'gsap';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const COUNT_PATTERN = /^(\d+)(\D*)$/;
const IMAGE_SCALE = 1.03;
const IMAGE_DURATION = 1.8;
const COUNT_DELAY = 0.55;
const COUNT_DURATION = 1.3;
const CLEARED_PROPERTIES = 'opacity,transform,clipPath';

const pick = (root: HTMLElement, selector: string): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(selector),
];

// Значения вроде «18 м³», «2», «1500 мм» набегают от нуля до своего числа, пока плитка проявляется.
// Составные значения («2 · BPW», «1 500») не трогаем: считать у них нечего
const countUp = (values: HTMLElement[]): void => {
  for (const value of values) {
    const match = COUNT_PATTERN.exec(value.textContent.trim());

    if (!match) {
      continue;
    }

    const target = Number(match[1]);
    const suffix = match[2];
    const counter = { current: 0 };

    value.textContent = `0${suffix}`;
    gsap.to(counter, {
      current: target,
      delay: COUNT_DELAY,
      duration: COUNT_DURATION,
      ease: 'power2.out',
      onUpdate: () => {
        value.textContent = `${Math.round(counter.current)}${suffix}`;
      },
      onComplete: () => {
        value.textContent = `${target}${suffix}`;
      },
    });
  }
};

/**
 * Вступление страницы модели, когда данные уже на месте: колонка слева собирается сверху вниз (название выезжает
 * из-под маски, плитки проявляются по очереди, числа набегают), а справа фото оседает из лёгкого приближения,
 * как фон hero на главной. «Уменьшить движение» оставляет страницу как есть.
 */
export const playProductIntro = (root: HTMLElement): void => {
  if (matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  const specValues = pick(root, '.product__spec-value');

  countUp(specValues);

  gsap
    .timeline({ defaults: { ease: 'power3.out', clearProps: CLEARED_PROPERTIES } })
    .from(pick(root, '.product__back'), { opacity: 0, x: -12, duration: 0.6 }, 0)
    .from(pick(root, '.product__meta'), { opacity: 0, y: 12, duration: 0.7 }, 0.05)
    .fromTo(
      pick(root, '.product__title'),
      { opacity: 0, y: 30, clipPath: 'inset(0 0 100% 0)' },
      { opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'expo.out' },
      0.1,
    )
    .from(pick(root, '.product__buy'), { opacity: 0, y: 18, duration: 0.8 }, 0.3)
    .from(pick(root, '.product__spec'), { opacity: 0, y: 16, duration: 0.7, stagger: 0.05 }, 0.4)
    .from(pick(root, '.product__option'), { opacity: 0, y: 10, duration: 0.5, stagger: 0.04 }, 0.8)
    // Фото оседает так же, как фон hero на главной (reveal.ts), только приближение слабее: фото тут крупное
    .fromTo(
      pick(root, '.product__media'),
      { scaleX: IMAGE_SCALE, scaleY: IMAGE_SCALE },
      { scaleX: 1, scaleY: 1, duration: IMAGE_DURATION, ease: 'power2.out' },
      0,
    )
    .from(pick(root, '.product__thumb'), { opacity: 0, y: 20, duration: 0.7, stagger: 0.07 }, 1);
};
