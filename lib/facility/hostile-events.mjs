import {dist} from './map.mjs';
import {spawnHostiles} from './director.mjs';
import {restockFurniture} from './furniture.mjs';
import {enemyFrozen} from './special-items.mjs';
export const LEVEL_TWO_INTERVAL=300;
export function levelTwoPlan(number,random){
 const large=random()<.4,officers=large?4:2,soldiers=large?15:10,medics=large?5:3;
 const squads=Array.from({length:officers},(_,i)=>({index:i,roles:['officer']}));
 for(let i=0;i<soldiers;i++)squads[i%officers].roles.push(i%5===4?'heavy':i%4===2?'assault':i%7===5?'marksman':'rifleman');
 for(let i=0;i<medics;i++)squads[i%officers].roles.push('medic');
 return {number,squads,remaining:officers+soldiers+medics,total:officers+soldiers+medics,usedRooms:[],resupplied:false};
}
export function directLevelTwo(sim){
 if(sim.time>=sim.nextLevelTwo){
  const cycles=1+Math.floor((sim.time-sim.nextLevelTwo)/LEVEL_TWO_INTERVAL);
  for(let i=0;i<cycles;i++)sim.pendingLevelTwo.push(levelTwoPlan(++sim.levelTwoSerial,()=>sim.random()));
  sim.nextLevelTwo+=cycles*LEVEL_TWO_INTERVAL;
 }
 if(sim.time<sim.nextLevelTwoInsertion||!sim.pendingLevelTwo.length)return;
 const wave=sim.pendingLevelTwo[0],f=sim.floor(2),rooms=[7,15,3,12,17,19];let arrived=0;
 for(const squad of [...wave.squads]){
  const offset=(wave.number+squad.index)%rooms.length;
  for(let i=0;i<rooms.length;i++){
   const index=rooms[(i+offset)%rooms.length];if(wave.usedRooms.includes(index))continue;
   const r=f.rooms[index],n=spawnHostiles(sim,'charlie',squad.roles.length,2,{...squad,kind:'level-two',roomIndex:index,bounds:r});
   if(!n)continue;
   wave.usedRooms.push(index);wave.remaining-=n;arrived+=n;wave.squads.splice(wave.squads.indexOf(squad),1);break;
  }
 }
 if(arrived){
  sim.metrics.levelTwoArrivals=(sim.metrics.levelTwoArrivals||0)+arrived;
  sim.log('INFILTRATION — COMMANDEMENT',arrived+' hostiles entrent par des accès techniques distincts au niveau +2 : officiers, soldats et médecins.','critical',2);
  if(!wave.resupplied){restockFurniture(sim,'enemy',2);wave.resupplied=true;}
 }
 if(!wave.remaining)sim.pendingLevelTwo.shift();sim.nextLevelTwoInsertion=sim.time+3;
}
export function triggerEnemyEvent(sim,kind){
 const enemies=sim.units.filter(u=>u.team==='enemy'&&u.health>0&&!u.transit&&!enemyFrozen(sim,u));if(!enemies.length)return false;
 const leaders=enemies.filter(u=>u.role==='officer'),medics=enemies.filter(u=>u.role==='medic');
 const lifts=sim.elevators.filter(l=>l.offlineUntil<=sim.time&&enemies.some(u=>dist(u,l)<180));
 const doors=sim.floors.flatMap(f=>f.doors.filter(d=>d.state!=='DESTROYED'&&d.type!=='standard'&&enemies.some(u=>u.floor===f.id&&dist(u,{x:d.x+d.w/2,y:d.y+d.h/2})<150)).map(d=>({f,d})));
 const candidates=['comms',...(leaders.length?['surge']:[]),...(medics.length?['medical']:[]),...(lifts.length?['sabotage']:[]),...(doors.length?['breach']:[])];
 const type=kind||candidates[Math.floor(sim.random()*candidates.length)];if(!candidates.includes(type))return false;
 const choose=list=>list[Math.floor(sim.random()*list.length)];let title,detail,floor=null;
 if(type==='surge'){
  const leader=choose(leaders),group=enemies.filter(u=>u.floor===leader.floor&&(u.squadID&&u.squadID===leader.squadID||dist(u,leader)<350));
  for(const u of group)u.assaultBoostUntil=sim.time+25;
  floor=leader.floor;title='OFFENSIVE HOSTILE COORDONNÉE';detail=group.length+' hostiles accélèrent leur progression (+15 %) et leur cadence (+25 %) pendant 25 s.';
 }else if(type==='comms'){
  sim.enemyCommsUntil=sim.time+25;title='TRANSMISSIONS HOSTILES PERTURBÉES';detail='Pendant 25 s, les officiers ennemis ne donnent plus de nouveaux ordres. Les missions déjà reçues continuent.';
 }else if(type==='medical'){
  const medic=choose(medics);for(const u of medics.filter(u=>u.floor===medic.floor))u.medicalBoostUntil=sim.time+30;
  floor=medic.floor;title='SOUTIEN MÉDICAL HOSTILE';detail='Les médecins de cet étage soignent à 8 PV/s pendant 30 s, à proximité et avec ligne de vue.';
 }else if(type==='sabotage'){
  const lift=choose(lifts);lift.offlineUntil=sim.time+25;floor=enemies.find(u=>dist(u,lift)<180).floor;title='SABOTAGE — '+lift.label;detail='L’ennemi neutralise les nouveaux appels pendant 25 s. Une cabine en mouvement termine son trajet.';
 }else{
  const {f,d}=choose(doors);d.health-=100;if(d.health<=0)sim.destroyDoor(f,d);floor=f.id;title='BRÈCHE HOSTILE';detail='Une équipe au contact pose une charge : la porte stratégique subit 100 dégâts.';
 }
 sim.enemyEvent={type,time:sim.time,floor,title};sim.metrics.enemyEvents=(sim.metrics.enemyEvents||0)+1;sim.log(title,detail,type==='comms'?'success':'danger',floor);return true;
}
export function directEnemyEvents(sim){
 if(sim.time<sim.nextEnemyEvent)return;
 triggerEnemyEvent(sim);sim.nextEnemyEvent=sim.time+90+Math.floor(sim.random()*121);
}
