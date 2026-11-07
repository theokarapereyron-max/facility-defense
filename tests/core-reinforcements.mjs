import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../lib/facility/simulation.mjs';
import {CORE,point,dist,canStand} from '../lib/facility/map.mjs';
import {directCoreRelief} from '../lib/facility/services.mjs';
import {directEvents,ALLY_LIMIT} from '../lib/facility/director.mjs';
import {rankOf,canCommand} from '../lib/facility/ranks.mjs';

function scene(){const s=new Simulation();s.units=[s.player];s.status='running';s.directEvents=()=>{};s.nextLevelTwo=s.nextEnemyEvent=s.nextAttack=s.nextReinforce=s.nextRoofAttack=Infinity;return s;}
const arrivals=s=>s.units.filter(u=>u.coreReliefID);

test('Core reliefs use independent 150/330-second clocks and exact ranks in the requested rooms',()=>{
 const s=scene();
 assert.deepEqual(s.snapshot().coreReliefs.map(r=>r.remaining),[150,330]);
 for(const [time,count] of [[149.9,0],[150,3],[150.5,3],[299.9,3],[300,6],[329.9,6],[330,9],[450,12],[600,15],[660,18]]){s.time=time;directCoreRelief(s);assert.equal(arrivals(s).length,count,'time '+time);}
 assert.equal(s.coreReliefs[0].next,750);assert.equal(s.coreReliefs[1].next,990);assert.equal(s.metrics.coreReinforcements,18);
 const squads=new Map();for(const u of arrivals(s)){const members=squads.get(u.squadID)||[];members.push(u);squads.set(u.squadID,members);const post=s.coreReliefs.find(p=>p.id===u.coreReliefID),room=s.floor(-2).rooms[post.roomIndex];assert.equal(u.floor,-2);assert.ok(u.x>room.x&&u.x<room.x+room.w&&u.y>room.y&&u.y<room.y+room.h);assert.ok(canStand(s.floor(-2),u.x,u.y,u.radius));assert.equal(u.homeZone,room.name);}
 for(const units of squads.values()){
  assert.equal(units.length,3);const leader=units.find(u=>u.role==='officer'),soldiers=units.filter(u=>u.role==='soldier');assert.equal(soldiers.length,2);assert.ok(soldiers.every(u=>canCommand(leader,u)&&u.officerID===leader.id));assert.ok(units.every(u=>units.every(v=>u===v||dist(u,v)>=26)));
  assert.equal(rankOf(leader).title,leader.coreReliefID==='core-command'?'Commandant':'Capitaine');
  if(leader.coreReliefID==='core-command')assert.ok(soldiers.every(u=>rankOf(u).title==='Soldat de première classe'&&u.currentOrder==='DEFEND_CORE'));
 }
});

test('Core relief cannot exceed population, steal reserved support slots or accumulate blocked cycles',()=>{
 const s=scene();while(s.units.length<ALLY_LIMIT)s.makeUnit('ally','soldier',point(80,56,0));
 for(const time of [330,1650]){s.time=time;directCoreRelief(s);assert.equal(arrivals(s).length,0);assert.ok(s.coreReliefs.every(p=>p.pending===true));}
 assert.deepEqual(s.coreReliefs.map(p=>p.next),[1800,1980]);
 s.units=s.units.slice(0,ALLY_LIMIT-10);s.supportRequests=[{remaining:8}];directCoreRelief(s);assert.equal(arrivals(s).length,0);
 s.units.splice(1,1);directCoreRelief(s);assert.equal(arrivals(s).length,3);assert.equal(s.units.length+8,ALLY_LIMIT);assert.equal(s.coreReliefs[0].pending,false);assert.equal(s.coreReliefs[1].pending,true);
 s.units.splice(1,3);directCoreRelief(s);assert.equal(arrivals(s).length,6);assert.ok(s.coreReliefs.every(p=>!p.pending));assert.equal(s.units.length+8,ALLY_LIMIT);directCoreRelief(s);assert.equal(arrivals(s).length,6);
});

test('Occupied Core rooms wait for safe positions and release only one full team per timer',()=>{
 const s=scene();for(const post of s.coreReliefs){const r=s.floor(-2).rooms[post.roomIndex];for(let y=r.y+32;y<r.y+r.h;y+=100)for(let x=r.x+32;x<r.x+r.w;x+=100)s.makeUnit('enemy','rifleman',{x,y,floor:-2});}
 s.time=330;directCoreRelief(s);assert.equal(arrivals(s).length,0);assert.ok(s.snapshot().coreReliefs.every(r=>r.pending));s.time=1650;directCoreRelief(s);assert.equal(arrivals(s).length,0);
 s.units=[s.player];directCoreRelief(s);assert.equal(arrivals(s).length,6);directCoreRelief(s);assert.equal(arrivals(s).length,6);assert.ok(s.snapshot().coreReliefs.every(r=>!r.pending));
});

test('Core defenders contest real capture and remain under the ordinary player command hierarchy',()=>{
 const s=scene(),e=s.makeUnit('enemy','rifleman',{...CORE,x:CORE.x+180},1);s.coreControl=60;s.updateCore(1);assert.equal(s.coreState,'CAPTURING');const control=s.coreControl;
 // The room must remain allied: two guards outside the capture radius hold the perimeter.
 s.makeUnit('ally','soldier',{x:CORE.x-280,y:CORE.y+100,floor:-2});s.makeUnit('ally','soldier',{x:CORE.x-280,y:CORE.y-100,floor:-2});
 s.time=330;directCoreRelief(s);const defenders=arrivals(s).filter(u=>u.coreReliefID==='core-command');assert.equal(defenders.length,3);assert.ok(defenders.every(u=>dist(u,CORE)<200&&dist(u,e)>=140));
 s.updateCore(1);assert.equal(s.coreState,'CONTESTED');assert.equal(s.coreControl,control);
 const soldier=defenders.find(u=>u.role==='soldier');s.selectUnit(soldier.id);assert.equal(s.command('HOLD_POSITION').count,0);s.player.rank=29;s.setCommandPriority(15);assert.equal(s.command('HOLD_POSITION').count,1);assert.equal(soldier.officerID,s.player.id);
});

test('The ordinary 12-person relief and two Core teams remain separate when clocks coincide',()=>{
 const s=scene();s.time=4950;directEvents(s);assert.equal(s.units.filter(u=>u.reliefPost).length,12);assert.equal(arrivals(s).length,6);assert.equal(s.units.length,19);assert.equal(s.reliefBudget,0);assert.equal(s.coreReliefs[0].next,5100);assert.equal(s.coreReliefs[1].next,5280);
 directEvents(s);assert.equal(s.units.length,19);assert.equal(s.nextRelief,4995);
});
