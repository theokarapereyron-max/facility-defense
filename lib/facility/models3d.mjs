import * as THREE from 'three';
import {TILE, WIDTH, HEIGHT} from './world-config.mjs';
import {CEILING_HEIGHT} from './fps-ballistics.mjs';
import {boundaryWalls} from './projection3d.mjs';
import {FLOOR_PALETTES} from './world-art.mjs';
import {deckGeometry,floorOpenings,drawStairwell,drawStairFlight} from './stairs3d.mjs';
import {STAIR_RISE} from './stairs.mjs';

export const TEAM_COLORS = {ally:'#6bb8cd',enemy:'#db775f',player:'#d7eff3'};
const temp = new THREE.Object3D(), color = new THREE.Color();

export class RenderResources {
 constructor() {
  this.geometries = {
   box:new THREE.BoxGeometry(1,1,1),
   sphere:new THREE.SphereGeometry(.5,10,7),
   cylinder:new THREE.CylinderGeometry(.5,.5,1,12),
   cone:new THREE.ConeGeometry(.5,1,12),
   ring:new THREE.TorusGeometry(.5,.025,5,48),
   crystal:new THREE.OctahedronGeometry(.5),
  };
  this.materials = new Map();this.textures = [];
 }
 material(kind='steel') {
  if(!this.materials.has(kind)) {
   const m=kind==='glow'?new THREE.MeshBasicMaterial({color:0xffffff}):
    kind==='shadow'?new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,depthWrite:false}):
    kind==='glass'?new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.17,roughness:.12,metalness:.2,depthWrite:false}):
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:kind==='floor'?.87:.47,metalness:kind==='floor'?.08:.36});
   this.materials.set(kind,m);
  }
  return this.materials.get(kind);
 }
 dispose() {for(const g of Object.values(this.geometries))g.dispose();for(const m of this.materials.values())m.dispose();for(const t of this.textures)t.dispose();}
}

// One GPU draw per shape/material instead of one draw per limb, shelf or crate.
export class PartBatch {
 constructor(resources,capacity=8192) {this.resources=resources;this.capacity=capacity;this.group=new THREE.Group();this.bins=new Map();this.root=null;}
 reset() {for(const bin of this.bins.values())bin.used=0;this.root=null;}
 add(shape,x,y,z,w,h,d,tint,rx=0,ry=0,rz=0,kind='steel') {
  const key=shape+':'+kind;let bin=this.bins.get(key);
  if(!bin) {
   const mesh=new THREE.InstancedMesh(this.resources.geometries[shape],this.resources.material(kind),this.capacity);
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;
   mesh.castShadow=kind==='steel';mesh.receiveShadow=kind!=='glow';mesh.count=0;
   this.group.add(mesh);bin={mesh,used:0};this.bins.set(key,bin);
  }
  if(bin.used>=this.capacity)return;
  temp.position.set(x,y,z);temp.scale.set(w,h,d);temp.rotation.set(rx,ry,rz);temp.updateMatrix();
  if(this.root)temp.matrix.premultiply(this.root);
  bin.mesh.setMatrixAt(bin.used,temp.matrix);bin.mesh.setColorAt(bin.used,color.set(tint));bin.used++;
 }
 box(...a) {this.add('box',...a);}
 cylinder(...a) {this.add('cylinder',...a);}
 sphere(...a) {this.add('sphere',...a);}
 finish() {for(const {mesh,used} of this.bins.values()){mesh.count=used;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}}
 dispose() {for(const {mesh} of this.bins.values())mesh.dispose();this.group.clear();this.bins.clear();}
}

function floorTexture(resources) {
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d');
 c.fillStyle='#bcc9cc';c.fillRect(0,0,128,128);c.strokeStyle='#74868d';c.lineWidth=2;c.strokeRect(1,1,126,126);
 c.fillStyle='#e4eced';c.fillRect(5,5,118,1);c.fillStyle='#92a5aa';
 for(let y=16;y<128;y+=16)for(let x=16;x<128;x+=16){c.fillRect(x,y,5,1);c.fillRect(x+2,y-2,1,5);}
 for(const x of [6,121])for(const y of [6,121]){c.fillStyle='#667d83';c.fillRect(x,y,2,2);}
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(WIDTH/TILE/2,HEIGHT/TILE/2);texture.colorSpace=THREE.SRGBColorSpace;resources.textures.push(texture);return texture;
}

export function buildFloor3D(f,resources,{labels=true}={}) {
 const textureStart=resources.textures.length;
 const root=new THREE.Group(),palette=FLOOR_PALETTES[f.id+2],staticParts=new PartBatch(resources),wallCells=boundaryWalls(f),ownedMaterials=[];
 const planeMaterial=new THREE.MeshStandardMaterial({color:palette.base,roughness:.88,metalness:.12,map:floorTexture(resources)});ownedMaterials.push(planeMaterial);
 const openings=floorOpenings(f),rect={left:0,right:WIDTH/TILE,top:0,bottom:HEIGHT/TILE};
 const ground=new THREE.Mesh(deckGeometry(rect,openings),planeMaterial);ground.position.y=-.025;ground.renderOrder=-100;ground.receiveShadow=true;root.add(ground);
 const ceilingMaterial=new THREE.MeshStandardMaterial({color:'#394750',roughness:.94,side:THREE.DoubleSide});ownedMaterials.push(ceilingMaterial);
 const ceiling=new THREE.Mesh(deckGeometry(rect,floorOpenings(f,true)),ceilingMaterial);ceiling.position.y=CEILING_HEIGHT;ceiling.visible=false;root.add(ceiling);
 const roomTiles=[];
 const gridPoints=[];
 function gridLine(fixed,length,vertical){
  const holes=openings.filter(h=>fixed>(vertical?h.left:h.top)&&fixed<(vertical?h.right:h.bottom)).map(h=>vertical?[h.top,h.bottom]:[h.left,h.right]).sort((a,b)=>a[0]-b[0]);
  let start=0;
  for(const [a,b] of [...holes,[length,length]]){
   if(a>start)gridPoints.push(...(vertical?[fixed,0,start,fixed,0,a]:[start,0,fixed,a,0,fixed]));
   start=Math.max(start,b);
  }
 }
 for(let x=0;x<=f.cols;x+=2)gridLine(x,f.rows,true);
 for(let z=0;z<=f.rows;z+=2)gridLine(z,f.cols,false);
 const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridPoints,3));
 const gridMaterial=new THREE.LineBasicMaterial({color:'#73909b',transparent:true,opacity:.14});ownedMaterials.push(gridMaterial);
 const gridLines=new THREE.LineSegments(gridGeometry,gridMaterial);gridLines.renderOrder=-98;root.add(gridLines);
 for(const r of f.rooms) {
  const mat=new THREE.MeshStandardMaterial({color:r.type==='shop'?'#41443a':palette.tile,roughness:.84,metalness:.12});ownedMaterials.push(mat);
  const tile=new THREE.Mesh(deckGeometry({left:r.x/TILE+.55,right:(r.x+r.w)/TILE-.55,top:r.y/TILE+.55,bottom:(r.y+r.h)/TILE-.55},openings),mat);tile.position.y=-.012;tile.renderOrder=-99;tile.receiveShadow=true;root.add(tile);roomTiles.push({room:r,mesh:tile});
  const x=r.x/TILE,z=r.y/TILE,w=r.w/TILE,d=r.h/TILE;
  drawDeckDetails(staticParts,f,r,x,z,w,d);
  for(const edge of [[x+w/2,z+1,w-2,.045],[x+1,z+d/2,.045,d-2]])staticParts.box(edge[0],.015,edge[1],edge[2],.025,edge[3],r.type==='shop'?'#b49a60':palette.accent,0,0,0,'glow');
  if(labels&&typeof document!=='undefined') {
   const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;const c=canvas.getContext('2d');
   c.clearRect(0,0,768,96);c.fillStyle=palette.light;c.font='600 35px sans-serif';c.textAlign='center';c.fillText(String(r.index+1).padStart(2,'0')+' / '+r.name,384,55,730);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;resources.textures.push(texture);
   const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.65,depthWrite:false});ownedMaterials.push(material);
   const sign=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14,w-3),1.75),material);sign.rotation.x=-Math.PI/2;sign.position.set(x+w/2,.025,z+2.4);root.add(sign);
  }
 }
 const walls=new THREE.InstancedMesh(resources.geometries.box,resources.material('steel'),wallCells.length);
 walls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);walls.castShadow=true;walls.receiveShadow=true;walls.frustumCulled=false;
 for(let i=0;i<wallCells.length;i++){const p=wallCells[i];temp.position.set(p.x,STAIR_RISE/2,p.z);temp.scale.set(.98,STAIR_RISE,.98);temp.rotation.set(0,0,0);temp.updateMatrix();walls.setMatrixAt(i,temp.matrix);walls.setColorAt(i,color.set(palette.wall));staticParts.box(p.x,.16,p.z,1.015,.32,1.015,'#263c47');}
 root.add(walls);
 for(const prop of f.props)if(!prop.dropped)drawFurniture3D(staticParts,prop);
 const incomingStairs=new PartBatch(resources,2048);
 for(const con of f.connectors)if(con.type==='stairs'){
  drawStairwell(staticParts,con,f.id);
  if(f.id>con.min)drawStairFlight(incomingStairs,con,-STAIR_RISE);
 }
 incomingStairs.finish();root.add(incomingStairs.group);
 for(const sp of f.supplies) {
  const x=sp.x/TILE,z=sp.y/TILE;staticParts.box(x,.12,z,1.7,.24,1.5,'#233c3b');staticParts.box(x,.255,z,.95,.04,.19,'#a1e3b8',0,0,0,'glow');staticParts.box(x,.255,z,.19,.04,.95,'#a1e3b8',0,0,0,'glow');
 }
 if(f.isRoof)for(const r of f.rooms.filter(r=>r.type==='helipad')) {
  const x=(r.x+r.w/2)/TILE,z=(r.y+r.h/2)/TILE;staticParts.add('ring',x,.02,z,11,11,11,'#b7ba94',Math.PI/2,0,0,'glow');staticParts.box(x-1,.035,z,.25,.03,3,'#d0cba5');staticParts.box(x+1,.035,z,.25,.03,3,'#d0cba5');staticParts.box(x,.035,z,2,.03,.25,'#d0cba5');
 }
 staticParts.finish();root.add(staticParts.group);
 const ownedTextures=resources.textures.slice(textureStart);
 return {root,ceiling,incomingStairs,wallCells,walls,roomTiles,staticParts,planeMaterial,ownedMaterials,
  dispose(){staticParts.dispose();incomingStairs.dispose();walls.dispose();root.traverse(o=>{if(o.geometry&&!Object.values(resources.geometries).includes(o.geometry))o.geometry.dispose();});for(const m of ownedMaterials)m.dispose();for(const t of ownedTextures)t.dispose();resources.textures=resources.textures.filter(t=>!ownedTextures.includes(t));root.clear();}};
}


const DECK_ACCENTS=['#65d5ed','#ebbd5a','#71c2d7','#def2e7','#9f9ce7','#66d8cb','#ecad74','#f67668'];

function drawDeckDetails(b,f,r,x,z,w,d) {
 const tint=DECK_ACCENTS[f.id+2], cx=x+w/2, cz=z+d/2;
 // Keep every detail inside the existing scenery or flush with the ground.
 for(const side of [-1,1]){
  const lineZ=cz+side*(d/2-1.25);
  b.box(cx,.024,lineZ,w-2.5,.027,.095,tint);
  if(f.id===-2){
   b.box(cx,.049,lineZ+side*.21,w-2.5,.077,.092,'#254653');
   b.box(cx,.079,lineZ+side*.21,w-2.5,.023,.035,tint,0,0,0,'glow');
   for(const dx of [-.31,.31])b.box(cx+dx*w,.073,lineZ+side*.21,.22,.13,.23,'#465d67');
  }
  if(f.id===-1||f.id===4){
   for(let i=0;i<7;i++)b.box(cx+(i-3)*.52,.038,lineZ-side*.36,.23,.02,.6,tint,0,.47,0);
  }
  if(f.id===1){
   b.box(cx+side*(w/2-1.25),.028,cz,.11,.03,d-2.5,tint);
   if(r.type==='medical'||r.type==='supply'){
    b.box(cx,.027,cz+side*(d/2-2.3),1.27,.028,.29,tint);
    b.box(cx,.029,cz+side*(d/2-2.3),.29,.028,1.27,tint);
   }
  }
  if(f.id===2||f.id===3||f.id===0){
   b.box(cx+side*(w/2-1.12),.036,cz,.09,.035,1.8,tint,0,0,0,'glow');
   b.box(cx+side*(w/2-1.25),.036,cz,.055,.035,1.4,'#b7ccd3');
  }
  if(f.isRoof&&r.type==='helipad')for(const end of [-1,1]){
   b.box(cx+side*(w/2-2),.14,cz+end*(d/2-2),.43,.27,.43,'#293e4c');
   b.cylinder(cx+side*(w/2-2),.31,cz+end*(d/2-2),.29,.11,.29,tint,0,0,0,'glow');
  }
 }
}

export function drawFurniture3D(b,p) {
 const x=(p.x+p.w/2)/TILE,z=(p.y+p.h/2)/TILE,w=p.w/TILE,d=p.h/TILE,type=p.type,medical=p.theme==='medical',edge=medical?'#adccc4':'#8b9d9f',steel=medical?'#678f89':'#52676d',dark='#1c303b';
 if(type==='hatch'||p.dropped){b.box(x,.08,z,w,.16,d,p.dropped?'#947956':'#435965');return;}
 if(type==='bed'||type==='sofa') {
  b.box(x,.33,z,w,.5,d,'#3b555d');b.box(x,.67,z,w*.9,.23,d*.92,type==='bed'?'#91aba5':'#617f7c');
  if(type==='bed'){b.box(x,.83,z-d*.3,w*.78,.18,d*.25,'#d1ddd2');b.box(x,.83,z+d*.18,w*.9,.14,d*.46,'#546f6a');}else b.box(x,1,z-d*.4,w,1,d*.17,steel);
  return;
 }
 if(type==='vehicle') {
  b.box(x,.7,z,w*.95,1.05,d*.8,'#58694b');b.box(x+.3,1.55,z,w*.55,.8,d*.76,'#63765a');b.box(x+w*.3,1.62,z,.09,.5,d*.63,'#172d39');
  for(const a of [-1,1])for(const c of [-1,1])b.cylinder(x+a*w*.31,.45,z+c*d*.43,.8,.35,.8,'#11212c',Math.PI/2);return;
 }
 if(['desk','table','workbench','counter','jar'].includes(type)) {
  const h=type==='counter'?1.3:1.04;b.box(x,h,z,w,.18,d,steel);
  for(const a of [-1,1])for(const c of [-1,1])b.box(x+a*(w/2-.17),h/2,z+c*(d/2-.17),.17,h,.17,dark);
  if(type==='desk'||type==='counter'||type==='workbench') {
   b.box(x-w*.2,h+.11,z,.65,.04,.42,'#a6b1a5');
   b.box(x+w*.3,h*.48,z,w*.3,h*.78,d*.85,'#374e58');for(let i=0;i<3;i++)b.box(x+w*.3,h*.2+i*.22,z+d*.44,w*.22,.035,.025,edge);
  }
  if(type==='jar')for(let i=0;i<3;i++){b.cylinder(x+(i-1)*.35,h+.23,z,.24,.38,.24,'#9acbd0');b.cylinder(x+(i-1)*.35,h+.44,z,.22,.06,.22,'#a3b4aa');}
  return;
 }
 if(type==='shelf'||type==='stand') {
  const h=type==='stand'?1.3:2.3;
  for(const side of [-1,1])b.box(x+side*(w/2-.08),h/2,z,.16,h,d,dark);
  for(let i=0;i<4;i++){const y=.17+i*h/3.5;b.box(x,y,z,w,.1,d,steel);for(let j=0;j<3;j++)b.box(x+(j-1)*w*.25,y+.18,z,w*.18,.27,d*.55,p.displayColor||['#a4996e','#6d9c94','#89949d'][j]);}
  return;
 }
 const h=['locker','cabinet'].includes(type)?2.45:type==='medical'?1.1:.82;
 b.box(x,h/2,z,w,h,d,type==='crate'||type==='box'?'#667258':steel);
 b.box(x,.08,z,w*1.04,.16,d*1.04,dark);
 if(type==='locker'||type==='cabinet'){b.box(x,.9,z+d/2+.02,.035,1.5,.025,dark);for(const side of [-1,1])b.box(x+side*w*.1,1.15,z+d/2+.055,.045,.3,.08,edge);}
 else {for(const side of [-1,1])b.box(x+side*w*.32,h+.02,z,.08,.04,d,'#a5ad93');b.box(x,h/2,z+d/2+.025,w*.3,.12,.05,edge);}
 if(type==='medical'){b.box(x,h+.06,z,.8,.08,.18,'#b7e9ca',0,0,0,'glow');b.box(x,h+.06,z,.18,.08,.8,'#b7e9ca',0,0,0,'glow');}
}

export function drawDoor3D(b,d,detail=true,overhead=false) {
 const x=(d.x+d.w/2)/TILE,z=(d.y+d.h/2)/TILE,span=Math.max(d.w,d.h)/TILE;
 const armored=d.type==='armored'||d.reinforced, secured=d.type==='secured';
 const panel=armored?'#31434c':secured?'#546c77':'#78919b';
 const frame=armored?'#48555c':'#344d5b',trim=armored?'#c4a16c':'#aec4ca';
 const lamp=d.lockMode==='all'?'#f1b666':d.lockTeam==='enemy'&&d.lockMode!=='none'?'#f17c65':'#80dfc6';
 const previous=b.root;
 b.root=new THREE.Matrix4().makeRotationY(d.w<d.h?Math.PI/2:0).setPosition(x,0,z);
 if(previous)b.root.premultiply(previous);
 if(overhead)b.box(0,(CEILING_HEIGHT+2.86)/2,0,span+.14,CEILING_HEIGHT-2.86,1,frame);
 if(d.state==='DESTROYED'){
  b.box(0,.035,0,span,.07,.32,'#685e52');
  b.box(-span*.42,.26,0,.16,.52,.22,frame,0,0,-.18);
  b.box(span*.43,.16,0,.16,.32,.22,frame,0,0,.3);
  b.root=previous;return;
 }
 const thickness=armored?.37:.21;
 const fraction=Math.max(0,Math.min(1,d.open));
 const slide=fraction*fraction*(3-2*fraction);
 b.box(0,.025,0,span+.32,.05,.5,'#21303a');
 b.box(0,2.75,0,span+.48,.29,.58,frame);
 for(const side of [-1,1]){
  const edge=side*(span/2+.12),leaf=side*(span/4+span*.58*slide);
  b.box(edge,1.36,0,armored?.28:.18,2.72,.57,frame);
  if(detail){
   b.box(edge,1.64,.3,.15,.34,.07,'#14242e');
   b.box(edge,1.72,.35,.09,.07,.025,lamp,0,0,0,'glow');
  }
  b.box(leaf,1.32,0,span/2-.024,2.59,thickness,panel);
  for(const face of [-1,1]){
   const z=face*(thickness/2+.018);
   b.box(leaf,armored?1.34:.25, z,span*.44,armored?.33:.11,.045,trim);
   if(!detail)continue;
   if(armored){
    for(const y of [.49,2.14])b.box(leaf,y,z,span*.42,.31,.075,'#5d6b6e');
    for(const k of [-1,1])b.box(leaf+k*span*.17,1.34,z+face*.032,.048,.33,.022,'#2b353b',0,0,-.42);
   }else{
    b.box(leaf,1.6,z,span*.36,.29,.05,secured?'#263b4a':'#203847');
    b.box(leaf,1.62,z+face*.031,span*.31,.16,.02,secured?'#778993':'#6bafb5');
    b.box(leaf-side*span*.14,1.04,z,.08,.19,.085,'#273740');
   }
  }
 }
 for(const face of [-1,1])b.box(0,2.72,face*.302,armored?.65:.33,.055,.023,lamp,0,0,0,'glow');
 b.root=previous;
}

export function drawActor3D(b,u,time,detail=true) {
 b.cylinder(u.x/TILE,.025,u.y/TILE,1,.025,.8,'#040e18',0,0,0,'shadow');
 const root=new THREE.Matrix4().makeRotationY(-u.angle-Math.PI/2);root.setPosition(u.x/TILE,(u.stairHeight||0)+(u.airHeight||0),u.y/TILE);b.root=root;
 const player=u.role==='player',heavy=u.role==='heavy',medic=u.role==='medic',officer=u.role==='officer';
 const enemy=u.team==='enemy',tint=TEAM_COLORS[u.team],uniform=enemy?'#674b45':'#3e5865';
 const armor=player?'#c3d6d8':heavy?enemy?'#a1705b':'#7b939d':enemy?'#9a6555':'#6d8d9b';
 const dark=enemy?'#301f22':'#162c39',trim=enemy?'#c39177':'#9eafb2',width=heavy?.83:.62;
 const phase=u.airInsertion||u.goal&&u.path?.length?Math.sin((u.moveDistance||0)*.1)*.44:0;
 const fireAge=time-(u.lastShotAt??-2),kick=Math.max(0,1-fireAge/.16)*.08;
 for(const side of [-1,1]) {
  const x=side*(heavy?.21:.17), swing=side*phase;
  b.box(x,.43,swing*.18,.23,.69,.26,uniform,swing);
  b.box(x,.095,-.075+swing*.33,.25,.19,.4,dark,-swing*.15);
  b.box(side*(width/2+.071),1.04,-.23,.18,.5,.21,uniform,-.75,0,side*.2);
  b.box(side*(width/2+.056),1.31,-.03,heavy?.24:.15,heavy?.18:.1,.27,medic?'#e1e9e0':armor);
  b.box(side*(width/2+.06),1.26,-.168,.14,.062,.027,player?'#ede1a4':tint,0,0,0,'glow');
  if(detail){
   b.box(x,.5,-.152+swing*.14,.19,.17,.06,armor,swing);
   b.box(x,.265,-.13+swing*.27,.16,.22,.06,dark,swing);
   b.box(x,.048,-.08+swing*.33,.265,.073,.407,'#101d25');
   b.box(side*(width/2+.058),1.06,-.461+kick,.156,.155,.22,dark);
  }
 }
 b.box(0,1.045,0,width,.65,.43,uniform);
 b.box(0,1.11,-.235,width*.87,.45,.12,armor);
 b.box(0,.785,0,width*.97,.115,.47,dark);
 b.box(0,1.12,.286,medic?.49:.4,medic?.61:.49,medic?.33:.24,medic?'#adcdc3':dark);
 b.sphere(0,1.55,0,.47,.45,.43,enemy?'#a18876':'#c0ac94');
 b.sphere(0,1.719,.015,heavy?.63:.55,.4,.55,armor);
 b.box(0,1.612,-.231,.415,.116,.09,dark);
 b.box(0,1.625,-.28,.366,.045,.02,enemy?'#cf987a':'#8ebac4');
 if(detail){
  for(const side of [-1,1]){
   b.box(side*.235,1.589,.015,.1,.19,.22,dark);
   b.box(side*width*.36,.84,-.256,.125,.175,.115,uniform);
   b.box(side*width*.25,1.19,-.31,.048,.29,.028,trim);
  }
  b.box(0,1.01,-.322,.23,.132,.091,dark);
  b.box(0,.784,-.25,.118,.064,.043,trim);
 }
 if(medic){
  for(const side of [-1,1])b.box(side*(width/2+.071),1.17,-.21,.189,.075,.216,'#e6ece5');
  for(const face of [-1,1]){
   const z=face<0?-.321:.456;
   b.box(0,1.2,z,.27,.062,.022,'#bf5d51');b.box(0,1.2,z,.062,.27,.022,'#bf5d51');
  }
 }
 if(officer){
  b.box(0,1.825,-.095,.48,.071,.38,'#c7ad76');
  b.box(-.23,1.265,.32,.184,.33,.195,dark);
  b.box(-.269,1.56,.353,.025,.37,.025,'#14212b',0,0,.09);
  b.box(-.247,1.338,.428,.056,.049,.02,'#d6c48a',0,0,0,'glow');
 }
 if(player)b.box(0,1.82,.235,.188,.071,.065,'#f4df9e',0,0,0,'glow');
 if(u.role==='marksman')b.box(.16,1.125,-.66+kick,.091,.094,.31,dark);
 const length=heavy?1.06:u.weapon==='marksman'?.98:u.weapon==='pistol'?.42:u.weapon==='smg'?.63:.82;
 b.box(.16,1.01,-.41-length*.36+kick,heavy?.2:.125,.148,length*.81,dark);
 b.box(.16,1.038,-.48-length*.73+kick,.063,.064,length*.42,trim);
 b.box(.16,.881,-.42-length*.27+kick,.097,.221,.123,uniform,-.16);
 if(detail){
  b.box(.16,1.099,-.415-length*.32+kick,.087,.034,length*.5,'#4b5d66');
  b.box(.16,1.095,-.48-length*.67+kick,.054,.066,.076,dark);
 }
 if(fireAge<.06)b.add('cone',.16,1.04,-.53-length*.95+kick,.22,.31,.22,'#ffe6a0',-Math.PI/2,0,0,'glow');
 b.root=null;
}
