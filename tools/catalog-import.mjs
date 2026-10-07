/**
 * Импорт каталога из дампа базы bik55.ru (Drupal, Backup and Migrate) в данные для шаблонов.
 *
 * Запуск: npm run catalog:import -- <путь к дампу .mysql>
 * Без пути берётся самый свежий backup-*.mysql/backup-*.mysql в корне проекта.
 *
 * Результат:
 *   src/data/catalog.json          — типы техники и группы фильтра для шаблонов (переменная catalog)
 *   public/data/catalog.json       — карточки: модели и склад, параметры фильтра, наличие;
 *                                    страница каталога загружает их запросом и выводит порциями
 *   public/data/catalog-specs.json — полные таблицы характеристик моделей для будущих страниц техники
 * Фотографии: в карточках лежат имена файлов из src/assets/models (webp). Имена в дампе — исходные
 * (IMG_2134.JPG, «АЦН-10 (3).JPG»), а файлы при конвертации переименованы: всё, кроме букв, цифр, пробела,
 * «_» и «-», заменено на «-» («АЦН-10 -3-.webp»). Пустые файлы пропускаются.
 * Если два разных снимка имеют после конвертации одно имя (IMG_4531.JPG и IMG_4531.jpg — регистр на Windows
 * не различается), фото не привязывается, а такие снимки попадают в tools/photo-collisions.csv. Чтобы вернуть
 * их, назовите файлы по номеру из базы: fid-1581.webp — такое имя всегда однозначно.
 * Что не удалось разобрать или сопоставить, печатается в отчёте в конце.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'src/data');
const PUBLIC_DIR = path.join(ROOT, 'public/data');
const MODELS_DIR = path.join(ROOT, 'src/assets/models');

// ——— Справочники ———

// Категории каталога bik55.ru → тип техники и назначение (ключи совпадают с адресами меню и фильтра).
// kit — комплект навесного оборудования без шасси; insulated — цистерна с термоизоляцией
const CATEGORIES = {
  270: { type: 'semitrailer', purpose: 'fuel', construction: 'frame' },
  428: { type: 'semitrailer', purpose: 'fuel', construction: 'frame' },
  429: { type: 'semitrailer', purpose: 'fuel', construction: 'frameless' },
  430: { type: 'semitrailer', purpose: 'fuel', construction: 'frameless' },
  271: { type: 'semitrailer', purpose: 'oil' },
  427: { type: 'semitrailer', purpose: 'oil', insulated: true },
  272: { type: 'semitrailer', purpose: 'tech-water' },
  457: { type: 'semitrailer', purpose: 'tech-water', insulated: true },
  274: { type: 'semitrailer', purpose: 'vacuum' },
  291: { type: 'chassis', purpose: 'refueler' },
  292: { type: 'chassis', purpose: 'fuel' },
  293: { type: 'chassis', purpose: 'oil' },
  294: { type: 'chassis', purpose: 'tech-water' },
  296: { type: 'chassis', purpose: 'oil-gathering' },
  297: { type: 'chassis', purpose: 'municipal' },
  383: { type: 'chassis', purpose: 'drinking-water' },
  444: { type: 'chassis', purpose: 'refueler', kit: true },
  445: { type: 'chassis', purpose: 'fuel', kit: true },
  446: { type: 'chassis', purpose: 'oil-gathering', kit: true },
  447: { type: 'chassis', purpose: 'oil', kit: true },
  448: { type: 'chassis', purpose: 'drinking-water', kit: true },
};

const TYPES = [
  { id: 'semitrailer', label: 'Полуприцепы-цистерны', icon: 'ppc' },
  { id: 'chassis', label: 'Цистерны на шасси', icon: 'shassi' },
];

const PURPOSES = [
  ['fuel', 'ГСМ'],
  ['refueler', 'АТЗ'],
  ['oil', 'Нефть'],
  ['tech-water', 'Тех. вода'],
  ['vacuum', 'Вакуумные'],
  ['drinking-water', 'Питьевая вода'],
  ['oil-gathering', 'Сбор нефти'],
  ['municipal', 'Коммунальные'],
];

// Подпись типа на карточке
const TYPE_LABELS = {
  semitrailer: {
    fuel: 'Полуприцеп-цистерна для ГСМ',
    oil: 'Полуприцеп-цистерна для нефти',
    'tech-water': 'Полуприцеп-цистерна для технической воды',
    vacuum: 'Полуприцеп-цистерна вакуумная',
  },
  chassis: {
    refueler: 'Автотопливозаправщик',
    fuel: 'Автоцистерна для ГСМ',
    oil: 'Автоцистерна для нефти',
    'tech-water': 'Автоцистерна для технической воды',
    'oil-gathering': 'Автоцистерна вакуумная для сбора нефти',
    municipal: 'Машина вакуумная коммунальная',
    'drinking-water': 'Автоцистерна для питьевой воды',
  },
};

const KIT_LABEL = 'Навесное оборудование';

const SHAPES = { Чемодан: 'case', Круглое: 'round', Эллипс: 'ellipse' };
const CONSTRUCTIONS = { Рамный: 'frame', 'Без рамный': 'frameless', Безрамный: 'frameless' };
const SUSPENSIONS = { Пневматическая: 'air', Рессорная: 'spring' };
const DRIVES = { Карданный: 'cardan', Гидро: 'hydro' };
const UVT = { Боковое: 'side', 'В заднем отсеке': 'rear' };

// Опечатки в размерах шин: в базе встречаются единичные 425/86R21 и 425/65R21 вместо 425/85R21
const TYRES = {
  '385/65R22,5': '385',
  '425/85R21': '425',
  '425/86R21': '425',
  '425/65R21': '425',
};

// Основные группы видны всегда; остальные (технические детали) сворачиваются под кнопку «Все параметры»
const PRIMARY_FILTERS = new Set(['purpose', 'stock', 'volume', 'sections', 'kit']);

// Группы фильтра в порядке вывода. kind: list — флажки, range — поля «от/до», flag — один флажок.
// Типы техники, к которым относится группа, вычисляются по данным: если значения есть только
// у одного типа, группа показывается, когда выбран он
const FILTERS = [
  { name: 'purpose', label: 'Назначение', kind: 'list', options: PURPOSES, keepOrder: true },
  { name: 'stock', label: 'Наличие', kind: 'flag', options: [['in', 'Только в наличии']] },
  { name: 'volume', label: 'Объём цистерны', kind: 'range', unit: 'м³' },
  // Переключатель у цистерн на шасси: по умолчанию выключен — в списке только готовые автоцистерны,
  // включённый добавляет к ним навесное оборудование (catalog.ts обрабатывает его отдельно от остальных флажков)
  {
    name: 'kit',
    label: 'Дополнительно',
    kind: 'flag',
    options: [['kit', 'Навесное оборудование']],
    keepOrder: true,
  },
  { name: 'sections', label: 'Количество секций', kind: 'list' },
  {
    name: 'shape',
    label: 'Тип сечения цистерны',
    kind: 'list',
    options: [
      ['case', 'Чемодан'],
      ['round', 'Круглое'],
      ['ellipse', 'Эллипс'],
    ],
    keepOrder: true,
  },
  {
    name: 'construction',
    label: 'Особенность конструкции',
    kind: 'list',
    options: [
      ['frame', 'Рамный'],
      ['frameless', 'Безрамный'],
    ],
    keepOrder: true,
  },
  {
    name: 'insulated',
    label: 'Термоизоляция',
    kind: 'flag',
    options: [['yes', 'С термоизоляцией']],
  },
  {
    name: 'suspension',
    label: 'Подвеска',
    kind: 'list',
    options: [
      ['air', 'Пневматическая'],
      ['spring', 'Рессорная'],
    ],
    keepOrder: true,
  },
  { name: 'ssu', label: 'Высота ССУ, мм', kind: 'list' },
  { name: 'axles', label: 'Количество осей', kind: 'list' },
  {
    name: 'axle',
    label: 'Оси',
    kind: 'list',
    options: [
      ['bpw', 'BPW'],
      ['plt', 'PLT'],
    ],
    keepOrder: true,
  },
  {
    name: 'tyres',
    label: 'Шины',
    kind: 'list',
    options: [
      ['385', '385/65R22,5'],
      ['425', '425/85R21'],
    ],
    keepOrder: true,
  },
  { name: 'pump', label: 'Насос', kind: 'list' },
  {
    name: 'drive',
    label: 'Привод насоса',
    kind: 'list',
    options: [
      ['cardan', 'Карданный'],
      ['hydro', 'Гидро'],
    ],
    keepOrder: true,
  },
  {
    name: 'uvt',
    label: 'Расположение УВТ',
    kind: 'list',
    options: [
      ['side', 'Боковое'],
      ['rear', 'В заднем отсеке'],
    ],
    keepOrder: true,
  },
  { name: 'neck', label: 'Горловины', kind: 'list' },
  { name: 'chassis', label: 'Шасси', kind: 'list' },
];

// ——— Разбор дампа ———

const TABLES = new Set([
  'node_field_data',
  'node__field_catalog',
  'node__field_instock',
  'node__field_expected',
  'node__field_price',
  'node__field_model_in_catalog',
  'node__field_images',
  'node__field_novelty',
  'node__field_parameters',
  'node__field_unpublic_from_term',
  'taxonomy_term_field_data',
  'algus_parameters_values',
  'file_managed',
  'path_alias',
]);

const CREATE_RE = /^CREATE TABLE `([^`]+)` \((.*)\)/;
const INSERT_RE = /^INSERT INTO `([^`]+)`(?: \(([^)]*)\))? VALUES /;
const ESCAPES = { n: '\n', r: '\r', t: '\t', 0: '\0', Z: '\u{1A}' };

const splitColumns = (body) => {
  const names = [];
  const source = `${body},`;
  let depth = 0;
  let current = '';

  for (const char of source) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    }

    if (char === ',' && depth === 0) {
      const match = current.match(/^\s*`([^`]+)`/);

      if (match) names.push(match[1]);
      current = '';
    } else {
      current += char;
    }
  }

  return names;
};

// Строка в кавычках: index — позиция открывающей кавычки. Возвращает значение и позицию после строки
const readString = (text, start) => {
  let index = start + 1;
  let value = '';

  while (index < text.length) {
    const char = text[index];

    if (char === '\\') {
      const next = text[index + 1];

      value += Object.hasOwn(ESCAPES, next) ? ESCAPES[next] : next;
      index += 2;
    } else if (char === "'" && text[index + 1] === "'") {
      value += "'";
      index += 2;
    } else if (char === "'") {
      return [value, index + 1];
    } else {
      value += char;
      index += 1;
    }
  }

  return [value, index];
};

// Число или NULL до ближайшей запятой или скобки
const readToken = (text, start) => {
  let end = start;

  while (text[end] !== ',' && text[end] !== ')') end += 1;

  const token = text.slice(start, end).trim();

  return [token.toUpperCase() === 'NULL' ? null : token, end];
};

// Одна запись (a,'b',NULL): index — позиция открывающей скобки. Возвращает значения и позицию после записи
const readRow = (text, start) => {
  const row = [];
  let index = start + 1;

  while (index < text.length) {
    while (text[index] === ' ') index += 1;

    const [value, end] = text[index] === "'" ? readString(text, index) : readToken(text, index);

    row.push(value);
    index = end;

    while (text[index] === ' ') index += 1;

    if (text[index] !== ',') return [row, index + 1];
    index += 1;
  }

  return [row, index];
};

// Разбирает (a,'b',NULL),(...) — строки MySQL с экранированием обратной косой
const parseValues = (text, start) => {
  const rows = [];
  let index = start;

  while (index < text.length) {
    while (' ,\n\r\t'.includes(text[index])) index += 1;
    if (index >= text.length || text[index] === ';') break;

    const [row, end] = readRow(text, index);

    rows.push(row);
    index = end;
  }

  return rows;
};

const readDump = async (file) => {
  const schemas = new Map();
  const tables = new Map([...TABLES].map((name) => [name, []]));
  const lines = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (line.startsWith('CREATE TABLE')) {
      const match = line.match(CREATE_RE);

      if (match && TABLES.has(match[1])) schemas.set(match[1], splitColumns(match[2]));
      continue;
    }

    const match = line.startsWith('INSERT INTO') && line.match(INSERT_RE);

    if (!match || !TABLES.has(match[1])) continue;

    const columns = match[2]
      ? match[2].split(',').map((column) => column.trim().replaceAll('`', ''))
      : schemas.get(match[1]);

    const rows = parseValues(line, match[0].length);

    for (const values of rows) {
      tables
        .get(match[1])
        .push(Object.fromEntries(columns.map((column, index) => [column, values[index]])));
    }
  }

  return tables;
};

// ——— Помощники ———

const TRANSLIT = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const slugify = (text) =>
  [...text.toLowerCase()]
    .map((char) => TRANSLIT[char] ?? char)
    .join('')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

const clean = (value) =>
  value === null || value === undefined ? '' : String(value).replaceAll(' ', ' ').trim();

const decodeEntities = (text) =>
  text
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&laquo;', '«')
    .replaceAll('&raquo;', '»')
    .replaceAll('&ndash;', '–')
    .replaceAll('&mdash;', '—')
    .replaceAll('&deg;', '°')
    .replaceAll('&sup3;', '³')
    .replaceAll('&sup2;', '²')
    .replaceAll('&times;', '×')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replaceAll('&amp;', '&');

const toText = (html) =>
  decodeEntities(html.replaceAll(/<br\s*\/?>/gi, ' ').replaceAll(/<[^>]+>/g, ''))
    .replaceAll(/\s+/g, ' ')
    .trim();

// Таблица характеристик из визуального редактора → разделы со строками [название, значение].
// Строка из одной ячейки — заголовок раздела
const parseSpecs = (html) => {
  const sections = [];
  let section = { title: '', rows: [] };

  for (const [, row] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = row
      .matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)
      .map(([, cell]) => toText(cell))
      .toArray();

    if (cells.every((cell) => cell === '')) continue;

    if (cells.length === 1) {
      if (section.rows.length > 0 || section.title) sections.push(section);
      section = { title: cells[0], rows: [] };
    } else {
      section.rows.push([cells[0], cells.slice(1).filter(Boolean).join(' / ')]);
    }
  }

  if (section.rows.length > 0 || section.title) sections.push(section);

  return sections;
};

// Обозначение полуприцепа: ППЦ-26/3-П3-PLT-1500 → объём 26, 3 секции, пневмоподвеска, 3 оси PLT, ССУ 1500.
// В старых обозначениях (ППЦ-20/1-Р, код 92005) части нет — каждый признак ищется отдельно.
// Без «/n» цистерна односекционная — так обозначены и модели в базе
const parseSemitrailerCode = (title) => {
  const code = title.replace(/\s*\(.*$/, '');
  const head = code.match(/^ППЦ[А-Я]*-(\d+)[А-Я]*(?:\/(\d))?/i);

  if (!head) return {};

  const suspension = code.match(/-([ПР])(\d)?(?=-|$)/i);
  const axle = code.match(/-(PLT|BPW)/i);
  const ssu = code.match(/-(1[1-5]\d0)(?=-|$)/);

  return {
    volume: Number(head[1]),
    sections: head[2] ?? '1',
    suspension: suspension ? (suspension[1].toUpperCase() === 'П' ? 'air' : 'spring') : undefined,
    axles: suspension?.[2],
    axle: axle?.[1].toLowerCase(),
    ssu: ssu?.[1],
  };
};

// Обозначение машины на шасси: АЦ-11/1 КАМАЗ-43118, АТЗ-12/2-Б, АКН-10-2-П → объём и секции
const parseChassisCode = (title) => {
  const match = title.match(/^[А-Я]{2,4}[А-Я]*-(\d+)(?:\/(\d))?/i);

  return match ? { volume: Number(match[1]), sections: match[2] } : {};
};

const parseChassisList = (value) =>
  clean(value)
    .split(/,|\sили\s/)
    .map((name) => clean(name).toUpperCase())
    .filter(Boolean);

// Материалы, у которых фото лежат в src/assets/models: модели и позиции склада
const PHOTO_NODE_TYPES = new Set(['unit_catalog', 'in_stock_technic']);

// Основа имени фотографии для сравнения: без пути и расширения, символы заменены, как при конвертации в webp
const photoKey = (value) =>
  decodeURIComponent(value.split('/').pop())
    .normalize('NFC')
    .replace(/\.[^.]+$/, '')
    .replaceAll(/[^\p{L}\p{N}_ -]/gu, '-')
    .toLowerCase();

// Код в названии: «ППЦВ-20 (код 92052)» → название «ППЦВ-20» и код «92052». Код карточка показывает плашкой
// на фото, а в заголовке остаётся только название. Нет кода — code: null
const splitCode = (title) => {
  const full = clean(title);
  const match = full.match(/\s*\(код\s*([^)]+?)\s*\)/i);

  return match
    ? { model: full.replace(match[0], '').trim(), code: match[1] }
    : { model: full, code: null };
};

const normalizeTitle = (title) =>
  clean(title)
    .replace(/\s*\(код[^)]*\)/i, '')
    .toUpperCase();

// Первое значение поля материала
const first = (map, id) => map.get(id)?.[0];

// Положительное число или null: нули в базе означают «не заполнено»
const toNumber = (value) => {
  const number = Number(clean(value));

  return Number.isFinite(number) && number > 0 ? number : null;
};

// ——— Сборка ———

const findDump = () => {
  const explicit = process.argv[2];

  if (explicit) return path.resolve(explicit);

  const folders = fs
    .readdirSync(ROOT)
    .filter((name) => name.startsWith('backup-') && name.endsWith('.mysql'))
    .toSorted((a, b) => a.localeCompare(b));
  const folder = folders.at(-1);

  if (!folder) throw new Error('Дамп не найден: передайте путь к файлу .mysql');

  const inner = path.join(ROOT, folder, folder);

  return fs.statSync(path.join(ROOT, folder)).isDirectory() ? inner : path.join(ROOT, folder);
};

const main = async () => {
  const dumpFile = findDump();
  const tables = await readDump(dumpFile);
  const report = [];

  // Значения полей материалов: entity_id → [значения], без удалённых
  const field = (name, column = `field_${name}_value`) => {
    const result = new Map();

    for (const row of tables.get(`node__field_${name}`)) {
      if (row.deleted !== '0') continue;
      if (!result.has(row.entity_id)) result.set(row.entity_id, []);
      result.get(row.entity_id).push(row[column]);
    }

    return result;
  };

  const nodes = new Map(tables.get('node_field_data').map((node) => [node.nid, node]));
  const parameters = new Map(tables.get('algus_parameters_values').map((row) => [row.nid, row]));
  const files = new Map(tables.get('file_managed').map((row) => [row.fid, row.uri]));
  const aliases = new Map(tables.get('path_alias').map((row) => [row.path, row.alias]));
  const categories = field('catalog', 'field_catalog_target_id');
  const instock = field('instock');
  const expected = field('expected');
  const prices = field('price');
  const modelReferences = field('model_in_catalog', 'field_model_in_catalog_target_id');
  const images = field('images', 'field_images_target_id');
  const novelty = field('novelty');
  const specsHtml = field('parameters');
  const unpublic = field('unpublic_from_term');

  const published = (type) =>
    nodes
      .values()
      .filter(
        (node) => node.type === type && node.status === '1' && first(unpublic, node.nid) !== '1',
      )
      .toArray();

  // Файлы фотографий в проекте: основа имени (как после конвертации) → имя файла. Пустые файлы не берём
  const modelFiles = new Map();
  let emptyPhotos = 0;
  let missingPhotos = 0;
  let ambiguousPhotos = 0;

  // Разные исходные файлы, чьи имена после конвертации совпадают. На сервере IMG_4531.JPG и IMG_4531.jpg —
  // два снимка, а в проекте (Windows, регистр не важен) остался один webp, и какой именно — неизвестно.
  // Такие фото не привязываем: лучше карточка без фото, чем с чужой техникой.
  // Однозначно назвать файл можно по номеру из базы: fid-1581.webp
  const variants = new Map();

  for (const [nid, fids] of images) {
    const node = nodes.get(nid);

    if (!node || node.status !== '1' || !PHOTO_NODE_TYPES.has(node.type)) continue;

    const knownFids = fids.filter((id) => files.has(id));

    for (const fid of knownFids) {
      const uri = files.get(fid);
      const key = photoKey(uri);

      if (!variants.has(key)) variants.set(key, new Map());
      if (!variants.get(key).has(fid)) {
        variants.get(key).set(fid, { name: decodeURIComponent(uri.split('/').pop()), owners: [] });
      }

      variants.get(key).get(fid).owners.push(clean(node.title));
    }
  }

  const collisions = [...variants].filter(([, group]) => group.size > 1);
  const ambiguous = new Set(collisions.map(([key]) => key));

  if (fs.existsSync(MODELS_DIR)) {
    for (const name of fs.readdirSync(MODELS_DIR)) {
      if (!name.toLowerCase().endsWith('.webp')) continue;

      if (fs.statSync(path.join(MODELS_DIR, name)).size === 0) {
        modelFiles.set(photoKey(name), '');
      } else {
        modelFiles.set(photoKey(name), name);
      }
    }
  }

  // Имена файлов фотографий, которые есть в проекте, в порядке из базы
  const photosOf = (nid) =>
    (images.get(nid) ?? []).flatMap((fid) => {
      const uri = files.get(fid);

      if (!uri) return [];

      // Файл, названный по номеру из базы, однозначен
      const byNumber = modelFiles.get(`fid-${fid}`);

      if (byNumber) return [byNumber];

      const key = photoKey(uri);

      if (ambiguous.has(key)) {
        ambiguousPhotos += 1;

        return [];
      }

      const name = modelFiles.get(key);

      if (name === undefined) missingPhotos += 1;
      else if (name === '') emptyPhotos += 1;

      return name ? [name] : [];
    });

  const urlOf = (nid) => aliases.get(`/node/${nid}`) ?? `/node/${nid}`;

  // Параметры модели из модуля параметров сайта → ключи фильтра
  const readParameters = (nid, category, title) => {
    const row = parameters.get(nid) ?? {};
    const code =
      category.type === 'semitrailer' ? parseSemitrailerCode(title) : parseChassisCode(title);
    const pump = clean(row.pump);
    const tyres = clean(row.tires);
    const result = {
      volume: toNumber(row.volume_tank) ?? code.volume ?? null,
      sections: clean(row.number_of_sections) || code.sections || null,
      shape: SHAPES[clean(row.type_of_tank_section)] ?? null,
      construction: CONSTRUCTIONS[clean(row.construction)] ?? category.construction ?? null,
      insulated: category.insulated ? 'yes' : null,
      suspension: SUSPENSIONS[clean(row.pendant)] ?? code.suspension ?? null,
      ssu: clean(row.ssu_height) || code.ssu || null,
      axles: code.axles ?? null,
      axle: code.axle ?? null,
      tyres: TYRES[tyres] ?? null,
      pump: pump || null,
      drive: DRIVES[clean(row.drive)] ?? null,
      uvt: UVT[clean(row.uvt_placement)] ?? null,
      neck: clean(row.neck) || null,
      chassis: parseChassisList(row.for_chassis),
      kit: category.type === 'chassis' ? (category.kit ? 'kit' : 'chassis') : null,
    };

    if (tyres && !Object.hasOwn(TYRES, tyres))
      report.push(`Шины не распознаны: «${tyres}» (${title})`);

    // Шасси в названии машины: «АЦ-11/1 КАМАЗ-43118»
    if (category.type === 'chassis' && result.chassis.length === 0) {
      const match = title.match(/(КАМАЗ|УРАЛ|МАЗ|ГАЗ)-?\s?(\d{4,5})/i);

      if (match) result.chassis = [`${match[1].toUpperCase()}-${match[2]}`];
    }

    return result;
  };

  const categoryOf = (nid) => {
    const ids = categories.get(nid) ?? [];
    const id = ids.find((value) => Object.hasOwn(CATEGORIES, value));

    if (id) return { id: Number(id), ...CATEGORIES[id] };

    return;
  };

  const items = [];
  const specs = {};
  const byNid = new Map();
  const byTitle = new Map();

  for (const node of published('unit_catalog')) {
    const category = categoryOf(node.nid);

    if (!category) {
      report.push(`Модель без категории: ${node.title} (${node.nid})`);
      continue;
    }

    const item = {
      id: `model-${node.nid}`,
      nid: Number(node.nid),
      ...splitCode(node.title),
      url: urlOf(node.nid),
      category: category.id,
      type: category.type,
      purpose: category.purpose,
      params: readParameters(node.nid, category, clean(node.title)),
      stock: { status: 'order', inStock: 0, expected: 0, units: [] },
      price: toNumber(first(prices, node.nid)),
      isNew: first(novelty, node.nid) === '1',
      photos: photosOf(node.nid),
    };

    items.push(item);
    byNid.set(node.nid, item);
    byTitle.set(normalizeTitle(item.model), item);

    const html = first(specsHtml, node.nid);

    if (html) {
      const sections = parseSpecs(html);

      if (sections.length > 0) specs[item.id] = sections;
    }
  }

  // Склад: позиция, привязанная к модели (или совпавшая с ней по названию), добавляет модели наличие.
  // Позиции без модели становятся отдельными карточками с параметрами из обозначения
  let merged = 0;

  for (const node of published('in_stock_technic')) {
    const inStock = toNumber(first(instock, node.nid)) ?? 0;
    const coming = toNumber(first(expected, node.nid)) ?? 0;
    const title = clean(node.title);
    const unit = {
      nid: Number(node.nid),
      title,
      url: urlOf(node.nid),
      inStock,
      expected: coming,
      photos: photosOf(node.nid),
    };
    const model = byNid.get(first(modelReferences, node.nid)) ?? byTitle.get(normalizeTitle(title));

    if (model) {
      model.stock.inStock += inStock;
      model.stock.expected += coming;
      model.stock.units.push(unit);
      merged += 1;
      continue;
    }

    const category = categoryOf(node.nid);

    if (!category) {
      report.push(`Позиция склада без категории: ${title} (${node.nid})`);
      continue;
    }

    items.push({
      id: `stock-${node.nid}`,
      nid: Number(node.nid),
      ...splitCode(title),
      url: unit.url,
      category: category.id,
      type: category.type,
      purpose: category.purpose,
      params: readParameters(node.nid, category, title),
      stock: { status: 'order', inStock, expected: coming, units: [unit] },
      price: toNumber(first(prices, node.nid)),
      isNew: false,
      photos: photosOf(node.nid),
    });
  }

  for (const item of items) {
    const { stock, params: values } = item;

    // Нет своих фото — берём фото складских единиц этой модели
    if (item.photos.length === 0) {
      item.photos = stock.units.flatMap((unit) => unit.photos);
    }

    stock.status = stock.inStock > 0 ? 'in' : stock.expected > 0 ? 'expected' : 'order';
    values.stock = stock.status === 'in' ? 'in' : null;
    values.purpose = item.purpose;
    item.typeLabel = values.kit === 'kit' ? KIT_LABEL : TYPE_LABELS[item.type][item.purpose];
    item.icon = TYPES.find((type) => type.id === item.type).icon;

    // Четыре характеристики для карточки: объём и секции у всех, дальше — главное для типа техники
    const cardSpecs = [];

    if (values.volume) cardSpecs.push(['Объём', `${values.volume} м³`]);
    if (values.sections) cardSpecs.push(['Секций', values.sections]);

    if (item.type === 'semitrailer') {
      if (values.axles)
        cardSpecs.push([
          'Осей',
          values.axle ? `${values.axles} · ${values.axle.toUpperCase()}` : values.axles,
        ]);
      if (values.suspension)
        cardSpecs.push(['Подвеска', values.suspension === 'air' ? 'Пневмо' : 'Рессоры']);
    } else {
      if (values.chassis.length > 0)
        cardSpecs.push([
          'Шасси',
          values.chassis.length > 1 ? `${values.chassis[0]} и др.` : values.chassis[0],
        ]);
      if (values.pump) cardSpecs.push(['Насос', values.pump]);
    }

    item.specs = cardSpecs.slice(0, 4);

    if (!values.volume) report.push(`Нет объёма: ${item.model} (${item.id})`);
  }

  // Сначала то, что есть на складе, затем ожидаемое; внутри — по типу, назначению и объёму
  const statusOrder = { in: 0, expected: 1, order: 2 };
  const purposeOrder = Object.fromEntries(PURPOSES.map(([id], index) => [id, index]));

  items.sort(
    (a, b) =>
      statusOrder[a.stock.status] - statusOrder[b.stock.status] ||
      -a.type.localeCompare(b.type) ||
      purposeOrder[a.purpose] - purposeOrder[b.purpose] ||
      (a.params.volume ?? 0) - (b.params.volume ?? 0) ||
      a.model.localeCompare(b.model, 'ru'),
  );

  // Группы фильтра: варианты — только встречающиеся значения, с числом моделей у каждого
  const filters = FILTERS.map((filter) => {
    const typesWithValues = new Set();
    const counts = new Map();

    for (const item of items) {
      const raw = item.params[filter.name];
      const values = (Array.isArray(raw) ? raw : [raw]).filter(
        (value) => value !== null && value !== undefined,
      );

      if (values.length === 0) continue;
      typesWithValues.add(item.type);

      for (const value of values) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
    }

    const types = typesWithValues.size === 1 ? [...typesWithValues] : [];

    if (filter.kind === 'range') {
      const volumes = items.map((item) => item.params.volume).filter(Boolean);

      return {
        name: filter.name,
        label: filter.label,
        kind: filter.kind,
        primary: PRIMARY_FILTERS.has(filter.name),
        unit: filter.unit,
        types,
        min: Math.min(...volumes),
        max: Math.max(...volumes),
      };
    }

    const known = filter.options ?? [];
    const labels = new Map(known);
    const values = filter.keepOrder
      ? known.map(([value]) => value).filter((value) => counts.has(value))
      : counts
          .keys()
          .toArray()
          .toSorted((a, b) => a.localeCompare(b, 'ru', { numeric: true }));

    return {
      name: filter.name,
      label: filter.label,
      kind: filter.kind,
      primary: PRIMARY_FILTERS.has(filter.name),
      types,
      options: values.map((value) => ({
        value: filter.name === 'pump' || filter.name === 'chassis' ? slugify(value) : value,
        label: labels.get(value) ?? value,
        count: counts.get(value),
      })),
    };
  }).filter((filter) => filter.kind === 'range' || filter.options.length > 0);

  // Насос и шасси в данных — названия; в фильтре и адресе — латинские ключи
  for (const item of items) {
    item.params.pump = item.params.pump ? slugify(item.params.pump) : null;
    item.params.chassisLabels = item.params.chassis;
    item.params.chassis = item.params.chassis.map((name) => slugify(name));
  }

  const types = TYPES.map((type) => {
    const volumes = items
      .filter((item) => item.type === type.id)
      .map((item) => item.params.volume)
      .filter(Boolean);

    return {
      ...type,
      count: items.filter((item) => item.type === type.id).length,
      volume: [Math.min(...volumes), Math.max(...volumes)],
    };
  });

  const source = {
    dump: path.basename(dumpFile),
    generatedAt: new Date().toISOString().slice(0, 10),
  };
  const catalog = {
    source,
    total: items.length,
    types,
    purposes: PURPOSES.map(([value, label]) => ({ value, label })),
    filters,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'catalog.json'), `${JSON.stringify({ catalog }, null, 2)}\n`);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'catalog.json'), `${JSON.stringify({ source, items })}\n`);
  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'catalog-specs.json'),
    `${JSON.stringify({ source, specs })}\n`,
  );

  const count = (status) => items.filter((item) => item.stock.status === status).length;

  console.log(`Дамп: ${path.basename(dumpFile)}`);
  console.log(
    `Карточек: ${items.length} (моделей ${items.filter((item) => item.id.startsWith('model')).length}, складских без модели ${items.filter((item) => item.id.startsWith('stock')).length})`,
  );
  console.log(
    `Склад: привязано к моделям ${merged}; в наличии ${count('in')}, ожидается ${count('expected')}, под заказ ${count('order')}`,
  );
  console.log(`Таблиц характеристик: ${Object.keys(specs).length}`);
  console.log(
    `Фото: у ${items.filter((item) => item.photos.length > 0).length} из ${items.length} карточек; ` +
      `ссылок без файла ${missingPhotos}, пустых файлов ${emptyPhotos}, ` +
      `неоднозначных ${ambiguousPhotos} (групп с одинаковым именем: ${collisions.length})`,
  );

  // Отчёт для перевыгрузки: какие исходные снимки слились в один файл и как назвать каждый
  const collisionsFile = path.join(ROOT, 'tools/photo-collisions.csv');

  if (collisions.length > 0) {
    const rows = ['fid;исходное имя;назвать файл;кому принадлежит'];

    for (const [, group] of collisions) {
      for (const [fid, variant] of group) {
        rows.push(`${fid};${variant.name};fid-${fid}.webp;${variant.owners.join(' | ')}`);
      }
    }

    // BOM в начале, чтобы Excel открыл русский текст в правильной кодировке
    fs.writeFileSync(collisionsFile, `${String.fromCodePoint(0xfe_ff)}${rows.join('\n')}\n`);
    console.log(`Список снимков с совпавшими именами: ${path.relative(ROOT, collisionsFile)}`);
  } else if (fs.existsSync(collisionsFile)) {
    fs.rmSync(collisionsFile);
  }

  if (report.length > 0) {
    console.log(`\nЗамечания (${report.length}):`);
    for (const line of report) console.log(`  ${line}`);
  }
};

await main();
