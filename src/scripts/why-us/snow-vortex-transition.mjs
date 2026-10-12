export function startSnowVortex(layer){
 const canvas=document.createElement('canvas');canvas.className='why-sparks-transition__canvas';layer.append(canvas);
 const width=layer.clientWidth,height=layer.clientHeight,ratio=Math.min(devicePixelRatio||1,1.5);
 canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
 // Snowflake sprites use the same four-edge turbulent movement as sparks.
 const sprites=Array.from({length:12},(_,index)=>{
  const sprite=document.createElement('canvas');sprite.width=64;sprite.height=128;const pen=sprite.getContext('2d');
  const tail=pen.createLinearGradient(0,25,0,90);tail.addColorStop(0,'rgba(195,217,233,.28)');tail.addColorStop(1,'rgba(195,217,233,0)');pen.strokeStyle=tail;pen.lineWidth=2;pen.beginPath();pen.moveTo(32,25);pen.quadraticCurveTo(30+(index%3-1)*4,55,32,90);pen.stroke();
  const radius=10+index%4,branches=index%3!==0;pen.lineCap='round';
  function flake(color,width){pen.strokeStyle=color;pen.lineWidth=width;for(let arm=0;arm<6;arm++){const angle=arm*Math.PI/3+index*.17,c=Math.cos(angle),s=Math.sin(angle);pen.beginPath();pen.moveTo(32,25);pen.lineTo(32+c*radius,25+s*radius);pen.stroke();if(branches){for(const fraction of [.48,.73]){const bx=32+c*radius*fraction,by=25+s*radius*fraction;for(const side of [-1,1]){const a=angle+Math.PI+side*.75;pen.beginPath();pen.moveTo(bx,by);pen.lineTo(bx+Math.cos(a)*radius*.27,by+Math.sin(a)*radius*.27);pen.stroke();}}}}}
  flake('rgba(115,156,185,.65)',2.8);flake('rgba(247,252,255,.98)',1.5);return sprite;
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
 function draw(now){const ms=now-started,fade=1-smooth((ms-1050)/350);ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='source-over';
 const haze=Math.sin(Math.min(1,ms/1400)*Math.PI)*.12;ctx.fillStyle='rgba(205,222,233,'+haze+')';ctx.fillRect(0,0,width,height);
 for(const p of particles){const age=ms-p.born;if(age<0)continue;const t=age/1000;
 const envelope=Math.min(1,t*3),wave=p.frequency*t+p.phase,amplitude=p.turbulence*envelope;
 const x=p.x+p.vx*t+(Math.sin(wave)-Math.sin(p.phase))*amplitude;
 const y=p.y+p.vy*t-height*.13*t*t+(Math.cos(wave*.73)-Math.cos(p.phase*.73))*amplitude*.7;
 if(x< -100||x>width+100||y< -100||y>height+100)continue;
 const vx=p.vx+Math.cos(wave)*p.frequency*amplitude,vy=p.vy-height*.26*t-Math.sin(wave*.73)*p.frequency*.73*amplitude*.7;
 const spriteWidth=14+p.z*20,spriteHeight=spriteWidth*2;
 ctx.globalAlpha=p.alpha*fade*smooth(age/55)*(.7+.3*Math.sin(t*(11+p.frequency)+p.phase)**2);
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(vx,-vy));ctx.drawImage(p.sprite,-spriteWidth/2,-spriteHeight*.195,spriteWidth,spriteHeight);ctx.restore();
 }
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';if(ms<1400)frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);return ()=>{cancelAnimationFrame(frame);canvas.remove();};
}
