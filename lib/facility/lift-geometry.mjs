import {STAIR_RISE} from './stairs.mjs';
export const LIFT_RISE=STAIR_RISE;
export const LIFT_DOOR_Y=48;
export const LIFT_SEATS=[[-18,-24],[18,-24],[-18,0],[18,0],[-18,24],[18,24]];
export const LIFT_BUTTON_X=[18,32];
export const LIFT_BUTTON_HEIGHT=[1.55,1.30,1.05,.80];
export function insideLift(l,x,y){return Math.abs(x-l.x)<40&&y>l.y-40&&y<l.y+44;}
export function liftPathBlocked(l,x,y){return Math.abs(x-l.x)<96&&y>l.y-72&&y<l.y+68;}
export function liftDocked(l,floor){return !l.moving&&Math.abs((l.position??l.currentFloor)-floor)<.001;}
export function liftDoorFraction(l,floor){return liftDocked(l,floor)?(l.doorOpen??(l.doorState==='OPEN'?1:0)):0;}
export function liftSolidAt(f,x,y,height=1){
 if(height<0||height>4.6)return false;
 for(const l of f.elevators||[]){
  const dx=Math.abs(x-l.x),dy=y-l.y;
  if(dx>80||dy<-55||dy>53)continue;
  if(dx<55&&(dx>=45||dy<=-45))return true;
  if(liftDocked(l,f.id)&&dx<45&&dy>-45&&dy<44&&(dx>=40||dy<=-40))return true;
  if(dy>=44&&(height>3.05||dx>42*liftDoorFraction(l,f.id)))return true;
 }
 return false;
}
export function liftSupports(f,x,y){
 return !(f.elevators||[]).some(l=>insideLift(l,x,y)&&!liftDocked(l,f.id));
}
export function liftPassengerCanMove(u,l,x,y){
 const r=u.radius||11,dx=Math.abs(x-l.x),dy=y-l.y;
 if(l.moving)return dx<=40-r&&dy>=-40+r&&dy<=42-r;
 return true;
}
export function liftOffset(l,floor){return ((l.position??l.currentFloor)-floor)*LIFT_RISE;}
export function liftDisplay(l){
 return {floor:Math.round(l.position??l.currentFloor),direction:l.moving?Math.sign(l.targetFloor-l.currentFloor):0};
}
export function liftPanelHit(l,p,pitch){
 if(!insideLift(l,p.x,p.y)||!Number.isFinite(pitch)||Math.sin(p.angle)>=-.01)return null;
 const t=(l.y-40-p.y)/Math.sin(p.angle);
 if(t<=0||t>130)return null;
 const x=p.x+Math.cos(p.angle)*t-l.x,h=1.54+Math.tan(pitch)*t/32;
 const col=LIFT_BUTTON_X.findIndex(b=>Math.abs(x-b)<5);
 const row=LIFT_BUTTON_HEIGHT.findIndex(b=>Math.abs(h-b)<.10);
 const target=l.min+row*2+col;
 return col>=0&&row>=0&&target<=l.max?target:null;
}
