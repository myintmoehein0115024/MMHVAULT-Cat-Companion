/* Black Gold Cat P0.9 — autonomous behavior with frame-rate independent motion blending.
   This is an independent character prototype: no MMHVAULT imports or financial data. */
import {blendPose,newPose,clamp01} from './motion-mixer.js?v=p09';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(a,b,t)=>a+(b-a)*clamp01(t);
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const turn=(a,b,rate,dt)=>{
  const d=angleDelta(a,b),change=d*(1-Math.exp(-dt*rate));
  // Angular velocity cap avoids an abrupt snap after choosing a distant target.
  return a+clamp(change,-2.35*dt,2.35*dt);
};
export class CatMind{
  constructor(){
    this.auto=true;this.mode='welcome';this.modeAt=0;this.until=2.8;this.nextAction=9;
    this.pose=newPose('welcome');this.poseTransition='欢迎';
    this.x=0;this.z=0;this.yaw=0;this.faceTarget=0;this.targetX=0;this.targetZ=0;
    this.time=0;this.energy=.65;this.travelLimit=1.15;
    this.gazeX=0;this.gazeY=0;this.gazeUntil=0;
    this.blink=0;this.nextBlink=2.3;
    this.breath=0;this.tail=0;this.step=0;
    this.status='刚醒来，看看你';this.interaction='等待互动';
    this.motion=0;this.crouch=0;this.wag=0;this.turnRate=0;
    this.lookAtUser=true;this.lastClick=-Infinity;
    this.walkTargetDistance=0;
  }
  select(mode,duration,reason){
    this.mode=mode;this.modeAt=this.time;this.until=this.time+duration;
    this.interaction=reason||this.interaction;
    this.status=({welcome:'轻轻抬爪打招呼',inspect:'正认真地看着你',walk:'正在慢慢巡视',
      loaf:'趴下来安静陪伴',stretch:'伸懒腰，准备起身',idle:'在你身边安静陪伴'})[mode]||this.status;
  }
  greet(){this.select('welcome',3,'你向猫咪打招呼了');this.lookAtUser=true;this.gazeUntil=this.time+4;}
  look(){this.select('inspect',3,'猫咪在看着你');this.lookAtUser=true;this.gazeX=0;this.gazeY=0;this.gazeUntil=this.time+4;}
  rest(){this.select('loaf',7,'猫咪开始休息');this.lookAtUser=false;}
  walk(){
    const direction=Math.random()>.5?1:-1,maxX=this.travelLimit;
    this.targetX=clamp(this.x+direction*(.42+Math.random()*.72),-maxX,maxX);
    this.targetZ=clamp(this.z+(.5-Math.random())*.55,-.35,.30);
    if(Math.abs(this.targetX-this.x)<.2)this.targetX=clamp(this.x-direction*.55,-maxX,maxX);
    this.walkTargetDistance=Math.hypot(this.targetX-this.x,this.targetZ-this.z);
    this.select('walk',Math.max(5,3+this.walkTargetDistance/.20),'猫咪自己走了几步');this.lookAtUser=false;
  }
  press(x=0,y=0){
    this.gazeX=clamp(x,-1,1);this.gazeY=clamp(y,-1,1);this.gazeUntil=this.time+3;
    if(this.time-this.lastClick<.4)this.select('stretch',2.8,'猫咪听见你连续呼唤');
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
    this.time=time;dt=clamp(dt,0,.05);
    if(time>=this.nextBlink){this.nextBlink=time+2+Math.random()*3.2;this.blinkStart=time;}
    const blinkT=(time-(this.blinkStart??-10))/.18;
    this.blink=blinkT>=0&&blinkT<1?Math.sin(blinkT*Math.PI):0;
    // Scheduling uses a single expiry edge rather than re-selecting idle every
    // frame; user-triggered actions remain available with auto disabled.
    if(this.auto&&time>=this.until){
      if(time>=this.nextAction)this.autoSelect();
      else if(this.mode!=='idle')this.select('idle',this.nextAction-time,this.interaction);
    }
    if(!this.auto&&time>=this.until&&this.mode!=='idle')this.select('idle',5000,'已关闭自主走动');
    let desiredSpeed=0;
    const prevYaw=this.yaw;
    if(this.mode==='walk'){
      const dx=this.targetX-this.x,dz=this.targetZ-this.z,distance=Math.hypot(dx,dz);
      if(distance>.07){
        const desiredYaw=Math.atan2(dx,dz);this.faceTarget=desiredYaw;
        const error=Math.abs(angleDelta(this.yaw,desiredYaw));
        // Turn the whole body before stepping, then accelerate smoothly.
        desiredSpeed=.49*smoothMove(error)*Math.min(1,distance/.18);
        this.yaw=turn(this.yaw,this.faceTarget,4.1,dt);
        const oldSpeed=Math.max(0,this.motion);
        const displacement=Math.min(distance,(oldSpeed+desiredSpeed)*.5*dt);
        this.x+=(dx/distance)*displacement;this.z+=(dz/distance)*displacement;
      }else{
        this.select('idle',4,'巡视完毕，停下来陪你');
        this.nextAction=this.time+5;
      }
    }else{
      this.faceTarget=this.mode==='welcome'||this.mode==='inspect'?0:
        this.mode==='loaf'?.12*Math.sin(time*.2):.12*Math.sin(time*.21);
      this.yaw=turn(this.yaw,this.faceTarget,2.0,dt);
    }
    this.turnRate=approach(this.turnRate,clamp(angleDelta(prevYaw,this.yaw)/Math.max(dt,.001),-2,2),1-Math.exp(-dt*7));
    this.motion=approach(this.motion,desiredSpeed,1-Math.exp(-dt*(desiredSpeed>this.motion?3.6:5.4)));
    // Blended pose weights keep transitions between walk, loaf, stretch and
    // greeting continuous; loaf crouch follows the pose, not a boolean switch.
    this.pose=blendPose(this.pose,this.mode,dt,{inRate:this.mode==='loaf'?2.25:4.2,outRate:this.mode==='loaf'?2.8:3.5});
    this.crouch=approach(this.crouch,this.pose.loaf,1-Math.exp(-dt*4));
    const gaitSpeed=this.motion*clamp01(this.pose.walk);
    // Stance distance=.24 units at nominal .49 units/s and stance=.60 cycle.
    // Advancing by travelled distance avoids idle foot cycling / moonwalking.
    this.step+=dt*gaitSpeed*(2*Math.PI*.60/.24);
    const active=this.pose.welcome+this.pose.inspect>.20;
    if(time>this.gazeUntil){
      this.gazeX=approach(this.gazeX,Math.sin(time*.67)*.20,1-Math.exp(-dt*1.8));
      this.gazeY=approach(this.gazeY,Math.cos(time*.37)*.13,1-Math.exp(-dt*1.8));
    }
    this.breath=Math.sin(time*2.05)*.5+.5;
    this.tail=Math.sin(time*(this.pose.loaf>.65?1.05:1.7))*(.10+.24*(1-this.pose.loaf))+
      this.pose.welcome*.14;
    this.wag=active?Math.sin(time*7.2)*.55:0;
    this.poseTransition=this.mode==='walk' && Math.abs(this.turnRate)>.7?'正在自然转身':
      this.pose.loaf>.75?'放松趴卧':this.pose.walk>.65?'稳步巡视':
      this.pose.stretch>.5?'伸展身体':this.pose.welcome>.5?'举爪回应':
      this.pose.inspect>.5?'好奇观察':'自然过渡中';
    return this;
  }
  get label(){return ({welcome:'打招呼',walk:'自主走动',idle:'安静陪伴',loaf:'趴着休息',inspect:'好奇观察',stretch:'伸懒腰'})[this.mode]||'观察中';}
  get direction(){const d=Math.abs(angleDelta(0,this.yaw));return d<.18?'正面对着你':d<.6?'斜侧面':'转身行走';}
}
function smoothMove(angle){
  // 0 while sharply turning, easing into travel once facing the destination.
  return .08+.92*(1-clamp01((angle-.16)/.98))**2;
}
