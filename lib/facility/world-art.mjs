import {COLS,ROWS,CORE,dist} from './map.mjs';

export const FLOOR_PALETTES=[
 {base:'#202c34',tile:'#293943',wall:'#536473',light:'#9fdbea',accent:'#63cde5'},
 {base:'#302d28',tile:'#3a3730',wall:'#706655',light:'#c8b994',accent:'#d9ae68'},
 {base:'#243037',tile:'#2d3c43',wall:'#576d78',light:'#b3ced8',accent:'#75bcd7'},
 {base:'#293635',tile:'#354442',wall:'#647d76',light:'#c5ddd0',accent:'#92cbb2'},
 {base:'#272b3c',tile:'#33394b',wall:'#646e85',light:'#bfcde6',accent:'#8aa9e6'},
 {base:'#243536',tile:'#304445',wall:'#597a7c',light:'#b9e1db',accent:'#63d6c7'},
 {base:'#30333a',tile:'#3b404a',wall:'#737e8c',light:'#d3dce7',accent:'#e7be75'},
 {base:'#29323b',tile:'#323d48',wall:'#637887',light:'#b9d0e0',accent:'#9fc9e3'}
];
const box=(c,x,y,w,h,fill,stroke)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.strokeRect(x+.5,y+.5,w-1,h-1);}};
const disk=(c,x,y,r,fill,stroke)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
const line=(c,x,y,ex,ey,col,width=1)=>{c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.stroke();};
const noise=(x,y)=>((Math.imul(x+17,374761393)^Math.imul(y+31,668265263))>>>0)/4294967296;
export function glow(c,x,y,r,col){const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
export function hazard(c,x,y,w,h){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();box(c,x,y,w,h,'#121c23');for(let i=-h;i<w+h;i+=18){c.fillStyle='#c0a56980';c.beginPath();c.moveTo(x+i,y);c.lineTo(x+i+8,y);c.lineTo(x+i+8-h,y+h);c.lineTo(x+i-h,y+h);c.closePath();c.fill();}c.restore();}
function tile(renderer,f,variant){
 const key=f.id+':'+variant;if(renderer.surfaceCache.has(key))return renderer.surfaceCache.get(key);
 const p=FLOOR_PALETTES[f.id+2],can=document.createElement('canvas');can.width=64;can.height=64;const c=can.getContext('2d');
 const material=c.createLinearGradient(0,0,64,64);material.addColorStop(0,p.tile);material.addColorStop(1,p.base);box(c,0,0,64,64,p.base);box(c,1,1,62,62,material);line(c,2,2,62,2,'#d7ecf018');line(c,62,3,62,62,'#0003');
 for(let i=0;i<24;i++){const x=noise(i,variant)*60+2,y=noise(i+27,variant)*60+2;box(c,x,y,1+noise(i,4)*5,.7,i%2?'#ffffff09':'#00000014');}
 if(f.id===1||f.id===3){box(c,3,3,58,58,'#abc9c407');line(c,0,32,64,32,'#d5f2ee0a');line(c,32,0,32,64,'#d5f2ee0a');}
 else if(f.id===-2||f.isRoof)for(let y=8;y<60;y+=8)for(let x=6;x<60;x+=12){line(c,x,y,x+5,y-2,'#abb5bd12',1.5);}
 else{for(const [x,y] of [[5,5],[59,5],[5,59],[59,59]])disk(c,x,y,1.2,'#0b172266','#9db8be22');}
 renderer.surfaceCache.set(key,can);return can;
}
export function drawArchitecture(renderer,c,f,left,top,right,bottom,visible){
 const p=FLOOR_PALETTES[f.id+2],minX=Math.max(0,Math.floor(left/32)-1),maxX=Math.min(COLS-1,Math.ceil(right/32)+1),minY=Math.max(0,Math.floor(top/32)-1),maxY=Math.min(ROWS-1,Math.ceil(bottom/32)+1);
 c.lineWidth=1;
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  const i=y*COLS+x,v=f.grid[i],px=x*32,py=y*32;
  if(v!==1){c.drawImage(tile(renderer,f,(x+y)%3),0,0,32,32,px,py,32,32);continue;}
  const n=f.grid[i-COLS],s=f.grid[i+COLS],e=f.grid[i+1],w=f.grid[i-1],open=v=>v!==undefined&&v!==1;
  if(![n,s,e,w].some(open))continue;
  box(c,px+7,py+12,32,32,'#030912b0');const steel=c.createLinearGradient(px,py,px+32,py+32);steel.addColorStop(0,p.wall);steel.addColorStop(1,'#1c3341');box(c,px,py,32,32,steel);box(c,px+2,py+2,28,5,p.light+'88');box(c,px+2,py+9,28,21,'#12232a70');
  if(open(s)){line(c,px,py+30,px+32,py+30,'#06131d',3);line(c,px+3,py+10,px+29,py+10,p.accent+'30');}
  if(open(e))line(c,px+30,py+2,px+30,py+30,'#0b1b24',3);if(open(w))line(c,px+1,py+2,px+1,py+30,p.light+'44',2);
  if((x+y)%4===0){box(c,px+5,py+15,20,3,'#172129');box(c,px+7,py+21,16,2,'#c8dce320');}
  if(renderer.settings.graphicsQuality!=='balanced'){disk(c,px+5,py+5,1.3,'#d3e6ed66');disk(c,px+26,py+27,1.1,'#030e18');}
 }
 for(const r of f.rooms)if(visible(r.x,r.y,r.w,r.h)){
  const med=r.furnitureTheme==='medical',accent=med?'#9bdfbf':r.type==='shop'?'#e5c37d':p.accent;
  c.strokeStyle=accent+'23';c.lineWidth=2;c.strokeRect(r.x+39,r.y+39,r.w-78,r.h-78);
  // Flush lights and conduit remain within the room, away from doors and circulation.
  for(let x=r.x+80;x<r.x+r.w-64;x+=192){box(c,x,r.y+35,54,5,'#08141b');box(c,x+2,r.y+35,50,2,accent+'a0');if(renderer.settings.effects)glow(c,x+27,r.y+50,74,accent+'13');}
  if(med){const x=r.x+r.w-90,y=r.y+r.h-90;box(c,x-20,y-5,40,10,'#a8eac127');box(c,x-5,y-20,10,40,'#a8eac127');}
 }
 // Corridor lanes and navigational arrows give long hallways a direction.
 c.save();c.lineWidth=2;c.setLineDash([26,22]);for(const y of [1104,1808,2864])line(c,Math.max(left,256),y,Math.min(right,6120),y,p.accent+'28',2);c.setLineDash([]);
 for(const con of f.connectors)if(visible(con.x-70,con.y-75,140,150)){hazard(c,con.x-61,con.y+44,122,8);for(const offset of [-1,1]){c.strokeStyle=p.accent+'50';c.beginPath();c.moveTo(con.x+offset*85,con.y+9);c.lineTo(con.x+offset*72,con.y);c.lineTo(con.x+offset*85,con.y-9);c.stroke();}}
 c.restore();
}
export function drawCore(c,sim,settings={}){
 const {x,y}=CORE,threat=sim.coreState!=='SECURE',col=threat?'#ff806a':'#6ee0df';
 glow(c,x,y,225,col+'20');c.save();c.translate(x,y);c.lineWidth=2;disk(c,0,0,174,'#081c2780',col+'38');
 for(let i=0;i<12;i++){c.save();c.rotate(i*Math.PI/6);box(c,145,-5,15,10,'#213c48',col+'70');c.restore();}
 for(let j=0;j<3;j++){c.save();c.rotate((settings.reducedMotion?0:sim.time)*(j%2?-.13:.1)+j);c.strokeStyle=col+(j?'66':'aa');c.beginPath();c.ellipse(0,0,110-j*16,65+j*9,j*.7,0,Math.PI*1.7);c.stroke();c.restore();}
 c.rotate(Math.PI/4);box(c,-61,-61,122,122,'#152d3f','#6b93a6');box(c,-49,-49,98,98,'#244e62',col);box(c,-34,-34,68,68,'#5cabbb40');c.restore();
 c.save();c.textAlign='center';c.fillStyle='#e4fcff';c.font='bold 20px monospace';c.fillText('THE CORE',x,y+4);c.font='14px monospace';c.fillStyle=col;c.fillText(Math.round(sim.coreControl)+' %',x,y+31);c.restore();
}
export function drawSoldierBody(c,u,sim,settings){
 const player=u.role==='player',enemy=u.team==='enemy',heavy=u.role==='heavy',marksman=u.role==='marksman',medic=u.role==='medic',officer=u.role==='officer',r=heavy?14:11,col=player?'#d4ffff':enemy?'#ff9175':'#8ad8ef',armor=enemy?'#724640':medic?'#48695e':officer?'#344b6a':'#36566b';
 const gait=Math.sin(settings.reducedMotion?0:u.moveDistance*.11)*(u.goal||player?1:0),recoil=Math.max(0,1-(sim.time-(u.lastShotAt??-100))/.12);
 c.save();c.translate(u.x,u.y);disk(c,4,7,r+6,'#02081188');if(player){disk(c,0,0,24,null,col+'44');c.lineWidth=1.7;disk(c,0,0,19,null,col+'b0');}
 c.rotate(u.angle);box(c,-14+gait*3,-11,15,7,'#1a2b38','#597482');box(c,-14-gait*3,5,15,7,'#1a2b38','#597482');
 // Backpack, shoulder plates, harness and helmet have distinct silhouettes.
 box(c,-13,-8,8,16,'#223544','#68818c');disk(c,0,0,r,armor,col+'99');box(c,-3,-r-3,10,6,armor,col+'70');box(c,-3,r-3,10,6,armor,col+'70');
 if(heavy){box(c,-8,-12,12,24,'#334a59','#b4c7d088');for(const yy of [-9,-2,5])box(c,-6,yy,8,3,'#718696');}if(marksman){box(c,-17,-10,10,20,enemy?'#5f5942':'#4a5d4d','#899b8166');box(c,14,2,24,3,'#96b0ba');box(c,9,1,12,3,'#162f42');}
 box(c,-3,-6,8,12,'#142c3c');box(c,-1,-5,2,10,'#9aabb044');
 c.save();c.translate(-recoil*3,0);box(c,3,5,heavy?29:23,5,'#101c29','#8797a0');box(c,14,4,7,7,'#3c4e59');box(c,23,5,heavy?12:6,2,'#c3cbd3');c.restore();
 disk(c,2,-1,r*.62,enemy?'#b99a82':'#acbec6','#273e50');box(c,5,-6,3,9,'#0d293c',col+'70');line(c,-1,-5,3,-5,'#ebfaff88');
 if(medic){box(c,-9,-3,6,2,'#c2ffe0');box(c,-7,-5,2,6,'#c2ffe0');box(c,0,-3,5,2,'#edfff3');box(c,1.5,-4.5,2,5,'#edfff3');}if(officer){box(c,-7,-7,5,3,'#ebc97c');box(c,-7,5,5,3,'#ebc97c');box(c,6,-7,3,12,'#293e58','#d1be78');}
 if(recoil>0&&settings.effects){glow(c,31,7,38,'#ffc25c33');c.fillStyle='#fff3ba';c.beginPath();c.moveTo(29,4);c.lineTo(42+recoil*7,7);c.lineTo(29,10);c.closePath();c.fill();}
 c.restore();if(sim.time-(u.hurtAt??-100)<.15){disk(c,u.x,u.y,r+2,'#fff2');}
}
export function drawAtmosphere(c,sim,f,visible,settings){
 if(!settings.effects)return;
 for(const d of sim.decals||[])if(d.floor===f.id&&visible(d.x,d.y)){c.save();c.globalAlpha=Math.min(1,(d.until-sim.time)/8)*.65;c.translate(d.x,d.y);c.rotate(d.angle);if(d.type==='casing')box(c,-2,-1,4,2,'#b1a579');else{disk(c,0,0,4,'#070b1488');line(c,-5,1,4,-2,'#b4c4d322');}c.restore();}
 for(let i=0;i<10;i++){const x=480+noise(i,f.id+8)*5200+Math.sin((settings.reducedMotion?0:sim.time)*.13+i)*36,y=300+noise(i+80,f.id+8)*3000+Math.cos((settings.reducedMotion?0:sim.time)*.1+i)*28;if(visible(x,y))disk(c,x,y,1.3,'#d3edf425');}
}
export function drawBattleEffect(c,e){
 const v=Math.max(0,e.life/e.max),age=1-v;c.save();c.globalAlpha=v;
 if(e.type==='explosion'||e.type==='flash'){
  const flash=e.type==='flash',r=(flash?220:120)*age+15;glow(c,e.x,e.y,r,flash?'#fff5dc70':'#ffab4260');disk(c,e.x,e.y,r*.35,flash?'#fff8d980':'#ffc37b66');c.lineWidth=2;disk(c,e.x,e.y,r,null,flash?'#ffffcb':'#fcb36c99');
  for(let i=0;i<(flash?8:18);i++){const a=noise(i,Math.floor(e.x))*Math.PI*2,d=r*(.6+noise(i,Math.floor(e.y))*.8);line(c,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,e.x+Math.cos(a)*(d+9),e.y+Math.sin(a)*(d+9),i%2?'#fff0a2':'#e39652',2);}
 }else if(e.type==='spark'&&e.material==='concrete'){
  for(let i=0;i<5;i++){const a=i*2.4,d=age*(9+i*3);disk(c,e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,2+age*6,'#c7b8a17d');}
 }else if(e.type==='spark'&&e.material==='glass'){
  for(let i=0;i<6;i++){const a=i*2.4,d=age*(10+i*3);c.save();c.translate(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d);c.rotate(a+age*3);box(c,-1.3,-3,2.6,6,i%2?'#d8f7ef':'#7bbcc9');c.restore();}
 }else if(e.type!=='xp'){
  const col=e.type==='hit'?'#ffac83':'#f9dda3';for(let i=0;i<5;i++){const a=noise(i,Math.floor(e.x+e.y))*Math.PI*2,len=7+age*26;line(c,e.x+Math.cos(a)*len*.4,e.y+Math.sin(a)*len*.4,e.x+Math.cos(a)*len,e.y+Math.sin(a)*len,col,1.5);}disk(c,e.x,e.y,3*v,'#fff4cf');
 }c.restore();
}
export function drawField(c,field,time){
 c.save();const smoke=field.type==='smoke';
 for(let i=0;i<10;i++){const a=i*2.399+time*(smoke?.06:.13),r=field.radius*(.15+.6*noise(i,7)),x=field.x+Math.cos(a)*r,y=field.y+Math.sin(a)*r;if(smoke){glow(c,x,y,field.radius*.55,'#adbcc12b');}else{glow(c,x,y,field.radius*.38,'#ff7b2730');disk(c,x,y,8+Math.sin(time*8+i)*4,'#ffc46370');}}
 c.setLineDash([4,9]);c.strokeStyle=smoke?'#c8d8d955':'#e7a46166';disk(c,field.x,field.y,field.radius,null,c.strokeStyle);c.restore();
}
export function drawCombatFeedback(renderer,c){
 const s=renderer.sim,p=s.player,hit=s.hitFeedback;
 if(renderer.settings.effects&&hit&&s.time-hit.time<.22){const a=1-(s.time-hit.time)/.22,x=renderer.settings.mouseAim&&renderer.aimScreen?renderer.aimScreen.x:renderer.w/2,y=renderer.settings.mouseAim&&renderer.aimScreen?renderer.aimScreen.y:renderer.h/2;c.save();c.globalAlpha=a;c.strokeStyle=hit.kill?'#ffae79':'#e8ffff';c.lineWidth=2;for(const sx of [-1,1])for(const sy of [-1,1])line(c,x+sx*8,y+sy*8,x+sx*14,y+sy*14,c.strokeStyle,2);c.restore();}
 const attacker=s.units.find(u=>u.id===p.attacker&&u.health>0&&u.floor===p.floor),recent=s.time-(p.hurtAt??-100);
 if(attacker&&recent<1.1){const bearing=Math.atan2(attacker.y-p.y,attacker.x-p.x),a=renderer.isFPS?bearing-p.angle-Math.PI/2:bearing,x=renderer.w/2+Math.cos(a)*85,y=renderer.h/2+Math.sin(a)*85;c.save();c.globalAlpha=1-recent/1.1;c.translate(x,y);c.rotate(a);c.fillStyle='#ff9279';c.beginPath();c.moveTo(11,0);c.lineTo(-7,-7);c.lineTo(-7,7);c.closePath();c.fill();c.restore();}
 if(p.health>0&&p.health<35&&renderer.settings.effects){const g=c.createRadialGradient(renderer.w/2,renderer.h/2,renderer.h*.35,renderer.w/2,renderer.h/2,renderer.w*.7);g.addColorStop(0,'transparent');g.addColorStop(1,'#e2593345');c.fillStyle=g;c.fillRect(0,0,renderer.w,renderer.h);}
}
