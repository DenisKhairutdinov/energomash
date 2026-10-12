export function initSsuScene() {
(() => {
 const root=document.querySelector('[data-ssu-scene]');
 if(!root)return;
 const buttons=[...root.querySelectorAll('[data-ssu-choice]')];
 const pictures=[...root.querySelectorAll('[data-ssu-picture]')];
 const indicator=root.querySelector('[data-ssu-indicator]');
 const caption=root.querySelector('[data-ssu-caption]');
 let timer;
 buttons.forEach((button,index)=>{
  button.addEventListener('click',()=>{
   root.dataset.ssuState=button.dataset.ssuChoice;
   buttons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
   pictures.forEach(img=>img.classList.toggle('is-active',img.dataset.ssuPicture===button.dataset.ssuChoice));
   indicator.style.left='calc('+index+' * (100% - 8px) / 3 + 4px)';
   caption.textContent='Исполнение под '+['низкое','среднее','высокое'][index]+' ССУ';
   root.classList.remove('is-changing');void root.offsetWidth;root.classList.add('is-changing');
   clearTimeout(timer);timer=setTimeout(()=>root.classList.remove('is-changing'),750);
  });
  button.addEventListener('keydown',event=>{
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();event.stopPropagation();
    const next=buttons[(index+(event.key==='ArrowRight'?1:2))%3];next.focus();next.click();
   }
  });
 });
})();
}
