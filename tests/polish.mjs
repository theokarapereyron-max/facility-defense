import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,sanitizeSettings} from '../lib/facility/engine.mjs';
import {Simulation,WEAPONS} from '../lib/facility/simulation.mjs';
import {CONNECTORS,canStand,dist,nearestWalkable} from '../lib/facility/map.mjs';
import {doorCenter,insideRoom,canOpenDoor} from '../lib/facility/room-state.mjs';
import {restoreDoor} from '../lib/facility/doors.mjs';
import {updateRoomControl} from '../lib/facility/room-control.mjs';
import {commandEnemyOfficer} from '../lib/facility/director.mjs';
import {Renderer3D} from '../lib/facility/renderer3d.mjs';
import {healthBarEnabled} from '../lib/facility/health-display.mjs';
import {impactMaterial} from '../lib/facility/impact-material.mjs';

function mission(){
 const s=new Simulation({seed:731});s.status='running';s.units=[s.player];s.directEvents=()=>{};return s;
}

test('A browser capture rejection waits for a new gesture then automatically retries',async()=>{
 const previous=globalThis.document;let attempts=0;
 const canvas={requestPointerLock(){attempts++;return attempts===1?Promise.reject(new DOMException('Gesture required','NotAllowedError')):Promise.resolve();}};
 globalThis.document={hasFocus:()=>true,visibilityState:'visible'};
 try{
  const g=Object.assign(Object.create(Game.prototype),{canvas,sim:mission(),renderer:{isFPS:true},inputEnabled:true,paused:false});
  assert.equal(g.captureMouse(),true);await Promise.resolve();
  assert.equal(g.captureNeedsGesture,true);assert.equal(g.captureMouse(),false);assert.equal(attempts,1);
  assert.equal(g.captureMouse(true),true);await Promise.resolve();assert.equal(attempts,2);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('Health bars are independently persisted and old settings keep safe defaults',()=>{
 const settings=sanitizeSettings({healthBars:{fps:{player:false,ally:true},aerial:{enemy:false},'2d':{enemy:'bad'}}});
 assert.equal(healthBarEnabled(settings,'fps','player'),false);
 assert.equal(healthBarEnabled(settings,'fps','ally'),true);
 assert.equal(healthBarEnabled(settings,'fps','enemy'),true);
 assert.equal(healthBarEnabled(settings,'aerial','enemy'),false);
 assert.equal(healthBarEnabled(settings,'2d','enemy'),true);
 assert.equal(healthBarEnabled(sanitizeSettings(),'fps','player'),true);
});


test('A room order spreads defenders across accesses and emits one warning when overwhelmed',()=>{
 const s=mission(),f=s.floor(0),room=f.rooms[4],pos=nearestWalkable(f,room.x+room.w/2,room.y+room.h/2);
 Object.assign(s.player,pos,{rank:12});s.setCommandRadius(700);
 const soldiers=Array.from({length:3},(_,i)=>s.makeUnit('ally','soldier',{...pos,x:pos.x+i*36},0));
 assert.equal(s.command('DEFEND_ZONE',{floor:f.id,index:room.index}).count,3);
 assert.ok(new Set(soldiers.map(u=>u.orderGoal.watchX+':'+u.orderGoal.watchY)).size>=2);
 for(const u of soldiers){
  assert.ok(insideRoom(room,u.orderGoal));
  assert.ok(canStand(f,u.orderGoal.x,u.orderGoal.y,u.radius));
  assert.ok(soldiers.every(v=>u===v||dist(u.orderGoal,v.orderGoal)>52));
 }
 f.grid.fill(0);
 for(let i=0;i<6;i++)s.makeUnit('enemy','soldier',{...pos,x:pos.x+64,y:pos.y+i*32},0);
 s.spatial.build(s.units);for(const u of soldiers)s.think(u);
 assert.equal(s.events.filter(e=>e.title==='RENFORTS DEMANDÉS').length,1);
});

test('Hostile officer dispatches support and a different route against a real contact',()=>{
 const s=mission(),f=s.floor(0);
 f.grid.fill(0);f.doors=[];f.devices=[];f.elevators=[];
 const officer=s.makeUnit('enemy','officer',{floor:0,x:2576,y:1808},25);
 officer.squadID='test-crossfire';
 const units=['heavy','rifleman','assault'].map((role,i)=>{
  const u=s.makeUnit('enemy',role,{floor:0,x:2544+i*32,y:officer.y+48},0);u.squadID=officer.squadID;return u;
 });
 Object.assign(s.player,{floor:0,x:officer.x+320,y:officer.y});
 s.spatial.build(s.units);commandEnemyOfficer(s,officer);
 assert.equal(officer.currentOrder,'ATTACK_FLOOR');
 assert.equal(s.metrics.crossfires,1);
 assert.equal(units.filter(u=>u.assaultRole==='support').length,2);
 const flanker=units.find(u=>u.assaultRole==='flank');
 assert.ok(Math.abs(flanker.orderGoal.y-s.player.y)>95);
 assert.ok(units.filter(u=>u.assaultRole==='support').every(u=>dist(u.orderGoal,flanker.orderGoal)>85));
});

test('Metal and concrete are classified from the actual impact surface',()=>{
 const s=mission(),f=s.floor(0),d=f.doors[0],p=doorCenter(d);
 assert.equal(impactMaterial(f,p.x,p.y,1.3),'metal');
 assert.equal(impactMaterial(f,-32,-32,1.3),'concrete');
});

test('One mission preserves reload, heading and movement through FPS, aerial, pause, stairs and redeployment',()=>{
 const s=mission(),p=s.player,settings=sanitizeSettings({view3D:'fps'});
 const renderer=Object.assign(Object.create(Renderer3D.prototype),{gpu:{},settings,pitch:.1,resize(){}});
 const game=Object.assign(Object.create(Game.prototype),{sim:s,renderer,settings,inputEnabled:true,keys:new Set(['z']),touch:{},audio:{setSettings(){},update(){}},callbacks:{}});
 Object.assign(p,{angle:1.6});s.spatial.build(s.units);
 s.shoot(p,p.angle,renderer.pitch);s.reload();
 const reload=p.reload;
 assert.equal(p.mag,WEAPONS.rifle.magazineSize-1);
 game.toggleView();assert.equal(renderer.isFPS,false);
 assert.equal(p.reload,reload);assert.equal(p.angle,1.6);assert.ok(game.keys.has('z'));
 game.setPaused(true);assert.equal(game.canLook(),false);assert.equal(p.reload,reload);
 game.setPaused(false);assert.equal(game.canLook(),true);
 Object.assign(p,{x:CONNECTORS[0].x,y:CONNECTORS[0].y,floor:0});
 assert.equal(s.useConnector('A',-1),true);assert.equal(p.floor,-1);
 s.time=6;s.damage(p,1000,null);
 assert.equal(p.health,0);assert.equal(game.canLook(),false);
 for(let i=0;i<180;i++)s.tick(1/30);
 const supply=s.supplyOptions().find(a=>a.available&&a.floor===1);
 assert.ok(supply);assert.equal(s.respawn(supply.id),true);
 game.toggleView();
 assert.equal(renderer.isFPS,true);assert.equal(s.player,p);assert.equal(p.floor,1);assert.equal(p.health,p.maxHealth);
});

test('Capture lifecycle releases the pointer on pause and loss of focus and resizes on fullscreen change',()=>{
 const previous={document:globalThis.document,window:globalThis.window};
 const windowEvents={},documentEvents={};
 let requestCount=0,releaseCount=0,resizeCount=0,pauses=0;
 const canvas={
  addEventListener(){},focus(){},requestPointerLock(){requestCount++;document.pointerLockElement=canvas;return Promise.resolve();}
 };
 globalThis.document={
  addEventListener:(name,fn)=>{documentEvents[name]=fn;},
  exitPointerLock(){releaseCount++;this.pointerLockElement=null;documentEvents.pointerlockchange();}
 };
 globalThis.window={addEventListener:(name,fn)=>{windowEvents[name]=fn;}};
 try{
  const game=Object.assign(Object.create(Game.prototype),{
   canvas,sim:mission(),renderer:{isFPS:true,resize(){resizeCount++;}},inputEnabled:true,paused:false,
   keys:new Set(),audio:{update(){}},callbacks:{onPause(){pauses++;}}
  });
  game.bind();
  assert.ok(game.captureMouse());assert.ok(game.fpsLocked);
  game.fire=true;game.renderer.ads=true;
  documentEvents.fullscreenchange();assert.equal(resizeCount,1);
  game.setPaused(true);
  assert.equal(game.fpsLocked,false);assert.equal(game.fire,false);assert.equal(game.renderer.ads,false);
  assert.equal(game.captureMouse(),false);
  game.setPaused(false);assert.ok(game.fpsLocked,'Resuming automatically captures the mouse');
  game.keys.add('z');windowEvents.blur();
  assert.equal(game.fpsLocked,false);assert.equal(game.keys.size,0);assert.equal(game.paused,true);
  assert.equal(pauses,1);assert.equal(requestCount,2);assert.equal(releaseCount,2);
  game.setPaused(false);documentEvents.pointerlockchange();
  document.pointerLockElement=null;documentEvents.pointerlockchange();
  assert.equal(game.escapeCapturePaused,true,'Escape-style loss keeps the pointer free');
  const before=requestCount;windowEvents.focus();windowEvents.autoGesture?.({pointerType:'mouse'});
  assert.equal(requestCount,before,'Focus does not undo the Escape exception');
  game.fpsPointerDown({button:0,pointerType:'mouse',pointerId:1});
  assert.equal(game.escapeCapturePaused,false);assert.ok(game.fpsLocked,'A deliberate game click resumes capture');
 }finally{
  for(const [key,value] of Object.entries(previous)){
   if(value===undefined)delete globalThis[key];
   else globalThis[key]=value;
  }
 }
});
