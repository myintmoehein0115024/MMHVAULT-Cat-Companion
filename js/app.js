import {CatMind} from './behavior.js';
import {CatRenderer} from './renderer.js';

const $=id=>document.getElementById(id);
const canvas=$('catCanvas'), health=$('health'), error=$('error'), focusBtn=$('focusBtn');
const mind=new CatMind();
let renderer,frame,prev=0,frameCount=0,frameWindow=0,boot=performance.now(),running=true;
const limit=(v,min,max)=>Math.max(min,Math.min(max,v));
function updateStageBounds(){
  const box=canvas.getBoundingClientRect();
  // Smaller roaming area on tall phone screens keeps all four paws in the frame.
  mind.travelLimit=(box.width < 540 || box.width/Math.max(1,box.height)<.83) ? .65 : 1.15;
  mind.x=limit(mind.x,-mind.travelLimit,mind.travelLimit);
  mind.targetX=limit(mind.targetX,-mind.travelLimit,mind.travelLimit);
}
function setFocus(on){
  document.body.classList.toggle('cat-focus',on);
  focusBtn.setAttribute('aria-pressed',String(on));
  $('focusLabel').textContent=on?'退出专注':'专注观看';
  focusBtn.setAttribute('aria-label',on?'退出专注观看模式':'进入专注观看模式');
  updateStageBounds();
  renderer?.resize();
}
function fail(message){health.textContent='3D 暂不可用';health.style.color='#ffbeac';error.hidden=false;error.textContent=String(message);}
function render(ts){if(!running||document.hidden){frame=0;return;}
  const time=(ts-boot)/1000,dt=Math.min(.05,Math.max(0,(ts-prev)/1000));prev=ts;
  mind.update(time,dt);
  try{renderer.render(mind,time);}catch(e){running=false;fail('实时3D渲染错误：'+e.message);return;}
  $('stateLabel').textContent=mind.label;
  $('stateCaption').textContent=mind.status;
  $('directionLabel').textContent=mind.direction;
  $('interactionLabel').textContent=mind.interaction;
  if(++frameCount>=30){$('fps').textContent=Math.round(1000*frameCount/Math.max(1,ts-frameWindow))+' FPS';frameCount=0;frameWindow=ts;}
  frame=requestAnimationFrame(render);
}
function announce(action){if(!renderer)return;action();}
focusBtn.addEventListener('click',()=>setFocus(!document.body.classList.contains('cat-focus')));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('cat-focus'))setFocus(false);});
window.addEventListener('resize',()=>{updateStageBounds();renderer?.resize();},{passive:true});
$('greetBtn').addEventListener('click',()=>announce(()=>mind.greet()));
$('walkBtn').addEventListener('click',()=>announce(()=>mind.walk()));
$('restBtn').addEventListener('click',()=>announce(()=>mind.rest()));
$('lookBtn').addEventListener('click',()=>announce(()=>mind.look()));
$('autoToggle').addEventListener('change',e=>{mind.auto=e.target.checked;mind.interaction=mind.auto?'已启用自主行为':'已暂停自主行为';if(!mind.auto){mind.select('idle',99999,mind.interaction);}else{mind.nextAction=mind.time+4;mind.until=mind.time+1;}});
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();const x=((e.clientX-r.left)/r.width-.5)*2,y=(.5-(e.clientY-r.top)/r.height)*2;announce(()=>mind.press(x,y));});
canvas.addEventListener('pointermove',e=>{if(!renderer)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;mind.gazeX=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2));mind.gazeY=Math.max(-1,Math.min(1,(.5-(e.clientY-r.top)/r.height)*2));});
document.addEventListener('visibilitychange',()=>{
  if(!renderer||!running)return;
  if(document.hidden){cancelAnimationFrame(frame);frame=0;}
  else if(!frame){prev=performance.now();frameWindow=prev;frameCount=0;frame=requestAnimationFrame(render);}
});
window.addEventListener('pagehide',()=>{running=false;cancelAnimationFrame(frame);renderer?.dispose();},{once:true});
try{renderer=new CatRenderer(canvas);updateStageBounds();health.innerHTML='<span class="status-dot"></span> WebGL2 已就绪';frameWindow=performance.now();frame=requestAnimationFrame(render);}catch(e){fail(e.message);}
