const smooth = t => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const snowDuration=2200;
function createSnow(host,storm=false){
 const canvas=document.createElement('canvas');canvas.className='why-snow__canvas';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const ctx=canvas.getContext('2d');let width=1,height=1,flakes=[],frame=0,previous=0,started=0;
 function resize(){width=host.clientWidth;height=host.clientHeight;const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=width*ratio;canvas.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);flakes=Array.from({length:storm?(width<760?140:260):(width<760?55:100)},()=>({x:Math.random()*width,y:Math.random()*height,r:.7+Math.random()*(storm?3:2.3),speed:24+Math.random()*54,phase:Math.random()*Math.PI*2,alpha:.25+Math.random()*.5}));}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function draw(now){if(!started)started=now;const elapsed=now-started,dt=Math.min((now-(previous||now))/1000,.04);previous=now;ctx.clearRect(0,0,width,height);
 const envelope=storm?smooth(elapsed/800)*(1-smooth((elapsed-1250)/950)):smooth(elapsed/900);
 if(storm){ctx.fillStyle='rgba(218,233,244,'+(envelope*.62)+')';ctx.fillRect(0,0,width,height);}
 for(const flake of flakes){const wind=storm?230+110*Math.sin(now/650):14;flake.x+=(wind+Math.sin(now/1400+flake.phase)*18)*dt;flake.y+=flake.speed*(storm?2:1)*dt;if(flake.x>width+12)flake.x=-12;if(flake.y>height+12)flake.y=-12;ctx.globalAlpha=flake.alpha*envelope;ctx.fillStyle=storm?'#f1f8ff':'#a7bed0';ctx.beginPath();ctx.ellipse(flake.x,flake.y,flake.r*(storm?2:1),flake.r,storm?-.45:0,0,Math.PI*2);ctx.fill();}
 ctx.globalAlpha=1;if(!storm||elapsed<snowDuration)frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);return ()=>{cancelAnimationFrame(frame);observer.disconnect();canvas.remove();};
}
export function startBlizzard(layer){return createSnow(layer,true);}
export function mountSnow(scene){
 const layer=document.createElement('div');layer.className='why-snow';layer.setAttribute('aria-hidden','true');scene.append(layer);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let stop,visible=true;
 function sync(){const active=!scene.hidden&&visible&&!document.hidden&&!reduced.matches;if(active&&!stop)stop=createSnow(layer);else if(!active&&stop){stop();stop=undefined;}}
 new MutationObserver(sync).observe(scene,{attributes:true,attributeFilter:['hidden']});
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(scene);
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
}
