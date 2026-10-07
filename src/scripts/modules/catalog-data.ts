// Данные каталога из базы (npm run catalog:import) грузятся запросом в момент, когда они нужны.
// Один файл на всю страницу: каталог, поиск в шапке, счётчик наличия и страница модели берут его отсюда

const BASE_URL = import.meta.env.BASE_URL;

const requests = new Map<string, Promise<unknown>>();

// Файл запрашивается один раз: повторные вызовы получают тот же запрос
const fetchOnce = <Data>(path: string): Promise<Data> => {
  let request = requests.get(path);

  if (!request) {
    request = (async () => {
      const response = await fetch(`${BASE_URL}${path}`);

      if (!response.ok) {
        throw new Error(`${path}: ${response.status} ${response.statusText}`);
      }

      return response.json();
    })();
    requests.set(path, request);
  }

  return request as Promise<Data>;
};

/**
 * Карточки: модели и позиции склада со всеми параметрами фильтра (около 0,8 МБ).
 */
export const loadCatalog = <Item>(): Promise<{ items: Item[] }> =>
  fetchOnce<{ items: Item[] }>('data/catalog.json');

/**
 * Таблицы характеристик моделей (около 3,3 МБ): нужны только странице модели, поэтому грузятся отдельно.
 */
export const loadSpecs = <Section>(): Promise<{ specs: Record<string, Section[]> }> =>
  fetchOnce<{ specs: Record<string, Section[]> }>('data/catalog-specs.json');

// Фотографии техники. В данных лежат только имена файлов (tools/catalog-import.mjs), а адреса на готовые
// файлы знает сборка: Vite кладёт их в dist с хешем в имени. Берутся лёгкие превью (npm run photos:thumbs):
// исходники по 4–5 тысяч пикселей браузер раскодировал бы целиком ради рамки в тысячу
const PHOTO_DIR = '/src/assets/models/thumbs/';
const photoUrls = import.meta.glob<string>('/src/assets/models/thumbs/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

/**
 * Адрес превью по имени файла из данных; undefined, если файла нет в сборке.
 */
export const photoUrl = (name: string): string | undefined => photoUrls[`${PHOTO_DIR}${name}`];

// Исходные снимки (3600–5100 px) для страницы модели: фото там на три четверти экрана, поэтому без пережатия.
// Глоб только по верхней папке: превью лежат во вложенной и сюда не попадают
const originalPhotoUrls = import.meta.glob<string>('/src/assets/models/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
});

/**
 * Адрес исходного снимка по имени файла; undefined, если файла нет в сборке.
 */
export const originalPhotoUrl = (name: string): string | undefined =>
  originalPhotoUrls[`/src/assets/models/${name}`];
