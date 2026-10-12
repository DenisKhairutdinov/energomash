// Точка входа блока «Почему мы». Подключается только страницей why-us.njk,
// общие файлы сайта (main.ts, +.js, +.css) не затрагивает.
// Модули только экспортируют init-функции, а запускаем их здесь —
// в порядке исходного черновика и только если блок есть на странице.
import '../../styles/why-us.scss';
import { initEquipmentMap } from './equipment-map.mjs';
import { initSsuEditorial } from './ssu-editorial.mjs';
import { initClimateStory } from './climate-story.js';
import { initSsuScene } from './ssu-scene.js';
import { initStory } from './story.js';
import { initScene4Nav } from './scene4-nav.mjs';
import { initHashOpenTab } from './hash-open-tab.js';
import { initSsuHeightLabel } from './ssu-height-label.js';
import { initSsuOptions } from './ssu-options-v25.js';
import { initSsuPoints } from './ssu-points-v29.js';
import { initSsuModel } from './ssu-model-v29.js';

if (document.querySelector('[data-why-us]')) {
  initEquipmentMap();
  initSsuEditorial();
  initClimateStory();
  initSsuScene();
  initStory();
  initScene4Nav();
  initHashOpenTab();
  initSsuHeightLabel();
  initSsuOptions();
  initSsuPoints();
  initSsuModel();
}