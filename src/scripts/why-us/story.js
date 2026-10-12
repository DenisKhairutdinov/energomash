import { needsPaint, startPaint } from './paint-transition.mjs';
import { mountSnow } from './snow-scene.mjs';
import { startSparks } from './sparks-transition.mjs';
import { startBands } from './bands-transition.mjs';
import { startSnowVortex } from './snow-vortex-transition.mjs';

export function initStory() {
const whyRoot = document.querySelector('[data-why-us]');
const whySlides = [...whyRoot.querySelectorAll('[data-why-slide]')];
const whyTabs = [...whyRoot.querySelectorAll('[data-why-tab]')];
const whyLogo = whyRoot.querySelector('[data-why-logo]');
const reduceWhyMotion = matchMedia('(prefers-reduced-motion: reduce)');
const whySparks = whyRoot.querySelector('[data-why-sparks]');
whySparks.defaultPlaybackRate = .5;
whySparks.playbackRate = .5;
whySparks.addEventListener('loadedmetadata', () => {whySparks.playbackRate = .5;});
const halo = document.createElement('div'); halo.className = 'why-us__halo'; whyLogo.append(halo);
const emblem = document.createElement('div'); emblem.className = 'why-us__emblem'; whyLogo.append(emblem);
for(const modifier of ['side','middle','front']){
  const metal = document.createElement('div'); metal.className = `why-us__metal why-us__metal--${modifier}`; emblem.append(metal);
}
for(const modifier of ['first','second','third']){
  const orbit = document.createElement('div'); orbit.className = `why-us__orbit why-us__orbit--${modifier}`;
  const spark = document.createElement('span'); spark.className = 'why-us__spark'; orbit.append(spark); whyLogo.append(orbit);
}
whyRoot.addEventListener('pointermove', event => {
  if(event.pointerType !== 'mouse' || reduceWhyMotion.matches) return;
  const bounds = whyRoot.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - .5;
  const y = (event.clientY - bounds.top) / bounds.height - .5;
  emblem.style.setProperty('--tilt-x', `${-8 - y * 18}deg`);
  emblem.style.setProperty('--tilt-y', `${-16 + x * 28}deg`);
});
whyRoot.addEventListener('pointerleave', () => {emblem.style.removeProperty('--tilt-x');emblem.style.removeProperty('--tilt-y');});
function animateWhyLogo(){
  whyLogo.removeAttribute('data-logo-running');
  if(!reduceWhyMotion.matches){ void whyLogo.offsetWidth; whyLogo.setAttribute('data-logo-running',''); }
}
const whyObserver = new IntersectionObserver(entries => {
  if(!entries.some(entry => entry.isIntersecting)) return;
  whyRoot.querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
  if(whyIndex === 0) animateWhyLogo();
}, {threshold:.35});
whyObserver.observe(whyRoot);
const paint = document.createElement('div');
paint.className='why-paint';paint.setAttribute('aria-hidden','true');
whyRoot.append(paint);
mountSnow(whyRoot.querySelector('[data-ssu-scene]'));
const sparkLayer=document.createElement('div');sparkLayer.className='why-sparks-transition';sparkLayer.setAttribute('aria-hidden','true');whyRoot.append(sparkLayer);
const bandLayer=document.createElement('div');bandLayer.className='why-sparks-transition why-bands-transition';bandLayer.setAttribute('aria-hidden','true');whyRoot.append(bandLayer);
const snowVortexLayer=document.createElement('div');snowVortexLayer.className='why-snow-vortex-transition';snowVortexLayer.setAttribute('aria-hidden','true');whyRoot.append(snowVortexLayer);
let paintTimer, sparkRevealTimer, paintPending=false, pendingTarget, stopPaint;
let whyIndex = 0;
function showWhy(index, focus = false){
  const target=(index+whySlides.length)%whySlides.length;
  if(paintPending&&target===pendingTarget)return;
  clearTimeout(paintTimer);clearTimeout(sparkRevealTimer);stopPaint?.();paintPending=false;paint.classList.remove('is-running');sparkLayer.classList.remove('is-running');bandLayer.classList.remove('is-running');snowVortexLayer.classList.remove('is-running');
  if(whyIndex===3&&target===4&&!reduceWhyMotion.matches){
    paintPending=true;pendingTarget=target;snowVortexLayer.classList.add('is-running');stopPaint=startSnowVortex(snowVortexLayer);
    sparkRevealTimer=setTimeout(()=>commitShowWhy(target,focus),550);
    paintTimer=setTimeout(()=>{stopPaint?.();paintPending=false;snowVortexLayer.classList.remove('is-running');},1400);
    return;
  }
  if(whyIndex===1&&target===2&&!reduceWhyMotion.matches){
    paintPending=true;pendingTarget=target;bandLayer.classList.add('is-running');
    stopPaint=startBands(bandLayer,Number(whyRoot.querySelector('[data-climate-range]').value),whySlides[1]);
    sparkRevealTimer=setTimeout(()=>commitShowWhy(target,focus),950);
    paintTimer=setTimeout(()=>{stopPaint?.();paintPending=false;bandLayer.classList.remove('is-running');},1800);
    return;
  }
  if(whyIndex===0&&target===1&&!reduceWhyMotion.matches){
    paintPending=true;pendingTarget=target;sparkLayer.classList.add('is-running');stopPaint=startSparks(sparkLayer);
    sparkRevealTimer=setTimeout(()=>commitShowWhy(target,focus),550);
    paintTimer=setTimeout(()=>{stopPaint?.();paintPending=false;sparkLayer.classList.remove('is-running');},1400);
    return;
  }
  if(needsPaint(whyIndex,target,reduceWhyMotion.matches)){
    paintPending=true;pendingTarget=target;void paint.offsetWidth;paint.classList.add('is-running');
    stopPaint=startPaint(paint);
    paintTimer=setTimeout(()=>{stopPaint?.();paintPending=false;paint.classList.remove('is-running');commitShowWhy(target,focus);},1400);
    return;
  }
  commitShowWhy(target,focus);
}
function commitShowWhy(index, focus = false){
  whyIndex = (index + whySlides.length) % whySlides.length;
  whyRoot.toggleAttribute('data-climate-active', whyIndex === 1);
  whyRoot.toggleAttribute('data-livery-active', whyIndex === 2);
  whyRoot.toggleAttribute('data-ssu-active', whyIndex === 3);
  whyRoot.toggleAttribute('data-finance-active', whyIndex === 4);
  if(whyIndex === 4) whyRoot.scrollIntoView({block:'start',behavior:'instant'});
  if(whyIndex === 0) animateWhyLogo();
  whySlides.forEach((slide, i) => {
    slide.hidden = i !== whyIndex;
    slide.setAttribute('aria-hidden', String(i !== whyIndex));
    slide.querySelectorAll('video').forEach(video => {
      if(i !== whyIndex) video.pause();
      else if(!matchMedia('(prefers-reduced-motion: reduce)').matches) video.play().catch(() => {});
    });
  });
  whyTabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === whyIndex)); tab.tabIndex = i === whyIndex ? 0 : -1; });
  whyRoot.querySelector('[data-why-count]').textContent = `0${whyIndex + 1} / 0${whySlides.length}`;    if(focus) whyTabs[whyIndex].focus();
}
whyTabs.forEach((tab, i) => {
  tab.addEventListener('click', () => showWhy(i));
  tab.addEventListener('keydown', event => {
    if(event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); showWhy(whyIndex + (event.key === 'ArrowRight' ? 1 : -1), true); }
  });
});
whyRoot.querySelector('[data-why-next]').addEventListener('click', () => showWhy(whyIndex + 1));
whyRoot.querySelector('[data-why-prev]').addEventListener('click', () => showWhy(whyIndex - 1));
document.addEventListener('keydown', event => {
  const bounds = whyRoot.getBoundingClientRect();
  if(event.defaultPrevented || bounds.top >= innerHeight || bounds.bottom <= 0 || event.target.closest('input,textarea,select,[data-ssu-controls],[data-ssu-model-controls]')) return;
  if(event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.code === 'Space'){
    event.preventDefault();
    showWhy(whyIndex + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});
if(matchMedia('(prefers-reduced-motion: reduce)').matches) whyRoot.querySelectorAll('video').forEach(video => { video.autoplay = false; video.pause(); });
}
