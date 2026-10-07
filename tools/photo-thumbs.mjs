/**
 * Превью фотографий техники для карточек каталога.
 *
 * Запуск: npm run photos:thumbs
 *
 * Исходные снимки в src/assets/models — по 3600–5100 px в ширину (медиана 430 КБ, максимум 4,7 МБ), а рамка
 * карточки — 480 px. Браузер раскодирует каждый снимок целиком (около 60 МБ памяти на кадр), поэтому
 * список из десятков карточек тормозит. Скрипт делает из каждого снимка превью шириной 1000 px
 * (в два раза больше рамки — для экранов с плотностью 2) в src/assets/models/thumbs. Каталог показывает их,
 * а оригиналы остаются для страницы модели.
 *
 * Работает по принципу make: превью, которое новее исходника, пропускается. Пустые файлы пропускаются.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_DIR = path.join(process.cwd(), 'src/assets/models');
// Превью для карточек каталога и миниатюр на странице модели (рамка 480 px, с запасом для плотных экранов).
// Крупное фото страницы модели — исходный снимок без пережатия
const SIZES = [
  { dir: 'thumbs', width: 1600, quality: 90 },
];
// Сколько снимков обрабатывается одновременно: sharp и так использует несколько потоков
const PARALLEL = 3;

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`Нет папки с фотографиями: ${SOURCE_DIR}`);
  process.exit(1);
}

for (const { dir } of SIZES) fs.mkdirSync(path.join(SOURCE_DIR, dir), { recursive: true });

const names = fs
  .readdirSync(SOURCE_DIR)
  .filter((name) => name.toLowerCase().endsWith('.webp'));
const stats = { made: 0, fresh: 0, empty: 0, failed: [], before: 0, after: 0 };

const makeThumb = async (name) => {
  const source = path.join(SOURCE_DIR, name);
  const info = fs.statSync(source);

  if (info.size === 0) {
    stats.empty += 1;

    return;
  }

  for (const { dir, width, quality } of SIZES) {
    const target = path.join(SOURCE_DIR, dir, name);

    if (fs.existsSync(target) && fs.statSync(target).mtimeMs >= info.mtimeMs) {
      stats.fresh += 1;

      continue;
    }

    try {
      await sharp(source, { failOn: 'none' })
        // Поворот по EXIF: снимки с телефона могут лежать боком
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toFile(target);

      stats.made += 1;
      stats.before += info.size;
      stats.after += fs.statSync(target).size;
    } catch (error) {
      stats.failed.push(`${dir}/${name}: ${error.message}`);
    }
  }
};

// Простой пул: следующий снимок берёт тот, кто освободился
let cursor = 0;

const worker = async () => {
  while (cursor < names.length) {
    const name = names[cursor];

    cursor += 1;
    await makeThumb(name);

    if (cursor % 100 === 0) console.log(`  обработано ${cursor} из ${names.length}`);
  }
};

const started = Date.now();

await Promise.all(Array.from({ length: PARALLEL }, () => worker()));

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);

console.log(
  `Превью: создано ${stats.made}, актуальных ${stats.fresh}, пустых исходников ${stats.empty}, ` +
    `ошибок ${stats.failed.length}; за ${((Date.now() - started) / 1000).toFixed(0)} с`,
);

if (stats.made > 0) {
  console.log(`Вес: было ${mb(stats.before)} МБ, стало ${mb(stats.after)} МБ`);
}

for (const line of stats.failed) console.log(`  не удалось: ${line}`);
