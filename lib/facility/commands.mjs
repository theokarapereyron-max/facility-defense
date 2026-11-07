import {defencePosts} from './squad-tactics.mjs';
import {CORE,dist,nearestWalkable,zoneAt} from './map.mjs';
import {canCommand,rankOf,ROLE_NAMES} from './ranks.mjs';
import {orderPermission,priorityValue,priorityLabel} from './priorities.mjs';
export const COMMANDS=[{key:'W',type:'FOLLOW_OFFICER',label:'Suivez-moi'},{key:'X',type:'HOLD_POSITION',label:'Restez ici'},{key:'C',type:'DEFEND_CORE',label:'Gardez le Core'},{key:'V',type:'DEFEND_ZONE',label:'Gardez une salle'},{key:'N',type:'NORMAL',label:'Retour à la normale'},{key:'B',type:'ATTACK_NEAREST',label:'Ennemis proches'}];
export const RADIUS={min:100,max:700,step:50};
export function clearOrder(sim,u){sim.releaseCover(u);Object.assign(u,{currentOrder:'NORMAL',officerID:null,orderUntil:0,orderPriority:0,orderGoal:null,assaultRole:null,manualOrder:false,goal:null,path:[],pathGoal:null,connector:null,autonomousCore:false,nextThink:sim.time});}
export function availableTo(sim,commander,u,priority=commander.role==='player'?sim.commandPriority:commander.orderPriority||6){return orderPermission(sim,commander,u,priority).ok;}
export function formationPoint(sim,goal,index,spread=55){
 const angle=index*2.399963,radius=index?spread*Math.sqrt(index):0;
 let x=goal.x+Math.cos(angle)*radius,y=goal.y+Math.sin(angle)*radius;if(goal.bounds){const r=goal.bounds;x=Math.max(r.x+64,Math.min(r.x+r.w-64,x));y=Math.max(r.y+64,Math.min(r.y+r.h-64,y));}return nearestWalkable(sim.floor(goal.floor),x,y);
}
export function commandTargets(sim){
 const p=sim.player,selected=sim.selectedIDs.size>0;
 return sim.units.filter(u=>u.role!=='player'&&!u.transit&&availableTo(sim,p,u)&&(selected?sim.selectedIDs.has(u.id):u.floor===p.floor&&dist(p,u)<=sim.commandRadius));
}
export function issueCommand(sim,type,room){
 if(sim.status!=='running'||sim.player.health<=0||sim.player.transit)return {count:0,reason:'Commandement indisponible.'};
 if(!COMMANDS.some(c=>c.type===type))return {count:0,reason:'Ordre inconnu.'};
 let destination={x:sim.player.x,y:sim.player.y,floor:sim.player.floor};
 if(type==='DEFEND_CORE')destination={...CORE};
 if(type==='DEFEND_ZONE'){
  const f=sim.floors.find(f=>f.id===room?.floor),r=f?.rooms.find(r=>r.index===room?.index);
  if(!r)return {count:0,reason:'Choisissez une salle valide.'};
  destination={...nearestWalkable(f,r.x+r.w/2,r.y+r.h/2),bounds:r};
 }
 const units=commandTargets(sim),p=sim.player,priority=priorityValue(sim.commandPriority);
 const posts=type==='DEFEND_ZONE'?defencePosts(sim,sim.floor(destination.floor),destination.bounds,units):[];
 units.forEach((u,i)=>{
  clearOrder(sim,u);
  if(type==='NORMAL'){u.autonomyUntil=sim.time+15;return;}
  Object.assign(u,{currentOrder:type,officerID:p.id,manualOrder:true,orderUntil:Infinity,orderPriority:priority,formationIndex:i,orderGoal:type==='FOLLOW_OFFICER'||type==='ATTACK_NEAREST'?null:posts[i]||formationPoint(sim,destination,i,type==='DEFEND_CORE'?25:48),orderReason:priorityLabel(priority)+' · ordre du joueur — '+rankOf(p).name});
 });
 const label=COMMANDS.find(c=>c.type===type).label;
 const message=units.length?priorityLabel(priority)+' · '+label+' · '+units.length+' subordonné'+(units.length>1?'s':''):'Aucun subordonné disponible : vérifiez le grade, la portée et la priorité de son ordre.';
 sim.commandFeedback={message,time:sim.time,count:units.length};
 if(units.length)sim.log(priorityLabel(priority)+' — '+label.toUpperCase(),units.length+' soldats · '+(type==='DEFEND_ZONE'?zoneAt(sim.floor(destination.floor),destination.x,destination.y):rankOf(p).name),'order',destination.floor);
 return {count:units.length,reason:message};
}
export function selectedStats(sim){return sim.units.filter(u=>sim.selectedIDs.has(u.id)&&u.health>0).map(u=>({id:u.id,name:u.name||ROLE_NAMES[u.role]+' '+u.id,role:ROLE_NAMES[u.role],rank:rankOf(u).name,number:rankOf(u).number,health:Math.ceil(u.health),maxHealth:u.maxHealth,floor:u.floor,state:u.state,order:u.currentOrder,priority:u.orderPriority||0,commander:sim.units.find(a=>a.id===u.officerID)?.name||null,blockedReason:orderPermission(sim,sim.player,u,sim.commandPriority).reason||null,commandable:availableTo(sim,sim.player,u)}));}
