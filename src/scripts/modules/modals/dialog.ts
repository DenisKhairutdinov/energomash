import { gsap } from 'gsap';
import { pubSub, type EventName } from '../global/pubsub.ts';

const ITEM_SELECTOR = '[data-modal-item]';
const CLOSE_SELECTOR = '[data-modal-close]';

// Пока открыто хоть одно окно, страница под ним не прокручивается (стили и fullpage.ts смотрят на этот класс)
const OPEN_CLASS = 'has-modal';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Та же манера, что у появления секций (reveal.ts): короткий подъём с проявлением и плавным торможением
const FADE_IN = 0.3;
const FADE_OUT = 0.2;
const PANEL_OFFSET = 24;
const PANEL_DURATION = 0.6;
const ITEM_OFFSET = 16;
const ITEM_DURATION = 0.7;
const ITEM_STAGGER = 0.06;
const ITEM_DELAY = 0.15;
const EASE = 'power3.out';

interface ModalOptions {
  // Событие pubSub, которое публикуют Esc, крестик и клик по затемнению; на него подписывается владелец окна
  closeEvent: EventName;
  // Окно закрылось любым способом, анимация закончилась
  onClosed?: () => void;
}

export interface ModalController {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export const isReducedMotion = (): boolean => matchMedia(REDUCED_MOTION_QUERY).matches;

/**
 * Общее поведение окон на <dialog>: показ с анимацией, закрытие в два такта (окно гаснет,
 * потом закрывается сам dialog), блокировка страницы под окном, Esc, клик по затемнению
 * и кнопки data-modal-close. Элементы с data-modal-item появляются по очереди.
 * Сам dialog занимает весь экран и служит затемнением, панель стоит внутри.
 * Что показывать и когда открывать — забота владельца окна.
 */
export const createModal = (
  dialog: HTMLDialogElement,
  panel: HTMLElement,
  { closeEvent, onClosed }: ModalOptions,
): ModalController => {
  const items = [...dialog.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
  const animated = [dialog, panel, ...items];

  let isClosing = false;

  const animateIn = (): void => {
    gsap.killTweensOf(animated);

    if (isReducedMotion()) {
      return;
    }

    gsap.fromTo(dialog, { opacity: 0 }, { opacity: 1, duration: FADE_IN, ease: 'power2.out' });
    gsap.fromTo(
      panel,
      { opacity: 0, y: PANEL_OFFSET },
      { opacity: 1, y: 0, duration: PANEL_DURATION, ease: EASE },
    );
    gsap.fromTo(
      items,
      { opacity: 0, y: ITEM_OFFSET },
      {
        opacity: 1,
        y: 0,
        duration: ITEM_DURATION,
        ease: EASE,
        stagger: ITEM_STAGGER,
        delay: ITEM_DELAY,
      },
    );
  };

  const open = (): void => {
    if (dialog.open) {
      return;
    }

    isClosing = false;
    dialog.showModal();
    document.documentElement.classList.add(OPEN_CLASS);
    animateIn();
  };

  const close = (): void => {
    if (isClosing || !dialog.open) {
      return;
    }

    isClosing = true;
    gsap.killTweensOf(animated);

    if (isReducedMotion()) {
      dialog.close();
      return;
    }

    gsap.to(panel, { opacity: 0, y: PANEL_OFFSET / 2, duration: FADE_OUT, ease: 'power2.in' });
    gsap.to(dialog, {
      opacity: 0,
      duration: FADE_OUT,
      ease: 'power2.in',
      onComplete: () => dialog.close(),
    });
  };

  // Окно закрылось любым способом: снимаем блокировку страницы и анимационные значения
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove(OPEN_CLASS);
    gsap.killTweensOf(animated);
    gsap.set(animated, { clearProps: 'opacity,visibility,transform' });
    isClosing = false;
    onClosed?.();
  });

  // Esc закрывает окно с той же анимацией, что и крестик
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    pubSub.publish(closeEvent);
  });

  // Нажатие и отпускание должны быть на фоне: выделение текста, которое закончилось за окном, не закрывает его
  let isPressedOnOverlay = false;

  dialog.addEventListener('pointerdown', (event) => {
    isPressedOnOverlay = event.target === dialog;
  });

  dialog.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : undefined;
    const isOverlayClick = isPressedOnOverlay && target === dialog;

    if (isOverlayClick || target?.closest(CLOSE_SELECTOR)) {
      pubSub.publish(closeEvent);
    }
  });

  return { open, close, isOpen: () => dialog.open };
};
