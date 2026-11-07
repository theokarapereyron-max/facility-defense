import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {ROOF_FLOOR,point,dist,canStand} from '../lib/facility/map.mjs';
import {directEvents,ENEMY_LIMIT,ROOF_ACTIVE_LIMIT,spawnHostiles} from '../lib/facility/director.mjs';
import {updateAirlift,updateAirPassenger} from '../lib/facility/airlift.mjs';
import {roofPlan,majorWavePlan} from '../lib/facility/reinforcement-plans.mjs';

function scene(){const s=new Simulation();s.units=[s.player];s.status='running';s.nextLevelTwo=s.nextEnemyEvent=s.nextAttack=s.nextReinforce=Infinity;return s;}
function flightTick(s){s.time+=1/30;updateAirlift(s,1/30,spawnHostiles);for(const u of s.units)if(u.health>0&&u.airInsertion)updateAirPassenger(s,u,1/30);}
function finishWaves(s,collect=()=>{}){for(let i=0;i<18000&&s.pendingWaves.length;i++){flightTick(s);if(i%90===0){directEvents(s);collect();}}collect();assert.equal(s.pendingWaves.length,0);}
const enemies=s=>s.units.filter(u=>u.team==='enemy'&&u.health>0);

test('The regular helipad squad always contains four riflemen, one officer and one medic at separate legal positions',()=>{
 for(const seed of [1,42,14812]){
  const s=scene();s.seed=seed;s.time=30;directEvents(s);const units=enemies(s),pad=s.floor(ROOF_FLOOR).rooms[10];
  assert.equal(units.length,6);assert.equal(units.filter(u=>u.role==='officer').length,1);assert.equal(units.filter(u=>u.role==='rifleman').length,4);assert.equal(units.filter(u=>u.role==='medic').length,1);
  assert.equal(roofPlan().remaining,6);assert.equal(new Set(units.map(u=>u.squadID)).size,1);assert.ok(units.every(u=>u.floor===ROOF_FLOOR&&u.reinforcementKind==='roof'&&canStand(s.floor(ROOF_FLOOR),u.x,u.y,u.radius)&&u.x>pad.x&&u.x<pad.x+pad.w&&u.y>pad.y&&u.y<pad.y+pad.h));
  for(const u of units){assert.ok(units.every(v=>u===v||dist(u,v)>=25));if(u.role!=='officer'){const leader=units.find(a=>a.id===u.officerID);assert.ok(leader&&leader.rank>u.rank&&leader.squadID===u.squadID);assert.equal(u.currentOrder,u.technicalMission?'ASSAULT_ZONE':'ATTACK_CORE');}}
  assert.equal(s.pendingRoof.length,0);
 }
});

test('Roof clock repeats every 30 mission seconds without exposing countdowns or resetting the major wave',()=>{
 const s=scene();s.nextAttack=600;s.random=()=>.15;
 for(const [time,expected] of [[29.9,0],[30,6],[30.5,6],[59.9,6],[60,12],[90,18]]){s.time=time;directEvents(s);assert.equal(enemies(s).length,expected);assert.equal(s.nextAttack,600);}
 const snapshot=s.snapshot();assert.ok(!('nextRoofAttack' in snapshot));assert.ok(!('nextAttack' in snapshot));
 s.time=120;s.nextAttack=120;directEvents(s);assert.ok(enemies(s).some(u=>u.reinforcementKind==='major'));assert.equal(enemies(s).filter(u=>u.reinforcementKind==='roof').length,24);assert.equal(s.director.attackIndex,1);assert.equal(s.nextRoofAttack,150);assert.equal(s.snapshot().majorAssault,true);
});

test('Massive waves grow, attack three fronts and retain elite support roles and real insertion',()=>{
 for(let number=1;number<=5;number++){
  const p=majorWavePlan(number,()=>.2);assert.equal(p.total,96+32*number);assert.equal(p.remaining,p.squads.reduce((n,s)=>n+s.roles.length,0));
  assert.ok(p.squads.filter(s=>s.route==='charlie'&&!s.elite).length/p.squads.length>=.6);assert.ok(p.squads.some(s=>s.route!=='charlie'));assert.ok(p.squads.filter(s=>s.elite).length>=2);
  assert.ok(p.squads.every(s=>s.roles[0]==='officer'&&s.roles.includes('medic')));
 }
 const s=scene();s.nextRoofAttack=Infinity;s.time=s.nextAttack=300;s.random=()=>.2;
 directEvents(s);assert.equal(enemies(s).length,32);assert.ok(enemies(s).some(u=>u.elite&&u.floor===-1));assert.equal(enemies(s).filter(u=>u.floor===ROOF_FLOOR).length,0);assert.ok(s.airlift.flight);assert.ok(enemies(s).some(u=>u.floor===0));
 for(const u of enemies(s).filter(u=>u.elite)){assert.ok(u.maxHealth>100+u.rank*2);assert.ok(u.floor!==s.player.floor||dist(u,s.player)>=600);}
 finishWaves(s);
 assert.equal(enemies(s).length,128);assert.equal(s.pendingWaves.length,0);assert.equal(s.metrics.enemyOrders,0); // No fake event-only troops: AI takes over on tick.
 s.spatial.build(s.units);s.tick(1/30);assert.ok(s.metrics.enemyOrders>0);assert.ok(enemies(s).some(u=>u.goal));
});

test('Capacity keeps whole squads queued, reserves mass-assault headroom and loses no reinforcements',()=>{
 const s=scene();s.random=()=>.15;
 for(let i=0;i<ROOF_ACTIVE_LIMIT;i++)s.makeUnit('enemy','rifleman',point(20+i%20,15+Math.floor(i/20),2));
 s.time=30;directEvents(s);assert.equal(enemies(s).length,ROOF_ACTIVE_LIMIT);assert.equal(s.pendingRoof[0].remaining,6);
 s.nextAttack=30;directEvents(s);assert.ok(enemies(s).length>ROOF_ACTIVE_LIMIT);assert.ok(enemies(s).length<=ENEMY_LIMIT);
 const count=enemies(s).filter(u=>u.reinforcementKind==='major').length;assert.equal(count+s.pendingWaves[0].remaining,128);
 s.units=s.units.filter(u=>u.team==='ally');s.nextRoofAttack=Infinity;let delivered=count;
 finishWaves(s,()=>{delivered+=enemies(s).filter(u=>u.reinforcementKind==='major').length;s.units=s.units.filter(u=>u.team==='ally');});
 assert.equal(delivered,128);assert.equal(s.pendingRoof.length,0);
 const full=scene();full.nextRoofAttack=Infinity;for(let i=0;i<ENEMY_LIMIT;i++)full.makeUnit('enemy','rifleman',point(20+i%20,15+Math.floor(i/20),2));full.time=full.nextAttack=300;directEvents(full);assert.equal(enemies(full).length,ENEMY_LIMIT);assert.equal(full.pendingWaves[0].remaining,128);
});

test('A guarded interior cannot receive an elite spawn underneath defenders',()=>{
 const s=scene();for(const z of s.floor(1).zones)s.makeUnit('ally','soldier',z);
 const roles=majorWavePlan(1,()=>.6).squads.find(s=>s.elite).roles;
 assert.equal(spawnHostiles(s,'charlie',8,1,{roles,elite:true}),0);assert.equal(enemies(s).length,0);
 // Other fronts keep operating when this insertion is unavailable.
 s.pendingWaves=[{number:1,total:16,remaining:16,resuppliedFloors:[],squads:[{route:'charlie',roles,floor:1,elite:true,index:0},{route:'charlie',roles,index:1}]}];s.time=3;directEvents(s);assert.equal(enemies(s).length,0);assert.equal(s.pendingWaves[0].remaining,16);assert.equal(s.airlift.flight.total,8);for(let i=0;i<1800;i++)flightTick(s);assert.equal(enemies(s).length,8);assert.ok(enemies(s).every(u=>u.floor===ROOF_FLOOR));
});
