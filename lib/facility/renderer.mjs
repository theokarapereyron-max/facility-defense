import {drawCorePremium,drawPremiumDoor,drawRoomIdentity,drawMaterialLighting,drawRoleEffects} from './premium-art.mjs';
import {healthBarEnabled} from './health-display.mjs';
import {drawHelicopter2D} from './helicopter2d.mjs';
import {liftDoorFraction,liftDisplay} from './lift-geometry.mjs';
import {drawArchitecture,drawSoldierBody,drawAtmosphere,drawBattleEffect,drawField,drawCombatFeedback,FLOOR_PALETTES} from './world-art.mjs';
import {mapContact} from './contacts.mjs';
import {canUseLift} from './lift-access.mjs';
import {drawFurniture} from './furniture-renderer.mjs';
import {nearbyFurniture} from './inventory.mjs';
import {enemyFrozen} from './special-items.mjs';
import {COLS,ROWS,WIDTH,HEIGHT,CORE,FLOOR_INFO,ROOF_FLOOR,dist} from "./map.mjs";
import {rankOf,canCommand} from "./ranks.mjs";
import {raycast} from "./navigation.mjs";
const color={ally:"#6ebbd1",enemy:"#ee735f",player:"#dafaff"};
function rect(c,x,y,w,h,a,b){c.fillStyle=a;c.fillRect(x,y,w,h);if(b){c.strokeStyle=b;c.strokeRect(x+.5,y+.5,w-1,h-1);}}
function circle(c,x,y,r,a,b){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(a){c.fillStyle=a;c.fill();}if(b){c.strokeStyle=b;c.stroke();}}
function label(c,text,x,y,size=14,col="#8d9c90",align="left"){c.fillStyle=col;c.font="600 "+size+"px Arial,sans-serif";c.textAlign=align;c.fillText(text,x,y);}
export class Renderer{
 constructor(canvas,sim,options={}){this.canvas=canvas;this.ctx=canvas.getContext("2d",{alpha:!!options.alpha});this.sim=sim;this.camera={x:sim.player.x,y:sim.player.y,zoom:.85,floor:0};this.zoom=.85;this.mapCache=new Map();this.surfaceCache=new Map();this.settings={effects:true};this.debug=false;this.selected=null;this.waypoint=null;this.mouse={x:0,y:0};this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);this.dpr=Math.min(window.devicePixelRatio||1,this.settings.graphicsQuality==='balanced'?1.5:2);this.canvas.width=this.w*this.dpr;this.canvas.height=this.h*this.dpr;}
 screenToWorld(x,y){return {x:(x-this.w/2)/this.camera.zoom+this.camera.x,y:(y-this.h/2)/this.camera.zoom+this.camera.y};}
 render(dt){
  const s=this.sim,p=s.player,c=this.ctx,a=this.camera;this.nearFurniture=nearbyFurniture(s);
  if(a.floor!==p.floor){a.x=p.x;a.y=p.y;a.floor=p.floor;}
  const t=this.settings.reducedMotion?1:1-Math.exp(-dt*6),anticipation=s.status==="running"?55:0;a.x+=(p.x+Math.cos(p.angle)*anticipation-a.x)*t;a.y+=(p.y+Math.sin(p.angle)*anticipation-a.y)*t;a.zoom+=(this.zoom-a.zoom)*t;
  const z=a.zoom,left=a.x-this.w/2/z,top=a.y-this.h/2/z,right=left+this.w/z,bottom=top+this.h/z,f=s.floor(p.floor),visible=(x,y,w=0,h=0)=>x+w>left-70&&x<right+70&&y+h>top-70&&y<bottom+70;
  c.setTransform(this.dpr,0,0,this.dpr,0,0);rect(c,0,0,this.w,this.h,"#0b1110");c.save();c.translate(this.w/2,this.h/2);c.scale(z,z);c.translate(-a.x,-a.y);
  this.drawFloor(c,f,left,top,right,bottom,visible);drawMaterialLighting(this,c,f,visible);
  drawAtmosphere(c,s,f,visible,this.settings);if(p.floor===-2)drawCorePremium(c,s,this.settings);
  for(const con of f.connectors)if(visible(con.x-65,con.y-65,130,130))this.drawConnector(c,con);
  for(const sp of f.supplies)if(visible(sp.x,sp.y,100,100)){rect(c,sp.x-24,sp.y-24,48,48,"#203b33","#638c67");rect(c,sp.x-12,sp.y-3,24,6,"#98c590");rect(c,sp.x-3,sp.y-12,6,24,"#98c590");label(c,f.rooms[sp.roomIndex].owner==='enemy'?"RAVITAILLEMENT ENNEMI":"RAVITAILLEMENT ALLIÉ",sp.x,sp.y+48,12,f.rooms[sp.roomIndex].owner==='enemy'?"#f18c76":"#8bae91","center");}
  if(f.shop&&visible(f.shop.x-70,f.shop.y-45,140,90)){const shop=f.shop;circle(c,shop.x,shop.y,26,null,'#e6c66f88');label(c,'E · BOUTIQUE',shop.x,shop.y+5,13,'#e6ce93','center');}
  for(const post of f.guardPosts||[])if(visible(post.x,post.y,80,80)){circle(c,post.x,post.y,27,null,'#83c2c075');label(c,'GARDE',post.x,post.y+43,12,'#8eb9b5','center');}
  if(s.status==='running'&&p.health>0){c.save();c.lineWidth=1.5/z;c.setLineDash([6/z,9/z]);circle(c,p.x,p.y,s.commandRadius,null,s.selectedIDs.size?'#7d948540':'#b6dba866');c.setLineDash([]);label(c,'RAYON D’ORDRE',p.x,p.y-s.commandRadius-10,12/z,'#bad2ac88','center');c.restore();}
  if(s.landing&&p.floor===ROOF_FLOOR&&s.time-s.landing.time<8){const l=s.landing,v=1-(s.time-l.time)/8;circle(c,l.x,l.y,160+(1-v)*120,null,l.team==='ally'?'#92d8b777':'#ef917677');label(c,l.team==='ally'?'DÉBARQUEMENT ALLIÉ':'INSERTION HOSTILE',l.x,l.y-180,16,'#e8d9af','center');}
  for(const u of s.casualties)if(u.floor===p.floor&&visible(u.x,u.y)){c.save();c.translate(u.x,u.y);c.rotate(u.angle);c.globalAlpha=.27;rect(c,-14,-7,28,14,u.team==="ally"?"#83adad":"#b58067");c.restore();}
  for(const u of s.units.filter(u=>u.floor===p.floor&&u.health>0&&(!u.transit||u.transit===p.transit)&&visible(u.x,u.y)).sort((a,b)=>a.y-b.y))this.drawUnit(c,u);
  if(p.floor===ROOF_FLOOR)drawHelicopter2D(c,s.airlift,s.time,this.settings.reducedMotion);
  for(const field of s.fields||[])if(field.floor===p.floor&&visible(field.x-field.radius,field.y-field.radius,field.radius*2,field.radius*2)){drawField(c,field,this.settings.reducedMotion?0:s.time);}
  for(const g of s.projectiles||[])if(g.floor===p.floor&&visible(g.x,g.y)){const arc=Math.sin(Math.PI*Math.min(1,g.age/.65))*35;circle(c,g.x,g.y,7,'#0008');circle(c,g.x,g.y-arc,6,g.item==='flash'?'#e9e8b5':'#d79e67','#fff1c3');if(g.age>.65){c.setLineDash([5,6]);circle(c,g.x,g.y,(g.item==='flash'?220:180),null,'#e5ac6555');c.setLineDash([]);}label(c,(g.fuse-g.age).toFixed(1),g.x,g.y-arc-15,12,'#f3dfb1','center');}
  if((s.scans[p.floor]||0)>s.time){c.setLineDash([6,14]);circle(c,p.x,p.y,100+(s.time%2)*180,null,'#75dab955');c.setLineDash([]);}
  if(this.settings.effects){
   c.lineCap="round";for(const tr of s.traces)if(tr.floor===p.floor){c.globalAlpha=tr.life/tr.max;c.strokeStyle=tr.team==="ally"?"#fae8a4":"#ffa982";c.lineWidth=tr.player?2.4:1.5;c.beginPath();c.moveTo(tr.x,tr.y);c.lineTo(tr.ex,tr.ey);c.stroke();circle(c,tr.x,tr.y,5,"#fff0b3");}c.globalAlpha=1;
   for(const e of s.effects)if(e.floor===p.floor&&visible(e.x,e.y)){const v=e.life/e.max;c.globalAlpha=v;if(e.type==="xp"){label(c,"+"+e.amount+" XP",e.x,e.y-25-(1-v)*48,17,"#f4d58c","center");}else{drawBattleEffect(c,e);}}c.globalAlpha=1;
  }
  if(this.waypoint){
   const w=this.waypoint,local=w.floor===p.floor?w:f.connectors.filter(a=>a.type==='stairs'&&w.floor>=a.min&&w.floor<=a.max).sort((a,b)=>dist(p,a)-dist(p,b))[0];
   if(local){if(!this.routeAt||s.time-this.routeAt>.8||this.routeFloor!==p.floor||this.routeTarget!==w){this.routeAt=s.time;this.routeFloor=p.floor;this.routeTarget=w;this.route=s.pathfinding.path(f,p,local);}
    c.save();c.strokeStyle='#ead38d99';c.lineWidth=1.6/z;c.setLineDash([5/z,7/z]);c.beginPath();c.moveTo(p.x,p.y);for(const n of this.route||[])c.lineTo(n.x,n.y);c.stroke();c.setLineDash([]);circle(c,local.x,local.y,22+Math.sin(s.time*3)*2,null,'#f1dba0');label(c,w.floor===p.floor?'REPÈRE · '+Math.round(dist(p,w)/32)+' m':'ESCALIER → '+FLOOR_INFO[w.floor+2].short,local.x,local.y-37,12/z,'#f0dba0','center');c.restore();}
  }
  if(this.debug){c.lineWidth=.6;c.strokeStyle="#78956d45";for(let x=Math.floor(left/32)*32;x<right;x+=32){c.beginPath();c.moveTo(x,top);c.lineTo(x,bottom);c.stroke();}for(let y=Math.floor(top/32)*32;y<bottom;y+=32){c.beginPath();c.moveTo(left,y);c.lineTo(right,y);c.stroke();}for(const cp of f.covers)if(visible(cp.x,cp.y))circle(c,cp.x,cp.y,7,cp.occupant?"#edbd64":"#9fb971");circle(c,f.entry.x,f.entry.y,35,null,"#f17c60");for(const u of s.units)if(u.floor===f.id&&u.health>0){if(u.role==="officer")circle(c,u.x,u.y,700,null,"#e4bf4130");if(u.path.length){c.strokeStyle=u.team==="ally"?"#69cebe77":"#ee916577";c.beginPath();c.moveTo(u.x,u.y);for(const n of u.path)c.lineTo(n.x,n.y);c.stroke();}}}
  if(s.status==="running"&&p.health>0&&!p.transit){
   const aim=raycast(f,p.x,p.y,p.angle,230);c.strokeStyle="#cbecda65";c.lineWidth=1;c.setLineDash([4,9]);c.beginPath();c.moveTo(p.x+Math.cos(p.angle)*28,p.y+Math.sin(p.angle)*28);c.lineTo(aim.x,aim.y);c.stroke();c.setLineDash([]);circle(c,aim.x,aim.y,5,null,"#dcebd2bb");
  }
  if(s.alert>1&&this.settings.effects)for(const con of f.connectors)if(visible(con.x,con.y,100,100)){const g=c.createRadialGradient(con.x-65,con.y,2,con.x-65,con.y,125);g.addColorStop(0,"rgba(255,88,53,"+(.1+.05*Math.sin(s.time*4))+")");g.addColorStop(1,"transparent");c.fillStyle=g;c.fillRect(con.x-190,con.y-125,250,250);}
  c.restore();const g=c.createRadialGradient(this.w*.5,this.h*.5,this.h*.3,this.w*.5,this.h*.5,this.w*.75);g.addColorStop(0,"transparent");g.addColorStop(1,"#0209167a");c.fillStyle=g;c.fillRect(0,0,this.w,this.h);
  drawCombatFeedback(this,c);
  if(p.stunnedUntil>s.time){c.globalAlpha=Math.min(.28,(p.stunnedUntil-s.time)*.2);rect(c,0,0,this.w,this.h,"#fff7d8");c.globalAlpha=1;label(c,"DÉSORIENTÉ",this.w/2,this.h*.42,17,"#e5dbb0","center");}
  if(p.health>0&&p.health<35){c.strokeStyle="#a93c3470";c.lineWidth=12;c.strokeRect(0,0,this.w,this.h);}

  if(this.waypoint&&this.waypoint.floor!==p.floor)label(c,"REPÈRE AU NIVEAU "+FLOOR_INFO[this.waypoint.floor+2].short,this.w/2,this.h-110,13,"#ddbf69","center");
 }
 drawFloor(c,f,left,top,right,bottom,visible){
  drawArchitecture(this,c,f,left,top,right,bottom,visible);
  for(const r of f.rooms)if(visible(r.x,r.y,r.w,r.h)){
   drawRoomIdentity(c,f,r);const owner=f.zones[r.index];if(r.captureProgress>0){rect(c,r.x+45,r.y+103,150,5,'#16211e');rect(c,r.x+45,r.y+103,150*r.captureProgress,5,r.capturingTeam==='enemy'?'#f29373':'#79cbda');label(c,(r.contested?'CONTESTÉ · ':r.capturingTeam==='enemy'?'CAPTURE ENNEMIE ':'REPRISE ALLIÉE ')+Math.round(r.captureProgress*100)+' %',r.x+45,r.y+129,12,'#e7cea1');}rect(c,r.x+32,r.y+32,r.w-64,r.h-64,owner.owner==='enemy'?'#ee735f0d':'#6ebbd104');

   if(r.type==='shop'){rect(c,r.x+32,r.y+32,r.w-64,r.h-64,'#77603016');c.strokeStyle='#d0b76a55';c.lineWidth=3;c.strokeRect(r.x+46,r.y+46,r.w-92,r.h-92);}
   if(["hall","helipad"].includes(r.type)){c.strokeStyle="#7582644a";c.lineWidth=2;c.strokeRect(r.x+60,r.y+65,r.w-120,r.h-130);if(r.type==="helipad"){circle(c,r.x+r.w/2,r.y+r.h/2,190,null,"#b5be9260");label(c,"H",r.x+r.w/2,r.y+r.h/2+60,170,"#bdc5a244","center");}}
   label(c,r.name,r.x+r.w/2,r.y+r.h/2,Math.min(24,r.w/Math.max(12,r.name.length)*1.35),"#b2c8cc44","center");
  }
  for(const p of f.props)if(visible(p.x,p.y,p.w,p.h))this.drawProp(c,p);
  for(const d of f.doors)if(visible(d.x,d.y,d.w,d.h))drawPremiumDoor(c,d,this.sim.time,this.settings);
 }
 drawProp(c,p){drawFurniture(c,p,p.id===this.nearFurniture?.id,this.camera.zoom);}
 drawConnector(c,con){const s=this.sim,x=con.x,y=con.y;rect(c,x-53,y-44,106,88,"#182322","#678e8555");if(con.type==="stairs"){
   rect(c,x-64,y-144,128,256,"#111f24","#79a7a9");
   rect(c,x-64,y-144,128,32,"#607d83");
   for(let i=0;i<14;i++){
    rect(c,x-59,y-112+i*16,54,3,"#90aca9");
    rect(c,x+5,y-112+i*16,54,3,"#456e78");
   }
   const floor=s.player.floor;
   if(floor>con.min)label(c,"↓ "+FLOOR_INFO[floor+1].short,x+32,y+140,13,"#8de5ee","center");
   if(floor<con.max)label(c,"↑ "+FLOOR_INFO[floor+3].short,x-32,y+140,13,"#ffe2a1","center");
   for(const side of [-1,0,1])rect(c,x+side*62-2,y-110,4,222,"#c8ae70");
  }
  else{
   const l=s.elevators.find(l=>l.id===con.id),off=!canUseLift(s,l,s.player.floor);
   const docked=Math.abs(l.position-s.player.floor)<.001&&!l.moving,open=liftDoorFraction(l,s.player.floor),display=liftDisplay(l);
   rect(c,x-43,y-40,86,80,"#101715","#6aa59c");
   if(docked||s.player.transit===l.id)rect(c,x-42,y-39,84,78,"#386b65","#99bab1");
   for(const side of [-1,1])rect(c,x+side*(21+42*open)-21,y+44,42,7,"#b6a47a");
   rect(c,x+49,y-35,6,70,"#111b1a","#49625c");
   const level=((l.position??l.currentFloor)-l.min)/(l.max-l.min);
   rect(c,x+48,y+30-65*level,8,6,"#e5cf8d");
   rect(c,x-42,y+45,84,5,docked&&l.doorState==="OPEN"?"#91ead8":"#d5ac67");
   label(c,l.id+" · "+(docked?"PALIER":"GAINE"),x,y-51,13,"#e1cf9b","center");
   label(c,off?"OFF":(display.direction>0?"↑ ":display.direction<0?"↓ ":"↑↓ ")+FLOOR_INFO[display.floor+2].short,x,y+5,14,off?"#e29871":"#b7f0df","center");
  }
  if(con.type==="elevator")label(c,con.label,x,y+65,12,"#94b6a9","center");
 }
 drawUnit(c,u){
  const player=u.role==="player",col=player?color.player:color[u.team],r=u.role==="heavy"?13:10;drawSoldierBody(c,u,this.sim,this.settings);drawRoleEffects(c,this.sim,u,this.settings);
  if(u.stunnedUntil>this.sim.time){circle(c,u.x,u.y,24,null,"#e8d896");label(c,"✦",u.x,u.y-25,16,"#f7e6a6","center");}
  if(u.role==="officer")label(c,"★",u.x,u.y-22,16,u.team==="ally"?"#e8c779":"#edb36e","center");
  if(u.role==="medic"){rect(c,u.x-4,u.y-22,8,3,"#a2dfb4");rect(c,u.x-1.5,u.y-24.5,3,8,"#a2dfb4");}
  if(healthBarEnabled(this.settings,'2d',player?'player':u.team)){rect(c,u.x-13,u.y+20,26,3,"#182522");rect(c,u.x-13,u.y+20,26*u.health/u.maxHealth,3,col);}if(player||u.role==='officer'||this.debug||this.sim.selectedIDs.has(u.id)||this.selected===u.id){const rank=rankOf(u),rz=Math.max(.65,this.camera.zoom);c.font='600 '+12/rz+'px Arial';const tag=(player?'VOUS · ':'')+rank.short+' ('+rank.number+')',tw=c.measureText(tag).width;rect(c,u.x-tw/2-4,u.y-43/rz,tw+8,17/rz,'#0b1714cc');label(c,tag,u.x,u.y-30/rz,12/rz,player?'#fff0bd':u.team==='ally'?'#bde2e5':'#f3b8a8','center');
}
  if(enemyFrozen(this.sim,u)){circle(c,u.x,u.y,22,'#81d1f222','#a0e1f0');label(c,'STASE',u.x,u.y+38,10,'#b3eaff','center');}
  if(this.sim.selectedIDs.has(u.id)){c.lineWidth=2;circle(c,u.x,u.y,28,null,canCommand(this.sim.player,u)?'#e9cd7b':'#eb8577');c.lineWidth=1;}
  if(u.speechUntil>this.sim.time){c.font="600 12px Arial";const w=c.measureText(u.speech).width+20;rect(c,u.x-w/2,u.y-63,w,26,"#101c18e8","#98896070");label(c,u.speech,u.x,u.y-45,12,"#ead18f","center");}if(this.debug)label(c,u.id+" "+u.state,u.x+18,u.y,12,"#f0e8b5");if(this.selected===u.id)circle(c,u.x,u.y,30,null,"#fff0b2");
 }
 baseMap(f){if(this.mapCache.has(f.id))return this.mapCache.get(f.id);const canvas=document.createElement("canvas");canvas.width=COLS*5;canvas.height=ROWS*5;const c=canvas.getContext("2d");rect(c,0,0,canvas.width,canvas.height,"#0c1925");for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const v=f.grid[y*COLS+x];if(v!==1)rect(c,x*5,y*5,5,5,v===3?"#718694":"#334b5a");}this.mapCache.set(f.id,canvas);return canvas;}
 drawMap(canvas,floor,detailed=false){
  if(!canvas)return;const c=canvas.getContext("2d"),w=canvas.width,h=canvas.height,f=this.sim.floor(floor),k=Math.min(w/WIDTH,h/HEIGHT);rect(c,0,0,w,h,"#0c1925");c.save();c.translate((w-WIDTH*k)/2,(h-HEIGHT*k)/2);c.drawImage(this.baseMap(f),0,0,WIDTH*k,HEIGHT*k);
  for(const r of f.rooms){const z=f.zones[r.index];rect(c,(r.x+16)*k,(r.y+16)*k,(r.w-32)*k,(r.h-32)*k,z.owner==="enemy"?"#ed785536":"#6ebbd112",z.contested?"#e2bd6e":z.owner==="enemy"?"#eb806199":"#72b4c433");}
  if(detailed){for(const r of f.rooms){c.font='600 10px Arial';const max=(r.w-40)*k;let text=r.name;while(text.length>3&&c.measureText(text+'…').width>max)text=text.slice(0,-1);label(c,String(r.index+1).padStart(2,'0'),(r.x+r.w/2)*k,(r.y+r.h/2)*k-8,9,'#91b3c4','center');label(c,text+(text===r.name?'':'…'),(r.x+r.w/2)*k,(r.y+r.h/2)*k+7,10,'#d1e5ea','center');}for(const d of f.doors)if(d.lockMode!=="none"||d.type!=="standard")rect(c,d.x*k,d.y*k,Math.max(4,d.w*k),Math.max(4,d.h*k),d.state==="DESTROYED"?"#ef8870":"#c2a45f");}
  for(const u of this.sim.units){const contact=mapContact(this.sim,u);if(!contact||contact.floor!==floor)continue;const p=u.role==="player";circle(c,contact.x*k,contact.y*k,p?4.5:detailed?3.1:1.8,p?"#ecfff2":color[u.team]);if(p){circle(c,u.x*k,u.y*k,8.5,null,"#daffef90");c.strokeStyle="#c4f2fa";c.beginPath();c.moveTo(u.x*k,u.y*k);c.lineTo(u.x*k+Math.cos(u.angle)*14,u.y*k+Math.sin(u.angle)*14);c.stroke();}if(detailed&&u.role==="officer")label(c,"★",contact.x*k,contact.y*k-5,11,"#e1c374","center");}
  for(const con of f.connectors){rect(c,con.x*k-4,con.y*k-4,8,8,con.type==="stairs"?"#7cba9e":"#bbad70");if(detailed)label(c,con.id,con.x*k,con.y*k+18,12,"#bed7c1","center");}
  if(f.shop){rect(c,f.shop.x*k-5,f.shop.y*k-5,10,10,"#e7c472");if(detailed)label(c,"BOUTIQUE",f.shop.x*k,f.shop.y*k-10,11,"#f0d490","center");}for(const post of f.guardPosts||[])circle(c,post.x*k,post.y*k,5,null,"#8dcac7");
  circle(c,f.entry.x*k,f.entry.y*k,6,null,"#de9676");for(const sp of f.supplies)circle(c,sp.x*k,sp.y*k,4,f.rooms[sp.roomIndex].owner==='enemy'?"#f18c76":"#91cc86");if(floor===-2){circle(c,CORE.x*k,CORE.y*k,200*k,"#52d6b820","#81ebbf");circle(c,CORE.x*k,CORE.y*k,5,"#b3f4d7");}
  for(const bag of f.props.filter(p=>p.dropped&&p.items.some(Boolean))){rect(c,bag.x*k-3,bag.y*k-3,6,6,"#e4c68a");if(detailed)label(c,"SAC",bag.x*k,bag.y*k-8,11,"#e4c68a","center");}
  if(this.waypoint?.floor===floor)circle(c,this.waypoint.x*k,this.waypoint.y*k,8,null,"#e4c877");
  if(floor===this.sim.player.floor&&!detailed){const a=this.camera;c.strokeStyle="#c8d5b755";c.lineWidth=1;if(this.isFPS){
   const p=this.sim.player,cam=this.fpsCamera,halfAngle=Math.atan(Math.tan(cam.fov*Math.PI/360)*cam.aspect);
   c.beginPath();c.moveTo(p.x*k,p.y*k);
   for(const side of [-1,1])c.lineTo((p.x+300*Math.cos(p.angle+side*halfAngle))*k,(p.y+300*Math.sin(p.angle+side*halfAngle))*k);
   c.closePath();c.stroke();
  }else if(this.is3D){c.beginPath();for(const [i,corner] of [[0,0],[this.w,0],[this.w,this.h],[0,this.h]].entries()){const p=this.screenToWorld(corner[0],corner[1]);if(i)c.lineTo(p.x*k,p.y*k);else c.moveTo(p.x*k,p.y*k);}c.closePath();c.stroke();}else c.strokeRect((a.x-this.w/2/a.zoom)*k,(a.y-this.h/2/a.zoom)*k,this.w/a.zoom*k,this.h/a.zoom*k);}c.restore();
 }
 destroy(){this.observer.disconnect();this.surfaceCache.clear();}
}
