export function initSsuHeightLabel() {
const onReady = fn => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', fn) : fn());
onReady(() => {
  const root = document.querySelector('[data-ssu-scene]');
  const values = { low: '950', medium: '1150', high: '1500' };
  root.querySelectorAll('[data-ssu-choice]').forEach(button => button.addEventListener('click', () => { root.querySelector('[data-ssu-height]').textContent = 'ССУ ≈ ' + values[button.dataset.ssuChoice] + ' мм'; }));
});
}
