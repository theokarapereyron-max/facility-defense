import {airframeBlocksGround} from './airlift-geometry.mjs';
import {COLS,ROWS,solid,nearestWalkable} from "./map.mjs";
import {canOpenDoor} from "./room-state.mjs";
import {stairFootprint} from './stairs.mjs';
import {liftPathBlocked} from './lift-geometry.mjs';
class Heap{constructor(){this.a=[];}push(n){let i=this.a.length;this.a.push(n);while(i){const p=(i-1)>>1;if(this.a[p].f<=n.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=n;}pop(){const n=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(last.f<=this.a[c].f)break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return n;}}
export class PathfindingSystem{
 constructor(){this.calls=0;this.cache=new Map();}
 path(f,a,b){
  this.calls++;const to=nearestWalkable(f,b.x,b.y),sx=Math.floor(a.x/32),sy=Math.floor(a.y/32),tx=Math.floor(to.x/32),ty=Math.floor(to.y/32),first=sy*COLS+sx,last=ty*COLS+tx,key=f.id+":"+first+":"+last+":"+f.version+":"+(a.team||"ally");
  if(this.cache.has(key))return this.cache.get(key).map(p=>({...p}));
  const g=new Float32Array(COLS*ROWS);g.fill(Infinity);const parent=new Int32Array(COLS*ROWS);parent.fill(-1);const closed=new Uint8Array(COLS*ROWS),heap=new Heap(),h=(x,y)=>Math.abs(tx-x)+Math.abs(ty-y);g[first]=0;heap.push({i:first,f:h(sx,sy)});let found=false,count=0;
  while(heap.a.length&&count++<COLS*ROWS){const {i}=heap.pop();if(closed[i])continue;closed[i]=1;if(i===last){found=true;break;}const x=i%COLS,y=Math.floor(i/COLS);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=COLS-1||ny>=ROWS-1)continue;const j=ny*COLS+nx,v=f.grid[j];if(v===1||v===3||closed[j]||airframeBlocksGround(f,(nx+.5)*32,(ny+.5)*32,14)||f.connectors.some(c=>(c.type==="stairs"&&stairFootprint(c,(nx+.5)*32,(ny+.5)*32,16)||c.type==="elevator"&&liftPathBlocked(c,(nx+.5)*32,(ny+.5)*32))))continue;const door=v===2?f.doorByCell.get(j):null;const ng=g[i]+1+(door?(canOpenDoor(door,a.team||"ally")?1.5:door.lockTeam===a.team?10:40):0);if(ng<g[j]){g[j]=ng;parent[j]=i;heap.push({i:j,f:ng+h(nx,ny)});}}}
  if(!found)return [];const path=[];let i=last;while(i!==first&&i!==-1){path.push({x:(i%COLS+.5)*32,y:(Math.floor(i/COLS)+.5)*32});i=parent[i];}path.reverse();const result=path.filter((p,i)=>i===0||i===path.length-1||path[i-1].x!==path[i+1].x&&path[i-1].y!==path[i+1].y);if(this.cache.size>600)this.cache.clear();this.cache.set(key,result);return result.map(p=>({...p}));
 }
}
export function raycast(f,x,y,a,range){const dx=Math.cos(a),dy=Math.sin(a);for(let t=8;t<=range;t+=8){const px=x+dx*t,py=y+dy*t;if(solid(f,px,py))return {x:px,y:py,d:t,wall:true};}return {x:x+dx*range,y:y+dy*range,d:range,wall:false};}
export function lineOfSight(f,a,b){const d=Math.hypot(b.x-a.x,b.y-a.y);return raycast(f,a.x,a.y,Math.atan2(b.y-a.y,b.x-a.x),d).d>=d-12;}
export class SpatialHash{constructor(size=240){this.size=size;this.cells=new Map();}build(units){this.cells.clear();for(const u of units){if(u.health<=0||u.transit)continue;const k=u.floor+":"+Math.floor(u.x/this.size)+":"+Math.floor(u.y/this.size);if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(u);}}nearby(f,x,y,r){const out=[],s=this.size;for(let yy=Math.floor((y-r)/s);yy<=Math.floor((y+r)/s);yy++)for(let xx=Math.floor((x-r)/s);xx<=Math.floor((x+r)/s);xx++){const arr=this.cells.get(f+":"+xx+":"+yy);if(arr)for(const u of arr)if((u.x-x)**2+(u.y-y)**2<=r*r)out.push(u);}return out;}}
