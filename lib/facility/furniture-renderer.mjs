import {occupied} from './items.mjs';
import {drawMerchant} from './merchant-art.mjs';
const box=(c,x,y,w,h,fill,stroke)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.strokeRect(x+1,y+1,w-2,h-2);}};
const disk=(c,x,y,r,fill,stroke)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
export function drawFurniture(c,p,near=false,zoom=1){
 const {x,y,w,h,type}=p,medical=p.theme==='medical',edge=medical?'#adcfc8':'#93a8b3',surface=medical?'#6a9189':'#66777c';
 c.save();if(p.solid)box(c,x+6,y+7,w,h,'#050a087a');
 if(type==='counter'||type==='stand'){
  drawMerchant(c,p);
 }else if(type==='vehicle'){
  box(c,x+7,y,w-14,h,'#526548','#899676');box(c,x+35,y+10,w-70,h-20,'#667b57');box(c,x+w-47,y+12,29,h-24,'#223b37','#83aaa0');
  for(const xx of [x+22,x+w-47]){box(c,xx,y-4,24,10,'#0e1a12');box(c,xx,y+h-6,24,10,'#0e1a12');}box(c,x+11,y+12,17,h-24,'#354835','#748568');
 }else if(type==='bed'){
  box(c,x,y,w,h,'#748e82','#bac6b0');box(c,x+7,y+7,w-14,31,'#c0cabb','#dbe0cd');box(c,x+5,y+42,w-10,h-63,'#41645d','#708d79');box(c,x+6,y+h-18,w-12,13,'#3d5243','#8c9e80');box(c,x+w/2-10,y+h-13,20,3,'#b7c3a9');
 }else if(type==='medical'){
  box(c,x,y,w,h,'#5a8278','#a1bcb0');box(c,x+6,y+6,w-12,h-12,'#aec2b3');box(c,x+15,y+19,24,7,'#50856d');box(c,x+24,y+10,7,25,'#50856d');for(let i=0;i<3;i++)box(c,x+w-32+i*7,y+15,4,23,'#517b77','#719c8e');for(const xx of [x+3,x+w-10])for(const yy of [y+3,y+h-10])disk(c,xx+3,yy+3,4,'#182d25');
 }else if(type==='hatch'){
  box(c,x,y,w,h,'#152b25','#708f78');box(c,x+6,y+6,w-12,h-12,'#2c4737','#4f6b4e');for(let i=0;i<3;i++)box(c,x+12,y+13+i*10,w-24,3,'#192e25');box(c,x+w/2-8,y+h-16,16,5,'#a4aa79');for(const xx of [x+3,x+w-8])box(c,xx,y+3,5,9,'#c3b572');
 }else if(type==='jar'){
  box(c,x,y,w,h,medical?'#90ab9c':'#6a7055',edge);for(const [xx,yy,r] of [[x+w*.33,y+h*.38,12],[x+w*.68,y+h*.64,10]]){disk(c,xx+2,yy+3,r,'#102a2240');disk(c,xx,yy,r,medical?'#72b7c28c':'#acb57290','#cfddbb');disk(c,xx,yy,r*.5,medical?'#a4e0e3':'#d0b982');}box(c,x+5,y+h-9,w-10,3,'#d7ddba66');
 }else if(type==='bag'){
  box(c,x,y,w,h,'#7a7752','#c9ba7c');box(c,x+6,y,4,h,'#c1b17b');box(c,x+w-10,y,4,h,'#c1b17b');box(c,x+12,y+5,w-24,h-10,'#344b38');
 }else if(type==='shelf'){
  box(c,x,y,w,h,'#3f503b','#9caa7d');for(let row=0;row<3;row++){const yy=y+7+row*(h-14)/3;box(c,x+5,yy,w-10,(h-18)/3,'#1e342b');if(p.theme==='archive'){for(let i=0;i<5;i++)box(c,x+9+i*9,yy+6,6,25,['#a8b390','#747e64','#baa471'][i%3]);}else{box(c,x+10,yy+7,20,20,'#8f946c','#b6bb89');box(c,x+35,yy+8,w-44,20,'#617e68','#88a182');}}
 }else if(type==='locker'){
  box(c,x,y,w,h,'#465d51','#94a188');for(let i=0;i<2;i++){const xx=x+4+i*(w-8)/2;box(c,xx,y+4,(w-10)/2,h-8,'#586e59','#819278');for(let j=0;j<3;j++)box(c,xx+6,y+12+j*5,(w-10)/2-12,2,'#2d4538');box(c,xx+(w-10)/2-7,y+h*.6,3,13,'#c0bf96');}box(c,x+6,y+h-10,w-12,3,'#243b2c');
 }else if(type==='drawer'||type==='cabinet'){
  box(c,x,y,w,h,surface,edge);const n=type==='drawer'?3:2;for(let i=0;i<n;i++){const yy=y+4+i*(h-8)/n;box(c,x+4,yy,w-8,(h-10)/n,'#53644c','#7a8a67');box(c,x+w/2-10,yy+(h-10)/n/2,20,3,'#b6c299');}
 }else if(type==='crate'||type==='box'){
  box(c,x,y,w,h,type==='crate'?'#6c7252':'#6a7059','#a5ae7e');box(c,x+7,y+7,w-14,h-14,'#4d6048','#84926b');for(const xx of [x+w*.26,x+w*.72])box(c,xx,y+2,5,h-4,'#a1a476');box(c,x+w/2-9,y+h/2-7,18,14,'#b5b98e');box(c,x+w/2-5,y+h/2-3,10,2,'#475b40');
 }else if(type==='sofa'){
  box(c,x,y,w,h,'#355a4c','#809778');box(c,x+8,y+13,w-16,h-21,'#496c57','#758c6a');box(c,x+6,y+5,w-12,9,'#78916f');box(c,x+4,y+9,9,h-14,'#5c7c61');box(c,x+w-13,y+9,9,h-14,'#5c7c61');box(c,x+w/2,y+15,2,h-24,'#294d3d');
 }else{
  box(c,x,y,w,h,type==='workbench'?'#5a6e60':'#71775a',edge);box(c,x+4,y+4,w-8,h-8,type==='workbench'?'#6c8170':'#858965');
  if(type==='desk'){box(c,x+16,y+10,30,24,'#b4bbaa');for(let i=0;i<3;i++)box(c,x+20,y+15+i*5,20,2,'#6c856b');}
  else if(type==='workbench'){box(c,x+9,y+10,33,h-20,'#304f42','#9fac86');box(c,x+17,y+17,18,8,'#a4bcb0');box(c,x+24,y+23,5,22,'#7c9085');for(let i=0;i<3;i++){box(c,x+57+i*15,y+16,6,28,'#3c5748');box(c,x+58+i*15,y+17,4,10,'#d1b581');}}
  else if(p.theme==='kitchen'||p.theme==='rest'){for(const xx of [x+w*.27,x+w*.73]){disk(c,xx,y+h/2,15,'#c0c5ab','#e3e1c8');disk(c,xx,y+h/2,10,'#819876');}box(c,x+w/2-6,y+9,12,19,'#a8b290');}
  else{box(c,x+12,y+12,w-24,h-24,'#395745','#799779');for(let i=0;i<3;i++)box(c,x+22+i*24,y+20,14,12,'#9faa7b');}
 }
 // Raised front edge, contact shadow and corner fasteners unify the volumes.
 if(p.solid){box(c,x+2,y+h-8,w-4,6,'#06151d55');box(c,x+2,y+2,w-4,2,'#dfedf42b');for(const xx of [x+5,x+w-7])disk(c,xx,y+5,1.2,'#d3e2e175');}
 const used=occupied(p.items);for(let i=0;i<p.capacity;i++)box(c,x+4+i*5,y+h-5,3,2,p.items[i]?'#c9d99d':'#304d3d');
 if(near){c.strokeStyle='#edd28c';c.lineWidth=2/zoom;c.strokeRect(x-4,y-4,w+8,h+8);const text=p.name+' · '+used+'/'+p.capacity;c.font='600 '+13/zoom+'px Arial';const tw=c.measureText(text).width;box(c,x+w/2-tw/2-8/zoom,y-31/zoom,tw+16/zoom,23/zoom,'#0d201bee','#ae9d65');c.fillStyle='#e8d7a2';c.textAlign='center';c.fillText(text,x+w/2,y-15/zoom);}
 c.restore();
}
