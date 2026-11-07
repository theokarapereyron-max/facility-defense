import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game, sanitizeSettings} from '../lib/facility/engine.mjs';
import {Simulation} from '../lib/facility/simulation.mjs';
import {Renderer3D} from '../lib/facility/renderer3d.mjs';
import {Canvas3DRenderer} from '../lib/facility/canvas3d.mjs';
import {placeFirstPerson, projectPosition} from '../lib/facility/projection3d.mjs';
import {CEILING_HEIGHT, EYE_HEIGHT, fpsRay} from '../lib/facility/fps-ballistics.mjs';
import {COLS, TILE} from '../lib/facility/map.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} vs ${b}`);

test('The FPS camera sits at eye level and projects the aimed point to the center', () => {
 const p = {x:2400,y:2600,angle:1.8}, distance = 150, pitch = -.18;
 const cam = new THREE.PerspectiveCamera(66,1,.035,65);
 placeFirstPerson(cam,p,1200,800,pitch);
 near(cam.position.x,p.x/TILE);
 near(cam.position.y,EYE_HEIGHT);
 near(cam.position.z,p.y/TILE);
 const target = {x:p.x+distance*Math.cos(p.angle),y:p.y+distance*Math.sin(p.angle)};
 const center = projectPosition(cam,target,1200,800,EYE_HEIGHT+distance*Math.tan(pitch)/TILE);
 near(center.x,600);
 near(center.y,400);
});

test('3D movement follows the actual soldier heading and keeps the 2D movement axes', () => {
 const s = new Simulation({seed:731}), p = s.player;
 const r = Object.assign(Object.create(Renderer3D.prototype),{gpu:{},yaw:.8,settings:{renderMode:'3d',view3D:'aerial'}});
 let movement;
 s.move = (unit,x,y) => { assert.equal(unit,p); movement = [x,y]; };
 for(const [x,y,expectedX,expectedY] of [[0,-1,0,1],[1,0,-1,0],[0,1,0,-1],[-1,0,1,0]]){
  s.updatePlayer(.03,{...r.transformInput({x,y}),angle:Math.PI/2});
  near(movement[0],expectedX*p.speed*.03);
  near(movement[1],expectedY*p.speed*.03);
 }
 r.settings.renderMode = '2d';
 s.updatePlayer(.03,{...r.transformInput({x:0,y:-1}),angle:Math.PI/2});
 near(movement[0],0);
 near(movement[1],-p.speed*.03);
});

test('FPS shots at an enemy, over its head and down to the floor share the live weapon state', () => {
 const s = new Simulation({seed:731}), p = s.player, f = s.floor(0);
 f.grid.fill(0);f.props=[];f.devices=[];
 Object.assign(p,{x:1296,y:1296,floor:0,angle:0});
 s.units=[p];
 const enemy = s.makeUnit('enemy','soldier',{x:p.x+140,y:p.y,floor:p.floor});
 s.spatial.build(s.units);
 s.random = () => .5;
 const health = enemy.health, mag = p.mag;
 const shoot = pitch => { p.shotCooldown=0; s.shoot(p,0,pitch); return s.traces.at(-1); };
 near(shoot(.25).endHeight,CEILING_HEIGHT);
 near(shoot(-.6).endHeight,0);
 assert.equal(enemy.health,health);
 const hit = shoot(0);
 assert.equal(hit.height,EYE_HEIGHT);
 assert.ok(hit.ex<enemy.x);
 assert.ok(enemy.health<health);
 assert.equal(p.mag,mag-3);
});

test('FPS rays respect a closed door and can pass over low cover', () => {
 const s = new Simulation({seed:731}), f = s.floor(0);
 f.grid.fill(0);f.props=[];f.devices=[];
 const x=1296, y=1296, col=42, cell=Math.floor(y/TILE)*COLS+col;
 f.grid[cell]=2;
 const door={state:'CLOSED',open:0};
 f.doorByCell.set(cell,door);
 assert.equal(fpsRay(f,x,y,1,0,0,140).distance,48);
 door.open=1;
 assert.equal(fpsRay(f,x,y,1,0,0,140).distance,140);
 f.grid[cell]=3;
 f.props.push({type:'vent',solid:true,x:col*TILE,y:y-10,w:TILE,h:20});
 assert.equal(fpsRay(f,x,y,1,0,0,140).distance,140);
 assert.ok(fpsRay(f,x,y,1,0,-.54,140).distance<60);
});

test('The compatible perspective renderer clips near the eye and excludes geometry behind it', () => {
 let fills = 0;
 const c = new Proxy({},{
  get:(o,k)=>o[k]||((...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));if(k==='fill')fills++;}),
  set:(o,k,v)=>{o[k]=v;return true;}
 });
 const renderer = new Canvas3DRenderer({canvas:{getContext:()=>c}});
 renderer.setSize(800,600);
 const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(66,4/3,.035,65);
 const geo = new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([-.2,-.2,.1,.35,-.3,-1,0,.5,-1],3));
 const mesh = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 scene.add(mesh);
 renderer.render(scene,cam);
 assert.ok(fills>0);
 mesh.position.z=3;
 fills=0;
 renderer.render(scene,cam);
 assert.equal(fills,0);
 geo.dispose();mesh.material.dispose();
});

test('The 3D view is persisted and can toggle without replacing the simulation', () => {
 const sim = {player:{angle:1.15},status:'running',time:91};
 const renderer = Object.assign(Object.create(Renderer3D.prototype),{gpu:{},pitch:.3,resize(){}});
 const settings = sanitizeSettings({view3D:'invalid'});
 renderer.settings=settings;
 const observed = [];
 const game=Object.assign(Object.create(Game.prototype),{sim,renderer,settings,keys:new Set(['z']),audio:{setSettings(){}},callbacks:{onSettings:value=>observed.push(value.view3D)}});
 game.toggleView();
 assert.equal(renderer.isFPS,true);
 assert.equal(renderer.pitch,.3);
 assert.deepEqual([...game.keys],["z"]);
 game.toggleView();
 assert.equal(renderer.isFPS,false);
 assert.equal(game.sim,sim);
 assert.equal(sim.player.angle,1.15);
 assert.deepEqual(observed,['fps','aerial']);
});

test('Page keys rotate only the aerial camera and retain the order shortcut', () => {
 const prior = {window:globalThis.window,HTMLInputElement:globalThis.HTMLInputElement,HTMLSelectElement:globalThis.HTMLSelectElement,HTMLTextAreaElement:globalThis.HTMLTextAreaElement};
 const listeners = {}, rotation = [], priorities = [], views = [];
 globalThis.window = {addEventListener:(key,fn)=>{listeners[key]=fn;}};
 globalThis.HTMLInputElement = globalThis.HTMLTextAreaElement = globalThis.HTMLSelectElement = class {};
 try {
  const game = Object.assign(Object.create(Game.prototype),{
   canvas:{addEventListener(){}}, inputEnabled:true, sim:{status:'running',commandPriority:6},
   renderer:{is3D:true,isFPS:false,rotateCamera:amount=>rotation.push(amount)},
   setCommandPriority:value=>priorities.push(value), toggleView:capture=>views.push(capture)
  });
  game.bind();
  const press = (key, extra = {}) => {
   let prevented = false;
   listeners.keydown({key,preventDefault:()=>{prevented=true;},...extra});
   assert.equal(prevented,true);
  };
  press('PageUp');
  press('PageDown');
  press('PageUp',{repeat:true});
  press('PageDown',{shiftKey:true});
  press('²');
  game.renderer.isFPS = true;
  press('PageUp');
  press('`',{code:'Backquote'});
  assert.deepEqual(rotation,[-1,1]);
  assert.deepEqual(priorities,[5,7]);
  assert.deepEqual(views,[true,true]);
 } finally {
  for(const [key,value] of Object.entries(prior)){
   if(value===undefined)delete globalThis[key];
   else globalThis[key]=value;
  }
 }
});
