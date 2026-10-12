// Сцена 4 листается как сцены 1–3: клик по левой/правой половине и стрелки.
// Зоны-кнопки в сцене 4 скрыты (перекрывали бы цифры), поэтому клик по пустому месту
// передаём тем же кнопкам [data-why-prev]/[data-why-next].

export function initScene4Nav() {
const scene = document.querySelector('#why-ssu');
const prev = document.querySelector('[data-why-prev]');
const next = document.querySelector('[data-why-next]');
const interactive = '[data-equipment-subview-toolbar],button,a,input,select,textarea,label,[role="button"],[tabindex]:not([tabindex="-1"])';

function side(event) {
  const bounds = scene.getBoundingClientRect();
  return event.clientX - bounds.left < bounds.width / 2 ? prev : next;
}

scene.addEventListener('click', event => {
  if (scene.hidden || event.target.closest(interactive)) return;
  side(event).click();
});

scene.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;
  scene.style.cursor = event.target.closest(interactive) ? '' : side(event) === prev ? 'w-resize' : 'e-resize';
});
scene.addEventListener('pointerleave', () => { scene.style.cursor = ''; });

// Как сцены 1–3, сцена 4 всегда открывается с начала — с зимника.
// Сбрасываем при уходе со сцены, сохраняя прокрутку и фокус.
new MutationObserver(() => {
  if (!scene.hidden || scene.dataset.equipmentView === 'map') return;
  const back = [...scene.querySelectorAll('.equipment-back')].find(button => !button.closest('[hidden]:not(#why-ssu)'));
  if (!back) return;
  const x = scrollX, y = scrollY, active = document.activeElement;
  back.click();
  scrollTo(x, y);
  active?.focus?.({ preventScroll: true });
}).observe(scene, { attributes: true, attributeFilter: ['hidden'] });

// equipment-map.mjs гасит стрелки внутри сцены; стрелки листают главы, кроме выбора высоты ССУ.
scene.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.target.closest('input,textarea,select,[data-ssu-controls]')) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  (event.key === 'ArrowLeft' ? prev : next).click();
});
}
