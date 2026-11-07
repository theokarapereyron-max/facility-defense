import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {point,dist,canStand,nearestWalkable} from '../lib/facility/map.mjs';
import {doorCenter,canOpenDoor,doorControlRoom,insideRoom} from '../lib/facility/room-state.mjs';
import {doorPermission,reachDoor,syncDoorAuthority,setDoorAction} from '../lib/facility/doors.mjs';
import {updateRoomControl} from '../lib/facility/room-control.mjs';
import {tacticalContact} from '../lib/facility/contacts.mjs';
import {marketEvent,quoteOffer,shopAccessReason} from '../lib/facility/shops.mjs';
import {ITEMS,inventoryCapacity} from '../lib/facility/items.mjs';
import {itemPreview} from '../lib/facility/item-preview.mjs';
import {updateFields} from '../lib/facility/special-items.mjs';
import {clearFireLane,combatPosition,medicalPosition,retreatPosition,hazardous} from '../lib/facility/combat-tactics.mjs';
import {commandOfficer} from '../lib/facility/officers.mjs';
import {commandEnemyOfficer} from '../lib/facility/director.mjs';

function scene(){const s=new Simulation({seed:731});s.units=[s.player];s.status='running';s.time=10;s.directEvents=()=>{};Object.assign(s.player,point(80,34,0));return s;}
const centre=(f,r)=>nearestWalkable(f,r.x+r.w/2,r.y+r.h/2);
function doorFixture(s,mechanical=true){const f=s.floor(0),d=f.doors.find(d=>!!d.mechanical===mechanical&&(!mechanical||!f.rooms[d.roomIndex].strategic));assert.ok(d);return {f,d,r:f.rooms[d.roomIndex]};}
function approachDoor(s,f,d){const c=doorCenter(d);for(const [dx,dy] of [[0,48],[0,-48],[48,0],[-48,0]]){const p={x:c.x+dx,y:c.y+dy,floor:f.id};if(canStand(f,p.x,p.y,11)&&reachDoor(f,p,d)){Object.assign(s.player,p);return;}}assert.fail('No door approach');}
const equip=(s,item,count=1)=>{s.player.items=[{item,count}];s.player.itemCooldown=0;};
const purchaseState=(s,offer)=>[s.player.credits,offer.stock,JSON.stringify(s.player.items)];

test('Capturing and retaking a locked room clears obsolete commands and grants access to its new camp',()=>{
 const s=scene(),{f,d,r}=doorFixture(s);approachDoor(s,f,d);assert.ok(s.setDoorLock(d.id,'all').ok);
 d.forcedOpen=true;d.openUntil=1000;Object.assign(s.player,point(80,34,-1));s.makeUnit('enemy','rifleman',centre(f,r));updateRoomControl(s,20);
 assert.equal(r.owner,'enemy');assert.equal(d.lockTeam,'enemy');assert.equal(d.controllerFaction,'enemy');assert.equal(d.lockMode,'hostile');assert.equal(d.manualUntil,0);assert.equal(d.forcedOpen,false);assert.ok(canOpenDoor(d,'enemy'));assert.equal(canOpenDoor(d,'ally'),false);
 s.units=[s.player];Object.assign(s.player,centre(f,r));updateRoomControl(s,20);assert.equal(r.owner,'ally');assert.equal(d.lockTeam,'ally');assert.ok(canOpenDoor(d,'ally'));assert.equal(canOpenDoor(d,'enemy'),false);assert.ok(s.metrics.doorTransfers>=2);
});


test('Opening for ten seconds preserves the prior lock, expires, invalidates navigation and never crushes an occupant',()=>{
 const s=scene(),{f,d}=doorFixture(s);approachDoor(s,f,d);assert.ok(s.setDoorLock(d.id,'all').ok);const version=f.version;assert.ok(s.setDoorAction(d.id,'open').ok);assert.ok(canOpenDoor(d,'enemy'));
 Object.assign(s.player,point(80,34,-1));s.spatial.build(s.units);s.updateDoors(.3);assert.equal(d.open,1);assert.ok(f.version>version);
 s.time+=10;s.updateDoors(1);assert.equal(d.forcedOpen,false);assert.equal(d.lockMode,'all');assert.equal(d.open,0);assert.equal(canOpenDoor(d,'ally'),false);
 Object.assign(s.player,{...doorCenter(d),floor:0});d.open=1;s.spatial.build(s.units);s.updateDoors(2);assert.equal(d.open,1);assert.equal(s.setDoorAction(d.id,'nonsense').ok,false);
});


test('Grouped purchases are atomic across credit, stock, quantity and inventory failures',()=>{
 const s=scene(),shop=s.floor(0).shop,p=s.player,o=shop.offers.find(o=>o.item==='grenade');Object.assign(p,shop);p.credits=5000;p.items=[];const start=purchaseState(s,o);
 assert.ok(s.buyItem(shop.id,o.item,3,o.price).ok);assert.equal(p.credits,start[0]-o.price*3);assert.equal(o.stock,start[1]-3);assert.equal(p.items.reduce((n,x)=>n+(x?.item===o.item?x.count:0),0),3);
 for(const quantity of [0,-1,1.5,26,NaN,Infinity]){const before=purchaseState(s,o);assert.equal(s.buyItem(shop.id,o.item,quantity,o.price).ok,false);assert.deepEqual(purchaseState(s,o),before);}
 for(const failure of ['stock','money','bag']){p.credits=5000;p.items=[];o.stock=6;if(failure==='stock')o.stock=1;if(failure==='money')p.credits=o.price*2-1;if(failure==='bag')p.items=Array.from({length:inventoryCapacity(p)},()=>({item:'radio',count:1}));const before=purchaseState(s,o);assert.equal(s.buyItem(shop.id,o.item,2,o.price).ok,false);assert.deepEqual(purchaseState(s,o),before);}
});

test('A promotion discounts only its rayon and an expired preview cannot silently debit the new price',()=>{
 const s=scene(),shop=s.floor(0).shop;s.time=180;Object.assign(s.player,shop,{credits:10000,items:[]});const event=marketEvent(s,shop);assert.ok(event&&event.remaining===60);
 const offer=shop.offers.find(o=>o.category===event.category),other=shop.offers.find(o=>o.category!==event.category),quote=quoteOffer(s,shop,offer);assert.ok(quote.price<offer.price);assert.equal(quoteOffer(s,shop,other).price,other.price);
 assert.ok(s.buyItem(shop.id,offer.item,1,quote.price).ok);s.time=240;assert.equal(marketEvent(s,shop),null);const before=purchaseState(s,offer);assert.equal(s.buyItem(shop.id,offer.item,1,quote.price).ok,false);assert.deepEqual(purchaseState(s,offer),before);assert.match(s.shopFeedback.message,/prix a changé/);
});

test('A single hostile blocks an allied shop until the room is secure',()=>{
 const s=scene(),f=s.floor(0),shop=f.shop;Object.assign(s.player,shop,{credits:5000});s.makeUnit('ally','soldier',{...shop,x:shop.x+50});const hostile=s.makeUnit('enemy','rifleman',{...shop,x:shop.x+70});assert.match(shopAccessReason(s,shop),/ennemis/);assert.equal(s.buyItem(shop.id,'grenade').ok,false);
 hostile.health=0;assert.equal(shopAccessReason(s,shop),'');
});

test('Every sold object has effect statistics and the preview reflects the player’s actual condition',()=>{
 const s=scene(),state=s.snapshot();for(const item of Object.keys(ITEMS)){const preview=itemPreview(state,item);assert.ok(preview?.stats.length>0,item);assert.ok(preview.outcome.length>10,item);}
 assert.match(itemPreview({...state,health:90,maxHealth:100},'medkit').outcome,/\+10 PV/);assert.match(itemPreview({...state,health:100,maxHealth:100},'medkit').outcome,/conservé/);assert.match(itemPreview({...state,armor:180},'armor').outcome,/180 points/);
});





test('Reports retain their observed floor and smoke cannot reveal a hidden live position',()=>{
 const s=scene(),observer=s.player,e=s.makeUnit('enemy','rifleman',point(80,34,2));e.contacts={ally:{x:1200,y:1400,floor:1,until:30,shared:true}};const report=tacticalContact(s,observer,e);assert.equal(report.floor,1);assert.equal(report.x,1200);e.floor=3;assert.equal(tacticalContact(s,observer,e).floor,1);
 Object.assign(observer,point(80,34,0));Object.assign(e,{x:observer.x+160,y:observer.y,floor:0});e.contacts.ally={x:observer.x+100,y:observer.y,floor:0,until:30,shared:true};s.fields=[{type:'smoke',x:observer.x+80,y:observer.y,floor:0,radius:40,until:30}];assert.equal(tacticalContact(s,observer,e).x,observer.x+100);e.contacts={};assert.equal(tacticalContact(s,observer,e),null);s.fields=[];assert.equal(tacticalContact(s,observer,e).x,e.x);
});

test('Attack-nearest accepts reconnaissance without a prior contact and never creates invalid movement',()=>{
 const s=scene(),u=s.makeUnit('ally','soldier',point(80,35,0)),e=s.makeUnit('enemy','rifleman',point(80,34,2));s.player.rank=30;u.rank=1;Object.assign(u,{officerID:s.player.id,currentOrder:'ATTACK_NEAREST',manualOrder:true,orderUntil:Infinity});s.scans[2]=100;e.contacts={};s.spatial.build(s.units);s.think(u);
 assert.ok(Number.isFinite(u.goal.x)&&Number.isFinite(u.goal.y));assert.equal(u.goal.floor,2);s.navigate(u,u.goal,1/30);assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y));s.navigate(u,{x:NaN,y:1,floor:0},1/30);assert.equal(u.goal,null);
});

test('Fire discipline accounts for distant friendlies and medics respect defended positions and hold orders',()=>{
 const s=scene(),p=point(80,34,0),u=s.makeUnit('ally','marksman',p),target=s.makeUnit('enemy','rifleman',{...p,x:p.x+750}),friend=s.makeUnit('ally','soldier',{...p,x:p.x+620});Object.assign(u,p);Object.assign(target,{x:p.x+750,y:p.y});Object.assign(friend,{x:p.x+620,y:p.y});s.spatial.build(s.units);assert.equal(clearFireLane(s,u,target),false);friend.y+=40;s.spatial.build(s.units);assert.ok(clearFireLane(s,u,target));
 const medic=s.makeUnit('ally','medic',p),patient=s.makeUnit('ally','soldier',{...p,x:p.x+270});patient.health=20;s.spatial.build(s.units);assert.equal(medicalPosition(s,medic,p),null);const goal=medicalPosition(s,medic);assert.equal(goal.patient,patient.id);assert.ok(canStand(s.floor(0),goal.x,goal.y,medic.radius));medic.currentOrder='HOLD_AT_ALL_COSTS';assert.equal(medicalPosition(s,medic),null);
});

test('Retreats choose reachable ground farther from the enemy and avoid incendiary fields',()=>{
 const s=scene(),p=point(80,34,0),u=s.makeUnit('enemy','rifleman',p),target=s.makeUnit('ally','soldier',{...p,x:p.x-100});Object.assign(u,p);Object.assign(target,{...p,x:p.x-100});s.fields=[{type:'fire',...p,x:p.x+100,radius:50,until:100}];const retreat=retreatPosition(s,u,target);assert.ok(retreat);assert.ok(canStand(s.floor(0),retreat.x,retreat.y,u.radius));assert.ok(dist(retreat,target)>dist(u,target)+40);assert.equal(hazardous(s,retreat,0),false);
});


test('Enemy officers regroup their actual separated squad and issue pursuit to reported coordinates',()=>{
 const s=scene(),f=s.floor(0);Object.assign(s.player,point(80,34,-2));for(const r of f.rooms)r.owner='enemy';for(const d of f.doors){d.lockTeam='enemy';d.lockMode='none';d.open=1;}
 const o=s.makeUnit('enemy','officer',point(80,34,0)),straggler=s.makeUnit('enemy','rifleman',point(80,34,1)),peer=s.makeUnit('enemy','officer',point(80,35,1));o.rank=20;straggler.rank=0;peer.rank=20;o.squadID=straggler.squadID=peer.squadID='squad-v5';commandEnemyOfficer(s,o);assert.equal(o.currentOrder,'FOLLOW_OFFICER');assert.equal(straggler.officerID,o.id);assert.equal(straggler.currentOrder,'FOLLOW_OFFICER');assert.equal(peer.officerID,null);
 o.orderUntil=0;const hidden=s.makeUnit('ally','soldier',point(80,34,2));hidden.contacts={enemy:{x:o.x+150,y:o.y,floor:0,until:100,shared:true}};commandEnemyOfficer(s,o);assert.equal(o.currentOrder,'ATTACK_FLOOR');assert.equal(o.orderGoal.floor,0);assert.equal(o.orderGoal.x,o.x+150);assert.notEqual(o.orderGoal.floor,hidden.floor);
});

test('A transit preserves only the last tactical report, even under reconnaissance, and expires normally',()=>{
 const s=scene(),p=s.player,e=s.makeUnit('enemy','rifleman',point(80,34,2));
 e.contacts={ally:{x:p.x+140,y:p.y,floor:0,until:12,shared:true}};e.transit='L1';s.scans[2]=100;
 const report=tacticalContact(s,p,e);assert.equal(report.floor,0);assert.equal(report.x,p.x+140);
 s.time=12;assert.equal(tacticalContact(s,p,e),null);e.transit=null;assert.equal(tacticalContact(s,p,e).floor,2);
});

test('An allied officer reacts to the reported position while the hostile is travelling on another floor',()=>{
 const s=scene(),p=point(80,34,0);Object.assign(s.player,point(80,34,-1));
 const o=s.makeUnit('ally','officer',p);o.rank=24;
 for(let i=0;i<7;i++)s.makeUnit('ally','soldier',{...p,x:p.x+(i%3)*45,y:p.y+Math.floor(i/3)*40},0);
 const e=s.makeUnit('enemy','rifleman',point(80,34,2));e.transit='L1';e.contacts={ally:{x:o.x+220,y:o.y,floor:0,until:50,shared:true}};
 commandOfficer(s,o);assert.equal(o.currentOrder,'ASSAULT_ZONE');assert.equal(o.commandGoal.floor,0);assert.ok(dist(o.commandGoal,e.contacts.ally)<50);
});

test('An old flanking position is discarded when it burns, belongs to another floor or exceeds a new defence boundary',()=>{
 const s=scene(),p=point(80,34,0),u=s.makeUnit('ally','soldier',p),target=s.makeUnit('enemy','rifleman',{...p,x:p.x+300});s.spatial.build(s.units);
 const cached={x:p.x+70,y:p.y+70,floor:0};Object.assign(u,{tacticalTarget:target.id,tacticalUntil:100,tacticalGoal:cached});assert.equal(combatPosition(s,u,target),cached);
 s.fields=[{type:'fire',...cached,radius:40,until:100}];assert.equal(combatPosition(s,u,target),null);
 s.fields=[];u.tacticalGoal={...cached,floor:1};assert.equal(combatPosition(s,u,target),null);
 u.tacticalGoal=cached;assert.equal(combatPosition(s,u,target,{...p,x:p.x-170}),null);
});
