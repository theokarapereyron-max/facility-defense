import {CEILING_HEIGHT} from '../lib/facility/fps-ballistics.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Simulation} from '../lib/facility/simulation.mjs';
import {CORE} from '../lib/facility/map.mjs';
import {Renderer3D} from '../lib/facility/renderer3d.mjs';
import {Canvas3DRenderer} from '../lib/facility/canvas3d.mjs';
import {RenderResources,PartBatch,buildFloor3D,drawDoor3D,drawActor3D} from '../lib/facility/models3d.mjs';
import {placeCamera,projectPosition,groundPosition,cameraRelativeInput,wallHeight,boundaryWalls,CAMERA_YAW,BODY_HEIGHT} from '../lib/facility/projection3d.mjs';
import {sanitizeSettings,Game} from '../lib/facility/engine.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} vs ${b}`);

test('Aiming and ground picking round-trip through every camera orientation, zoom and aspect ratio',()=>{
 for(const [w,h] of [[1363,936],[390,844],[1920,1080]])for(const yaw of [0,CAMERA_YAW,Math.PI/2,Math.PI,Math.PI*1.75])for(const zoom of [.42,.85,1.45]){
  const camera=placeCamera(new THREE.OrthographicCamera(),CORE,w,h,zoom,yaw);
  for(const height of [0,BODY_HEIGHT])for(const p of [CORE,{x:CORE.x+160,y:CORE.y-110}]){
   const screen=projectPosition(camera,p,w,h,height),world=groundPosition(camera,screen.x,screen.y,w,h,height);near(world.x,p.x);near(world.y,p.y);
  }
 }
});

test('Camera-relative movement and touch aiming retain their direction and movement magnitude',()=>{
 for(const yaw of [0,CAMERA_YAW,Math.PI/2,Math.PI])for(const [x,y] of [[1,0],[0,-1],[-1,1]]){
  const input=cameraRelativeInput({x,y,fire:true,angle:.7},yaw);near(Math.hypot(input.x,input.y),Math.hypot(x,y));near(input.angle,.7-yaw);assert.ok(input.fire);
 }
 assert.deepEqual(cameraRelativeInput({x:0,y:0},1),{x:0,y:0});
});

test('Cutaway walls never alter collision cells and stay solid away from the local action',()=>{
 const s=new Simulation({seed:731}),f=s.floor(0),before=f.grid.slice(),cells=boundaryWalls(f),p=s.player;
 assert.ok(cells.length>100);assert.equal(new Set(cells.map(c=>c.x+':'+c.z)).size,cells.length);
 for(const yaw of [0,Math.PI/2,Math.PI])for(const cell of cells){assert.ok([.38,CEILING_HEIGHT].includes(wallHeight(cell,p,yaw)));assert.equal(wallHeight(cell,p,yaw,false),CEILING_HEIGHT);}
 assert.deepEqual(f.grid,before);assert.equal(wallHeight({x:0,z:0},p,0),CEILING_HEIGHT);
});

test('All eight decks, their door positions, furniture and actor models produce finite instanced geometry',()=>{
 const s=new Simulation({seed:731}),resources=new RenderResources();
 for(const f of s.floors){
  const before=f.grid.slice(),model=buildFloor3D(f,resources,{labels:false}),dynamic=new PartBatch(resources,10000);
  assert.equal(model.roomTiles.length,f.rooms.length);assert.equal(model.walls.count,boundaryWalls(f).length);
  for(const state of ['CLOSED','OPEN','DESTROYED'])for(const door of f.doors)drawDoor3D(dynamic,{...door,state,open:state==='OPEN'?1:0});
  for(const role of ['player','officer','medic','heavy','marksman','soldier','commando'])drawActor3D(dynamic,{...s.player,role,team:role==='commando'?'enemy':'ally',angle:.7,moveDistance:25,goal:{},path:[{}]},15);
  dynamic.finish();
  for(const container of [model.root,dynamic.group])container.traverse(o=>{if(o.isInstancedMesh){assert.ok(o.count<=o.instanceMatrix.count);assert.ok([...o.instanceMatrix.array.slice(0,o.count*16)].every(Number.isFinite));}});
  assert.deepEqual(f.grid,before);dynamic.dispose();model.dispose();
 }
 assert.equal(resources.textures.length,0);resources.dispose();
});

test('Selecting an ally targets its projected torso while aiming follows the weapon plane',()=>{
 const s=new Simulation({seed:731});s.units=[s.player];const u=s.makeUnit('ally','soldier',{x:s.player.x+110,y:s.player.y-35,floor:0});
 const r=Object.assign(Object.create(Renderer3D.prototype),{sim:s,gpu:{},settings:{renderMode:'3d'},w:1363,h:936,yaw:CAMERA_YAW,viewCamera:placeCamera(new THREE.OrthographicCamera(),s.player,1363,936,.85)});
 const torso=projectPosition(r.viewCamera,u,r.w,r.h,1.1);assert.equal(r.pickUnit(torso.x,torso.y)?.id,u.id);
 const aim=projectPosition(r.viewCamera,u,r.w,r.h,BODY_HEIGHT),world=r.aimToWorld(aim.x,aim.y);near(world.x,u.x);near(world.y,u.y);
 u.transit='L1';assert.equal(r.pickUnit(torso.x,torso.y),null);u.transit=null;u.floor=1;assert.equal(r.pickUnit(torso.x,torso.y),null);
});

test('Compatible 3D rasterisation draws scene triangles, colors and tracer lines without WebGL',()=>{
 let fills=0,strokes=0;const c=new Proxy({},{get:(o,k)=>o[k]||((...args)=>{for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));if(k==='fill')fills++;if(k==='stroke')strokes++;}),set:(o,k,v)=>{o[k]=v;return true;}});
 const canvas={getContext:()=>c},renderer=new Canvas3DRenderer({canvas});renderer.setSize(800,600);
 const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial({color:'#6fa7b6'}));mesh.position.set(3,1,3);scene.add(mesh);
 const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,1,0),new THREE.Vector3(3,1,3)]);scene.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xffffff})));
 const camera=placeCamera(new THREE.OrthographicCamera(),{x:96,y:96},800,600,1);renderer.render(scene,camera);
 assert.ok(fills>0);assert.ok(strokes>0);assert.ok(renderer.info.render.triangles>0);renderer.dispose();mesh.geometry.dispose();mesh.material.dispose();geometry.dispose();
});

test('Display settings default to 3D and reject corrupt render modes without losing the 2D option',()=>{
 assert.equal(sanitizeSettings().renderMode,'3d');assert.equal(sanitizeSettings().cutawayWalls,true);
 assert.equal(sanitizeSettings({renderMode:'2d',cutawayWalls:false}).renderMode,'2d');assert.equal(sanitizeSettings({renderMode:'corrupt'}).renderMode,'3d');
});

test('Rotation changes movement and touch aiming without rotating an already projected mouse aim twice',()=>{
 const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>1;
 try {
  const inputs=[],game={alive:true,last:1000,accumulator:0,paused:false,inputEnabled:true,keys:new Set(['d']),touch:{},fire:false,settings:{mouseAim:true},mouseActive:true,mouse:{x:50,y:50},renderer:{aimToWorld:()=>({x:100,y:0}),transformInput:i=>cameraRelativeInput(i,Math.PI/2),render(){}},sim:{status:'running',player:{x:0,y:0},tick:(dt,input)=>inputs.push({...input})},uiTimer:-100,loop(){}};
  Game.prototype.loop.call(game,1040);near(inputs[0].angle,0);near(inputs[0].x,0);near(inputs[0].y,-1);
  game.touch={fire:true,angle:.7};Game.prototype.loop.call(game,1080);near(inputs.at(-1).angle,.7-Math.PI/2);
 }finally{globalThis.requestAnimationFrame=previous;}
});

test('A lost WebGL context keeps the same FPS mission and draws with the compatible backend',()=>{
 const sim={player:{angle:.5}}, frames=[];
 let disposed=0,removed=0;
 const canvas={style:{},getContext:()=>({})},previous={style:{},removeEventListener(){},remove(){removed++;}};
 const renderer=Object.assign(Object.create(Renderer3D.prototype),{
  sim,settings:{renderMode:'3d',view3D:'fps'},gpu:{dispose(){disposed++;}},
  glCanvas:previous,useCompatible3D:true,pitch:.25,w:640,h:480,
  makeRenderCanvas:()=>canvas,resize(){this.gpu.setSize(this.w,this.h);},
  renderWorld(){frames.push(this.gpu.isSoftware);}
 });
 renderer.render(.03);
 renderer.render(.03);
 assert.equal(renderer.activeMode,'3d');
 assert.equal(renderer.isFPS,true);
 assert.equal(renderer.sim,sim);
 assert.equal(renderer.pitch,.25);
 assert.equal(canvas.width,640);
 assert.equal(disposed,1);
 assert.equal(removed,1);
 assert.deepEqual(frames,[true,true]);
});
