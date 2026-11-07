import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../lib/facility/simulation.mjs';
import {ROOF_FLOOR,canStand,WIDTH,HEIGHT} from '../lib/facility/map.mjs';
import {majorWavePlan} from '../lib/facility/reinforcement-plans.mjs';
import {directEvents,spawnHostiles,ENEMY_LIMIT} from '../lib/facility/director.mjs';
import {scheduleAirlift,updateAirlift,updateAirPassenger,airliftSound} from '../lib/facility/airlift.mjs';
import {AIRLIFT_CAPACITY,helicopterPose,airframeBlocksGround} from '../lib/facility/airlift-geometry.mjs';
import {RenderResources,PartBatch} from '../lib/facility/models3d.mjs';
import {drawHelicopter3D} from '../lib/facility/helicopter3d.mjs';
import {updateWaveStatus} from '../lib/facility/wave-status.mjs';
import {AudioSystem} from '../lib/facility/audio.mjs';
function scene(){const s=new Simulation({seed:731});s.units=[s.player];s.status='running';s.nextRoofAttack=s.nextAttack=s.nextReinforce=s.nextEnemyEvent=s.nextLevelTwo=Infinity;s.directEvents=()=>{};return s;}
function prepare(s,count=4){const plan=majorWavePlan(1,()=>.2),squads=plan.squads.filter(q=>q.route==='charlie'&&q.floor===undefined).slice(0,count);plan.squads=squads;plan.total=plan.remaining=squads.reduce((n,q)=>n+q.roles.length,0);s.pendingWaves=[plan];s.activeMajorWaves=[{number:1,total:plan.total,inserted:0,landed:false}];return plan;}
function step(s,seconds,passengers=true){for(let i=0;i<Math.ceil(seconds*30);i++){s.time+=1/30;updateAirlift(s,1/30,spawnHostiles);if(passengers)for(const u of s.units)if(u.health>0&&u.airInsertion)updateAirPassenger(s,u,1/30);}}
function until(s,predicate,limit=180){for(let i=0;i<limit*30&&!predicate();i++)step(s,1/30);assert.ok(predicate(),'requested transport state');}

test('A major roof assault is reserved inside one aircraft, with no instant rooftop spawn or duplicate booking',()=>{
 const s=scene(),plan=prepare(s,5);assert.ok(scheduleAirlift(s));const f=s.airlift.flight;
 assert.equal(f.total,AIRLIFT_CAPACITY);assert.equal(s.airlift.reserved,32);assert.equal(plan.remaining,40);assert.equal(s.units.length,1);assert.equal(scheduleAirlift(s),false);
 for(let i=0;i<20;i++)directEvents(s);assert.equal(s.airlift.flight.id,f.id);assert.equal(s.units.length,1);assert.equal(new Set(f.squads.map(q=>q.transportSquadID)).size,4);
});

test('The helicopter continuously approaches from outside the building and lands before opening',()=>{
 const s=scene();prepare(s);scheduleAirlift(s);const f=s.airlift.flight,start=helicopterPose(f,s.time);
 assert.ok(Math.hypot(start.x-f.pad.x,start.y-f.pad.y)>10000);assert.ok(start.height>60);
 let previous=start;
 for(let i=0;i<23*30;i++){step(s,1/30);const p=helicopterPose(f,s.time);assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y)<60);assert.ok(p.height<=previous.height+.001);assert.equal(p.door,0);previous=p;}
 assert.equal(s.units.length,1);until(s,()=>f.phase==='OPENING');const p=helicopterPose(f,s.time);assert.equal(p.height,0);assert.equal(p.x,f.pad.x);assert.equal(p.y,f.pad.y);assert.equal(p.door,0);assert.equal(s.units.length,1);
});

test('Creating and removing a flight happens beyond FPS view range from every roof corner',()=>{
 const s=scene();prepare(s,1);scheduleAirlift(s);const f=s.airlift.flight,start=helicopterPose(f,s.time);f.phase='DEPARTING';f.phaseAt=s.time-20;const end=helicopterPose(f,s.time);
 for(const p of [start,end])for(const x of [0,WIDTH])for(const y of [0,HEIGHT])assert.ok(Math.hypot((p.x-x)/32,(p.y-y)/32,p.height)>430,'outside the camera far plane for every roof observer');
});

test('An occupied pad makes the aircraft hover, and NPCs clear it using physical movement',()=>{
 const s=scene();prepare(s);scheduleAirlift(s);const f=s.airlift.flight;Object.assign(s.player,{...f.pad});step(s,26);
 assert.equal(f.phase,'HOLDING');assert.equal(helicopterPose(f,s.time).height,12);assert.equal(s.airlift.reserved,32);
 s.player.x+=600;const u=s.makeUnit('ally','soldier',f.pad);Object.assign(u,f.pad);const oldX=u.x;step(s,2);assert.notEqual(u.x,oldX);until(s,()=>f.phase==='LANDING');assert.ok(Math.abs(u.x-f.pad.x)>=100);
});

test('Soldiers walk down the open ramp one by one, keep squad hierarchy and are counted exactly once',()=>{
 const s=scene(),plan=prepare(s);scheduleAirlift(s);const f=s.airlift.flight;
 until(s,()=>f.delivered===1);const first=s.units.find(u=>u.team==='enemy');assert.equal(first.state,'DISEMBARK');assert.ok(first.airHeight>.8);assert.equal(plan.remaining,31);assert.equal(s.airlift.reserved,31);
 const firstY=first.y;step(s,.4);assert.ok(first.y>firstY);assert.equal(f.delivered,1);assert.ok(first.airHeight<1.06);
 until(s,()=>f.phase==='CLOSING');const enemies=s.units.filter(u=>u.team==='enemy');assert.equal(enemies.length,32);assert.equal(f.delivered,32);assert.equal(s.airlift.reserved,0);assert.equal(s.pendingWaves.length,0);assert.equal(s.activeMajorWaves[0].inserted,32);assert.equal(s.wavesReceived,1);
 for(const u of enemies){assert.equal(u.airInsertion,null);assert.equal(u.airHeight,0);assert.equal(u.floor,ROOF_FLOOR);assert.ok(canStand(s.floor(ROOF_FLOOR),u.x,u.y,u.radius));if(u.role!=='officer')assert.ok(enemies.some(o=>o.id===u.officerID&&o.squadID===u.squadID&&o.role==='officer'));}
 step(s,3);assert.equal(s.units.filter(u=>u.team==='enemy').length,32);
});

test('The transport cannot leave with a living passenger still on the ramp and a blocked exit waits without duplicating troops',()=>{
 const s=scene();prepare(s,1);scheduleAirlift(s);const f=s.airlift.flight;until(s,()=>f.phase==='UNLOADING');
 const blocker=s.makeUnit('ally','soldier',{x:f.pad.x,y:f.pad.y+225,floor:ROOF_FLOOR});Object.assign(blocker,{x:f.pad.x,y:f.pad.y+225});step(s,5);assert.equal(f.delivered,0);blocker.health=0;
 until(s,()=>f.delivered===1);const soldier=s.units.find(u=>u.team==='enemy');soldier.health=0;until(s,()=>f.phase==='CLOSING');assert.equal(f.delivered,8);assert.equal(s.units.filter(u=>u.team==='enemy').length,8);
});

test('Flight reservations respect population limits across other fronts, and pending air passengers prevent premature victory',()=>{
 const s=scene();prepare(s);for(let i=0;i<ENEMY_LIMIT-8;i++)s.makeUnit('enemy','soldier',{x:800+i%10*32,y:400+Math.floor(i/10)*32,floor:2});
 assert.ok(scheduleAirlift(s));assert.equal(s.airlift.reserved,8);assert.equal(spawnHostiles(s,'alpha',1),0);assert.equal(s.units.filter(u=>u.team==='enemy').length+s.airlift.reserved,ENEMY_LIMIT);
 const wave=s.activeMajorWaves[0];wave.landed=true;for(const u of s.units)if(u.team==='enemy')u.health=0;updateWaveStatus(s);assert.equal(s.wavesRepelled,0);assert.equal(s.activeMajorWaves.length,1);
});

test('The grounded fuselage blocks both factions, the ramp remains passable and takeoff restores the ground',()=>{
 const s=scene();prepare(s,1);scheduleAirlift(s);const f=s.airlift.flight;until(s,()=>f.phase==='UNLOADING');const roof=s.floor(ROOF_FLOOR);
 assert.ok(airframeBlocksGround(roof,f.pad.x,f.pad.y));assert.equal(canStand(roof,f.pad.x,f.pad.y,11),false);assert.ok(canStand(roof,f.pad.x,f.pad.y+230,11));
 for(const team of ['ally','enemy']){const u=s.makeUnit(team,'soldier',{x:f.pad.x+110,y:f.pad.y,floor:ROOF_FLOOR});Object.assign(u,{x:f.pad.x+110,y:f.pad.y});s.move(u,-60,0);assert.ok(u.x>=f.pad.x+75);u.health=0;}
 until(s,()=>f.phase==='DEPARTING');assert.equal(airframeBlocksGround(roof,f.pad.x,f.pad.y),false);assert.ok(canStand(roof,f.pad.x,f.pad.y,11));
 const p=helicopterPose(f,s.time);step(s,10);assert.ok(helicopterPose(f,s.time).height>p.height);until(s,()=>!s.airlift.flight);assert.equal(s.airlift.reserved,0);
});

test('All scheduled roof troops arrive over multiple rotations without changing the major wave total',()=>{
 const s=scene(),plan=prepare(s,5);let delivered=0,flights=0;
 while(plan.remaining){assert.ok(scheduleAirlift(s));flights++;const f=s.airlift.flight;until(s,()=>!s.airlift.flight);delivered+=f.delivered;for(const u of s.units)if(u.team==='enemy')u.health=0;}
 assert.equal(flights,2);assert.equal(delivered,40);assert.equal(s.activeMajorWaves[0].inserted,40);assert.equal(s.wavesReceived,1);updateWaveStatus(s);assert.equal(s.wavesRepelled,1);
});

test('Rendering every flight phase is finite, detailed, repeatable and cannot advance the simulation',()=>{
 const s=scene();prepare(s);scheduleAirlift(s);const f=s.airlift.flight,r=new RenderResources(),b=new PartBatch(r,2048);
 for(const phase of ['APPROACH','HOLDING','LANDING','OPENING','UNLOADING','CLOSING','LIFTOFF','DEPARTING']){
  f.phase=phase;f.phaseAt=s.time-1;const before=JSON.stringify(s.airlift);b.reset();drawHelicopter3D(b,s.airlift,s.time);b.finish();assert.equal(JSON.stringify(s.airlift),before);let count=0;
  for(const {mesh} of b.bins.values()){count+=mesh.count;for(let i=0;i<mesh.count*16;i++)assert.ok(Number.isFinite(mesh.instanceMatrix.array[i]));}
  assert.ok(count>180);assert.equal(b.root,null);
 }
 const before=s.units.length;Object.assign(s.player,f.pad);assert.ok(airliftSound(s)>0);s.player.floor=0;assert.equal(airliftSound(s),0);assert.equal(s.units.length,before);b.dispose();r.dispose();
});

test('A stunned or frozen disembarking soldier stays on the ramp until the effect expires',()=>{
 const s=scene();prepare(s,1);scheduleAirlift(s);until(s,()=>s.airlift.flight.delivered===1);const u=s.units.find(u=>u.team==='enemy'),before={x:u.x,y:u.y,height:u.airHeight};
 s.enemyFreezeUntil=s.time+2;s.tick(.1);assert.deepEqual({x:u.x,y:u.y,height:u.airHeight},before);
 s.enemyFreezeUntil=0;u.stunnedUntil=s.time+2;s.tick(.1);assert.deepEqual({x:u.x,y:u.y,height:u.airHeight},before);
 u.stunnedUntil=0;s.tick(.1);assert.ok(u.y>before.y);assert.equal(s.airlift.flight.delivered,1);
});

test('The rotor audio loop is reused, silences on pause and releases its nodes when the mission resets',()=>{
 let allocated=0,stopped=0;
 const param=()=>({value:0,setTargetAtTime(v){this.value=v;}}),node=()=>({gain:param(),frequency:param(),connect(){},disconnect(){},start(){},stop(){stopped++;}});
 const context={currentTime:0,createGain:node,createBiquadFilter:node,createOscillator(){allocated++;return node();}};
 const audio=Object.assign(Object.create(AudioSystem.prototype),{context,enabled:true,sfx:node(),nodes:new Set(),scene:{playing:true,rotor:.2}});
 for(let i=0;i<120;i++)audio.updateRotor();assert.equal(allocated,3);assert.ok(audio.rotor.bus.gain.value>0);
 audio.scene.playing=false;audio.updateRotor();assert.equal(audio.rotor.bus.gain.value,0);assert.equal(audio.rotor.mod.gain.value,0);
 audio.reset();assert.equal(stopped,3);assert.equal(audio.rotor,null);assert.equal(audio.nodes.size,0);
});

test('Repeated helicopter rendering reuses GPU buffers and materials instead of accumulating models',()=>{
 const s=scene();prepare(s,1);scheduleAirlift(s);const f=s.airlift.flight,r=new RenderResources(),b=new PartBatch(r,2048);f.phase='UNLOADING';
 b.reset();drawHelicopter3D(b,s.airlift,s.time);b.finish();const bins=b.bins.size,materials=r.materials.size,geometry=Object.keys(r.geometries).length;
 for(let i=1;i<=120;i++){b.reset();drawHelicopter3D(b,s.airlift,i/60);b.finish();assert.equal(b.bins.size,bins);assert.equal(r.materials.size,materials);assert.equal(Object.keys(r.geometries).length,geometry);}
 assert.equal(s.units.length,1);assert.equal(f.delivered,0);b.dispose();r.dispose();
});
