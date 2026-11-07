import {dist} from './map.mjs';
import {lineOfSight} from './navigation.mjs';
import {smokeObstructs} from './visibility.mjs';
export const markerDuration=()=>5;
export function spotUnit(sim,observer,target){
 const ttl=markerDuration(sim,observer.floor,observer.team);
 target.contacts??={};target.contacts[observer.team]={x:target.x,y:target.y,floor:target.floor,until:sim.time+ttl,source:observer.id,shared:true};
 // Soldier radio reports last five seconds; no machinery grants live tracking.
 if(observer.team==='ally'){
  target.seenAt=sim.time;target.mapContact={x:target.x,y:target.y,floor:target.floor,until:sim.time+ttl};
 }
}
export function mapContact(sim,u){
 if(u.health<=0)return null;
 if(u.team==='ally')return u.transit?null:u;
 if(!u.transit&&(sim.scans[u.floor]||0)>sim.time)return u;
 if(u.mapContact?.until>sim.time)return u.mapContact;
 // Legacy seenAt remains supported for explicit consumable reconnaissance.
 if(!u.transit&&!u.mapContact&&sim.time-u.seenAt<markerDuration(sim,u.floor,'ally'))return u;
 return null;
}
export function reportedHostiles(sim,floor){
 const reports=[];for(const unit of sim.units){if(unit.team!=='enemy')continue;const contact=mapContact(sim,unit);if(contact&&(floor===undefined||contact.floor===floor))reports.push({unit,contact});}return reports;
}
export function visionRange(sim,u){return u.visionRange||800;}
export function tacticalContact(sim,observer,target){
 if(target.team===observer.team||target.health<=0)return null;
 // Entering a lift ends live observation, but does not erase an unexpired report.
 if(!target.transit&&observer.team==='ally'&&(sim.scans[target.floor]||0)>sim.time)return {x:target.x,y:target.y,floor:target.floor};
 if(!target.transit&&target.floor===observer.floor&&canSeeSoldier(sim,observer,target)&&lineOfSight(sim.floor(observer.floor),observer,target)&&!smokeObstructs(sim,observer,target))return {x:target.x,y:target.y,floor:target.floor};
 const contact=target.contacts?.[observer.team];
 if(contact?.until>sim.time&&(contact.shared||contact.floor===observer.floor&&dist(observer,contact)<500))return {...contact};
 return null;
}
export const knownHostile=(sim,observer,target)=>!!tacticalContact(sim,observer,target);
export function canSeeSoldier(sim,a,b){
 if(dist(a,b)>visionRange(sim,a))return false;
 for(const c of sim.fields)if(['fire','smoke'].includes(c.type)&&c.floor===a.floor&&c.until>sim.time){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.y-a.y)*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(a.x+t*dx-c.x,a.y+t*dy-c.y)<c.radius&&(c.type==='smoke'||dist(a,b)>140))return false;}
 return true;
}
