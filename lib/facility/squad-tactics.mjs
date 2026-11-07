import {canStand,dist,nearestWalkable} from './map.mjs';
import {doorCenter,insideRoom,canOpenDoor,roomAt} from './room-state.mjs';
import {lineOfSight} from './navigation.mjs';
import {hazardous} from './combat-tactics.mjs';

// Posts are kept inside the assigned room and chosen around different access points.
export function defencePosts(sim, f, room, units, reserved=[]) {
 const entries=f.doors.filter(d=>d.roomIndex===room.index).map(doorCenter);
 const center={x:room.x+room.w/2,y:room.y+room.h/2};
 const cover=f.covers.filter(c=>insideRoom(room,c));
 const used=[...reserved];
 return units.map((unit,index)=>{
  const entry=entries[index%entries.length]||center,rank=Math.floor(index/Math.max(1,entries.length));
  const angle=Math.atan2(center.y-entry.y,center.x-entry.x);
  const candidates=cover.filter(c=>c.occupant===null||c.occupant===unit.id);
  for(const offset of [0,-.55,.55,-.9,.9])for(const step of [90,140,205,270]){
   candidates.push({x:entry.x+Math.cos(angle+offset)*step,y:entry.y+Math.sin(angle+offset)*step});
  }
  const points=candidates.map(p=>({...p,floor:f.id})).filter(p=>insideRoom(room,p)&&canStand(f,p.x,p.y,unit.radius)&&
   !hazardous(sim,p,f.id)&&used.every(other=>dist(other,p)>52));
  const score=p=>Math.abs(dist(p,entry)-(100+rank*36))-(p.id!==undefined?65:0)-(lineOfSight(f,p,entry)?55:0)+dist(p,unit)*.035;
  points.sort((a,b)=>score(a)-score(b));
  const post=points[0]||nearestWalkable(f,center.x,center.y);
  const result={x:post.x,y:post.y,floor:f.id,guardRoom:room.index,watchX:entry.x,watchY:entry.y};
  used.push(result);
  return result;
 });
}

export function reportFailingDefence(sim, unit, mission) {
 if(unit.team!=='ally'||mission?.guardRoom===undefined||unit.floor!==mission.floor)return;
 const f=sim.floor(unit.floor),room=f.rooms[mission.guardRoom];
 if(!insideRoom(room,unit))return;
 const nearby=sim.spatial.nearby(f.id,unit.x,unit.y,430);
 const defenders=nearby.filter(a=>a.team===unit.team&&insideRoom(room,a)&&a.health>a.maxHealth*.25).length;
 const threats=nearby.filter(a=>a.team!==unit.team&&lineOfSight(f,unit,a)).length;
 if(!threats||threats<=defenders&&unit.health>unit.maxHealth*.28||sim.time<(room.nextDefenceWarning??0))return;
 room.nextDefenceWarning=sim.time+18;
 unit.speech='POSITION FRAGILE · RENFORTS DEMANDÉS';unit.speechUntil=sim.time+3.5;
 sim.log('RENFORTS DEMANDÉS',room.name+' · '+defenders+' défenseur(s) opérationnel(s), '+threats+' contact(s) visibles.','warning',f.id);
}

export function planCrossfire(sim, officer, units, contact) {
 const f=sim.floor(officer.floor),room=roomAt(f,contact);
 const angle=Math.atan2(contact.y-officer.y,contact.x-officer.x),dx=Math.cos(angle),dy=Math.sin(angle);
 const squad=units.filter(u=>u.squadID===officer.squadID&&u.role!=='medic'&&u.role!=='officer');
 if(!officer.squadID||squad.length<3||dist(officer,contact)<145)return null;
 const entries=f.doors.filter(d=>d.roomIndex===room?.index&&canOpenDoor(d,officer.team)).map(doorCenter);
 const nearest=entries.sort((a,b)=>dist(officer,a)-dist(officer,b))[0];
 const sideOffset=p=>Math.abs((p.x-contact.x)*dy-(p.y-contact.y)*dx);
 const points=entries.filter(p=>p!==nearest&&sideOffset(p)>95).map(p=>{
  const a=Math.atan2(contact.y-p.y,contact.x-p.x);
  return nearestWalkable(f,p.x+Math.cos(a)*61,p.y+Math.sin(a)*61);
 });
 // In the open, take a genuinely different line to the last known contact.
 if(!room)for(const side of [-1,1])for(const width of [170,240]){
  points.push(nearestWalkable(f,contact.x-dx*145-dy*width*side,contact.y-dy*145+dx*width*side));
 }
 const sorted=[...squad].sort((a,b)=>Number(['heavy','marksman'].includes(b.role))-Number(['heavy','marksman'].includes(a.role))||dist(a,contact)-dist(b,contact));
 const lead=sorted.at(-1);
 const flank=points.filter(p=>sideOffset(p)>95&&canStand(f,p.x,p.y,lead.radius)&&!hazardous(sim,p,f.id)&&lineOfSight(f,p,contact)).sort((a,b)=>dist(lead,a)-dist(lead,b)).find(p=>{
  const path=sim.pathfinding.path(f,lead,p);
  if(!path.length)return false;
  let length=0,prev=lead;
  for(const step of path){
   length+=dist(prev,step);
   // Refuse locked doors anywhere along a straight segment compressed by A*.
   for(let d=16;d<=dist(prev,step);d+=16){
    const t=d/dist(prev,step),x=prev.x+(step.x-prev.x)*t,y=prev.y+(step.y-prev.y)*t;
    const door=f.doorByCell.get(Math.floor(y/32)*f.cols+Math.floor(x/32));
    if(door&&!canOpenDoor(door,officer.team))return false;
   }
   prev=step;
  }
  return length<1080;
 });
 if(!flank)return null;
 const support=sorted.slice(0,Math.ceil(sorted.length/2)), origin=support.find(u=>lineOfSight(f,u,contact))||officer;
 return {flank,support:new Set(support.map(u=>u.id)),members:new Set(sorted.map(u=>u.id)),origin};
}
