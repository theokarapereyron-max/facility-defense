import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {ROOF_FLOOR,createFacility,CORE,COLS,ROWS,point,canStand,dist} from '../lib/facility/map.mjs';
import {ITEMS,SLOT_KEYS,inventoryCapacity,slotForKey,transferStack,occupied} from '../lib/facility/items.mjs';
import {canAccessFurniture,activeFurniture} from '../lib/facility/inventory.mjs';
import {restockFurniture} from '../lib/facility/furniture.mjs';
import {RANKS,applyPlayerRank} from '../lib/facility/ranks.mjs';
import {directEvents,ALLY_LIMIT} from '../lib/facility/director.mjs';
import {raycast} from '../lib/facility/navigation.mjs';
const run=(s,seconds)=>{for(let i=0;i<seconds*30;i++)s.tick(1/30);};
function isolated(){const s=new Simulation();s.units=[s.player];s.status='running';s.time=10;s.player.spawnTime=-100;s.directEvents=()=>{};Object.assign(s.player,point(80,34,0));return s;}
function equip(s,item,count=1){s.player.items=[{item,count}];s.player.itemCooldown=0;}
function approach(s,p){const f=s.floor(p.floor);for(const d of f.doors)d.open=1;const options=[{x:p.x-24,y:p.y+p.h/2},{x:p.x+p.w+24,y:p.y+p.h/2},{x:p.x+p.w/2,y:p.y-24},{x:p.x+p.w/2,y:p.y+p.h+24}];for(const q of options){Object.assign(s.player,q,{floor:p.floor});if(canStand(f,q.x,q.y)&&canAccessFurniture(s,p))return;}assert.fail('No accessible face: '+p.id);}

test('Every room has themed furniture and all containers remain physically reachable',()=>{
 const s=isolated(),fs=s.floors;let total=0;
 for(const f of fs){
  for(const r of f.rooms){const ps=f.props.filter(p=>p.roomIndex===r.index);assert.ok(ps.length>=2,r.name);if(/CUISINE|SANITAIRE/.test(r.name))assert.ok(ps.every(p=>p.type!=='bed'));}
  const origin=f.entry,start=Math.floor(origin.y/32)*COLS+Math.floor(origin.x/32),queue=[start],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){const n=queue[i],x=n%COLS,y=Math.floor(n/COLS);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*COLS+xx;if(xx<0||yy<0||xx>=COLS||yy>=ROWS||seen.has(k)||[1,3].includes(f.grid[k]))continue;seen.add(k);queue.push(k);}}
  for(const p of f.props.filter(p=>!p.merchant)){total++;approach(s,p);assert.ok(seen.has(Math.floor(s.player.y/32)*COLS+Math.floor(s.player.x/32)),p.id+' isolated');assert.equal(p.items.length,p.capacity);for(const stack of p.items)if(stack){assert.ok(ITEMS[stack.item]);assert.ok(stack.count>0&&stack.count<=ITEMS[stack.item].stack);}
   if(p.solid)assert.ok(raycast(f,p.x-4,p.y+p.h/2,0,p.w+8).wall);
  }
 }
 assert.ok(total>=600);assert.ok(fs.some(f=>f.props.some(p=>!occupied(p.items))));assert.ok(fs.some(f=>f.props.some(p=>occupied(p.items)===p.capacity)));
 const second=createFacility(932);assert.deepEqual(second.flatMap(f=>f.props.map(p=>[p.id,p.x,p.y,p.type])),fs.flatMap(f=>f.props.map(p=>[p.id,p.x,p.y,p.type])),'loot may change, architecture does not');
});

test('Inventory adds a slot every two grades; 17 AZERTY shortcuts never collide with controls',()=>{
 const p={rank:0};assert.equal(inventoryCapacity(p),3);p.rank=1;assert.equal(inventoryCapacity(p),3);p.rank=2;assert.equal(inventoryCapacity(p),4);p.rank=29;assert.equal(inventoryCapacity(p),17);
 const reserved=new Set('zqsdrewxcvnbm'.split(''));assert.equal(new Set(SLOT_KEYS).size,17);
 for(const [i,key] of SLOT_KEYS.entries()){const alt=key.startsWith('Alt+'),k=key.split('+').at(-1);if(!alt)assert.ok(!reserved.has(k.toLowerCase()));assert.equal(slotForKey({key:k,altKey:alt}),i);assert.equal(slotForKey({key:k,altKey:alt,ctrlKey:true}),-1);}
});

test('Partial stack transfers preserve every object and respect non-stackable and empty slots',()=>{
 const source=[{item:'grenade',count:3},{item:'radio',count:1}],target=[{item:'grenade',count:2},{item:'armor',count:1},null];
 assert.equal(transferStack(source,0,target,3),3);assert.deepEqual(target,[{item:'grenade',count:3},{item:'armor',count:1},{item:'grenade',count:2}]);assert.equal(source[0],null);
 assert.equal(transferStack(source,1,target,3),0);assert.equal(source[1].count,1);
 const one=[{item:'grenade',count:3}];assert.equal(transferStack(one,0,target,3),1);assert.equal(one[0].count,2);
 assert.equal(transferStack(source,-1,target,3),0);assert.equal(transferStack(source,1,source,3),0);
});

test('Furniture take, single deposit and take-all work only while alive and in reach',()=>{
 const s=isolated(),f=s.floor(0).props[0];approach(s,f);assert.equal(s.openFurniture(f.id),true);s.player.items=[];f.items=Array(f.capacity).fill(null);f.items[0]={item:'grenade',count:3};
 assert.equal(s.transferItem('take',0,1).ok,true);assert.equal(s.player.items[0].count,1);assert.equal(f.items[0].count,2);
 assert.equal(s.transferItem('store',0).ok,true);assert.equal(s.player.items[0],null);assert.equal(f.items[0].count,3);assert.equal(s.takeAll().ok,true);assert.equal(s.player.items[0].count,3);
 s.player.x+=600;assert.equal(activeFurniture(s),null);assert.equal(s.transferItem('store',0).ok,false);assert.equal(s.player.items[0].count,3);
 approach(s,f);s.player.health=0;assert.equal(s.transferItem('store',0).ok,false);s.player.health=100;s.player.floor=1;assert.equal(s.openFurniture(f.id),false);
});

test('Health, ration, ammunition and armor items have real effects and no invalid-use loss',()=>{
 const s=isolated(),p=s.player;equip(s,'bandage',2);assert.equal(s.useItem(0).ok,false);assert.equal(p.items[0].count,2);p.health=20;assert.equal(s.useItem(0).ok,true);assert.equal(p.health,50);assert.equal(p.items[0].count,1);
 equip(s,'medkit');s.useItem(0);assert.equal(p.health,100);assert.equal(p.items[0],null);
 p.health=50;equip(s,'ration',2);s.useItem(0);run(s,4);assert.ok(p.health>61&&p.health<63);assert.equal(s.useItem(0).ok,false);assert.equal(p.items[0].count,1);run(s,6.1);assert.ok(Math.abs(p.health-80)<.2);
 equip(s,'ammo',2);assert.equal(s.useItem(0).ok,false);p.reserve=440;s.useItem(0);assert.equal(p.reserve,480);assert.equal(p.items[0].count,1);
 equip(s,'armor');s.useItem(0);assert.equal(p.armor,60);const before=p.health;s.damage(p,75,null);assert.equal(p.armor,0);assert.equal(p.health,before-15);
});

test('XP objects promote, expand capacity and never increment combat kills',()=>{
 const s=isolated(),p=s.player;equip(s,'xp',3);s.useItem(0);assert.equal(p.xp,100);assert.equal(p.rank,1);assert.equal(inventoryCapacity(p),3);assert.equal(p.items[0].count,2);
 equip(s,'manual');s.useItem(0);assert.equal(p.xp,450);assert.ok(p.rank>=3);assert.ok(inventoryCapacity(p)>=4);assert.equal(p.kills,0);assert.equal(s.kills,0);assert.equal(s.xpEvents.at(-1).label,ITEMS.manual.name);assert.ok(s.promotion);
});

test('Grenades travel, explode once, respect walls/cover and award player kill XP',()=>{
 const s=isolated(),p=s.player;Object.assign(p,point(80,34,0),{angle:0});const enemy=s.makeUnit('enemy','rifleman',{x:p.x+420,y:p.y,floor:0});enemy.health=50;enemy.speed=0;enemy.shotCooldown=Infinity;enemy.nextThink=Infinity;
 equip(s,'grenade',2);assert.equal(s.useItem(0).ok,true);assert.equal(p.items[0].count,1);assert.equal(s.projectiles.length,1);run(s,.6);assert.equal(enemy.health,50);assert.ok(s.projectiles[0].x>p.x);run(s,.65);assert.equal(enemy.health,0);assert.equal(s.projectiles.length,0);assert.equal(p.kills,1);const xp=p.xp;run(s,2);assert.equal(p.xp,xp);
 // Throwing into a solid prop stops the projectile before the obstruction.
 const f=s.floor(0).props.find(a=>a.solid);approach(s,f);p.angle=Math.atan2(f.y+f.h/2-p.y,f.x+f.w/2-p.x);equip(s,'grenade');s.useItem(0);const g=s.projectiles[0];assert.ok(dist({x:g.endX,y:g.endY},p)<100);
});

test('Flash temporarily stops NPC fire/movement; scanner detects only its activation floor',()=>{
 const s=isolated(),p=s.player;Object.assign(p,point(80,34,0),{angle:0});const e=s.makeUnit('enemy','rifleman',{x:p.x+425,y:p.y,floor:0});e.speed=0;e.shotCooldown=Infinity;e.nextThink=Infinity;equip(s,'flash');s.useItem(0);run(s,1.3);assert.ok(e.stunnedUntil>s.time);assert.equal(e.state,'STUNNED');const mag=e.mag;e.shotCooldown=0;s.shoot(e,Math.PI);assert.equal(e.mag,mag,'stun must also guard direct shooting');run(s,3.1);assert.ok(e.stunnedUntil<=s.time);
 const other=s.makeUnit('enemy','rifleman',point(80,34,1));other.seenAt=-100;equip(s,'scanner');s.useItem(0);run(s,.1);assert.equal(e.seenAt,s.time);assert.equal(other.seenAt,-100);assert.ok(s.snapshot().scanRemaining>0);run(s,15);assert.equal(s.snapshot().scanRemaining,0);
});

test('Core repair requires proximity; breach charge only opens a nearby closed door',()=>{
 const s=isolated();s.coreControl=60;equip(s,'repair');assert.equal(s.useItem(0).ok,false);assert.equal(s.player.items[0].count,1);Object.assign(s.player,CORE);assert.equal(s.useItem(0).ok,true);assert.equal(s.coreControl,80);
 const d=s.floor(0).doors[0];Object.assign(s.player,{x:d.x+d.w/2,y:d.y+d.h+40,floor:0,angle:-Math.PI/2});equip(s,'breach');assert.equal(s.useItem(0).ok,true);assert.equal(d.state,'DESTROYED');equip(s,'breach');assert.equal(s.useItem(0).ok,false);assert.equal(s.player.items[0].count,1);
});

test('Reinforcement radio lands eight real units on roof after twelve seconds, never exceeds cap',()=>{
 const s=isolated();s.nextAttack=s.nextReinforce=Infinity;equip(s,'radio');assert.equal(s.useItem(0).ok,true);assert.equal(s.supportRequests.length,1);assert.equal(s.units.length,1);run(s,11.9);directEvents(s);assert.equal(s.units.length,1);run(s,.2);directEvents(s);const allies=s.units.filter(u=>u.role!=='player');assert.equal(allies.length,8);assert.ok(allies.every(u=>u.floor===ROOF_FLOOR));assert.ok(allies.some(u=>u.role==='medic'));assert.ok(allies.some(u=>u.role==='officer'));assert.equal(s.supportRequests.length,0);
 while(s.units.length<ALLY_LIMIT-7)s.makeUnit('ally','soldier',point(80,34,0));equip(s,'radio');assert.equal(s.useItem(0).ok,false);assert.equal(s.player.items[0].count,1);
});

test('Death drops every item before demotion; supply and respawn cannot duplicate loot',()=>{
 const s=isolated(),p=s.player;p.xp=RANKS[10].xp;applyPlayerRank(p,true);p.items=Array.from({length:inventoryCapacity(p)},()=>({item:'radio',count:1}));const count=occupied(p.items),floor=p.floor;
 s.kill(p,null);assert.equal(p.rank,8);assert.equal(p.items.length,0);const bag=s.floor(floor).props.find(f=>f.dropped);assert.equal(occupied(bag.items),count);assert.equal(bag.capacity,count);s.kill(p,null);assert.equal(s.floor(floor).props.filter(f=>f.dropped).length,1);
 run(s,6);assert.equal(s.respawn(s.floor(0).supply.id),true);assert.equal(p.items.length,0);approach(s,bag);s.openFurniture(bag.id);s.takeAll();assert.equal(occupied(p.items),inventoryCapacity(p));assert.equal(occupied(bag.items),1);
 Object.assign(p,s.floor(0).supply);const saved=JSON.stringify(p.items);s.interact();assert.equal(JSON.stringify(p.items),saved);
});

test('Wave deliveries fill empty furniture cells only, preserve deposits and ignore abandoned bags',()=>{
 const s=isolated(),f=s.floor(0);for(const p of f.props)p.items=Array.from({length:p.capacity},()=>({item:'grenade',count:1}));const target=f.props[0];target.items[0]=null;const before=JSON.stringify(target.items.slice(1));s.random=()=>.8;
 const bag={...target,id:'bag-test',dropped:true,items:Array(target.capacity).fill(null)};f.props.push(bag);assert.equal(restockFurniture(s,'ally',0),1);assert.ok(target.items[0]);assert.equal(JSON.stringify(target.items.slice(1)),before);assert.ok(bag.items.every(i=>i===null));
 target.items[0]=null;s.random=()=>.1;assert.equal(restockFurniture(s,'ally',0),0);assert.equal(target.items[0],null);s.random=()=>.8;assert.equal(restockFurniture(s,'enemy',0),0);f.rooms[target.roomIndex].owner='enemy';assert.equal(restockFurniture(s,'enemy',0),1);
});
