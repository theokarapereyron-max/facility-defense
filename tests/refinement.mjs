import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {Game,sanitizeSettings} from '../lib/facility/engine.mjs';
import {readControls} from '../lib/facility/controls.mjs';
import {clearFireLane,combatPosition} from '../lib/facility/combat-tactics.mjs';
import {fieldIntel} from '../lib/facility/field-intel.mjs';
import {preservesCirculation} from '../lib/facility/placement.mjs';
import {canStand,nearestWalkable,COLS,ROWS,CORE} from '../lib/facility/map.mjs';
import {Renderer} from '../lib/facility/renderer.mjs';

function scene(){const s=new Simulation({seed:731});s.status='running';s.units=[s.player];s.directEvents=()=>{};return s;}
test('Placement rejects a partition that cuts a room in two',()=>{
 const f={cols:7,grid:new Uint8Array(7*5)},r={x:0,y:0,w:7*32,h:5*32};const cut=Array.from({length:5},(_,i)=>i*7+3);assert.equal(preservesCirculation(f,r,cut),false);assert.equal(preservesCirculation(f,r,[8,9]),true);
});
test('Fire-lane discipline ignores opponents but prevents firing through a friendly soldier',()=>{
 const s=scene(),u=s.makeUnit('ally','soldier',{x:2528,y:1808,floor:0}),e=s.makeUnit('enemy','soldier',{x:2784,y:1808,floor:0}),a=s.makeUnit('ally','soldier',{x:2624,y:1808,floor:0});Object.assign(u,{x:2528,y:1808});Object.assign(e,{x:2784,y:1808});Object.assign(a,{x:2624,y:1808});s.spatial.build(s.units);assert.equal(clearFireLane(s,u,e),false);a.y+=80;s.spatial.build(s.units);assert.equal(clearFireLane(s,u,e),true);
});
test('A blocked soldier finds a clear lateral position without abandoning a defensive anchor',()=>{
 const s=scene(),u=s.makeUnit('ally','soldier',{x:2528,y:1104,floor:0}),a=s.makeUnit('ally','soldier',{x:2592,y:1104,floor:0}),e=s.makeUnit('enemy','soldier',{x:2784,y:1104,floor:0});Object.assign(u,{x:2528,y:1104});Object.assign(a,{x:2592,y:1104});Object.assign(e,{x:2784,y:1104});s.spatial.build(s.units);const goal=combatPosition(s,u,e,u.homePosition);assert.ok(goal);assert.ok(canStand(s.floor(0),goal.x,goal.y,u.radius));assert.ok(Math.hypot(goal.x-u.homePosition.x,goal.y-u.homePosition.y)<=180);assert.ok(clearFireLane(s,{...u,...goal},e));u.currentOrder='HOLD_AT_ALL_COSTS';assert.equal(combatPosition(s,u,e,u.homePosition),null);
});
test('Field priorities react to low health and a Core emergency without unseen live targets',()=>{
 const s=scene();s.player.health=20;assert.equal(fieldIntel(s).objective.kind,'medical');s.player.health=s.player.maxHealth;s.coreState='CAPTURING';assert.deepEqual({...fieldIntel(s).objective,x:CORE.x,y:CORE.y}.floor,-2);assert.equal(fieldIntel(s).objective.kind,'danger');
});
test('Held touch input supplies continuous fire and repair without keyboard input',()=>{const i=readControls(new Set(),{fire:true,angle:.9,interact:true});assert.equal(i.fire,true);assert.equal(i.interact,true);assert.equal(i.angle,.9);});
test('Mouse fire and mouse aiming reach every simulation tick; disabled input cannot leak a shot',()=>{
 const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>1;try{
  const calls=[],game={alive:true,last:1000,accumulator:0,paused:false,inputEnabled:true,priorityMenuOpen:false,keys:new Set(),touch:{},fire:true,fireQueued:false,settings:{mouseAim:true},mouseActive:true,mouse:{x:10,y:20},renderer:{screenToWorld:()=>({x:100,y:0}),render:()=>{}},sim:{status:'running',player:{x:0,y:0,turnMode:'up'},tick:(dt,input)=>calls.push({...input})},uiTimer:-100,loop:()=>{}};
  Game.prototype.loop.call(game,1070);assert.equal(calls.length,2);assert.ok(calls.every(i=>i.fire&&i.angle===0));game.inputEnabled=false;Game.prototype.loop.call(game,1140);assert.ok(calls.slice(2).every(i=>!i.fire&&i.angle===undefined));
 }finally{globalThis.requestAnimationFrame=previous;}
});
test('A repair button release clears all continuous inputs',()=>{const g={keys:new Set(['e',' ']),fire:true,fireQueued:true,mouseActive:true,touch:{fire:true,interact:true}};Game.prototype.clearInput.call(g);assert.equal(g.fire,false);assert.equal(g.mouseActive,false);assert.equal(g.keys.size,0);assert.ok(!g.touch.fire&&!g.touch.interact);});
test('Combat decals are bounded and expire; a death clears a consecutive kill commendation',()=>{
 const s=scene();s.decals=Array.from({length:400},()=>({until:100}));s.tick(1/30);assert.ok(s.decals.length<=260);s.decals=[{until:0}];s.tick(1/30);assert.equal(s.decals.length,0);s.combatStreak=5;s.commendation={time:s.time,label:'test'};s.kill(s.player);assert.equal(s.combatStreak,0);assert.equal(s.commendation,null);
});
// A strict Canvas contract detects invalid geometry and unmatched save/restore
// on all floors. It verifies execution, not browser rasterisation or CSS layout.
test('The renderer executes all floors, maps and effects with finite geometry',()=>{
 const old={document:globalThis.document,window:globalThis.window,ResizeObserver:globalThis.ResizeObserver};let count=0;
 function canvas(){let depth=0;const target={measureText:t=>({width:String(t).length*7}),createRadialGradient:()=>({addColorStop:()=>{}}),createLinearGradient:()=>({addColorStop:()=>{}}),save:()=>depth++,restore:()=>{assert.ok(depth>0);depth--;}};const c=new Proxy(target,{get:(o,k)=>k in o?o[k]:(...args)=>{count++;for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(k));},set:(o,k,v)=>{o[k]=v;return true;}});return {width:1280,height:800,getContext:()=>c,getBoundingClientRect:()=>({width:1280,height:800}),depth:()=>depth};}
 globalThis.document={createElement:()=>canvas()};globalThis.window={devicePixelRatio:2};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
 try{const s=scene(),out=canvas(),renderer=new Renderer(out,s);renderer.debug=true;s.player.health=25;s.effects=[{x:2500,y:1800,floor:0,type:'explosion',life:.6,max:1},{x:2500,y:1800,floor:0,type:'xp',amount:5,life:.6,max:1}];s.fields=[{x:2500,y:1800,floor:0,type:'smoke',radius:110,until:100},{x:2400,y:1800,floor:0,type:'fire',radius:80,until:100}];
  for(const f of s.floors){Object.assign(s.player,nearestWalkable(f,2528,1808));renderer.waypoint={...CORE};renderer.render(.03);assert.equal(out.depth(),0);renderer.drawMap(canvas(),f.id,true);}
  renderer.destroy();assert.ok(count>10000);
 }finally{Object.assign(globalThis,old);}
});

test('Corrupt display preferences cannot produce invalid zoom or audio values',()=>{const s=sanitizeSettings({zoom:NaN,volume:Infinity,effects:'yes',graphicsQuality:'other'});assert.equal(s.zoom,85);assert.equal(s.volume,35);assert.equal(s.effects,true);assert.equal(s.graphicsQuality,'high');assert.equal(sanitizeSettings({zoom:200}).zoom,140);});
