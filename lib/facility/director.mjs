import {defencePosts,planCrossfire} from './squad-tactics.mjs';
import {tacticalContact} from './contacts.mjs';
import {roomStatus,canOpenDoor} from './room-state.mjs';
import {restockFurniture} from './furniture.mjs';
import {CORE,CONNECTORS,FLOOR_INFO,ROOF_FLOOR,dist,point,nearestWalkable,canStand} from './map.mjs';
import {availableTo,formationPoint} from './commands.mjs';
import {ROOF_INTERVAL,roofPlan,majorWavePlan} from './reinforcement-plans.mjs';
import {directRelief,directCoreRelief} from './services.mjs';
import {restockShops} from './shops.mjs';
import {directLevelTwo,directEnemyEvents} from './hostile-events.mjs';
import {npcPriority,priorityLabel} from './priorities.mjs';
import {updateWaveStatus} from './wave-status.mjs';
import {scheduleAirlift} from './airlift.mjs';
import {airliftReserved} from './airlift-geometry.mjs';
export const ALLY_LIMIT=240,ENEMY_LIMIT=240,ROOF_ACTIVE_LIMIT=180;
export const randomDelay=(sim,team)=>team==='ally'?600+Math.floor(sim.random()*601):300+Math.floor(sim.random()*901);
export function defencePost(sim,floor,index){
 const f=sim.floor(floor),choices=f.zones.filter(z=>!f.supplies.some(p=>dist(p,z)<220));
 for(let i=0;i<choices.length;i++){
  const z=choices[(index*5+floor+6+i)%choices.length],p=formationPoint(sim,z,index%4,55);
  if(!f.supplies.some(s=>dist(s,p)<220))return p;
 }
 return nearestWalkable(f,f.entry.x,f.entry.y);
}
const routes={alpha:{entry:point(80,110,0),mid:point(80,91,0),connector:'B'},bravo:{entry:point(9,75,-1),mid:point(46,74,-1),connector:'A'},charlie:{entry:point(97,75,ROOF_FLOOR),mid:point(114,89,ROOF_FLOOR),connector:'B'},delta:{entry:point(9,97,-2),mid:point(46,88,-2),connector:'A'}};
export function spawnHostiles(sim,route,count,commandoFloor,options={}){
 const active=sim.units.filter(u=>u.team==='enemy'&&u.health>0).length,reserved=airliftReserved(sim),n=options.roles?.length??Math.min(count,12,ENEMY_LIMIT-active-reserved);if(n<=0||active+n+reserved-(options.airliftID?n:0)>ENEMY_LIMIT)return 0;
 let r=routes[route]||routes.charlie;
 if(commandoFloor!==undefined){
  const f=sim.floor(commandoFloor),candidates=f.zones.filter(z=>dist(z,sim.player)>700||f.id!==sim.player.floor).filter(z=>f.id!==-2||dist(z,CORE)>1200);
  const safe=candidates.filter(z=>!sim.units.some(u=>u.team==='ally'&&u.health>0&&u.floor===f.id&&dist(u,z)<400));
  const preferred=safe.filter(z=>options.roomIndex===undefined||z.id===options.roomIndex);
  const z=preferred.find(z=>/TECHNIQUE|MAINTENANCE|RÉSERVE|TUNNEL|RÉSEAU|STOCKAGE|VESTIAIRE|ANTENNE/.test(z.name))||preferred[0];
  if(!z)return 0;r={entry:nearestWalkable(f,z.x,z.y),mid:nearestWalkable(f,z.x,z.y+140),connector:'A'};
 }
 const entry=options.roles?formationPoint(sim,r.entry,(options.index||0)%12,100):r.entry;
 // Reserve legal, separate positions for the whole squad before creating any member.
 const positions=[],occupants=sim.units.filter(u=>u.health>0&&!u.transit&&u.floor===entry.floor);
 for(let i=0;i<n;i++){
  let pos;
  if(options.positions){
   pos=options.positions[i];
   if(!pos||pos.floor!==ROOF_FLOOR||!canStand(sim.floor(pos.floor),pos.x,pos.y,11)||occupants.some(q=>dist(pos,q)<25))return 0;
   positions.push(pos);continue;
  }
  for(let j=0;j<110;j++){
   const p=formationPoint(sim,entry,i+j,36);
   if(options.bounds&&(p.x<options.bounds.x+32||p.x>options.bounds.x+options.bounds.w-32||p.y<options.bounds.y+32||p.y>options.bounds.y+options.bounds.h-32))continue;
   if(dist(p,entry)>380||!canStand(sim.floor(p.floor),p.x,p.y,11))continue;
   if(commandoFloor!==undefined&&((p.floor===sim.player.floor&&dist(p,sim.player)<600)||occupants.some(u=>u.team==='ally'&&dist(u,p)<260)))continue;
   if(positions.some(q=>dist(p,q)<25)||occupants.some(q=>dist(p,q)<25))continue;
   pos=p;break;
  }
  if(!pos)return 0;positions.push(pos);
 }
 const squadID=options.squadID||'hostile-'+(++sim.squadSerial),members=[];
 for(let i=0;i<n;i++){
  const role=options.roles?.[i]??(i===0?'officer':i===1?'medic':commandoFloor!==undefined?'commando':i===2?'heavy':i%5===3?'marksman':i%4===0?'assault':'rifleman');
  const u=sim.makeUnit('enemy',role,positions[i]);
  if(options.positions)Object.assign(u,positions[i]);
  Object.assign(u,{squadID,formationIndex:i,routeName:route,preferredConnector:r.connector,mainObjective:{...CORE},state:'ADVANCE',elite:!!options.elite||(commandoFloor!==undefined&&options.kind!=='level-two'),reinforcementKind:options.kind||'initial',waveNumber:options.waveNumber??null});
  if(u.elite){u.health=u.maxHealth=Math.round(u.maxHealth*1.4);u.speed*=1.12;}
  u.route=route==='charlie'&&commandoFloor===undefined?[r.mid,...FLOOR_INFO.filter(f=>f.id<ROOF_FLOOR&&f.id>-2).reverse().map(f=>point(80,f.id%2?56:89,f.id)),{...CORE}]:[r.mid,{...CORE}];
  u.formationIndex=i+(options.memberOffset||0);members.push(u);
 }
 if(commandoFloor!==undefined)sim.effects.push({type:'explosion',floor:r.entry.floor,x:r.entry.x,y:r.entry.y,life:.8,max:.8});
 if(!options.memberOffset)members[0].name='CHEF '+squadID.toUpperCase();
 if(options.roles)for(const u of members.slice(1))Object.assign(u,{officerID:members[0].id,currentOrder:'ATTACK_CORE',orderPriority:6,orderGoal:formationPoint(sim,r.mid,u.formationIndex,25),orderUntil:sim.time+20});
 if(options.leaderID)for(const u of members)Object.assign(u,{officerID:options.leaderID,currentOrder:'ATTACK_CORE',orderPriority:6,orderGoal:formationPoint(sim,r.mid,u.formationIndex,25),orderUntil:sim.time+20});
 sim.director.spent+=n;return n;
}
export function reinforceAllies(sim,count,reserveSupport=true,target=null){
 const reserved=reserveSupport?(sim.supportRequests||[]).reduce((n,r)=>n+r.remaining,0):0;
 const n=Math.min(count,ALLY_LIMIT-sim.units.filter(u=>u.team==='ally'&&u.health>0).length-reserved);if(n<=0)return 0;
 const entry=point(62,75,ROOF_FLOOR),squadID='renfort-'+(++sim.squadSerial),threats=sim.floors.flatMap(f=>f.zones).filter(z=>z.pressure>0).sort((a,b)=>b.pressure*5+b.strategicValue-a.pressure*5-a.strategicValue);
 for(let i=0;i<n;i++){
  const role=i%8===0?'officer':i%8===1?'medic':i%8===2?'heavy':i%8===3?'marksman':i%8===4?'commando':i%8===5?'assault':'soldier',u=sim.makeUnit('ally',role,formationPoint(sim,entry,i,40));
  const floor=target?.floor??(sim.coreState!=='SECURE'?-2:threats[0]?.floor??FLOOR_INFO[(Math.floor(i/8)+sim.squadSerial)%FLOOR_INFO.length].id);
  u.homePosition=target?formationPoint(sim,target,i,45):defencePost(sim,floor,i+sim.squadSerial);u.homeZone=target?.name||sim.floor(floor).zones.find(z=>dist(z,u.homePosition)<250)?.name||'POSTE DE DÉFENSE';u.squadID=squadID+'-'+Math.floor(i/8);u.formationIndex=i%8;
  u.deploymentGoal=target?u.homePosition:sim.coreState!=='SECURE'?formationPoint(sim,CORE,i,22):threats.length?formationPoint(sim,threats[0],i,55):u.homePosition;
  u.deploymentUntil=target?Infinity:sim.time+180;u.goal=u.deploymentGoal;u.state='MOVE';
  if(target){u.assignedRoom={floor:target.floor,index:target.roomIndex};u.currentOrder='DEFEND_ZONE';u.orderPriority=6;u.orderGoal=u.homePosition;u.orderUntil=sim.time+180;u.orderReason='Affectation de renfort à '+target.name;}
 }
 sim.landing={time:sim.time,count:n,team:'ally',...entry};
 sim.log('RENFORTS ALLIÉS — HÉLIPAD',n+' militaires débarquent : commandement, santé, appui et fusiliers.','success',ROOF_FLOOR);restockFurniture(sim,'ally');return n;
}
export function directEvents(sim){
 for(const request of sim.supportRequests||[])if(sim.time>=request.at)request.remaining-=reinforceAllies(sim,request.remaining,false,request.target);
 sim.supportRequests=(sim.supportRequests||[]).filter(r=>r.remaining>0);
 directCoreRelief(sim);directRelief(sim);restockShops(sim);updateWaveStatus(sim);directLevelTwo(sim);directEnemyEvents(sim);
 if(sim.time>=sim.nextReinforce){reinforceAllies(sim,16+Math.floor(sim.random()*9));sim.nextReinforce=sim.time+randomDelay(sim,'ally');}
 // A separate, undisclosed clock keeps roof pressure independent of major waves.
 if(sim.time>=sim.nextRoofAttack){
  sim.pendingRoof.push(roofPlan());
  sim.nextRoofAttack+=ROOF_INTERVAL*(1+Math.floor((sim.time-sim.nextRoofAttack)/ROOF_INTERVAL));
 }
 if(sim.time>=sim.nextAttack){
  const wave=++sim.director.attackIndex,plan=majorWavePlan(wave,()=>sim.random());
  sim.activeMajorWaves.push({number:wave,total:plan.total,inserted:0,landed:false});
  sim.pendingWaves.push(plan);sim.director.lastMajor=sim.time;
  sim.log('ASSAUT MASSIF — VAGUE '+wave,plan.total+' hostiles : débarquement sur le toit, attaque d’un accès secondaire et commandos d’élite.','critical',ROOF_FLOOR);
  sim.nextAttack=sim.time+randomDelay(sim,'enemy');
  if(wave%4===0){const l=sim.elevators[wave%2];l.offlineUntil=sim.time+30;sim.log('ASCENSEUR HORS SERVICE','Réparation dans 30 secondes.','warning');}
 }
 if(sim.time>=sim.nextInsertion&&sim.pendingWaves.length){
  const wave=sim.pendingWaves[0];let inserted=0;
  // Up to four complete squads per 3 seconds. Blocked fronts cannot stall other routes.
  for(const squad of [...wave.squads]){
   if(inserted>=4)break;
   if(squad.route==='charlie'&&squad.floor===undefined&&!squad.elite)continue;
   const n=spawnHostiles(sim,squad.route,squad.roles.length,squad.floor,{...squad,kind:'major',waveNumber:wave.number});
   if(!n)continue;
   const record=sim.activeMajorWaves.find(w=>w.number===wave.number);if(record){record.inserted+=n;if(!record.landed){record.landed=true;sim.wavesReceived++;}}
   wave.remaining-=n;wave.squads.splice(wave.squads.indexOf(squad),1);inserted++;
   const floor=squad.floor??(squad.route==='charlie'?ROOF_FLOOR:squad.route==='alpha'?0:-1);
   if(!wave.resuppliedFloors.includes(floor)){restockFurniture(sim,'enemy',floor);wave.resuppliedFloors.push(floor);}
   if(squad.elite)sim.log('INFILTRATION COMMANDO','Une équipe d’élite a franchi un accès technique.','critical',floor);
   else if(squad.route==='charlie'){sim.roofWaves++;sim.landing={...routes.charlie.entry,time:sim.time,count:n,team:'enemy'};}
  }
  if(wave.remaining<=0)sim.pendingWaves.shift();sim.nextInsertion=sim.time+3;
 }
 scheduleAirlift(sim,ENEMY_LIMIT);
 if(sim.pendingRoof.length){
  const formation=sim.pendingRoof[0];let arrived=0;
  while(formation.squads.length){
   const squad=formation.squads[0],active=sim.units.filter(u=>u.team==='enemy'&&u.health>0).length;
   if(active+squad.roles.length+airliftReserved(sim)>ROOF_ACTIVE_LIMIT)break;
   const n=spawnHostiles(sim,'charlie',squad.roles.length,undefined,{...squad,kind:'roof',bounds:sim.floor(ROOF_FLOOR).rooms[10]});if(!n)break;
   formation.squads.shift();formation.remaining-=n;arrived+=n;
  }
  if(arrived){
   sim.landing={...routes.charlie.entry,time:sim.time,count:arrived,team:'enemy'};sim.roofWaves++;
   sim.log('CONTACT — TOIT',arrived+' hostiles débarquent en escouades commandées.','danger',ROOF_FLOOR);
   if(!formation.resupplied){restockFurniture(sim,'enemy',ROOF_FLOOR);formation.resupplied=true;}
  }
  if(!formation.remaining)sim.pendingRoof.shift();
 }
}
export function commandEnemyOfficer(sim,o){
 if(sim.enemyCommsUntil>sim.time)return;
 if(o.officerID&&o.orderUntil>sim.time)return;
 const friends=sim.units.filter(u=>u.team==='enemy'&&u.health>0&&!u.transit&&u.floor===o.floor&&dist(u,o)<700&&(!o.garrison||u.squadID===o.squadID)),men=friends.filter(u=>availableTo(sim,o,u,15)),foes=sim.units.filter(u=>u.team==='ally'&&u.health>0).map(u=>({unit:u,contact:tacticalContact(sim,o,u)})).filter(a=>a.contact&&a.contact.floor===o.floor&&dist(a.contact,o)<650).sort((a,b)=>dist(a.contact,o)-dist(b.contact,o));
 if(o.orderUntil>sim.time)return;
 const leaderRoute=o.route[o.routeIndex]||CORE;
 const stragglers=sim.units.filter(u=>u.id!==o.id&&u.team===o.team&&u.squadID===o.squadID&&o.squadID&&u.health>0&&!u.transit&&Math.abs(u.floor-o.floor)<=1&&(u.floor!==o.floor||dist(o,u)>260)&&availableTo(sim,o,u,15));
 const f=sim.floor(o.floor),door=f.doors.filter(d=>d.state!=='DESTROYED'&&d.open<.72&&!canOpenDoor(d,'enemy')).map(d=>({d,p:{x:d.x+d.w/2,y:d.y+d.h/2,floor:f.id}})).filter(a=>dist(o,a.p)<380).sort((a,b)=>dist(o,a.p)-dist(o,b.p))[0];
 const lift=f.connectors.filter(c=>c.type==='elevator').find(c=>friends.length>=4&&sim.units.some(u=>u.team==='ally'&&u.health>0&&u.floor===o.floor&&dist(u,c)<200)&&dist(o,c)<600);
 const guardRoom=o.garrison&&sim.floor(o.garrison.floor).rooms[o.garrison.roomIndex];
 const holdsRoom=guardRoom&&roomStatus(sim,sim.floor(o.garrison.floor),guardRoom).owner==='enemy';
 if(guardRoom&&!holdsRoom)o.garrison=null;
 const objective=f.rooms.filter(r=>r.owner!=='enemy'&&dist(o,f.zones[r.index])<800).map(r=>({r,z:f.zones[r.index],score:f.zones[r.index].strategicValue*8+(f.supplies.some(s=>s.roomIndex===r.index)?45:0)+(r.type==='shop'?22:0)-dist(o,f.zones[r.index])/35})).sort((a,b)=>b.score-a.score)[0];
 let type='ATTACK_CORE',goal=leaderRoute,reason='Avancer par les accès verticaux vers le Core.';
 if(holdsRoom){type='DEFEND_ZONE';goal={...o.homePosition};reason='Tenir la salle conquise, protéger ses accès et son ravitaillement.';}
 else if(door){type='ATTACK_DOOR';goal=nearestWalkable(f,door.d.w<door.d.h?door.p.x+(o.x<door.p.x?70:-70):door.p.x,door.d.w<door.d.h?door.p.y:door.p.y+(o.y<door.p.y?70:-70));o.attackDoor=door.d.id;reason='Ouvrir le passage blindé.';}
 else if(lift){type='ATTACK_ELEVATOR';goal={...lift,floor:o.floor};reason='Neutraliser la garde de l’ascenseur.';}
 else if(foes.length){type='ATTACK_FLOOR';goal={x:foes[0].contact.x,y:foes[0].contact.y,floor:foes[0].contact.floor};reason='Réduire la défense locale au dernier contact connu.';}
 else if(stragglers.length&&sim.time-(o.lastRally??-100)>45){type='FOLLOW_OFFICER';goal={x:o.x,y:o.y,floor:o.floor};o.lastRally=sim.time;reason='Regrouper les membres séparés de l’escouade avant la descente.';}
 else if(objective&&objective.score>0){type='ASSAULT_ZONE';goal={...nearestWalkable(f,objective.z.x,objective.z.y),bounds:objective.r};reason='Conquérir '+objective.r.name+' puis poursuivre vers le Core.';}
 const priority=npcPriority(sim,o,type,goal);
 o.orderPriority=priority;o.currentOrder=type;o.orderGoal=goal;o.commandGoal=goal;o.orderUntil=sim.time+15;o.orderReason=reason;o.orderSerial++;o.speech={DEFEND_ZONE:'GARDEZ CETTE SALLE',ASSAULT_ZONE:'CONQUÉREZ CETTE SALLE',ATTACK_CORE:'VERS LE CORE',ATTACK_DOOR:'OUVREZ LE PASSAGE',ATTACK_ELEVATOR:'PRENEZ L’ASCENSEUR',ATTACK_FLOOR:'ASSAUT DU NIVEAU',FOLLOW_OFFICER:'REGROUPEMENT'}[type];o.speechUntil=sim.time+3;sim.metrics.enemyOrders++;
 const receiving=type==='FOLLOW_OFFICER'?[...new Map([...men,...stragglers].map(u=>[u.id,u])).values()]:men;
 const eligible=receiving.filter(u=>availableTo(sim,o,u,priority));
 const crossfire=type==='ATTACK_FLOOR'?planCrossfire(sim,o,eligible,goal):null;
 const posts=holdsRoom?defencePosts(sim,f,guardRoom,eligible):[];
 if(crossfire){
  o.orderReason='Groupe d’appui en place · manœuvre par un accès latéral.';
  o.speech='APPUI ET CONTOURNEMENT';sim.metrics.crossfires=(sim.metrics.crossfires||0)+1;
 }
 eligible.forEach((u,i)=>{
  sim.releaseCover(u);
  u.assaultRole=crossfire?.members.has(u.id)?crossfire.support.has(u.id)?'support':'flank':null;
  const destination=u.assaultRole==='flank'?crossfire.flank:u.assaultRole==='support'?crossfire.origin:goal;
  u.orderPriority=priority;u.currentOrder=type;
  u.orderGoal=type==='FOLLOW_OFFICER'?null:posts[i]||formationPoint(sim,destination,i,u.assaultRole?23:45);
  u.officerID=o.id;u.orderUntil=sim.time+20;u.formationIndex=i;u.pathGoal=null;u.nextThink=sim.time;
 });
}
