export const AIRLIFT_CAPACITY=32;
export const AIRLIFT_TIMES={APPROACH:24,LANDING:8,OPENING:2,UNLOADING:Infinity,CLOSING:2,LIFTOFF:4,DEPARTING:20};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export function helicopterPose(flight,time){
 if(!flight)return null;
 const age=Math.max(0,time-flight.phaseAt),t=smooth(age/(AIRLIFT_TIMES[flight.phase]||1)),p=flight.pad;
 let x=p.x,y=p.y,height=0,pitch=0,bank=0,door=0;
 if(flight.phase==='APPROACH'){
  const travel=1-t;x-=travel*5800;y+=travel*18000;height=12+travel*88;pitch=-.055*Math.sin(Math.PI*t);bank=.09*Math.sin(Math.PI*t);
 }else if(flight.phase==='HOLDING')height=12;
 else if(flight.phase==='LANDING')height=12*(1-t);
 else if(flight.phase==='OPENING')door=t;
 else if(flight.phase==='UNLOADING')door=1;
 else if(flight.phase==='CLOSING')door=1-t;
 else if(flight.phase==='LIFTOFF')height=12*t;
 else if(flight.phase==='DEPARTING'){x+=t*5800;y-=t*18000;height=12+t*100;pitch=.06*Math.sin(Math.PI*t);bank=-.10*Math.sin(Math.PI*t);}
 return {x,y,height,pitch,bank,yaw:0,door,rotor:time*27.5,downwash:Math.max(0,1-height/16)};
}
export function airframeSolidAt(f,x,y,height=1,margin=0){
 const a=f.airlift,flight=a?.flight;if(!flight)return false;
 const p=helicopterPose(flight,a.time);
 return height>=p.height+.18&&height<=p.height+4.5&&Math.abs(x-p.x)<72+margin&&y>p.y-255-margin&&y<p.y+207+margin;
}
export function landingZoneContains(p,x,y,margin=0){return Math.abs(x-p.x)<92+margin&&Math.abs(y-p.y)<270+margin;}
export function airframeBlocksGround(f,x,y,margin=0){
 const flight=f.airlift?.flight;if(!flight)return false;
 const p=helicopterPose(flight,f.airlift.time);
 return (flight.phase==='LANDING'||p.height<3&&!['APPROACH','HOLDING','DEPARTING'].includes(flight.phase))&&Math.abs(x-p.x)<72+margin&&y>p.y-255-margin&&y<p.y+207+margin;
}
export function airliftReserved(sim){return sim.airlift?.reserved||0;}
