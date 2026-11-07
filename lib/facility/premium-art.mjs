import {CORE,dist} from './map.mjs';
import {raycast,lineOfSight} from './navigation.mjs';
import {glow,FLOOR_PALETTES} from './world-art.mjs';
const rect=(c,x,y,w,h,fill,stroke)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.strokeRect(x+.5,y+.5,w-1,h-1);}};
const circle=(c,x,y,r,fill,stroke)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
function polygon(c,x,y,r,points,angle,fill,stroke){c.beginPath();for(let i=0;i<points;i++){const a=angle+i*Math.PI*2/points,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
export function drawCorePremium(c,sim,settings={}){
 const {x,y}=CORE,threat=sim.coreState!=='SECURE',col=threat?'#ff986f':'#79e9ee',time=settings.reducedMotion?0:sim.time,pulse=settings.reducedMotion?1:.92+Math.sin(time*2)*.08;
 c.save();c.translate(x,y);c.lineWidth=1.5;
 if(settings.effects)glow(c,0,-10,270,col+'26');
 c.fillStyle='#010b17aa';c.beginPath();c.ellipse(8,32,164,116,0,0,Math.PI*2);c.fill();
 for(let i=0;i<4;i++){c.save();c.rotate(i*Math.PI/2);c.strokeStyle='#101f2b';c.lineWidth=12;c.beginPath();c.moveTo(0,120);c.lineTo(0,178);c.lineTo(35,205);c.stroke();c.strokeStyle=col+'65';c.lineWidth=2;c.stroke();rect(c,21,197,28,14,'#324a58',col+'70');c.restore();}
 circle(c,0,0,164,'#112530','#607f92');circle(c,0,0,156,'#263e4a','#aac5d633');circle(c,0,0,143,'#102a38',col+'55');
 for(let i=0;i<32;i++){const a=i*Math.PI/16,start=a-.035,end=a+.055;c.beginPath();c.arc(0,0,151,start,end);c.strokeStyle=i<Math.ceil(sim.coreControl*32/100)?col:'#354954';c.lineWidth=5;c.stroke();}
 for(let i=0;i<12;i++){c.save();c.rotate(i*Math.PI/6);rect(c,105,-13,28,26,'#314b5d','#8eafba55');rect(c,109,-8,18,4,col+'90');rect(c,110,1,16,5,'#081d2a');c.restore();}
 const steel=c.createLinearGradient(-100,-95,100,105);steel.addColorStop(0,'#648697');steel.addColorStop(.5,'#314e64');steel.addColorStop(1,'#102638');
 polygon(c,0,18,106,6,Math.PI/6,'#071624','#293f51');polygon(c,0,0,106,6,Math.PI/6,steel,'#86b6c6');polygon(c,0,0,87,6,Math.PI/6,'#0c2637',col+'a0');
 for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;circle(c,Math.cos(a)*94,Math.sin(a)*94,4,'#172635','#bfd7df');}
 const power=c.createRadialGradient(0,-22,8,0,-22,72);power.addColorStop(0,'#d7ffff');power.addColorStop(.23,col+'d0');power.addColorStop(1,'#173f5955');circle(c,0,-16,65,power,col+'85');
 if(settings.effects){glow(c,0,-45,115,col+'32');c.save();c.globalAlpha=.65*pulse;c.fillStyle=col+'16';c.beginPath();c.moveTo(-53,8);c.lineTo(-35,-109);c.lineTo(35,-109);c.lineTo(53,8);c.closePath();c.fill();c.restore();}
 c.save();c.translate(0,-48);c.rotate(time*.12);polygon(c,0,0,49,4,Math.PI/4,col+'0d',col);polygon(c,0,0,35,4,Math.PI/4,col+'25','#e4ffff');c.restore();
 for(let i=0;i<3;i++){c.strokeStyle=col+(i===0?'bb':'55');c.lineWidth=i===0?2:1;c.beginPath();c.ellipse(0,-45-i*17,80-i*11,25-i*3,.12*Math.sin(time*.6+i),time*(i%2?-.4:.3),time*(i%2?-.4:.3)+Math.PI*1.65);c.stroke();}
 c.strokeStyle='#b0ffff';c.lineWidth=1.5;c.beginPath();for(let i=0;i<=24;i++){const px=-45+i*3.75,py=-17+Math.sin(i*.7+time*2)*6;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.stroke();
 rect(c,-93,180,186,47,'#061923ed',col+'60');c.textAlign='center';c.font='600 17px sans-serif';c.fillStyle='#e3faff';c.fillText('THE CORE',0,199);c.font='12px monospace';c.fillStyle=col;c.fillText((threat?'DÉFENSE ACTIVE':'RÉACTEUR SÉCURISÉ')+' · '+Math.round(sim.coreControl)+' %',0,216);c.restore();
}
export function drawPremiumDoor(c,d,time,settings={}){
 const col=d.lockMode==='all'?'#edbf76':d.lockMode==='hostile'?(d.lockTeam==='enemy'?'#f58d76':'#86d4e2'):'#a7bec6',vertical=d.w<d.h;
 c.save();rect(c,d.x+3,d.y+6,d.w,d.h,'#000a');rect(c,d.x,d.y,d.w,d.h,'#111f2d','#8ba8b744');
 if(d.state==='DESTROYED'){for(let i=0;i<6;i++){c.fillStyle=i%2?'#66574b':'#182531';c.beginPath();c.moveTo(d.x+4+i*d.w/7,d.y+5);c.lineTo(d.x+10+i*d.w/7,d.y+d.h*.6);c.lineTo(d.x+3+i*d.w/7,d.y+d.h-4);c.fill();}c.restore();return;}
 c.beginPath();c.rect(d.x+2,d.y+2,d.w-4,d.h-4);c.clip();
 const panel=(x,y,w,h)=>{const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#89a6b2');g.addColorStop(.35,'#48687d');g.addColorStop(1,'#1b354a');rect(c,x,y,w,h,g,'#b9d0dc77');rect(c,x+3,y+3,w-6,h-6,'#193a4b50');if(vertical){rect(c,x+5,y+h/2-2,w-10,4,col+'90');}else rect(c,x+w/2-2,y+5,4,h-10,col+'90');};
 if(vertical){panel(d.x+5,d.y-d.open*d.h/2,d.w-10,d.h/2);panel(d.x+5,d.y+d.h/2+d.open*d.h/2,d.w-10,d.h/2);}else{panel(d.x-d.open*d.w/2,d.y+5,d.w/2,d.h-10);panel(d.x+d.w/2+d.open*d.w/2,d.y+5,d.w/2,d.h-10);}c.restore();
 c.save();rect(c,d.x+2,d.y+2,vertical?3:d.w-4,vertical?d.h-4:3,'#b0cedc66');circle(c,d.x+5,d.y+5,2.5,col);circle(c,d.x+d.w-5,d.y+d.h-5,2.5,col);
 if(d.open<.5){const x=d.x+d.w/2,y=d.y+d.h/2;rect(c,x-5,y-3,10,8,'#0b2130',col);c.strokeStyle=col;c.lineWidth=1.3;c.beginPath();c.arc(x,y-3,3,Math.PI,0);c.stroke();}
 if(d.forcedOpen&&settings.effects&&!settings.reducedMotion)glow(c,d.x+d.w/2,d.y+d.h/2,35,col+'12');c.restore();
}
export function drawRoomIdentity(c,f,r){
 const owner=f.zones[r.index],col=owner.contested?'#ecc283':owner.owner==='enemy'?'#eb9a83':FLOOR_PALETTES[f.id+2].accent,x=r.x+43,y=r.y+24,w=r.w-86;
 c.save();rect(c,x,y,w,31,'#0a1c2799',col+'33');rect(c,x,y,3,31,col+'aa');c.textAlign='left';c.font='600 12px sans-serif';c.fillStyle='#d4e5ec';const title=String(r.index+1).padStart(2,'0')+' / '+r.name;const limit=w-105;let name=title;while(name.length>8&&c.measureText(name).width>limit)name=name.slice(0,-1);c.fillText(name+(name===title?'':'…'),x+13,y+20);c.textAlign='right';c.font='10px monospace';c.fillStyle=col;c.fillText(owner.contested?'CONTESTÉ':owner.owner==='enemy'?'HOSTILE':'ALLIÉ',x+w-10,y+20);c.restore();
}
function clippedLight(c,f,x,y,r,col,steps){
 c.save();c.beginPath();for(let i=0;i<=steps;i++){const a=i*Math.PI*2/steps,hit=raycast(f,x,y,a,r),d=Math.max(1,hit.d-(hit.wall?5:0)),px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;if(i)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.clip();glow(c,x,y,r,col);c.restore();
}
export function drawMaterialLighting(renderer,c,f,visible){
 if(!renderer.settings.effects)return;
 const balanced=renderer.settings.graphicsQuality==='balanced';let count=0;
 for(const r of f.rooms){const x=r.x+r.w*.5,y=r.y+72;if(!visible(x-180,y-180,360,360)||count++>(balanced?3:7))continue;const col=r.owner==='enemy'?'#f39773':FLOOR_PALETTES[f.id+2].light;clippedLight(c,f,x,y,balanced?140:195,col+'17',balanced?12:24);}
}
export function drawRoleEffects(c,sim,u,settings){
 if(!settings.effects)return;
 if(u.role==='medic'&&u.healTarget){const target=sim.units.find(v=>v.id===u.healTarget&&v.team===u.team&&v.health>0&&!v.transit&&v.floor===u.floor);if(target&&dist(u,target)<=120&&lineOfSight(sim.floor(u.floor),u,target)){c.save();c.strokeStyle='#a0edc469';c.lineWidth=1.5;c.setLineDash([3,5]);c.beginPath();c.moveTo(u.x,u.y);c.lineTo(target.x,target.y);c.stroke();c.setLineDash([]);circle(c,target.x,target.y,18,null,'#adf4cb55');c.restore();}}
 if(u.reload>0&&(u.role==='player'||u.role==='officer')){c.save();c.strokeStyle='#e4c384';c.lineWidth=2;c.beginPath();c.arc(u.x,u.y,24,-Math.PI/2,-Math.PI/2+Math.PI*1.7);c.stroke();c.restore();}
}
