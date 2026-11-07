import {dist,cellAt} from './map.mjs';
import {doorCenter,canOpenDoor,roomStatus,insideRoom,doorControlRoom} from './room-state.mjs';
export const DOOR_REACH=105;
// Each door follows the camp controlling its own room.
export function syncDoorAuthority(sim,f,d){
 const r=doorControlRoom(f,d),owner=r&&roomStatus(sim,f,r).owner||'neutral',previous=d.controllerFaction??d.lockTeam;
 d.controllerFaction=owner;
 if(previous===owner&&d.lockTeam===owner)return false;
 d.lockTeam=owner;d.lockedBy=null;d.manualUntil=0;d.openUntil=0;d.forcedOpen=false;d.hold=0;
 if(d.lockMode==='all')d.lockMode='hostile';if(owner==='neutral')d.lockMode='none';
 f.version++;sim.metrics.doorTransfers=(sim.metrics.doorTransfers||0)+1;return true;
}
function headsThroughDoor(u,d){
 const node=u.path?.[0];if(!u.goal||!node)return false;
 let low=0,high=1;
 for(const [start,delta,min,max] of [[u.x,node.x-u.x,d.x-12,d.x+d.w+12],[u.y,node.y-u.y,d.y-12,d.y+d.h+12]]){
  if(Math.abs(delta)<.001){if(start<min||start>max)return false;continue;}
  const a=(min-start)/delta,b=(max-start)/delta;low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b));if(low>high)return false;
 }
 return high>=0&&low<=1;
}
// Ignore the target door itself, but never operate a lock through an intervening wall.
export function reachDoor(f,u,d){
 const p=doorCenter(d),length=dist(u,p);if(length>DOOR_REACH)return false;
 for(let t=8;t<length;t+=8){const x=u.x+(p.x-u.x)*t/length,y=u.y+(p.y-u.y)*t/length;
  if(x>=d.x&&x<=d.x+d.w&&y>=d.y&&y<=d.y+d.h)continue;
  const cell=cellAt(f,x,y);if(cell===1||cell===3||cell===2&&f.doorByCell.get(Math.floor(y/32)*f.cols+Math.floor(x/32))?.open<.72)return false;
 }return true;
}
const overlapsDoor=(u,d)=>u.x+u.radius>d.x&&u.x-u.radius<d.x+d.w&&u.y+u.radius>d.y&&u.y-u.radius<d.y+d.h;

export function restoreDoor(sim,f,d) {
 syncDoorAuthority(sim,f,d);
 const occupied=sim.units.some(u=>u.floor===f.id&&u.health>0&&!u.transit&&overlapsDoor(u,d));
 d.health=d.maxHealth||100;d.state='CLOSED';
 const accessible=canOpenDoor(d,sim.player.team);
 d.open=occupied||accessible?1:0;d.hold=accessible?2:0;
 d.state=d.open?'OPEN':d.lockMode==='none'?'CLOSED':'LOCKED';
 f.version++;
}

export function doorPermission(sim,u,d){
 const f=sim.floor(u.floor),r=d&&f.rooms[d.roomIndex];
 if(!d||!r||!f.doors.includes(d)||u.health<=0||u.transit||u.stunnedUntil>sim.time||sim.status!=='running')return {ok:false,reason:'Commande indisponible.'};
 if(d.state==='DESTROYED')return {ok:false,reason:'Porte détruite : réparez-la avec un kit.'};
 if(!reachDoor(f,u,d))return {ok:false,reason:'Approchez-vous de cette porte.'};
 if(roomStatus(sim,f,r).owner!==u.team)return {ok:false,reason:'Votre équipe doit contrôler cette salle.'};
 return {ok:true,reason:''};
}
export function setDoorLock(sim,u,id,mode){
 const f=sim.floor(u.floor),d=f.doors.find(d=>d.id===id),permission=doorPermission(sim,u,d);
 if(!permission.ok)return permission;
 if(!['none','hostile','all'].includes(mode))return {ok:false,reason:'Mode inconnu.'};
 d.lockMode=mode;d.lockTeam=u.team;d.lockedBy=u.id;d.manualUntil=u.role==='player'?sim.time+30:0;d.hold=0;f.version++;
 d.controllerFaction=u.team;d.openUntil=0;d.forcedOpen=false;
 sim.options.onSound?.('door',u);
 return {ok:true,reason:mode==='none'?'Porte déverrouillée.':mode==='all'?'Porte verrouillée pour tout le monde.':'Porte réservée à votre équipe.'};
}
export function setDoorAction(sim,u,id,action){
 if(action==='close')return setDoorLock(sim,u,id,'all');
 if(action==='auto')return setDoorLock(sim,u,id,'hostile');
 if(action!=='open')return {ok:false,reason:'Commande inconnue.'};
 const f=sim.floor(u.floor),d=f.doors.find(d=>d.id===id),permission=doorPermission(sim,u,d);if(!permission.ok)return permission;
 d.controllerFaction=u.team;d.lockTeam=u.team;d.forcedOpen=true;d.openUntil=sim.time+10;d.manualUntil=sim.time+10;d.hold=0;f.version++;
 sim.options.onSound?.('door',u);return {ok:true,reason:'Ouverture pour les deux camps pendant 10 s, puis retour au verrouillage précédent.'};
}
export function doorPanel(sim,roomIndex){
 const f=sim.floor(sim.player.floor),r=f.rooms[roomIndex];if(!r)return null;
 const state=roomStatus(sim,f,r);
 return {name:r.name,...state,doors:f.doors.filter(d=>d.roomIndex===roomIndex).map((d,i)=>{const authority=doorControlRoom(f,d);return {...doorPermission(sim,sim.player,d),id:d.id,label:'Porte '+(i+1),type:d.reinforced?'armored':d.type,mode:d.lockMode,team:d.lockTeam,controller:authority?.name,mechanical:!!d.mechanical,state:d.state,open:d.open,destroyed:d.state==='DESTROYED',health:Math.ceil(d.health),maxHealth:d.maxHealth||100,opening:Math.max(0,Math.ceil((d.openUntil||0)-sim.time)),manual:Math.max(0,Math.ceil((d.manualUntil||0)-sim.time))};})};
}
export function nearbyDoorContext(sim){
 const p=sim.player,f=sim.floor(p.floor),d=f.doors.filter(d=>reachDoor(f,p,d)).sort((a,b)=>dist(p,doorCenter(a))-dist(p,doorCenter(b)))[0];
 return d?{type:'door',id:d.id,roomIndex:d.roomIndex,floor:f.id,label:'PORTES · '+f.rooms[d.roomIndex].name}:null;
}
export function updateDoors(sim,dt){
 for(const f of sim.floors)for(const d of f.doors){
  syncDoorAuthority(sim,f,d);
  if(d.forcedOpen&&sim.time>=(d.openUntil||0)){d.forcedOpen=false;d.hold=0;f.version++;}
  if(d.state==='DESTROYED'){d.open=1;continue;}
  const center=doorCenter(d),near=sim.spatial.nearby(f.id,center.x,center.y,DOOR_REACH).filter(u=>u.health>0&&!u.transit),r=f.rooms[d.roomIndex];
  const owner=d.controllerFaction;
  for(const u of near){
   if(u.role==='player'||u.stunnedUntil>sim.time||u.team==='enemy'&&sim.enemyFreezeUntil>sim.time||!reachDoor(f,u,d))continue;
   const wantsPass=headsThroughDoor(u,d);
   if(d.lockMode==='all'&&u.team===owner&&wantsPass&&sim.time>=(d.manualUntil||0))setDoorLock(sim,u,d.id,'hostile');
   // Hold a threatened room, without closing a door on an allied formation.
   if(d.lockMode==='none'&&u.team===owner&&insideRoom(r,u)&&(u.garrison||['DEFEND_ZONE','HOLD_POSITION','DEFEND_CORE','HOLD_AT_ALL_COSTS'].includes(u.currentOrder))&&sim.time>=(d.manualUntil||0)&&sim.spatial.nearby(f.id,center.x,center.y,350).some(e=>e.team!==u.team&&!insideRoom(r,e)))setDoorLock(sim,u,d.id,'hostile');
  }
  const allowed=near.some(u=>canOpenDoor(d,u.team)&&reachDoor(f,u,d));
  d.hold=allowed?1.3:Math.max(0,d.hold-dt);
  const occupied=near.some(u=>overlapsDoor(u,d));
  const open=d.forcedOpen||d.hold>0||occupied;const passable=d.open>=.72;const speed=(d.type==='armored'||d.reinforced)?(open?2.35:1.45):open?4:2;d.open=Math.max(occupied?.72:0,Math.min(1,d.open+(open?dt*speed:-dt*speed)));if(passable!==(d.open>=.72))f.version++;d.state=open?'OPEN':d.lockMode==='none'?'CLOSED':'LOCKED';
  const attackers=near.filter(u=>u.role!=='player'&&u.team!==d.lockTeam&&!canOpenDoor(d,u.team)&&headsThroughDoor(u,d)&&!(u.stunnedUntil>sim.time)&&!(u.team==='enemy'&&sim.enemyFreezeUntil>sim.time)&&reachDoor(f,u,d));
  if(d.open<.72&&attackers.length){d.health-=dt*Math.min(48,attackers.length*16);for(const u of attackers){u.state='BREACH';u.angle=Math.atan2(center.y-u.y,center.x-u.x);}if(d.health<=0)sim.destroyDoor(f,d);}
 }
}
