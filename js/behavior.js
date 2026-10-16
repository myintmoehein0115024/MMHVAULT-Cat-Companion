/* Black Gold Cat — autonomous behavior prototype. Standalone: no MMHVAULT imports or user data. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const approach=(a,b,step)=>a+(b-a)*clamp(step,0,1);
const wrap=Math.PI*2;
function yawStep(current,target,smooth){
  const d=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+d*smooth;
}
export class CatMind{
  constructor(){
    this.auto=true;
    this.mode='welcome';
    this.modeAt=0;
    this.until=2.8;
    this.nextAction=9;
    this.x=0;this.z=0;this.yaw=0;
    this.faceTarget=0;
    this.targetX=0;this.targetZ=0;
    this.time=0;this.energy=.65;
    this.gazeX=0;this.gazeY=0;
    this.gazeUntil=0;
    this.blink=.0;this.nextBlink=2.3;
    this.breath=0;this.tail=0;this.step=0;
    this.status='刚醒来，看看你';
    this.interaction='等待互动';
    this.motion=.0;this.crouch=.0;
    this.wag=0;
    this.lookAtUser=true;
    this.lastClick=0;
  }
  select(mode,duration,reason){
    this.mode=mode;
    this.modeAt=this.time;
    this.until=this.time+duration;
    this.interaction=reason||this.interaction;
    if(mode==='welcome')this.status='轻轻抬爪打招呼';
    if(mode==='inspect')this.status='正认真地看着你';
    if(mode==='walk')this.status='正在慢慢巡视';
    if(mode==='loaf')this.status='趴下来安静陪伴';
    if(mode==='stretch')this.status='伸懒腰，准备起身';
    if(mode==='idle')this.status='在你身边安静陪伴';
  }
  greet(){this.select('welcome',3,'你向猫咪打招呼了');this.lookAtUser=true;this.gazeUntil=this.time+4;}
  look(){this.select('inspect',3,'猫咪在看着你');this.lookAtUser=true;this.gazeX=0;this.gazeY=0;this.gazeUntil=this.time+4;}
  rest(){this.select('loaf',7,'猫咪开始休息');this.lookAtUser=false;}
  walk(){
    const direction=Math.random()>.5?1:-1;
    this.targetX=clamp(this.x+direction*(.65+Math.random()*.75),-1.15,1.15);
    this.targetZ=clamp(this.z+(.5-Math.random())*.55,-.35,.30);
    if(Math.abs(this.targetX-this.x)<.2)this.targetX=clamp(this.x-direction*.75,-1.15,1.15);
    this.select('walk',8,'猫咪自己走了几步');
    this.lookAtUser=false;
  }
  press(x=0,y=0){
    this.gazeX=clamp(x,-1,1);this.gazeY=clamp(y,-1,1);
    this.gazeUntil=this.time+3;
    if(this.time-this.lastClick<.4){this.select('stretch',2.8,'猫咪听见你连续呼唤');}
    else this.select('welcome',2.7,'猫咪回应了你的点击');
    this.lastClick=this.time;
  }
  autoSelect(){
    const r=Math.random();
    if(r<.28)this.walk();
    else if(r<.52)this.select('loaf',5+Math.random()*4,'猫咪想安静趴一会');
    else if(r<.70)this.select('stretch',2.8,'猫咪伸了个懒腰');
    else this.select('inspect',3,'猫咪好奇地观察你');
    this.nextAction=this.until+2+Math.random()*4;
  }
  update(time,dt){
    this.time=time;
    dt=clamp(dt,0,.05);
    if(time>=this.nextBlink){this.nextBlink=time+2.0+Math.random()*3.2;this.blinkStart=time;}
    const blinkT=(time-(this.blinkStart??-10))/.18;
    this.blink=blinkT>=0&&blinkT<1?Math.sin(blinkT*Math.PI):0;
    if(this.auto&&time>this.until){
      this.select('idle',Math.random()*4+3,this.interaction);
      if(time>this.nextAction)this.autoSelect();
    }
    if(!this.auto&&time>this.until && this.mode!=='idle')this.select('idle',5000,'已关闭自主走动');
    let walkSpeed=0;
    if(this.mode==='walk'){
      const dx=this.targetX-this.x,dz=this.targetZ-this.z;
      const distance=Math.hypot(dx,dz);
      if(distance>.07){
        const desiredYaw=Math.atan2(dx,dz);
        this.faceTarget=desiredYaw;
        const angle=Math.abs(Math.atan2(Math.sin(desiredYaw-this.yaw),Math.cos(desiredYaw-this.yaw)));
        const speed=angle<.40? .49 :.18;
        const move=Math.min(distance,speed*dt);
        this.x+=(dx/distance)*move;this.z+=(dz/distance)*move;
        walkSpeed=move/Math.max(dt,.001);
      } else {this.select('idle',5,'巡视完毕，停下来陪你');}
    }else{
      this.faceTarget= this.mode==='welcome'||this.mode==='inspect'?0:(this.mode==='loaf'?.15*Math.sin(time*.2):.16*Math.sin(time*.21));
    }
    this.yaw=yawStep(this.yaw,this.faceTarget,1-Math.exp(-dt*(this.mode==='walk'?3.4:1.8)));
    this.motion=approach(this.motion,walkSpeed,1-Math.exp(-dt*6));
    const rest=this.mode==='loaf'?1:0;
    this.crouch=approach(this.crouch,rest,1-Math.exp(-dt*2.2));
    this.step+=dt*(2.2+Math.max(this.motion,0)*11.5);
    const active=this.mode==='welcome'||this.mode==='inspect';
    this.gazeX=approach(this.gazeX,active?this.gazeX:Math.sin(time*.67)*.2,1-Math.exp(-dt*2));
    this.gazeY=approach(this.gazeY,active?this.gazeY:Math.cos(time*.37)*.13,1-Math.exp(-dt*2));
    this.breath=Math.sin(time*2.05)*.5+.5;
    this.tail=Math.sin(time*1.7)*(this.mode==='loaf'?.12:.30)+(this.mode==='welcome'?.15:0);
    this.wag=active?Math.sin(time*7.2)*.55:0;
    return this;
  }
  get label(){return ({welcome:'打招呼',walk:'自主走动',idle:'安静陪伴',loaf:'趴着休息',inspect:'好奇观察',stretch:'伸懒腰'})[this.mode]||'观察中';}
  get direction(){const d=Math.abs(this.yaw);return d<.18?'正面对着你':d<.6?'斜侧面':'转身行走';}
}
