import * as THREE from 'three';
import {helicopterPose} from './airlift-geometry.mjs';

// All geometry is local and shares the game's instanced materials. No late model download.
export function drawHelicopter3D(b,air,time,{reducedMotion=false}={}){
 const flight=air?.flight;if(!flight)return;
 const p=helicopterPose(flight,time),previous=b.root;
 const frame=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(p.pitch,p.yaw,p.bank));frame.setPosition(p.x/32,p.height,p.y/32);b.root=frame;
 const olive='#4d5545',light='#68715b',dark='#17232a',seam='#303d36',trim='#8b977b',glass='#274956';
 // Twin-pylon heavy transport: cabin, belly, nose and raised aft rotor tower.
 b.sphere(0,2.85,0,4.45,3.55,14.2,olive);
 b.box(0,1.48,.1,3.65,.48,12.7,seam);
 b.sphere(0,2.45,-6.05,3.9,2.65,3.7,olive);
 b.box(0,4.04,.25,3.35,.25,10.7,light);
 for(const side of [-1,1]){
  b.box(side*2.02,2.55,.1,.20,1.65,10.9,olive,0,0,side*.08);
  b.box(side*2.12,1.8,.0,.12,.12,11.3,trim);
  b.box(side*1.60,1.22,1.65,.83,.57,8.8,light);
  // Armoured cockpit glazing and thick separated window frames.
  b.box(side*.87,3.05,-7.25,1.50,1.15,.10,dark,-.18,side*.18);
  b.box(side*.87,3.08,-7.32,1.31,.92,.025,glass,-.18,side*.18);
  b.box(side*1.80,3.05,-5.92,.07,1.12,1.63,dark,0,side*.21);
  b.box(side*1.85,3.07,-5.92,.03,.90,1.41,glass,0,side*.21);
  b.box(side*.88,3.43,-7.35,.96,.034,.025,'#759a9d',0,side*.18,-side*.09);
  for(let i=0;i<5;i++){
   const z=-3.8+i*1.8;
   b.box(side*2.15,3.04,z,.12,.71,1.12,dark);
   b.box(side*2.22,3.05,z,.025,.56,.95,glass);
   b.box(side*2.24,3.23,z-.06,.026,.028,.72,'#77999a');
  }
  // Engine nacelles, intake lips and dark exhaust interiors.
  b.cylinder(side*1.84,4.12,4.22,1.08,3.2,1.08,light,Math.PI/2);
  b.cylinder(side*1.84,4.12,2.59,.91,.10,.91,dark,Math.PI/2);
  b.cylinder(side*1.84,4.12,5.92,.78,.38,.78,'#736e5b',Math.PI/2);
  b.cylinder(side*1.84,4.12,6.13,.59,.035,.59,'#08131b',Math.PI/2);
  for(let i=0;i<6;i++)b.box(side*2.27,4.08,3.15+i*.34,.035,.45,.10,dark,0,0,side*.18);
  // Sliding side access panel, handles, seams and recessed foot step.
  const slide=p.door*.72;
  b.box(side*2.20,2.48,4.72+slide,.13,1.55,1.30,light);
  b.box(side*2.28,2.45,4.30+slide,.045,.08,.32,'#b4b49b');
  b.box(side*2.22,1.35,4.7,.58,.08,1.08,dark);
  for(let row=0;row<2;row++)for(let i=0;i<16;i++)b.sphere(side*2.235,1.93+row*1.55,-4.5+i*.59,.045,.045,.045,'#a1a48b');
  // Four real wheel bogies, shock struts and hubs.
  for(const z of [-4.8,4.7]){
   b.box(side*1.76,.95,z,.18,1.1,.18,'#9b9e8c',0,0,side*.15);
   b.box(side*1.72,1.31,z,.55,.20,.53,dark);
   for(const tandem of [-1,1]){
    const zz=z+tandem*.29;
    b.cylinder(side*1.95,.43,zz,.79,.32,.79,'#101b23',0,0,Math.PI/2);
    b.cylinder(side*2.13,.43,zz,.37,.035,.37,'#899389',0,0,Math.PI/2);
   }
  }
  // Airframe identification stripes and tactical insignia.
  for(let i=0;i<3;i++)b.box(side*2.26,2.12,-2.7+i*.20,.025,.37,.065,'#b6b89a',.0,0,side*.2);
  b.box(side*2.25,2.2,-1.3,.03,.10,.75,'#ad6e52');b.box(side*2.25,2.2,-1.3,.03,.52,.11,'#ad6e52');
  b.sphere(side*2.38,3.42,1.8,.15,.12,.15,side<0?'#ed6e56':'#8cdbab',0,0,0,'glow');
 }
 // Forward and tall aft pylons; counter-rotating three-blade rotors.
 for(const [index,z,height] of [[0,-5.05,5.23],[1,5.30,6.14]]){
  b.box(0,height-1.12,z,1.65,2.10,2.12,olive,-.13);
  b.box(0,height-.33,z,1.36,.38,1.40,light);
  b.cylinder(0,height+.03,z,.24,.65,.24,'#a3aa9a');
  b.sphere(0,height+.36,z,.76,.30,.76,dark);
  const angle=(reducedMotion?time*3.2:p.rotor)*(index?-1:1)+index*.65;
  for(let blade=0;blade<3;blade++){
   const a=angle+blade*Math.PI*2/3;
   for(const [radius,length,width] of [[1.15,1.5,.27],[4.1,4.5,.42],[7.6,2.5,.34]]){
    b.box(Math.sin(a)*radius,height+.35,z+Math.cos(a)*radius,width,.065,length,blade%2?dark:seam,.01,a,0);
   }
   b.box(Math.sin(a)*8.78,height+.35,z+Math.cos(a)*8.78,.36,.067,.22,'#b6ad7f',0,a);
  }
 }
 // Rear opening and hinged loading ramp, with tread strips following its real angle.
 b.box(0,2.51,6.52,2.91,2.65,.12,'#0b1821');
 for(const side of [-1,1])b.box(side*1.57,2.5,6.64,.17,2.81,.26,trim);
 b.box(0,3.94,6.64,3.3,.17,.26,trim);
 const ramp=p.door*Math.acos(-1.14/3.05);
 b.box(0,1.14+1.525*Math.cos(ramp),6.73+1.525*Math.sin(ramp),3.03,3.05,.15,light,ramp);
 for(let i=0;i<12;i++){
  const d=.1+i*.25;b.box(0,1.14+d*Math.cos(ramp)-.02,6.84+d*Math.sin(ramp),2.78,.047,.075,seam,ramp);
 }
 b.box(0,1.15,6.56,3.02,.17,.37,trim);
 // Chin turret is intentionally absent: this is transport, not a new combat system.
 b.box(0,2.03,-7.8,.27,.30,.34,dark);
 for(const side of [-1,1])b.box(side*.66,1.93,-7.78,.24,.15,.08,'#f4ead2',0,0,0,'glow');
 b.box(0,4.15,-2.5,.05,.85,.05,dark,.18);b.box(0,4.08,1.0,.05,.65,.05,dark,-.18);
 if(time%1.3<.11)b.sphere(0,6.5,5.3,.18,.18,.18,'#f3ac7d',0,0,0,'glow');
 b.root=null;
 // Ground contact and rotor wash use the aircraft's real altitude.
 if(p.height<24){
  const strength=Math.max(0,1-p.height/24);b.cylinder(p.x/32,.035,p.y/32,12+strength*4,.025,22,'#07141c',0,0,0,'shadow');
  if(!reducedMotion&&p.height<12)for(let i=0;i<12;i++){
   const a=i*2.4+time*.8,radius=6+(time*.5+i)%4;
   b.sphere(p.x/32+Math.cos(a)*radius,.12,p.y/32+Math.sin(a)*radius,.42,.10,.21,'#a5ab94',0,a,0,'glass');
  }
 }
 b.root=previous;
}
