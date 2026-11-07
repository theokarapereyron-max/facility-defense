import {ROOF_FLOOR,CORE,canStand} from './map.mjs';
import {AIRLIFT_CAPACITY,AIRLIFT_TIMES,helicopterPose,landingZoneContains} from './airlift-geometry.mjs';
import {restockFurniture} from './furniture.mjs';

export function createAirlift(){return {flight:null,serial:0,reserved:0,time:0};}
export function scheduleAirlift(sim,limit=240){
 const air=sim.airlift;if(!air||air.flight)return false;
 const free=limit-sim.units.filter(u=>u.team==='enemy'&&u.health>0).length;
 const wave=sim.pendingWaves.find(w=>w.squads.some(s=>s.route==='charlie'&&s.floor===undefined&&!s.elite&&!s.airliftID));
 if(!wave)return false;
 const squads=[];let count=0;
 for(const squad of wave.squads){
  if(squad.route!=='charlie'||squad.floor!==undefined||squad.elite||squad.airliftID)continue;
  if(count+squad.roles.length>Math.min(AIRLIFT_CAPACITY,free))break;
  squads.push(squad);count+=squad.roles.length;
 }
 if(!count)return false;
 const r=sim.floor(ROOF_FLOOR).rooms[10],pad={x:r.x+r.w/2,y:r.y+r.h/2,floor:ROOF_FLOOR},id='airlift-'+(++air.serial);
 for(const squad of squads){squad.airliftID=id;squad.transportSquadID='hostile-air-'+(++sim.squadSerial);}
 air.flight={id,waveNumber:wave.number,squads,remaining:count,total:count,delivered:0,phase:'APPROACH',phaseAt:sim.time,pad,nextExit:0};
 air.time=sim.time;air.reserved=count;
 sim.log('TRANSPORT ENNEMI EN APPROCHE',count+' hostiles à bord · un transport lourd approche de l’hélipad.','danger',ROOF_FLOOR);
 return true;
}
function phase(sim,f,name){f.phase=name;f.phaseAt=sim.time;sim.floor(ROOF_FLOOR).version++;}
function clearPad(sim,flight,dt){
 let clear=true;
 for(const u of sim.units){
  if(u.health<=0||u.transit||u.floor!==ROOF_FLOOR||!landingZoneContains(flight.pad,u.x,u.y,u.radius))continue;
  clear=false;
  if(u.role!=='player'&&!(u.stunnedUntil>sim.time)&&!(u.team==='enemy'&&sim.enemyFreezeUntil>sim.time)){
   const side=u.x<flight.pad.x?-1:1,target=flight.pad.x+side*145,dx=target-u.x,step=Math.sign(dx)*Math.min(Math.abs(dx),u.speed*dt);
   sim.move(u,step,0);u.angle=side>0?0:Math.PI;u.airEvadingUntil=sim.time+.15;
  }
 }
 if(!clear&&!flight.warned){flight.warned=true;sim.log('HÉLIPAD OCCUPÉ','Le transport reste en vol stationnaire : dégagez la zone d’atterrissage.','warning',ROOF_FLOOR);}
 return clear;
}
export function updateAirlift(sim,dt,spawn){
 const a=sim.airlift;a.time=sim.time;const f=a.flight;if(!f)return;
 const age=sim.time-f.phaseAt;
 if(f.phase==='LIFTOFF'&&!f.liftClear&&helicopterPose(f,sim.time).height>3){f.liftClear=true;sim.floor(ROOF_FLOOR).version++;}
 if(f.phase==='APPROACH'&&age>=AIRLIFT_TIMES.APPROACH)phase(sim,f,'HOLDING');
 if(f.phase==='HOLDING'&&clearPad(sim,f,dt))phase(sim,f,'LANDING');
 else if(f.phase==='LANDING'&&age>=AIRLIFT_TIMES.LANDING){phase(sim,f,'OPENING');sim.options.onSound?.('door',{...f.pad});}
 else if(f.phase==='OPENING'&&age>=AIRLIFT_TIMES.OPENING){phase(sim,f,'UNLOADING');f.nextExit=sim.time+.4;}
 else if(f.phase==='UNLOADING'){
  if(f.remaining&&sim.time>=f.nextExit){
   const squad=f.squads.find(s=>(s.delivered||0)<s.roles.length),index=squad?.delivered||0;
   const p={x:f.pad.x+(f.delivered%2?6:-6),y:f.pad.y+225,floor:ROOF_FLOOR};
   const blocked=sim.units.some(u=>u.health>0&&!u.transit&&u.floor===p.floor&&Math.hypot(u.x-p.x,u.y-p.y)<30);
   if(squad&&!blocked&&canStand(sim.floor(p.floor),p.x,p.y,11)){
    const nextID=sim.nextID;
    const n=spawn(sim,'charlie',1,undefined,{roles:[squad.roles[index]],positions:[p],squadID:squad.transportSquadID,leaderID:squad.transportLeaderID,memberOffset:index,kind:'major',waveNumber:f.waveNumber,airliftID:f.id});
    if(n){
     const u=sim.units.find(u=>u.id===nextID);if(index===0)squad.transportLeaderID=u.id;
     u.airInsertion={id:f.id,pad:{...f.pad},target:{x:p.x,y:f.pad.y+342,floor:ROOF_FLOOR},exit:{x:f.pad.x+(f.delivered%2?140:-140),y:f.pad.y+390,floor:ROOF_FLOOR},stage:'RAMP'};u.airHeight=1.06;u.state='DISEMBARK';
     squad.delivered=index+1;f.remaining--;f.delivered++;a.reserved--;
     const wave=sim.pendingWaves.find(w=>w.number===f.waveNumber);if(wave){wave.remaining--;if(squad.delivered===squad.roles.length)wave.squads.splice(wave.squads.indexOf(squad),1);if(wave.remaining===0)sim.pendingWaves.splice(sim.pendingWaves.indexOf(wave),1);}
     const record=sim.activeMajorWaves.find(w=>w.number===f.waveNumber);if(record){record.inserted++;if(!record.landed){record.landed=true;sim.wavesReceived++;}}
     if(f.delivered===1){sim.roofWaves++;sim.landing={...f.pad,time:sim.time,count:f.total,team:'enemy'};sim.log('DÉBARQUEMENT ENNEMI',f.total+' militaires quittent le transport par sa rampe arrière.','danger',ROOF_FLOOR);}
     if(wave&&!wave.resuppliedFloors.includes(ROOF_FLOOR)){restockFurniture(sim,'enemy',ROOF_FLOOR);wave.resuppliedFloors.push(ROOF_FLOOR);}
     f.nextExit=sim.time+.9;
    }
   }
  }
  if(!f.remaining&&!sim.units.some(u=>u.health>0&&u.airInsertion?.id===f.id))phase(sim,f,'CLOSING');
 }else if(f.phase==='CLOSING'&&age>=AIRLIFT_TIMES.CLOSING)phase(sim,f,'LIFTOFF');
 else if(f.phase==='LIFTOFF'&&age>=AIRLIFT_TIMES.LIFTOFF)phase(sim,f,'DEPARTING');
 else if(f.phase==='DEPARTING'&&age>=AIRLIFT_TIMES.DEPARTING){a.flight=null;a.reserved=0;sim.floor(ROOF_FLOOR).version++;}
}
export function updateAirPassenger(sim,u,dt){
 const a=u.airInsertion,target=a.stage==='RAMP'?a.target:a.exit,dx=target.x-u.x,dy=target.y-u.y,d=Math.hypot(dx,dy),step=Math.min(d,52*dt);
 if(d>1){u.angle=Math.atan2(dy,dx);sim.move(u,dx/d*step,dy/d*step);}
 if(a.stage==='RAMP')u.airHeight=Math.max(0,1.06*(1-(u.y-a.pad.y-225)/112));
 if(d<3){
  if(a.stage==='RAMP'){a.stage='CLEAR';u.airHeight=0;}
  else{u.airInsertion=null;u.airHeight=0;u.goal={...CORE};u.path=[];u.pathGoal=null;u.nextThink=0;u.state='ADVANCE';}
 }
}
export function airliftSound(sim){
 const f=sim.airlift?.flight;if(!f||sim.player.floor!==ROOF_FLOOR)return 0;
 const p=helicopterPose(f,sim.time),distance=Math.hypot((sim.player.x-p.x)/32,(sim.player.y-p.y)/32,p.height);
 return Math.max(0,1-distance/260)**2*.28;
}
