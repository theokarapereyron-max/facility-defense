import {canCommand,rankOf} from './ranks.mjs';
import {CORE,dist} from './map.mjs';
export const PRIORITIES=['Basique','Mineur','Normal','Standard','Important','Prioritaire','Urgent','Très Urgent','Critique','Haute Sécurité','Confinement','Défense Maximale','Menace Rouge','Menace Noire','Protocole Terminal'].map((name,i)=>({value:i+1,code:'P'+String(i+1).padStart(2,'0'),name}));
export const priorityValue=n=>Math.max(1,Math.min(15,Number.isFinite(Number(n))?Math.round(Number(n)):6));
export const priorityLabel=n=>PRIORITIES[priorityValue(n)-1].code;
export function activeOrder(sim,u){
 if(u.role==='player'){
  const order=sim.officerOrder,issuer=sim.units.find(a=>a.id===order?.commanderID);
  return order&&!order.completed&&sim.time-order.time<20&&canCommand(issuer,u)?{issuer,priority:priorityValue(order.priority)}:null;
 }
 if(u.currentOrder==='NORMAL'||u.orderUntil<=sim.time)return null;
 const issuer=sim.units.find(a=>a.id===u.officerID);
 if(canCommand(issuer,u))return {issuer,priority:priorityValue(u.orderPriority)};
 if(!u.officerID&&u.role==='officer')return {issuer:u,priority:priorityValue(u.orderPriority)};
 return null;
}
export function orderPermission(sim,commander,u,priority=6){
 if(!canCommand(commander,u))return {ok:false,reason:'Grade supérieur et même camp requis.'};
 const current=activeOrder(sim,u);if(!current||current.issuer.id===commander.id)return {ok:true};
 const incoming=priorityValue(priority),existing=current.priority,grade=rankOf(commander).index,oldGrade=rankOf(current.issuer).index;
 if(grade<oldGrade)return {ok:false,reason:'Ordre protégé par un donneur de grade supérieur.'};
 if(incoming<existing)return {ok:false,reason:'Priorité insuffisante : '+priorityLabel(existing)+' en cours.'};
 if(grade>oldGrade)return {ok:true};
 // The sole equal-grade exception is the requested player tie-break.
 if(incoming===existing&&commander.role==='player'&&current.issuer.role!=='player')return {ok:true};
 return {ok:false,reason:'Seul un supérieur du donneur peut remplacer cet ordre.'};
}
export function npcPriority(sim,o,type,goal){
 const enemies=sim.units.filter(u=>u.health>0&&!u.transit&&u.team!==o.team),local=enemies.filter(u=>u.floor===o.floor&&dist(u,o)<700),coreEnemies=sim.units.filter(u=>u.team==='enemy'&&u.health>0&&u.floor===CORE.floor&&dist(u,CORE)<1000);
 const coreMission=['DEFEND_CORE','HOLD_AT_ALL_COSTS','ATTACK_CORE'].includes(type)||goal?.floor===CORE.floor&&dist(goal,CORE)<350;
 if(coreMission&&coreEnemies.length){if(sim.coreControl<20)return 15;if(sim.coreControl<40)return 14;if(sim.coreState==='CAPTURING')return 13;if(type==='HOLD_AT_ALL_COSTS')return 12;if(sim.coreState==='CONTESTED')return 11;return 10;}
 if(type==='RETREAT')return o.health<o.maxHealth*.35?11:9;
 if(type==='ATTACK_DOOR'||type==='ATTACK_ELEVATOR')return 8;
 if(['DEFEND_ZONE','REINFORCE_ZONE','ASSAULT_ZONE','ATTACK_FLOOR'].includes(type)){
  const threat=enemies.filter(u=>u.floor===goal?.floor&&dist(u,goal)<600).length;
  return threat>=8?9:threat>=4?8:threat?7:5;
 }
 if(type==='ATTACK_CORE')return goal?.floor===CORE.floor?8:6;
 if(type==='FOLLOW_OFFICER')return local.length?7:4;
 if(type==='RETURN_TO_POST')return 2;
 return local.length>=6?8:local.length?6:3;
}
