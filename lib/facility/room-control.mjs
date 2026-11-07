import {syncDoorAuthority} from './doors.mjs';
import {canStand,dist,nearestWalkable} from './map.mjs';
import {insideRoom,roomAt,roomStatus,doorControlRoom} from './room-state.mjs';
import {lineOfSight} from './navigation.mjs';
import {ENEMY_LIMIT} from './director.mjs';
import {airliftReserved} from './airlift-geometry.mjs';

export function updateRoomControl(sim,dt=.25){
 for(const f of sim.floors)for(const r of f.rooms){
  const z=f.zones[r.index],status=roomStatus(sim,f,r),old=r.owner;
  if(r.strategic){
   const faction=status.contested?null:status.enemies?'enemy':status.allies?'ally':null;
   if(faction&&faction!==r.owner){if(r.capturingTeam!==faction){r.capturingTeam=faction;r.captureProgress=0;}const n=faction==='ally'?status.allies:status.enemies;r.captureTime=n>=3?10:n===2?14:20;r.captureProgress=Math.min(1,(r.captureProgress||0)+dt/r.captureTime);if(r.captureProgress>=1-1e-8){status.owner=faction;r.captureProgress=0;r.capturingTeam=null;}}
   else if(!status.contested){r.captureProgress=Math.max(0,(r.captureProgress||0)-dt/10);if(!r.captureProgress)r.capturingTeam=null;}
  }
  Object.assign(r,status);r.roomOwner=status.contested?'CONTESTED':r.owner.toUpperCase();Object.assign(z,status,{pressure:status.enemies});
  if(old===r.owner)continue;
  r.captureSerial=(r.captureSerial||0)+1;r.capturedAt=sim.time;f.version++;
  for(const d of f.doors){
   if(doorControlRoom(f,d)===r)syncDoorAuthority(sim,f,d);
  }
  if(r.owner==='enemy'){
   r.pendingGarrison=r.captureSerial;
   sim.metrics.roomsCaptured=(sim.metrics.roomsCaptured||0)+1;
   sim.log('SALLE CAPTURÉE',r.name+' · 3 gardes et 1 officier ennemis en renfort.','danger',f.id);
  }else{
   r.pendingGarrison=null;sim.zonesDefended++;
   sim.log('SALLE REPRISE',r.name+' · accès rendus aux alliés.','success',f.id);
  }
 }
 deployGarrisons(sim);
}
export function deployGarrisons(sim){
 let available=ENEMY_LIMIT-sim.units.filter(u=>u.team==='enemy'&&u.health>0).length-airliftReserved(sim);
 for(const f of sim.floors)for(const r of f.rooms){
  if(!r.pendingGarrison||r.owner!=='enemy'||available<4)continue;
  const units=sim.units.filter(u=>u.health>0&&!u.transit&&u.floor===f.id),spots=[];
  // Scan actual walkable room cells. Insert together, without overlapping actors or furniture.
  const candidates=[];
  for(let y=r.y+64;y<r.y+r.h-48;y+=64)for(let x=r.x+64;x<r.x+r.w-48;x+=64){
   const p={x:x+16,y:y+16,floor:f.id};
   if(canStand(f,p.x,p.y,12)&&units.every(u=>dist(u,p)>=(u.team==='ally'?100:30)))candidates.push(p);
  }
  candidates.sort((a,b)=>Math.abs(dist(a,{x:r.x+r.w/2,y:r.y+r.h/2})-140)-Math.abs(dist(b,{x:r.x+r.w/2,y:r.y+r.h/2})-140));
  for(const p of candidates){if(spots.every(q=>dist(p,q)>=42))spots.push(p);if(spots.length===4)break;}
  if(spots.length!==4)continue;
  const squad='garnison-'+f.id+'-'+r.index+'-'+r.pendingGarrison;let officer;
  spots.forEach((p,i)=>{
   const u=sim.makeUnit('enemy',i===0?'officer':'rifleman',p);
   Object.assign(u,{garrison:{floor:f.id,roomIndex:r.index},squadID:squad,formationIndex:i,homePosition:{...p},homeZone:r.name,currentOrder:'DEFEND_ZONE',orderPriority:5,orderUntil:sim.time+20,orderGoal:{...p},commandGoal:{...p},goal:{...p},state:'DEFEND'});
   if(i===0)officer=u;else u.officerID=officer.id;
  });
  r.pendingGarrison=null;available-=4;sim.metrics.captureGuards=(sim.metrics.captureGuards||0)+4;
 }
}
export function usableSupply(sim,u,s){
 const f=sim.floor(u.floor);
 return s.floor===u.floor&&dist(u,s)<110&&insideRoom(f.rooms[s.roomIndex],u)&&roomStatus(sim,f,f.rooms[s.roomIndex]).owner===u.team&&!roomStatus(sim,f,f.rooms[s.roomIndex]).contested&&lineOfSight(f,u,s);
}
export function healAtSupplies(sim,dt){
 for(const u of sim.units){
  if(u.health<=0||u.transit||u.health>=u.maxHealth||u.stunnedUntil>sim.time||u.team==='enemy'&&sim.enemyFreezeUntil>sim.time)continue;
  // Taking hits interrupts treatment, instead of making a capture point immortal.
  if(sim.time-(u.hurtAt??-100)<3)continue;
  if(sim.floor(u.floor).supplies.some(s=>usableSupply(sim,u,s))){u.health=Math.min(u.maxHealth,u.health+18*dt);u.treatedAt=sim.time;}
 }
}
export function resupplyGoal(sim,u,explicit){
 const localDefence=explicit&&['DEFEND_ZONE','REINFORCE_ZONE'].includes(u.currentOrder)&&u.orderGoal?.floor===u.floor;
 if(explicit&&!localDefence||u.autonomousCore||u.currentOrder==='HOLD_AT_ALL_COSTS'){u.resupplyID=null;return null;}
 if(u.health>=u.maxHealth*.95){u.resupplyID=null;return null;}
 if(!u.resupplyID&&u.health>=u.maxHealth*.45)return null;
 const f=sim.floor(u.floor),supplies=f.supplies.filter(s=>{
  const state=roomStatus(sim,f,f.rooms[s.roomIndex]);return state.owner===u.team&&!state.contested&&dist(s,u)<1600&&(!explicit||insideRoom(f.rooms[s.roomIndex],u.orderGoal)&&insideRoom(f.rooms[s.roomIndex],u));
 }).sort((a,b)=>dist(u,a)-dist(u,b));
 const s=supplies.find(s=>s.id===u.resupplyID)||supplies[0];u.resupplyID=s?.id||null;
 return s?{...s}:null;
}
export function autonomousRoomGoal(sim,u){
 const f=sim.floor(u.floor);
 if(u.garrison){
  const gf=sim.floor(u.garrison.floor),r=gf.rooms[u.garrison.roomIndex];
  if(roomStatus(sim,gf,r).owner===u.team)return {...u.homePosition};
  u.garrison=null;
 }
 // A nearby lost room gets a bounded detachment; other units keep their posts/routes.
 if(u.team==='ally'){
  const targets=f.rooms.filter(r=>r.owner==='enemy'&&dist(u,f.zones[r.index])<900).map(r=>({r,z:f.zones[r.index]})).sort((a,b)=>b.z.strategicValue-a.z.strategicValue||dist(u,a.z)-dist(u,b.z));
  for(const {r,z} of targets){
   const committed=sim.units.filter(a=>a.team===u.team&&a.id!==u.id&&a.health>0&&a.roomMission?.floor===f.id&&a.roomMission.index===r.index).length;
   if(committed>=Math.min(8,(r.enemies||1)+2))continue;
   u.roomMission={floor:f.id,index:r.index};return nearestWalkable(f,z.x,z.y);
  }
 }
 u.roomMission=null;return null;
}
export function roomSnapshot(sim){
 const f=sim.floor(sim.player.floor),r=roomAt(f,sim.player);
 return {roomControl:r?{name:r.name,...roomStatus(sim,f,r),progress:r.captureProgress,capturingTeam:r.capturingTeam}:null,captureGarrisonsPending:sim.floors.reduce((n,f)=>n+f.rooms.filter(r=>r.pendingGarrison).length,0)};
}
