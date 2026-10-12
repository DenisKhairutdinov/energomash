import { asset, assetSrcset } from './asset.js';

export function initSsuModel() {
(()=>{const root=document.querySelector('[data-ssu-scene]');if(!root)return;
const models={parus:{files:{low:'parus26-low-v26.webp',medium:'parus26-medium-v26.webp',high:'parus26-high-v26.webp'},alt:'ППЦТ-26 · 3 оси · Парус, оранжевый / белый / угольный'},orbita:{files:{low:'orbita20-low-v29.webp',medium:'orbita20-medium-v29.webp',high:'orbita20-high-v29.webp'},alt:'ППЦ-20 · техническая вода · 2 оси · Орбита, медь'}};
const choices=[...root.querySelectorAll('[data-ssu-model-choice]')],pictures=[...root.querySelectorAll('[data-ssu-picture]')];let request=0;
async function select(value){const ticket=++request,model=models[value];root.setAttribute('aria-busy','true');try{await Promise.all(Object.values(model.files).map(file=>{const image=new Image();image.src=asset('ssu/'+file);return image.decode();}));if(ticket!==request)return;pictures.forEach(image=>{image.src=asset('ssu/'+model.files[image.dataset.ssuPicture]);image.alt=model.alt+' — '+{low:'низкое',medium:'среднее',high:'высокое'}[image.dataset.ssuPicture]+' ССУ, визуализация';});root.dataset.ssuModel=value;choices.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ssuModelChoice===value)));root.dispatchEvent(new Event('ssu-model-change'));}catch(error){console.error('Не удалось загрузить модель цистерны',error);}finally{if(ticket===request)root.removeAttribute('aria-busy');}}
choices.forEach((button,index)=>{button.addEventListener('click',()=>select(button.dataset.ssuModelChoice));button.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();const next=choices[1-index];next.focus();next.click();}});});
})();
}
