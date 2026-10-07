import { gsap } from 'gsap';

const ROOT_SELECTOR = '[data-blog]';
const SLIDE_SELECTOR = '[data-blog-slide]';
const ITEM_SELECTOR = '[data-blog-item]';
const IMAGE_SELECTOR = '[data-blog-image]';
const TEXT_SELECTOR = '[data-blog-text]';
// Пауза перед возвратом к свежей публикации, когда курсор ушёл из блока
const RESET_DELAY = 400;
const LIST_SELECTOR = '[data-blog-list]';
// Сколько курсор должен постоять на строке списка, чтобы открылась её публикация
const INTENT_DELAY = 140;
// Обратный ход прерванной смены быстрее прямого: курсор уже вернулся, ждать нечего
const REVERSE_SPEED = 2.2;
const HOVER_QUERY = '(hover: hover)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const ACTIVE_CLASS = 'is-active';

const WIPE_DURATION = 0.5;
const IMAGE_DURATION = 0.7;
// Новый кадр въезжает увеличенным и со сдвигом, как в слайдере наличия
const IMAGE_SCALE = 1.15;
const IMAGE_SHIFT = 6;
const TEXT_DELAY = 0.12;
const TEXT_DURATION = 0.4;
const TEXT_OFFSET = 24;
const TEXT_STAGGER = 0.04;
const HIDDEN_CLIP = { down: 'inset(100% 0% 0% 0%)', up: 'inset(0% 0% 100% 0%)' };
const VISIBLE_CLIP = 'inset(0% 0% 0% 0%)';

/**
 * Блог: строка списка под курсором открывает свою публикацию на большом экране слева; в списке все публикации.
 * Новая публикация выезжает шторкой снизу или сверху — по тому, ниже или выше её строка в списке, —
 * а дата, рубрика и заголовок появляются по очереди. Публикация остаётся открытой, пока курсор идёт к ней,
 * и возвращается к самой свежей, лишь когда курсор ушёл из блока. Номер публикации строки — в data-blog-item.
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
    // Идущая смена: из какой публикации и в какую. Прервать её можно двумя способами — вернуть назад или
    // перекрыть новой шторкой; мгновенно «доигрывать» нельзя: на кадр показалась бы промежуточная публикация (мерцание)
    let flight: { timeline: gsap.core.Timeline; fromIndex: number; to: HTMLElement } | undefined;

    const syncSelection = (to: HTMLElement): void => {
      for (const item of items) {
        item.classList.toggle(ACTIVE_CLASS, Number(item.dataset.blogItem) === index);
      }

      // Для скринридера доступна только открытая публикация
      for (const slide of slides) {
        slide.toggleAttribute('aria-hidden', slide !== to);
      }
    };

    // Конец смены: видна только выбранная публикация, все временные стили сняты
    const finish = (to: HTMLElement): void => {
      for (const slide of slides) {
        slide.classList.toggle(ACTIVE_CLASS, slide === to);
      }

      gsap.set(
        [
          ...slides,
          ...root.querySelectorAll(IMAGE_SELECTOR),
          ...root.querySelectorAll(TEXT_SELECTOR),
        ],
        { clearProps: 'all' },
      );
      flight = undefined;
    };

    const show = (nextIndex: number): void => {
      if (nextIndex === index || nextIndex >= slides.length) {
        return;
      }

      const to = slides[nextIndex];

      // Курсор вернулся к публикации, которую только что закрывала идущая смена: смена проигрывается назад.
      // Шторка уходит обратно, и публикация проявляется без скачков
      if (flight && flight.fromIndex === nextIndex) {
        const { timeline, to: covering } = flight;

        index = nextIndex;
        syncSelection(to);
        timeline.eventCallback('onReverseComplete', () => finish(to));
        timeline.timeScale(REVERSE_SPEED).reverse();
        flight = { timeline, fromIndex: slides.indexOf(covering), to };

        return;
      }

      // Смена в пути, а курсор ушёл на третью публикацию: старая смена замирает как есть, новая шторка
      // идёт поверх неё. Под ней остаётся то, что видел пользователь, — без скачка к промежуточному кадру
      flight?.timeline.kill();

      const from = slides[index];
      const isDown = nextIndex > index;
      const shift = isDown ? IMAGE_SHIFT : -IMAGE_SHIFT;

      index = nextIndex;
      syncSelection(to);
      to.classList.add(ACTIVE_CLASS);

      if (reducedMotion.matches) {
        finish(to);

        return;
      }

      const fromTexts = from.querySelectorAll(TEXT_SELECTOR);
      const toTexts = to.querySelectorAll(TEXT_SELECTOR);

      gsap.set(to, { zIndex: flight ? 2 : 1 });

      const timeline = gsap
        .timeline({ onComplete: () => finish(to) })
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

      flight = { timeline, fromIndex: slides.indexOf(from), to };
    };

    for (const item of items) {
      const itemIndex = Number(item.dataset.blogItem);

      // Намерение: публикация открывается, если курсор задержался на строке на INTENT_DELAY. Пока курсор
      // пробегает по строкам, ничего не запускается — анимации не копятся и интерфейс не лагает
      let intentTimer: ReturnType<typeof setTimeout> | undefined;

      item.addEventListener('pointerenter', () => {
        clearTimeout(intentTimer);
        intentTimer = setTimeout(() => show(itemIndex), INTENT_DELAY);
      });
      item.addEventListener('pointerleave', () => clearTimeout(intentTimer));
      item.addEventListener('focusin', () => show(itemIndex));
    }

    // Большой экран — не ссылка, кликать по нему не нужно, поэтому, когда курсор или фокус ушли со списка,
    // на нём после короткой паузы снова самая свежая публикация. Пауза прощает случайный выход за край списка
    const list = root.querySelector<HTMLElement>(LIST_SELECTOR);
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const cancelReset = (): void => clearTimeout(resetTimer);
    const scheduleReset = (): void => {
      cancelReset();
      resetTimer = setTimeout(() => show(0), RESET_DELAY);
    };

    list?.addEventListener('pointerenter', cancelReset);
    list?.addEventListener('pointerleave', scheduleReset);
    list?.addEventListener('focusin', cancelReset);
    list?.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !list.contains(event.relatedTarget)) {
        scheduleReset();
      }
    });
  }
};
