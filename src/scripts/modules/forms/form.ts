import type { RequestFormData } from '../global/pubsub.ts';

const ERROR_SELECTOR = (name: string): string => `[data-form-error="${CSS.escape(name)}"]`;
const FIELD_SELECTOR = (name: string): string => `[name="${CSS.escape(name)}"]`;

// Номер вводится в формате +7 (999) 123-45-67: десять цифр после кода страны
const PHONE_DIGITS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type TextField = HTMLInputElement | HTMLTextAreaElement;

const SHAKE_DURATION = 450;
const SHAKE_OFFSETS = [0, -8, 8, -6, 6, -3, 0];
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const isTextField = (target: EventTarget | null): target is TextField =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

// Значение поля для проверки: у чекбокса — его значение, если он отмечен, иначе пустая строка
const fieldValue = (field: TextField): string =>
  field instanceof HTMLInputElement && field.type === 'checkbox'
    ? field.checked
      ? field.value
      : ''
    : field.value;

// Дрожание неверного поля при отправке. У чекбокса дрожит вся строка согласия: сам он скрыт
const shake = (field: TextField): void => {
  if (matchMedia(REDUCED_MOTION_QUERY).matches) {
    return;
  }

  const target = field.type === 'checkbox' ? (field.closest('label') ?? field) : field;

  target.animate(
    SHAKE_OFFSETS.map((offset) => ({ transform: `translateX(${offset}px)` })),
    { duration: SHAKE_DURATION, easing: 'ease-in-out' },
  );
};

export const formatPhone = (value: string): string => {
  let digits = value.replaceAll(/\D/g, '');

  // Первая цифра — код страны (7 или 8): в самом номере её нет
  if (digits.startsWith('7') || digits.startsWith('8')) {
    digits = digits.slice(1);
  }

  digits = digits.slice(0, PHONE_DIGITS);

  if (digits === '') {
    return '';
  }

  const code = digits.slice(0, 3);
  const first = digits.slice(3, 6);
  const second = digits.slice(6, 8);
  const third = digits.slice(8, 10);

  // Скобка закрывается вместе с первой цифрой номера: иначе Backspace не смог бы её стереть
  return [
    `+7 (${code}${first ? ')' : ''}`,
    first && ` ${first}`,
    second && `-${second}`,
    third && `-${third}`,
  ].join('');
};

// Сообщение об ошибке или пустая строка. Обязательны телефон и согласие на обработку данных;
// почта необязательна, но если заполнена, должна быть похожа на адрес.
// У остальных полей (имя, комментарий…) правил нет
const rules: Record<string, (value: string) => string> = {
  phone: (value) => {
    const digits = value.replaceAll(/\D/g, '');

    if (digits === '') {
      return 'Укажите телефон';
    }

    return digits.length === PHONE_DIGITS + 1 ? '' : 'Введите номер полностью';
  },
  email: (value) => {
    const email = value.trim();

    return email === '' || EMAIL_PATTERN.test(email) ? '' : 'Проверьте адрес почты';
  },
  consent: (value) => (value === '' ? 'Подтвердите согласие' : ''),
};

// Показывает или снимает ошибку поля: текст под полем и aria-invalid на самом поле
const setFieldError = (form: HTMLFormElement, name: string, message: string): void => {
  const field = form.querySelector<HTMLElement>(FIELD_SELECTOR(name));
  const error = form.querySelector<HTMLElement>(ERROR_SELECTOR(name));

  if (error) {
    error.textContent = message;
    error.hidden = message === '';
  }

  field?.setAttribute('aria-invalid', String(message !== ''));
};

const checkField = (form: HTMLFormElement, field: TextField): string => {
  const rule = Object.hasOwn(rules, field.name) ? rules[field.name] : undefined;
  const message = rule ? rule(fieldValue(field)) : '';

  setFieldError(form, field.name, message);

  return message;
};

export const clearFormErrors = (form: HTMLFormElement): void => {
  for (const name of Object.keys(rules)) {
    setFieldError(form, name, '');
  }
};

// Проверяет все поля с правилами сразу, чтобы показать ошибки вместе. Возвращает неверные поля по порядку
const validateForm = (form: HTMLFormElement): TextField[] => {
  const invalid: TextField[] = [];

  for (const name of Object.keys(rules)) {
    const field = form.querySelector<HTMLElement>(FIELD_SELECTOR(name));

    // Проверка выполняется у каждого поля, чтобы все ошибки показались сразу
    if (isTextField(field) && checkField(form, field) !== '') {
      invalid.push(field);
    }
  }

  return invalid;
};

/**
 * Поведение формы заявки, общее для окна и блока внизу страницы:
 *  - телефон вводится по маске, остальное — как есть;
 *  - ошибка поля снимается, как только человек начал его исправлять;
 *  - уходя из заполненного поля, он сразу видит, если там что-то не так (пустые поля не ругаются);
 *  - при отправке проверяются все поля, неверные дрожат, фокус уходит на первое из них;
 *  - onValid получает поля формы, только когда всё верно.
 * Ошибки показываются в элементе data-form-error="имя поля" рядом с полем.
 */
export const bindForm = (form: HTMLFormElement, onValid: (data: RequestFormData) => void): void => {
  form.addEventListener('input', (event) => {
    const field = event.target;

    if (!isTextField(field)) {
      return;
    }

    if (field.name === 'phone') {
      const formatted = formatPhone(field.value);

      if (formatted !== field.value) {
        field.value = formatted;
      }
    }

    setFieldError(form, field.name, '');
  });

  form.addEventListener('focusout', (event) => {
    const field = event.target;

    if (isTextField(field) && fieldValue(field).trim() !== '') {
      checkField(form, field);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const invalid = validateForm(form);
    const [first] = invalid;

    if (first) {
      first.focus();

      for (const field of invalid) {
        shake(field);
      }

      return;
    }

    onValid(
      Object.fromEntries([...new FormData(form)].map(([name, value]) => [name, String(value)])),
    );
  });
};
