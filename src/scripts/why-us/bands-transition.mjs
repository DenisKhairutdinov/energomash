import { asset, assetSrcset } from './asset.js';
const cleanImage=new Image();if(document.querySelector('[data-why-us]')){cleanImage.src=asset('climate-ppct26-clean-v3.webp');cleanImage.decode().catch(()=>{});}
export function startBands(layer,split,scene){
 const canvas=document.createElement('canvas');canvas.className='why-sparks-transition__canvas';layer.append(canvas);
 const width=layer.clientWidth,height=layer.clientHeight,ratio=Math.min(devicePixelRatio||1,1.5),image=cleanImage.naturalWidth?cleanImage:scene.querySelector('[data-climate-canvas] img');
 canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
 const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight),offsetX=(width-image.naturalWidth*scale)/2,offsetY=(height-image.naturalHeight*scale)/2;
 const shell=new Path2D();shell.moveTo(62,375);shell.bezierCurveTo(40,280,83,199,160,192);shell.bezierCurveTo(500,204,1100,238,1490,270);shell.bezierCurveTo(1584,287,1590,420,1570,571);shell.bezierCurveTo(1520,631,1130,571,760,532);shell.bezierCurveTo(430,492,130,468,62,375);shell.closePath();
 // Reveal the cleaned original paint only within the tanker body.
 const painted=document.createElement('canvas');painted.width=canvas.width;painted.height=canvas.height;const pen=painted.getContext('2d');pen.scale(ratio,ratio);pen.translate(offsetX,offsetY);pen.scale(scale,scale);pen.clip(shell);pen.drawImage(image,0,0);
 const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
 const fragments=Array.from({length:width<760?100:210},()=>{const x=90+Math.random()*1430,y=220+Math.random()*295;return {x:offsetX+x*scale,y:offsetY+y*scale,born:140+(x-90)/1430*690,cold:(offsetX+x*scale)>width*split/100,size:1+Math.random()*3,drift:(Math.random()-.5)*100,speed:30+Math.random()*95,phase:Math.random()*6.28};});
 const divider=scene.querySelector('.climate-lab__divider'),savedOpacity=divider.style.opacity;const started=performance.now();let frame;
 function draw(now){const ms=now-started,reveal=smooth((ms-80)/800),fade=1-smooth((ms-980)/650);ctx.clearRect(0,0,width,height);divider.style.opacity=String(1-smooth(ms/180));
 // Soft, irregular travelling edge rather than a curtain across the page.
 const wave=offsetX+(45+1550*reveal)*scale;ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(wave,0);for(let y=0;y<=height;y+=12)ctx.lineTo(wave+Math.sin(y*.035+ms*.007)*7*scale,y);ctx.lineTo(0,height);ctx.closePath();ctx.clip();ctx.globalAlpha=fade;ctx.drawImage(painted,0,0,width,height);ctx.restore();
 for(const p of fragments){const age=ms-p.born;if(age<0||age>1100)continue;const t=age/1000,x=p.x+p.drift*t+Math.sin(p.phase+t*5)*t*12,y=p.y+p.speed*t+height*.18*t*t;ctx.globalAlpha=(1-smooth(age/1100))*fade*.8;ctx.fillStyle=p.cold?'#e8f0f5':'#745138';ctx.save();ctx.translate(x,y);ctx.rotate(p.phase+t*3);ctx.beginPath();if(p.cold){ctx.moveTo(-p.size,-p.size*.5);ctx.lineTo(p.size*.6,-p.size);ctx.lineTo(p.size,p.size*.7);ctx.lineTo(-p.size*.7,p.size);ctx.closePath();}else{ctx.ellipse(0,0,p.size*.6,p.size*(1+t*2),0,0,Math.PI*2);}ctx.fill();ctx.restore();}
 ctx.globalAlpha=1;
 const light=smooth((ms-780)/500)*(1-smooth((ms-1190)/610));ctx.fillStyle='rgba(245,245,243,'+(light*.55)+')';ctx.fillRect(0,0,width,height);
 if(ms<1800)frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);return ()=>{cancelAnimationFrame(frame);canvas.remove();divider.style.opacity=savedOpacity;};
}
