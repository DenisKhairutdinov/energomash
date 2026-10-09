// Строит разметку карты для блока «География поставок»: регионы России (SVG-пути) и маркер завода.
// Запуск: node tools/geography-map.mjs <путь к GeoJSON регионов России (Natural Earth, ne_50m_admin_1_states_provinces)>
// Результат: src/templates/geography-map.njk. Проекция — коническая равновеликая Альберса, как на картах России.
// Регионы с поставками, их города и число единиц — данные-заглушки: позже они придут из базы отгрузок.
import fs from 'node:fs';

const [source] = process.argv.slice(2);

if (!source) {
  throw new Error('Укажите путь к GeoJSON регионов России');
}

const WIDTH = 1440;
const HEIGHT = 900;
const MARGIN = 48;
const CENTER_LON = 100;
const PARALLELS = [52, 64];
const ORIGIN_LAT = 56;
const MIN_STEP = 0.8;
const MIN_AREA = 3;
const SEAM_LON = 179.99;

// Поставки по регионам (ключ — название региона в данных Natural Earth по-русски). Заглушки.
const DELIVERIES = {
  'Челябинская область': { units: 96, cities: 'Челябинск, Магнитогорск, Миасс' },
  'Свердловская область': { units: 58, cities: 'Екатеринбург, Нижний Тагил' },
  'Республика Башкортостан': { units: 34, cities: 'Уфа, Стерлитамак' },
  'Оренбургская область': { units: 26, cities: 'Оренбург, Орск' },
  'Курганская область': { units: 12, cities: 'Курган' },
  'Пермский край': { units: 20, cities: 'Пермь, Березники' },
  'Тюменская область': { units: 44, cities: 'Тюмень, Тобольск' },
  'Ханты-Мансийский автономный округ — Югра': {
    units: 110,
    cities: 'Сургут, Нижневартовск, Ханты-Мансийск',
  },
  'Ямало-Ненецкий автономный округ': {
    units: 88,
    cities: 'Новый Уренгой, Ноябрьск, Надым',
  },
  'Омская область': { units: 30, cities: 'Омск' },
  'Новосибирская область': { units: 28, cities: 'Новосибирск' },
  'Томская область': { units: 10, cities: 'Томск' },
  'Республика Коми': { units: 30, cities: 'Усинск, Ухта' },
  Татарстан: { units: 66, cities: 'Набережные Челны, Казань' },
  'Самарская область': { units: 31, cities: 'Самара, Тольятти' },
  'Саратовская область': { units: 25, cities: 'Саратов' },
  'Нижегородская область': { units: 16, cities: 'Нижний Новгород' },
  Москва: { units: 27, cities: 'Москва' },
  'Воронежская область': { units: 14, cities: 'Воронеж' },
  'Краснодарский край': { units: 17, cities: 'Краснодар, Новороссийск' },
  'Красноярский край': { units: 22, cities: 'Красноярск, Норильск' },
  'Иркутская область': { units: 15, cities: 'Иркутск, Братск' },
  Якутия: { units: 12, cities: 'Якутск, Мирный' },
  'Хабаровский край': { units: 9, cities: 'Хабаровск' },
};

// Завод: рисуется отдельной меткой поверх карты
const HUB = { name: 'Завод', lat: 55.16, lon: 61.4 };

const rad = (degrees) => (degrees * Math.PI) / 180;
const [phi1, phi2] = PARALLELS.map((value) => rad(value));
const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
const c = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
const rho0 = Math.sqrt(c - 2 * n * Math.sin(rad(ORIGIN_LAT))) / n;

// Долготы за 180° (Чукотка) переводим в 180..190°, чтобы страна не рвалась на две части
const project = (lon, lat) => {
  const shifted = lon < 0 ? lon + 360 : lon;
  const rho = Math.sqrt(c - 2 * n * Math.sin(rad(lat))) / n;
  const theta = n * rad(shifted - CENTER_LON);

  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
};

const collection = JSON.parse(fs.readFileSync(source, 'utf8'));
const regions = collection.features.map((feature) => {
  const { geometry, properties } = feature;
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  const name =
    properties.name_en === 'Altai Krai' ? 'Алтайский край' : (properties.name_ru ?? properties.name);

  return {
    name,
    rings: polygons.map((polygon) =>
      polygon[0].map(([lon, lat]) => ({ point: project(lon, lat), seam: Math.abs(lon) >= SEAM_LON })),
    ),
  };
});

const allPoints = regions.flatMap((region) => region.rings.flat().map((entry) => entry.point));
const xs = allPoints.map((point) => point[0]);
const ys = allPoints.map((point) => point[1]);
const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const scale = (WIDTH - MARGIN * 2) / (maxX - minX);
const offsetY = (HEIGHT - (maxY - minY) * scale) / 2;
const toScreen = ([x, y]) => [MARGIN + (x - minX) * scale, offsetY + (maxY - y) * scale];
const format = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;

const area = (points) => {
  let sum = 0;

  for (const [index, [x1, y1]] of points.entries()) {
    const [x2, y2] = points[(index + 1) % points.length];

    sum += x1 * y2 - x2 * y1;
  }

  return Math.abs(sum) / 2;
};

const simplify = (ring) => {
  const kept = [];

  for (const entry of ring) {
    const last = kept.at(-1)?.point;

    if (!last || Math.hypot(entry.point[0] - last[0], entry.point[1] - last[1]) >= MIN_STEP) {
      kept.push(entry);
    }
  }

  return kept;
};

const slug = (index) => `region-${index + 1}`;

const buildRegion = (region, index) => {
  const rings = region.rings
    .map((ring) => ring.map((entry) => ({ point: toScreen(entry.point), seam: entry.seam })))
    .filter((ring) => area(ring.map((entry) => entry.point)) > MIN_AREA)
    .map((ring) => simplify(ring));

  const fill = rings.map((ring) => `M${ring.map((entry) => format(entry.point)).join('L')}Z`).join('');
  // Контур без отрезков вдоль линии перемены дат: разрезанная Чукотка не должна иметь шва внутри
  const outline = rings
    .map((ring) =>
      ring
        .map((entry, position) => {
          const skip = position === 0 || (entry.seam && ring.at(position - 1).seam);

          return `${skip ? 'M' : 'L'}${format(entry.point)}`;
        })
        .join(''),
    )
    .join('');
  const hasSeam = rings.some((ring) => ring.some((entry) => entry.seam));
  const delivery = DELIVERIES[region.name];

  return { id: slug(index), name: region.name, fill, outline, hasSeam, delivery };
};

const built = regions.map((region, index) => buildRegion(region, index));
const unknown = Object.keys(DELIVERIES).filter((key) => !built.some((region) => region.name === key));

if (unknown.length > 0) {
  throw new Error(`Нет в данных регионов: ${unknown.join(', ')}`);
}

const escapeAttribute = (text) => text.replaceAll('"', '&quot;');

const paths = built
  .map((region) => {
    const attributes = [
      `class="geography__region${region.delivery ? ' is-delivered' : ''}"`,
      `data-geography-region="${region.id}"`,
      `data-name="${escapeAttribute(region.name)}"`,
      region.delivery ? `data-units="${region.delivery.units}"` : '',
      region.delivery ? `data-cities="${escapeAttribute(region.delivery.cities)}"` : '',
      region.hasSeam ? 'data-seam' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `    <path ${attributes} d="${region.fill}" />`;
  })
  .join('\n');

// У регионов, разрезанных линией перемены дат, собственная обводка отключена (data-seam) и вместо неё
// рисуется контур без шва поверх карты
const borders = built
  .filter((region) => region.hasSeam)
  .map((region) => `    <path class="geography__border" d="${region.outline}" />`)
  .join('\n');

const [hubX, hubY] = toScreen(project(HUB.lon, HUB.lat));
const markup = `{# Сгенерировано tools/geography-map.mjs — не править руками. Регионы России и метка завода в одной системе координат. #}
<svg class="geography__svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Карта России: регионы, куда поставлена техника">
  <g class="geography__regions-layer">
${paths}
  </g>
  <g class="geography__borders">
${borders}
  </g>
</svg>
<div class="geography__hub" style="--x: ${((hubX / WIDTH) * 100).toFixed(2)}%; --y: ${((hubY / HEIGHT) * 100).toFixed(2)}%">
  <span class="geography__hub-dot"></span>
  <span class="geography__hub-name">${HUB.name}</span>
</div>
`;

fs.writeFileSync(new URL('../src/templates/geography-map.njk', import.meta.url), markup);
console.log(
  `регионов ${built.length}, с поставками ${built.filter((region) => region.delivery).length}, ${markup.length} символов`,
);
