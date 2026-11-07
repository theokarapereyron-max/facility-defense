import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {CORE,CONNECTORS,COLS,ROWS,ROOF_FLOOR,point,dist,canStand} from '../lib/facility/map.mjs';
import {PRIORITIES,orderPermission,npcPriority} from '../lib/facility/priorities.mjs';
import {levelTwoPlan,directLevelTwo,triggerEnemyEvent} from '../lib/facility/hostile-events.mjs';
import {commandEnemyOfficer,ENEMY_LIMIT} from '../lib/facility/director.mjs';
import {canAccessShop} from '../lib/facility/shops.mjs';
import {canAccessFurniture} from '../lib/facility/inventory.mjs';
import {SHOP_CATEGORIES} from '../lib/facility/shop-categories.mjs';

function scene(){const s=new Simulation();s.units=[s.player];s.status='running';s.time=20;s.directEvents=()=>{};s.player.rank=15;Object.assign(s.player,point(80,34,0));return s;}
const run=(s,seconds,until=()=>false)=>{for(let i=0;i<seconds*30;i++){s.tick(1/30);if(until())return;}};
const order=(s,u,issuer,priority=6)=>Object.assign(u,{currentOrder:'HOLD_POSITION',officerID:issuer.id,orderPriority:priority,orderUntil:Infinity,orderGoal:{x:u.x,y:u.y,floor:u.floor}});

test('Order replacement enforces priority, strict hierarchy and the player equal-rank tie-break in both camps',()=>{
 const s=scene(),p=s.player,u=s.makeUnit('ally','soldier',point(80,35,0),1),low=s.makeUnit('ally','officer',point(80,36,0),12),equal=s.makeUnit('ally','officer',point(80,37,0),15),high=s.makeUnit('ally','officer',point(80,38,0),22);
 assert.equal(s.commandPriority,6);assert.equal(PRIORITIES.length,15);s.selectUnit(u.id);assert.equal(s.command('HOLD_POSITION').count,1);assert.equal(u.orderPriority,6);
 for(let priority=1;priority<=15;priority++)assert.equal(orderPermission(s,low,u,priority).ok,false,'junior cannot override the player');
 assert.equal(orderPermission(s,high,u,5).ok,false);assert.equal(orderPermission(s,high,u,6).ok,true);assert.equal(orderPermission(s,high,u,15).ok,true);
 assert.equal(orderPermission(s,equal,u,6).ok,false);assert.equal(orderPermission(s,equal,u,15).ok,false);
 order(s,u,equal,6);assert.equal(orderPermission(s,p,u,6).ok,true);assert.equal(s.command('DEFEND_CORE').count,1);assert.equal(u.officerID,p.id);
 order(s,u,high,6);s.setCommandPriority(15);assert.equal(s.command('NORMAL').count,0);assert.equal(u.officerID,high.id);
 order(s,u,p,15);s.setCommandPriority(1);assert.equal(s.command('NORMAL').count,1);assert.equal(u.currentOrder,'NORMAL');
 const enemy=s.makeUnit('enemy','rifleman',point(80,28,1),1),chief=s.makeUnit('enemy','officer',point(80,29,1),22),junior=s.makeUnit('enemy','officer',point(80,30,1),20),superior=s.makeUnit('enemy','officer',point(80,31,1),24);
 order(s,enemy,chief,9);assert.equal(orderPermission(s,junior,enemy,15).ok,false);assert.equal(orderPermission(s,superior,enemy,8).ok,false);assert.equal(orderPermission(s,superior,enemy,9).ok,true);assert.equal(orderPermission(s,p,enemy,15).ok,false);
 s.setCommandPriority(90);assert.equal(s.commandPriority,15);s.setCommandPriority(-9);assert.equal(s.commandPriority,1);
});

test('NPC quiet orders cannot release player commands; actual Core emergencies can raise priority and take over',()=>{
 const s=scene(),p=s.player,u=s.makeUnit('ally','soldier',point(80,35,0),1),o=s.makeUnit('ally','officer',point(80,36,0),25);
 s.selectUnit(u.id);s.command('HOLD_POSITION');o.orderSerial=1;o.lastThreatAt=0;s.officerThink(o);assert.equal(u.officerID,p.id);assert.equal(u.orderPriority,6);
 Object.assign(p,{...CORE,x:CORE.x+65});Object.assign(u,{...CORE,x:CORE.x-65});Object.assign(o,{...CORE,y:CORE.y+65,homePosition:{...CORE},orderUntil:0});
 for(let i=0;i<8;i++)s.makeUnit('enemy','rifleman',{...CORE,x:CORE.x+150+i*30},1);
 s.coreControl=35;s.coreState='CAPTURING';s.officerThink(o);assert.equal(u.officerID,o.id);assert.equal(u.orderPriority,14);assert.ok(['DEFEND_CORE','HOLD_AT_ALL_COSTS'].includes(u.currentOrder));assert.equal(s.officerOrder.commanderID,o.id);
 assert.equal(npcPriority(s,o,'DEFEND_CORE',CORE),14);s.coreControl=19;assert.equal(npcPriority(s,o,'DEFEND_CORE',CORE),15);s.coreControl=80;assert.equal(npcPriority(s,o,'DEFEND_CORE',CORE),13);
 s.units=s.units.filter(a=>a.team==='ally');s.coreState='SECURE';assert.equal(npcPriority(s,o,'RETURN_TO_POST',o.homePosition),2);assert.equal(npcPriority(s,o,'HOLD_POSITION',o),3);
});

test('Both five-minute formations arrive with exact roles, distinct rooms and strictly superior squad leaders',()=>{
 for(const [random,counts] of [[.8,[2,10,3]],[.2,[4,15,5]]]){
  const plan=levelTwoPlan(1,()=>random);assert.equal(plan.total,counts.reduce((a,b)=>a+b));
  const s=scene();s.random=()=>random;s.time=299.9;directLevelTwo(s);assert.equal(s.units.length,1);s.time=300;directLevelTwo(s);
  const units=s.units.filter(u=>u.team==='enemy');assert.equal(units.length,plan.total);assert.equal(units.filter(u=>u.role==='officer').length,counts[0]);assert.equal(units.filter(u=>u.role==='medic').length,counts[2]);assert.equal(units.filter(u=>!['officer','medic'].includes(u.role)).length,counts[1]);
  assert.ok(units.every(u=>u.floor===2&&!u.elite&&u.reinforcementKind==='level-two'&&canStand(s.floor(2),u.x,u.y,u.radius)));
  const rooms=new Set();for(const officer of units.filter(u=>u.role==='officer')){const r=s.floor(2).rooms.find(r=>officer.x>r.x&&officer.x<r.x+r.w&&officer.y>r.y&&officer.y<r.y+r.h);assert.ok(r);rooms.add(r.index);const men=units.filter(u=>u.officerID===officer.id);assert.ok(men.length);assert.ok(men.every(u=>u.rank<officer.rank&&u.x>r.x&&u.x<r.x+r.w&&u.y>r.y&&u.y<r.y+r.h));}
  assert.equal(rooms.size,counts[0]);assert.equal(s.nextLevelTwo,600);assert.equal(s.pendingLevelTwo.length,0);assert.equal(s.nextRoofAttack,30);
  s.units=[s.player];s.time=600;directLevelTwo(s);assert.equal(s.levelTwoSerial,2);assert.equal(s.nextLevelTwo,900);assert.equal(s.units.length,plan.total+1);
 }
});

test('Five-minute insertions preserve complete squads at the population cap and wait for occupied rooms',()=>{
 const s=scene();s.random=()=>.8;for(let i=0;i<ENEMY_LIMIT-4;i++)s.makeUnit('enemy','rifleman',point(80,34,0),1);s.time=300;directLevelTwo(s);assert.equal(s.pendingLevelTwo[0].remaining,15);assert.equal(s.metrics.levelTwoArrivals||0,0);
 s.units=[s.player];for(const index of [7,15,3,12,17,19]){const z=s.floor(2).zones.find(z=>z.id===index);s.makeUnit('ally','soldier',z,1);}s.time=303;directLevelTwo(s);assert.equal(s.pendingLevelTwo[0].remaining,15);assert.equal(s.metrics.levelTwoArrivals||0,0);
 s.units=[s.player];s.time=306;directLevelTwo(s);assert.equal(s.pendingLevelTwo.length,0);assert.equal(s.metrics.levelTwoArrivals,15);
});

test('Enemy communication and medical events have timed effects and cannot resurrect units',()=>{
 const s=scene(),o=s.makeUnit('enemy','officer',point(80,34,1),22),m=s.makeUnit('enemy','medic',point(80,35,1),4),u=s.makeUnit('enemy','rifleman',point(80,36,1),1),dead=s.makeUnit('enemy','rifleman',point(80,36,1),1);
 dead.health=0;dead.state='DEAD';for(const a of [o,m,u]){a.nextThink=a.nextOfficer=Infinity;a.goal=null;}u.health=20;
 assert.ok(triggerEnemyEvent(s,'comms'));commandEnemyOfficer(s,o);assert.equal(o.orderSerial,0);s.time=s.enemyCommsUntil;commandEnemyOfficer(s,o);assert.equal(o.orderSerial,1);
 const oldOrder=u.currentOrder;assert.ok(triggerEnemyEvent(s,'comms'));commandEnemyOfficer(s,o);assert.equal(u.currentOrder,oldOrder);
 for(const a of [o,m,u])a.goal=null;assert.ok(triggerEnemyEvent(s,'medical'));s.tick(.1);assert.ok(Math.abs(u.health-20.8)<.0001);assert.equal(dead.health,0);
 s.time=m.medicalBoostUntil;s.tick(.1);assert.ok(Math.abs(u.health-21.2)<.0001);assert.equal(triggerEnemyEvent(s,'invalid-event'),false);
 s.units=[s.player];assert.equal(triggerEnemyEvent(s,'surge'),false);
});

test('Coordinated assaults alter actual movement and firing; sabotage expires and door charges cause real damage',()=>{
 const s=scene(),o=s.makeUnit('enemy','officer',point(80,34,1),22),u=s.makeUnit('enemy','rifleman',point(80,35,1),1);o.squadID=u.squadID='test';s.random=()=>.5;
 assert.ok(triggerEnemyEvent(s,'surge'));const from={...u},goal=point(80,63,1);s.navigate(u,goal,.1);const boosted=dist(from,u);Object.assign(u,{x:from.x,y:from.y,path:[],pathGoal:null,assaultBoostUntil:0});s.navigate(u,goal,.1);assert.ok(Math.abs(boosted/dist(from,u)-1.15)<.001);
 u.assaultBoostUntil=s.time+25;s.shoot(u,0);const rapid=u.shotCooldown;u.shotCooldown=0;u.assaultBoostUntil=s.time;s.shoot(u,0);assert.ok(Math.abs(rapid/u.shotCooldown-.8)<.001);
 const lift=s.elevators.find(l=>l.id==='L3');Object.assign(o,{x:lift.x,y:lift.y});assert.ok(triggerEnemyEvent(s,'sabotage'));assert.equal(lift.offlineUntil,s.time+25);s.updateElevators(.1);assert.equal(lift.doorState,'OFFLINE');s.time+=25;s.updateElevators(.1);assert.equal(lift.doorState,'OPEN');
 const f=s.floor(-2),door=f.doors.find(d=>d.type!=='standard');Object.assign(o,{floor:-2,x:door.x+door.w/2,y:door.y+door.h/2});const hp=door.health;assert.ok(triggerEnemyEvent(s,'breach'));assert.equal(door.health,hp-100);
});

test('The expanded east wing has enclosed shop rooms, six usable stands and no free shop inventory',()=>{
 const s=scene();assert.equal(COLS,196);assert.equal(ROWS,120);assert.equal(ROOF_FLOOR,5);assert.equal(s.floors.reduce((n,f)=>n+f.rooms.length,0),160);
 for(const f of s.floors.filter(f=>f.shop)){
  const shop=f.shop,r=shop.room;assert.equal(r.type,'shop');assert.equal(shop.stands.length,6);assert.deepEqual(new Set(shop.stands.map(t=>t.category)),new Set(['all',...SHOP_CATEGORIES.map(c=>c.id)]));
  for(const stand of shop.stands){Object.assign(s.player,{x:stand.x,y:stand.y,floor:f.id});assert.ok(canStand(f,stand.x,stand.y,11),f.id+' '+stand.category);assert.ok(canAccessShop(s,shop));assert.equal(s.getContext().category,stand.category);}
  Object.assign(s.player,{x:r.x-32,y:r.y+r.h/2,floor:f.id});assert.equal(canAccessShop(s,shop),false);
  const props=f.props.filter(p=>p.merchant);assert.equal(props.length,6);assert.ok(props.every(p=>!canAccessFurniture(s,p)&&!p.items.some(Boolean)));
  let walls=0,perimeter=0;for(let x=r.x/32;x<(r.x+r.w)/32;x++)for(const y of [r.y/32,(r.y+r.h)/32-1]){perimeter++;if(f.grid[y*COLS+x]===1)walls++;}assert.ok(walls>perimeter*.8);assert.ok(f.doors.some(d=>d.x>=r.x-32&&d.x<r.x+r.w&&d.y>=r.y-32&&d.y<r.y+r.h));
 }
 assert.equal(s.floor(ROOF_FLOOR).shop,null);
});

test('The new east stairs and freight lift provide actual navigation from the added floors to the Core',()=>{
 const s=scene(),stairs=CONNECTORS.find(c=>c.id==='D'),lift=s.elevators.find(c=>c.id==='L3');s.units=[];s.updatePlayer=()=>{};
 const u=s.makeUnit('enemy','rifleman',{...stairs,floor:4},1);u.preferredConnector='D';u.route=[{...CORE}];s.elevators.forEach(l=>l.offlineUntil=Infinity);run(s,160,()=>u.floor===-2&&dist(u,CORE)<200);assert.equal(u.floor,-2);assert.ok(dist(u,CORE)<200);assert.equal(s.metrics.floorChanges,6);
 const t=scene(),freight=t.elevators.find(l=>l.id==='L3');Object.assign(t.player,{x:lift.x,y:lift.y+90,floor:5});t.interact();t.updateElevators(30);assert.equal(freight.currentFloor,5);t.move(t.player,0,-90);assert.ok(t.useConnector('L3',-2,true));run(t,35,()=>t.player.floor===-2&&!t.player.transit);assert.equal(t.player.floor,-2);assert.equal(t.metrics.elevatorRides,1);assert.equal(freight.currentFloor,-2);assert.ok(canStand(t.floor(-2),t.player.x,t.player.y,11));
});
