import {roomStatus} from './room-state.mjs';
import {nearestWalkable,dist,canStand,CORE} from './map.mjs';
import {formationPoint} from './commands.mjs';
import {ALLY_LIMIT} from './director.mjs';
import {createShop} from './shops.mjs';
import {RANKS} from './ranks.mjs';
import {npcPriority} from './priorities.mjs';
export const RELIEF_INTERVAL=45,RELIEF_LIMIT=12;
export const CORE_RELIEF_PLANS=[
 {id:'core-security',roomIndex:10,interval:150,leader:'Capitaine',soldier:null,label:'Sécurité Core',detail:'Un capitaine et deux gardes rejoignent la sécurité du Core.'},
 {id:'core-command',roomIndex:2,interval:330,leader:'Commandant',soldier:'Soldat de première classe',label:'Garde du Core',detail:'Un commandant et deux soldats de première classe rejoignent le Core.'}
];
// These rooms serve as staffed guard posts, including security/monitoring posts.
export const GUARD_ROOMS={'-2':[10,16],'-1':[13,16],'0':[2,11,12,15,16],'1':[16],'2':[6,16],'3':[11,16],'4':[11,16],'5':[7]};
export function setupServices(sim){
 sim.reliefPosts=[];sim.nextRelief=RELIEF_INTERVAL;sim.nextShopRestock=180;sim.reliefCursor=0;sim.reliefBudget=0;
 for(const f of sim.floors){
  f.shop=f.isRoof?null:createShop(f);
  f.guardPosts=(GUARD_ROOMS[f.id]||[]).map(index=>{const r=f.rooms[index];return {...nearestWalkable(f,r.x+r.w/2,r.y+r.h/2),id:'guard-'+f.id+'-'+index,roomIndex:index,name:r.name};});
  for(const post of f.guardPosts)sim.reliefPosts.push({...post,kind:'guard',pending:0});
  for(const post of f.supplies)sim.reliefPosts.push({...post,kind:'medic',pending:0});
 }
 const f=sim.floor(CORE.floor);
 sim.coreReliefs=CORE_RELIEF_PLANS.map(plan=>{const r=f.rooms[plan.roomIndex],p=plan.id==='core-command'?CORE:{x:r.x+r.w/2,y:r.y+r.h/2};return {...plan,...nearestWalkable(f,p.x,p.y),next:plan.interval,pending:false,leaderRank:RANKS.find(r=>r.title===plan.leader).index,soldierRank:plan.soldier?RANKS.find(r=>r.title===plan.soldier).index:undefined};});
}
function positions(sim,post,count){
 const f=sim.floor(post.floor),room=f.rooms[post.roomIndex],spots=[],near=sim.units.filter(u=>u.health>0&&!u.transit&&u.floor===post.floor);
 if(roomStatus(sim,f,room).owner!=='ally')return null;
 for(let i=0;i<count;i++){
  let chosen;
  for(let j=i;j<90;j++){
   const p=formationPoint(sim,{...post,bounds:room},j,34);
   if(!canStand(f,p.x,p.y,11)||dist(p,post)>300||p.x<room.x+32||p.x>room.x+room.w-32||p.y<room.y+32||p.y>room.y+room.h-32)continue;
   if(near.some(u=>dist(u,p)<(u.team==='enemy'?140:25))||spots.some(q=>dist(q,p)<26))continue;
   chosen=p;break;
  }
  if(!chosen)return null;spots.push(chosen);
 }
 return spots;
}
export function directRelief(sim){
 if(sim.time>=sim.nextRelief){
  const cycles=1+Math.floor((sim.time-sim.nextRelief)/RELIEF_INTERVAL);
  // A single shared allowance per interval; missed or blocked cycles never stack.
  sim.reliefBudget=RELIEF_LIMIT;for(const p of sim.reliefPosts)p.pending=1;
  sim.nextRelief+=cycles*RELIEF_INTERVAL;
 }
 if(sim.reliefBudget<=0)return;
 let guards=0,medics=0,available=ALLY_LIMIT-sim.units.filter(u=>u.team==='ally'&&u.health>0).length-sim.supportRequests.reduce((n,r)=>n+r.remaining,0);
 // Continue after the last served post, sharing the 12 places across the facility.
 const posts=sim.reliefPosts,offset=sim.reliefCursor;
 const order=Array.from({length:posts.length},(_,j)=>(j+offset)%posts.length).sort((a,b)=>(posts[a].lastServed??-1)-(posts[b].lastServed??-1));
 for(let j=0;j<posts.length;j++){
  if(sim.reliefBudget<=0||available<=0)break;
  const index=order[j],post=posts[index],count=post.kind==='guard'?3:1;if(!post.pending||available<count||sim.reliefBudget<count)continue;
  const points=positions(sim,post,count);if(!points)continue;
  const squad='releve-'+(++sim.squadSerial);let officer;
  points.forEach((p,i)=>{
   const role=post.kind==='medic'?'medic':i===0?'officer':'soldier',u=sim.makeUnit('ally',role,p);
   Object.assign(u,{reliefPost:post.id,homePosition:{...p},homeZone:post.name,squadID:squad,formationIndex:i});
   if(i===0)officer=u;
   if(post.kind==='guard'&&i>0){u.officerID=officer.id;u.currentOrder='HOLD_POSITION';u.orderPriority=3;u.orderGoal={...p};u.orderUntil=sim.time+15;}
   if(sim.coreState!=='SECURE'){u.deploymentGoal=formationPoint(sim,CORE,i,22);u.deploymentUntil=sim.time+180;}
  });
  post.pending=0;post.lastServed=sim.time;available-=count;sim.reliefBudget-=count;sim.reliefCursor=(index+1)%posts.length;if(post.kind==='guard')guards+=3;else medics++;
 }
 if(guards||medics){sim.metrics.reliefGuards=(sim.metrics.reliefGuards||0)+guards;sim.metrics.reliefMedics=(sim.metrics.reliefMedics||0)+medics;sim.log('RELÈVE INTÉRIEURE',guards+' gardes rejoignent les postes · '+medics+' médecins rejoignent les ravitaillements.','success');}
}
export function directCoreRelief(sim){
 for(const post of sim.coreReliefs){
  if(sim.time>=post.next){post.pending=true;post.next+=post.interval*(1+Math.floor((sim.time-post.next)/post.interval));}
  if(!post.pending)continue;
  const available=ALLY_LIMIT-sim.units.filter(u=>u.team==='ally'&&u.health>0).length-sim.supportRequests.reduce((n,r)=>n+r.remaining,0);
  if(available<3)continue;
  const points=positions(sim,post,3);if(!points)continue;
  const squad='garde-core-'+(++sim.squadSerial),type=post.id==='core-command'?'DEFEND_CORE':'DEFEND_ZONE';let leader;
  points.forEach((p,i)=>{
   const u=sim.makeUnit('ally',i===0?'officer':'soldier',p,i===0?post.leaderRank:post.soldierRank);
   Object.assign(u,{coreReliefID:post.id,homePosition:{...p},homeZone:sim.floor(post.floor).rooms[post.roomIndex].name,squadID:squad,formationIndex:i,currentOrder:type,orderGoal:{...p},commandGoal:{...p},orderUntil:sim.time+(i===0?15:20)});
   if(i===0)leader=u;else u.officerID=leader.id;
   u.orderPriority=npcPriority(sim,leader,type,post);u.goal={...p};u.state='DEFEND';
  });
  post.pending=false;sim.metrics.coreReinforcements=(sim.metrics.coreReinforcements||0)+3;
  sim.log('RENFORT — '+post.label.toUpperCase(),post.detail,'success',post.floor);
 }
}
