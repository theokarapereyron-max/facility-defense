import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {CONNECTORS,canStand} from '../lib/facility/map.mjs';
import {stairCameraPose} from '../lib/facility/stair-camera.mjs';
import {STAIR_RISE,stairRoute,stairSurface} from '../lib/facility/stairs.mjs';
import {RenderResources,buildFloor3D} from '../lib/facility/models3d.mjs';
import * as THREE from 'three';

function scene(){
 const s=new Simulation();
 s.status='running';s.units=[s.player];s.directEvents=()=>{};
 return s;
}

test('The player walks up and down the same staircase without interaction',()=>{
 const s=scene(),p=s.player,c=CONNECTORS[0];
 Object.assign(p,{x:c.x-32,y:c.y+176,floor:0});
 function walk(direction){
  let previous=p.floor*STAIR_RISE+(p.stairHeight||0);
  for(const n of stairRoute(c,direction)){
   for(let i=0;i<300&&Math.hypot(n.x-p.x,n.y-p.y)>.01;i++){
    const dx=n.x-p.x,dy=n.y-p.y,d=Math.hypot(dx,dy),step=Math.min(4,d);
    s.move(p,dx/d*step,dy/d*step);
    const height=p.floor*STAIR_RISE+(p.stairHeight||0);
    assert.ok(Math.abs(height-previous)<.06,'No height jump at either landing or the floor handoff');
    previous=height;
   }
   assert.ok(Math.hypot(n.x-p.x,n.y-p.y)<.02,'Every part of the real U-shaped route is walkable');
  }
 }
 walk(1);
 assert.equal(p.floor,1);
 assert.equal(p.stairHeight,0);
 walk(-1);
 assert.equal(p.floor,0);
 assert.equal(s.metrics.floorChanges,2);
});

test('Both flights join the mid landing and upper deck at precisely the same world heights',()=>{
 assert.equal(stairSurface(-32,112),0);
 assert.equal(stairSurface(-32,-112),STAIR_RISE/2);
 assert.equal(stairSurface(32,-112),STAIR_RISE/2);
 assert.equal(stairSurface(32,112),STAIR_RISE);
});

test('The lower floor ceiling and upper floor room overlays have actual matching stair openings',()=>{
 const s=scene(),c=CONNECTORS[0],resources=new RenderResources();
 const models=[0,1].map(f=>buildFloor3D(s.floor(f),resources,{labels:false}));
 try{
  for(const model of models)model.root.updateMatrixWorld(true);
  const down=new THREE.Raycaster(new THREE.Vector3((c.x+32)/32,1,(c.y+48)/32),new THREE.Vector3(0,-1,0),0,1.02);
  const hits=down.intersectObject(models[1].root,true);
  assert.ok(!hits.some(h=>h.object.isMesh&&Math.abs(h.point.y)<.04),'No ground, room tile or detail fills the upper opening');
  const up=new THREE.Raycaster(new THREE.Vector3(c.x/32,3,(c.y-128)/32),new THREE.Vector3(0,1,0),0,1.3);
  models[0].ceiling.visible=true;
  assert.equal(up.intersectObject(models[0].ceiling).length,0,'Mid-landing looks through the ceiling to the next deck');
 }finally{for(const m of models)m.dispose();resources.dispose();}
});

test('Calling the lift, boarding, travelling and walking out are separate actions',()=>{
 const s=scene(),p=s.player,l=s.elevators[0];
 Object.assign(p,{x:l.x,y:l.y+90,floor:1});
 assert.equal(s.interact(),null);
 assert.deepEqual(l.queue,[1]);
 s.move(p,0,-80);
 assert.ok(p.y>=l.y+53+p.radius-1);
 s.updateElevators(6);
 assert.ok(l.position>0&&l.position<1);
 assert.equal(l.doorState,'CLOSED');
 s.updateElevators(5);
 s.move(p,0,l.y-p.y);
 assert.equal(s.interact()?.inside,true);
 const short=l.duration;
 assert.equal(s.useConnector(l.id,4,true),true);
 s.updateElevators(5);
 assert.ok(l.duration>short);
 const py=p.y;
 s.move(p,0,6);
 assert.equal(p.y,py+6);
 s.move(p,0,70);
 assert.ok(p.y<=l.y+42-p.radius);
 const seatedY=p.y;
 s.updateElevators(15);
 assert.equal(p.floor,4);
 assert.equal(p.y,seatedY);
 assert.equal(l.doorState,'OPEN');
 s.move(p,0,100);
 assert.equal(p.cabin,null);
});

test('A passenger can hit another passenger while the lift is moving',()=>{
 const s=scene(),p=s.player,l=s.elevators[0];
 Object.assign(p,{x:l.x-24,y:l.y,floor:0});
 assert.ok(s.useConnector(l.id,2,true));
 const enemy=s.makeUnit('enemy','rifleman',{x:l.x,y:l.y,floor:0});
 Object.assign(enemy,{x:l.x,y:l.y});
 assert.ok(s.board(enemy,l,2));
 s.updateElevators(5);assert.ok(l.moving);
 const angle=Math.atan2(enemy.y-p.y,enemy.x-p.x);
 s.shoot(p,angle,0);
 assert.ok(enemy.health<enemy.maxHealth);
});

test('Every stair enclosure and central railing stops fast movement from either side',()=>{
 const s=scene(),p=s.player;
 for(const c of CONNECTORS.filter(c=>c.type==='stairs'))for(let floor=c.min;floor<c.max;floor++){
  for(const side of [-1,1]){
   Object.assign(p,{floor,x:c.x+side*32,y:c.y,stairTravel:{id:c.id,base:floor},stairHeight:0});
   s.move(p,side*220,0);
   assert.ok(Math.abs(p.x-c.x)<=53,c.id+' interior wall on '+floor);
   assert.ok(canStand(s.floor(floor),p.x,p.y,p.radius));
   Object.assign(p,{x:c.x+side*120,y:c.y,stairTravel:null,stairHeight:0});
   s.move(p,-side*240,0);
   assert.ok(side*(p.x-c.x)>=75,c.id+' exterior wall on '+floor);
  }
  Object.assign(p,{floor,x:c.x-32,y:c.y,stairTravel:{id:c.id,base:floor}});
  s.move(p,64,0);
  assert.ok(p.x<c.x-14,'The actor cannot jump through the middle railing');
  Object.assign(p,{x:c.x-32,y:c.y-104,stairTravel:{id:c.id,base:floor}});
  s.move(p,64,0);
  assert.ok(p.x<c.x-14,'Turning is only possible behind the end of the railing');
  Object.assign(p,{x:c.x-32,y:c.y-128,stairTravel:{id:c.id,base:floor}});
  s.move(p,0,-200);
  assert.ok(p.y>=c.y-133,'The north wall stops the entire swept movement');
 }
});

test('Allied and hostile soldiers finish every staircase in both directions, even when their goal is cancelled on the mid landing',()=>{
 const s=scene();s.updatePlayer=()=>{};s.updateCore=()=>{};s.directEvents=()=>{};
 s.elevators.forEach(l=>l.offlineUntil=Infinity);
 let trips=0;
 for(const c of CONNECTORS.filter(c=>c.type==='stairs'))for(let base=c.min;base<c.max;base++)for(const team of ['ally','enemy'])for(const direction of [1,-1]){
  const start=base+(direction<0?1:0),target=start+direction;
  s.units=[s.player];
  const u=s.makeUnit(team,'soldier',{x:c.x+(direction>0?-32:32),y:c.y+176,floor:start});
  Object.assign(u,{connector:c.id,goal:{x:c.x,y:c.y+224,floor:target},nextThink:Infinity,shotCooldown:Infinity});
  let cancelled=false;
  for(let i=0;i<700;i++){
   if(!cancelled&&u.stairTravel&&Math.abs(Math.abs(u.stairHeight)-STAIR_RISE/2)<.03){u.goal=null;cancelled=true;}
   s.tick(1/30);
   if(u.floor===target&&!u.stairRoute)break;
  }
  assert.ok(cancelled,c.id+' reaches the mid landing');
  assert.equal(u.floor,target,c.id+' '+team+' reaches floor '+target);
  assert.equal(u.stairTravel,null);
  assert.equal(u.stairRoute,null);
  assert.ok(u.y>=c.y+170,'The unit reaches a safe landing before resuming decisions');
  trips++;
 }
 assert.equal(trips,104);
});

test('The stair camera interpolates between ticks and preserves world height through both floor handoffs',()=>{
 const player={id:1,spawnTime:0,x:0,y:0,floor:0,stairHeight:4.5,stairTravel:{id:'A'}};
 let pose=stairCameraPose(null,player,1/120);
 Object.assign(player,{y:4,stairHeight:4.55});
 const midway=stairCameraPose(pose,player,1/120);
 assert.ok(midway.y>0&&midway.y<4,'Frames between simulation ticks keep moving');
 pose=midway;
 Object.assign(player,{floor:1,stairHeight:0,stairTravel:null});
 pose=stairCameraPose(pose,player,1/120);
 assert.ok(Math.abs(pose.height-midway.height)<.03,'Ascending does not jump by one floor height');
 Object.assign(player,{floor:0,stairHeight:4.55,stairTravel:{id:'A'}});
 const descending=stairCameraPose(pose,player,1/120);
 assert.ok(Math.abs(descending.height-pose.height)<.03,'Descending uses the same world space');
 player.spawnTime=10;player.stairHeight=0;player.stairTravel=null;
 assert.equal(stairCameraPose(descending,player,1/120).height,0,'Respawn clears interpolation immediately');
});
