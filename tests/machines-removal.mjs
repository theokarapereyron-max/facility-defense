import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Simulation} from '../lib/facility/simulation.mjs';
import {COLS,canStand,nearestWalkable} from '../lib/facility/map.mjs';
import {ITEMS} from '../lib/facility/items.mjs';
import {PRICES,canAccessShop} from '../lib/facility/shops.mjs';
import {itemPreview} from '../lib/facility/item-preview.mjs';
import {canUseLift} from '../lib/facility/lift-access.mjs';
import {updateRoomControl} from '../lib/facility/room-control.mjs';
import {doorControlRoom,doorCenter,canOpenDoor} from '../lib/facility/room-state.mjs';
import {syncDoorAuthority} from '../lib/facility/doors.mjs';
import {visionRange,spotUnit,tacticalContact} from '../lib/facility/contacts.mjs';

const retired=['field_repair','emp','power_kit','med_drone'];
const scene=()=>{const s=new Simulation({seed:731});s.units=[s.player];s.status='running';s.directEvents=()=>{};return s;};

test('No runtime module references the retired machinery, power grid or technical AI',()=>{
 for(const file of readdirSync(new URL('../lib/facility/',import.meta.url)).filter(f=>f.endsWith('.mjs'))){
  const source=readFileSync(new URL('../lib/facility/'+file,import.meta.url),'utf8');
  assert.doesNotMatch(source,/technology\.mjs|tech-ai\.mjs|tech-layout\.mjs|tech-renderer\.mjs|\.devices\b|\.tech\b|powerMode|powerUntil/,file);
 }
});

test('All eight floors are machine-free across three seeds and have no invisible machine collision cells',()=>{
 for(const seed of [1,731,53217]){
  const s=new Simulation({seed});assert.equal(s.tech,undefined);assert.equal(s.powerUntil,undefined);
  for(const f of s.floors){
   assert.equal(f.devices,undefined);assert.equal(f.powerMode,undefined);
   assert.ok(f.props.length>20);assert.ok(f.doors.length>15);
   assert.ok(f.props.every(p=>!['generator','vent','server','turret','camera','console'].includes(p.type)));
   const footprints=new Set();for(const p of f.props.filter(p=>p.solid))for(let y=p.y/32;y<(p.y+p.h)/32;y++)for(let x=p.x/32;x<(p.x+p.w)/32;x++)footprints.add(y*COLS+x);
   for(let i=0;i<f.grid.length;i++)if(f.grid[i]===3)assert.ok(footprints.has(i),'orphan obstacle '+seed+' / '+f.id+' / '+i);
   for(const c of f.connectors){const p=nearestWalkable(f,c.x,c.y+150);assert.ok(canStand(f,p.x,p.y));assert.ok(s.pathfinding.path(f,f.entry,p).length||Math.hypot(f.entry.x-p.x,f.entry.y-p.y)<32);}
  }
 }
});

test('Machine consumables are absent from every shop, price, preview and furniture container',()=>{
 const s=scene();
 for(const item of retired){assert.equal(ITEMS[item],undefined);assert.equal(PRICES[item],undefined);assert.equal(itemPreview(s.snapshot(),item),null);}
 for(const f of s.floors){
  for(const p of f.props)for(const slot of p.items||[])if(slot)assert.ok(ITEMS[slot.item]);
  for(const offer of f.shop?.offers||[]){assert.ok(ITEMS[offer.item]);assert.ok(!retired.includes(offer.item));assert.ok(itemPreview(s.snapshot(),offer.item).stats.length);}
 }
});

test('Every lift is usable by either faction on all valid floors without a console or generator',()=>{
 const s=scene();
 for(const l of s.elevators)for(const team of ['ally','enemy'])for(let floor=l.min;floor<=l.max;floor++)for(let target=l.min;target<=l.max;target++)assert.ok(canUseLift(s,l,floor,team,target));
 for(const l of s.elevators){assert.equal(canUseLift(s,l,l.min-1),false);assert.equal(canUseLift(s,l,0,'ally',l.max+1),false);}
});

test('Doors follow their own room and a legacy remote command or power flag cannot block local access',()=>{
 const s=scene(),f=s.floor(0),d=f.doors.find(d=>!d.mechanical),r=f.rooms[d.roomIndex],other=f.rooms.find(r=>r.index!==d.roomIndex);
 Object.assign(d,{remoteLock:true,controlRoomId:other.index,powerAvailable:false,powerFailureMode:'FAIL_CLOSED',lockMode:'hostile'});other.owner='enemy';r.owner='ally';
 assert.equal(doorControlRoom(f,d),r);Object.assign(s.player,{...doorCenter(d),floor:f.id});s.spatial.build(s.units);
 assert.ok(s.setDoorAction(d.id,'open').ok);assert.ok(canOpenDoor(d,'enemy'));
 r.owner='enemy';syncDoorAuthority(s,f,d);assert.equal(d.lockTeam,'enemy');assert.equal(canOpenDoor(d,'ally'),false);
 r.owner='ally';syncDoorAuthority(s,f,d);assert.ok(canOpenDoor(d,'ally'));
});

test('Strategic room captures still take 20, 14 or 10 seconds and opposing occupants pause capture',()=>{
 for(const [count,duration] of [[1,20],[2,14],[3,10]]){
  const s=scene(),f=s.floor(2),r=f.rooms[7],p=nearestWalkable(f,r.x+r.w/2,r.y+r.h/2);s.units=[];
  for(let i=0;i<count;i++)s.makeUnit('enemy','soldier',p);
  for(let t=0;t<duration-.25;t+=.25)updateRoomControl(s,.25);
  assert.equal(r.owner,'ally');updateRoomControl(s,.25);assert.equal(r.owner,'enemy');assert.equal(s.metrics.captureGuards,4);
 }
 const s=scene(),f=s.floor(2),r=f.rooms[15],p=nearestWalkable(f,r.x+r.w/2,r.y+r.h/2);s.units=[];
 s.makeUnit('enemy','soldier',p);updateRoomControl(s,8);const progress=r.captureProgress;s.makeUnit('ally','soldier',p);updateRoomControl(s,20);assert.equal(r.captureProgress,progress);assert.equal(r.owner,'ally');
});

test('Every shop can sell ordinary equipment without any power state',()=>{
 const s=scene();s.player.credits=100000;
 for(const f of s.floors.filter(f=>f.shop)){
  const shop=f.shop,stand=shop.stands.find(t=>t.category==='combat');Object.assign(s.player,{x:stand.x,y:stand.y+60,floor:f.id,items:[]});
  assert.ok(canAccessShop(s,shop),'floor '+f.id);assert.ok(s.buyItem(shop.id,'grenade').ok);assert.equal(s.player.items[0].item,'grenade');
 }
});

test('Soldier sight and expiring radio reports work without cameras, servers or transmitters',()=>{
 const s=scene(),a=s.makeUnit('ally','soldier',{x:2500,y:1104,floor:0}),e=s.makeUnit('enemy','soldier',{x:2570,y:1104,floor:0});
 assert.equal(visionRange(s,a),a.visionRange);spotUnit(s,a,e);const saved={x:e.x,y:e.y,floor:e.floor};e.transit='L1';e.x+=500;e.floor=2;
 assert.deepEqual(Object.fromEntries(Object.entries(tacticalContact(s,a,e)).filter(([k])=>['x','y','floor'].includes(k))),saved);
 s.time=6;assert.equal(tacticalContact(s,a,e),null);
});

test('Three five-minute combat simulations keep finite actors and never recreate machinery',()=>{
 for(const seed of [1,731,53217]){
  const s=new Simulation({seed});s.start();s.nextAttack=1;s.updateCore=()=>{}; // Keep the soak running after a normally terminal Core capture.
  for(let i=0;i<1200;i++){s.tick(.25);if(i%240===0){const snap=s.snapshot();assert.ok(Number.isFinite(snap.score));assert.equal(snap.technology,undefined);for(const u of s.units){assert.ok([u.x,u.y,u.floor,u.health].every(Number.isFinite));assert.ok(s.floor(u.floor));assert.equal(u.technicalMission,undefined);assert.equal(u.deviceTarget,undefined);}}}
  assert.equal(s.time,300);assert.ok(s.metrics.shots>0);assert.ok(s.roofWaves>0);assert.equal(s.tech,undefined);assert.equal(s.metrics.turretShots,undefined);assert.equal(s.metrics.sabotages,undefined);
  console.log('Combat soak',JSON.stringify({seed,time:s.time,actors:s.units.length,shots:s.metrics.shots,transitions:s.metrics.floorChanges}));
 }
});
