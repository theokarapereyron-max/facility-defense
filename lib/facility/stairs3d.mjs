import * as THREE from 'three';
import {TILE} from './world-config.mjs';
import {STAIR_RISE,STAIR_TREADS} from './stairs.mjs';

export function floorOpenings(f,ceiling=false){
 return f.connectors.flatMap(c=>{
  if(c.type==='stairs'){
   if(ceiling?f.id>=c.max:f.id<=c.min)return [];
   return [{left:c.x/TILE-2,right:c.x/TILE+2,top:c.y/TILE-4.5,bottom:c.y/TILE+3.5}];
  }
  return [{left:c.x/TILE-1.4,right:c.x/TILE+1.4,top:c.y/TILE-1.4,bottom:c.y/TILE+1.5}];
 });
}

// Split every surface into real triangles around the openings, including room overlays.
export function deckGeometry(rect,holes){
 let pieces=[rect];
 for(const h of holes){
  pieces=pieces.flatMap(r=>{
   const left=Math.max(r.left,h.left),right=Math.min(r.right,h.right);
   const top=Math.max(r.top,h.top),bottom=Math.min(r.bottom,h.bottom);
   if(left>=right||top>=bottom)return [r];
   return [
    {left:r.left,right:r.right,top:r.top,bottom:top},
    {left:r.left,right:r.right,top:bottom,bottom:r.bottom},
    {left:r.left,right:left,top,bottom},
    {left:right,right:r.right,top,bottom},
   ].filter(p=>p.right-p.left>.001&&p.bottom-p.top>.001);
  });
 }
 const positions=[],uv=[];
 for(const r of pieces){
  for(const [x,z] of [[r.left,r.top],[r.left,r.bottom],[r.right,r.bottom],[r.left,r.top],[r.right,r.bottom],[r.right,r.top]]){
   positions.push(x,0,z);uv.push(x/196,z/120);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();
 return g;
}

export function drawStairFlight(b,c,base=0){
 const x=c.x/TILE,z=c.y/TILE,half=STAIR_RISE/2,run=7;
 for(let i=0;i<STAIR_TREADS;i++){
  const t=(i+1)/STAIR_TREADS,h=base+t*half;
  const a=z+3.5-(i+.5)*run/STAIR_TREADS;
  const d=z-3.5+(i+.5)*run/STAIR_TREADS;
  b.box(x-1,h-.08,a,1.82,.16,run/STAIR_TREADS,'#607985');
  b.box(x+1,h+half-.08,d,1.82,.16,run/STAIR_TREADS,'#607985');
  b.box(x-1,h+.005,a-run/STAIR_TREADS/2+.025,1.72,.025,.045,'#dbc48a');
  b.box(x+1,h+half+.005,d+run/STAIR_TREADS/2-.025,1.72,.025,.045,'#dbc48a');
 }
 b.box(x,base+half-.09,z-4,4,.18,1,'#58717b');
 const slope=Math.atan2(half,run),length=Math.hypot(half,run);
 for(const lane of [-1,1])for(const edge of [-.94,.94]){
  const sx=x+lane+edge,mid=base+(lane<0?half/2:half*1.5);
  b.box(sx,mid-.17,z,.09,.20,length,'#283e4b',lane<0?slope:-slope);
  b.box(sx,mid+.95,z,.065,.065,length,'#d5bf8a',lane<0?slope:-slope);
  for(let i=0;i<5;i++){
   const t=i/4,sy=base+(lane<0?t:2-t)*half;
   b.box(sx,sy+.44,z+3.5-t*run,.05,.88,.05,'#91a4aa');
  }
 }
 for(const side of [-1,1]){
  b.box(x+side*1.94,base+half+.48,z-4,.06,.96,1,'#8da6ad');
 }
 b.box(x,base+half+.96,z-4.47,3.9,.065,.065,'#d5bf8a');
}

export function drawStairwell(b,c,floor){
 const x=c.x/TILE,z=c.y/TILE;
 if(floor<c.max)drawStairFlight(b,c,0);
 // A continuous slab edge reveals the thickness of the opening.
 if(floor>c.min){
  for(const side of [-1,1])b.box(x+side*2.07,-.16,z-.5,.14,.32,8,'#293e4a');
  b.box(x,-.16,z-4.57,4.28,.32,.14,'#293e4a');
  b.box(x,-.16,z+3.57,4.28,.32,.14,'#293e4a');
 }
 b.box(x, .025,z+4.15,4.3,.05,.12,'#d5c285');
}
