import {CatMind} from './behavior.js';
import {CatRenderer} from './renderer.js';

const $=id=>document.getElementById(id);
const canvas=$('catCanvas'), health=$('health'), error=$('error');
const mind=new CatMind();
let renderer,frame,prev=0,frameCount=0,frameWindow=0,boot=performance.now(),running=true;
function fail(message){health.textContent='3D 暂不可用';health.style.color='#ffbeac';error.hidden=false;error.textContent=String(message);}
function render(ts){if(!running)return;
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
$('greetBtn').addEventListener('click',()=>announce(()=>mind.greet()));
$('walkBtn').addEventListener('click',()=>announce(()=>mind.walk()));
$('restBtn').addEventListener('click',()=>announce(()=>mind.rest()));
$('lookBtn').addEventListener('click',()=>announce(()=>mind.look()));
$('autoToggle').addEventListener('change',e=>{mind.auto=e.target.checked;mind.interaction=mind.auto?'已启用自主行为':'已暂停自主行为';if(!mind.auto){mind.select('idle',99999,mind.interaction);}else{mind.nextAction=mind.time+4;mind.until=mind.time+1;}});
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();const x=((e.clientX-r.left)/r.width-.5)*2,y=(.5-(e.clientY-r.top)/r.height)*2;announce(()=>mind.press(x,y));});
canvas.addEventListener('pointermove',e=>{if(!renderer)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;mind.gazeX=Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)*2));mind.gazeY=Math.max(-1,Math.min(1,(.5-(e.clientY-r.top)/r.height)*2));});
window.addEventListener('pagehide',()=>{running=false;cancelAnimationFrame(frame);renderer?.dispose();},{once:true});
try{renderer=new CatRenderer(canvas);health.innerHTML='<span class="status-dot"></span> WebGL2 已就绪';frameWindow=performance.now();frame=requestAnimationFrame(render);}catch(e){fail(e.message);}
