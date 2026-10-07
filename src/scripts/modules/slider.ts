import { gsap } from 'gsap';

const ROOT_SELECTOR = '[data-slider]';
const SLIDE_SELECTOR = '[data-slider-slide]';
const MEDIA_SELECTOR = '[data-slider-media]';
const IMAGE_SELECTOR = '[data-slider-image]';
const PANEL_SELECTOR = '[data-slider-panel]';
// Места, над которыми автоплей ждёт: панель модели и блок стрелок
const PAUSE_SELECTOR = `${PANEL_SELECTOR}, [data-slider-nav]`;
const TEXT_SELECTOR = '[data-slider-text]';
const PREV_SELECTOR = '[data-slider-prev]';
const NEXT_SELECTOR = '[data-slider-next]';
const CURRENT_SELECTOR = '[data-slider-current]';
const PROGRESS_SELECTOR = '[data-slider-progress]';
const AUTOPLAY_ATTRIBUTE = 'sliderAutoplay';
const AUTOPLAY_VISIBLE_RATIO = 0.3;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const ACTIVE_CLASS = 'is-active';

const WIPE_DURATION = 1;
const IMAGE_DURATION = 1.3;
// Новый кадр въезжает увеличенным и со сдвигом, старый уезжает навстречу: получается глубина
const IMAGE_SCALE = 1.2;
const IMAGE_SHIFT = 8;
const TEXT_OUT_DURATION = 0.3;
const TEXT_IN_DURATION = 0.6;
const TEXT_OFFSET = 24;
const TEXT_STAGGER = 0.05;
const HIDDEN_CLIP = { next: 'inset(0% 0% 0% 100%)', prev: 'inset(0% 100% 0% 0%)' };
const VISIBLE_CLIP = 'inset(0% 0% 0% 0%)';

/**
 * Слайдер: слайды лежат стопкой, новый открывается шторкой поверх текущего — фото проявляется
 * со стороны, куда листают, и чуть отъезжает, а текст панели сменяется построчно.
 * Счётчик показывает номер слайда, полоса прогресса — какая часть слайдов уже пройдена.
 */
export const initSliders = (): void => {
  const roots = document.querySelectorAll<HTMLElement>(ROOT_SELECTOR);
  const reducedMotion = matchMedia(REDUCED_MOTION_QUERY);

  for (const root of roots) {
    const slides = [...root.querySelectorAll<HTMLElement>(SLIDE_SELECTOR)];

    const current = root.querySelector<HTMLElement>(CURRENT_SELECTOR);
    const progress = root.querySelector<HTMLElement>(PROGRESS_SELECTOR);
    let index = Math.max(
      slides.findIndex((slide) => slide.classList.contains(ACTIVE_CLASS)),
      0,
    );
    let isAnimating = false;

    const updateCounter = (): void => {
      if (current) {
        current.textContent = String(index + 1).padStart(2, '0');
      }

      if (progress) {
        progress.style.scale = `${(index + 1) / slides.length} 1`;
      }
    };

    const show = (direction: 1 | -1): void => {
      if (isAnimating || slides.length < 2) {
        return;
      }

      const from = slides[index];

      index = (index + direction + slides.length) % slides.length;

      const to = slides[index];

      updateCounter();
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
        ...root.querySelectorAll(`${MEDIA_SELECTOR}, ${IMAGE_SELECTOR}, ${PANEL_SELECTOR}`),
      ];

      isAnimating = true;
      // Новый слайд лежит поверх текущего; его панель скрыта, пока уходит старый текст
      gsap.set(to, { zIndex: 1 });
      gsap.set(to.querySelector(PANEL_SELECTOR), { autoAlpha: 0 });

      gsap
        .timeline({
          onComplete: () => {
            from.classList.remove(ACTIVE_CLASS);
            gsap.set(animated, { clearProps: 'all' });
            isAnimating = false;
          },
        })
        .fromTo(
          to.querySelector(MEDIA_SELECTOR),
          { clipPath: direction > 0 ? HIDDEN_CLIP.next : HIDDEN_CLIP.prev },
          { clipPath: VISIBLE_CLIP, duration: WIPE_DURATION, ease: 'power3.inOut' },
          0,
        )
        .fromTo(
          to.querySelector(IMAGE_SELECTOR),
          { scale: IMAGE_SCALE, xPercent: direction * IMAGE_SHIFT },
          { scale: 1, xPercent: 0, duration: IMAGE_DURATION, ease: 'power3.out' },
          0,
        )
        .to(
          from.querySelector(IMAGE_SELECTOR),
          { xPercent: -direction * IMAGE_SHIFT, duration: WIPE_DURATION, ease: 'power3.inOut' },
          0,
        )
        .to(
          fromTexts,
          {
            autoAlpha: 0,
            y: -TEXT_OFFSET / 2,
            duration: TEXT_OUT_DURATION,
            ease: 'power2.in',
            stagger: TEXT_STAGGER / 2,
          },
          0,
        )
        .set(to.querySelector(PANEL_SELECTOR), { autoAlpha: 1 }, '>')
        .fromTo(
          toTexts,
          { autoAlpha: 0, y: TEXT_OFFSET },
          {
            autoAlpha: 1,
            y: 0,
            duration: TEXT_IN_DURATION,
            ease: 'power3.out',
            stagger: TEXT_STAGGER,
          },
          '<',
        );
    };

    // Автоплей: слайд сменяется сам через data-slider-autoplay секунд. Он не мешает: стоит, пока курсор на панели
    // или стрелках, пока вкладка скрыта и пока секция не видна на экране, а после ручного листания отсчёт начинается заново
    const delay = Number(root.dataset[AUTOPLAY_ATTRIBUTE]);
    let timer: gsap.core.Tween | undefined;
    let isHovered = false;
    let isVisible = false;

    const canPlay = (): boolean => delay > 0 && !isHovered && isVisible && !document.hidden;

    const schedule = (): void => {
      timer?.kill();
      timer = undefined;

      if (canPlay()) {
        timer = gsap.delayedCall(delay, () => {
          show(1);
          schedule();
        });
      }
    };

    root.querySelector(PREV_SELECTOR)?.addEventListener('click', () => {
      show(-1);
      schedule();
    });
    root.querySelector(NEXT_SELECTOR)?.addEventListener('click', () => {
      show(1);
      schedule();
    });
    updateCounter();

    if (delay > 0) {
      // Пауза — пока курсор на панели с характеристиками или на стрелках: их читают и нажимают. Фото само
      // курсор не останавливает, иначе слайдер почти не листался бы: мышь обычно лежит где-то на нём.
      // Фокус не учитывается: после клика по стрелке он остаётся на ней и навсегда остановил бы автоплей
      root.addEventListener('pointerover', (event) => {
        const isOnControl =
          event.target instanceof Element && event.target.closest(PAUSE_SELECTOR) !== null;

        if (isOnControl !== isHovered) {
          isHovered = isOnControl;
          schedule();
        }
      });
      root.addEventListener('pointerleave', () => {
        isHovered = false;
        schedule();
      });
      document.addEventListener('visibilitychange', schedule);

      new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;
          schedule();
        },
        { threshold: AUTOPLAY_VISIBLE_RATIO },
      ).observe(root);
    }
  }
};
