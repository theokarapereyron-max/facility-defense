import {spotUnit} from '../lib/facility/contacts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,WEAPONS} from '../lib/facility/simulation.mjs';
import {ROOF_FLOOR,createFacility,CONNECTORS,CORE,COLS,ROWS,point,dist,canStand} from '../lib/facility/map.mjs';
import {raycast} from '../lib/facility/navigation.mjs';
function isolated(){const s=new Simulation();s.units=[];s.status='running';s.directEvents=()=>{};s.updatePlayer=()=>{};return s;}
function run(s,seconds,until=()=>false){for(let i=0;i<seconds*30&&s.status==='running';i++){s.tick(1/30);if(until())break;}}

test('Eight deterministic floors: rooms, supplies, core and aligned connectors are reachable',()=>{
 const fs=createFacility();assert.equal(fs.length,8);
 for(const f of fs){
  const seen=new Set(),origin=f.supply||f.entry,start=Math.floor(origin.y/32)*COLS+Math.floor(origin.x/32),queue=[start];seen.add(start);
  for(let i=0;i<queue.length;i++){const n=queue[i],x=n%COLS,y=Math.floor(n/COLS);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*COLS+xx;if(xx<0||yy<0||xx>=COLS||yy>=ROWS||seen.has(j)||[1,3].includes(f.grid[j]))continue;seen.add(j);queue.push(j);}}
  const reachable=p=>seen.has(Math.floor(p.y/32)*COLS+Math.floor(p.x/32));
  assert.ok(f.rooms.length>=16);assert.ok(reachable(f.entry));for(const supply of f.supplies){assert.ok(reachable(supply));assert.ok(f.rooms.some(r=>supply.x>r.x&&supply.x<r.x+r.w&&supply.y>r.y&&supply.y<r.y+r.h));}
  for(const c of f.connectors){assert.ok(reachable(c),'connector '+c.id+' floor '+f.id);const fixed=CONNECTORS.find(a=>a.id===c.id);assert.equal(c.x,fixed.x);assert.equal(c.y,fixed.y);}
  for(const r of f.rooms)assert.ok(queue.some(n=>{const x=(n%COLS+.5)*32,y=(Math.floor(n/COLS)+.5)*32;return x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h;}),'room '+r.name);
  if(f.id===-2)assert.ok(reachable(CORE));
 }
});
test('An enemy navigates from the roof to the Core using seven stair transitions and doors',()=>{
 const s=isolated(),e=s.makeUnit('enemy','rifleman',{...CONNECTORS[1],floor:ROOF_FLOOR});e.preferredConnector='B';e.route=[{...CORE}];s.elevators.forEach(l=>l.offlineUntil=1e6);
 run(s,200,()=>e.floor===-2&&dist(e,CORE)<200);
 assert.equal(e.floor,-2);assert.ok(dist(e,CORE)<200,'enemy reaches capture zone');assert.equal(s.metrics.floorChanges,7);assert.ok(s.metrics.doorBreaches>0);assert.ok(s.pathfinding.calls>0);
});
test('NPC calls and uses an elevator from roof to infrastructure',()=>{
 const s=isolated();const c=CONNECTORS[3],e=s.makeUnit('enemy','rifleman',{x:c.x,y:c.y+92,floor:ROOF_FLOOR});Object.assign(e,{health:10000,maxHealth:10000});e.route=[{...CORE}];
 run(s,150,()=>e.floor===-2&&dist(e,CORE)<200);assert.ok(s.metrics.elevatorRides>0);assert.equal(e.floor,-2);assert.ok(dist(e,CORE)<200);
});
test('Player must approach a connector; stairs are adjacent and lift transit is timed',()=>{
 const s=new Simulation();s.status='running';s.units=[s.player];s.directEvents=()=>{};
 assert.equal(s.useConnector('A',1),false);Object.assign(s.player,{x:CONNECTORS[0].x,y:CONNECTORS[0].y,floor:0});assert.equal(s.useConnector('A',2),false);assert.equal(s.useConnector('A',-1),true);assert.equal(s.player.floor,-1);
 const l=s.elevators[0];Object.assign(s.player,{x:l.x,y:l.y+90,floor:-1});s.interact();s.updateElevators(20);assert.equal(l.currentFloor,-1);s.move(s.player,0,-90);assert.equal(s.useConnector('L1',ROOF_FLOOR,true),true);assert.equal(s.player.floor,-1);run(s,30,()=>s.player.floor===ROOF_FLOOR&&!s.player.transit);assert.equal(s.player.floor,ROOF_FLOOR);assert.equal(s.player.transit,null);
});
test('Walls stop movement and instant shots',()=>{
 const s=new Simulation(),f=s.floor(0);Object.assign(s.player,point(49,15,0));const x=s.player.x;assert.ok(canStand(f,s.player.x,s.player.y));
 for(let i=0;i<20;i++)s.move(s.player,5,0);assert.ok(s.player.x<x+20);const hit=raycast(f,x,s.player.y,0,400);assert.equal(hit.wall,true);assert.ok(hit.d<40);
});
test('Allied soldier detects and eliminates a hostile, then returns to defence',()=>{
 const s=isolated(),a=s.makeUnit('ally','soldier',point(80,33,0)),e=s.makeUnit('enemy','rifleman',point(80,24,0));e.nextThink=Infinity;e.shotCooldown=Infinity;e.speed=0;
 run(s,45,()=>e.health<=0);assert.equal(e.health,0);assert.ok(s.metrics.shots>0);run(s,4);assert.equal(a.state,'DEFEND');assert.ok(dist(a,a.homePosition)<70);
});
test('Officer scores a retreat and maintains the order for at least fifteen seconds',()=>{
 const s=isolated(),o=s.makeUnit('ally','officer',point(80,33,0));o.name='TEST OFFICER';
 for(let i=0;i<4;i++){const a=s.makeUnit('ally','soldier',point(80,34+i,0));a.health=20;}
 for(let i=0;i<8;i++)s.makeUnit('enemy','rifleman',point(80,21+i,0));s.spatial.build(s.units);s.officerThink(o);
 assert.equal(o.currentOrder,'RETREAT');assert.equal(s.units.filter(u=>u.officerID===o.id).length,4);assert.ok(o.orderScores[0].score>o.orderScores[1].score);const serial=o.orderSerial;
 s.units=s.units.filter(u=>u.team==='ally');s.spatial.build(s.units);s.time=14;s.officerThink(o);assert.equal(o.orderSerial,serial);assert.equal(o.currentOrder,'RETREAT');
});
test('Core control decreases, contests, regenerates and triggers defeat',()=>{
 const s=isolated(),e=s.makeUnit('enemy','rifleman',CORE);s.updateCore(5);assert.ok(s.coreControl<100);assert.equal(s.coreState,'CAPTURING');
 const before=s.coreControl;s.makeUnit('ally','soldier',{...CORE,x:CORE.x+40});s.updateCore(5);assert.equal(s.coreControl,before);assert.equal(s.coreState,'CONTESTED');e.health=0;s.updateCore(4);assert.equal(s.coreControl,Math.min(100,before+2));
 s.units=s.units.filter(u=>u.team==='enemy');e.health=100;s.coreControl=.01;s.updateCore(1);assert.equal(s.status,'defeat');
});
test('A two-minute unattended battle fights, repositions defenders and respects reinforcement pacing',()=>{
 const s=new Simulation();s.start();const initial=new Map(s.units.filter(u=>u.team==='ally'&&u.id!==s.player.id).map(u=>[u.id,{x:u.x,y:u.y,floor:u.floor}])),repositioned=new Set();
 run(s,120,()=>{for(const u of s.units){const p=initial.get(u.id);if(p&&(u.floor!==p.floor||dist(u,p)>100))repositioned.add(u.id);}return false;});const r=s.snapshot();
 assert.ok(repositioned.size>=6,'defenders react without player input, including those returning to post');
 assert.ok(s.time>119);assert.ok(s.metrics.shots>100);assert.ok(s.kills>=5);assert.ok(s.metrics.officerOrders>=6);assert.equal(s.director.attackIndex,0);assert.ok(s.nextAttack>=300);assert.ok(s.units.filter(u=>u.team==='enemy'&&u.health>0).length<=ENEMY_LIMIT);assert.ok(s.roofWaves>=3);
 for(const u of s.units.filter(u=>u.health>0&&!u.transit))assert.ok(canStand(s.floor(u.floor),u.x,u.y,u.radius),u.role+' intersects wall');
 console.log(JSON.stringify({unattended:{time:r.time,core:r.core,allies:r.allies,enemies:r.enemies,kills:r.totalKills,metrics:r.metrics}}));
});
test('Reload, weapon swap, specific supply respawn and indefinite mission work',()=>{
 for(const [weapon,oldMagazine] of Object.entries({rifle:30,pistol:12,smg:36,shotgun:8,marksman:10,heavy:60})){const armed=new Simulation({loadout:weapon});assert.equal(armed.player.mag,oldMagazine*2);assert.equal(armed.player.reserve,weapon==='pistol'?192:480);}
 const s=new Simulation({duration:100});s.units=[s.player];s.directEvents=()=>{};s.status='running';s.player.mag=2;s.reload();run(s,3);assert.equal(s.player.mag,WEAPONS.rifle.magazineSize);assert.equal(s.player.reserve,WEAPONS.rifle.maxReserve-(WEAPONS.rifle.magazineSize-2));
 s.swapWeapon(2);assert.equal(s.player.weapon,'pistol');s.swapWeapon(1);assert.equal(s.player.mag,WEAPONS.rifle.magazineSize);
 Object.assign(s.player,s.floor(0).supply,{health:30,reserve:0});s.interact();assert.equal(s.player.health,30);run(s,5);assert.equal(s.player.health,100);assert.equal(s.player.reserve,WEAPONS.rifle.maxReserve);
 s.kill(s.player,null);assert.equal(s.respawn(s.floor(0).supply.id),false);run(s,6);assert.equal(s.player.health,0);assert.equal(s.respawn('roof'),false);assert.equal(s.respawn(s.floor(1).supplies[1].id),true);assert.equal(s.player.floor,1);assert.equal(s.player.health,100);assert.equal(s.deaths,1);assert.equal(s.status,'running');s.time=5000;s.tick(1/30);assert.equal(s.status,'running');s.finish(true);assert.equal(s.status,'ended');assert.equal(WEAPONS.shotgun.pellets,7);
});

test('AZERTY movement, arrow rotation and Space fire remain independent',async()=>{
 const {readControls,controlKey}=await import('../lib/facility/controls.mjs');
 const s=new Simulation();s.units=[s.player];s.status='running';s.directEvents=()=>{};
 Object.assign(s.player,point(80,34,0));const initial={x:s.player.x,y:s.player.y,angle:s.player.angle};
 for(let i=0;i<15;i++)s.tick(1/30,readControls(new Set(['arrowright'])));
 assert.equal(s.player.x,initial.x);assert.equal(s.player.y,initial.y);assert.ok(s.player.angle>initial.angle);
 for(let i=0;i<15;i++)s.tick(1/30,readControls(new Set(['arrowleft'])));assert.ok(Math.abs(s.player.angle-initial.angle)<1e-8);
 const ammo=s.player.mag;s.tick(1/30,readControls(new Set(['z',' '])));assert.ok(s.player.y<initial.y);assert.equal(s.player.x,initial.x);assert.equal(s.player.mag,ammo-1);
 const oldX=s.player.x;s.tick(1/30,readControls(new Set(['q'])));assert.ok(s.player.x<oldX);
 assert.equal(controlKey({key:'&',code:'Digit1'}),'1');assert.equal(controlKey({key:' ',code:'Space'}),' ');
 assert.equal(readControls(new Set(['arrowup'])).y,0);assert.equal(readControls(new Set(),{angle:0}).angle,undefined);
});

test('Music follows only the current floor, while Core alarms escalate globally',async()=>{
 const {audioScene}=await import('../lib/facility/audio-scene.mjs');const s=isolated();s.time=30;s.player.floor=0;
 const hostile=s.makeUnit('enemy','rifleman',point(80,34,1));s.lastCombatAt[1]=30;assert.equal(audioScene(s).music,'calm');
 hostile.floor=0;assert.equal(audioScene(s).music,'threat');s.lastCombatAt[0]=30;assert.equal(audioScene(s).music,'combat');s.time=35;assert.equal(audioScene(s).music,'threat');
 hostile.health=0;assert.equal(audioScene(s).music,'calm');s.coreState='CONTESTED';s.coreControl=40;assert.equal(audioScene(s).coreAlarm,1);s.coreControl=39;assert.equal(audioScene(s).coreAlarm,2);s.coreControl=20;assert.equal(audioScene(s).coreAlarm,2);s.coreControl=19;assert.equal(audioScene(s).coreAlarm,3);
 assert.equal(audioScene(s,true).coreAlarm,0);assert.equal(audioScene(s,true).playing,false);s.coreState='SECURE';assert.equal(audioScene(s).coreAlarm,0);
});

test('Core beeps work with music disabled, and pause or mute stops new audio',async()=>{
 const {AudioSystem}=await import('../lib/facility/audio.mjs');const a=new AudioSystem(),heard=[];
 a.context={currentTime:10,state:'running'};a.musicEnabled=false;a.alarmBus='alarm';a.voice=(...args)=>heard.push(args);a.scene={playing:true,music:'calm',coreAlarm:3};
 a.schedule();assert.equal(heard.length,3);assert.ok(heard.every(n=>n[4]==='alarm'));assert.ok(heard[2][5]>heard[0][5]);assert.ok(a.nextAlarm-10<1);
 a.context.currentTime=11;a.scene.playing=false;a.schedule();assert.equal(heard.length,3);
 a.context.currentTime=12;a.scene.playing=true;a.enabled=false;a.schedule();assert.equal(heard.length,3);
});

test('Two nearby officers cannot give conflicting orders to the same soldiers',()=>{
 const s=isolated(),a=s.makeUnit('ally','officer',point(80,33,0)),b=s.makeUnit('ally','officer',point(80,34,0));a.name='A';b.name='B';b.rank=a.rank;
 const men=Array.from({length:4},(_,i)=>s.makeUnit('ally','soldier',point(80,35+i,0)));s.officerThink(a);const orders=men.map(u=>({owner:u.officerID,goal:{...u.orderGoal}}));s.officerThink(b);
 men.forEach((u,i)=>{assert.equal(u.officerID,a.id);assert.deepEqual(u.orderGoal,orders[i].goal);});
});

test('Officers reinforce an attacked adjacent floor while keeping a local guard',()=>{
 const s=isolated(),o=s.makeUnit('ally','officer',point(80,72,2));o.name='UPPER OFFICER';
 const men=Array.from({length:6},(_,i)=>s.makeUnit('ally','soldier',point(80,73+i,2)));
 for(let i=0;i<7;i++)s.makeUnit('enemy','rifleman',point(96+i%2,73+Math.floor(i/2),3));s.officerThink(o);assert.equal(o.currentOrder,'HOLD_POSITION','An unreported adjacent-floor enemy is not magically known');const observer=s.makeUnit('ally','soldier',point(96,72,3));for(const e of s.units.filter(u=>u.team==='enemy'))spotUnit(s,observer,e);o.orderUntil=0;s.officerThink(o);
 assert.equal(o.currentOrder,'REINFORCE_ZONE');const sent=men.filter(u=>u.officerID===o.id&&u.currentOrder==='REINFORCE_ZONE');assert.ok(sent.length>0&&sent.length<men.length);assert.ok(sent.every(u=>u.orderGoal.floor===3));assert.equal(o.orderGoal.floor,2);
 assert.ok(sent.every(u=>canStand(s.floor(3),u.orderGoal.x,u.orderGoal.y,u.radius)));
 // Renew the travelling detachment outside 700 px even after its shared contact expires.
 for(const u of sent)Object.assign(u,point(114,80,2));s.time=16;s.officerThink(o);assert.equal(o.currentOrder,'REINFORCE_ZONE');assert.ok(sent.every(u=>u.orderUntil>=36));
});

test('A retreat order moves away from a visible hostile; hold orders prevent chasing',()=>{
 const s=isolated(),a=s.makeUnit('ally','soldier',point(80,33,0)),e=s.makeUnit('enemy','heavy',point(80,39,0));e.health=1000;e.maxHealth=1000;e.nextThink=Infinity;e.shotCooldown=Infinity;e.speed=0;
 s.spatial.build(s.units);s.think(a);assert.equal(a.target,e.id);assert.equal(a.goal,null);
 a.currentOrder='RETREAT';a.orderUntil=30;a.orderGoal=point(80,75,0);s.think(a);assert.equal(a.state,'RETREAT');assert.equal(a.goal.y,a.orderGoal.y);const distance=dist(a,a.orderGoal);run(s,2);assert.ok(dist(a,a.orderGoal)<distance);
});

import {RANKS,rankOf,applyPlayerRank,killXP,canCommand} from '../lib/facility/ranks.mjs';
import {RADIUS} from '../lib/facility/commands.mjs';
import {randomDelay,commandEnemyOfficer,spawnHostiles,ENEMY_LIMIT} from '../lib/facility/director.mjs';
import {faceVertical,readControls} from '../lib/facility/controls.mjs';
function commandScene(rank=29){const s=new Simulation();s.units=[s.player];s.status='running';s.directEvents=()=>{};s.player.xp=RANKS[rank].xp;applyPlayerRank(s.player,true);Object.assign(s.player,point(80,34,0));return s;}

test('30 XP thresholds promote automatically, reward threat, change stats and never credit NPC/friendly/repeated deaths',()=>{
 assert.equal(RANKS.length,30);for(let i=1;i<30;i++){assert.ok(RANKS[i].xp>RANKS[i-1].xp);assert.ok(RANKS[i].cost>=(RANKS[i-1].cost));assert.ok(RANKS[i].maxHealth>RANKS[i-1].maxHealth);assert.ok(RANKS[i].speed>RANKS[i-1].speed);assert.ok(RANKS[i].tier>=RANKS[i-1].tier);}
 const s=commandScene(0),weak=s.makeUnit('enemy','rifleman',point(80,23,0)),heavy=s.makeUnit('enemy','heavy',point(80,22,0)),medic=s.makeUnit('enemy','medic',point(80,20,0));weak.rank=0;assert.ok(killXP(heavy)>killXP(weak));const value=killXP(heavy);s.kill(heavy,s.player);assert.equal(s.player.xp,value);assert.ok(s.player.rank>0);assert.ok(s.player.maxHealth>100);assert.ok(s.player.speed>205);assert.ok(s.promotion);assert.equal(s.xpEvents.length,1);s.kill(heavy,s.player);assert.equal(s.player.xp,value);
 s.kill(medic,s.makeUnit('ally','soldier',point(80,28,0)));assert.equal(s.player.xp,value);const ally=s.makeUnit('ally','soldier',point(80,27,0));s.kill(ally,s.player);assert.equal(s.player.xp,value);
});

test('Death demotes exactly two levels, subtracts XP once and leaves the battle live until supply choice',()=>{
 const s=commandScene(12);s.player.xp+=25;const old=s.player.xp;s.kill(s.player,null);assert.equal(s.player.rank,10);assert.ok(s.player.xp<old);const xp=s.player.xp;s.kill(s.player,null);assert.equal(s.player.xp,xp);run(s,6);assert.equal(s.status,'running');assert.equal(s.player.health,0);assert.equal(s.respawn('fake'),false);const chosen=s.floor(-1).supplies[1];assert.equal(s.respawn(chosen.id),true);assert.equal(s.player.floor,chosen.floor);assert.equal(s.player.x,chosen.x);assert.equal(s.player.y,chosen.y);assert.equal(s.player.health,RANKS[10].maxHealth);assert.equal(s.player.rank,10);
 const fresh=new Simulation();assert.equal(fresh.player.rank,0);assert.equal(fresh.player.xp,0);assert.equal(fresh.player.floor,0);assert.equal(fresh.floor(ROOF_FLOOR).supplies.length,0);
});

test('Circle and Ctrl-style selection enforce strict rank and higher-commander priority',()=>{
 const s=commandScene(12),near=s.makeUnit('ally','soldier',point(80,36,0)),far=s.makeUnit('ally','soldier',point(80,75,0)),peer=s.makeUnit('ally','officer',point(80,35,0)),higher=s.makeUnit('ally','officer',point(80,37,0));near.rank=1;far.rank=2;peer.rank=12;higher.rank=20;
 assert.equal(s.command('HOLD_POSITION').count,1);assert.equal(near.officerID,s.player.id);assert.equal(peer.officerID,null);assert.equal(higher.officerID,null);assert.equal(canCommand(peer,s.player),false);assert.equal(canCommand(higher,s.player),true);
 s.selectUnit(far.id);s.selectUnit(near.id,true);assert.equal(s.command('DEFEND_CORE').count,2);assert.equal(far.orderGoal.floor,-2);assert.equal(near.currentOrder,'DEFEND_CORE');assert.equal(s.selectedIDs.size,2);
 s.selectUnit(near.id,true);assert.equal(s.selectedIDs.size,1);s.command('NORMAL');assert.equal(far.currentOrder,'NORMAL');assert.equal(far.officerID,null);assert.equal(near.currentOrder,'DEFEND_CORE');
 s.setCommandRadius(10000);assert.equal(s.commandRadius,RADIUS.max);s.setCommandRadius(0);assert.equal(s.commandRadius,RADIUS.min);
 near.officerID=higher.id;near.orderUntil=Infinity;s.selectUnit(near.id);assert.equal(s.command('HOLD_POSITION').count,0);
});

test('NPC superior may command a subordinate officer and player, never equal/higher grades',()=>{
 const s=commandScene(0),o=s.makeUnit('ally','officer',point(80,34,0)),junior=s.makeUnit('ally','officer',point(80,35,0)),peer=s.makeUnit('ally','officer',point(80,36,0));o.rank=25;junior.rank=20;peer.rank=25;s.officerThink(o);assert.equal(junior.officerID,o.id);assert.equal(peer.officerID,null);assert.equal(s.officerOrder.commanderID,o.id);const prior=junior.currentOrder;s.officerThink(junior);assert.equal(junior.currentOrder,prior);
 s.player.xp=RANKS[29].xp;applyPlayerRank(s.player,true);s.officerOrder=null;o.orderUntil=0;o.orderSerial=0;s.officerThink(o);assert.equal(s.officerOrder,null);
});

test('Follow tracks player across floors; hold stays; room/Core commands traverse actual connectors',()=>{
 const s=commandScene(),u=s.makeUnit('ally','soldier',point(80,35,0));u.rank=1;s.selectUnit(u.id);s.command('FOLLOW_OFFICER');Object.assign(s.player,{x:CONNECTORS[3].x,y:CONNECTORS[3].y+100,floor:1});run(s,100,()=>u.floor===1&&!u.transit&&dist(u,s.player)<220);assert.equal(u.floor,1);assert.ok(dist(u,s.player)<220);assert.ok(s.metrics.floorChanges>0);
 s.command('HOLD_POSITION');const hold={...u.orderGoal};Object.assign(s.player,point(80,85,1));run(s,12);assert.ok(dist(u,hold)<90);assert.equal(u.currentOrder,'HOLD_POSITION');
 assert.equal(s.command('DEFEND_ZONE',{floor:2,index:15}).count,1);run(s,160,()=>u.floor===2&&dist(u,u.orderGoal)<90);assert.equal(u.floor,2);assert.ok(dist(u,u.orderGoal)<90);const r=s.floor(2).rooms[15];assert.ok(u.x>r.x&&u.x<r.x+r.w&&u.y>r.y&&u.y<r.y+r.h);
 s.command('DEFEND_CORE');run(s,200,()=>u.floor===-2&&dist(u,CORE)<200);assert.equal(u.floor,-2);assert.ok(dist(u,CORE)<200);assert.equal(u.currentOrder,'DEFEND_CORE');
});

test('Attack-nearest engages a detected hostile; unordered allies automatically defend Core',()=>{
 const s=commandScene(),u=s.makeUnit('ally','soldier',point(80,35,0)),e=s.makeUnit('enemy','rifleman',point(80,19,0));u.rank=1;e.seenAt=s.time;e.nextThink=Infinity;e.shotCooldown=Infinity;e.speed=0;s.selectUnit(u.id);assert.equal(s.command('ATTACK_NEAREST').count,1);run(s,35,()=>e.health<=0);assert.equal(e.health,0);
 s.command('NORMAL');s.coreState='CAPTURING';s.spatial.build(s.units);s.think(u);assert.equal(u.autonomousCore,true);assert.equal(u.goal.floor,-2);s.coreState='SECURE';s.think(u);assert.equal(u.autonomousCore,false);assert.equal(u.goal?.floor??u.floor,u.homePosition.floor);
});

test('Up/down snap once and invert horizontal arrow mapping independently of AZERTY',()=>{
 const p={angle:0};faceVertical(p,'arrowdown');assert.equal(p.angle,Math.PI/2);assert.equal(readControls(new Set(['arrowleft']),{},p.turnMode).turn,1);assert.equal(readControls(new Set(['arrowright']),{},p.turnMode).turn,-1);faceVertical(p,'arrowup');assert.equal(p.angle,-Math.PI/2);assert.equal(readControls(new Set(['arrowright']),{},p.turnMode).turn,1);assert.equal(readControls(new Set(['arrowleft']),{},p.turnMode).turn,-1);
});

test('Reinforcement timers obey minute ranges; growing waves queue, allied units land only on roof',()=>{
 const s=new Simulation();s.status='running';for(let i=0;i<100;i++){const a=randomDelay(s,'ally'),e=randomDelay(s,'enemy');assert.ok(a>=600&&a<=1200);assert.ok(e>=300&&e<=1200);}
 assert.ok(s.nextReinforce>=600&&s.nextReinforce<=1200);assert.ok(s.nextAttack>=300&&s.nextAttack<=1200);
 const totals=[];s.nextReinforce=1e9;s.nextRelief=s.nextLevelTwo=s.nextEnemyEvent=s.nextRoofAttack=Infinity;
 for(let i=0;i<4;i++){s.units=s.units.filter(u=>u.team==='ally');const queuedBefore=s.pendingWaves.reduce((n,w)=>n+w.remaining,0);s.time=s.nextAttack;s.directEvents();const queuedAfter=s.pendingWaves.reduce((n,w)=>n+w.remaining,0),inserted=s.units.filter(u=>u.team==='enemy').length;totals.push(queuedAfter-queuedBefore+inserted);assert.ok(s.nextAttack-s.time>=300&&s.nextAttack-s.time<=1200);assert.ok(inserted<=32);}
 assert.deepEqual(totals,[128,160,192,224]);
 const before=new Set(s.units.map(u=>u.id));s.reinforce(16);const arrivals=s.units.filter(u=>!before.has(u.id));assert.equal(arrivals.length,16);assert.ok(arrivals.every(u=>u.floor===ROOF_FLOOR));assert.ok(arrivals.some(u=>u.role==='medic'));assert.ok(arrivals.some(u=>u.role==='officer'));assert.ok(arrivals.every(u=>canStand(s.floor(ROOF_FLOOR),u.x,u.y,u.radius)));assert.ok(arrivals.some(u=>u.homePosition.floor!==ROOF_FLOOR));assert.ok(arrivals.every(u=>!s.floor(u.homePosition.floor).supplies.some(p=>dist(p,u.homePosition)<220)));
});

test('Enemy squads include medics, officers and score concrete targets; healing cannot resurrect',()=>{
 const s=isolated();spawnHostiles(s,'charlie',8);const enemies=s.units.filter(u=>u.team==='enemy'),o=enemies.find(u=>u.role==='officer'),m=enemies.find(u=>u.role==='medic');assert.ok(o&&m);assert.deepEqual(o.route.map(p=>p.floor),[5,4,3,2,1,0,-1,-2]);commandEnemyOfficer(s,o);assert.ok(enemies.some(u=>u.officerID===o.id));assert.ok(enemies.filter(u=>u.officerID===o.id).every(u=>u.rank<o.rank));
 const soldier=enemies.find(u=>u.role==='rifleman');Object.assign(soldier,{x:m.x+30,y:m.y,health:20});const dead=s.makeUnit('enemy','rifleman',{x:m.x+25,y:m.y,floor:m.floor});dead.health=0;dead.state='DEAD';s.spatial.build(s.units);s.tick(.1);assert.ok(soldier.health>20);assert.equal(dead.health,0);
});
