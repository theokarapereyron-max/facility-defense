import {healthBarEnabled} from './health-display.mjs';
import * as THREE from 'three';
import {Renderer} from './renderer.mjs';
import {Canvas3DRenderer} from './canvas3d.mjs';
import {CORE,FLOOR_INFO,TILE,dist} from './map.mjs';
import {rankOf,canCommand} from './ranks.mjs';
import {raycast,lineOfSight} from './navigation.mjs';
import {nearbyFurniture} from './inventory.mjs';
import {FLOOR_PALETTES,drawCombatFeedback} from './world-art.mjs';
import {RenderResources,PartBatch,TEAM_COLORS,buildFloor3D,drawDoor3D,drawActor3D,drawFurniture3D} from './models3d.mjs';
import {CAMERA_ELEVATION,CAMERA_YAW,BODY_HEIGHT,placeCamera,placeFirstPerson,projectPosition,groundPosition,wallHeight} from './projection3d.mjs';
import {CEILING_HEIGHT,MAX_PITCH} from './fps-ballistics.mjs';
import {STAIR_RISE,stairFootprint} from './stairs.mjs';
import {stairCameraPose} from './stair-camera.mjs';
import {drawLift3D} from './lift-renderer3d.mjs';
import {liftOffset,liftDisplay} from './lift-geometry.mjs';
import {drawHelicopter3D} from './helicopter3d.mjs';
import {buildHeldWeapon,drawFpsReticle} from './fps-view.mjs';

const dummy=new THREE.Object3D();
const font='600 11px Arial,sans-serif';
export class Renderer3D extends Renderer {
 constructor(canvas,sim) {
  super(canvas,sim,{alpha:true});
  this.activeMode='2d';this.failureReason='';this.yaw=CAMERA_YAW;this.yawTarget=CAMERA_YAW;this.elevation=CAMERA_ELEVATION;this.floorScenes=new Map();this.stats={calls:0,triangles:0};
  this.glCanvas=this.makeRenderCanvas();
  this.onContextLost=event=>{event.preventDefault();this.useCompatible3D=true;};
  try {
   this.gpu=new THREE.WebGLRenderer({canvas:this.glCanvas,antialias:false,alpha:false,powerPreference:'high-performance'});
   this.gpu.outputColorSpace=THREE.SRGBColorSpace;this.gpu.toneMapping=THREE.ACESFilmicToneMapping;this.gpu.toneMappingExposure=1.35;this.gpu.shadowMap.type=THREE.PCFSoftShadowMap;
   this.glCanvas.addEventListener('webglcontextlost',this.onContextLost);
  } catch(error) {
   this.switchToCompatible3D();
  }
  this.resources=new RenderResources();this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#091620');
   this.aerialCamera=new THREE.OrthographicCamera();this.viewCamera=this.aerialCamera;
   this.fpsCamera=new THREE.PerspectiveCamera(66,1,.035,65);
   this.transitionCamera=new THREE.PerspectiveCamera(42,1,.035,500);this.viewBlend=null;
   this.pitch=0;this.ads=false;this.aimBlend=0;this.stride=0;this.lastDistance=0;
   this.fpsFog=new THREE.Fog('#14232d',26,63);
   this.roofFog=new THREE.Fog('#263f58',120,340);
   this.ceiling=new THREE.Mesh(new THREE.PlaneGeometry(240,160),new THREE.MeshStandardMaterial({color:'#334853',roughness:.94}));
   this.ceiling.rotation.x=Math.PI/2;this.ceiling.renderOrder=-99;this.ceiling.visible=false;this.scene.add(this.ceiling);
   this.heldWeapon=new PartBatch(this.resources,80);this.scene.add(this.heldWeapon.group);
   this.ambient=new THREE.HemisphereLight('#c6e4f2','#263440',2.3);this.scene.add(this.ambient);
   this.sun=new THREE.DirectionalLight('#fff0d2',3.1);this.sun.position.set(-12,40,25);this.sun.castShadow=true;
   this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:130});this.sun.shadow.bias=-.0008;this.sun.shadow.normalBias=.03;this.scene.add(this.sun,this.sun.target);
   this.fill=new THREE.PointLight('#81d7f1',22,18,1.7);this.scene.add(this.fill);
   this.coreLight=new THREE.PointLight('#72f1ec',60,22,1.5);this.scene.add(this.coreLight);
   this.dynamic=new PartBatch(this.resources,10000);this.scene.add(this.dynamic.group);
   this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));this.lines.frustumCulled=false;this.scene.add(this.lines);
 
   this.activeMode='3d';this.resize();
 }
 makeRenderCanvas() {
  const canvas=document.createElement('canvas');
  canvas.className='battlefield battlefield-webgl';canvas.setAttribute('aria-hidden','true');
  canvas.style.pointerEvents='none';this.canvas.before(canvas);
  return canvas;
 }
 switchToCompatible3D() {
  const previousCanvas=this.glCanvas,previousRenderer=this.gpu;
  const canvas=this.makeRenderCanvas();
  this.gpu=new Canvas3DRenderer({canvas});
  this.glCanvas=canvas;this.renderSize=null;this.useCompatible3D=false;
  previousCanvas.removeEventListener('webglcontextlost',this.onContextLost);
  previousRenderer?.dispose();
  previousCanvas.remove();
  this.resize();
 }
 get is3D(){return !!this.gpu&&this.settings.renderMode!=='2d';}
 get isFPS(){return this.is3D&&this.settings.view3D==='fps';}
 look(dx,dy) {
  const p=this.sim.player;
  if(!this.isFPS||p.health<=0||p.stunnedUntil>this.sim.time||!Number.isFinite(dx)||!Number.isFinite(dy))return;
  const sensitivity=this.ads?.0017:.0027;
  p.angle=Math.atan2(Math.sin(p.angle+dx*sensitivity),Math.cos(p.angle+dx*sensitivity));
  this.pitch=Math.max(-MAX_PITCH,Math.min(MAX_PITCH,this.pitch-dy*sensitivity));
 }
 resize() {
  super.resize();
  if(!this.gpu)return;
  const ratio=Math.min(window.devicePixelRatio||1,this.settings.graphicsQuality==='balanced'?1.15:1.5);
  const size=this.renderSize;
  if(size?.ratio===ratio&&size.w===this.w&&size.h===this.h)return;
  if(size?.ratio!==ratio)this.gpu.setPixelRatio(ratio);
  this.gpu.setSize(this.w,this.h,false);
  this.renderSize={ratio,w:this.w,h:this.h};
 }
 resetScene() {
  if(!this.scene)return;
  for(const model of this.floorScenes.values()){this.scene.remove(model.root);model.dispose();}
  this.floorScenes.clear();this.sceneSimulation=this.sim;this.lastFloor=null;this.viewBlend=null;this.stairPose=null;
 }
 rotateCamera(direction) {this.yawTarget+=direction*Math.PI/4;this.aimScreen=null;}
 resetCamera() {this.yawTarget=CAMERA_YAW;this.elevation=CAMERA_ELEVATION;this.aimScreen=null;}
 toggleCameraTilt() {this.elevation=this.elevation>1.12?CAMERA_ELEVATION:1.27;}
 screenToWorld(x,y) {return this.is3D&&this.viewCamera?groundPosition(this.viewCamera,x,y,this.w,this.h):super.screenToWorld(x,y);}
 aimToWorld(x,y) {return this.is3D?groundPosition(this.viewCamera,x,y,this.w,this.h,BODY_HEIGHT):super.screenToWorld(x,y);}
 transformInput(input) {
  if(!this.is3D)return input;
  if(this.isFPS)return {...input,relativeMovement:true,shotPitch:this.pitch};
  return {...input,relativeMovement:true,...(Number.isFinite(input.angle)?{angle:input.angle-this.yaw}:{})};
 }
 pickUnit(x,y) {
  if(!this.is3D)return null;
  const p=this.sim.player;
  const candidates=this.sim.units.filter(u=>u.health>0&&!u.transit&&u.floor===p.floor&&u.role!=='player')
   .map(u=>({u,point:projectPosition(this.viewCamera,u,this.w,this.h,1.1)}))
   .filter(({u,point})=>Math.hypot(point.x-x,point.y-y)<22&&(!this.isFPS||point.depth>=-1&&point.depth<=1&&lineOfSight(this.sim.floor(p.floor),p,u)));
  candidates.sort((a,b)=>this.isFPS?dist(a.u,p)-dist(b.u,p):Math.hypot(a.point.x-x,a.point.y-y)-Math.hypot(b.point.x-x,b.point.y-y));
  return candidates[0]?.u||null;
 }
 render(dt) {
  if(!this.is3D){this.activeMode='2d';if(this.glCanvas)this.glCanvas.style.display='none';super.render(dt);return;}
  this.activeMode='3d';this.glCanvas.style.display='block';
  if(this.useCompatible3D)this.switchToCompatible3D();
  try {
   this.renderWorld(dt);
  } catch(error) {
   if(!this.gpu.isSoftware){
    console.warn('Facility WebGL renderer interrupted:',error);
    this.switchToCompatible3D();
    this.renderWorld(0);
   }else throw error;
  }
 }
 renderWorld(dt) {
  const sim=this.sim,p=sim.player,f=sim.floor(p.floor),a=this.camera,time=this.settings.reducedMotion?0:sim.time;
  if(this.sceneSimulation!==sim)this.resetScene();
  if(a.floor!==p.floor||this.lastFloor===null){a.x=p.x;a.y=p.y;a.floor=p.floor;}
  const t=this.settings.reducedMotion?1:1-Math.exp(-Math.max(dt,.001)*7);
  a.x+=(p.x+Math.cos(p.angle)*32-a.x)*t;a.y+=(p.y+Math.sin(p.angle)*32-a.y)*t;a.zoom+=(this.zoom-a.zoom)*t;this.yaw+=(this.yawTarget-this.yaw)*t;
  const fps=this.isFPS;
  const destination=Number(fps);
  if(this.viewBlend===null||this.settings.reducedMotion||this.lastFloor!==f.id)this.viewBlend=destination;
  else this.viewBlend+=Math.sign(destination-this.viewBlend)*Math.min(Math.abs(destination-this.viewBlend),dt/.46);
  const blend=this.viewBlend, transition=blend>0&&blend<1;
  this.viewCamera=transition?this.transitionCamera:blend===1?this.fpsCamera:this.aerialCamera;
  placeCamera(this.aerialCamera,a,this.w,this.h,a.zoom,this.yaw,this.elevation);
  if(blend>0){
   this.fpsCamera.far=f.isRoof?430:65;
   const motion=!this.settings.reducedMotion;
   this.aimBlend+=(Number(this.ads)-this.aimBlend)*(motion?1-Math.exp(-Math.max(dt,.001)*17):1);
   const speed=Math.min(1,Math.abs(p.moveDistance-this.lastDistance)/(Math.max(.016,dt)*p.speed));
   this.stride+=(speed-this.stride)*.24;this.lastDistance=p.moveDistance;
   const fov=Math.max(46,Math.min(86,66-(a.zoom-.85)*36));
   const car=sim.elevators.find(l=>l.id===p.cabin);
   const cameraPlayer=car?{...p,stairHeight:(p.stairHeight||0)+liftOffset(car,p.floor),stairTravel:p.stairTravel||(car.moving?{id:car.id}:null)}:p;
   this.stairPose=stairCameraPose(this.stairPose,cameraPlayer,dt,this.settings.reducedMotion);
   const pose=this.stairPose;
   placeFirstPerson(this.fpsCamera,{...p,x:pose.x,y:pose.y,stairHeight:pose.height-p.floor*STAIR_RISE},this.w,this.h,this.pitch,fov-17*this.aimBlend);
  }
  if(transition){
   const cam=this.transitionCamera, ease=blend*blend*(3-2*blend);
   cam.position.copy(this.aerialCamera.position).lerp(this.fpsCamera.position,ease);
   cam.quaternion.copy(this.aerialCamera.quaternion).slerp(this.fpsCamera.quaternion,ease);
   cam.aspect=this.fpsCamera.aspect;
   const aerialFov=THREE.MathUtils.radToDeg(2*Math.atan(this.aerialCamera.top/100));
   cam.fov=THREE.MathUtils.lerp(aerialFov,this.fpsCamera.fov,blend);
   cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
  }
  this.ceiling.visible=false;
  this.ceiling.position.set(p.x/TILE,CEILING_HEIGHT,p.y/TILE);
  this.ceiling.material.color.set(f.id===1?'#516563':'#394750');
  this.scene.fog=fps?(f.isRoof?this.roofFog:this.fpsFog):null;
  this.scene.background.set(fps&&f.isRoof?'#263f58':'#091620');
  if(!this.floorScenes.has(f.id)) {
   const model=buildFloor3D(f,this.resources);this.floorScenes.set(f.id,model);this.scene.add(model.root);
  }
  const nearbyStair=f.connectors.find(c=>c.type==='stairs'&&stairFootprint(c,p.x,p.y,180));
  const direction=p.stairTravel?(p.stairTravel.base===f.id?1:-1):(nearbyStair&&p.x<nearbyStair.x?1:-1);
  const otherFloor=f.id+direction;
  const showNeighbour=fps&&nearbyStair&&otherFloor>=nearbyStair.min&&otherFloor<=nearbyStair.max;
  if(showNeighbour&&!this.floorScenes.has(otherFloor)){
   const neighbour=buildFloor3D(sim.floor(otherFloor),this.resources);
   this.floorScenes.set(otherFloor,neighbour);this.scene.add(neighbour.root);
  }
  for(const [id,m] of this.floorScenes){
   m.root.visible=id===f.id||showNeighbour&&id===otherFloor;
   m.root.position.y=(id-f.id)*STAIR_RISE;
   m.ceiling.visible=fps&&!sim.floor(id).isRoof;
   m.incomingStairs.group.visible=!showNeighbour||id===Math.min(f.id,otherFloor);
  }
  // Reuse recently visited decks to avoid rebuilding them at each stair entrance.
  while(this.floorScenes.size>3){
   const entry=[...this.floorScenes].find(([,m])=>!m.root.visible);
   if(!entry)break;
   const [id,old]=entry;this.scene.remove(old.root);old.dispose();this.floorScenes.delete(id);
  }
  const model=this.floorScenes.get(f.id);this.lastFloor=f.id;
  for(let i=0;i<model.wallCells.length;i++) {
   const cell=model.wallCells[i],cut=wallHeight(cell,p,this.yaw,this.settings.cutawayWalls!==false);
   const height=THREE.MathUtils.lerp(cut,STAIR_RISE,blend);
   dummy.position.set(cell.x,height/2,cell.z);dummy.scale.set(.98,height,.98);dummy.rotation.set(0,0,0);dummy.updateMatrix();model.walls.setMatrixAt(i,dummy.matrix);
  }
  model.walls.instanceMatrix.needsUpdate=true;
  for(const {room,mesh} of model.roomTiles){const base=room.type==='shop'?'#41443a':FLOOR_PALETTES[f.id+2].tile;mesh.material.color.set(base);if(room.owner==='enemy')mesh.material.color.lerp(new THREE.Color('#754a3c'),.28);}
  this.gpu.shadowMap.enabled=this.settings.graphicsQuality!=='balanced'&&this.settings.effects!==false;
  this.ambient.intensity=2.3;this.sun.intensity=3.1;
  this.sun.position.set(a.x/TILE-12,40,a.y/TILE+25);this.sun.target.position.set(a.x/TILE,0,a.y/TILE);this.sun.target.updateMatrixWorld();
  this.fill.position.set(p.x/TILE,3.4,p.y/TILE);this.fill.intensity=this.settings.effects===false?0:16;
  this.coreLight.position.set(CORE.x/TILE,3,CORE.y/TILE);this.coreLight.intensity=f.id===-2&&this.settings.effects!==false?60:0;
  const drawRadius=Math.max(2200,Math.hypot(this.w,this.h)/Math.max(.42,a.zoom));
  this.dynamic.reset();
  const riderLift=sim.elevators.find(l=>l.id===p.transit&&l.moving);
  for(const lift of sim.elevators)if(f.id>=lift.min&&f.id<=lift.max&&dist(p,lift)<drawRadius)drawLift3D(this.dynamic,lift,f.id,fps);
  if(f.isRoof)drawHelicopter3D(this.dynamic,sim.airlift,sim.time,{reducedMotion:this.settings.reducedMotion});
  if(model.ceiling.visible)this.drawCeilingLights(f,p);
  if(showNeighbour){
   this.dynamic.root=new THREE.Matrix4().makeTranslation(0,(otherFloor-f.id)*STAIR_RISE,0);
   const neighbour=sim.floor(otherFloor);
   if(!neighbour.isRoof)this.drawCeilingLights(neighbour,p);
   for(const door of neighbour.doors)if(dist(p,door)<650)drawDoor3D(this.dynamic,door,true,!neighbour.isRoof);
   this.dynamic.root=null;
  }
  for(const door of f.doors){
   const distance=dist(p,door);
   if(distance<drawRadius)drawDoor3D(this.dynamic,door,distance<(fps?740:450),model.ceiling.visible);
  }
  for(const prop of f.props)if(prop.dropped&&dist(p,prop)<drawRadius)drawFurniture3D(this.dynamic,prop);
  for(const u of sim.units)if((!fps||u!==p)&&u.health>0&&(!u.transit||u.transit===riderLift?.id)&&u.floor===f.id&&dist(p,u)<drawRadius)drawActor3D(this.dynamic,u.transit===riderLift?.id?{...u,stairHeight:liftOffset(riderLift,f.id)}:u,time,dist(p,u)<(fps?880:450));
  if(fps&&nearbyStair)for(const u of sim.units){
   if(u.floor===f.id||Math.abs(u.floor-f.id)!==1||u.health<=0||u.transit||!stairFootprint(nearbyStair,u.x,u.y,160))continue;
   drawActor3D(this.dynamic,{...u,stairHeight:(u.stairHeight||0)+(u.floor-f.id)*STAIR_RISE},time,true);
  }
  for(const u of sim.casualties)if(u.floor===f.id&&dist(p,u)<1500)this.dynamic.box(u.x/TILE,.09,u.y/TILE,.65,.17,1.4,u.team==='enemy'?'#624c43':'#354e58',0,-u.angle);
  if(f.id===-2)this.drawCore(time);
  this.drawEffects(time);
  this.heldWeapon.group.visible=blend===1&&p.health>0;
  if(this.heldWeapon.group.visible)buildHeldWeapon(this.heldWeapon,this.viewCamera,p,sim.time,{aim:this.aimBlend,motion:!this.settings.reducedMotion,effects:this.settings.effects,stride:this.stride});
  this.dynamic.finish();this.updateLines();this.gpu.render(this.scene,this.viewCamera);
  this.stats={calls:this.gpu.info.render.calls,triangles:this.gpu.info.render.triangles,backend:this.gpu.isSoftware?'compatible':'WebGL'};
  this.drawOverlay();
 }
 drawCeilingLights(f,p) {
  const b=this.dynamic,x=Math.floor(p.x/TILE/5)*5,z=Math.floor(p.y/TILE/5)*5;
  const light=f.id===1?'#def5e9':f.id===-2?'#7ee2eb':'#b4d6e1';
  const panel=f.id===1?'#718581':'#475861',metal='#304451';
  for(let row=z-20;row<=z+20;row+=5)for(let col=x-20;col<=x+20;col+=5){
   if(row<1||col<1||row>=f.rows||col>=f.cols||f.grid[row*f.cols+col]!==0)continue;
   const cx=col+.5,cz=row+.5,detail=Math.hypot(cx-p.x/TILE,cz-p.y/TILE)<13;
   if(f.connectors.some(c=>c.type==='stairs'&&f.id<c.max&&Math.abs(cx-c.x/TILE)<4.6&&cz>c.y/TILE-7&&cz<c.y/TILE+6||c.type==='elevator'&&Math.abs(cx-c.x/TILE)<4.2&&Math.abs(cz-c.y/TILE)<4.2))continue;
   b.box(cx,CEILING_HEIGHT-0.03,cz,4.85,.062,4.85,panel);
   b.box(cx,CEILING_HEIGHT-0.11,cz+2.42,5,.22,.16,metal);
   b.box(cx+2.42,CEILING_HEIGHT-0.08,cz,.14,.16,4.86,metal);
   if((col+row)%10===0){
    if(detail)for(const side of [-1,1])b.box(cx,CEILING_HEIGHT-0.145,cz+side*.7,.14,.21,.14,metal);
    b.box(cx,CEILING_HEIGHT-0.215,cz,.51,.11,1.83,metal);
    b.box(cx,CEILING_HEIGHT-0.277,cz,.36,.025,1.56,light,0,0,0,'glow');
    if(detail)b.box(cx,CEILING_HEIGHT-0.292,cz,.042,.018,1.68,metal);
   }else if(detail){
    b.box(cx,CEILING_HEIGHT-0.087,cz,1.37,.087,.7,metal);
    for(let i=-2;i<=2;i++)b.box(cx+i*.23,CEILING_HEIGHT-0.138,cz,.065,.02,.52,panel);
   }
   if(detail&&(f.id===-2||f.id===-1||f.id===3)){
    for(const side of [-1,1])b.box(cx+side*.105,CEILING_HEIGHT-0.17,cz+1.64,.061,.053,5,light,0,0,0,'glow');
   }
  }
 }
 drawCore(time) {
  const b=this.dynamic,x=CORE.x/TILE,z=CORE.y/TILE,c=this.sim.coreState==='SECURE'?'#7be5e7':'#f3946d';
  b.cylinder(x,.16,z,9.5,.32,9.5,'#263e4d');b.cylinder(x,.4,z,7.7,.23,7.7,'#597986');b.cylinder(x,.6,z,5.6,.24,5.6,'#152f41');
  for(let i=0;i<20;i++){const a=i*Math.PI/10;b.box(x+Math.cos(a)*4.25,.4,z+Math.sin(a)*4.25,.48,.13,.16,i<this.sim.coreControl/5?c:'#45545d',0,-a,0,'glow');}
  for(let i=0;i<6;i++){const a=i*Math.PI/3;b.box(x+Math.cos(a)*2.2,1.12,z+Math.sin(a)*2.2,.36,1.45,.36,'#9fb9bf');b.sphere(x+Math.cos(a)*2.2,1.9,z+Math.sin(a)*2.2,.25,.25,.25,c,0,0,0,'glow');}
  b.cylinder(x,1.9,z,2.8,2.5,2.8,c,0,0,0,'glass');b.add('crystal',x,2.2+Math.sin(time)*.1,z,1.7,2.5,1.7,c,.2,time*.4,.1,'glow');
  for(let i=0;i<3;i++)b.add('ring',x,1+i*.9,z,4.6-i*.55,4.6-i*.55,4.6-i*.55,c,Math.PI/2+.13*Math.sin(time+i),time*.25,0,'glow');
 }
 drawEffects(time) {
  const b=this.dynamic,s=this.sim,floor=s.player.floor;
  for(const g of s.projectiles)if(g.floor===floor)b.sphere(g.x/TILE,.2+Math.sin(Math.PI*Math.min(1,g.age/.65))*1.2,g.y/TILE,.24,.24,.24,g.item==='flash'?'#e7d799':'#71917e');
  if(!this.settings.effects)return;
  for(const field of s.fields)if(field.floor===floor){const x=field.x/TILE,z=field.y/TILE,r=field.radius/TILE;
   if(field.type==='smoke')for(let i=0;i<7;i++){const a=i*2.4+time*.07;b.sphere(x+Math.cos(a)*r*.45,1.1+i%3*.45,z+Math.sin(a)*r*.45,r*.9,2,r*.9,'#a1a9ac',0,0,0,'glass');}
   if(field.type==='fire')for(let i=0;i<9;i++){const a=i*2.4;b.add('cone',x+Math.cos(a)*r*.6,.4+Math.sin(time*4+i)*.12,z+Math.sin(a)*r*.6,.55,1.05,.55,i%2?'#efaa61':'#df6d40',0,0,0,'glow');}
  }
  for(const e of s.effects)if(e.floor===floor&&['explosion','spark','hit'].includes(e.type)&&dist(e,s.player)<1500){
   const age=1-e.life/e.max,x=e.x/TILE,z=e.y/TILE,h=e.height??.74;
   if(e.type!=='spark'){
    const r=e.type==='explosion'?age*3+.4:.13;
    b.sphere(x,h,z,r,r,r,e.type==='explosion'?'#efbd7a':'#efc79b',0,0,0,'glow');continue;
   }
   const concrete=e.material==='concrete',glass=e.material==='glass';
   for(let i=0;i<(concrete?4:6);i++){
    const a=(e.angle||0)+Math.PI+(i-2.5)*.49,travel=age*(.2+i*.09);
    const px=x+Math.cos(a)*travel,pz=z+Math.sin(a)*travel,y=Math.max(.04,h+age*(.38+i*.042)-age*age*.5);
    if(concrete){const r=.14+age*.18;b.sphere(px,y,pz,r,r*.85,r,'#ad9b82',0,0,0,'glass');}
    else if(glass)b.add('crystal',px,y,pz,.07,.14,.045,i%2?'#bde9e6':'#72b6c3',age*6,a,i,'glow');
    else b.box(px,y,pz,.023,.025,.11,i%2?'#ffd68a':'#f7a35d',.3,a,0,'glow');
   }
  }
 }
 updateLines() {
  const s=this.sim,p=s.player,f=s.floor(p.floor),vertices=[],colors=[];
  const segment=(a,b,tint,height=.04)=>{const col=new THREE.Color(tint);vertices.push(a.x/TILE,a.h??height,a.y/TILE,b.x/TILE,b.h??height,b.y/TILE);for(let i=0;i<2;i++)colors.push(col.r,col.g,col.b);};
  const circle=(center,radius,tint,height=.04)=>{for(let i=0;i<64;i++){const a=i*Math.PI/32,bb=(i+1)*Math.PI/32;segment({x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius},{x:center.x+Math.cos(bb)*radius,y:center.y+Math.sin(bb)*radius},tint,height);}};
  if(!this.isFPS&&s.status==='running'&&p.health>0){circle(p,s.commandRadius,'#608d96');circle(p,21,'#e4efce');const aim=raycast(f,p.x,p.y,p.angle,230);segment(p,aim,'#a2cbcc',BODY_HEIGHT);}
  for(const u of s.units)if(u.floor===p.floor&&u.health>0&&!u.transit&&(s.selectedIDs.has(u.id)||u.role==='player'))circle(u,22,u.role==='player'?'#d8edc7':canCommand(p,u)?'#dbbd78':'#e58b75');
  if(this.settings.effects)for(const tr of s.traces)if(tr.floor===p.floor){
   const length=Math.hypot(tr.ex-tr.x,tr.ey-tr.y), offset=this.isFPS&&tr.player?Math.min(.9,14/Math.max(1,length)):0;
   const start={x:tr.x+(tr.ex-tr.x)*offset,y:tr.y+(tr.ey-tr.y)*offset,h:tr.height===undefined?BODY_HEIGHT:tr.height+(tr.endHeight-tr.height)*offset};
   segment(start,{x:tr.ex,y:tr.ey,h:tr.endHeight},tr.team==='enemy'?'#f8b18c':'#fff2bc',BODY_HEIGHT);
  }
  if(this.waypoint) {
   const w=this.waypoint,local=w.floor===p.floor?w:f.connectors.filter(c=>c.type==='stairs'&&w.floor>=c.min&&w.floor<=c.max).sort((a,b)=>dist(p,a)-dist(p,b))[0];
   if(local){if(!this.routeAt||s.time-this.routeAt>.8||this.routeFloor!==p.floor||this.routeTarget!==w){this.route=s.pathfinding.path(f,p,local);this.routeAt=s.time;this.routeFloor=p.floor;this.routeTarget=w;}let prev=p;for(const n of this.route||[]){segment(prev,n,'#e2c57e',.08);prev=n;}circle(local,25,'#efcf89');}
  }
  if(this.debug)for(const u of s.units)if(u.floor===p.floor&&u.health>0){let prev=u;for(const n of u.path||[]){segment(prev,n,u.team==='enemy'?'#e18c72':'#8ed0c1',.1);prev=n;}}
  this.lines.geometry.dispose();this.lines.geometry=new THREE.BufferGeometry();this.lines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));this.lines.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 }
 drawOverlay() {
  const c=this.ctx,s=this.sim,p=s.player,f=s.floor(p.floor),fps=this.isFPS;this.nearFurniture=nearbyFurniture(s);
  c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.w,this.h);
  const tag=(text,position,tint,height=2.2)=>{const at=projectPosition(this.viewCamera,position,this.w,this.h,height);if(at.depth<-1||at.depth>1||at.x<0||at.x>this.w||at.y<60||at.y>this.h)return;c.font=font;c.textAlign='center';const w=c.measureText(text).width+12;c.fillStyle='#0a1c28df';c.fillRect(at.x-w/2,at.y-13,w,20);c.fillStyle=tint;c.fillText(text,at.x,at.y+1);};
  if(this.gpu.isSoftware&&!fps)for(const room of f.rooms){const center={x:room.x+room.w/2,y:room.y+room.h/2};if(dist(center,p)>1100)continue;const at=projectPosition(this.viewCamera,{x:center.x,y:room.y+75},this.w,this.h,.03);c.font='600 10px Arial';c.textAlign='center';c.fillStyle=room.owner==='enemy'?'#cf947b99':'#a6c2ce66';c.fillText(String(room.index+1).padStart(2,'0')+' / '+room.name,at.x,at.y);}
  for(const u of s.units)if(u.floor===p.floor&&u.health>0&&!u.transit){const player=u.role==='player',selected=s.selectedIDs.has(u.id)||this.selected===u.id;
   if(fps&&(player||dist(p,u)>760||!lineOfSight(f,p,u)))continue;
   if(player||selected||u.role==='officer'||this.debug){const rank=rankOf(u);tag((player?'VOUS · ':'')+rank.short+' ('+rank.number+')',u,player?'#e9e9b3':TEAM_COLORS[u.team]);}
   if(healthBarEnabled(this.settings,fps?'fps':'aerial',player?'player':u.team)){const at=projectPosition(this.viewCamera,u,this.w,this.h,2.18);if(at.depth>=-1&&at.depth<=1){c.fillStyle='#142b35';c.fillRect(at.x-14,at.y,28,3);c.fillStyle=TEAM_COLORS[u.team];c.fillRect(at.x-14,at.y,28*u.health/u.maxHealth,3);}}
   if(u.stunnedUntil>s.time)tag('DÉSORIENTÉ',u,'#ecd69b',2.8);
   if(u.team==='enemy'&&s.enemyFreezeUntil>s.time)tag('STASE',u,'#a2e1ec',2.7);
   if(selected&&u.speechUntil>s.time)tag(u.speech,u,'#e8ce91',2.9);
  }
  if(!fps){
  for(const con of f.connectors)if(dist(p,con)<700){
   if(con.type==='stairs'){
    if(f.id<con.max)tag('↑ '+FLOOR_INFO[f.id+3].short+' · MONTÉE',{x:con.x-32,y:con.y+156},'#f0d093',.35);
    if(f.id>con.min)tag('↓ '+FLOOR_INFO[f.id+1].short+' · DESCENTE',{x:con.x+32,y:con.y+156},'#9cdeea',.35);
   }else tag(con.label,con,'#b4d6d7',fps?2.95:.15);
  }
  for(const sp of f.supplies)if(dist(p,sp)<420)tag(f.rooms[sp.roomIndex].owner==='enemy'?'RAVITAILLEMENT ENNEMI':'RAVITAILLEMENT ALLIÉ',sp,'#add5b7',.25);
  if(f.shop&&dist(p,f.shop)<700)tag('BOUTIQUE · CR',f.shop,'#e8cc89',1.4);
  if(f.id===-2&&dist(p,CORE)<900)tag('THE CORE · '+Math.round(s.coreControl)+' %',CORE,'#a5eced',4.3);
  if(this.nearFurniture)tag('E · '+this.nearFurniture.name,{x:this.nearFurniture.x+this.nearFurniture.w/2,y:this.nearFurniture.y+this.nearFurniture.h/2},'#e9d8a3',2.7);
  if(this.aimScreen&&s.status==='running'&&!p.transit){c.strokeStyle='#e2ebd9';c.lineWidth=1;const {x,y}=this.aimScreen;c.beginPath();c.arc(x,y,6,0,Math.PI*2);for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){c.moveTo(x+dx*9,y+dy*9);c.lineTo(x+dx*14,y+dy*14);}c.stroke();}
  }else if(this.viewBlend===1&&s.status==='running'&&p.health>0)drawFpsReticle(c,this.w,this.h,p.reload,this.aimBlend);
  drawCombatFeedback(this,c);
  if(this.viewBlend>0&&this.viewBlend<1){
   const fade=Math.sin(Math.PI*this.viewBlend)**2;
   const shade=c.createLinearGradient(0,0,0,this.h);
   shade.addColorStop(0,'#0c1824');shade.addColorStop(.48,'#263a44');shade.addColorStop(1,'#09141d');
   c.save();c.globalAlpha=.88*fade;c.fillStyle=shade;c.fillRect(0,0,this.w,this.h);c.restore();
  }
  if(p.stunnedUntil>s.time){c.fillStyle='#f8efd930';c.fillRect(0,0,this.w,this.h);}
 }
 destroy() {
  super.destroy();this.resetScene();this.dynamic?.dispose();this.resources?.dispose();
  this.heldWeapon?.dispose();this.ceiling?.geometry.dispose();this.ceiling?.material.dispose();
  if(this.lines){this.lines.geometry.dispose();this.lines.material.dispose();}
  this.gpu?.dispose();
  this.glCanvas?.removeEventListener('webglcontextlost',this.onContextLost);this.glCanvas?.remove();
 }
}
