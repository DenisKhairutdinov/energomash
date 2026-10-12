export function initClimateStory() {
const host = document.querySelector('[data-climate-canvas]');
const slider = document.querySelector('[data-climate-range]');
const output = document.querySelector('[data-climate-state]');
const status = document.querySelector('[data-climate-status]');
const cold = document.querySelector('[data-climate-cold]');
const copyRoot = document.querySelector('[data-climate-copy]');
const conditionLabels = [...document.querySelectorAll('[data-climate-condition]')];
const copy = {
  // −50 °C confirmed explicitly by the user 2026-10-08 for insulated versions; no passport supplied.
  cold: {eyebrow:'Глава 2 из 4 · Ваш маршрут · холод',title:'Утеплённые версии.<br>Работа при −50 °C.',description:'Для маршрутов, где зима — всерьёз: мороз, зимники и длинные перегоны. Утеплённые цистерны Энергомаш служат при −50 °C. Исполнение подбираем под ваш груз и условия работы.'},
  warm: {eyebrow:'Глава 2 из 4 · Ваш маршрут · бездорожье',title:'Когда асфальт<br>остаётся позади.',description:'Грунтовка, дождь и глубокая колея — тоже рабочий маршрут. Подвеску и комплектацию подбираем под условия перевозки, а не только под объём цистерны.'},
  mixed: {eyebrow:'Глава 2 из 4 · Ваш маршрут',title:'Начинаем с дороги,<br>по которой она поедет.',description:'Зимник при −50 °C и грунтовка в распутицу — это разные задачи. Поэтому сначала спрашиваем про ваш маршрут, а потом подбираем исполнение цистерны.'}
};
const panels = Object.fromEntries(Object.entries(copy).map(([key, content]) => {
  const panel = document.createElement('div');
  panel.className = 'climate-lab__copy-panel';
  panel.dataset.climateCopyPanel = key;
  const eyebrow = document.createElement('p');eyebrow.className='climate-lab__eyebrow';eyebrow.textContent=content.eyebrow;
  const title = document.createElement('h2');title.innerHTML=content.title;
  const description = document.createElement('p');description.textContent=content.description;
  panel.append(eyebrow,title,description);copyRoot.append(panel);
  return [key,panel];
}));
// Environmental illustrations from the approved PPCT-26 sketch, not test photographs.
const update = () => {
  const value = Number(slider.value);
  host.style.setProperty('--split', `${value}%`);
  host.closest('[data-why-us]').style.setProperty('--climate-split', `${value}%`);
  output.textContent = value === 0 ? 'Холодный климат · зимники' : value === 100 ? 'Тёплый климат · грязные дороги' : 'Двигайте разделитель — сравните условия';
  slider.setAttribute('aria-valuetext', `${value}% тёплого климата, ${100-value}% холодного`);
  // At 50% both labels show; the smaller side fades out by 70/30%.
  const smooth = t => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  conditionLabels.forEach(label=>{
    const opacity=label.dataset.climateCondition==='cold'?1-smooth((value-50)/20):1-smooth((50-value)/20);
    label.style.opacity=String(opacity);label.setAttribute('aria-hidden',String(opacity===0));
  });
  const coldWeight = Math.min(1,Math.max(0,(50-value)/25));
  const warmWeight = Math.min(1,Math.max(0,(value-50)/25));
  const weights = {cold:coldWeight,warm:warmWeight,mixed:1-coldWeight-warmWeight};
  const active = Object.keys(weights).reduce((a,b)=>weights[a]>=weights[b]?a:b);
  Object.entries(panels).forEach(([key,panel])=>{
    panel.style.opacity=String(weights[key]);
    panel.setAttribute('aria-hidden',String(key!==active));
  });
};
slider.addEventListener('input', update);
update();
let dragging = false;
const move = event => {
  const rect = host.getBoundingClientRect();
  slider.value = Math.max(0, Math.min(100, (event.clientX-rect.left)/rect.width*100)).toFixed(1);
  update();
};
host.addEventListener('pointerdown', event => {
  if(!event.target.closest('label')) return;
  event.preventDefault();
  dragging = true;
  host.setPointerCapture(event.pointerId);
  slider.focus({preventScroll:true});
  move(event);
});
host.addEventListener('pointermove', event => { if(dragging) move(event); });
host.addEventListener('pointerup', () => { dragging=false; });
host.addEventListener('pointercancel', () => { dragging=false; });
Promise.all(Array.from(host.querySelectorAll('img')).map(img => img.decode())).then(() => {
  status.hidden = true;
  host.dataset.modelLoaded = 'true';
}).catch(() => { status.textContent = 'Не удалось загрузить изображение. Обновите страницу.'; });
}
