import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {canStand,dist,nearestWalkable,point,CORE} from '../lib/facility/map.mjs';
import {roomStatus,insideRoom,doorCenter,canOpenDoor} from '../lib/facility/room-state.mjs';
import {healAtSupplies,resupplyGoal,deployGarrisons,updateRoomControl} from '../lib/facility/room-control.mjs';
import {setDoorLock,reachDoor} from '../lib/facility/doors.mjs';
import {directCoreRelief,directRelief} from '../lib/facility/services.mjs';
import {commandEnemyOfficer,ENEMY_LIMIT} from '../lib/facility/director.mjs';
import {lineOfSight} from '../lib/facility/navigation.mjs';
import {canCommand} from '../lib/facility/ranks.mjs';

function scene(){const s=new Simulation();s.units=[s.player];s.status='running';s.directEvents=()=>{};Object.assign(s.player,point(80,56,0));return s;}
const center=(f,r)=>nearestWalkable(f,r.x+r.w/2,r.y+r.h/2);
const guards=(s,f,r)=>s.units.filter(u=>u.garrison?.floor===f.id&&u.garrison.roomIndex===r.index);
function advance(s,seconds){for(let i=0;i<seconds*30;i++)s.tick(1/30);}

test('Every room, including all seven shops, has a stable controller and uniquely associated doors',()=>{
 const s=scene();let count=0,shops=0;
 for(const f of s.floors){assert.equal(new Set(f.doors.map(d=>d.id)).size,f.doors.length);
  for(const d of f.doors){assert.ok(f.rooms[d.roomIndex]);assert.ok(['none','hostile'].includes(d.lockMode));}
  for(const r of f.rooms){assert.equal(r.owner,'ally');count++;if(r.type==='shop')shops++;
   s.units=[s.makeUnit('enemy','rifleman',center(f,r))];updateRoomControl(s,20);s.updateZones();assert.equal(r.owner,'enemy',f.id+' '+r.name);assert.equal(f.zones[r.index].owner,'enemy');assert.equal(guards(s,f,r).length,4);
  }
 }
 assert.equal(count,160);assert.equal(shops,7);
});

test('Majorities count only living occupants inside the room; ties and empty rooms retain ownership',()=>{
 const s=scene(),f=s.floor(0),r=f.rooms[0],p=center(f,r),e=s.makeUnit('enemy','rifleman',p);
 for(let i=0;i<8;i++)s.makeUnit('ally','soldier',{x:r.x-60,y:p.y,floor:0});
 const dead=s.makeUnit('ally','soldier',p);dead.health=0;const transit=s.makeUnit('ally','soldier',p);transit.transit='L1';
 assert.equal(roomStatus(s,f,r).owner,'enemy');
 const a=s.makeUnit('ally','soldier',p);assert.equal(roomStatus(s,f,r).owner,'ally');assert.equal(roomStatus(s,f,r).contested,true);
 a.health=0;updateRoomControl(s,20);s.updateZones();assert.equal(r.owner,'enemy');const g=guards(s,f,r);assert.equal(g.length,4);
 s.units=[s.player];updateRoomControl(s,20);s.updateZones();assert.equal(r.owner,'enemy');s.makeUnit('ally','soldier',p);s.makeUnit('enemy','rifleman',p);updateRoomControl(s,20);s.updateZones();assert.equal(r.owner,'enemy');
 s.makeUnit('ally','soldier',p);updateRoomControl(s,20);s.updateZones();assert.equal(r.owner,'ally');assert.equal(s.zonesDefended,1);
});

test('One full garrison per enemy capture, real positions and hierarchy; recapture permits a new group',()=>{
 const s=scene(),f=s.floor(1),r=f.rooms[18],e=s.makeUnit('enemy','rifleman',center(f,r));updateRoomControl(s,20);s.updateZones();
 const group=guards(s,f,r),o=group.find(u=>u.role==='officer');assert.equal(group.length,4);assert.equal(group.filter(u=>u.role==='rifleman').length,3);
 for(const u of group){assert.ok(insideRoom(r,u));assert.ok(canStand(f,u.x,u.y,11));assert.ok(group.every(v=>v===u||dist(v,u)>=30));if(u!==o)assert.ok(canCommand(o,u)&&u.officerID===o.id);}
 for(let i=0;i<5;i++)updateRoomControl(s,20);s.updateZones();assert.equal(guards(s,f,r).length,4);s.time=25;commandEnemyOfficer(s,o);assert.equal(o.currentOrder,'DEFEND_ZONE');assert.ok(insideRoom(r,o.orderGoal));
 for(const u of [e,...group])u.health=0;const ally=s.makeUnit('ally','soldier',center(f,r));updateRoomControl(s,20);s.updateZones();assert.equal(r.owner,'ally');ally.health=0;s.makeUnit('enemy','rifleman',center(f,r));updateRoomControl(s,20);s.updateZones();assert.equal(s.metrics.captureGuards,8);
});

test('Garrisons wait as a complete four-person group at the cap and cancel if the room is retaken',()=>{
 const s=scene(),f=s.floor(0),r=f.rooms[18];s.makeUnit('enemy','rifleman',center(f,r));while(s.units.filter(u=>u.team==='enemy').length<ENEMY_LIMIT)s.makeUnit('enemy','rifleman',point(80,56,3));
 updateRoomControl(s,20);s.updateZones();assert.ok(r.pendingGarrison);assert.equal(guards(s,f,r).length,0);
 s.units.splice(-3);deployGarrisons(s);assert.equal(guards(s,f,r).length,0);s.units.splice(-1);deployGarrisons(s);assert.equal(guards(s,f,r).length,4);assert.equal(r.pendingGarrison,null);
 const other=f.rooms[19];s.units[1].x=center(f,other).x;s.units[1].y=center(f,other).y;updateRoomControl(s,20);s.updateZones();assert.ok(other.pendingGarrison);
 s.units[1].health=0;s.makeUnit('ally','soldier',center(f,other));updateRoomControl(s,20);s.updateZones();assert.equal(other.pendingGarrison,null);
});

test('Respawn revalidates the chosen room live, refusing every hostile occupation even under allied majority',()=>{
 const s=scene(),f=s.floor(0),sp=f.supplies[0];s.player.health=0;s.respawnIn=0;
 assert.equal(s.supplyOptions().find(p=>p.id===sp.id).available,true);
 const enemy=s.makeUnit('enemy','rifleman',sp);s.makeUnit('ally','soldier',{...sp,x:sp.x+50});s.makeUnit('ally','soldier',{...sp,x:sp.x-50});
 assert.equal(s.supplyOptions().find(p=>p.id===sp.id).owner,'ally');assert.equal(s.respawn(sp.id),false);
 enemy.health=0;assert.equal(s.respawn(sp.id),true);assert.equal(s.player.floor,0);
 s.player.health=0;s.units=[s.player];f.rooms[sp.roomIndex].owner='enemy';assert.equal(s.respawn(sp.id),false);
});

test('Both teams and player heal only at their controlled station; recent damage and remote use are rejected',()=>{
 for(const team of ['ally','enemy']){
  const s=scene(),f=s.floor(-1),sp=f.supplies[0],u=s.makeUnit(team,'soldier',sp);u.health=30;updateRoomControl(s,20);
  healAtSupplies(s,1);assert.equal(u.health,48);u.hurtAt=s.time;healAtSupplies(s,2);assert.equal(u.health,48);s.time=4;healAtSupplies(s,10);assert.equal(u.health,u.maxHealth);
  u.health=30;u.x+=250;healAtSupplies(s,2);assert.equal(u.health,30);
  Object.assign(u,sp);for(let i=0;i<2;i++)s.makeUnit(team==='ally'?'enemy':'ally','soldier',{...sp,x:sp.x+50+i*40});healAtSupplies(s,1);assert.equal(u.health,30);
 }
 const s=scene(),sp=s.floor(0).supplies[0];Object.assign(s.player,sp,{health:30});assert.equal(s.getContext().type,'supply');s.interact();assert.equal(s.player.health,30);healAtSupplies(s,4);assert.equal(s.player.health,100);
});

test('Wounded autonomous soldiers seek a friendly station and resume duty without overriding protected orders',()=>{
 const s=scene(),f=s.floor(-1),sp=f.supplies[0],u=s.makeUnit('enemy','rifleman',{...sp,y:sp.y-200});f.rooms[sp.roomIndex].owner='enemy';u.health=25;
 assert.equal(resupplyGoal(s,u,false).id,sp.id);s.think(u);assert.equal(u.state,'RESUPPLY');assert.equal(u.goal.id,sp.id);
 assert.equal(resupplyGoal(s,u,true),null);u.health=u.maxHealth;assert.equal(resupplyGoal(s,u,false),null);
 u.health=25;advance(s,12);assert.ok(u.health>=u.maxHealth*.95);assert.equal(u.resupplyID,null);
});

test('A defender may treat wounds inside the assigned room but cannot leave a protected room order',()=>{
 const s=scene(),f=s.floor(-1),sp=f.supplies[0],u=s.makeUnit('ally','soldier',{...sp,y:sp.y-150});
 Object.assign(u,{health:25,currentOrder:'DEFEND_ZONE',orderGoal:center(f,f.rooms[sp.roomIndex]),orderUntil:1e4});
 assert.equal(resupplyGoal(s,u,true).id,sp.id);u.orderGoal=center(f,f.rooms[0]);assert.equal(resupplyGoal(s,u,true),null);
 u.currentOrder='HOLD_AT_ALL_COSTS';u.orderGoal={...sp};assert.equal(resupplyGoal(s,u,true),null);
});

test('Door locks enforce ownership, range, two access modes, live recapture and atomic validation',()=>{
 const s=scene(),f=s.floor(0),d=f.doors[0],r=f.rooms[d.roomIndex],p=doorCenter(d);Object.assign(s.player,{x:p.x,y:p.y+40,floor:0});
 assert.ok(reachDoor(f,s.player,d));assert.equal(s.getContext().type,'door');assert.equal(s.setDoorLock(d.id,'hostile').ok,true);assert.ok(canOpenDoor(d,'ally'));assert.equal(canOpenDoor(d,'enemy'),false);
 assert.equal(s.setDoorLock(d.id,'all').ok,true);assert.equal(canOpenDoor(d,'ally'),false);assert.equal(canOpenDoor(d,'enemy'),false);
 assert.equal(s.setDoorLock(d.id,'none').ok,true);assert.ok(canOpenDoor(d,'enemy'));
 const enemy=s.makeUnit('enemy','officer',center(f,r));assert.equal(s.setDoorLock(d.id,'all').ok,false);
 Object.assign(enemy,{x:p.x,y:p.y-40});assert.equal(setDoorLock(s,enemy,d.id,'hostile').ok,true);updateRoomControl(s,20);s.updateZones();assert.equal(d.lockTeam,'enemy');
 enemy.x+=300;assert.equal(setDoorLock(s,enemy,d.id,'none').ok,false);
 const state=d.lockMode;s.player.health=0;assert.equal(s.setDoorLock(d.id,'none').ok,false);assert.equal(d.lockMode,state);
});

test('Locked doors physically block movement and shots, unlock, and never close through an occupant',()=>{
 const s=scene(),f=s.floor(0),d=f.doors[0],p=doorCenter(d);Object.assign(s.player,{x:p.x,y:p.y+40,floor:0});
 assert.ok(s.setDoorLock(d.id,'all').ok);s.spatial.build(s.units);s.updateDoors(1);assert.equal(d.open,0);assert.equal(canStand(f,p.x,p.y,10),false);assert.equal(lineOfSight(f,s.player,{x:p.x,y:p.y-60}),false);
 assert.ok(s.setDoorLock(d.id,'none').ok);s.updateDoors(1);assert.equal(d.open,1);assert.ok(canStand(f,p.x,p.y,10));assert.ok(lineOfSight(f,s.player,{x:p.x,y:p.y-60}));
 Object.assign(s.player,p);s.setDoorLock(d.id,'all');s.spatial.build(s.units);s.updateDoors(1);assert.equal(d.open,1);Object.assign(s.player,{x:p.x,y:p.y+50});s.spatial.build(s.units);s.updateDoors(1);assert.equal(d.open,0);
});

test('Enemy AI opens friendly locks, breaches hostile locks and keeps its guard assignment',()=>{
 const s=scene(),f=s.floor(0),r=f.rooms[0],d=f.doors[0],p=doorCenter(d);Object.assign(s.player,point(80,56,-1));
 for(const door of f.doors.filter(a=>a.roomIndex===r.index)){door.lockMode='hostile';door.lockTeam='ally';}
 const u=s.makeUnit('enemy','rifleman',{x:p.x,y:p.y+65,floor:0});u.garrison={floor:0,roomIndex:r.index};u.homePosition=center(f,r);u.currentOrder='DEFEND_ZONE';u.orderGoal=center(f,r);u.orderUntil=1e4;
 advance(s,30);assert.ok(s.metrics.doorBreaches>0);assert.ok(insideRoom(r,u));assert.equal(r.owner,'enemy');
 const own=f.doors.find(a=>a.roomIndex===r.index&&a.state!=='DESTROYED');own.lockTeam='enemy';own.lockMode='hostile';Object.assign(u,{x:doorCenter(own).x+45,y:doorCenter(own).y});u.goal=null;s.units=[u];s.spatial.build(s.units);s.updateDoors(1);assert.ok(own.open>0);
});

test('An officer targets the far side of a locked door and a passing patrol does not damage unrelated locks',()=>{
 const s=scene(),f=s.floor(0),r=f.rooms[0],d=f.doors[0],p=doorCenter(d);Object.assign(s.player,point(80,56,-1));
 for(const door of f.doors.filter(a=>a.roomIndex===r.index)){door.lockMode='hostile';door.lockTeam='ally';}
 const o=s.makeUnit('enemy','officer',{x:p.x,y:p.y+60,floor:0});commandEnemyOfficer(s,o);assert.equal(o.currentOrder,'ATTACK_DOOR');assert.ok(o.orderGoal.y<p.y);
 let entered=false;for(let i=0;i<25*30;i++){s.tick(1/30);entered ||=o.floor===0&&insideRoom(r,o);}assert.ok(s.metrics.doorBreaches>0);assert.ok(entered);assert.equal(r.owner,'enemy');
 const fresh=scene(),fd=fresh.floor(0),lock=fd.doors[0],c=doorCenter(lock);Object.assign(fresh.player,point(80,56,-1));lock.lockMode='hostile';lock.lockTeam='ally';
 const passing=fresh.makeUnit('enemy','rifleman',{x:c.x,y:c.y+60,floor:0});passing.goal=passing.path[0]={x:c.x+300,y:c.y+60,floor:0};fresh.spatial.build(fresh.units);fresh.updateDoors(3);assert.equal(lock.health,100);
});

test('Allied relief never spawns in an enemy-controlled room and shops refuse hostile occupation',()=>{
 const s=scene(),f=s.floor(-2);for(const p of s.coreReliefs)f.rooms[p.roomIndex].owner='enemy';s.time=330;directCoreRelief(s);assert.equal(s.units.filter(u=>u.coreReliefID).length,0);
 for(const f of s.floors)for(const r of f.rooms)r.owner='enemy';directRelief(s);assert.equal(s.units.filter(u=>u.reliefPost).length,0);
 const shop=s.floor(0).shop;Object.assign(s.player,shop,{health:100,credits:10000});s.makeUnit('enemy','rifleman',center(s.floor(0),shop.room));s.makeUnit('enemy','rifleman',center(s.floor(0),shop.room));const credits=s.player.credits;assert.equal(s.buyItem(shop.id,'bandage').ok,false);assert.equal(s.player.credits,credits);
});
