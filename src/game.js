const BUILD='20'
const W={w:900,h:560,ground:500},DT=1/120,G=900,MAX=120,SCALE=6.25
const c=document.getElementById('game'),x=c.getContext('2d')
let dpr=1,v={s:1,ox:0,oy:0,cw:0,ch:0},acc=0,last=performance.now(),drag=false,pid=null,updating=false,audio=null
let shake=0,flash=0,trail=[],dust=[],phase='READY',phaseTime=0,score=0,screen='TITLE',level=0,shotsLeft=3,stars=0,paused=false,settings={sound:true,haptics:true},progress=loadProgress()
const anchor={x:155,y:390},weak={x:665,y:445,w:24,h:110},support={x:790,y:445,w:24,h:110},beam={x:728,y:378,w:170,h:24,angle:0,y:378},monster={x:735,y:464,state:'IDLE'}
const levels=[
{name:'FIRST CRASH',weakX:665,monsterX:735,targets:2,tip:'Hit the cracked support'},
{name:'DOUBLE TROUBLE',weakX:640,monsterX:720,targets:2,tip:'Drop the beam on both'},
{name:'LEAN ON ME',weakX:690,monsterX:755,targets:2,tip:'One support holds it all'},
{name:'UNDER COVER',weakX:625,monsterX:735,targets:2,tip:'Find the exposed weak point'},
{name:'TALL ORDER',weakX:680,monsterX:748,targets:2,tip:'Low hit, big fall'},
{name:'SPLIT DECISION',weakX:650,monsterX:725,targets:2,tip:'Choose the support that chains'},
{name:'CHAIN REACTION',weakX:620,monsterX:730,targets:2,tip:'Start the crash at the bottom'},
{name:'THE BRIDGE',weakX:675,monsterX:750,targets:2,tip:'Break the load-bearing side'},
{name:'FORT CRASH',weakX:635,monsterX:720,targets:2,tip:'Thread the shot to the crack'},
{name:'BIG FINISH',weakX:660,monsterX:740,targets:2,tip:'One perfect crash can clear it'}
]
let ball
const updateBtn={x:777,y:18,w:103,h:38},restartBtn={x:780,y:514,w:100,h:30}
function loadProgress(){try{return JSON.parse(localStorage.getItem('cc-progress'))||{unlocked:1,best:{}}}catch(_){return{unlocked:1,best:{}}}}
function saveProgress(){localStorage.setItem('cc-progress',JSON.stringify(progress))}
function setupLevel(n=level){level=n;const L=levels[level];weak.x=L.weakX;monster.x=L.monsterX;shotsLeft=3;score=0;stars=0;resetShot();phase='READY';beam.angle=0;beam.y=378;monster.state='IDLE';screen='GAME'}
function resetShot(){ball={x:anchor.x,y:anchor.y,vx:0,vy:0,r:20,flying:false};drag=false;trail=[];dust=[];shake=0;flash=0}
function reset(){setupLevel(level)}
function resize(){dpr=Math.min(devicePixelRatio||1,2);v.cw=innerWidth;v.ch=innerHeight;c.width=v.cw*dpr;c.height=v.ch*dpr;c.style.width=v.cw+'px';c.style.height=v.ch+'px';v.s=Math.min(v.cw/W.w,v.ch/W.h);v.ox=(v.cw-W.w*v.s)/2;v.oy=(v.ch-W.h*v.s)/2}
function pos(e){return{x:(e.clientX-v.ox)/v.s,y:(e.clientY-v.oy)/v.s}}
function inside(p,r){return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h}
c.addEventListener('pointerdown',e=>{const p=pos(e);if(screen!=='GAME'){handleUI(p);return}if(inside(p,updateBtn)){forceUpdate();return}if(inside(p,restartBtn)){setupLevel(level);return}if(p.x>18&&p.x<68&&p.y>18&&p.y<68){paused=!paused;return}if(paused){handlePause(p);return}if(phase==='DONE'){finishLevel();return}if(ball.flying||phase!=='READY')return;if(Math.hypot(p.x-ball.x,p.y-ball.y)<=60){drag=true;pid=e.pointerId;c.setPointerCapture?.(pid);e.preventDefault()}},{passive:false})
c.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pid)return;const p=pos(e),dx=p.x-anchor.x,dy=p.y-anchor.y,d=Math.hypot(dx,dy)||1,q=Math.min(MAX,d);ball.x=anchor.x+dx/d*q;ball.y=anchor.y+dy/d*q;e.preventDefault()},{passive:false})
function release(e){if(!drag||e.pointerId!==pid)return;drag=false;pid=null;const dx=anchor.x-ball.x,dy=anchor.y-ball.y;if(Math.hypot(dx,dy)<8){ball.x=anchor.x;ball.y=anchor.y;return}ball.vx=dx*SCALE;ball.vy=dy*SCALE;ball.flying=true;shotsLeft--;tone(180,.045);e.preventDefault()}
c.addEventListener('pointerup',release,{passive:false});c.addEventListener('pointercancel',release,{passive:false});addEventListener('resize',resize)
function flightStep(s,dt=DT){s.vy+=G*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;return s}
function trajectory(){const s={x:ball.x,y:ball.y,vx:(anchor.x-ball.x)*SCALE,vy:(anchor.y-ball.y)*SCALE},a=[];for(let i=1;i<=160;i++){flightStep(s);if(i%10===0)a.push({x:s.x,y:s.y});if(a.length>=14||s.y>=W.ground)break}return a}
function tone(f,d){if(!settings.sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.05,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch(_){}}
function hitWeak(){phase='CRACK';phaseTime=0;monster.state='ALARMED';ball.flying=false;shake=7;flash=.5;tone(110,.08);if(settings.haptics)try{navigator.vibrate?.(25)}catch(_){};for(let i=0;i<14;i++)dust.push({x:weak.x,y:weak.y-20,vx:(Math.random()-.5)*90,vy:-Math.random()*90,a:1})}
function step(){shake=Math.max(0,shake-DT*25);flash=Math.max(0,flash-DT*3);for(const d of dust){d.x+=d.vx*DT;d.y+=d.vy*DT;d.vy+=250*DT;d.a-=DT*1.5}dust=dust.filter(d=>d.a>0)
 if(ball.flying){trail.push({x:ball.x,y:ball.y,a:1});if(trail.length>18)trail.shift();for(const t of trail)t.a*=.93;flightStep(ball)
 const hx=Math.max(weak.x-weak.w/2,Math.min(ball.x,weak.x+weak.w/2)),hy=Math.max(weak.y-weak.h/2,Math.min(ball.y,weak.y+weak.h/2));if((ball.x-hx)**2+(ball.y-hy)**2<=ball.r**2){hitWeak();return}
 if(ball.y+ball.r>=W.ground){ball.y=W.ground-ball.r;ball.flying=false;phase='MISS';phaseTime=0}if(ball.x>W.w+60){ball.flying=false;phase='MISS';phaseTime=0}}
 if(phase==='CRACK'||phase==='COLLAPSE'||phase==='MISS'){phaseTime+=DT}
 if(phase==='CRACK'&&phaseTime>.24){phase='COLLAPSE';phaseTime=0;tone(70,.18)}
 if(phase==='COLLAPSE'){beam.angle=Math.min(.48,beam.angle+DT*1.65);beam.y=Math.min(428,beam.y+DT*88);if(phaseTime>.42&&monster.state!=='DEFEATED'){monster.state='DEFEATED';score=1000;shake=12;flash=1;tone(55,.22);if(settings.haptics)try{navigator.vibrate?.([25,30,55])}catch(_){}}if(phaseTime>.9){phase='DONE';stars=shotsLeft===2?3:shotsLeft===1?2:1;score+=shotsLeft*500;setTimeout(finishLevel,500)}}
 if(phase==='MISS'&&phaseTime>.65){if(shotsLeft<=0){phase='LOSE';screen='RESULTS'}else{resetShot();phase='READY'}}
}
function rr(a,b,w,h,r,f){x.beginPath();x.roundRect(a,b,w,h,r);x.fillStyle=f;x.fill()}
function critter(){x.save();x.translate(ball.x,ball.y);let sx=1,sy=1;if(drag){const p=Math.min(1,Math.hypot(anchor.x-ball.x,anchor.y-ball.y)/MAX);sx=1+.18*p;sy=1-.12*p}else if(ball.flying){sx=1.13;sy=.9}x.scale(sx,sy);x.fillStyle='#ef5b45';x.beginPath();x.arc(0,0,20,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(-7,-6,6,0,Math.PI*2);x.arc(7,-6,6,0,Math.PI*2);x.fill();x.fillStyle='#17202b';x.beginPath();x.arc(-6,-5,2.5,0,Math.PI*2);x.arc(8,-5,2.5,0,Math.PI*2);x.fill();x.strokeStyle='#7c241d';x.lineWidth=2.5;x.beginPath();if(ball.flying)x.arc(0,6,5,0,Math.PI*2);else{x.moveTo(-5,7);x.lineTo(5,7)}x.stroke();x.restore()}
function monsterDraw(){x.save();x.translate(monster.x,monster.y);if(monster.state==='DEFEATED'){x.rotate(-.7);x.scale(1.15,.7)}x.fillStyle='#8256cf';x.beginPath();x.ellipse(0,0,25,24,0,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(-8,-6,6,0,Math.PI*2);x.arc(8,-6,6,0,Math.PI*2);x.fill();x.fillStyle='#222';x.beginPath();x.arc(-7,-5,2.5,0,Math.PI*2);x.arc(9,-5,2.5,0,Math.PI*2);x.fill();x.strokeStyle='#432b70';x.lineWidth=3;x.beginPath();if(monster.state==='ALARMED')x.arc(0,7,6,0,Math.PI*2);else if(monster.state==='DEFEATED'){x.moveTo(-8,7);x.lineTo(8,7)}else x.arc(0,4,9,0,Math.PI);x.stroke();x.restore()}
function block(b,weakOne=false){x.fillStyle=weakOne?'#d69449':'#b97836';x.strokeStyle='#75451f';x.lineWidth=3;x.fillRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);x.strokeRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);if(weakOne&&phase==='READY'){x.strokeStyle='#5b3217';x.beginPath();x.moveTo(b.x-4,b.y-26);x.lineTo(b.x+5,b.y-12);x.lineTo(b.x-5,b.y+3);x.lineTo(b.x+6,b.y+21);x.stroke()}}
function finishLevel(){if(phase!=='DONE')return;const key=String(level);progress.best[key]=Math.max(progress.best[key]||0,stars);progress.unlocked=Math.max(progress.unlocked,Math.min(levels.length,level+2));saveProgress();screen='RESULTS'}
function button(cx,cy,w,h,label,hot='#f6b73c'){rr(cx-w/2,cy-h/2,w,h,14,hot);x.fillStyle='#17202b';x.font='900 16px system-ui';x.textAlign='center';x.fillText(label,cx,cy)}
function handleUI(p){
 if(screen==='TITLE'){screen='MENU';return}
 if(screen==='MENU'){if(p.y>245&&p.y<305)setupLevel(Math.min(progress.unlocked-1,levels.length-1));else if(p.y>315&&p.y<365)screen='LEVELS';else if(p.y>375&&p.y<425)screen='HOW';else if(p.y>435&&p.y<485)screen='SETTINGS';return}
 if(screen==='LEVELS'){for(let i=0;i<10;i++){const cx=255+(i%5)*100,cy=225+Math.floor(i/5)*105;if(Math.hypot(p.x-cx,p.y-cy)<38&&i<progress.unlocked){setupLevel(i);return}}if(p.y>490)screen='MENU';return}
 if(screen==='HOW'){screen='MENU';return}
 if(screen==='SETTINGS'){if(p.y>245&&p.y<305)settings.sound=!settings.sound;else if(p.y>325&&p.y<385)settings.haptics=!settings.haptics;else if(p.y>440)screen='MENU';return}
 if(screen==='RESULTS'){if(phase==='LOSE'){if(p.y<370)setupLevel(level);else screen='LEVELS'}else if(p.y<350){if(level+1<levels.length)setupLevel(level+1);else screen='LEVELS'}else if(p.y<420)setupLevel(level);else screen='LEVELS'}
}
function handlePause(p){if(p.y>190&&p.y<240)paused=false;else if(p.y>250&&p.y<300){paused=false;setupLevel(level)}else if(p.y>310&&p.y<360){paused=false;screen='HOW'}else if(p.y>370&&p.y<420){paused=false;screen='SETTINGS'}else if(p.y>430){paused=false;screen='LEVELS'}}
function shell(){
 const g=x.createLinearGradient(0,0,0,W.h);g.addColorStop(0,'#72c9ff');g.addColorStop(1,'#d9f2ff');x.fillStyle=g;x.fillRect(0,0,W.w,W.h);x.fillStyle='#8ecf65';x.beginPath();x.moveTo(0,430);x.quadraticCurveTo(220,335,450,430);x.quadraticCurveTo(650,345,900,425);x.lineTo(900,560);x.lineTo(0,560);x.fill();
 x.textBaseline='middle';x.textAlign='center';
 if(screen==='TITLE'){x.fillStyle='#17202b';x.font='1000 58px system-ui';x.fillText('CRITTER',450,190);x.fillStyle='#ef5b45';x.fillText('CRASH',450,250);x.font='800 17px system-ui';x.fillStyle='#17202b';x.fillText('Tap anywhere to crash into Crash County',450,340);return}
 if(screen==='MENU'){x.fillStyle='#17202b';x.font='1000 42px system-ui';x.fillText('CRITTER CRASH',450,145);button(450,275,260,54,'PLAY');button(450,340,260,46,'LEVELS','#fff');button(450,400,260,46,'HOW TO PLAY','#fff');button(450,460,260,46,'SETTINGS','#fff');return}
 if(screen==='LEVELS'){x.fillStyle='#17202b';x.font='1000 34px system-ui';x.fillText('CRASH COUNTY',450,115);for(let i=0;i<10;i++){const cx=255+(i%5)*100,cy=225+Math.floor(i/5)*105,open=i<progress.unlocked;x.fillStyle=open?'#f6b73c':'#8a97a5';x.beginPath();x.arc(cx,cy,34,0,Math.PI*2);x.fill();x.fillStyle='#17202b';x.font='900 18px system-ui';x.fillText(open?i+1:'×',cx,cy-4);x.font='800 12px system-ui';x.fillText('★'.repeat(progress.best[String(i)]||0),cx,cy+20)}x.font='800 14px system-ui';x.fillText('Tap a level • Tap bottom to go back',450,520);return}
 if(screen==='HOW'){x.fillStyle='#17202b';x.font='1000 34px system-ui';x.fillText('HOW TO CRASH',450,120);x.font='700 18px system-ui';['1. Grab your Critter','2. Pull back and aim','3. Follow the trajectory dots','4. Hit weak supports','5. Crush every monster','Use fewer Critters for more stars'].forEach((t,i)=>x.fillText(t,450,205+i*45));x.font='800 14px system-ui';x.fillText('Tap anywhere to go back',450,510);return}
 if(screen==='SETTINGS'){x.fillStyle='#17202b';x.font='1000 34px system-ui';x.fillText('SETTINGS',450,145);button(450,275,300,54,'SOUND  '+(settings.sound?'ON':'OFF'));button(450,355,300,54,'HAPTICS  '+(settings.haptics?'ON':'OFF'));x.font='800 14px system-ui';x.fillText('Tap bottom to go back',450,485);return}
 if(screen==='RESULTS'){x.fillStyle='#17202b';x.font='1000 38px system-ui';x.fillText(phase==='LOSE'?'OUT OF CRITTERS':'LEVEL CRASHED!',450,145);if(phase!=='LOSE'){x.fillStyle='#f6b73c';x.font='1000 44px system-ui';x.fillText('★'.repeat(stars)+'☆'.repeat(3-stars),450,215);x.fillStyle='#17202b';x.font='900 20px system-ui';x.fillText('SCORE '+score,450,260);button(450,325,250,52,level===levels.length-1?'LEVEL MAP':'NEXT LEVEL')}else button(450,325,250,52,'TRY AGAIN');button(450,395,250,46,'REPLAY','#fff');button(450,455,250,46,'LEVEL MAP','#fff');return}
}
function world(){const g=x.createLinearGradient(0,0,0,W.h);g.addColorStop(0,'#72c9ff');g.addColorStop(1,'#d9f2ff');x.fillStyle=g;x.fillRect(0,0,W.w,W.h);x.fillStyle='#8ecf65';x.beginPath();x.moveTo(0,430);x.quadraticCurveTo(180,350,360,430);x.quadraticCurveTo(590,345,900,425);x.lineTo(900,500);x.lineTo(0,500);x.fill();x.fillStyle='#6fb84f';x.fillRect(0,W.ground,W.w,60);x.fillStyle='#4b8d37';x.fillRect(0,W.ground,W.w,8)
 rr(14,14,872,58,18,'#101827dd');x.textBaseline='middle';x.fillStyle='#fff';x.font='900 23px system-ui';x.textAlign='left';x.fillText('CRITTER CRASH',32,43);x.font='800 13px system-ui';x.fillStyle='#cbd5e1';x.fillText(levels[level].name,222,43);x.textAlign='right';x.fillStyle='#fff';x.fillText('CRITTERS '+shotsLeft+'   SCORE '+score,758,43);rr(updateBtn.x,updateBtn.y,updateBtn.w,updateBtn.h,12,'#f6b73c');x.fillStyle='#251600';x.font='900 12px system-ui';x.textAlign='center';x.fillText(updating?'UPDATING…':'↻ UPDATE',828,38)
 x.fillStyle='#ffffff22';x.beginPath();x.arc(43,43,23,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.font='900 20px system-ui';x.textAlign='center';x.fillText('Ⅱ',43,43);x.strokeStyle='#75451f';x.lineWidth=16;x.lineCap='round';x.beginPath();x.moveTo(anchor.x-25,W.ground);x.lineTo(anchor.x-10,anchor.y-8);x.moveTo(anchor.x+25,W.ground);x.lineTo(anchor.x+10,anchor.y-8);x.stroke()
 if(drag){x.strokeStyle='#3a2518';x.lineWidth=7;x.beginPath();x.moveTo(anchor.x-10,anchor.y-8);x.lineTo(ball.x,ball.y);x.lineTo(anchor.x+10,anchor.y-8);x.stroke();for(const p of trajectory()){x.fillStyle='#ffffffd5';x.beginPath();x.arc(p.x,p.y,4,0,Math.PI*2);x.fill()}}
 for(const t of trail){x.globalAlpha=t.a*.3;x.fillStyle='#fff';x.beginPath();x.arc(t.x,t.y,7,0,Math.PI*2);x.fill()}x.globalAlpha=1
 if(phase==='READY'||phase==='MISS')block(weak,true);else{x.save();x.translate(weak.x-8,W.ground-7);x.rotate(-1.05);block({x:0,y:0,w:18,h:64},true);x.restore();x.save();x.translate(weak.x+12,W.ground-5);x.rotate(.72);block({x:0,y:0,w:17,h:48},true);x.restore()}block(support);x.save();x.translate(beam.x,beam.y);x.rotate(beam.angle);block({x:0,y:0,w:beam.w,h:beam.h});x.restore();monsterDraw();critter()
 for(const d of dust){x.globalAlpha=d.a;x.fillStyle='#b78455';x.fillRect(d.x-3,d.y-3,6,6)}x.globalAlpha=1
 rr(14,512,872,38,12,'#101827dd');x.fillStyle='#dbe7f5';x.font='700 13px system-ui';x.textAlign='left';x.fillText(phase==='READY'?levels[level].tip+' • Pull • Aim • Crash':phase==='CRACK'?'CRACK!':phase==='COLLAPSE'?'WATCH IT FALL…':phase==='DONE'?'FIRST CRASH! +1000':'Try another angle',28,531);x.textAlign='right';x.fillStyle='#f6b73c';x.fillText('RESTART',870,531);x.fillStyle='#10182788';x.font='700 10px ui-monospace';x.textAlign='center';x.fillText('BUILD '+BUILD,450,493)
 if(phase==='DONE'){rr(330,90,240,48,18,'#101827dd');x.fillStyle='#fff';x.font='900 18px system-ui';x.fillText('CRASH! +1000',450,114)}
 if(paused){x.fillStyle='#101827dd';x.fillRect(0,0,W.w,W.h);x.fillStyle='#fff';x.font='1000 34px system-ui';x.textAlign='center';x.fillText('PAUSED',450,120);button(450,215,250,44,'RESUME');button(450,275,250,44,'RESTART','#fff');button(450,335,250,44,'HOW TO PLAY','#fff');button(450,395,250,44,'SETTINGS','#fff');button(450,455,250,44,'EXIT LEVEL','#fff')}
}
function draw(){x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,v.cw,v.ch);x.fillStyle='#101827';x.fillRect(0,0,v.cw,v.ch);x.save();x.translate(v.ox+(Math.random()-.5)*shake,v.oy+(Math.random()-.5)*shake);x.scale(v.s,v.s);if(screen==='GAME')world();else shell();if(flash){x.globalAlpha=flash*.12;x.fillStyle='#fff';x.fillRect(0,0,W.w,W.h);x.globalAlpha=1}x.restore()}
function frame(now){acc+=Math.min(.05,(now-last)/1000);last=now;while(acc>=DT){step();acc-=DT}draw();requestAnimationFrame(frame)}
async function forceUpdate(){if(updating)return;updating=true;try{if('serviceWorker'in navigator){for(const r of await navigator.serviceWorker.getRegistrations()){try{await r.update()}catch(_){}if(r.waiting)r.waiting.postMessage({type:'SKIP_WAITING'})}}for(const k of await caches.keys())await caches.delete(k);const u=new URL(location.href);u.searchParams.set('_build',BUILD+'-'+Date.now());location.replace(u.href)}catch(_){location.reload()}}
async function sw(){if(!('serviceWorker'in navigator))return;try{const r=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await r.update()}catch(_){}}
resize();resetShot();sw();requestAnimationFrame(frame)