import { selection } from './ssu-editorial-state.mjs';

export function initSsuEditorial() {
const scene = document.querySelector('.ssu-editorial');
const buttons = [...scene.querySelectorAll('[data-editorial-height]')];
const output = scene.querySelector('[data-editorial-status]');
const observer = new MutationObserver(() => {
  if (!scene.hidden) {
    scene.classList.remove('is-entering');
    void scene.offsetWidth;
    scene.classList.add('is-entering');
  }
});
observer.observe(scene, { attributes: true, attributeFilter: ['hidden'] });
buttons.forEach((button, index) => {
  const badge = document.createElement('span');
  badge.className = 'ssu-editorial__selected-badge';
  badge.textContent = 'Ваш вариант';
  badge.setAttribute('aria-hidden', 'true');
  button.append(badge);
  button.addEventListener('click', () => {
    const value = selection(button.dataset.editorialHeight);
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    output.textContent = value.label;
    scene.dataset.height = button.dataset.editorialHeight;
  });
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
    buttons[next].focus();
    buttons[next].click();
  });
});
}
