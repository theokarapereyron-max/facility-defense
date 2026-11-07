import {restoreDoor} from './doors.mjs';
import {canSeeSoldier} from './contacts.mjs';
import {CORE,dist,nearestWalkable} from './map.mjs';
import {raycast,lineOfSight} from './navigation.mjs';
import {awardExperience} from './ranks.mjs';
import {ALLY_LIMIT} from './director.mjs';
import {WEAPONS} from './simulation.mjs';
import {smokeObstructs} from './visibility.mjs';
const result=(ok,message,extra={})=>({ok,message,...extra});
export const enemyFrozen=(sim,u)=>u.team==='enemy'&&sim.enemyFreezeUntil>sim.time;
export function npcCanSee(sim,a,b){return canSeeSoldier(sim,a,b)&&lineOfSight(sim.floor(a.floor),a,b)&&!smokeObstructs(sim,a,b);}
function nearbyDoor(sim){const p=sim.player;return sim.floor(p.floor).doors.map(d=>({d,x:d.x+d.w/2,y:d.y+d.h/2})).filter(d=>dist(p,d)<180&&raycast(sim.floor(p.floor),p.x,p.y,Math.atan2(d.y-p.y,d.x-p.x),Math.max(0,dist(p,d)-32)).d>=dist(p,d)-40).sort((a,b)=>dist(p,a)-dist(p,b))[0]?.d;}
export function useSpecialItem(sim,item,options={}){
 const p=sim.player,w=WEAPONS[p.weapon];
 if(item==='xp_major'){awardExperience(sim,2000,'Instruction avancée');return result(true,'+2 000 XP · instruction avancée.');}
 if(item==='stasis'){
  if(sim.enemyFreezeUntil>sim.time)return result(false,'Une stase est déjà active : objet conservé.');
  sim.enemyFreezeUntil=sim.time+12;return result(true,'Stase globale : les hostiles sont immobilisés pendant 12 s.');
 }
 if(item==='core_rebuild'){
  if(sim.coreControl>=100)return result(false,'Core déjà à 100 % : dispositif conservé.');
  sim.coreControl=100;return result(true,'Restauration du Core terminée : contrôle à 100 %.');
 }
 if(item==='radio_target'){
  if(!options.room)return result(false,'Choisissez la salle à renforcer.',{selection:'room'});
  const f=sim.floors.find(f=>f.id===options.room.floor),r=f?.rooms.find(r=>r.index===options.room.index);
  if(!r)return result(false,'Salle inconnue : balise conservée.');
  const available=ALLY_LIMIT-sim.units.filter(u=>u.team==='ally'&&u.health>0).length-sim.supportRequests.reduce((n,r)=>n+r.remaining,0);
  if(available<8)return result(false,'La garnison doit disposer de 8 places libres.');
  const target={...nearestWalkable(f,r.x+r.w/2,r.y+r.h/2),roomIndex:r.index,name:r.name,bounds:r};
  sim.supportRequests.push({id:++sim.supportSerial,at:sim.time+12,remaining:8,target});sim.log('RENFORTS AFFECTÉS',r.name+' · arrivée par le toit dans 12 s, puis progression vers la salle.','success',f.id);
  return result(true,'8 alliés affectés à '+r.name+' · niveau '+f.id+'.');
 }
 if(item==='door_kit'||item==='door_armor'){
  const d=nearbyDoor(sim);if(!d)return result(false,'Approchez-vous d’une porte visible à moins de 5,6 m.');
  const base=d.maxHealth||(d.type==='armored'?240:100);
  if(item==='door_armor'){
   if(d.reinforced)return result(false,'Cette porte possède déjà un renfort.');
   if(d.state==='DESTROYED')return result(false,'Réparez d’abord la porte détruite.');
   d.reinforced=true;d.maxHealth=base+200;
  }else if(d.state!=='DESTROYED'&&d.health>=base)return result(false,'Cette porte est intacte : kit conservé.');
  d.maxHealth=d.maxHealth||base;restoreDoor(sim,sim.floor(p.floor),d);
  return result(true,item==='door_armor'?'Porte renforcée : +200 PV maximum.':'Porte réparée et remise en service.');
 }
 if(item==='trauma'){
  if(p.health>=p.maxHealth)return result(false,'Santé déjà au maximum : kit conservé.');
  p.health=p.maxHealth;return result(true,'Votre santé est entièrement restaurée.');
 }
 if(item==='team_med'){
  const patients=sim.units.filter(u=>u.team==='ally'&&u.health>0&&!u.transit&&u.health<u.maxHealth&&u.floor===p.floor&&dist(p,u)<350&&lineOfSight(sim.floor(p.floor),p,u));
  if(!patients.length)return result(false,'Aucun allié blessé et visible à portée.');
  for(const u of patients)u.health=Math.min(u.maxHealth,u.health+60);return result(true,patients.length+' allié(s) soignés : jusqu’à +60 PV chacun.');
 }
 if(item==='armor_heavy'){
  if((p.armor||0)>=180)return result(false,'Votre protection renforcée est intacte.');p.armor=180;return result(true,'Protection renforcée équipée : 180 dégâts absorbables.');
 }
 if(item==='adrenaline'||item==='overdrive'){
  const key=item==='adrenaline'?'speedBoostUntil':'fireBoostUntil',duration=item==='adrenaline'?30:25;
  if(p[key]>sim.time)return result(false,'Cet effet est déjà actif : objet conservé.');p[key]=sim.time+duration;
  return result(true,item==='adrenaline'?'Mobilité +25 % pendant 30 s.':'Cadence accélérée pendant 25 s.');
 }
 if(item==='incendiary'||item==='smoke'){
  const ray=raycast(sim.floor(p.floor),p.x,p.y,p.angle,430),range=Math.max(0,ray.d-(ray.wall?20:0));
  sim.projectiles.push({id:++sim.projectileSerial,item,floor:p.floor,startX:p.x,startY:p.y,x:p.x,y:p.y,endX:p.x+Math.cos(p.angle)*range,endY:p.y+Math.sin(p.angle)*range,age:0,fuse:1.2,owner:p.id});
  return result(true,item==='incendiary'?'Grenade incendiaire lancée !':'Grenade fumigène lancée !');
 }
 if(item==='recon'){
  if(sim.floors.every(f=>(sim.scans[f.id]||0)>sim.time+15))return result(false,'Une reconnaissance étendue est déjà active.');
  for(const f of sim.floors)sim.scans[f.id]=Math.max(sim.scans[f.id]||0,sim.time+60);return result(true,'Les huit niveaux sont surveillés pendant 60 s.');
 }
 if(item==='core_shield'){
  if(sim.coreShieldUntil>sim.time)return result(false,'La protection du Core est déjà active.');sim.coreShieldUntil=sim.time+30;return result(true,'Capture du Core ralentie de 80 % pendant 30 s.');
 }
 if(item==='reserve_pack'){
  if(p.mag===w.magazineSize&&p.reserve===w.maxReserve)return result(false,'Arme déjà entièrement ravitaillée.');p.mag=w.magazineSize;p.reserve=w.maxReserve;p.reload=0;return result(true,'Chargeur et réserve de '+w.name+' remplis.');
 }
 return null;
}
export function updateFields(sim,dt){
 for(const field of sim.fields){
  if(field.type!=='fire'||field.until<=sim.time-dt)continue;
  const duration=Math.min(dt,Math.max(0,field.until-(sim.time-dt))),owner=sim.units.find(u=>u.id===field.owner)||sim.player;
  for(const u of sim.units)if(u.health>0&&!u.transit&&u.floor===field.floor&&dist(u,field)<field.radius&&lineOfSight(sim.floor(field.floor),field,u))sim.damage(u,18*duration,owner);
 }
 sim.fields=sim.fields.filter(f=>f.until>sim.time);
}
