export function needsPaint(from,to,reduced){return from===2&&to===3&&!reduced;}
export function splashState(drop,ms){
 return {x:drop.x,y:drop.y,scale:Math.max(0,Math.min(1,(ms-drop.born)/90))};
}
export function paintProgress(ms){
 const t=Math.max(0,Math.min(1,(ms-250)/1400));
 return {gather:t*t*(3-2*t),alpha:Math.max(0,Math.min(1,ms/180,(2800-ms)/450))};
}
export function startPaint(layer){
 const canvas=document.createElement('canvas');canvas.className='why-paint__canvas';
 layer.replaceChildren(canvas);
 const width=layer.clientWidth,height=layer.clientHeight;
 const ratio=Math.min(devicePixelRatio||1,1.5);
 canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
 const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
 const mask=document.createElement('canvas');mask.width=width;mask.height=height;
 const pen=mask.getContext('2d',{willReadFrequently:true});
 let size=Math.min(142,width*.105);
 pen.font=`850 ${size}px Arial,sans-serif`;
 size*=Math.min(1,width*.87/pen.measureText('ЭНЕРГОМАШ').width);
 pen.font=`850 ${size}px Arial,sans-serif`;pen.textAlign='center';pen.textBaseline='middle';
 pen.fillText('ЭНЕРГОМАШ',width/2,height*.48);
 const pixels=pen.getImageData(0,0,width,height).data;
 const colors=['#6f2f1d','#173f50','#655024','#293c31','#35424c'];
 const blotColors=['#efb091','#abd3df','#efd79b','#bbccae','#c8d2de'];
 const particles=[],step=Math.max(2,Math.round(size/36));
 for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
  if(pixels[(y*width+x)*4+3]<130)continue;
  const group=Math.min(4,Math.floor(x/width*5));
  const seed=Math.sin(x*12.9898+y*78.233)*43758.5453;
  const noise=seed-Math.floor(seed);
  // Each shake deposits a fresh scattering directly onto the canvas.
  const burst=Math.floor(noise*6);
  particles.push({x:x+(noise-.5)*step*.7,y:y+Math.sin(seed)*step*.35,born:240+burst*215+Math.abs(Math.sin(seed))*110,color:colors[group],radius:step*(.62+noise*.55),angle:noise*Math.PI*2});
 }
 // A few stray drops outside the letter edges keep the mark hand-splattered.
 const letteringDrops=particles.slice();
 for(let i=0;i<letteringDrops.length;i+=53){
  const p=letteringDrops[i],distance=10+(i%31);
  particles.push({...p,x:p.x+Math.cos(p.angle)*distance,y:p.y+Math.sin(p.angle)*distance,radius:1+(i%3)*.6});
 }
 // Round paint blots sit behind the lettering, with small satellite drops.
 const blotRadius=Math.min(width*.135,height*.155);
 const blots=blotColors.map((color,i)=>({color,x:width*(.26+i*.12),y:height*.48+(i%2?1:-1)*blotRadius*.28,radius:blotRadius*(.85+(i%3)*.12),born:100+i*110}));
 const started=performance.now();
 let frame;
 function draw(now){
  if(!layer.classList.contains('is-running'))return;
  const ms=(now-started)*2,{alpha}=paintProgress(ms);
  ctx.clearRect(0,0,width,height);ctx.globalAlpha=alpha;
  for(const blot of blots){
   const t=Math.max(0,Math.min(1,(ms-blot.born)/380)),scale=t*t*(3-2*t);
   if(!scale)continue;
   ctx.globalAlpha=alpha*.9;ctx.fillStyle=blot.color;ctx.beginPath();
   for(let i=0;i<=64;i++){const angle=i/64*Math.PI*2;const radius=blot.radius*scale*(1+.065*Math.sin(angle*7+blot.born)+.035*Math.cos(angle*11));const x=blot.x+Math.cos(angle)*radius,y=blot.y+Math.sin(angle)*radius;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
   ctx.closePath();ctx.fill();
   for(let i=0;i<7;i++){const angle=i/7*Math.PI*2+blot.born;const distance=blot.radius*scale*(1.15+(i%3)*.13);ctx.beginPath();ctx.arc(blot.x+Math.cos(angle)*distance,blot.y+Math.sin(angle)*distance,(2+i%3)*scale,0,Math.PI*2);ctx.fill();}
  }
  // A thin light edge keeps the multicoloured word legible over the blots.
  ctx.globalAlpha=alpha*.7;ctx.font=pen.font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=Math.max(1.5,size*.025);ctx.strokeStyle='#f5f5f3';ctx.strokeText('ЭНЕРГОМАШ',width/2,height*.48);
  ctx.globalAlpha=alpha;
  for(const p of particles){
   const {x,y,scale}=splashState(p,ms);
   if(!scale)continue;
   ctx.fillStyle=p.color;ctx.beginPath();
   ctx.ellipse(x,y,p.radius*scale,p.radius*scale*.8,p.angle,0,Math.PI*2);ctx.fill();
  }
  if(ms<2800)frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);
 return ()=>cancelAnimationFrame(frame);
}
