import 'virtual:svg-icons-register';
// import './modules/+.js';
import { initBlog } from './modules/blog.ts';
import { initCatalog } from './modules/catalog.ts';
import { initFilter } from './modules/filter.ts';
import { initRequestForm } from './modules/forms/request-form.ts';
import { hasFullpageSections, initFullpage } from './modules/fullpage.ts';
import { initRequestModal } from './modules/modals/request-modal.ts';
import { initSuccessModal } from './modules/modals/success-modal.ts';
import { initProduct } from './modules/product.ts';
import { initReveal } from './modules/reveal.ts';
import { initSearch } from './modules/search.ts';
import { initShipments } from './modules/shipments.ts';
import { initSliders } from './modules/slider.ts';
import { initSmoothScroll } from './modules/smooth-scroll.ts';
import { initStockSlides } from './modules/stock-slides.ts';
import { initWaterRipples } from './modules/water-ripples.ts';

initFilter();
initCatalog();
// Слайды наличия берутся из каталога, поэтому слайдер запускается, когда они на месте
void initStockSlides().then(initSliders);
initShipments();
initBlog();
// Рябь создаёт canvas на месте фона, поэтому раньше анимации появления: она должна двигать и его
initWaterRipples();
initReveal();
initRequestModal();
initRequestForm();
initSearch();
initProduct();
initSuccessModal();

// На страницах с постраничной прокруткой переходы между секциями плавные сами по себе
if (hasFullpageSections()) {
  initFullpage();
} else {
  initSmoothScroll();
}
