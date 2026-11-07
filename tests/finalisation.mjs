import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../lib/facility/engine.mjs';
import {Simulation} from '../lib/facility/simulation.mjs';
import {readControls} from '../lib/facility/controls.mjs';
import {fieldIntel} from '../lib/facility/field-intel.mjs';
import {mapContact,spotUnit} from '../lib/facility/contacts.mjs';
import {Renderer} from '../lib/facility/renderer.mjs';
import {COLS,WIDTH,HEIGHT,canStand} from '../lib/facility/map.mjs';

function scene(){const s=new Simulation({seed:731});s.units=[s.player];s.status='running';s.time=10;return s;}
function withKeyboard(run){
 const previous={window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLTextAreaElement:globalThis.HTMLTextAreaElement,HTMLSelectElement:globalThis.HTMLSelectElement};
 Object.assign(globalThis,{window:{addEventListener(){}},HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{}});
 try{const g=Object.assign(Object.create(Game.prototype),{sim:scene(),keys:new Set(),fire:false,fireQueued:false,mouseActive:false,touch:{},paused:false,inputEnabled:true,callbacks:{},audio:{unlock(){},reset(){},update(){},sound(){}},renderer:{aimScreen:null},canvas:{addEventListener(){},focus(){}}});g.bind();run(g);}
 finally{Object.assign(globalThis,previous);}
}
const button={closest:selector=>selector.includes('button')?button:null};
function key(g,key,target=button,extra={}){const e={key,code:key===' '?'Space':'',target,repeat:false,prevented:false,preventDefault(){this.prevented=true;},...extra};g.handlers.keydown(e);return e;}

test('HUD button focus preserves movement, weapon changes, map and Escape shortcuts',()=>withKeyboard(g=>{
 key(g,'z');assert.equal(readControls(g.keys).y,-1);key(g,'2');assert.equal(g.sim.player.weapon,'pistol');
 let maps=0,menus=0;g.callbacks.onMap=()=>maps++;g.callbacks.onMenu=()=>menus++;
 g.fireQueued=true;g.touch={fire:true,interact:true};key(g,'m');assert.equal(maps,1);assert.equal(g.keys.size,0);assert.equal(g.fireQueued,false);assert.ok(!g.touch.fire&&!g.touch.interact);
 key(g,'Escape');assert.equal(menus,1);
}));
test('Space and Enter retain native focused-button activation without firing',()=>withKeyboard(g=>{
 for(const k of [' ','Enter']){const e=key(g,k);assert.equal(e.prevented,false);assert.equal(g.keys.size,0);assert.equal(g.fireQueued,false);}
}));
test('Editing, slider controls and already handled dialog keys cannot trigger gameplay',()=>withKeyboard(g=>{
 for(const target of [new HTMLInputElement(),new HTMLTextAreaElement(),new HTMLSelectElement(),{closest:s=>s.includes('[role=slider]')?{}:null},{closest:s=>s.includes('[contenteditable]')?{}:null}])key(g,'z',target);
 key(g,'z',null,{defaultPrevented:true});assert.equal(g.keys.size,0);
}));
test('Opening an interaction releases held inputs before handing control to its dialog',()=>withKeyboard(g=>{
 g.fire=true;g.fireQueued=true;g.mouseActive=true;g.keys.add('e');g.touch={fire:true,interact:true};g.renderer.aimScreen={x:10,y:10};g.sim.interact=()=>({type:'tech'});
 let opened=false;g.callbacks.onInteract=()=>{opened=true;assert.equal(g.inputEnabled,false);assert.equal(g.keys.size,0);assert.equal(g.fireQueued,false);assert.ok(!g.touch.fire&&!g.touch.interact);assert.equal(g.renderer.aimScreen,null);};
 g.interact();assert.equal(opened,true);
}));
test('Mission start and focus loss discard queued shots, touch repair and mouse aim',()=>withKeyboard(g=>{
 g.sim.status='ready';g.fireQueued=true;g.mouseActive=true;g.touch={fire:true,interact:true};g.renderer.aimScreen={x:10,y:10};g.start();
 assert.equal(g.fireQueued,false);assert.equal(g.mouseActive,false);assert.ok(!g.touch.fire&&!g.touch.interact);assert.equal(g.renderer.aimScreen,null);
 g.paused=true;g.fireQueued=true;g.mouseActive=true;g.touch={fire:true,interact:true};g.handlers.blur();assert.equal(g.fireQueued,false);assert.equal(g.mouseActive,false);assert.ok(!g.touch.interact);
}));

test('Map counts and field objectives retain the reported floor through transit until expiry',()=>{
 const s=scene(),e=s.makeUnit('enemy','officer',{x:2500,y:1800,floor:0});spotUnit(s,s.player,e);const known={...e.mapContact};Object.assign(e,{x:1000,y:1000,floor:1,transit:'E1'});
 assert.deepEqual(mapContact(s,e),known);const state=s.snapshot();assert.equal(state.floors.find(f=>f.id===0).enemies,1);assert.equal(state.floors.find(f=>f.id===1).enemies,0);
 assert.equal(state.intel.contacts,1);assert.equal(state.intel.objective.kind,'contact');assert.equal(state.intel.objective.x,known.x);assert.equal(state.intel.objective.floor,0);
 s.time=known.until;assert.equal(mapContact(s,e),null);assert.equal(fieldIntel(s).contacts,0);assert.equal(s.snapshot().floors.find(f=>f.id===0).enemies,0);
});
test('A local observer without a shared map report cannot leak a contact to the HUD',()=>{
 const s=scene(),e=s.makeUnit('enemy','soldier',{x:2500,y:1800,floor:0});e.contacts={ally:{x:e.x,y:e.y,floor:0,until:20,shared:false}};assert.equal(mapContact(s,e),null);assert.equal(fieldIntel(s).contacts,0);
});
test('Reconnaissance follows visible floors but never displays live transit coordinates',()=>{
 const s=scene(),e=s.makeUnit('enemy','soldier',{x:2500,y:1800,floor:0});s.scans[0]=20;assert.equal(fieldIntel(s).contacts,1);assert.equal(fieldIntel(s).objective.kind,'contact');
 e.transit='E1';assert.equal(mapContact(s,e),null);spotUnit(s,s.player,e);const known={...e.mapContact};e.floor=1;s.scans[1]=20;assert.deepEqual(mapContact(s,e),known);
});
test('Detailed maps draw a remembered officer on the reported floor and at reported coordinates',()=>{
 const s=scene(),e=s.makeUnit('enemy','officer',{x:2500,y:1800,floor:0});spotUnit(s,s.player,e);const known={...e.mapContact};Object.assign(e,{x:1000,y:1000,floor:1,transit:'E1'});
 const markers=[],labels=[];let arc;const c=new Proxy({measureText:t=>({width:String(t).length*5}),arc:(x,y,r)=>{arc={x,y,r};},fill(){if(this.fillStyle==='#ee735f')markers.push(arc);},fillText:(t,x,y)=>{if(t==='★')labels.push({x,y});}},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true;}});
 const canvas={width:960,height:720,getContext:()=>c},r={sim:s,baseMap:()=>({})},k=Math.min(canvas.width/WIDTH,canvas.height/HEIGHT);
 Renderer.prototype.drawMap.call(r,canvas,0,true);assert.deepEqual(markers,[{x:known.x*k,y:known.y*k,r:3.1}]);assert.deepEqual(labels,[{x:known.x*k,y:known.y*k-5}]);
 markers.length=0;labels.length=0;Renderer.prototype.drawMap.call(r,canvas,1,true);assert.equal(markers.length,0);assert.equal(labels.length,0);
});

function firingScene(){const s=scene(),f=s.floor(0);f.grid.fill(0);Object.assign(s.player,{x:200,y:129,angle:0,shotCooldown:0});s.random=()=>.5;return {s,f};}
test('Shots choose the nearest body surface even when another soldier has a nearer center',()=>{
 const {s}=firingScene(),nearCenter=s.makeUnit('enemy','soldier',{x:300,y:143,floor:0}),nearSurface=s.makeUnit('enemy','soldier',{x:302,y:129,floor:0});Object.assign(nearCenter,{x:300,y:143});Object.assign(nearSurface,{x:302,y:129});s.spatial.build(s.units);s.shoot(s.player,0);assert.equal(nearCenter.health,nearCenter.maxHealth);assert.ok(nearSurface.health<nearSurface.maxHealth);assert.equal(s.traces[0].ex,287);
});
