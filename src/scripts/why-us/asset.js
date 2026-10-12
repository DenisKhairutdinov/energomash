// Resolves draft-relative asset paths (e.g. 'heat/x.webp') to real URLs in both dev and build.
const files = import.meta.glob('/src/assets/images/why-us/**/*', { eager: true, query: '?url', import: 'default' });
const PREFIX = '/src/assets/images/why-us/';

export function asset(path) {
  const key = PREFIX + String(path).replace(/^\.?\//, '');
  const url = files[key];
  if (!url) console.warn('[why-us] asset not found:', key);
  return url || key;
}

export function assetSrcset(srcset) {
  return srcset.split(',').map(part => {
    const [url, ...descriptor] = part.trim().split(/\s+/);
    return [asset(url), ...descriptor].join(' ');
  }).join(', ');
}
