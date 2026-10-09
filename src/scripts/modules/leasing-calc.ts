const ROOT_SELECTOR = '[data-leasing]';
const PARTNER_SELECTOR = 'input[name="leasing-partner"]';
const PRICE_SELECTOR = '[data-leasing-price]';
const PRICE_RANGE_SELECTOR = '[data-leasing-price-range]';
const ADVANCE_SELECTOR = '[data-leasing-advance]';
const ADVANCE_OUTPUT_SELECTOR = '[data-leasing-advance-output]';
const TERM_SELECTOR = '[data-leasing-term]';
const TERM_OUTPUT_SELECTOR = '[data-leasing-term-output]';
const SUBSIDY_SELECTOR = '[data-leasing-subsidy]';
const PAYMENT_SELECTOR = '[data-leasing-payment]';
const ADVANCE_SUM_SELECTOR = '[data-leasing-advance-sum]';
const SUBSIDY_SUM_SELECTOR = '[data-leasing-subsidy-sum]';
const SUBSIDY_ROW_SELECTOR = '[data-leasing-subsidy-row]';
const TOTAL_SELECTOR = '[data-leasing-total]';
const OVERPAY_SELECTOR = '[data-leasing-overpay]';
const HINT_SELECTOR = '[data-leasing-hint]';
const NOTE_SELECTOR = '[data-leasing-note]';
const MONTHS_IN_YEAR = 12;
const MAX_PRICE_LENGTH = 11;
const MAX_ADVANCE_PERCENT = 49;
const MIN_TERM_MONTHS = 12;
/**
Субсидия Минпромторга (постановление Правительства №649 от 08.05.2020): 10% цены, не более 500 000 ₽ на единицу
*/
const SUBSIDY_SHARE = 0.1;
const SUBSIDY_LIMIT = 500_000;
/**
Выкупная стоимость, доля от цены. УСЛОВНО: партнёры её не публикуют
*/
const BUYOUT_SHARE = 0.01;

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/**
Условия партнёра берутся из data-атрибутов разметки (templates/leasing-calc.njk)
*/
interface Partner {
  name: string;
  minAdvance: number;
  maxTerm: number;
  minPrice: number;
  /**
  Годовое удорожание, доля (0.16 = 16%)
  */
  rate: number;
  /**
  true — аванс и срок опубликованы на сайте самого партнёра, иначе это ориентир
  */
  published: boolean;
  url?: string;
}

export interface LeasingResult {
  payment: number;
  advance: number;
  subsidy: number;
  total: number;
  overpay: number;
}

/**
 * Аннуитетный платёж. Финансируется цена за вычетом аванса и субсидии; выкупная стоимость выплачивается
 * в конце срока, поэтому её приведённая стоимость уменьшает основу для ежемесячных платежей.
 */
export const calculateLeasing = (
  price: number,
  advanceShare: number,
  months: number,
  annualRate: number,
  hasSubsidy: boolean,
): LeasingResult => {
  const advance = price * advanceShare;
  const subsidy = hasSubsidy ? Math.min(price * SUBSIDY_SHARE, SUBSIDY_LIMIT) : 0;
  const financed = price - advance - subsidy;
  const buyout = price * BUYOUT_SHARE;
  const rate = annualRate / MONTHS_IN_YEAR;
  const factor = (1 + rate) ** months;
  const payment = ((financed - buyout / factor) * rate) / (1 - 1 / factor);
  const total = advance + payment * months + buyout;

  return { payment, advance, subsidy, total, overpay: total - (price - subsidy) };
};

const describePartner = (partner: Partner): string => {
  const base = `${partner.name}: аванс от ${partner.minAdvance}%, срок до ${partner.maxTerm} мес.`;
  const source = partner.published
    ? 'Условия с сайта партнёра.'
    : 'Условия ориентировочные, партнёр уточнит их в заявке.';

  return `${base} ${source} Удорожание партнёры считают по каждой сделке, платёж ориентировочный.`;
};

const parsePrice = (value: string): number => Number(value.replaceAll(/\D/g, ''));

const readPartner = (input: HTMLInputElement): Partner => ({
  name: input.dataset.name ?? '',
  minAdvance: Number(input.dataset.advance),
  maxTerm: Number(input.dataset.term),
  minPrice: Number(input.dataset.minPrice),
  rate: Number(input.dataset.rate) / 100,
  published: input.dataset.published === 'true',
  url: input.dataset.url,
});

/**
Калькулятор лизинга на главной: выбор партнёра, субсидия, пересчёт по ходу ввода, формат рублей по-русски.
*/
export const initLeasingCalc = (): void => {
  const root = document.querySelector<HTMLElement>(ROOT_SELECTOR);
  const partnerInputs = [...(root?.querySelectorAll<HTMLInputElement>(PARTNER_SELECTOR) ?? [])];
  const price = root?.querySelector<HTMLInputElement>(PRICE_SELECTOR);
  const advance = root?.querySelector<HTMLInputElement>(ADVANCE_SELECTOR);
  const term = root?.querySelector<HTMLInputElement>(TERM_SELECTOR);
  const subsidy = root?.querySelector<HTMLInputElement>(SUBSIDY_SELECTOR);

  if (!root || !price || !advance || !term || !subsidy || partnerInputs.length === 0) {
    return;
  }

  const priceRange = root.querySelector<HTMLInputElement>(PRICE_RANGE_SELECTOR);
  const hint = root.querySelector<HTMLElement>(HINT_SELECTOR);
  const note = root.querySelector<HTMLElement>(NOTE_SELECTOR);
  const advanceOutput = root.querySelector<HTMLElement>(ADVANCE_OUTPUT_SELECTOR);
  const termOutput = root.querySelector<HTMLElement>(TERM_OUTPUT_SELECTOR);
  const subsidyRow = root.querySelector<HTMLElement>(SUBSIDY_ROW_SELECTOR);
  const targets = {
    payment: root.querySelector<HTMLElement>(PAYMENT_SELECTOR),
    advance: root.querySelector<HTMLElement>(ADVANCE_SUM_SELECTOR),
    subsidy: root.querySelector<HTMLElement>(SUBSIDY_SUM_SELECTOR),
    total: root.querySelector<HTMLElement>(TOTAL_SELECTOR),
    overpay: root.querySelector<HTMLElement>(OVERPAY_SELECTOR),
  };

  const getPartner = (): Partner => {
    const checked = partnerInputs.find((input) => input.checked) ?? partnerInputs[0];

    return readPartner(checked);
  };

  // Бегунок закрашивается до текущего положения: сам по себе браузер этого не делает
  const paintRange = (input: HTMLInputElement): void => {
    const share =
      (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));

    input.style.setProperty('--fill', `${share * 100}%`);
  };

  // Границы бегунков у каждого партнёра свои: значение подтягивается в допустимый диапазон
  const applyPartnerLimits = (partner: Partner): void => {
    advance.min = String(partner.minAdvance);
    advance.max = String(MAX_ADVANCE_PERCENT);
    advance.value = String(Math.max(Number(advance.value), partner.minAdvance));
    term.min = String(MIN_TERM_MONTHS);
    term.max = String(partner.maxTerm);
    term.value = String(Math.min(Number(term.value), partner.maxTerm));
  };

  const showEmpty = (): void => {
    for (const target of Object.values(targets)) {
      if (target) {
        target.textContent = '—';
      }
    }
  };

  const update = (): void => {
    const partner = getPartner();
    const value = parsePrice(price.value);
    const hasSubsidy = subsidy.checked;

    if (advanceOutput) {
      advanceOutput.textContent = advance.value;
    }

    if (termOutput) {
      termOutput.textContent = term.value;
    }

    // Ползунок цены повторяет поле: вне его границ упирается в край, а значение подгоняется под шаг
    if (priceRange) {
      priceRange.value = String(value);
      paintRange(priceRange);
    }

    paintRange(advance);
    paintRange(term);

    if (subsidyRow) {
      subsidyRow.hidden = !hasSubsidy;
    }

    if (note) {
      note.textContent = describePartner(partner);
    }

    // Ниже минимальной суммы сделки партнёр лизинг не оформляет: подсказка становится акцентной, расчёта нет
    const isTooLow = value < partner.minPrice;

    if (hint) {
      hint.textContent =
        partner.minPrice > 0
          ? `Введите свою сумму, сделка от ${currency.format(partner.minPrice)}`
          : 'Введите свою сумму';
      hint.classList.toggle('is-warning', isTooLow);
    }

    if (isTooLow || value === 0) {
      showEmpty();

      return;
    }

    const result = calculateLeasing(
      value,
      Number(advance.value) / 100,
      Number(term.value),
      partner.rate,
      hasSubsidy,
    );

    const texts: Record<keyof typeof targets, number> = {
      payment: result.payment,
      advance: result.advance,
      subsidy: result.subsidy,
      total: result.total,
      overpay: result.overpay,
    };

    for (const [key, amount] of Object.entries(texts)) {
      const target = targets[key as keyof typeof targets];

      if (target) {
        target.textContent = currency.format(amount);
      }
    }
  };

  // В поле цены остаются только цифры, разряды отделяются пробелами по мере ввода
  price.addEventListener('input', () => {
    const digits = price.value.replaceAll(/\D/g, '').slice(0, MAX_PRICE_LENGTH);

    price.value = digits === '' ? '' : Number(digits).toLocaleString('ru-RU');
    update();
  });
  priceRange?.addEventListener('input', () => {
    price.value = Number(priceRange.value).toLocaleString('ru-RU');
    update();
  });
  advance.addEventListener('input', update);
  term.addEventListener('input', update);
  subsidy.addEventListener('change', update);

  for (const input of partnerInputs) {
    input.addEventListener('change', () => {
      applyPartnerLimits(readPartner(input));
      update();
    });
  }

  applyPartnerLimits(getPartner());
  update();
};
