import 'virtual:svg-icons-register';
// import './modules/+.js';
import { initBlog } from './modules/blog.ts';
import { initCatalog } from './modules/catalog.ts';
import { initFilter } from './modules/filter.ts';
import { hasFullpageSections, initFullpage } from './modules/fullpage.ts';
import { initReveal } from './modules/reveal.ts';
import { initShipments } from './modules/shipments.ts';
import { initSliders } from './modules/slider.ts';
import { initSmoothScroll } from './modules/smooth-scroll.ts';

initFilter();
initCatalog();
initSliders();
initShipments();
initBlog();
initReveal();

// На страницах с постраничной прокруткой переходы между секциями плавные сами по себе
if (hasFullpageSections()) {
  initFullpage();
} else {
  initSmoothScroll();
}
