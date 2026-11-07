import {ITEMS,inventoryCapacity,occupied,transferStack} from './items.mjs';
import {CORE,ROOF_FLOOR,dist,zoneAt} from './map.mjs';
import {lineOfSight,raycast} from './navigation.mjs';
import {awardExperience} from './ranks.mjs';
import {ALLY_LIMIT} from './director.mjs';
import {furnitureStatus} from './furniture.mjs';
import {earnCredits} from './economy.mjs';
import {useSpecialItem,updateFields} from './special-items.mjs';
export function itemMessage(sim,message,ok=true){const result={ok,message};sim.itemFeedback={...result,id:++sim.itemSerial,time:sim.time};return result;}
const usable=sim=>sim.status==='running'&&sim.player.health>0&&!sim.player.transit;
export function furnitureDistance(p,f){return Math.hypot(Math.max(f.x-p.x,0,p.x-f.x-f.w),Math.max(f.y-p.y,0,p.y-f.y-f.h));}
export function canAccessFurniture(sim,f){
 const p=sim.player;if(!f||f.merchant||!usable(sim)||f.floor!==p.floor||furnitureDistance(p,f)>90)return false;
 // Trace up to the near face, so the furniture itself does not hide its handles.
 const x=Math.max(f.x,Math.min(f.x+f.w,p.x)),y=Math.max(f.y,Math.min(f.y+f.h,p.y)),d=Math.hypot(x-p.x,y-p.y);
 return d<12||raycast(sim.floor(p.floor),p.x,p.y,Math.atan2(y-p.y,x-p.x),Math.max(0,d-10)).d>=d-18;
}
export function nearbyFurniture(sim){return sim.floor(sim.player.floor).props.filter(f=>canAccessFurniture(sim,f)).sort((a,b)=>furnitureDistance(sim.player,a)-furnitureDistance(sim.player,b))[0]||null;}
export function openFurniture(sim,id){const f=sim.floor(sim.player.floor).props.find(f=>f.id===id);if(!canAccessFurniture(sim,f))return false;sim.activeContainer=id;return true;}
export function activeFurniture(sim){const f=sim.floor(sim.player.floor).props.find(f=>f.id===sim.activeContainer);return canAccessFurniture(sim,f)?f:null;}
export function transferItem(sim,direction,index,amount=Infinity){
 const f=activeFurniture(sim);if(!f)return itemMessage(sim,'Approchez le meuble pour échanger du matériel.',false);
 if(direction!=='take'&&direction!=='store')return itemMessage(sim,'Échange indisponible.',false);
 const source=direction==='take'?f.items:sim.player.items,target=direction==='take'?sim.player.items:f.items,capacity=direction==='take'?inventoryCapacity(sim.player):f.capacity,s=source[index];
 if(!s)return itemMessage(sim,'Cette case est vide.',false);
 const name=ITEMS[s.item].name,n=transferStack(source,index,target,capacity,amount);
 if(!n)return itemMessage(sim,direction==='take'?'Inventaire plein : déposez un objet.':'Le meuble n’a plus de place pour cet objet.',false);
 sim.options.onSound?.('supply',sim.player);return itemMessage(sim,n+' × '+name+(direction==='take'?' pris.':' déposé.'));
}
export function takeAll(sim){
 const f=activeFurniture(sim);if(!f)return itemMessage(sim,'Ce rangement n’est plus accessible.',false);
 const credits=f.credits||0;if(credits){earnCredits(sim,credits,'Meuble fouillé');f.credits=0;}
 let total=0;for(let i=0;i<f.capacity;i++)total+=transferStack(f.items,i,sim.player.items,inventoryCapacity(sim.player));
 return itemMessage(sim,total||credits?total+' objets récupérés'+(credits?' · +'+credits+' CR':'')+(occupied(f.items)?' ; le reste demeure dans le meuble.':'.'):'Aucun objet transféré : rangement vide ou inventaire plein.',total>0||credits>0);
}
export function collectCredits(sim){const f=activeFurniture(sim);if(!f)return itemMessage(sim,'Ce rangement n’est plus accessible.',false);const amount=f.credits||0;if(!amount)return itemMessage(sim,'Aucun crédit dans ce meuble.',false);f.credits=0;earnCredits(sim,amount,'Meuble fouillé');return itemMessage(sim,'+'+amount+' CR récupérés.');}
export function dropInventory(sim){
 const p=sim.player;if(!occupied(p.items)){p.items=[];return;}
 const f=sim.floor(p.floor),r=f.rooms.find(r=>p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h);
 f.props.push({id:'dropped-'+sim.deaths,floor:p.floor,roomIndex:r?.index??-1,roomName:zoneAt(f,p.x,p.y),theme:'field',type:'bag',name:'Votre sac abandonné',x:p.x-16,y:p.y-12,w:32,h:24,capacity:inventoryCapacity(p),solid:false,dropped:true,items:p.items.map(s=>s?{...s}:null)});
 p.items=[];
}
export function useItem(sim,index,options={}){
 const p=sim.player,s=p.items[index];
 if(!usable(sim))return itemMessage(sim,'Objet inutilisable pendant ce déplacement ou à terre.',false);
 if(!Number.isInteger(index)||index<0||index>=inventoryCapacity(p)||!s)return itemMessage(sim,'Case vide.',false);
 if(options.room&&s.item!=='radio_target')return itemMessage(sim,'La balise de renforts n’est plus dans cette case.',false);
 if(p.stunnedUntil>sim.time)return itemMessage(sim,'Vous êtes encore désorienté.',false);
 if(sim.time<(p.itemCooldown||0))return itemMessage(sim,'Un instant avant le prochain objet.',false);
 const item=s.item,def=ITEMS[item];if(!def)return itemMessage(sim,'Objet inconnu.',false);
 let message=def.name+' utilisé.';
 if(['bandage','medkit','ration'].includes(item)){
  if(p.health>=p.maxHealth)return itemMessage(sim,'Santé déjà au maximum : objet conservé.',false);
  if(item==='ration'){if(p.regenUntil>sim.time)return itemMessage(sim,'Une ration agit déjà : objet conservé.',false);p.regenUntil=sim.time+10;message='Ration active : récupération de 30 PV en 10 s.';}
  else{const amount=Math.min(p.maxHealth-p.health,item==='bandage'?30:80);p.health+=amount;message='+'+Math.ceil(amount)+' PV · '+def.short+'.';}
 }else if(item==='ammo'){
  const cap=p.weapon==='pistol'?192:480,amount=Math.min(cap-p.reserve,p.weapon==='pistol'?60:120);if(amount<=0)return itemMessage(sim,'Réserve déjà pleine : boîte conservée.',false);p.reserve+=amount;message='+'+amount+' cartouches dans la réserve.';
 }else if(item==='xp'||item==='manual'){const amount=item==='xp'?100:350;awardExperience(sim,amount,def.name,p);message='+'+amount+' XP · '+def.name+'.';
 }else if(item==='armor'){
  if((p.armor||0)>=60)return itemMessage(sim,'Protection intacte : plaque conservée.',false);p.armor=60;message='Protection équipée : 60 dégâts absorbables.';
 }else if(item==='repair'){
  if(p.floor!==-2||dist(p,CORE)>300)return itemMessage(sim,'Rejoignez le Core au niveau −2 pour installer ce module.',false);
  if(sim.coreControl>=100)return itemMessage(sim,'Core déjà à 100 % : module conservé.',false);
  const amount=Math.min(20,100-sim.coreControl);sim.coreControl+=amount;message='Core réparé : +'+Math.ceil(amount)+' points de contrôle.';
 }else if(item==='scanner'){
  if((sim.scans[p.floor]||0)>sim.time)return itemMessage(sim,'Un détecteur est déjà actif sur cet étage.',false);sim.scans[p.floor]=sim.time+15;message='Détection active sur cet étage pendant 15 s.';
 }else if(item==='radio'){
  const available=ALLY_LIMIT-sim.units.filter(u=>u.team==='ally'&&u.health>0).length-sim.supportRequests.reduce((n,r)=>n+r.remaining,0);
  if(available<8)return itemMessage(sim,'Renforts indisponibles : 8 places sont nécessaires dans la garnison.',false);
  sim.supportRequests.push({id:++sim.supportSerial,at:sim.time+12,remaining:8});message='Renforts demandés : 8 alliés sur le toit dans 12 s.';sim.log('APPEL DE RENFORTS','Une escouade combinée se dirige vers l’hélipad.','success',ROOF_FLOOR);
 }else if(item==='breach'){
  const door=sim.floor(p.floor).doors.map(d=>({d,p:{x:d.x+d.w/2,y:d.y+d.h/2}})).filter(({d,p:target})=>d.state!=='DESTROYED'&&d.open<.72&&dist(p,target)<140&&Math.cos(Math.atan2(target.y-p.y,target.x-p.x)-p.angle)>.25&&raycast(sim.floor(p.floor),p.x,p.y,Math.atan2(target.y-p.y,target.x-p.x),Math.max(0,dist(p,target)-28)).d>=dist(p,target)-36).sort((a,b)=>dist(p,a.p)-dist(p,b.p))[0];
  if(!door)return itemMessage(sim,'Visez une porte fermée à proximité : charge conservée.',false);sim.destroyDoor(sim.floor(p.floor),door.d);message='Porte neutralisée : passage ouvert.';
 }else if(item==='grenade'||item==='flash'){
  const ray=raycast(sim.floor(p.floor),p.x,p.y,p.angle,430),range=Math.max(0,ray.d-(ray.wall?20:0));
  sim.projectiles.push({id:++sim.projectileSerial,item,floor:p.floor,startX:p.x,startY:p.y,x:p.x,y:p.y,endX:p.x+Math.cos(p.angle)*range,endY:p.y+Math.sin(p.angle)*range,age:0,fuse:1.2,owner:p.id});message=def.short+' lancée !';
 }else{
  const result=useSpecialItem(sim,item,options);if(!result)return itemMessage(sim,'Cet objet n’a pas d’effet disponible.',false);
  if(!result.ok)return {...itemMessage(sim,result.message,false),...(result.selection?{selection:result.selection,index}: {})};message=result.message;
 }
 s.count--;if(!s.count)p.items[index]=null;p.itemCooldown=sim.time+.25;
 sim.options.onSound?.(['grenade','flash','breach'].includes(item)?'door':'supply',p);return itemMessage(sim,message);
}
export function updateInventory(sim,dt){
 updateFields(sim,dt);
 const p=sim.player;if(p.health>0&&p.regenUntil>sim.time-dt)p.health=Math.min(p.maxHealth,p.health+3*Math.min(dt,Math.max(0,p.regenUntil-(sim.time-dt))));
 for(const u of sim.units)if(u.team==='enemy'&&u.health>0&&(sim.scans[u.floor]||0)>sim.time)u.seenAt=sim.time;
 for(const g of sim.projectiles){
  g.age+=dt;const t=Math.min(1,g.age/.65);g.x=g.startX+(g.endX-g.startX)*t;g.y=g.startY+(g.endY-g.startY)*t;
  if(g.age<g.fuse)continue;
  if(g.item==='smoke'||g.item==='incendiary'){sim.fields.push({id:g.id,type:g.item==='smoke'?'smoke':'fire',x:g.x,y:g.y,floor:g.floor,owner:g.owner,radius:g.item==='smoke'?200:160,until:sim.time+(g.item==='smoke'?15:8)});sim.options.onSound?.('explosion',g);continue;}
  const radius=g.item==='flash'?220:180,attacker=sim.units.find(u=>u.id===g.owner)||sim.player;
  for(const u of sim.units){if(u.health<=0||u.transit||u.floor!==g.floor||dist(u,g)>radius||!lineOfSight(sim.floor(g.floor),g,u))continue;
   if(g.item==='flash'){u.stunnedUntil=Math.max(u.stunnedUntil||0,sim.time+(u.role==='player'?1.2:3));u.target=null;}
   else sim.damage(u,Math.round(150*(1-.65*dist(u,g)/radius)),attacker);
  }
  sim.lastCombatAt[g.floor]=sim.time;sim.effects.push({type:g.item==='flash'?'flash':'explosion',floor:g.floor,x:g.x,y:g.y,life:.8,max:.8,radius});sim.options.onSound?.(g.item==='flash'?'flash':'explosion',g);
 }
 sim.projectiles=sim.projectiles.filter(g=>g.age<g.fuse);
}
export function inventorySnapshot(sim){
 const p=sim.player,capacity=inventoryCapacity(p),f=activeFurniture(sim),copy=s=>s?{...s}:null;
 return {inventory:Array.from({length:capacity},(_,i)=>copy(p.items[i])),inventoryCapacity:capacity,inventoryUsed:occupied(p.items),armor:Math.ceil(p.armor||0),regeneration:Math.max(0,Math.ceil((p.regenUntil||0)-sim.time)),scanRemaining:Math.max(0,Math.ceil((sim.scans[p.floor]||0)-sim.time)),itemFeedback:sim.itemFeedback&&sim.time-sim.itemFeedback.time<4?sim.itemFeedback:null,
  activeEffects:[['Stase hostile',sim.enemyFreezeUntil],['Core protégé',sim.coreShieldUntil],['Mobilité +25 %',p.speedBoostUntil],['Cadence accélérée',p.fireBoostUntil]].filter(([,end])=>end>sim.time).map(([label,end])=>({label,remaining:Math.ceil(end-sim.time)})),
  container:f?{id:f.id,name:f.name,roomName:f.roomName,credits:f.credits||0,capacity:f.capacity,type:f.type,solid:f.solid,status:furnitureStatus(f),used:occupied(f.items),items:Array.from({length:f.capacity},(_,i)=>copy(f.items[i]))}:null,
  supportRequests:sim.supportRequests.map(r=>({count:r.remaining,target:r.target?.name,remaining:Math.max(0,Math.ceil(r.at-sim.time))}))};
}
