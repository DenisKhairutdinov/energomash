const FORM_SELECTOR = '[data-filter]';
const TYPE_SELECTOR = '[data-filter-type]';
const GROUP_SELECTOR = '[data-filter-group]';
const VOLUME_FROM_SELECTOR = '[data-filter-volume-from]';
const VOLUME_TO_SELECTOR = '[data-filter-volume-to]';

/**
 * Подбор техники: набор назначений и подсказки объёма зависят от выбранного типа.
 * Неактивная группа скрыта и отключена, поэтому в запрос уходит только видимый выбор.
 */
export const initFilter = (): void => {
  const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);

  if (!form) {
    return;
  }

  const typeInputs = [...form.querySelectorAll<HTMLInputElement>(TYPE_SELECTOR)];
  const groups = [...form.querySelectorAll<HTMLElement>(GROUP_SELECTOR)];
  const volumeFrom = form.querySelector<HTMLInputElement>(VOLUME_FROM_SELECTOR);
  const volumeTo = form.querySelector<HTMLInputElement>(VOLUME_TO_SELECTOR);

  const applyType = (type: string): void => {
    for (const group of groups) {
      const isActive = group.dataset.filterGroup === type;
      const inputs = [...group.querySelectorAll<HTMLInputElement>('input')];

      group.hidden = !isActive;

      for (const input of inputs) {
        input.disabled = !isActive;
      }

      if (!isActive) {
        continue;
      }

      if (inputs.every((input) => !input.checked) && inputs[0]) {
        inputs[0].checked = true;
      }

      if (volumeFrom) {
        volumeFrom.placeholder = group.dataset.filterVolumeMin ?? '';
      }

      if (volumeTo) {
        volumeTo.placeholder = group.dataset.filterVolumeMax ?? '';
      }
    }
  };

  for (const input of typeInputs) {
    input.addEventListener('change', () => {
      if (input.checked) {
        applyType(input.value);
      }
    });
  }

  // Браузер может восстановить выбор после перезагрузки или возврата назад — синхронизируемся с ним
  const checkedType = typeInputs.find((input) => input.checked);

  if (checkedType) {
    applyType(checkedType.value);
  }
};
