export function initHashOpenTab() {
const onReady = fn => (document.readyState === 'loading' ? addEventListener('DOMContentLoaded', fn) : fn());
if (location.hash === '#why-ssu') onReady(() => document.getElementById('why-tab-ssu').click());
}
