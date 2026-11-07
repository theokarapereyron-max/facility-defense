import {airframeBlocksGround} from './airlift-geometry.mjs';
import {configureRoomRules} from './room-layout.mjs';
import {furnishFloor} from './furniture.mjs';
import {stairFootprint} from './stairs.mjs';
import {liftSolidAt,liftSupports,liftPathBlocked} from './lift-geometry.mjs';
import {TILE,COLS,ROWS,WIDTH,HEIGHT,ROOF_FLOOR} from './world-config.mjs';
export {TILE,COLS,ROWS,WIDTH,HEIGHT,ROOF_FLOOR};
export const FLOOR_INFO=[{id:-2,short:"-2",name:"Infrastructure",sector:"THE CORE"},{id:-1,short:"-1",name:"Logistique",sector:"GARAGE"},{id:0,short:"0",name:"Sécurité",sector:"MAIN HALL"},{id:1,short:"+1",name:"Caserne & médical",sector:"BARRACKS"},{id:2,short:"+2",name:"Commandement",sector:"OPERATIONS"},{id:3,short:"+3",name:"Recherche & ingénierie",sector:"RESEARCH"},{id:4,short:"+4",name:"Aéronautique & défense",sector:"AIR DEFENSE"},{id:ROOF_FLOOR,short:"R",name:"Toit",sector:"HELIPAD"}];
export const CONNECTORS=[{id:"A",type:"stairs",x:1488,y:1104,min:-2,max:ROOF_FLOOR,label:"ESCALIER A"},{id:"B",type:"stairs",x:3648,y:2864,min:-2,max:ROOF_FLOOR,label:"ESCALIER B"},{id:"C",type:"stairs",x:288,y:1808,min:0,max:ROOF_FLOOR,label:"SECOURS C"},{id:"L1",type:"elevator",x:2560,y:1808,min:-2,max:ROOF_FLOOR,label:"ASCENSEUR CENTRAL"},{id:"L2",type:"elevator",x:2560,y:2864,min:-2,max:ROOF_FLOOR,label:"MONTE-CHARGE"},{id:"D",type:"stairs",x:5008,y:1104,min:-2,max:ROOF_FLOOR,label:"ESCALIER EST D"},{id:"L3",type:"elevator",x:5008,y:2864,min:-2,max:ROOF_FLOOR,label:"MONTE-CHARGE EST"}];
export const CORE={x:3104,y:704,floor:-2,radius:200};
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const point=(x,y,floor)=>({x:(x+.5)*32,y:(y+.5)*32,floor});
const NAMES=[
["GÉNÉRATEURS","SERVEURS A","THE CORE","REFROIDISSEMENT","ALIMENTATION","SERVEURS B","SAS DU CORE","CONTRÔLE THERMIQUE","MAINTENANCE OUEST","INFRASTRUCTURE","SÉCURITÉ CORE","POMPES","TUNNEL DE SERVICE","ARMURERIE DE SECOURS","STOCKAGE TECHNIQUE","CIRCUITS DE SECOURS"],
["ATELIER MÉCANIQUE","PIÈCES DÉTACHÉES","ARMURERIE","STOCKAGE A","RÉPARATIONS","CONTRÔLE LOGISTIQUE","STOCKAGE B","ENTREPÔT","QUAI DE LIVRAISON","GARAGE MILITAIRE","PARKING","RÉSERVE","ACCÈS LIVRAISONS","POSTE LOGISTIQUE","LOCAL TECHNIQUE","TUNNEL DE SERVICE"],
["BUREAUX OUEST","SURVEILLANCE","CENTRE SÉCURITÉ","BUREAUX EST","SALLE DE CONTRÔLE","COMMUNICATIONS","ACCUEIL","PERSONNEL","ACCÈS VISITEURS","MAIN HALL","MAIN HALL","POSTE DE GARDE","SÉCURITÉ OUEST","CHECKPOINT","SAS PRINCIPAL","SÉCURITÉ EST"],
["CHAMBRÉE A","CHAMBRÉE B","INFIRMERIE","CENTRE MÉDICAL","DORTOIR OUEST","SALLE DE REPOS","PHARMACIE","RÉÉDUCATION","CANTINE","ENTRAÎNEMENT","VESTIAIRES","CHAMBRÉE C","CUISINE","SANITAIRES","BUREAUX","RÉSERVE"],
["ARCHIVES","BRIEFING A","COMMUNICATIONS","ANTENNES","BUREAUX ÉTAT-MAJOR","BRIEFING B","SURVEILLANCE","RÉSEAU","COMMAND CENTER","OPERATIONS","OPERATIONS","SALLE TACTIQUE","ARCHIVES SÉCURISÉES","PASSERELLE OUEST","PASSERELLE EST","MAINTENANCE"],
["LABORATOIRE MATÉRIAUX","LABORATOIRE CAPTEURS","ATELIER ÉLECTRONIQUE","CHAMBRE D’ESSAIS","PROTOTYPES","ANALYSE MÉDICALE","CONTRÔLE EXPÉRIMENTAL","RÉSEAU SCIENTIFIQUE","BUREAUX CHERCHEURS","INGÉNIERIE","INTÉGRATION SYSTÈMES","SÉCURITÉ RECHERCHE","ARCHIVES TECHNIQUES","STOCKAGE PROTOTYPES","SAS DE DÉCONTAMINATION","MAINTENANCE RECHERCHE"],
["PLANIFICATION AÉRIENNE","BRIEFING PILOTES","COMMUNICATIONS AÉRIENNES","RADAR","CASERNE PILOTES","PRÉPARATION ÉQUIPAGES","CONTRÔLE DÉFENSE","ATELIER DRONES","RÉSERVE D’APPUI","HANGAR DRONES","MAINTENANCE AÉRIENNE","POSTE DE GARDE AÉRIEN","STOCKAGE ÉQUIPEMENTS","LOGISTIQUE HÉLIPAD","SAS AÉRIEN","INFIRMERIE PILOTES"],
["RELAIS OUEST","VENTILATION A","COMMUNICATIONS","RELAIS EST","ACCÈS TECHNIQUE","CENTRALE D’AIR","VENTILATION B","SÉCURITÉ TOIT","ÉQUIPEMENTS","HELIPAD","HELIPAD","RÉSERVE TOIT","TERRASSE OUEST","ACCÈS HÉLIPAD","ACCÈS HÉLIPAD","TERRASSE EST"]];
function makeFloor(id,seed){
 const grid=new Uint8Array(COLS*ROWS);grid.fill(1);
 const f={id,isRoof:id===ROOF_FLOOR,cols:COLS,rows:ROWS,grid,rooms:[],doors:[],props:[],covers:[],zones:[],version:0,connectors:CONNECTORS.filter(c=>id>=c.min&&id<=c.max)};
 const carve=(x,y,w,h)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)grid[yy*COLS+xx]=0;};
 [[6,6,148,6],[6,108,148,6],[6,6,6,108],[148,6,6,108],[42,8,8,103],[76,8,8,103],[110,8,8,103],[8,31,144,7],[8,53,144,8],[8,86,144,8]].forEach(a=>carve(...a));
 const door=(x,y,vertical,type="standard")=>{const d={id:id+":"+f.doors.length,x:x*32,y:y*32,w:vertical?32:64,h:vertical?64:32,type,state:type==="standard"?"CLOSED":"LOCKED",open:0,hold:0,health:type==="armored"?240:100,cells:[]};for(let yy=y;yy<y+(vertical?2:1);yy++)for(let xx=x;xx<x+(vertical?1:2);xx++){grid[yy*COLS+xx]=2;d.cells.push(yy*COLS+xx);}f.doors.push(d);};
 const addProp=(x,y,w,h,type)=>{f.props.push({x:x*32,y:y*32,w:w*32,h:h*32,type});for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)grid[yy*COLS+xx]=3;};
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const x=[12,50,84,118][col],y=[12,38,61,94][row],w=[30,26,26,30][col],h=[19,15,25,14][row],idx=row*4+col,name=NAMES[id+2][idx],secure=id===-2&&[2,6].includes(idx);
  const r={x:x*32,y:y*32,w:w*32,h:h*32,name,index:idx,type:"room"};f.rooms.push(r);carve(x+1,y+1,w-2,h-2);
  door(x+Math.floor(w/2)-1,y+h-1,false,secure?"armored":"standard");door(x+(col===0||col===2?w-1:0),y+Math.floor(h/2)-1,true,secure?"secured":"standard");if(row>0)door(x+Math.floor(w/2)-1,y,false,secure?"secured":"standard");
  const large=row===2&&(col===1||col===2)&&[-1,0,2,4,ROOF_FLOOR].includes(id);
  if(large){carve(x,y+1,w,h-2);r.type=id===ROOF_FLOOR?"helipad":"hall";}
  for(let p=0;p<(id===ROOF_FLOOR?2:row===2?4:3);p++){
   if(secure&&idx===2||large&&col===2&&p>1)continue;
   const px=x+4+p%2*(w-10),py=y+3+Math.floor(p/2)*Math.max(4,h-9);
   let type="desk",pw=4,ph=2;
   if(id===-1){type=row===2?"vehicle":"crate";pw=type==="vehicle"?6:3;ph=3;}
   if(id===-2){type=name.includes("SERVEUR")?"server":"generator";pw=3;ph=4;}
   if(id===1){type=name.includes("CHAMBR")||name.includes("DORTOIR")?"bed":name.includes("MÉDICAL")?"medical":"table";pw=3;ph=2;}
   if(id===ROOF_FLOOR){type="vent";pw=4;ph=3;}
   if(['server','generator','vent'].includes(type))continue;
   addProp(px,py,pw,ph,type);for(const side of [-1,1])f.covers.push({id:f.covers.length,x:(px+pw/2)*32,y:(py+(side===-1?-1:ph+1))*32,dir:side===-1?Math.PI/2:-Math.PI/2,occupant:null});
  }
  f.zones.push({id:idx,name,x:(x+w/2)*32,y:(y+h/2)*32,floor:id,radius:Math.max(w,h)*16,strategicValue:secure?10:large?6:2,owner:"ally",pressure:0});
 }
 if(id===1)for(const idx of [0,1,2,3,4,7,11,12,13,14]){
  const r=f.rooms[idx],x=r.x/32,y=r.y/32,w=r.w/32,h=r.h/32,n=[0,3,11].includes(idx)?3:2;
  for(const p of f.props.filter(p=>p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h))for(let yy=p.y/32;yy<(p.y+p.h)/32;yy++)for(let xx=p.x/32;xx<(p.x+p.w)/32;xx++)if(grid[yy*COLS+xx]===3)grid[yy*COLS+xx]=0;
  f.props=f.props.filter(p=>!(p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h));
  for(let part=1;part<n;part++){const wx=x+Math.floor(w/n)*part;for(let yy=y+1;yy<y+h-1;yy++)grid[yy*COLS+wx]=1;door(wx,y+Math.floor(h/2)-1,true);}
  for(let part=0;part<n;part++)addProp(x+2+Math.floor(w/n)*part,y+3,3,2,[2,3,7].includes(idx)?"medical":"bed");
 }
 if(id===ROOF_FLOOR){
  carve(12,12,136,96);const huts=new Set([0,3,4,7,12,15]);
  for(const r of f.rooms){if(!huts.has(r.index)){r.type=[9,10].includes(r.index)?"helipad":"terrace";continue;}const x=r.x/32,y=r.y/32,w=r.w/32,h=r.h/32;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(yy===y||yy===y+h-1||xx===x||xx===x+w-1)grid[yy*COLS+xx]=1;}
  f.doors=f.doors.filter(d=>f.rooms.some(r=>huts.has(r.index)&&d.x>=r.x&&d.x<r.x+r.w&&d.y>=r.y&&d.y<r.y+r.h));for(const d of f.doors)for(const c of d.cells)grid[c]=2;
  for(const p of f.props)for(let y=p.y/32;y<(p.y+p.h)/32;y++)for(let x=p.x/32;x<(p.x+p.w)/32;x++)grid[y*COLS+x]=3;
 }
 if(id===0)carve(72,114,17,5);
 // An east services wing adds real floor area, four rooms and aligned access shafts.
 [[154,6,8,108],[154,6,40,6],[154,108,40,6],[190,6,4,108],[154,31,40,7],[154,53,40,8],[154,86,40,8]].forEach(a=>carve(...a));
 const department={"-2":"GÉNIE","-1":"ARSENAL","0":"SÉCURITÉ","1":"PHARMACIE","2":"COMMANDEMENT","3":"INGÉNIERIE","4":"APPUI AÉRIEN"}[id];
 const wingNames=f.isRoof?["TOUR DE CONTRÔLE","RÉSERVE AÉRIENNE","PLATEFORME DRONES","ACCÈS MAINTENANCE"]:["POSTE DE GARDE EST","RÉSERVE D’INTENDANCE","BOUTIQUE — "+department,"RAVITAILLEMENT EST"];
 for(let row=0;row<4;row++){
  const x=162,y=[12,38,61,94][row],w=28,h=[19,15,25,14][row],index=16+row;
  const r={x:x*TILE,y:y*TILE,w:w*TILE,h:h*TILE,name:wingNames[row],index,type:!f.isRoof&&row===2?'shop':'room'};
  f.rooms.push(r);carve(x+1,y+1,w-2,h-2);door(x+13,y+h-1,false);door(x,y+Math.floor(h/2)-1,true);if(row>0)door(x+13,y,false);
  f.zones.push({id:index,name:r.name,x:r.x+r.w/2,y:r.y+r.h/2,floor:id,radius:Math.max(w,h)*16,strategicValue:row===0?6:row===2?4:2,owner:'ally',pressure:0});
 }
 if(!f.isRoof)f.shopRoomIndex=18;
 // Reserve an actual stairwell and its approach at the same coordinates on every deck.
 for(const c of f.connectors.filter(c=>c.type==='stairs')){
  carve(Math.floor(c.x/TILE)-3,Math.floor(c.y/TILE)-5,6,11);
  const sx=Math.floor(c.x/TILE)-3,sy=Math.floor(c.y/TILE)-5;
  for(let row=0;row<10;row++){grid[(sy+row)*COLS+sx]=1;grid[(sy+row)*COLS+sx+5]=1;}
  for(let col=0;col<6;col++)grid[sy*COLS+sx+col]=1;
  const overlaps=p=>p.x+p.w>c.x-80&&p.x<c.x+80&&p.y+p.h>c.y-160&&p.y<c.y+176;
  f.props=f.props.filter(p=>!overlaps(p));
  f.doors=f.doors.filter(d=>!overlaps(d));
 }
 f.covers=f.covers.filter(c=>grid[Math.floor(c.y/32)*COLS+Math.floor(c.x/32)]===0&&!f.connectors.some(s=>s.type==='stairs'&&stairFootprint(s,c.x,c.y,16)));f.covers.forEach((c,i)=>c.id=i);
 f.supply=point(id===-2?64:45,id===-2?89:56,id);f.entry=id===0?point(80,111,id):id===-1?point(9,75,id):id===ROOF_FLOOR?point(97,75,id):point(9,96,id);
 f.doorByCell=new Map();for(const d of f.doors)for(const c of d.cells)f.doorByCell.set(c,d);
 const stations={"-2":[13,10,19],"-1":[2,13,19],"0":[12,15,19],"1":[2,15,19],"2":[15,19],"3":[14,19],"4":[15,19],"5":[]}[id];
 f.supplies=stations.map(index=>{const r=f.rooms[index],p=nearestWalkable(f,r.x+r.w/2,r.y+r.h-96);return {...p,id:"supply-"+id+"-"+index,roomIndex:index,name:r.name};});f.supply=f.supplies[0]||null;
 for(const r of f.rooms)Object.assign(r,{owner:'ally',allies:0,enemies:0,contested:false,captureSerial:0,pendingGarrison:null});
 for(const [i,d] of f.doors.entries()){d.id=id+':'+i;d.roomIndex=f.rooms.find(r=>d.x>=r.x&&d.x<r.x+r.w&&d.y>=r.y&&d.y<r.y+r.h).index;d.lockMode=d.type==='standard'?'none':'hostile';d.lockTeam='ally';}
 return furnishFloor(configureRoomRules(f),seed);
}
export function createFacility(seed=14812){return FLOOR_INFO.map(f=>makeFloor(f.id,seed));}
export function cellAt(f,x,y){const cx=Math.floor(x/32),cy=Math.floor(y/32);return cx<0||cy<0||cx>=COLS||cy>=ROWS?1:f.grid[cy*COLS+cx];}
export function solid(f,x,y){if(airframeBlocksGround(f,x,y)||liftSolidAt(f,x,y))return true;const cx=Math.floor(x/32),cy=Math.floor(y/32);if(cx<0||cy<0||cx>=COLS||cy>=ROWS)return true;const i=cy*COLS+cx,v=f.grid[i];if(v===1||v===3)return true;if(v===2){const d=f.doorByCell.get(i);return d&&d.state!=="DESTROYED"&&d.open<.72;}return false;}
export function canStand(f,x,y,r=10){return liftSupports(f,x,y)&&!solid(f,x-r,y-r)&&!solid(f,x+r,y-r)&&!solid(f,x-r,y+r)&&!solid(f,x+r,y+r);}
export function zoneAt(f,x,y){return f.rooms.find(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)?.name||"COULOIR DE LIAISON";}
export function nearestWalkable(f,x,y){const cx=Math.floor(x/32),cy=Math.floor(y/32);for(let r=0;r<25;r++)for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){if(r&&Math.abs(ox)!==r&&Math.abs(oy)!==r)continue;const px=(cx+ox+.5)*32,py=(cy+oy+.5)*32;if(cellAt(f,px,py)===0&&canStand(f,px,py)&&!f.connectors.some(c=>(c.type==="stairs"&&stairFootprint(c,px,py,16)||c.type==="elevator"&&liftPathBlocked(c,px,py))))return {x:px,y:py,floor:f.id};}return point(80,56,f.id);}
