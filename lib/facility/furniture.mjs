import {preservesCirculation} from './placement.mjs';
import {roomStatus} from './room-state.mjs';
import {ITEMS,occupied} from './items.mjs';
import {TILE as T,COLS} from './world-config.mjs';
import {SHOP_CATEGORIES} from './shop-categories.mjs';
export const FURNITURE={
 counter:{name:'Comptoir d’intendance',w:6,h:2,capacity:0},stand:{name:'Présentoir spécialisé',w:5,h:2,capacity:0},
 desk:{name:'Bureau à tiroirs',w:4,h:2,capacity:4},drawer:{name:'Caisson à tiroirs',w:2,h:2,capacity:2},
 shelf:{name:'Étagère',w:2,h:4,capacity:6},locker:{name:'Armoire militaire',w:2,h:3,capacity:8},
 table:{name:'Table de service',w:4,h:2,capacity:2},crate:{name:'Caisse logistique',w:3,h:3,capacity:6},
 box:{name:'Boîte de stockage',w:2,h:2,capacity:3},cabinet:{name:'Placard',w:3,h:2,capacity:5},
 workbench:{name:'Établi équipé',w:4,h:2,capacity:4},medical:{name:'Chariot médical',w:3,h:2,capacity:4},
 bed:{name:'Lit avec coffre',w:3,h:5,capacity:2},sofa:{name:'Banquette avec rangement',w:4,h:2,capacity:2},
 vehicle:{name:'Véhicule · coffre',w:6,h:3,capacity:5},
 hatch:{name:'Trappe de maintenance',w:2,h:2,capacity:3,solid:false},jar:{name:'Paillasse · bocaux',w:2,h:2,capacity:1}
};
const THEMES={
 shop:{types:['counter','stand','stand','stand','stand','stand'],pool:[]},
 laboratory:{types:['workbench','cabinet','jar','cabinet','medical'],pool:['xp','scanner','repair','bandage','manual']},
 medical:{types:['medical','cabinet','bed','jar','drawer'],pool:['bandage','bandage','medkit','medkit','xp','ration']},
 dorm:{types:['bed','locker','bed','drawer','table'],pool:['ration','ration','bandage','ammo','manual']},
 rest:{types:['sofa','table','cabinet','drawer'],pool:['ration','ration','bandage','manual']},
 kitchen:{types:['table','cabinet','jar','crate','table'],pool:['ration','ration','ration','bandage']},
 sanitary:{types:['cabinet','box','hatch'],pool:['bandage','bandage','medkit']},
 training:{types:['locker','crate','table','box'],pool:['ammo','ammo','flash','armor','manual','bandage']},
 armory:{types:['locker','crate','workbench','shelf','box'],pool:['ammo','ammo','grenade','grenade','flash','armor','breach','bandage']},
 garage:{types:['vehicle','workbench','crate','shelf','box'],pool:['ammo','ammo','repair','bandage','breach','armor']},
 storage:{types:['shelf','crate','box','workbench','crate'],pool:['ammo','ration','bandage','repair','armor','grenade']},
 workshop:{types:['crate','workbench','hatch','cabinet'],pool:['repair','repair','scanner','bandage','breach']},
 records:{types:['cabinet','cabinet','desk','hatch'],pool:['repair','repair','scanner','manual']},
 core:{types:['cabinet','desk','cabinet','workbench'],pool:['repair','repair','medkit','scanner','ammo']},
 archive:{types:['shelf','desk','cabinet','drawer'],pool:['manual','manual','scanner','bandage']},
 operations:{types:['desk','table','cabinet','cabinet','drawer'],pool:['manual','scanner','scanner','radio','bandage','ammo']},
 security:{types:['desk','locker','crate','drawer'],pool:['ammo','ammo','grenade','flash','armor','bandage','radio']},
 office:{types:['desk','drawer','cabinet','table'],pool:['manual','bandage','ration','scanner']},
 roof:{types:['box','hatch','crate','box'],pool:['repair','ammo','bandage','scanner']},
 helipad:{types:['crate','box','hatch'],pool:['ammo','ration','bandage','radio']}
};
function themeFor(r,f){
 if(r.type==='shop')return 'shop';
 const n=r.name;
 if(/LABORATOIRE|PROTOTYPE|EXPÉRIMENTAL|DÉCONTAMINATION/.test(n))return 'laboratory';
 if(n==='THE CORE')return 'core';
 if(/INFIRMERIE|MÉDICAL|PHARMACIE|RÉÉDUCATION/.test(n))return 'medical';
 if(/CHAMBR|DORTOIR/.test(n))return 'dorm';
 if(/REPOS/.test(n))return 'rest';if(/CUISINE|CANTINE/.test(n))return 'kitchen';if(/SANITAIRE/.test(n))return 'sanitary';
 if(/ENTRAÎNEMENT|VESTIAIRE/.test(n))return 'training';if(/ARMURERIE/.test(n))return 'armory';
 if(/GARAGE|PARKING|ATELIER|RÉPARATIONS/.test(n))return 'garage';if(/ARCHIVE/.test(n))return 'archive';
 if(/COMMAND|OPERATIONS|COMMUNICATION|BRIEFING|TACTIQUE|SURVEILLANCE/.test(n))return 'operations';
 if(/SÉCURITÉ|SÉCURIT|CHECKPOINT|SAS|GARDE/.test(n))return 'security';
 if(f.isRoof)return r.type==='helipad'||/HÉLIPAD/.test(n)?'helipad':'roof';
 if(/SERVEUR|RÉSEAU/.test(n))return 'records';
 if(/GÉNÉRATEUR|REFROIDISSEMENT|ALIMENTATION|THERMIQUE|POMPES|CIRCUITS|TECHNIQUE|MAINTENANCE|INFRASTRUCTURE|TUNNEL/.test(n))return 'workshop';
 if(/STOCKAGE|ENTREPÔT|RÉSERVE|LIVRAISON|DÉTACHÉE|LOGISTIQUE/.test(n))return 'storage';
 return 'office';
}
function random(seed){let state=seed|0;return()=>{state=(Math.imul(state,1664525)+1013904223)|0;return (state>>>0)/4294967296;};}
function canPlace(f,r,x,y,w,h){
 if(x<r.x/T+1||y<r.y/T+1||x+w>(r.x+r.w)/T-1||y+h>(r.y+r.h)/T-1)return false;
 for(let yy=y-1;yy<=y+h;yy++)for(let xx=x-1;xx<=x+w;xx++){const v=f.grid[yy*COLS+xx];if(v===2||v===3||xx>=x&&xx<x+w&&yy>=y&&yy<y+h&&v!==0)return false;}
 const near=(p,d)=>Math.hypot(Math.max(x*T-p.x,0,p.x-(x+w)*T),Math.max(y*T-p.y,0,p.y-(y+h)*T))<d;
 if(f.connectors.some(p=>near(p,140))||f.supplies.some(p=>near(p,110)))return false;
 if(f.id===-2&&near({x:3104,y:704},245))return false;
 if(r.type==='helipad'&&near({x:r.x+r.w/2,y:r.y+r.h/2},270))return false;
 if(f.props.some(p=>x*T<p.x+p.w+24&&(x+w)*T>p.x-24&&y*T<p.y+p.h+24&&(y+h)*T>p.y-24))return false;
 const cells=[];for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)cells.push(yy*COLS+xx);
 return preservesCirculation(f,r,cells);
}
function poolFor(p){
 if(['bed','sofa','table'].includes(p.type)&&['dorm','rest','kitchen'].includes(p.theme))return ['ration','bandage'];
 if(p.type==='jar')return p.theme==='medical'?['xp','bandage','medkit']:['ration'];
 if(['crate','box','hatch'].includes(p.type))return ['repair','bandage','scanner','breach'];
 return THEMES[p.theme].pool;
}
function makeStack(p,rng){const pool=poolFor(p),item=pool[Math.floor(rng()*pool.length)],limit=ITEMS[item].stack;return {item,count:1+Math.floor(rng()*Math.min(limit,3))};}
export function furnishFloor(f,seed=14812){
 // Replace legacy generic props while preserving the architectural walls/doors.
 for(let i=0;i<f.grid.length;i++)if(f.grid[i]===3)f.grid[i]=0;
 f.props=[];f.covers=[];
 for(const r of f.rooms){
  const theme=themeFor(r,f),types=THEMES[theme].types;r.furnitureTheme=theme;
  const x=r.x/T,y=r.y/T,w=r.w/T,h=r.h/T;
  const anchors=[[x+2,y+2],[x+w-7,y+2],[x+2,y+h-7],[x+w-7,y+h-5],[x+Math.floor(w/2)-2,y+2],[x+2,y+Math.floor(h/2)+2],[x+w-5,y+Math.floor(h/2)+2]];
  let placed=0;
  for(const type of types){const def=FURNITURE[type];let pos=null;
   for(const [ax,ay] of anchors){if(canPlace(f,r,ax,ay,def.w,def.h)){pos=[ax,ay];break;}}
   // Subdivided barracks use free wall-adjacent positions in each compartment.
   if(!pos)for(let yy=y+2;yy<y+h-def.h-1&&!pos;yy+=2)for(let xx=x+2;xx<x+w-def.w-1;xx+=2)if(canPlace(f,r,xx,yy,def.w,def.h)){pos=[xx,yy];break;}
   if(!pos)continue;
   const [px,py]=pos,p={id:'furniture-'+f.id+'-'+r.index+'-'+placed++,floor:f.id,roomIndex:r.index,roomName:r.name,theme,type,name:def.name,x:px*T,y:py*T,w:def.w*T,h:def.h*T,capacity:def.capacity,solid:def.solid!==false,items:Array(def.capacity).fill(null)};
   const rng=random(seed+(f.id+3)*19073+r.index*517+placed*7907),fill=rng(),chance=fill<.16?0:fill>.84?1:.22+rng()*.5;
   for(let i=0;i<p.capacity;i++)if(rng()<chance)p.items[i]=makeStack(p,rng);
   p.credits=['desk','drawer','locker','cabinet','box','vehicle'].includes(type)&&rng()<.3?20+Math.floor(rng()*9)*10:0;
   if(theme==='shop'){const category=type==='stand'?SHOP_CATEGORIES[placed-2]:null;p.merchant=true;p.category=category?.id||'all';p.displayColor=category?.color||'#e6c66f';p.name=category?'STAND · '+category.name.toUpperCase():def.name;}
   f.props.push(p);if(p.solid)for(let yy=py;yy<py+def.h;yy++)for(let xx=px;xx<px+def.w;xx++)f.grid[yy*COLS+xx]=3;
  }
 }
 for(const p of f.props)if(p.solid)for(const [x,y,dir] of [[p.x+p.w/2,p.y-24,Math.PI/2],[p.x+p.w/2,p.y+p.h+24,-Math.PI/2],[p.x-24,p.y+p.h/2,0],[p.x+p.w+24,p.y+p.h/2,Math.PI]])if(f.grid[Math.floor(y/T)*COLS+Math.floor(x/T)]===0)f.covers.push({id:f.covers.length,x,y,dir,occupant:null});
 return f;
}
export function restockFurniture(sim,team,floor=null){
 // Deliveries use empty slots only; a deposit is never overwritten or topped up.
 if(sim.random()<.28)return 0;
 const candidates=sim.floors.filter(f=>floor===null||f.id===floor).flatMap(f=>f.props.filter(p=>!p.dropped&&p.items.some(i=>!i)&&(f.id!==sim.player.floor||Math.hypot(sim.player.x-p.x,sim.player.y-p.y)>180)).filter(p=>{
  const state=roomStatus(sim,f,f.rooms[p.roomIndex]);return state.owner===team;
 }));
 let added=0,budget=4+Math.floor(sim.random()*9);
 while(candidates.length&&budget-->0){const p=candidates.splice(Math.floor(sim.random()*candidates.length),1)[0];if(sim.random()<.3)continue;const index=p.items.findIndex(i=>!i);if(index<0)continue;p.items[index]=makeStack(p,()=>sim.random());added++;}
 if(added)sim.log('MATÉRIEL ACHEMINÉ',added+' rangements recomplétés dans les secteurs '+(team==='ally'?'sécurisés.':'occupés par l’ennemi.'),team==='ally'?'success':'warning',floor);
 return added;
}
export const furnitureStatus=p=>occupied(p.items)===0?(p.credits?'Crédits disponibles':'Vide'):occupied(p.items)===p.capacity?'Plein':'Partiellement rempli';
