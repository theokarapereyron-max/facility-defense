import * as THREE from 'three';
import {WEAPONS} from './simulation.mjs';

const profiles = {
 rifle:{length:.43, width:.074, sight:'iron'},
 pistol:{length:.25, width:.063, sight:'iron'},
 smg:{length:.34, width:.080, sight:'dot'},
 shotgun:{length:.51, width:.085, sight:'iron'},
 marksman:{length:.52, width:.073, sight:'scope'},
 heavy:{length:.52, width:.101, sight:'dot'},
};

export function buildHeldWeapon(batch, camera, player, time, {aim, motion, effects, stride}) {
 batch.reset();
 const {length,width,sight} = profiles[player.weapon] ?? profiles.rifle;
 const kick = Math.max(0, 1 - (time - (player.lastShotAt ?? -1)) / .14);
 const reload = player.reload > 0 ? Math.sin(Math.PI * (player.reload / WEAPONS[player.weapon].reloadTime)) : 0;
 const bob = motion ? Math.sin(player.moveDistance * .095) * stride * (1-aim*.8) : 0;
 const x = .135 * (1-aim), y = -.148 + aim*.073 + bob*.008 - reload*.105;
 const z = -.38 + kick*.038;
 const pose = new THREE.Object3D();
 pose.position.set(x + reload*.042, y, z);
 pose.rotation.set(-reload*.45 + kick*.12, reload*.2, reload*.3 + bob*.06);
 pose.updateMatrix();
 batch.root = pose.matrix.premultiply(camera.matrixWorld);
 const metal=player.weapon==='shotgun'?'#4f4c45':player.weapon==='heavy'?'#465e66':'#354c59', trim='#829a9c', dark='#122331';
 const grip=player.weapon==='pistol'?.09:length*.28;
 batch.box(0,-.012,length*.28,width*.67,.056,grip,dark);
 for(const side of [-1,1]){
  batch.box(side*width*.512,.014,-length*.07,.012,.039,length*.49,'#283e48');
  for(const mark of [-1,0,1])batch.box(side*width*.568,.018,-length*.12+mark*.019,.003,.014,.004,trim);
 }
 batch.box(width*.53,.017,length*.103,.014,.021,.074,'#10242e');
 batch.box(width*.6,.017,length*.112,.02,.013,.027,trim);
 if(player.weapon==='heavy')batch.box(0,-.069,-.07,width*1.24,.076,.096,'#53645c');
 if(player.weapon==='shotgun')batch.cylinder(0,-.027,-length*.45,width*.35,length*.32,width*.35,trim,Math.PI/2);
 batch.box(0,0,0,width,.074,length*.70,metal);
 batch.box(0,.041,-length*.075,width*.83,.017,length*.66,trim);
 batch.box(0,-.068,length*.13,width*.61,.112,.065,dark,-.23);
 if(player.weapon!=='pistol')batch.box(0,-.072,-length*.05,width*.65,.092,.09,'#263b45',-.16);
 batch.cylinder(0,.003,-length*.43,width*.44,length*.38,width*.44,dark,Math.PI/2);
 batch.cylinder(0,.003,-length*.61,width*.57,.038,width*.57,trim,Math.PI/2);
 batch.cylinder(0,.003,-length*.61-.020,width*.33,.008,width*.33,'#101b22',Math.PI/2);
 for(let i=0;i<5;i++)batch.box(0,.055,-length*.27+i*.019,width*.76,.012,.008,dark);
 if(sight==='scope') {
  batch.cylinder(0,.082,0,.054,.15,.054,dark,Math.PI/2);
  batch.cylinder(0,.082,.078,.049,.007,.049,'#78c5c3',Math.PI/2,0,0,'glow');
 }else{
  batch.box(0,.063,-length*.27,.013,.032,.014,dark);
  batch.box(0,.082,-length*.27,.009,.008,.01,sight==='dot'?'#ff866b':'#b5e5c1',0,0,0,'glow');
  for(const side of [-1,1])batch.box(side*.02,.061,length*.23,.014,.026,.016,dark);
 }
 // Gloves, sleeves and a supporting hand sit in the same camera-space model.
 batch.box(.031,-.089,.093,.073,.086,.106,'#48554e',-.5,0,-.14);
 batch.box(.104,-.152,.141,.104,.112,.186,'#2a404a',-.49,-.26,-.23);
 batch.box(-.053,-.062,-length*.19,.072,.067,.106,'#505c51',.1,0,.28);
 batch.box(-.111,-.148,-length*.10,.102,.115,.19,'#2c434d',-.44,.2,.43);
 if(effects&&time-(player.lastShotAt??-1)<.045)batch.sphere(0,.005,-length*.68,.091,.081,.19,'#ffe0a0',0,0,0,'glow');
 batch.finish();
 for(const {mesh} of batch.bins.values()) {
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.renderOrder=100;
 }
}

export function drawFpsReticle(context,width,height,reload,aim) {
 const x=width/2, y=height/2, gap=aim>.5?4:7;
 context.save();
 context.strokeStyle='#eaf6ef';context.lineWidth=1.4;
 context.shadowColor='#061219';context.shadowBlur=3;
 context.beginPath();
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
  context.moveTo(x+dx*gap,y+dy*gap);
  context.lineTo(x+dx*(gap+5),y+dy*(gap+5));
 }
 context.stroke();
 context.fillStyle='#eaf6ef';context.fillRect(x-1,y-1,2,2);
 if(reload>0) {
  context.font='600 12px Arial,sans-serif';context.textAlign='center';
  context.fillText('RECHARGEMENT',x,y+38);
 }
 context.restore();
}
