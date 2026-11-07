import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,WEAPONS} from '../lib/facility/simulation.mjs';
import {ROOF_FLOOR,CORE,COLS,ROWS,point,dist,canStand} from '../lib/facility/map.mjs';
import {ITEMS,inventoryCapacity} from '../lib/facility/items.mjs';
import {canAccessFurniture} from '../lib/facility/inventory.mjs';
import {furnitureStatus} from '../lib/facility/furniture.mjs';
import {canAccessShop,restockShops} from '../lib/facility/shops.mjs';
import {RANKS,awardExperience,killXP} from '../lib/facility/ranks.mjs';
import {killCredits} from '../lib/facility/economy.mjs';
import {directRelief} from '../lib/facility/services.mjs';
import {updateAirlift,updateAirPassenger} from '../lib/facility/airlift.mjs';
import {spawnHostiles} from '../lib/facility/director.mjs';
import {directEvents,ALLY_LIMIT,ENEMY_LIMIT} from '../lib/facility/director.mjs';
import {npcCanSee} from '../lib/facility/special-items.mjs';
import {updateWaveStatus,waveSummary} from '../lib/facility/wave-status.mjs';

function scene(){const s=new Simulation();s.units=[s.player];s.status='running';s.time=10;s.player.spawnTime=-100;s.directEvents=()=>{};s.nextLevelTwo=s.nextEnemyEvent=s.nextAttack=s.nextReinforce=s.nextRoofAttack=Infinity;s.nextRelief=Infinity;Object.assign(s.player,point(80,34,0));return s;}
const run=(s,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*30);i++)s.tick(1/30,input);};
function equip(s,item,count=1){s.player.items=[{item,count}];s.player.itemCooldown=0;}
function approach(s,p){for(const d of s.floor(p.floor).doors)d.open=1;for(const q of [{x:p.x-24,y:p.y+p.h/2},{x:p.x+p.w+24,y:p.y+p.h/2},{x:p.x+p.w/2,y:p.y-24},{x:p.x+p.w/2,y:p.y+p.h+24}]){Object.assign(s.player,q,{floor:p.floor});if(canStand(s.floor(p.floor),q.x,q.y)&&canAccessFurniture(s,p))return;}assert.fail('Furniture unreachable');}

test('Seven distinct shops are reachable, supply every item and exclude the roof',()=>{
 const s=scene(),sold=new Set();assert.equal(s.floor(ROOF_FLOOR).shop,null);
 for(const f of s.floors.filter(f=>f.shop)){
  const shop=f.shop;Object.assign(s.player,shop);assert.ok(canAccessShop(s,shop));assert.equal(s.getContext().type,'shop');
  assert.ok(canStand(f,shop.x,shop.y,20));assert.ok(shop.offers.length>13);
  for(const o of shop.offers){sold.add(o.item);assert.ok(ITEMS[o.item]);assert.ok(o.price>0&&o.stock>0&&o.stock===o.maxStock);}
  const start=Math.floor(f.entry.y/32)*COLS+Math.floor(f.entry.x/32),queue=[start],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){const n=queue[i],x=n%COLS,y=Math.floor(n/COLS);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*COLS+xx;if(xx<0||yy<0||xx>=COLS||yy>=ROWS||seen.has(k)||[1,3].includes(f.grid[k]))continue;seen.add(k);queue.push(k);}}
  assert.ok(seen.has(Math.floor(shop.y/32)*COLS+Math.floor(shop.x/32)),shop.name);
 }
 assert.deepEqual([...sold].sort(),Object.keys(ITEMS).sort());assert.equal(new Set(s.floors.filter(f=>f.shop).map(f=>f.shop.offers.map(o=>o.item).join(','))).size,7);
 assert.ok(s.floor(-1).shop.offers.find(o=>o.item==='ammo').price<s.floor(0).shop.offers.find(o=>o.item==='ammo').price);
});

test('Credits reward personal kills once and new promotions; death cannot farm promotion bonuses',()=>{
 const s=scene(),p=s.player,e=s.makeUnit('enemy','rifleman',point(85,56,0),0);s.kill(e,p);assert.equal(p.credits,killCredits(60));const first=p.credits;s.kill(e,p);assert.equal(p.credits,first);
 const ally=s.makeUnit('ally','soldier',point(86,56,0)),enemy=s.makeUnit('enemy','heavy',point(88,56,0),10);assert.ok(killCredits(killXP(enemy))>first);s.kill(enemy,ally);s.kill(ally,p);assert.equal(p.credits,first);
 awardExperience(s,RANKS[5].xp-p.xp,'Test promotion');const xp=p.xp,credits=p.credits;assert.equal(credits,first+[1,2,3,4,5].reduce((n,r)=>n+75+r*25,0));
 s.kill(p,null);assert.equal(p.rank,3);assert.equal(p.credits,credits);s.respawnIn=0;assert.ok(s.respawn(s.floor(0).supply.id));awardExperience(s,xp-p.xp,'Regain');assert.equal(p.rank,5);assert.equal(p.credits,credits);assert.equal(new Simulation().player.credits,0);
});

test('Furniture credits are collected once, even with a full bag; distance still applies',()=>{
 const s=scene(),p=s.player,f=s.floor(0).props.find(f=>f.credits);assert.ok(f);approach(s,f);s.openFurniture(f.id);p.items=Array.from({length:inventoryCapacity(p)},()=>({item:'radio',count:1}));f.items=Array(f.capacity).fill(null);f.credits=75;assert.equal(furnitureStatus(f),'Crédits disponibles');
 assert.ok(s.collectCredits().ok);assert.equal(p.credits,75);assert.equal(f.credits,0);assert.equal(s.collectCredits().ok,false);assert.equal(p.credits,75);
 f.credits=60;assert.ok(s.takeAll().ok);assert.equal(p.credits,135);f.credits=40;p.x+=600;assert.equal(s.collectCredits().ok,false);assert.equal(f.credits,40);
});

test('Shop purchases debit exactly once and preserve money and stock on every rejection',()=>{
 const s=scene(),p=s.player,shop=s.floor(0).shop,o=shop.offers.find(o=>o.item==='grenade');Object.assign(p,shop);p.credits=1000;p.items=[];
 const stock=o.stock;assert.ok(s.buyItem(shop.id,'grenade').ok);assert.equal(p.credits,1000-o.price);assert.equal(o.stock,stock-1);assert.deepEqual(p.items[0],{item:'grenade',count:1});
 const reject=()=>{const before=[p.credits,o.stock,JSON.stringify(p.items)];assert.equal(s.buyItem(shop.id,'grenade').ok,false);assert.deepEqual([p.credits,o.stock,JSON.stringify(p.items)],before);};
 p.items=Array.from({length:3},()=>({item:'radio',count:1}));reject();p.items=[];p.credits=0;reject();p.credits=1000;p.x=shop.room.x-64;reject();Object.assign(p,shop);p.floor=1;reject();p.floor=0;p.health=0;reject();p.health=p.maxHealth;o.stock=0;reject();
 s.time=180;restockShops(s);assert.equal(o.stock,3);s.time=1000;restockShops(s);assert.equal(o.stock,o.maxStock);
});

test('Medical, armor, ammunition, XP and recon purchases perform their advertised effects',()=>{
 const s=scene(),p=s.player;equip(s,'xp_major');assert.ok(s.useItem(0).ok);assert.equal(p.xp,2000);assert.ok(p.rank>0&&p.credits>0);
 equip(s,'trauma',2);assert.equal(s.useItem(0).ok,false);p.health=1;assert.ok(s.useItem(0).ok);assert.equal(p.health,p.maxHealth);assert.equal(p.items[0].count,1);
 const a=s.makeUnit('ally','soldier',{x:p.x+40,y:p.y,floor:0}),dead=s.makeUnit('ally','soldier',{x:p.x+50,y:p.y,floor:0});a.health=20;dead.health=0;p.health=20;equip(s,'team_med');assert.ok(s.useItem(0).ok);assert.equal(a.health,80);assert.equal(p.health,80);assert.equal(dead.health,0);
 equip(s,'armor_heavy');assert.ok(s.useItem(0).ok);assert.equal(p.armor,180);const hp=p.health;s.damage(p,190,null);assert.equal(p.health,hp-10);assert.equal(p.armor,0);
 p.mag=1;p.reserve=3;p.reload=1;equip(s,'reserve_pack');s.useItem(0);assert.equal(p.mag,WEAPONS[p.weapon].magazineSize);assert.equal(p.reserve,WEAPONS[p.weapon].maxReserve);assert.equal(p.reload,0);
 equip(s,'recon');s.useItem(0);assert.ok(s.floors.every(f=>s.scans[f.id]===s.time+60));
});

test('Timed mobility and cadence bonuses change real movement and shooting and then expire',()=>{
 const s=scene(),p=s.player;const x=p.x;s.updatePlayer(.1,{x:1});const normal=p.x-x;p.x=x;equip(s,'adrenaline',2);s.useItem(0);s.updatePlayer(.1,{x:1});assert.ok(Math.abs((p.x-x)/normal-1.25)<1e-6);p.itemCooldown=0;assert.equal(s.useItem(0).ok,false);
 equip(s,'overdrive');s.useItem(0);p.shotCooldown=0;s.shoot(p,0);assert.equal(p.shotCooldown,WEAPONS[p.weapon].fireRate*.65);s.time+=31;p.x=x;s.updatePlayer(.1,{x:1});assert.ok(Math.abs((p.x-x)-normal)<1e-6);p.shotCooldown=0;s.shoot(p,0);assert.equal(p.shotCooldown,WEAPONS[p.weapon].fireRate);
});

test('Stasis stops enemy movement, shooting, healing, door breaches and Core capture, including arrivals',()=>{
 const s=scene(),p=s.player;Object.assign(p,point(80,34,1));const e=s.makeUnit('enemy','rifleman',CORE),medic=s.makeUnit('enemy','medic',{...CORE,x:CORE.x+30});e.health=50;equip(s,'stasis');s.useItem(0);
 const d=s.floor(-2).doors.find(d=>d.type!=='standard');s.makeUnit('enemy','rifleman',{x:d.x+d.w/2,y:d.y+d.h+35,floor:-2});const doorHP=d.health;
 const fresh=s.makeUnit('enemy','rifleman',point(80,34,0)),before={x:fresh.x,y:fresh.y,mag:fresh.mag};run(s,2);s.shoot(fresh,0);assert.deepEqual({x:fresh.x,y:fresh.y,mag:fresh.mag},before);assert.equal(s.coreControl,100);assert.equal(e.health,50);assert.equal(d.health,doorHP);assert.equal(medic.state,'STUNNED');
 s.time=s.enemyFreezeUntil+.1;s.updateCore(1);assert.ok(s.coreControl<100);fresh.shotCooldown=0;s.shoot(fresh,0);assert.equal(fresh.mag,before.mag-1);
});

test('Core rebuild restores control; its shield reduces real capture by eighty percent without reviving a lost game',()=>{
 const s=scene();s.coreControl=15;equip(s,'core_rebuild');s.useItem(0);assert.equal(s.coreControl,100);equip(s,'core_rebuild');assert.equal(s.useItem(0).ok,false);assert.ok(s.player.items[0]);
 s.makeUnit('enemy','rifleman',CORE);s.updateCore(1);const normal=100-s.coreControl;s.coreControl=100;equip(s,'core_shield');s.useItem(0);s.updateCore(1);assert.ok(Math.abs(100-s.coreControl-normal*.2)<1e-8);
 s.time=s.coreShieldUntil+1;s.updateCore(1);assert.ok(Math.abs(100-s.coreControl-normal*1.2)<1e-8);s.status='defeat';equip(s,'core_rebuild');assert.equal(s.useItem(0).ok,false);
});

test('Door kits rebuild destroyed doors safely and reinforcement increases actual resistance only once',()=>{
 const s=scene(),d=s.floor(0).doors[0];Object.assign(s.player,{x:d.x+d.w/2,y:d.y+d.h+40,floor:0});s.destroyDoor(s.floor(0),d);equip(s,'door_kit');assert.ok(s.useItem(0).ok);assert.equal(d.state,'OPEN');assert.ok(d.health>0);assert.equal(d.open,1);
 const hp=d.health;equip(s,'door_armor',2);assert.ok(s.useItem(0).ok);assert.equal(d.health,hp+200);s.player.itemCooldown=0;assert.equal(s.useItem(0).ok,false);assert.equal(s.player.items[0].count,1);
 Object.assign(s.player,{x:d.x+d.w/2,y:d.y+d.h/2});s.spatial.build(s.units);d.hold=0;s.updateDoors(3);assert.equal(d.open,1); // Repaired doors never close through an occupant.
});

test('Smoke obstructs NPC perception and expires; incendiary damage respects cover and awards personal kills',()=>{
 const s=scene(),p=s.player;const a={...p},b={...p,x:p.x+120};assert.ok(npcCanSee(s,a,b));s.fields.push({type:'smoke',floor:0,x:p.x+60,y:p.y,radius:45,until:s.time+1});assert.equal(npcCanSee(s,a,b),false);run(s,1.1);assert.ok(npcCanSee(s,a,b));
 equip(s,'smoke');s.useItem(0);run(s,1.3);assert.ok(s.fields.some(f=>f.type==='smoke'));s.fields=[];
 Object.assign(p,point(80,34,0),{angle:0});const e=s.makeUnit('enemy','rifleman',{x:p.x+420,y:p.y,floor:0},0);e.health=12;e.speed=0;e.nextThink=e.shotCooldown=Infinity;equip(s,'incendiary');s.useItem(0);run(s,2.1);assert.equal(e.health,0);assert.equal(p.kills,1);assert.ok(p.credits>0);assert.ok(s.fields.some(f=>f.type==='fire'));run(s,9);assert.equal(s.fields.length,0);
});

test('Room reinforcement requires a valid choice, reserves eight slots, lands on roof and physically reaches its assigned room',()=>{
 const s=scene(),p=s.player;equip(s,'radio_target');const before=JSON.stringify(p.items);assert.equal(s.useItem(0).selection,'room');assert.equal(JSON.stringify(p.items),before);assert.equal(s.supportRequests.length,0);assert.equal(s.useItem(0,{room:{floor:-9,index:0}}).ok,false);
 const room=s.floor(-2).rooms[13];assert.ok(s.useItem(0,{room:{floor:-2,index:13}}).ok);assert.equal(p.items[0],null);assert.equal(s.supportRequests[0].remaining,8);s.time+=12;directEvents(s);const men=s.units.filter(u=>u!==p);assert.equal(men.length,8);assert.ok(men.every(u=>u.floor===ROOF_FLOOR&&u.homePosition.floor===-2&&u.assignedRoom.index===13));
 run(s,360);assert.ok(men.every(u=>u.floor===-2&&u.x>room.x&&u.x<room.x+room.w&&u.y>room.y&&u.y<room.y+room.h),'all eight must reach the chosen room');assert.ok(s.metrics.floorChanges>=8);
 while(s.units.length<ALLY_LIMIT-7)s.makeUnit('ally','soldier',point(80,34,0));equip(s,'radio_target');assert.equal(s.useItem(0,{room:{floor:-2,index:13}}).ok,false);assert.ok(p.items[0]);
});

test('Each 45-second relief adds at most 12 allies globally, including medics, with rotating intact guard squads',()=>{
 const s=scene();s.nextRelief=45;s.time=44.9;directRelief(s);assert.equal(s.units.length,1);assert.equal(s.snapshot().pendingRelief,0);
 const served=new Set();
 for(let cycle=1;cycle<=8;cycle++){
  s.units=[s.player];s.time=cycle*45;directRelief(s);assert.equal(s.units.length,13);assert.equal(s.reliefBudget,0);assert.equal(s.snapshot().pendingRelief,0);assert.equal(s.snapshot().reliefLimit,12);
  const arrivals=s.units.filter(u=>u!==s.player);
  for(const post of s.reliefPosts){const units=arrivals.filter(u=>u.reliefPost===post.id);if(!units.length)continue;served.add(post.id);const room=s.floor(post.floor).rooms[post.roomIndex];assert.equal(units.length,post.kind==='guard'?3:1);assert.ok(units.every(u=>u.floor===post.floor&&u.x>room.x&&u.x<room.x+room.w&&u.y>room.y&&u.y<room.y+room.h&&canStand(s.floor(u.floor),u.x,u.y,11)));
   if(post.kind==='guard'){const o=units.find(u=>u.role==='officer');assert.ok(o);assert.equal(units.filter(u=>u.role==='soldier').length,2);assert.ok(units.filter(u=>u!==o).every(u=>u.rank<o.rank&&u.officerID===o.id));}else assert.equal(units[0].role,'medic');}
  for(let second=0;second<45;second++){s.time=cycle*45+second;directRelief(s);assert.equal(s.units.length,13,'no second batch between intervals');}
 }
 assert.equal(served.size,s.reliefPosts.length);assert.equal(s.metrics.reliefGuards+s.metrics.reliefMedics,8*12);assert.equal(s.nextRelief,405);
});

test('Blocked or missed relief cycles never accumulate beyond 12 when capacity becomes available',()=>{
 const s=scene();s.nextRelief=45;while(s.units.length<ALLY_LIMIT)s.makeUnit('ally','soldier',point(80,34,0));
 for(const time of [45,90,135,450]){s.time=time;directRelief(s);assert.equal(s.units.length,ALLY_LIMIT);assert.equal(s.reliefBudget,12);assert.equal(s.snapshot().pendingRelief,12);assert.ok(s.reliefPosts.every(p=>p.pending<=1));}
 s.units=[s.player];directRelief(s);assert.equal(s.units.length,13);assert.equal(s.reliefBudget,0);assert.equal(s.nextRelief,495);directRelief(s);assert.equal(s.units.length,13);assert.equal(s.metrics.reliefGuards+s.metrics.reliefMedics,12);
});

test('Unsafe relief rooms still wait and use only the remaining shared quota after clearing',()=>{
 const s=scene(),post=s.reliefPosts.find(p=>p.kind==='guard'),room=s.floor(post.floor).rooms[post.roomIndex];s.reliefBudget=3;post.pending=1;
 for(let y=room.y+32;y<room.y+room.h;y+=130)for(let x=room.x+32;x<room.x+room.w;x+=130)s.makeUnit('enemy','rifleman',{x,y,floor:post.floor});directRelief(s);assert.equal(post.pending,1);assert.equal(s.reliefBudget,3);assert.ok(!s.units.some(u=>u.reliefPost===post.id));
 s.units=[s.player];directRelief(s);assert.equal(post.pending,0);assert.equal(s.reliefBudget,0);assert.equal(s.units.filter(u=>u.reliefPost===post.id).length,3);directRelief(s);assert.equal(s.units.length,4);
});

test('Major wave status counts actual arrivals once, shows all phases and marks repelled only after the last hostile',()=>{
 const s=scene();assert.equal(waveSummary(s).phase,'waiting');assert.equal(waveSummary(s).number,1);
 for(let i=0;i<ENEMY_LIMIT;i++)s.makeUnit('enemy','rifleman',point(20+i%20,15+Math.floor(i/20),2));s.nextAttack=s.time=300;s.random=()=>.2;directEvents(s);assert.equal(waveSummary(s).phase,'incoming');assert.equal(s.wavesReceived,0);
 s.units=[s.player];s.time+=3;directEvents(s);assert.equal(s.wavesReceived,1);assert.equal(waveSummary(s).phase,'insertion');assert.equal(waveSummary(s).inserted,32);
 for(let i=0;i<18000&&s.pendingWaves.length;i++){s.time+=1/30;updateAirlift(s,1/30,spawnHostiles);for(const u of s.units)if(u.airInsertion)updateAirPassenger(s,u,1/30);if(i%90===0)directEvents(s);}assert.equal(s.wavesReceived,1);assert.equal(waveSummary(s).phase,'combat');assert.equal(waveSummary(s).inserted,128);assert.equal(waveSummary(s).alive,128);
 const last=s.units.filter(u=>u.team==='enemy').at(-1);s.units=[s.player,last];updateWaveStatus(s);assert.equal(s.wavesRepelled,0);s.kill(last,null);updateWaveStatus(s);assert.equal(s.wavesRepelled,1);assert.equal(waveSummary(s).phase,'waiting');assert.equal(waveSummary(s).number,2);updateWaveStatus(s);assert.equal(s.wavesRepelled,1);
});
