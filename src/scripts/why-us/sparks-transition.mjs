export function startSparks(layer){
 const canvas=document.createElement('canvas');canvas.className='why-sparks-transition__canvas';layer.append(canvas);
 const width=layer.clientWidth,height=layer.clientHeight,ratio=Math.min(devicePixelRatio||1,1.5);
 canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
 // Pre-render hot cores, bloom and tapered trails once, then draw cached sprites.
 const sprites=Array.from({length:12},(_,index)=>{
  const sprite=document.createElement('canvas');sprite.width=64;sprite.height=128;const pen=sprite.getContext('2d');
  const rgb=index%3===0?'255,103,22':index%3===1?'255,145,34':'255,186,66';
  const halo=pen.createRadialGradient(32,25,5,32,25,23);halo.addColorStop(0,'rgba('+rgb+',.28)');halo.addColorStop(.5,'rgba('+rgb+',.09)');halo.addColorStop(1,'rgba('+rgb+',0)');pen.fillStyle=halo;pen.fillRect(0,0,64,54);
  const bend=(index%5-2)*3,tail=pen.createLinearGradient(0,25,0,120);tail.addColorStop(0,'rgba('+rgb+',.75)');tail.addColorStop(.4,'rgba('+rgb+',.35)');tail.addColorStop(1,'rgba('+rgb+',0)');pen.fillStyle=tail;
  pen.beginPath();pen.moveTo(28,26);pen.bezierCurveTo(26+bend,55,32+bend,82,32+bend*2,122);pen.bezierCurveTo(34+bend,72,39+bend,49,37,27);pen.closePath();pen.fill();
  // Irregular glowing metal fragments: crisp silhouettes, no round white dot.
  const points=[];for(let i=0;i<7;i++){const angle=i/7*Math.PI*2-.7;const wobble=.78+.24*Math.sin(i*5.3+index*2.1);points.push([32+Math.cos(angle)*(7+index%3)*wobble,25+Math.sin(angle)*(11+index%4)*wobble]);}
  const heat=pen.createLinearGradient(25,12,39,38);heat.addColorStop(0,'#fff0ac');heat.addColorStop(.25,'#ffce65');heat.addColorStop(.6,'#ff8b26');heat.addColorStop(1,'#be3b0d');pen.fillStyle=heat;pen.strokeStyle='rgba(255,97,18,.65)';pen.lineWidth=1.5;pen.beginPath();points.forEach(([x,y],i)=>i?pen.lineTo(x,y):pen.moveTo(x,y));pen.closePath();pen.fill();pen.stroke();
  pen.strokeStyle='rgba(255,228,133,.7)';pen.lineWidth=1;pen.beginPath();pen.moveTo(30,18);pen.lineTo(33,24);pen.lineTo(31,28);pen.stroke();return sprite;
 });
 const particles=Array.from({length:width<760?600:1250},(_,i)=>{
  const random=Math.random(),depth=random<.58?0:random<.91?1:2,z=depth===0?.22+Math.random()*.22:depth===1?.5+Math.random()*.3:.86+Math.random()*.35;
  const side=i%4,speed=(.35+z*.85),jitter=()=>Math.random()-.5;
  let x,y,vx,vy;
  if(side===0){x=Math.random()*width;y=height+12;vx=jitter()*width*.7;vy=-height*speed;}
  else if(side===1){x=-12;y=Math.random()*height;vx=width*speed;vy=jitter()*height*.8-height*.1;}
  else if(side===2){x=width+12;y=Math.random()*height;vx=-width*speed;vy=jitter()*height*.8-height*.1;}
  else{x=Math.random()*width;y=-12;vx=jitter()*width*.8;vy=height*speed*.85;}
  return {x,y,vx,vy,born:Math.random()*600,phase:Math.random()*Math.PI*2,frequency:3+Math.random()*4,turbulence:25+z*50,z,depth,alpha:depth===0?.3+Math.random()*.3:.65+Math.random()*.35,sprite:sprites[i%12]};
 });
 const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};const started=performance.now();let frame;
 function draw(now){const ms=now-started,fade=1-smooth((ms-1050)/350);ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='lighter';
 const haze=ctx.createLinearGradient(0,height,0,height*.55);haze.addColorStop(0,'rgba(240,112,22,'+(Math.sin(Math.min(1,ms/1400)*Math.PI)*.17)+')');haze.addColorStop(1,'rgba(240,112,22,0)');ctx.fillStyle=haze;ctx.fillRect(0,height*.55,width,height*.45);
 for(const p of particles){const age=ms-p.born;if(age<0)continue;const t=age/1000;
 const envelope=Math.min(1,t*3),wave=p.frequency*t+p.phase,amplitude=p.turbulence*envelope;
 const x=p.x+p.vx*t+(Math.sin(wave)-Math.sin(p.phase))*amplitude;
 const y=p.y+p.vy*t-height*.13*t*t+(Math.cos(wave*.73)-Math.cos(p.phase*.73))*amplitude*.7;
 if(x< -100||x>width+100||y< -100||y>height+100)continue;
 const vx=p.vx+Math.cos(wave)*p.frequency*amplitude,vy=p.vy-height*.26*t-Math.sin(wave*.73)*p.frequency*.73*amplitude*.7;
 const spriteWidth=10+p.z*16,spriteHeight=(p.depth===0?14:20)+p.z*32;
 ctx.globalAlpha=p.alpha*fade*smooth(age/55)*(.7+.3*Math.sin(t*(11+p.frequency)+p.phase)**2);
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(vx,-vy));ctx.drawImage(p.sprite,-spriteWidth/2,-spriteHeight*.195,spriteWidth,spriteHeight);ctx.restore();
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';if(ms<1400)frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);return ()=>{cancelAnimationFrame(frame);canvas.remove();};
}
