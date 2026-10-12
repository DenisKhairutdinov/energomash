import { asset, assetSrcset } from './asset.js';
import {options,navigate} from './equipment-data.mjs';
import {mountBrakes} from './brakes-comparison.mjs';

export function initEquipmentMap() {
const scene=document.querySelector('.ssu-editorial');
const existing=scene.querySelector('.ssu-editorial__layout');
const map=document.createElement('section');
map.className='equipment-map';
map.setAttribute('aria-label','Оснащение под вашу работу');
const brand='<div class="equipment-brand"><img src="'+asset('logo-transparent.png')+'" alt="Логотип Энергомаш"><div><strong>ЭНЕРГОМАШ</strong><span>Исполнение под вашу технику.</span></div></div>';
map.innerHTML=`<header class="equipment-header"><div><p class="equipment-eyebrow">Глава 4 из 4 · Под вашу работу</p><h2>Ваша техника.<br>Ваша комплектация.</h2><p class="equipment-lead">Нажмите на номер — расскажем, что это за опция.</p></div>${brand}</header><figure class="equipment-photo"><img src="${asset('equipment-truck.png')}" width="1280" height="853" alt="Красный тягач с синей цистерной Энергомаш. Номера обозначают зоны возможного оснащения."><div class="equipment-points"></div></figure><div class="equipment-list" role="group" aria-label="Опции комплектации"></div><p class="equipment-note">Зоны установки показаны условно. Наличие опций на фото не подтверждается; комплектацию согласуем для выбранной модели.</p>`;
scene.prepend(map);
map.querySelector('.equipment-photo>img').src=asset('equipment-zimnik-v3.png');
map.querySelector('.equipment-photo>img').width=1536;
map.querySelector('.equipment-photo>img').height=1024;
map.querySelector('.equipment-list').remove();
map.querySelector('.equipment-note').textContent='Рекламная визуализация зимника · зоны оснащения условные. Комплектация — по согласованию.';
const snow=document.createElement('div');snow.className='equipment-snow';snow.setAttribute('aria-hidden','true');map.append(snow);
const detail=document.createElement('section');
detail.className='equipment-detail';detail.hidden=true;
detail.innerHTML=`<header class="equipment-header"><div><button class="equipment-back" type="button">← К машине</button><p class="equipment-eyebrow" data-detail-number></p><h2 data-detail-heading tabindex="-1"></h2><p class="equipment-lead" data-detail-lead></p></div>${brand}</header><div class="equipment-detail-body"><figure class="equipment-closeup"><picture><source data-detail-image-source type="image/webp"><img src="${asset('equipment-truck.png')}" alt="Общий кадр вашей техники; зона оснащения показана условно"></picture><figcaption>Контекстный кадр · не фотография установленной опции</figcaption></figure><div class="equipment-copy"><div data-detail-copy></div><h3>Что согласуем при заказе</h3><ul data-detail-items></ul></div></div><p class="equipment-note">Оборудование и место установки — по согласованной комплектации.</p>`;
scene.append(detail);
const ssuBack=document.createElement('button');ssuBack.className='equipment-back equipment-close';ssuBack.type='button';ssuBack.dataset.equipmentClose='';ssuBack.setAttribute('aria-label','Закрыть выбор высоты ССУ и вернуться к машине');ssuBack.title='К машине';ssuBack.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>';existing.prepend(ssuBack);
const brakesView=mountBrakes({scene,brand,onBack:()=>show('back')});
const closeIcon='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function placeExit(view,button){
 const toolbar=document.createElement('div');toolbar.className='equipment-subview-toolbar';toolbar.dataset.equipmentSubviewToolbar='';
 const caption=document.createElement('span');caption.className='equipment-subview-toolbar__caption';caption.textContent='Оснащение под вашу работу';
 const group=document.createElement('div');group.className='equipment-subview-toolbar__actions';
 const logo=view.querySelector('.equipment-brand,.ssu-editorial__brand');if(logo)group.append(logo);
 button.classList.add('equipment-back','equipment-close');button.dataset.equipmentSubviewClose='';button.type='button';button.title='Вернуться к машине';button.setAttribute('aria-label','Закрыть раздел и вернуться к машине');button.innerHTML=closeIcon;
 group.append(button);toolbar.append(caption,group);view.prepend(toolbar);
}
placeExit(existing,ssuBack);placeExit(detail,detail.querySelector('.equipment-back'));placeExit(brakesView,brakesView.querySelector('[data-brakes-close]'));
let state={view:'map'};
function show(action) {
 state=navigate(state,action);
 const isMap=state.view==='map', isSSU=!isMap&&state.option.kind==='ssu',isBrakes=!isMap&&state.option.id==='brakes';
 map.hidden=!isMap;existing.hidden=!isSSU;detail.hidden=isMap||isSSU||isBrakes;brakesView.hidden=!isBrakes;
 scene.dataset.equipmentView=isMap?'map':isSSU?'ssu':isBrakes?'brakes':'detail';
 scene.classList.remove('is-entering');void scene.offsetWidth;scene.classList.add('is-entering');
 if(isMap){if(state.focus)map.querySelector(`[data-equipment="${state.focus}"]`).focus({preventScroll:true});scene.scrollIntoView({block:'start',behavior:'instant'});return;}
 if(isSSU){ssuBack.focus({preventScroll:true});scene.scrollIntoView({block:'start',behavior:'instant'});return;}
 if(isBrakes){brakesView.querySelector('[data-brakes-heading]').focus({preventScroll:true});scene.scrollIntoView({block:'start',behavior:'instant'});return;}
 const option=state.option;
 detail.querySelector('[data-detail-number]').textContent=`${option.number} / ${option.title}`;
 detail.querySelector('[data-detail-heading]').textContent=option.heading;
 detail.querySelector('[data-detail-lead]').textContent=option.lead;
 const copyRoot=detail.querySelector('[data-detail-copy]');copyRoot.replaceChildren();(option.paragraphs||[option.copy]).forEach(text=>{const paragraph=document.createElement('p');paragraph.textContent=text;copyRoot.append(paragraph);});
 detail.dataset.equipmentOption=option.id;scene.dataset.detailOption=option.id;
 const photo=detail.querySelector('.equipment-closeup img'),photoSource=detail.querySelector('[data-detail-image-source]'),back=detail.querySelector('.equipment-back');
 const isHeat=option.id==='heat';back.classList.add('equipment-close');back.setAttribute('aria-label','Закрыть раздел и вернуться к машине');
 back.innerHTML=closeIcon;
 if(isHeat){photoSource.srcset=assetSrcset('heat/heated-compartment-640.webp 640w, heat/heated-compartment-1280.webp 1280w');photoSource.sizes='(max-width:700px) calc(100vw - 40px), 55vw';photo.src=asset('heat/heated-compartment-original.jpg');photo.width=1280;photo.height=853;photo.alt='Подогреваемый отсек цистерны Энергомаш: открытая крышка, сливной узел и оборудование внутри';detail.querySelector('.equipment-closeup figcaption').textContent='Подогреваемый отсек «Энергомаш» · реальное фото';}
    else if(option.id==='pump'){photoSource.srcset=assetSrcset('pump/blackmer-txd-360.webp 360w, pump/blackmer-txd-600.webp 600w');photoSource.sizes='(max-width:700px) calc(100vw - 40px), 40vw';photo.src=asset('pump/blackmer-txd-example.png');photo.width=600;photo.height=600;photo.alt='Пример пластинчатого транспортного насоса Blackmer TXD для перекачки топлива';detail.querySelector('.equipment-closeup figcaption').textContent='Blackmer TXD · пример насоса · модель по согласованию';}
else if(option.id==='meter'){photoSource.srcset=assetSrcset('meter/lc-meter-360.webp 360w, meter/lc-meter-800.webp 800w');photoSource.sizes='(max-width:700px) calc(100vw - 40px), 40vw';photo.src=asset('meter/lc-meter-800.webp');photo.width=800;photo.height=800;photo.alt='Пример счётчика выдачи Liquid Controls с электронным индикатором';detail.querySelector('.equipment-closeup figcaption').textContent='Liquid Controls · иллюстрация по каталожному образцу · модель по согласованию';}
 else if(option.id==='box'){photoSource.removeAttribute('srcset');photoSource.removeAttribute('sizes');photo.src=asset('box/toolbox-original.jpg');photo.width=1280;photo.height=853;photo.alt='Инструментальный ящик на цистерне Энергомаш — увеличенный фрагмент фотографии';detail.querySelector('.equipment-closeup figcaption').textContent='Инструментальный ящик «Энергомаш» · фрагмент фото';}
 else{photoSource.removeAttribute('srcset');photoSource.removeAttribute('sizes');photo.src=asset('equipment-truck.png');photo.removeAttribute('width');photo.removeAttribute('height');photo.alt='Общий кадр вашей техники; зона оснащения показана условно';detail.querySelector('.equipment-closeup figcaption').textContent='Контекстный кадр · не фотография установленной опции';}
 photo.style.objectPosition=option.position;
 const items=detail.querySelector('[data-detail-items]');items.replaceChildren();
 option.items.forEach(text=>{const li=document.createElement('li');li.textContent=text;items.append(li)});
 detail.querySelector('[data-detail-heading]').focus({preventScroll:true});
 scene.scrollIntoView({block:'start',behavior:'instant'});
}
options.forEach(option=>{
 const point=document.createElement('button');point.type='button';point.className='equipment-point';point.dataset.equipment=option.id;point.style.setProperty('--x',option.x+'%');point.style.setProperty('--y',option.y+'%');point.textContent=option.number;point.setAttribute('aria-label',option.number+' — '+option.title);point.addEventListener('click',()=>show(option.id));map.querySelector('.equipment-points').append(point);
 const caption=document.createElement('span');caption.className='equipment-point-caption';caption.textContent=option.title;point.append(caption);
});
detail.querySelector('.equipment-back').addEventListener('click',()=>show('back'));
ssuBack.addEventListener('click',()=>show('back'));
scene.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&state.view==='detail'){event.preventDefault();show('back');}
 // Keep native controls inside this scene from changing the outer chapters.
 if(event.key===' '||event.key==='ArrowLeft'||event.key==='ArrowRight')event.stopPropagation();
});
existing.hidden=true;scene.dataset.equipmentView='map';
}
