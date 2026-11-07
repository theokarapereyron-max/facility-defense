import {dist,canStand} from './map.mjs';
import {lineOfSight} from './navigation.mjs';

export function clearFireLane(sim,u,target){
 const dx=target.x-u.x,dy=target.y-u.y,length=Math.hypot(dx,dy);if(!length)return true;
 for(const ally of sim.spatial.nearby(u.floor,u.x,u.y,length)){
  if(ally.id===u.id||ally.team!==u.team||ally.health<=0||ally.transit)continue;
  const ax=ally.x-u.x,ay=ally.y-u.y,along=(ax*dx+ay*dy)/length,side=Math.abs(ax*dy-ay*dx)/length;
  if(along>20&&along<length-15&&side<ally.radius+5)return false;
 }return true;
}
export function combatPosition(sim,u,target,anchor=null){
 if(u.currentOrder==='HOLD_AT_ALL_COSTS')return null;
 if(u.tacticalTarget===target.id&&u.tacticalUntil>sim.time&&u.tacticalGoal&&u.tacticalGoal.floor===u.floor&&canStand(sim.floor(u.floor),u.tacticalGoal.x,u.tacticalGoal.y,u.radius)&&!hazardous(sim,u.tacticalGoal,u.floor)&&(!anchor||anchor.floor===u.floor&&dist(u.tacticalGoal,anchor)<=180))return u.tacticalGoal;
 const f=sim.floor(u.floor),reloading=u.reload>0,blocked=!clearFireLane(sim,u,target);
 const distance=dist(u,target),tooClose=(u.role==='marksman'&&distance<260)||(u.role==='medic'&&distance<170),pressured=u.health<u.maxHealth*.55&&sim.spatial.nearby(u.floor,u.x,u.y,450).filter(a=>a.team!==u.team&&a.health>0&&lineOfSight(f,u,a)).length>=2;
 if(!reloading&&!blocked&&!tooClose&&!pressured)return null;
 const nearby=sim.spatial.nearby(u.floor,u.x,u.y,260),choices=[];
 for(const cover of f.covers){if(!(reloading||pressured)||cover.occupant!==null&&cover.occupant!==u.id||dist(u,cover)>210||anchor&&dist(cover,anchor)>180||!canStand(f,cover.x,cover.y,u.radius)||lineOfSight(f,target,cover)||hazardous(sim,cover,u.floor))continue;choices.push({...cover,floor:u.floor,score:300-dist(u,cover)});}
 const angle=Math.atan2(target.y-u.y,target.x-u.x);
 for(const side of [-1,1])for(const step of [64,96,128]){
  const p={x:u.x+Math.cos(angle+Math.PI/2)*step*side-(tooClose?Math.cos(angle)*64:0),y:u.y+Math.sin(angle+Math.PI/2)*step*side-(tooClose?Math.sin(angle)*64:0),floor:u.floor};
  if(!canStand(f,p.x,p.y,u.radius)||anchor&&dist(p,anchor)>180||nearby.some(a=>a.id!==u.id&&dist(a,p)<36)||!lineOfSight(f,u,p)||hazardous(sim,p,u.floor))continue;
  const hidden=!lineOfSight(f,target,p);if(reloading?!hidden:!lineOfSight(f,p,target)||!clearFireLane(sim,{...u,...p},target))continue;
  choices.push({...p,score:100-step+(side===(u.id%2?1:-1)?8:0)+(tooClose?dist(p,target)*.2:0)});
 }
 choices.sort((a,b)=>b.score-a.score);const best=choices[0];u.tacticalTarget=target.id;u.tacticalGoal=best||null;u.tacticalUntil=sim.time+1.4;return best||null;
}
export const hazardous=(sim,p,floor)=>sim.fields.some(f=>f.type==='fire'&&f.floor===floor&&f.until>sim.time&&dist(f,p)<f.radius+20);
export function retreatPosition(sim,u,target){
 const f=sim.floor(u.floor),a=Math.atan2(u.y-target.y,u.x-target.x),points=[];
 for(const offset of [0,.45,-.45,.85,-.85])for(const step of [96,160,220])points.push({x:u.x+Math.cos(a+offset)*step,y:u.y+Math.sin(a+offset)*step,floor:u.floor});
 for(const cover of f.covers)if(dist(u,cover)<280&&(cover.occupant===null||cover.occupant===u.id))points.push({...cover,floor:u.floor});
 return points.filter(p=>canStand(f,p.x,p.y,u.radius)&&dist(p,target)>dist(u,target)+40&&lineOfSight(f,u,p)&&!hazardous(sim,p,u.floor)).sort((a,b)=>(lineOfSight(f,target,a)?350:0)+dist(u,a)-dist(a,target)*.2-((lineOfSight(f,target,b)?350:0)+dist(u,b)-dist(b,target)*.2))[0]||null;
}
export function medicalPosition(sim,u,anchor=null){
 if(u.role!=='medic'||u.currentOrder==='HOLD_AT_ALL_COSTS')return null;
 const f=sim.floor(u.floor),patients=sim.spatial.nearby(u.floor,u.x,u.y,400).filter(a=>a.id!==u.id&&a.team===u.team&&a.health>0&&!a.transit&&a.health<a.maxHealth*.8&&(!anchor||dist(a,anchor)<180)).sort((a,b)=>a.health/a.maxHealth-b.health/b.maxHealth||dist(u,a)-dist(u,b));
 for(const patient of patients){
  if(dist(u,patient)<105&&lineOfSight(f,u,patient))return {...u,patient:patient.id};
  const enemy=sim.spatial.nearby(u.floor,patient.x,patient.y,450).filter(e=>e.team!==u.team&&e.health>0&&lineOfSight(f,patient,e)).sort((a,b)=>dist(patient,a)-dist(patient,b))[0],angle=enemy?Math.atan2(patient.y-enemy.y,patient.x-enemy.x):Math.atan2(u.y-patient.y,u.x-patient.x);
  const choices=[0,.7,-.7,1.4,-1.4].map(offset=>({x:patient.x+Math.cos(angle+offset)*80,y:patient.y+Math.sin(angle+offset)*80,floor:u.floor,patient:patient.id})).filter(p=>canStand(f,p.x,p.y,u.radius)&&lineOfSight(f,p,patient)&&!hazardous(sim,p,u.floor)&&(!anchor||dist(p,anchor)<180));
  choices.sort((a,b)=>dist(u,a)-dist(u,b));if(choices[0])return choices[0];
 }return null;
}
