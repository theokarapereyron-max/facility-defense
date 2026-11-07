import {defencePosts} from './squad-tactics.mjs';
import {tacticalContact} from './contacts.mjs';
import {insideRoom,roomAt,roomStatus} from './room-state.mjs';
import {CORE,ROOF_FLOOR,dist,nearestWalkable,zoneAt} from './map.mjs';
import {availableTo,clearOrder} from './commands.mjs';
import {npcPriority,priorityLabel} from './priorities.mjs';
import {canCommand,rankOf} from './ranks.mjs';
export const ORDER_LABELS={FOLLOW_OFFICER:'SUIVEZ-MOI',HOLD_POSITION:'TENEZ LA POSITION',DEFEND_ZONE:'DÉFENDEZ CE SECTEUR',DEFEND_CORE:'PROTÉGEZ LE CORE',REINFORCE_ZONE:'RENFORCEZ LA POSITION',RETREAT:'REPLIEZ-VOUS',HOLD_AT_ALL_COSTS:'TENEZ À TOUT PRIX',RETURN_TO_POST:'RETOUR AU POSTE',ASSAULT_ZONE:'ASSAUT GROUPÉ'};
const coreOrders=new Set(['DEFEND_CORE','HOLD_AT_ALL_COSTS']);
const strength=u=>Math.max(.25,u.health/u.maxHealth)*(u.role==='heavy'?1.8:u.role==='marksman'?1.3:u.role==='medic'?.8:1);
const sum=units=>units.reduce((n,u)=>n+strength(u),0);
function position(sim,goal,i,used){
 const f=sim.floor(goal.floor),room=roomAt(f,goal);
 if(goal.floor===-2&&dist(goal,CORE)<200){const a=i*2.4;return nearestWalkable(f,CORE.x+Math.cos(a)*105,CORE.y+Math.sin(a)*105);}
 const covers=f.covers.filter(c=>c.occupant===null&&(!room||insideRoom(room,c))&&dist(c,goal)<260&&!used.some(p=>dist(p,c)<45));
 covers.sort((a,b)=>dist(a,goal)-dist(b,goal));
 const p=covers[0]||{x:goal.x+(i%3-1)*64,y:goal.y+(Math.floor(i/3)%3-1)*64};
 return nearestWalkable(f,room?Math.max(room.x+64,Math.min(room.x+room.w-64,p.x)):p.x,room?Math.max(room.y+64,Math.min(room.y+room.h-64,p.y)):p.y);
}
export function commandOfficer(sim,o){
 if(o.officerID&&o.orderUntil>sim.time||o.deploymentGoal&&sim.time<o.deploymentUntil&&(o.floor!==o.deploymentGoal.floor||dist(o,o.deploymentGoal)>120))return;
 const now=sim.time,alive=sim.units.filter(u=>u.health>0&&!u.transit),local=alive.filter(u=>u.floor===o.floor&&dist(u,o)<=700),friendly=local.filter(u=>u.team==='ally');
 const contacts=sim.units.map(u=>{const report=tacticalContact(sim,o,u);return report?{...u,...report}:null;}).filter(Boolean),hostiles=contacts.filter(u=>u.floor===o.floor&&dist(u,o)<=700);
 const enemyPower=sum(hostiles),allyPower=sum(friendly),health=friendly.reduce((n,u)=>n+u.health/u.maxHealth,0)/Math.max(1,friendly.length);
 const available=friendly.filter(u=>availableTo(sim,o,u,15)&&!(u.autonomyUntil>now));
 const soldiers=available.filter(u=>u.role!=='player'),coreHostiles=alive.filter(u=>u.team==='enemy'&&u.floor===-2&&dist(u,CORE)<1000),coreGuards=alive.filter(u=>u.team==='ally'&&u.floor===-2&&dist(u,CORE)<320);
 const committed=alive.filter(u=>u.team==='ally'&&u.officerID!==o.id&&u.orderUntil>now&&coreOrders.has(u.currentOrder)&&!(u.floor===-2&&dist(u,CORE)<320));
 const coreNeed=Math.max(0,Math.ceil(sum(coreHostiles)*1.35+(sim.coreControl<40?3:1)-sum(coreGuards)-sum(committed)*.7));
 const lastLine=o.floor===-2&&dist(o,CORE)<550&&coreHostiles.length>0;
 const overwhelmed=enemyPower>allyPower*1.3+1;
 const coreEmergency=coreHostiles.length>0&&coreNeed>0&&(sim.coreControl<40||o.floor===-2)&&(!coreOrders.has(o.currentOrder)||lastLine&&sim.coreControl<40&&o.currentOrder!=="HOLD_AT_ALL_COSTS");
 const retreatEmergency=overwhelmed&&health<.45&&o.currentOrder!=='RETREAT'&&!lastLine;
 if(now<o.orderUntil&&!coreEmergency&&!retreatEmergency)return;
 const oldGoal=o.commandGoal||o.orderGoal||o.homePosition;
 const assignedThreat=contacts.some(u=>u.floor===oldGoal.floor&&dist(u,oldGoal)<600);
 if(hostiles.length||assignedThreat)o.lastThreatAt=now;
 const quiet=now-(o.lastThreatAt??0)>=10;
 // A soldier already serving another living officer keeps that command lease.
 const reserve=lastLine?0:Math.min(hostiles.length?3:[-2,0,ROOF_FLOOR].includes(o.floor)?2:1,soldiers.length);
 const spare=Math.max(0,soldiers.length-reserve);
 const targetZones=[];
 for(const f of sim.floors.filter(f=>Math.abs(f.id-o.floor)<=1))for(const z of f.zones){
  if(f.id===-2&&z.id===2)continue;const room=f.rooms[z.id],near=alive.filter(u=>u.floor===f.id&&insideRoom(room,u)),e=contacts.filter(u=>u.floor===f.id&&insideRoom(room,u));if(!e.length&&room.owner!=='enemy')continue;
  const a=near.filter(u=>u.team==='ally'),enroute=alive.filter(u=>u.team==='ally'&&u.officerID!==o.id&&u.orderUntil>now&&u.orderGoal?.floor===f.id&&dist(u.orderGoal,z)<240&&!near.includes(u));
  const need=Math.max(0,Math.ceil(sum(e)*1.2+(room.owner==='enemy'?2:z.strategicValue>=6?1:0)-sum(a)-sum(enroute)*.7));
  if(need>0)targetZones.push({z,need,score:48+Math.min(need,9)*12+z.strategicValue*4+(f.supplies.some(s=>s.roomIndex===room.index)?25:0)+(room.owner==='enemy'?18:0)-dist(o,z)/145-Math.abs(f.id-o.floor)*22});
 }
 targetZones.sort((a,b)=>b.score-a.score);const target=targetZones[0];
 // Retreat only to a position with less enemy pressure, never a fixed blind waypoint.
 const candidates=[o.homePosition,...sim.floor(o.floor).supplies.filter(s=>roomStatus(sim,sim.floor(o.floor),sim.floor(o.floor).rooms[s.roomIndex]).owner==='ally'),...sim.floor(o.floor).connectors].filter(Boolean).map(p=>nearestWalkable(sim.floor(o.floor),p.x,p.y)).filter(p=>dist(o,p)>160);
 const retreats=candidates.map(p=>({p,danger:sum(contacts.filter(u=>u.floor===o.floor&&dist(u,p)<500)),distance:dist(o,p)})).filter(r=>r.danger<enemyPower*.65).sort((a,b)=>(a.danger*200+a.distance)-(b.danger*200+b.distance));
 const retreat=retreats[0]?.p;
 const scores=[{type:'HOLD_POSITION',score:hostiles.length?38+friendly.length*3:25,goal:{x:o.x,y:o.y,floor:o.floor},reason:'Tenir la ligne locale.'}];
 if(coreHostiles.length&&(coreNeed>0||lastLine)&&(spare>0||lastLine))scores.push({type:lastLine&&(sim.coreControl<40||overwhelmed)?'HOLD_AT_ALL_COSTS':'DEFEND_CORE',score:150+Math.min(coreNeed,10)*16+(sim.coreControl<40?75:0)+(sim.coreControl<20?75:0)-Math.abs(o.floor+2)*18-(o.floor>0&&hostiles.length?60:0),goal:{...CORE},need:coreNeed,reason:'Menace Core : '+coreHostiles.length+' hostiles ; renforts nécessaires : '+coreNeed+'.'});
 if(overwhelmed&&retreat&&!lastLine)scores.push({type:'RETREAT',score:90+Math.max(0,enemyPower-allyPower)*16+(1-health)*60,goal:retreat,reason:'Rapport de force défavorable ; repli vers une position moins exposée.'});
 if(overwhelmed&&!retreat&&lastLine)scores.push({type:'HOLD_AT_ALL_COSTS',score:230,goal:{...CORE},reason:'Dernière ligne de défense du Core, aucun repli sûr.'});
 if(hostiles.length&&allyPower>enemyPower*1.7&&spare>=3&&!lastLine){const contact=[...hostiles].sort((a,b)=>dist(o,a)-dist(o,b))[0];scores.push({type:'ASSAULT_ZONE',score:75+Math.min(40,(allyPower-enemyPower)*5),goal:{x:contact.x,y:contact.y,floor:contact.floor},need:Math.ceil(enemyPower*1.6),reason:'Supériorité locale : assaut groupé sous conduite de l’officier, avec garde au poste.'});}
 if(target&&(spare>0||target.z.floor===o.floor&&dist(o,target.z)<400))scores.push({type:target.z.floor===o.floor&&dist(o,target.z)<400?'DEFEND_ZONE':'REINFORCE_ZONE',score:target.score,goal:{x:target.z.x,y:target.z.y,floor:target.z.floor},need:target.need,reason:target.z.name+' manque de '+target.need+' défenseurs. Une garde reste au poste.'});
 if(!hostiles.length&&!assignedThreat&&quiet&&!coreEmergency){
  const displaced=dist(o,o.homePosition)>160||o.floor!==o.homePosition.floor;
  scores.push({type:displaced&&soldiers.length>1?'FOLLOW_OFFICER':'RETURN_TO_POST',score:o.orderSerial>0?65:20,goal:o.homePosition,reason:'Menace repoussée : retour aux postes et libération des renforts.'});
 }
 // Existing detachments retain their mission outside the issuing officer’s radius.
 const detachment=alive.filter(u=>u.officerID===o.id&&u.orderUntil>now);
 const travelling=detachment.some(u=>u.orderGoal&&(u.floor!==u.orderGoal.floor||dist(u,u.orderGoal)>120));
 if(detachment.length&&((assignedThreat&&['REINFORCE_ZONE','DEFEND_CORE','HOLD_AT_ALL_COSTS','ASSAULT_ZONE'].includes(o.currentOrder))||(travelling&&['RETREAT','FOLLOW_OFFICER','REINFORCE_ZONE','ASSAULT_ZONE','DEFEND_CORE'].includes(o.currentOrder)))){
  const activeThreats=contacts.filter(u=>u.floor===oldGoal.floor&&dist(u,oldGoal)<600).length;
  scores.push({type:o.currentOrder,score:o.currentOrder==='RETREAT'?95:Math.min(175,90+activeThreats*12),goal:oldGoal,reason:o.orderReason||'Détachement en mission.'});
 }
 scores.sort((a,b)=>b.score-a.score);let best=scores[0];
 o.orderScores=scores.map(s=>({order:s.type,score:Math.round(s.score)}));
 const previous=scores.find(s=>s.type===o.currentOrder&&s.goal.floor===oldGoal.floor&&dist(s.goal,oldGoal)<150);
 // A small score fluctuation cannot reverse an active tactical decision.
 if(previous&&!coreEmergency&&!retreatEmergency&&best.score<previous.score+18)best=previous;
 const priority=npcPriority(sim,o,best.type,best.goal);
 if(o.orderSerial>0&&priority===o.orderPriority&&best.type===o.currentOrder&&best.goal.floor===oldGoal.floor&&dist(best.goal,oldGoal)<120){
  o.orderUntil=now+15;
  for(const u of alive)if(u.officerID===o.id&&u.orderUntil>now&&canCommand(o,u))u.orderUntil=now+20;
  return;
 }
 const eligible=soldiers.filter(u=>availableTo(sim,o,u,priority));
 let selected=eligible;
 if(best.type==='REINFORCE_ZONE'||best.type==='ASSAULT_ZONE'||best.type==='DEFEND_CORE'&&!lastLine){
  selected=[...eligible].sort((a,b)=>(a.target?600:0)+(1-a.health/a.maxHealth)*300+dist(a,best.goal)-((b.target?600:0)+(1-b.health/b.maxHealth)*300+dist(b,best.goal))).slice(0,Math.min(spare,Math.max(1,best.need||2)));
  if(!selected.length)return;
 }
 const goal=nearestWalkable(sim.floor(best.goal.floor),best.goal.x,best.goal.y);
 o.currentOrder=best.type;o.commandGoal=goal;o.orderGoal=best.type==='REINFORCE_ZONE'?{x:o.x,y:o.y,floor:o.floor}:goal;
 o.orderPriority=priority;o.orderUntil=now+15;o.orderSerial++;o.orderReason=best.reason;o.speech=priorityLabel(priority)+' · '+ORDER_LABELS[best.type];o.speechUntil=now+4;o.pathGoal=null;sim.metrics.officerOrders++;
 const used=alive.filter(u=>u.officerID!==o.id&&u.orderGoal?.floor===goal.floor).map(u=>u.orderGoal);
 const floor=sim.floor(goal.floor),guardRoom=best.type==='DEFEND_ZONE'?roomAt(floor,goal):null;
 const posts=guardRoom?defencePosts(sim,floor,guardRoom,selected,used):[];
 selected.forEach((u,i)=>{
  if(!availableTo(sim,o,u,priority))return;
  if(best.type==='RETURN_TO_POST'){clearOrder(sim,u);return;}const destination=posts[i]||position(sim,goal,i,used);if(destination)used.push(destination);
  sim.releaseCover(u);u.manualOrder=false;u.assaultRole=null;u.formationIndex=i;u.currentOrder=best.type;u.orderPriority=priority;u.officerID=o.id;u.orderUntil=now+20;u.pathGoal=null;u.orderGoal=destination;u.patrolAt=now+20;
 });
 const player=available.find(u=>u.role==='player'&&availableTo(sim,o,u,priority));
 if(player){sim.officerOrder={...goal,priority,type:best.type,label:ORDER_LABELS[best.type],zone:zoneAt(sim.floor(goal.floor),goal.x,goal.y),officer:rankOf(o).short+' '+o.name,commanderID:o.id,time:now,completed:false};}
 if(hostiles.length||assignedThreat||best.type!=='RETURN_TO_POST'&&best.type!=='HOLD_POSITION')sim.log(rankOf(o).short+' '+o.name+' — '+ORDER_LABELS[best.type],best.reason+' '+selected.length+' soldats affectés.','order',goal.floor);
 else if(player&&o.orderSerial===1)sim.log(rankOf(o).short+' '+o.name+' — '+ORDER_LABELS[best.type],'Vous restez libre de votre mouvement.','order',o.floor);
}
