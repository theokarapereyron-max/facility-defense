import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {canStand} from '../lib/facility/map.mjs';
import {LIFT_DWELL,liftMotion,liftDistanceAt,callLift,navigateLift} from '../lib/facility/elevators.mjs';
import {liftDisplay,liftPanelHit} from '../lib/facility/lift-geometry.mjs';

function scene(){
 const s=new Simulation();
 s.units=[s.player];s.status='running';s.directEvents=()=>{};
 return s;
}
function advance(s,seconds){
 for(let i=0;i<seconds*30;i++){s.time+=1/30;s.updateElevators(1/30);}
}
function until(s,predicate,limit=60){
 for(let i=0;i<limit*30&&!predicate();i++){s.time+=1/30;s.updateElevators(1/30);}
 assert.ok(predicate(),'The requested state is reached');
}

test('An interrupted boarding soldier exits an offline cabin instead of blocking it forever',()=>{
 const s=scene(),l=s.elevators[0],u=s.makeUnit('ally','soldier',{x:l.x,y:l.y+90,floor:0});
 Object.assign(u,{x:l.x,y:l.y,cabin:l.id,liftPlan:{id:l.id,origin:0,target:2,seat:0,stage:'BOARD'}});
 l.offlineUntil=Infinity;s.updateElevators(.1);
 for(let i=0;i<100&&u.liftPlan;i++)navigateLift(s,u,1/30);
 assert.equal(u.liftPlan,null);assert.equal(u.cabin,null);assert.ok(u.y>l.y+75);
});

test('A hall call moves the real cabin and never changes its target in mid-flight',()=>{
 const s=scene(),l=s.elevators[0];
 assert.ok(callLift(s,l,3));
 until(s,()=>l.moving);
 const target=l.targetFloor;
 advance(s,1);
 assert.ok(l.position>0&&l.position<3);
 assert.ok(callLift(s,l,-2));
 assert.equal(l.targetFloor,target);
 assert.equal(l.doorOpen,0);
 until(s,()=>l.phase==='OPEN'&&l.currentFloor===3);
 assert.equal(l.position,3);
 assert.equal(liftDisplay(l).direction,0);
 const opened=s.time;
 advance(s,LIFT_DWELL-.1);
 assert.equal(l.phase,'OPEN');
 until(s,()=>l.moving);
 assert.ok(s.time-opened>=LIFT_DWELL+.8);
 assert.equal(l.targetFloor,-2);
});

test('Acceleration, proportional travel times and the displayed floor use one physical position',()=>{
 const near=liftMotion(4.6),far=liftMotion(7*4.6);
 assert.ok(far.duration>near.duration*3);
 assert.equal(liftDistanceAt(far,0),0);
 assert.equal(liftDistanceAt(far,far.duration),far.distance);
 assert.ok(liftDistanceAt(near,.1)<liftDistanceAt(near,.2)/2);
 const s=scene(),l=s.elevators[0];
 callLift(s,l,5);until(s,()=>l.moving);
 let previous=l.position;
 while(l.moving){advance(s,1/30);assert.ok(l.position>=previous);assert.equal(liftDisplay(l).floor,Math.round(l.position));previous=l.position;}
});

test('Shaft walls and landing gates are solid from both sides and an absent cabin has no walkable floor',()=>{
 const s=scene(),p=s.player,l=s.elevators[0];
 Object.assign(p,{x:l.x,y:l.y+88,floor:1,cabin:null});
 assert.equal(canStand(s.floor(1),l.x,l.y,p.radius),false);
 s.move(p,0,-160);
 assert.ok(p.y>=l.y+52+p.radius-1);
 Object.assign(p,{x:l.x+96,y:l.y,floor:0,cabin:null});
 s.move(p,-190,0);assert.ok(p.x>=l.x+55+p.radius-1);
 Object.assign(p,{x:l.x,y:l.y+88,floor:0,cabin:null});
 s.move(p,0,-88);assert.equal(p.cabin,l.id);
 s.move(p,-160,0);assert.ok(p.x>=l.x-40+p.radius);
 assert.ok(s.useConnector(l.id,2,true));
 until(s,()=>l.moving);
 s.move(p,0,180);assert.ok(p.y<=l.y+42-p.radius);
 until(s,()=>l.phase==='OPEN'&&l.currentFloor===2);
 assert.equal(p.floor,2);assert.equal(p.cabin,l.id);
 s.move(p,0,100);assert.equal(p.cabin,null);assert.ok(p.y>l.y+70);
});

test('A person in the doorway reopens closing doors and prevents departure',()=>{
 const s=scene(),p=s.player,l=s.elevators[0];
 Object.assign(p,{floor:0,x:l.x,y:l.y,cabin:l.id});
 s.useConnector(l.id,1,true);
 until(s,()=>l.phase==='CLOSING');
 advance(s,.2);const closingFraction=l.doorOpen;
 s.move(p,0,46);
 advance(s,.1);
 assert.ok(['OPENING','OPEN'].includes(l.phase));assert.equal(l.moving,false);assert.ok(l.doorOpen>=closingFraction);
 s.move(p,0,60);
 until(s,()=>l.phase==='OPEN');
 advance(s,1);
 assert.equal(l.moving,false);
});

test('Physical cabin buttons accept aimed interaction and queue additional floors without reversing a moving trip',()=>{
 const s=scene(),p=s.player,l=s.elevators[0];
 Object.assign(p,{floor:0,x:l.x+18,y:l.y+10,angle:-Math.PI/2,cabin:l.id});
 const pitch=Math.atan2(1.55-1.54,50/32);
 assert.equal(liftPanelHit(l,p,pitch),-2);
 s.interact(pitch);assert.ok(l.stops.includes(-2));
 until(s,()=>l.moving);const target=l.targetFloor;
 assert.ok(s.useConnector(l.id,3,true));
 assert.equal(l.targetFloor,target);assert.ok(l.stops.includes(3));
});

test('Allies and enemies walk into the cabin, travel, then walk out on the requested floor',()=>{
 for(const team of ['ally','enemy']){
  const s=scene(),l=s.elevators[0];
  s.units=[];s.updatePlayer=()=>{};
  const u=s.makeUnit(team,'soldier',{x:l.x,y:l.y+92,floor:3});
  Object.assign(u,{health:10000,maxHealth:10000,currentOrder:'DEFEND_ZONE',manualOrder:true,orderUntil:Infinity,orderGoal:{x:l.x,y:l.y+224,floor:-2}});
  let boarding=false,riding=false,exiting=false;
  for(let i=0;i<100*30;i++){
   s.tick(1/30);
   boarding||=u.liftPlan?.stage==='BOARD';
   riding||=!!u.transit;
   exiting||=u.liftPlan?.stage==='EXIT';
   if(u.floor===-2&&!u.liftPlan)break;
  }
  assert.ok(boarding,team+' physically boards');
  assert.ok(riding,team+' rides the cabin');
  assert.ok(exiting,team+' physically exits');
  assert.equal(u.floor,-2);
  assert.equal(u.cabin,null);
  assert.ok(u.y>l.y+75);
 }
});
