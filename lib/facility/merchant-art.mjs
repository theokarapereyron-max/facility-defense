const box=(c,x,y,w,h,fill,stroke)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}};
const circle=(c,x,y,r,fill,stroke)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
export function drawMerchant(c,p){
 const {x,y,w,h,type}=p,col=p.displayColor||'#e5c787',metal=c.createLinearGradient(x,y,x,y+h);metal.addColorStop(0,'#63818d');metal.addColorStop(.3,'#2c485a');metal.addColorStop(1,'#102938');
 box(c,x,y,w,h,metal,col+'a0');box(c,x+4,y+5,w-8,h-11,'#142b3d','#9db8c744');box(c,x+8,y+h-12,w-16,6,'#0a1d2a');
 if(type==='counter'){
  box(c,x+11,y+10,w*.34,h*.45,'#102432','#80d4d8');box(c,x+15,y+14,w*.34-8,h*.45-8,'#204f60');c.fillStyle='#a6edf0';c.font='600 11px monospace';c.textAlign='left';c.fillText('CR',x+21,y+30);
  for(let i=0;i<3;i++)box(c,x+21,y+36+i*4,20+i*7,2,'#79bcc6a0');
  box(c,x+w*.49,y+11,w*.41,h*.45,'#334b5a','#95adbc');box(c,x+w*.52,y+16,w*.35,4,'#101e2b');box(c,x+w*.63,y+26,14,9,'#0b202d',col);circle(c,x+w*.69,y+31,2,col);
  box(c,x+11,y+h*.63,w*.5,h*.19,'#789497','#aac3c455');for(let i=0;i<8;i++)box(c,x+15+i*5,y+h*.68,3,2,'#203947');
  box(c,x+w-29,y+h*.62,16,18,'#0d2230','#a1c2c6');box(c,x+w-26,y+h*.66,10,6,'#6faea8');
 }else{
  const count=3,cell=(w-20)/count;for(let i=0;i<count;i++){
   const xx=x+10+i*cell,yy=y+10,cx=xx+cell/2,cy=yy+(h-26)/2;box(c,xx+2,yy,cell-4,h-24,'#09212d','#647f9255');
   if(p.category==='medical'){box(c,cx-12,cy-11,24,22,'#a7cbc0','#c8e7d6');box(c,cx-8,cy-2,16,4,'#367660');box(c,cx-2,cy-8,4,16,'#367660');}
   else if(p.category==='combat'){box(c,cx-17,cy-2,30,5,'#a4b6bc');box(c,cx+12,cy-1,7,3,'#e4d9b6');box(c,cx-5,cy+2,5,8,'#5e827d');box(c,cx-16,cy-5,9,10,'#557478');for(let j=0;j<3;j++){box(c,cx-10+j*9,cy+14,4,7,'#c3aa70');box(c,cx-10+j*9,cy+12,4,3,'#e2cc9b');}}
   else if(p.category==='protection'){circle(c,cx,cy-2,14,'#6e8a95','#c5d9df');box(c,cx-14,cy,28,10,'#364f65');box(c,cx-11,cy+2,22,4,'#112d43');box(c,cx-11,cy+15,22,4,col+'a0');}
   else if(p.category==='intelligence'){box(c,cx-12,cy-15,24,31,'#1a4055','#87c8d7');box(c,cx-8,cy-11,16,21,'#0a2334');circle(c,cx,cy,6,null,col);box(c,cx-8,cy+6,16,2,col+'99');circle(c,cx,cy+13,1.5,'#b2d6df');}
   else{box(c,cx-15,cy-11,30,24,'#465f6b','#a8c5d1');box(c,cx-5,cy-15,10,4,'#142c3f','#b7d7df');box(c,cx-13,cy-3,26,4,col+'88');for(const side of [-1,1])box(c,cx+side*10-1,cy-8,2,18,'#122738');}
  }
  const glass=c.createLinearGradient(x,y,x+w,y+h);glass.addColorStop(0,'#c2f2ff22');glass.addColorStop(.45,'#79b5db02');glass.addColorStop(1,'#8fc0db14');box(c,x+6,y+6,w-12,h-18,glass,'#8ac3cf33');
 }
 for(const xx of [x+5,x+w-6])for(const yy of [y+5,y+h-6])circle(c,xx,yy,1.4,'#c7dae2');
 c.fillStyle=col;c.font='600 11px sans-serif';c.textAlign='center';c.fillText(type==='counter'?'INTENDANCE · CR':p.name.replace('STAND · ',''),x+w/2,y+h+17);
}
