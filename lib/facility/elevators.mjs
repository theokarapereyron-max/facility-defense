import {canUseLift} from './lift-access.mjs';
import {insideLift,liftDocked,LIFT_SEATS,LIFT_RISE} from './lift-geometry.mjs';
export const LIFT_DWELL=4;
export const LIFT_DOOR_TIME=.85;
const SPEED=2.5,ACCELERATION=1.4;

export function createElevators(connectors){
 return connectors.filter(c=>c.type==='elevator').map(c=>({...c,currentFloor:0,position:0,targetFloor:0,phase:'OPEN',doorState:'OPEN',doorOpen:1,moving:false,occupants:[],queue:[],callTeams:{},stops:[],remaining:0,offlineUntil:0,wait:LIFT_DWELL,phaseTime:0}));
}
export function callLift(sim,l,floor,team='ally'){
 if(!l||!Number.isInteger(floor)||floor<l.min||floor>l.max||!canUseLift(sim,l,floor,team))return false;
 if(liftDocked(l,floor)&&['OPEN','OPENING'].includes(l.phase))return true;
 if(!l.queue.includes(floor))l.queue.push(floor);
 l.callTeams[floor]=team;
 return true;
}
export function selectLiftFloor(sim,u,l,target){
 if(!l||!Number.isInteger(target)||target<l.min||target>l.max||!insideLift(l,u.x,u.y)||!canUseLift(sim,l,u.floor,u.team,target))return false;
 if(!u.cabin&&!liftDocked(l,u.floor))return false;
 u.cabin=l.id;
 if(!l.occupants.includes(u.id))l.occupants.push(u.id);
 if((target!==l.currentFloor||l.moving)&&!l.stops.includes(target))l.stops.push(target);
 if(u.role!=='player')u.liftPlan={...(u.liftPlan||{}),id:l.id,target,origin:u.floor,stage:'RIDE'};
 return true;
}
export function boardLift(sim,u,l,target){
 if(!canUseLift(sim,l,u.floor,u.team,target))return false;
 if(liftDocked(l,u.floor)&&l.doorState==='OPEN'&&insideLift(l,u.x,u.y)&&l.occupants.length<6){
  if(u.role==='player')sim.pendingPlayerLift=null;
  return selectLiftFloor(sim,u,l,target);
 }
 callLift(sim,l,u.floor,u.team);
 if(u.role!=='player'&&!u.liftPlan)u.liftPlan={id:l.id,target,origin:u.floor,stage:'WAIT',wait:0};
 return false;
}
export function liftMotion(distance){
 const accelerationTime=Math.min(SPEED/ACCELERATION,Math.sqrt(distance/ACCELERATION));
 const speed=ACCELERATION*accelerationTime,cruise=Math.max(0,(distance-speed*accelerationTime)/speed);
 return {distance,accelerationTime,speed,cruise,duration:2*accelerationTime+cruise};
}
export function liftDistanceAt(trip,time){
 const t=Math.max(0,Math.min(trip.duration,time)),a=trip.accelerationTime;
 if(t<a)return ACCELERATION*t*t/2;
 if(t<=a+trip.cruise)return trip.speed*a/2+trip.speed*(t-a);
 return trip.distance-ACCELERATION*(trip.duration-t)**2/2;
}
function setPhase(l,phase){
 l.phase=phase;l.phaseTime=0;l.moving=phase==='MOVING';
 l.doorState=phase==='OPEN'?'OPEN':phase==='OFFLINE'?'OFFLINE':'CLOSED';
}
function arrive(sim,l){
 l.position=l.targetFloor;l.currentFloor=l.targetFloor;l.remaining=0;
 setPhase(l,'OPENING');l.openStart=0;l.doorOpen=0;l.wait=LIFT_DWELL;
 l.queue=l.queue.filter(f=>f!==l.currentFloor);l.stops=l.stops.filter(f=>f!==l.currentFloor);
 for(const id of l.occupants){
  const u=sim.units.find(u=>u.id===id);
  if(!u)continue;
  u.floor=l.currentFloor;u.transit=null;u.path=[];u.pathGoal=null;u.target=null;
  if(u.liftPlan?.target===l.currentFloor)u.liftPlan.stage='EXIT';
  if(u.role==='player'||u.liftPlan?.stage==='EXIT'){sim.metrics.elevatorRides++;sim.metrics.floorChanges++;}
  if(u.role==='player'){sim.activeContainer=null;sim.log('ARRIVÉE ASCENSEUR','Niveau '+l.currentFloor+' · les portes s’ouvrent.','info',u.floor);}
 }
}
export function updateElevators(sim,dt){
 // Advance by bounded increments so long diagnostic ticks preserve every interlock.
 let left=dt;
 while(left>1e-8){
  const step=Math.min(left,.05);left-=step;
  for(const l of sim.elevators){
   l.occupants=l.occupants.filter(id=>sim.units.some(u=>u.id===id&&u.health>0&&u.cabin===l.id));
   if(l.moving){
    l.elapsed+=step;l.remaining=Math.max(0,l.duration-l.elapsed);
    const direction=Math.sign(l.targetFloor-l.departureFloor);
    l.position=l.departureFloor+direction*liftDistanceAt(l.trip,l.elapsed)/LIFT_RISE;
    for(const id of l.occupants){const u=sim.units.find(u=>u.id===id);if(u)u.floor=Math.max(l.min,Math.min(l.max,Math.round(l.position)));}
    if(l.remaining<=1e-8)arrive(sim,l);
    continue;
   }
   if(l.phase==='OPENING'){
    l.phaseTime+=step;
    const t=Math.min(1,l.phaseTime/LIFT_DOOR_TIME);l.doorOpen=(l.openStart||0)+(1-(l.openStart||0))*t*t*(3-2*t);
    if(t===1){setPhase(l,'OPEN');l.doorOpen=1;l.wait=LIFT_DWELL;}
    continue;
   }
   if(l.phase==='CLOSING'){
    const blocked=sim.units.some(u=>u.health>0&&u.floor===l.currentFloor&&Math.abs(u.x-l.x)<44+u.radius&&Math.abs(u.y-l.y-48)<u.radius+7);
    if(blocked){setPhase(l,'OPENING');l.openStart=l.doorOpen;continue;}
    l.phaseTime+=step;
    const t=Math.min(1,l.phaseTime/LIFT_DOOR_TIME);l.doorOpen=1-t*t*(3-2*t);
    if(t===1){
     l.departureFloor=l.currentFloor;l.trip=liftMotion(Math.abs(l.targetFloor-l.currentFloor)*LIFT_RISE);
     l.duration=l.trip.duration;l.elapsed=0;l.remaining=l.duration;l.doorOpen=0;
     for(const u of sim.units)if(u.health>0&&u.floor===l.currentFloor&&insideLift(l,u.x,u.y)){
      u.cabin=l.id;u.transit=l.id;if(!l.occupants.includes(u.id))l.occupants.push(u.id);
     }
     setPhase(l,'MOVING');
    }
    continue;
   }
   const aboard=l.occupants.map(id=>sim.units.find(u=>u.id===id)).filter(Boolean);
   const powered=canUseLift(sim,l,l.currentFloor,aboard[0]?.team||l.callTeams[l.queue[0]]||'ally');
   if(!powered){
    setPhase(l,'OFFLINE');l.doorOpen=1;continue;
   }
   if(l.phase==='OFFLINE'){setPhase(l,'OPEN');l.wait=LIFT_DWELL;}
   l.wait=Math.max(0,l.wait-step);
   if(l.wait>0)continue;
   // Nobody is forced out, and a boarding unit has time to finish entering.
   if(sim.units.some(u=>u.health>0&&u.liftPlan?.id===l.id&&['BOARD','EXIT'].includes(u.liftPlan.stage)))continue;
   const target=l.stops.find(f=>f!==l.currentFloor)??l.queue.find(f=>f!==l.currentFloor);
   if(target===undefined)continue;
   const team=aboard[0]?.team||l.callTeams[target]||'ally';
   if(!canUseLift(sim,l,l.currentFloor,team,target)){
    l.stops=l.stops.filter(f=>f!==target);l.queue=l.queue.filter(f=>f!==target);continue;
   }
   l.targetFloor=target;setPhase(l,'CLOSING');
  }
 }
}
export function navigateLift(sim,u,dt){
 const plan=u.liftPlan,l=sim.elevators.find(l=>l.id===plan.id);
 if(!l){u.liftPlan=null;u.connector=null;return;}
 let target=null;
 if(plan.stage==='WAIT'){
  plan.wait=(plan.wait||0)+dt;
  if(!canUseLift(sim,l,u.floor,u.team,plan.target)||plan.wait>35+Math.abs(l.position-u.floor)*4+l.queue.length*8){
   u.liftPlan=null;u.connector=null;u.path=[];u.pathGoal=null;u.preferredConnector='A';return;
  }
  callLift(sim,l,u.floor,u.team);
  if(!liftDocked(l,u.floor)||l.doorState!=='OPEN')return;
  const used=sim.units.filter(a=>a.health>0&&a.id!==u.id&&a.liftPlan?.id===l.id&&a.liftPlan.seat!==undefined).map(a=>a.liftPlan.seat);
  const seat=LIFT_SEATS.findIndex((_,i)=>!used.includes(i));
  if(seat<0||l.occupants.length>=6)return;
  plan.seat=seat;plan.stage='BOARD';
 }
 if(plan.stage==='BOARD'){
  if(!canUseLift(sim,l,u.floor,u.team,plan.target)){
   if(insideLift(l,u.x,u.y)){plan.target=u.floor;plan.stage='EXIT';}
   else{u.liftPlan=null;u.connector=null;u.path=[];u.pathGoal=null;return;}
  }
 }
 if(plan.stage==='BOARD'){
  if(!liftDocked(l,u.floor)||l.doorState!=='OPEN')return;
  const seat=LIFT_SEATS[plan.seat];target={x:l.x+seat[0],y:l.y+seat[1]};
  if(Math.hypot(target.x-u.x,target.y-u.y)<3){selectLiftFloor(sim,u,l,plan.target);return;}
 }
 if(plan.stage==='RIDE'){
  if(!l.moving&&l.currentFloor===plan.target&&l.doorState==='OPEN')plan.stage='EXIT';
  else return;
 }
 if(plan.stage==='EXIT'){
  if(l.doorState!=='OPEN'&&l.phase!=='OFFLINE')return;
  target={x:l.x+(LIFT_SEATS[plan.seat||0][0]),y:l.y+88};
  if(Math.hypot(target.x-u.x,target.y-u.y)<4){
   u.cabin=null;u.liftPlan=null;u.connector=null;u.path=[];u.pathGoal=null;u.connectorCooldown=.9;return;
  }
 }
 if(target){
  const dx=target.x-u.x,dy=target.y-u.y,d=Math.hypot(dx,dy),step=Math.min(d,u.speed*dt);
  if(d>0){u.angle=Math.atan2(dy,dx);sim.move(u,dx/d*step,dy/d*step);}
 }
}
