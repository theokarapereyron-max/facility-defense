import {helicopterPose} from './airlift-geometry.mjs';
export function drawHelicopter2D(c,air,time,reducedMotion=false){
 const p=helicopterPose(air?.flight,time);if(!p)return;
 c.save();c.translate(p.x,p.y);c.fillStyle='#06121944';c.beginPath();c.ellipse(0,0,235,360,0,0,Math.PI*2);c.fill();
 c.translate(-p.height*.5,-p.height*2);c.fillStyle='#485342';c.strokeStyle='#a2ae8c';c.lineWidth=3;
 c.beginPath();c.roundRect(-65,-220,130,435,50);c.fill();c.stroke();
 c.fillStyle='#254952';c.fillRect(-52,-196,104,50);c.fillStyle='#6b765b';c.fillRect(-49,-130,98,284);
 c.fillStyle='#141f25';for(const side of [-1,1])for(const z of [-155,145])c.fillRect(side*70-9,z,18,40);
 c.fillStyle='#7c876a';c.fillRect(-47,207,94,p.door*88+5);
 for(const [i,z] of [[0,-161],[1,169]]){
  const angle=(reducedMotion?time*3:p.rotor)*(i?-1:1);c.save();c.translate(0,z);c.rotate(angle);
  c.strokeStyle='#273a34bb';c.lineWidth=11;
  for(let blade=0;blade<3;blade++){c.rotate(Math.PI*2/3);c.beginPath();c.moveTo(0,0);c.lineTo(0,285);c.stroke();}
  c.fillStyle='#a6ad96';c.beginPath();c.arc(0,0,13,0,Math.PI*2);c.fill();c.restore();
 }
 c.restore();
}
