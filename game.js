(() => {
  'use strict';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const playBtn = document.getElementById('playBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const soundBtn = document.getElementById('soundBtn');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const bestLabel = document.getElementById('bestLabel');
  const attemptLabel = document.getElementById('attemptLabel');
  const deathLabel = document.getElementById('deathLabel');
  const flash = document.getElementById('flash');
  const W = 960, H = 540, groundY = 430, finishX = 5700;
  const gravity = 1800, jumpVelocity = -680, runSpeed = 340;
  const obstacles = [
    {x:650,type:'spike'}, {x:910,type:'double'}, {x:1260,type:'block'},
    {x:1530,type:'spike'}, {x:1790,type:'double'}, {x:2180,type:'block'},
    {x:2390,type:'spike'}, {x:2690,type:'double'}, {x:3070,type:'spike'},
    {x:3350,type:'block'}, {x:3620,type:'double'}, {x:4020,type:'block'},
    {x:4240,type:'spike'}, {x:4560,type:'triple'}, {x:5030,type:'double'},
    {x:5400,type:'spike'}
  ];
  let state = 'ready', lastTime = 0, accumulator = 0, gameTime = 0, deaths = 0;
  let best = Number(localStorage.getItem('neonDashBest') || 0), soundOn = false;
  let player = {x:170,y:groundY-36,vy:0,size:36,grounded:true,rotation:0};
  let particles = [], audioCtx = null, deathAt = 0;
  bestLabel.textContent = `${best}%`;

  function rand(seed){const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n)}
  function roundedRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
  function obstaclePieces(o){if(o.type==='double')return[0,40];if(o.type==='triple')return[0,38,76];return[0]}
  function objectWidth(o){return o.type==='double'?76:o.type==='triple'?114:o.type==='block'?42:38}

  function drawBackground(t){
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#111633');sky.addColorStop(.58,'#171a3b');sky.addColorStop(1,'#10142d');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // distant glow
    const glow=ctx.createRadialGradient(690,245,8,690,245,370);glow.addColorStop(0,'rgba(91,91,194,.19)');glow.addColorStop(1,'rgba(72,77,151,0)');ctx.fillStyle=glow;ctx.fillRect(200,40,760,380);
    // stars and floating pixels
    for(let i=0;i<48;i++){const x=(rand(i+8)*W - (t*8*(.2+rand(i+40))%W)+W)%W;const y=55+rand(i+80)*290;const a=.18+.4*(.5+.5*Math.sin(t*1.3+i));ctx.globalAlpha=a;ctx.fillStyle=i%4===0?'#77f1e6':'#b5baff';ctx.fillRect(x,y,i%7===0?3:2,i%7===0?3:2)}ctx.globalAlpha=1;
    // geometric skyline silhouettes
    for(let i=0;i<14;i++){const base=i*100-((t*18)%100);const bw=38+rand(i+200)*40;const bh=55+rand(i+500)*105;const x=base;ctx.fillStyle=i%3===0?'#24284c':'#1c2143';ctx.fillRect(x,groundY-bh-16,bw,bh);ctx.fillStyle='#41476e55';for(let yy=groundY-bh+8;yy<groundY-25;yy+=19)for(let xx=x+8;xx<x+bw-5;xx+=15)if(rand(xx+yy)>.48)ctx.fillRect(xx,yy,4,5)}
    // subtle perspective grid
    ctx.strokeStyle='rgba(114,132,212,.075)';ctx.lineWidth=1;for(let x=-((t*runSpeed*.28)%48);x<W;x+=48){ctx.beginPath();ctx.moveTo(x,groundY-15);ctx.lineTo(x-80, H);ctx.stroke()}for(let y=groundY+13;y<H;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    // ground
    const grd=ctx.createLinearGradient(0,groundY,0,H);grd.addColorStop(0,'#23294e');grd.addColorStop(.12,'#191e3e');grd.addColorStop(1,'#11152f');ctx.fillStyle=grd;ctx.fillRect(0,groundY,W,H-groundY);
    ctx.fillStyle='#5de8db';ctx.shadowColor='#5de8db';ctx.shadowBlur=14;ctx.fillRect(0,groundY,W,3);ctx.shadowBlur=0;
    const off=(t*runSpeed)%48;ctx.fillStyle='#68709c55';for(let x=-off;x<W;x+=48)ctx.fillRect(x,groundY+14,23,2);
    // floor markers pulse
    for(let x=-((t*runSpeed)%240);x<W;x+=240){ctx.fillStyle='#6be9dd55';ctx.fillRect(x,groundY-1,68,1)}
  }

  function drawObstacle(o,camera,t){
    const x=o.x-camera;
    if(x < -150 || x > W+130)return;
    if(o.type==='block'){
      ctx.save();ctx.shadowColor='#a27aff';ctx.shadowBlur=18;
      const g=ctx.createLinearGradient(x,groundY-48,x+42,groundY);g.addColorStop(0,'#b495ff');g.addColorStop(1,'#654cdb');
      roundedRect(x,groundY-46,42,46,5,g,'#e1d5ff');ctx.shadowBlur=0;
      ctx.strokeStyle='#e6d9ff77';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+8,groundY-37);ctx.lineTo(x+34,groundY-11);ctx.moveTo(x+34,groundY-37);ctx.lineTo(x+8,groundY-11);ctx.stroke();
      ctx.fillStyle='#d5c9ff';ctx.fillRect(x+4,groundY-48,34,3);ctx.restore();return;
    }
    for(const piece of obstaclePieces(o)){
      const sx=x+piece;ctx.save();ctx.shadowColor='#ff668f';ctx.shadowBlur=18;
      const g=ctx.createLinearGradient(sx,groundY-43,sx+38,groundY);g.addColorStop(0,'#ffb0ca');g.addColorStop(.35,'#ff6898');g.addColorStop(1,'#d33e7b');
      ctx.beginPath();ctx.moveTo(sx,groundY);ctx.lineTo(sx+19,groundY-43);ctx.lineTo(sx+38,groundY);ctx.closePath();ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#ffd2e0';ctx.lineWidth=1.5;ctx.stroke();ctx.shadowBlur=0;
      ctx.strokeStyle='#ffffff75';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(sx+19,groundY-34);ctx.lineTo(sx+8,groundY-5);ctx.stroke();ctx.restore();
    }
  }

  function drawFinish(camera,t){const x=finishX-camera;if(x< -30||x>W+60)return;ctx.save();ctx.shadowColor='#66f2df';ctx.shadowBlur=20;ctx.fillStyle='#70efdf';ctx.fillRect(x,groundY-132,5,132);ctx.shadowBlur=0;ctx.fillStyle='#e3fff8';ctx.beginPath();ctx.moveTo(x+5,groundY-132);ctx.lineTo(x+52,groundY-115);ctx.lineTo(x+5,groundY-98);ctx.closePath();ctx.fill();ctx.fillStyle='#4ccfc9';ctx.font='bold 10px monospace';ctx.fillText('FINISH',x-11,groundY-143);ctx.restore()}

  function drawPlayer(){
    const s=player.size,x=220, y=player.y;
    // motion streak
    ctx.save();ctx.globalAlpha=.42;const trail=ctx.createLinearGradient(x-34,y+19,x-2,y+19);trail.addColorStop(0,'rgba(93,243,221,0)');trail.addColorStop(1,'rgba(93,243,221,.55)');ctx.fillStyle=trail;ctx.fillRect(x-36,y+12,35,12);ctx.restore();
    ctx.save();ctx.translate(x+s/2,y+s/2);ctx.rotate(player.rotation);ctx.shadowColor='#60f2dd';ctx.shadowBlur=21;
    const cube=ctx.createLinearGradient(-18,-18,18,18);cube.addColorStop(0,'#a4fff0');cube.addColorStop(.55,'#56e3da');cube.addColorStop(1,'#22b1c6');roundedRect(-18,-18,s,s,5,cube,'#dcfff7');ctx.shadowBlur=0;
    ctx.strokeStyle='#134554';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,-9);ctx.lineTo(10,-9);ctx.lineTo(10,9);ctx.lineTo(-10,9);ctx.closePath();ctx.stroke();
    ctx.fillStyle='#123f50';ctx.fillRect(-8,-4,4,5);ctx.fillRect(4,-4,4,5);ctx.fillRect(-4,6,8,2);ctx.restore();
  }

  function drawParticles(dt){for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=250*dt;p.life-=dt;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);if(p.life<=0)particles.splice(i,1)}ctx.globalAlpha=1}
  function burst(color,count=14){for(let i=0;i<count;i++){const a=rand(Math.random()*10000)*Math.PI*2,s=70+Math.random()*240;particles.push({x:238,y:player.y+18,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.45+Math.random()*.5,max:.8,size:2+Math.random()*4,color})}}

  function draw(dt){
    ctx.clearRect(0,0,W,H);const moving=state==='playing'||state==='dead'||state==='won';const t=moving?gameTime:performance.now()/1000*.3;drawBackground(t);
    const camera=Math.max(0,player.x-220);
    for(const o of obstacles)drawObstacle(o,camera,t);drawFinish(camera,t);
    drawParticles(dt);drawPlayer();
    // starting title accent when idle
    if(state==='ready'){ctx.save();ctx.globalAlpha=.28;ctx.fillStyle='#b8c5ff';ctx.font='10px monospace';ctx.fillText('01 — KEEP MOVING',38,385);ctx.restore()}
  }

  function updateHud(){const pct=Math.min(100,Math.max(0,Math.floor((player.x-170)/(finishX-170)*100)));progressFill.style.width=`${pct}%`;progressText.textContent=`${pct}%`;if(pct>best){best=pct;bestLabel.textContent=`${best}%`;localStorage.setItem('neonDashBest',String(best))}}
  function showOverlay(mode){overlay.classList.remove('hidden');const title=document.getElementById('cardTitle'),body=document.getElementById('cardBody'),kicker=document.getElementById('cardKicker'),label=document.getElementById('playLabel'),hint=document.getElementById('cardHint'),hero=document.getElementById('heroIcon');hero.style.display='grid';
    if(mode==='ready'){kicker.textContent='NIVEL 01 · PRINCIPIANTE';title.innerHTML='¿Listo para<br><em>el ritmo?</em>';body.innerHTML='Salta al compás, esquiva los pinchos<br class="desktop-break"> y llega hasta el final.';label.textContent='JUGAR';hint.style.display='flex';hero.style.display='grid'}
    if(mode==='dead'){kicker.textContent=`INTENTO ${String(deaths).padStart(2,'0')} · ${Math.floor((player.x-170)/(finishX-170)*100)}%`;title.innerHTML='¡Casi lo<br><em>tenías!</em>';body.innerHTML='El ritmo no espera. Respira y<br class="desktop-break"> vuelve a intentarlo.';label.textContent='REINTENTAR';hint.style.display='flex';hero.style.display='grid'}
    if(mode==='won'){kicker.textContent='NIVEL COMPLETADO · 100%';title.innerHTML='¡Eres puro<br><em>ritmo!</em>';body.innerHTML='Nivel superado. ¿Te atreves<br class="desktop-break"> a hacerlo otra vez?';label.textContent='JUGAR DE NUEVO';hint.style.display='none';hero.style.display='grid'}
    if(mode==='paused'){kicker.textContent='PAUSA';title.innerHTML='Tómate un<br><em>respiro.</em>';body.innerHTML='Tu carrera está pausada.';label.textContent='CONTINUAR';hint.style.display='flex';hint.innerHTML='<span class="keycap">P</span><span class="or-label">o pulsa</span><span>CONTINUAR</span>';hero.style.display='grid'}
  }
  function startGame(){player={x:170,y:groundY-36,vy:0,size:36,grounded:true,rotation:0};gameTime=0;accumulator=0;particles=[];state='playing';overlay.classList.add('hidden');document.getElementById('gameFrame').classList.add('running');progressFill.style.width='0%';progressText.textContent='0%';attemptLabel.textContent=`INTENTO ${String(deaths+1).padStart(2,'0')}`}
  function jump(){if(state!=='playing'||!player.grounded)return;player.vy=jumpVelocity;player.grounded=false;playTone(590,.07,'triangle',.025);for(let i=0;i<5;i++)particles.push({x:218+Math.random()*22,y:groundY-2,vx:-60-Math.random()*100,vy:-30-Math.random()*100,life:.2+Math.random()*.15,max:.35,size:2+Math.random()*3,color:'#72f5e3'})}
  function playTone(freq,duration,type='sine',volume=.03){if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration)}catch(_){}}
  function die(){if(state!=='playing')return;state='dead';deaths++;deathLabel.textContent=String(deaths);attemptLabel.textContent=`INTENTO ${String(deaths+1).padStart(2,'0')}`;burst('#ff7198',22);playTone(130,.28,'sawtooth',.045);flash.classList.add('on');setTimeout(()=>flash.classList.remove('on'),110);deathAt=performance.now();setTimeout(()=>{if(state==='dead')showOverlay('dead')},450)}
  function collide(){const px=player.x+5,pr=player.x+player.size-5,top=player.y+5,bottom=player.y+player.size-2;
    for(const o of obstacles){const w=objectWidth(o),ox=o.x;if(pr<ox||px>ox+w)continue;
      if(o.type==='block'){if(pr>ox+3&&px<ox+39&&bottom>groundY-46+4&&top<groundY)return true}
      else {let hitX=false;for(const p of obstaclePieces(o)){const sx=ox+p;if(pr>sx+7&&px<sx+31)hitX=true}if(hitX&&bottom>groundY-31)return true}
    }return false
  }
  function step(dt){if(state!=='playing')return;gameTime+=dt;player.x+=runSpeed*dt;player.vy+=gravity*dt;player.y+=player.vy*dt;
    if(player.y+player.size>=groundY){player.y=groundY-player.size;player.vy=0;player.grounded=true;player.rotation=Math.round(player.rotation/(Math.PI/2))*(Math.PI/2)}else{player.rotation+=runSpeed*dt/36*(Math.PI/2)}
    if(collide()){die();return}if(player.x>=finishX){player.x=finishX;state='won';burst('#73f3e1',35);playTone(880,.3,'sine',.04);showOverlay('won')}
    updateHud();
  }

  playBtn.addEventListener('click',()=>{if(state==='paused'){state='playing';overlay.classList.add('hidden');return}startGame()});
  pauseBtn.addEventListener('click',()=>{if(state==='playing'){state='paused';showOverlay('paused')}else if(state==='paused'){state='playing';overlay.classList.add('hidden')}});
  soundBtn.addEventListener('click',()=>{soundOn=!soundOn;soundBtn.classList.toggle('sound-on',soundOn);soundBtn.querySelector('.sound-label').textContent=soundOn?'SONIDO ON':'SONIDO';soundBtn.setAttribute('aria-label',soundOn?'Desactivar sonido':'Activar sonido');if(soundOn)playTone(660,.1,'sine',.03)});
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(state==='playing')jump()});
  window.addEventListener('keydown',e=>{const key=e.code;if(['Space','ArrowUp','ArrowRight','KeyW'].includes(key)){e.preventDefault();if(state==='ready'||state==='dead'||state==='won')startGame();else if(state==='playing')jump();else if(state==='paused'){state='playing';overlay.classList.add('hidden')}}if(key==='KeyP'||key==='Escape'){if(state==='playing'){state='paused';showOverlay('paused')}else if(state==='paused'){state='playing';overlay.classList.add('hidden')}}if(key==='KeyR'&&state!=='ready')startGame()});
  function loop(now){if(!lastTime)lastTime=now;let dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;if(state==='playing'){accumulator+=dt;const fixed=1/120;while(accumulator>=fixed){step(fixed);accumulator-=fixed}}else if(state==='dead'&&now-deathAt>450){gameTime+=dt}draw(dt);requestAnimationFrame(loop)}
  updateHud();requestAnimationFrame(loop);
})();
