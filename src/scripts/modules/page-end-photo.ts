import { loadCatalog, photoUrl } from './catalog-data.ts';

const SECTION_SELECTOR = '.page-end';
const PHOTO_PROPERTY = '--page-end-photo';

interface PhotoItem {
  photos: string[];
}

/**
 * Фон под заявкой и футером: при каждой загрузке страницы — случайное фото техники из каталога.
 * Пока фото не загрузилось (или каталог не открылся), остаётся запасной кадр из стилей (page-end.scss).
 */
export const initPageEndPhoto = async (): Promise<void> => {
  const section = document.querySelector<HTMLElement>(SECTION_SELECTOR);

  if (!section) {
    return;
  }

  try {
    const { items } = await loadCatalog<PhotoItem>();
    const withPhotos = items.filter((item) => item.photos.length > 0);

    if (withPhotos.length === 0) {
      return;
    }

    const item = withPhotos[Math.floor(Math.random() * withPhotos.length)];
    const name = item.photos[Math.floor(Math.random() * item.photos.length)];
    const url = photoUrl(name);

    if (!url) {
      return;
    }

    // Фон меняется, только когда кадр уже в кэше браузера: иначе секция на мгновение осталась бы без картинки
    const image = new Image();

    image.addEventListener('load', () => {
      section.style.setProperty(PHOTO_PROPERTY, `url("${url}")`);
    });
    image.src = url;
  } catch {
    // Запасной кадр остаётся: страница без случайного фона работает
  }
};
