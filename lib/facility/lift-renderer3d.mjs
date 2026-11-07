import {TILE} from './world-config.mjs';
import {LIFT_RISE,LIFT_BUTTON_X,LIFT_BUTTON_HEIGHT,liftDoorFraction,liftDisplay,liftOffset} from './lift-geometry.mjs';

const DIGITS={0:'ab cdef'.replaceAll(' ',''),1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg','-':'g','+':'g',R:'abefg'};
function digit(b,text,x,y,z,size,tint){
 for(let i=0;i<text.length;i++){
  const cx=x+(i-(text.length-1)/2)*size*.8;
  const positions={a:[0,.5,.5,.08],b:[.28,.25,.08,.42],c:[.28,-.25,.08,.42],d:[0,-.5,.5,.08],e:[-.28,-.25,.08,.42],f:[-.28,.25,.08,.42],g:[0,0,.5,.08]};
  for(const key of DIGITS[text[i]]||'') {
   const [dx,dy,w,h]=positions[key];b.box(cx+dx*size,y+dy*size,z,w*size,h*size,.025,tint,0,0,0,'glow');
  }
  if(text[i]==='+')b.box(cx,y,z,.08*size,.42*size,.025,tint,0,0,0,'glow');
  if(text[i]==='R')b.box(cx+.15*size,y-.28*size,z,.08*size,.5*size,.025,tint,0,0,-.5,'glow');
 }
}
function arrow(b,x,y,z,up,tint,scale=1){
 const side=up?1:-1;
 b.box(x,y,z,.035*scale,.25*scale,.03,tint,0,0,0,'glow');
 for(const sign of [-1,1])b.box(x+sign*.055*scale,y+side*.07*scale,z,.035*scale,.15*scale,.03,tint,0,0,sign*side*.65,'glow');
}
function screen(b,l,x,y,z,width=.95){
 const {floor,direction}=liftDisplay(l),label=floor===l.max?'R':floor>0?'+'+floor:String(floor);
 b.box(x,y,z-.03,width,.46,.10,'#85959b');
 b.box(x,y,z+.025,width-.07,.39,.025,'#071c23');
 digit(b,label,x-.09,y,z+.05,.23,'#a9f2db');
 if(direction!==-1)arrow(b,x+width*.33,y+.065,z+.05,true,'#94e9d5',.62);
 if(direction!==1)arrow(b,x+width*.33,y-.065,z+.05,false,'#94e9d5',.62);
}
function doors(b,x,z,height,opening,car=false){
 const offset=car?-4/TILE:0,thickness=car?.10:.18;
 for(const side of [-1,1]){
  const leaf=x+side*(21+42*opening)/TILE;
  b.box(leaf,height+1.4,z+offset,42/TILE,2.8,thickness,car?'#a0aeb2':'#657f8b');
  b.box(leaf,height+.32,z+offset+.11,1.18,.08,.025,'#314a56');
  b.box(leaf,height+2.54,z+offset+.11,1.18,.04,.025,'#314a56');
  b.box(leaf-side*.59,height+1.4,z+offset+.11,.025,2.5,.035,'#d5c28a');
 }
}
export function drawLift3D(b,l,floor,fps){
 const x=l.x/TILE,z=l.y/TILE,offset=liftOffset(l,floor);
 if(fps){
  const bottom=-.2,height=LIFT_RISE+.2;
  for(const side of [-1,1]){
   b.box(x+side*50/TILE,bottom+height/2,z,.25,height,3.35,'#293d49');
   b.box(x+side*1.36,bottom+height/2,z-.9,.07,height,.11,'#98a4a3');
  }
  b.box(x,bottom+height/2,z-50/TILE,3.35,height,.25,'#283c49');
  // Every landing has its own interlocked gate, including landings passed in transit.
  for(let level=floor;level<=floor;level++){
   const y=(level-floor)*LIFT_RISE,open=liftDoorFraction(l,level);
   for(const side of [-1,1])b.box(x+side*65/TILE,y+LIFT_RISE/2,z+48/TILE,30/TILE,LIFT_RISE,.25,'#364e5c');
   b.box(x,y+3.73,z+48/TILE,3.4,1.74,.25,'#364e5c');
   for(const side of [-1,1])b.box(x+side*44/TILE,y+1.48,z+49/TILE,.12,2.96,.20,'#d4bc83');
   b.box(x,y+2.94,z+49/TILE,2.9,.12,.20,'#d4bc83');
   doors(b,x,z+48/TILE,y,open);
   screen(b,l,x,y+3.32,z+53/TILE,1.3);
   b.box(x+64/TILE,y+1.2,z+53/TILE,.36,.53,.14,'#9aa8a9');
   b.cylinder(x+64/TILE,y+1.2,z+56/TILE,.20,.06,.20,l.queue.includes(level)?'#f2d37f':'#9de2d1',Math.PI/2,0,0,'glow');
  }
 }
 if(Math.abs(offset)<7){
  b.box(x,offset-.055,z,84/TILE,.11,86/TILE,'#68828b');
  b.box(x,offset+.008,z,2.45,.015,2.45,'#354f5a');
  if(fps){
   for(const side of [-1,1]){
    b.box(x+side*42/TILE,offset+1.35,z,.125,2.7,86/TILE,'#697f89');
    b.box(x+side*39/TILE,offset+.92,z,.035,.075,2.25,'#d7c48b');
   }
   b.box(x,offset+1.35,z-42/TILE,84/TILE,2.7,.125,'#6b828c');
   b.box(x,offset+2.73,z,84/TILE,.12,86/TILE,'#263f4c');
   b.box(x,offset+2.65,z,.40,.05,1.8,'#c8f0f4',0,0,0,'glow');
   doors(b,x,z+48/TILE,offset,l.doorOpen,true);
   b.box(x+25/TILE,offset+1.2,z-39/TILE,.86,1.28,.06,'#1d333d');
   screen(b,l,x+25/TILE,offset+2.12,z-38/TILE,.84);
   for(let floor=l.min;floor<=l.max;floor++){
    const index=floor-l.min,px=x+LIFT_BUTTON_X[index%2]/TILE,py=offset+LIFT_BUTTON_HEIGHT[Math.floor(index/2)];
    const selected=l.stops.includes(floor)||l.moving&&l.targetFloor===floor;
    b.cylinder(px,py,z-37/TILE,.205,.06,.205,selected?'#ddbc6d':'#b5c6c8',Math.PI/2);
    digit(b,floor===l.max?'R':String(floor),px,py,z-35.7/TILE,.105,selected?'#f8e9ac':'#1e4650');
   }
  }
 }
 b.box(x,.02,z+1.72,2.8,.04,.10,liftDoorFraction(l,floor)>.9?'#9ae9c7':'#d3a761',0,0,0,'glow');
}
