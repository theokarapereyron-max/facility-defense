import {roomStatus} from './room-state.mjs';
import {ITEMS,inventoryCapacity,storageSpace,addItems} from './items.mjs';
import {nearestWalkable,dist,canStand} from './map.mjs';
import {categoryFor} from './shop-categories.mjs';
import {lineOfSight,raycast} from './navigation.mjs';
export const PRICES={grenade:110,flash:90,bandage:55,medkit:130,ration:65,ammo:95,xp:240,manual:720,radio:700,repair:320,armor:200,breach:140,scanner:140,xp_major:2600,stasis:950,core_rebuild:1800,radio_target:950,door_kit:150,trauma:260,team_med:360,armor_heavy:480,adrenaline:250,overdrive:380,incendiary:180,smoke:95,recon:500,core_shield:650,door_armor:240,reserve_pack:260};
Object.assign(PRICES,{});
const BASIC=['grenade','flash','bandage','medkit','ration','ammo','xp','manual','radio','repair','armor','breach','scanner'];
const DEPARTMENTS={
 '-2':{name:'Génie & infrastructure',room:13,special:['core_rebuild','core_shield','door_kit','door_armor','armor_heavy'],discount:['repair','core_rebuild','core_shield','door_kit']},
 '-1':{name:'Arsenal logistique',room:2,special:['incendiary','smoke','armor_heavy','reserve_pack','door_armor','overdrive','door_kit'],discount:['ammo','grenade','armor','reserve_pack','breach']},
 '0':{name:'Intendance de sécurité',room:14,special:['radio_target','stasis','smoke','door_kit','team_med'],discount:['radio','radio_target','flash','scanner']},
 '1':{name:'Pharmacie militaire',room:6,special:['trauma','team_med','adrenaline','xp_major'],discount:['bandage','medkit','ration','trauma','team_med']},
 '3':{name:'Atelier d’ingénierie',room:18,special:['recon','xp_major','stasis','door_kit','door_armor'],discount:['repair','scanner','door_kit']},
 '4':{name:'Appui aérien',room:18,special:['radio_target','overdrive','armor_heavy','reserve_pack','team_med','smoke'],discount:['radio','radio_target','reserve_pack','armor_heavy']},
 '2':{name:'Équipement du commandement',room:2,special:['xp_major','stasis','recon','radio_target','overdrive'],discount:['manual','xp','xp_major','recon','scanner']}
};
export function createShop(f){
 const d=DEPARTMENTS[f.id];if(!d)return null;const r=f.rooms[f.shopRoomIndex];
 let pos;
 for(let y=r.y+96;y<r.y+r.h-64&&!pos;y+=32)for(let x=r.x+96;x<r.x+r.w-64;x+=32){
  const candidate=nearestWalkable(f,x,y);
  if(!canStand(f,candidate.x,candidate.y,38)||f.supplies.some(s=>dist(s,candidate)<180)||f.connectors.some(c=>dist(c,candidate)<160))continue;
  pos=candidate;break;
 }
 pos??=nearestWalkable(f,r.x+r.w/2,r.y+r.h/2);
 const stands=f.props.filter(p=>p.merchant&&p.roomIndex===r.index).map(p=>({id:p.id,x:p.x+p.w/2,y:p.y+p.h+32,floor:f.id,category:p.category,name:p.name}));
 const counter=stands.find(p=>p.category==='all');if(counter)pos={x:counter.x,y:counter.y,floor:f.id};
 const additions=[];
 return {...pos,stands,room:r,id:'shop-'+f.id,name:d.name,roomIndex:r.index,roomName:r.name,offers:[...BASIC,...d.special,...additions].map(item=>{const preferred=d.discount.includes(item),maxStock=BASIC.includes(item)?preferred?12:6:preferred?3:2;return {item,category:categoryFor(item),price:Math.round(PRICES[item]*(preferred?.85:1)/5)*5,preferred,stock:maxStock,maxStock};})};
}
const MARKET_EVENTS=[{category:'medical',name:'Relève médicale',detail:'Le convoi de soins réduit les prix de ce rayon.'},{category:'support',name:'Convoi du génie',detail:'Une livraison technique soutient vos interventions.'},{category:'combat',name:'Réserve de l’arsenal',detail:'La logistique libère un surplus de matériel de combat.'},{category:'protection',name:'Protocole de protection',detail:'Les équipements défensifs bénéficient d’une dotation prioritaire.'},{category:'intelligence',name:'Appui du commandement',detail:'Préparez votre reconnaissance et votre progression.'}];
export function marketEvent(sim,shop){const cycle=Math.floor(sim.time/180),elapsed=sim.time%180;if(cycle<1||elapsed>=60)return null;const event=MARKET_EVENTS[(cycle+shop.floor+2)%MARKET_EVENTS.length];return {...event,discount:20,remaining:Math.ceil(60-elapsed),id:shop.id+'-'+cycle};}
export function quoteOffer(sim,shop,offer){const event=marketEvent(sim,shop),sale=event?.category===offer.category;return {...offer,basePrice:offer.price,price:sale?Math.max(5,Math.round(offer.price*.8/5)*5):offer.price,sale:!!sale};}
export function shopAccessReason(sim,shop){
 const p=sim.player;if(!shop||sim.status!=='running'||p.health<=0||p.transit||p.stunnedUntil>sim.time)return 'Achat indisponible pendant ce déplacement ou à terre.';
 const f=sim.floor(shop.floor),state=roomStatus(sim,f,shop.room);
 if(state.owner!=='ally')return 'Reprenez cette boutique avec votre équipe.';if(state.contested||state.enemies>0)return 'Sécurisez la boutique : des ennemis occupent encore la salle.';
 if(p.floor!==shop.floor||!accessibleStand(sim,shop))return 'Approchez-vous d’un comptoir de cette salle.';return '';
}
export function shopMessage(sim,message,ok=false){sim.shopFeedback={message,ok,time:sim.time};return {ok,message};}
export function accessibleStand(sim,shop){
 const p=sim.player;if(!shop||sim.status!=='running'||p.health<=0||p.transit||(p.stunnedUntil||0)>sim.time||p.floor!==shop.floor)return null;
 const r=shop.room,state=roomStatus(sim,sim.floor(p.floor),r);if(state.owner!=='ally'||state.enemies>0)return null;if(p.x<=r.x+32||p.x>=r.x+r.w-32||p.y<=r.y+32||p.y>=r.y+r.h-32)return null;
 return shop.stands.filter(t=>dist(p,t)<125&&lineOfSight(sim.floor(p.floor),p,t)).sort((a,b)=>dist(p,a)-dist(p,b))[0]||null;
}
export const canAccessShop=(sim,shop)=>!!accessibleStand(sim,shop);
export function nearbyShop(sim){const shop=sim.floor(sim.player.floor).shop,stand=accessibleStand(sim,shop);return stand?{...shop,activeCategory:stand.category}:null;}
export function buyItem(sim,shopID,item,quantity=1,expectedPrice=null){
 const shop=sim.floors.map(f=>f.shop).find(s=>s?.id===shopID),offer=shop?.offers.find(o=>o.item===item),p=sim.player;
 if(!canAccessShop(sim,shop))return shopMessage(sim,shopAccessReason(sim,shop));
 if(!offer||!ITEMS[item])return shopMessage(sim,'Cet équipement n’est pas vendu ici.');
 if(!Number.isInteger(quantity)||quantity<1||quantity>25)return shopMessage(sim,'Quantité invalide. Aucun crédit débité.');
 if(offer.stock<quantity)return shopMessage(sim,'Stock insuffisant pour cette quantité : aucun achat effectué.');
 const quoted=quoteOffer(sim,shop,offer),cost=quoted.price*quantity;
 if(expectedPrice!==null&&expectedPrice!==quoted.price)return shopMessage(sim,'Le prix a changé depuis votre aperçu. Vérifiez le nouveau total avant de confirmer.');
 if((p.credits||0)<cost)return shopMessage(sim,'Crédits insuffisants : il manque '+(cost-(p.credits||0))+' CR.');
 if(storageSpace(p.items,inventoryCapacity(p),item)<quantity)return shopMessage(sim,'Inventaire plein pour cette quantité : achat annulé.');
 if(addItems(p.items,inventoryCapacity(p),item,quantity)!==quantity)return shopMessage(sim,'L’objet n’a pas pu être rangé. Aucun crédit débité.');
 p.credits-=cost;offer.stock-=quantity;sim.options.onSound?.('supply',p);return shopMessage(sim,quantity+' × '+ITEMS[item].name+' acheté · −'+cost+' CR.',true);
}
export function restockShops(sim){
 if(sim.time<sim.nextShopRestock)return;
 const cycles=1+Math.floor((sim.time-sim.nextShopRestock)/180);sim.nextShopRestock+=cycles*180;
 for(const f of sim.floors)for(const o of f.shop?.offers||[])o.stock=Math.min(o.maxStock,o.stock+cycles*(BASIC.includes(o.item)?3:1));
 const shop=sim.floor(sim.player.floor).shop,event=shop&&marketEvent(sim,shop);if(event)sim.log('CONVOI · '+event.name,event.detail+' −20 % pendant '+event.remaining+' s.','success',shop.floor);
}
export function shopSnapshot(sim){return {credits:sim.player.credits||0,moneyEvents:sim.moneyEvents.filter(e=>sim.time-e.time<3),shopFeedback:sim.shopFeedback&&sim.time-sim.shopFeedback.time<6?sim.shopFeedback:null,nextShopRestock:Math.max(0,Math.ceil(sim.nextShopRestock-sim.time)),shops:sim.floors.filter(f=>f.shop).map(f=>({...f.shop,control:roomStatus(sim,f,f.shop.room),accessible:canAccessShop(sim,f.shop),accessReason:shopAccessReason(sim,f.shop),event:marketEvent(sim,f.shop),offers:f.shop.offers.map(o=>quoteOffer(sim,f.shop,o))}))};}
