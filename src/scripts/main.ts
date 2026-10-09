import 'virtual:svg-icons-register';
// import './modules/+.js';
import { initBlog } from './modules/blog.ts';
import { initCatalog } from './modules/catalog.ts';
import { initErrorPage } from './modules/error-page.ts';
import { initFilter } from './modules/filter.ts';
import { initRequestForm } from './modules/forms/request-form.ts';
import { hasFullpageSections, initFullpage } from './modules/fullpage.ts';
import { initRequestModal } from './modules/modals/request-modal.ts';
import { initSuccessModal } from './modules/modals/success-modal.ts';
import { initPageEndPhoto } from './modules/page-end-photo.ts';
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
initErrorPage();
// Рябь создаёт canvas на месте фона, поэтому раньше анимации появления: она должна двигать и его
initWaterRipples();
initReveal();
initRequestModal();
initRequestForm();
initSearch();
initSuccessModal();

void initPageEndPhoto();

// На страницах с постраничной прокруткой переходы между секциями плавные сами по себе
const initScroll = (): void => {
  if (hasFullpageSections()) {
    initFullpage();
  } else {
    initSmoothScroll();
  }
};

// Страница модели сама решает, какие экраны у неё есть (блока похожих моделей может не быть), поэтому прокрутка
// запускается после того, как она заполнена; на остальных страницах это происходит сразу
void initProduct().then(initScroll);
