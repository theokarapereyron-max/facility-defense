import {healthBarSettings} from './health-display.mjs';
import {MAX_PITCH} from './fps-ballistics.mjs';
import {Simulation,WEAPONS} from "./simulation.mjs";
import {Renderer3D} from "./renderer3d.mjs";
import {AudioSystem} from "./audio.mjs";
import {audioScene} from "./audio-scene.mjs";
import {controlKey,readControls,faceVertical} from "./controls.mjs";
import {slotForKey} from './items.mjs';
import {COMMANDS} from "./commands.mjs";
import {rankOf} from "./ranks.mjs";
import {dist,nearestWalkable} from "./map.mjs";
const defaults={sound:true,volume:35,music:true,musicVolume:70,voices:false,effects:true,zoom:85,inventoryCollapsed:false,mouseAim:true,compactHUD:false,reducedMotion:false,graphicsQuality:"high",renderMode:"3d",view3D:"aerial",cutawayWalls:true};
export function sanitizeSettings(value={}){
 const n={...defaults,healthBars:healthBarSettings(value.healthBars)};for(const key of Object.keys(defaults))if(typeof defaults[key]==='boolean'&&typeof value[key]==='boolean')n[key]=value[key];
 for(const [key,min,max] of [['volume',0,100],['musicVolume',0,100],['zoom',45,140]])if(typeof value[key]==='number'&&Number.isFinite(value[key]))n[key]=Math.max(min,Math.min(max,value[key]));
 if(['high','balanced'].includes(value.graphicsQuality))n.graphicsQuality=value.graphicsQuality;if(['2d','3d'].includes(value.renderMode))n.renderMode=value.renderMode;if(value.view3D==='fps')n.view3D='fps';return n;
}
function saved(k,f){try{return JSON.parse(localStorage.getItem(k)||"null")??f;}catch{return f;}}
export class Game{
 constructor(canvas,callbacks={}){
  this.canvas=canvas;this.callbacks=callbacks;this.audio=new AudioSystem();this.settings=sanitizeSettings({...defaults,compactHUD:window.innerWidth<900,reducedMotion:window.matchMedia?.("(prefers-reduced-motion: reduce)").matches||false,...saved("facility-settings-v1",{})});this.records=saved("facility-records-v1",{best:0,completed:0,played:0});this.sim=this.newSim();this.renderer=new Renderer3D(canvas,this.sim);this.keys=new Set();this.fire=false;this.fireQueued=false;this.mouse={x:0,y:0};this.mouseActive=false;this.inputEnabled=true;this.paused=false;this.touch={x:0,y:0,fire:false,angle:null};this.uiTimer=0;this.last=0;this.accumulator=0;this.alive=true;this.applySettings();this.bind();this.loop=this.loop.bind(this);this.frame=requestAnimationFrame(this.loop);
 }
 newSim(loadout="rifle"){return new Simulation({loadout,seed:Math.floor(Math.random()*4294967295)||1,onSound:(t,u)=>this.audio.sound(t,u,this.sim?.player),onEvent:e=>this.audio.announce(e),onFinish:s=>this.record(s)});}
 bind(){
  this.handlers={
   keydown:e=>{if(e.defaultPrevented||this.priorityMenuOpen)return;if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||e.target?.closest?.("[role=slider],[role=combobox],[contenteditable]"))return;const k=controlKey(e),playing=this.inputEnabled&&!this.priorityMenuOpen&&!this.paused&&this.sim.status==="running";
    // Space/Enter belong to a focused button; its focus must not swallow ZQSD or HUD shortcuts.
    if((k===' '||k==='enter')&&e.target?.closest?.('button,[role=button]'))return;
    if([" ","arrowleft","arrowright","arrowup","arrowdown"].includes(k)&&playing)e.preventDefault();if((k==='pageup'||k==='pagedown')&&playing){
     e.preventDefault();
     if(this.renderer.is3D&&!this.renderer.isFPS&&!e.shiftKey){if(!e.repeat)this.turnCamera(k==='pageup'?-1:1);}
     else this.setCommandPriority(this.sim.commandPriority+(k==='pageup'?1:-1));
     return;
    }if(e.repeat)return;
    if(k==="escape"){this.escapeCapturePaused=true;this.releaseMouse();this.clearInput();this.callbacks.onMenu?.();return;}
    if(playing&&!this.escapeCapturePaused)this.captureMouse(true);
    if(k==="m"){this.clearInput();this.callbacks.onMap?.();return;}if(!playing)return;
    if(k==='²'||e.code==='Backquote'&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
     if(this.renderer.is3D){e.preventDefault();this.toggleView(true);}
     return;
    }
    if((k==='fn'||k==='f9')&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();this.setInventoryCollapsed(!this.settings.inventoryCollapsed);return;}const slot=slotForKey(e);if(slot>=0){e.preventDefault();this.useItem(slot);return;}if(k==='home'){e.preventDefault();this.renderer.resetCamera?.();if(this.renderer.isFPS)this.renderer.pitch=0;this.mouseActive=false;return;}if(k==='tab'){e.preventDefault();this.clearInput();this.sim.activeContainer=null;this.callbacks.onInventory?.();return;}this.keys.add(k);if(k.startsWith("arrow"))this.mouseActive=false;if(!this.renderer.isFPS){faceVertical(this.sim.player,k);if((k==="arrowup"||k==="arrowdown")&&this.renderer.is3D)this.sim.player.angle-=this.renderer.yaw;}const command=COMMANDS.find(c=>c.key.toLowerCase()===k);if(command){this.command(command.type);return;}if(k===" "){this.audio.unlock();this.fireQueued=true;}if(k==='e')this.beginInteract();if(k==='r')this.sim.reload();if(k==="1"||k==="2")this.sim.swapWeapon(Number(k));if(k==="f3"){e.preventDefault();this.renderer.debug=!this.renderer.debug;this.callbacks.onDebug?.(this.renderer.debug);}if(k==="+"||k==="=")this.zoom(.1);if(k==="-")this.zoom(-.1);},
   keyup:e=>this.keys.delete(controlKey(e)),
   blur:()=>{this.clearInput();if(this.sim.status==="running"&&!this.paused){this.setPaused(true);this.callbacks.onPause?.();}},
   focus:()=>this.captureMouse(),
   autoGesture:e=>{if(e.pointerType!=='touch'&&!this.escapeCapturePaused)this.captureMouse(true);},
   pointermove:e=>{if(this.renderer.isFPS){this.dragFps(e);return;}const r=this.canvas.getBoundingClientRect();this.mouse={x:e.clientX-r.left,y:e.clientY-r.top};this.renderer.mouse=this.mouse;if(e.pointerType!=="touch")this.mouseActive=true;},
   pointerdown:e=>{if(![0,2].includes(e.button)||!this.inputEnabled||this.paused||this.sim.status!=="running")return;e.preventDefault();this.canvas.focus({preventScroll:true});this.audio.unlock();if(this.renderer.isFPS){this.fpsPointerDown(e);return;}const r=this.canvas.getBoundingClientRect();this.mouse={x:e.clientX-r.left,y:e.clientY-r.top};this.renderer.mouse=this.mouse;this.mouseActive=e.pointerType!=="touch";const p=this.renderer.screenToWorld(this.mouse.x,this.mouse.y),u=this.renderer.pickUnit?.(this.mouse.x,this.mouse.y)||this.sim.units.find(u=>u.role!=="player"&&u.floor===this.sim.player.floor&&u.health>0&&!u.transit&&dist(u,p)<30);if(this.renderer.debug&&!u){const room=this.sim.floor(this.sim.player.floor).rooms.find(r=>p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h);if(room)this.callbacks.onInspect?.({room:room.name,owner:room.owner,capture:Math.round(room.captureProgress*100)+'%'});}if(this.renderer.debug&&u){this.renderer.selected=u.id;this.callbacks.onInspect?.(this.inspect(u));}if(this.renderer.debug)return;if(e.button===0&&u?.team==='ally'){this.sim.selectUnit(u.id,e.ctrlKey||e.metaKey);this.callbacks.onUpdate?.(this.snapshot());return;}if(e.ctrlKey||e.metaKey){this.sim.selectUnit(null);return;}this.fire=true;this.canvas.setPointerCapture?.(e.pointerId);},
   pointerup:e=>{if(!this.renderer.isFPS||e?.button!==2)this.fire=false;if(e?.button!==0)this.renderer.ads=false;if(this.fpsDrag?.id===e?.pointerId)this.fpsDrag=null;},
   pointercancel:()=>{this.fire=false;this.mouseActive=false;this.renderer.ads=false;this.fpsDrag=null;},
   lockedmove:e=>{if(this.fpsLocked&&this.canLook())this.renderer.look(e.movementX,e.movementY);},
   fullscreenchange:()=>{this.renderer.resize();this.captureMouse();},
   lockchange:()=>{
    this.capturePending=false;
    if(this.fpsLocked){this.captureNeedsGesture=false;this.pointerLockFailed=false;}
    else{
     this.fire=false;this.fireQueued=false;this.renderer.ads=false;
     if(!this.releasingMouse&&this.canLook()&&globalThis.document?.hasFocus?.()!==false)this.escapeCapturePaused=true;
    }
    this.releasingMouse=false;
   },
   lockerror:()=>{this.capturePending=false;this.captureNeedsGesture=true;},
   wheel:e=>{if(this.inputEnabled){e.preventDefault();if(e.altKey)this.sim.setCommandRadius(this.sim.commandRadius+(e.deltaY<0?50:-50));else this.zoom(e.deltaY<0?.07:-.07);}},contextmenu:e=>e.preventDefault()};
  for(const k of ["keydown","keyup","blur","focus","pointerup","pointercancel"])window.addEventListener(k,this.handlers[k]);
  window.addEventListener('pointerdown',this.handlers.autoGesture);
  globalThis.document?.addEventListener?.("mousemove",this.handlers.lockedmove);
  globalThis.document?.addEventListener?.("pointerlockchange",this.handlers.lockchange);
  globalThis.document?.addEventListener?.("fullscreenchange",this.handlers.fullscreenchange);
  globalThis.document?.addEventListener?.("pointerlockerror",this.handlers.lockerror);
  for(const k of ["pointermove","pointerdown","wheel","contextmenu"])canvasListener(this.canvas,k,this.handlers[k]);
 }
 get fpsLocked(){return !!this.canvas&&globalThis.document?.pointerLockElement===this.canvas;}
 canLook(){return this.inputEnabled&&!this.paused&&this.sim.status==='running'&&this.sim.player?.health>0;}
 captureMouse(gesture=false){
  if(this.fpsLocked||this.capturePending||this.escapeCapturePaused||this.pointerLockFailed||!this.canLook()||!this.renderer.isFPS||!this.canvas?.requestPointerLock||globalThis.document?.hasFocus?.()===false||globalThis.document?.visibilityState==='hidden')return false;
  if(this.captureNeedsGesture&&!gesture)return false;
  const fail=error=>{this.capturePending=false;this.captureNeedsGesture=true;this.pointerLockFailed=error?.name==='NotSupportedError';};
  try {
   this.capturePending=true;
   const request=this.canvas.requestPointerLock();
   request?.then(()=>{this.capturePending=false;if(!this.canLook()||!this.renderer.isFPS||this.escapeCapturePaused)this.releaseMouse();},fail);
   if(this.fpsLocked)this.capturePending=false;
   return true;
  }catch(error){fail(error);return false;}
 }
 retryMouseCapture(){this.escapeCapturePaused=false;this.captureNeedsGesture=false;this.pointerLockFailed=false;this.canvas.focus({preventScroll:true});this.captureMouse(true);}
 releaseMouse(){if(this.fpsLocked){this.releasingMouse=true;globalThis.document?.exitPointerLock?.();}}
 turnCamera(direction){this.renderer.rotateCamera?.(direction);this.mouseActive=false;}
 toggleView(capture=false){
  if(!this.renderer.is3D)return;
  this.setSettings({view3D:this.renderer.isFPS?'aerial':'fps'});
  if(capture&&this.renderer.isFPS)this.captureMouse();
 }
 fpsPointerDown(event){
  if(!this.canLook())return;
  const {button,pointerId,clientX,clientY,pointerType}=event;
  if(button===0&&(event.ctrlKey||event.metaKey||this.renderer.debug)){
   const u=this.renderer.pickUnit(this.renderer.w/2,this.renderer.h/2);
   if(this.renderer.debug&&u){this.renderer.selected=u.id;this.callbacks.onInspect?.(this.inspect(u));}
   else if(!this.renderer.debug){this.sim.selectUnit(u?.team==='ally'?u.id:null,true);this.callbacks.onUpdate?.(this.snapshot());}
   return;
  }
  if(this.fpsLocked){
   if(button===0&&this.sim.liftButtonAt?.(this.renderer.pitch)){this.interact();return;}
   if(button===0){this.fire=true;this.fireQueued=true;}else this.renderer.ads=true;return;
  }
  if(pointerType!=='touch'&&button===0){this.escapeCapturePaused=false;if(this.captureMouse(true))return;}
  this.fpsDrag={id:pointerId,x:clientX,y:clientY};
  this.canvas.setPointerCapture?.(pointerId);
  if(pointerType!=='touch'){if(button===0){this.fire=true;this.fireQueued=true;}else this.renderer.ads=true;}
 }
 dragFps(event){
  const drag=this.fpsDrag;
  if(this.fpsLocked||!this.canLook()||drag?.id!==event.pointerId)return;
  this.renderer.look(event.clientX-drag.x,event.clientY-drag.y);
  drag.x=event.clientX;drag.y=event.clientY;
 }
 snapshot(){return {...this.sim.snapshot(),rendererMode:this.renderer.activeMode,rendererWarning:this.renderer.failureReason,renderStats:this.renderer.stats,fpsLocked:this.fpsLocked,fpsDragOnly:this.pointerLockFailed||!this.canvas?.requestPointerLock};}
 start(loadout="rifle"){this.audio.unlock();if(this.sim.status!=="ready"){this.sim=this.newSim(loadout);this.renderer.sim=this.sim;this.renderer.mapCache.clear();this.renderer.surfaceCache.clear();this.renderer.routeAt=null;}this.sim.options.loadout=loadout;this.sim.player.weapon=loadout;this.sim.player.mag=WEAPONS[loadout].magazineSize;this.sim.player.reserve=WEAPONS[loadout].maxReserve;this.sim.player.inventory={};this.paused=false;this.inputEnabled=true;this.clearInput();this.renderer.waypoint=null;this.renderer.pitch=0;this.audio.reset();this.sim.start();this.audio.update(audioScene(this.sim));this.canvas.focus({preventScroll:true});this.escapeCapturePaused=false;this.captureMouse(true);this.callbacks.onUpdate?.(this.snapshot());}
 loop(now){
  if(!this.alive)return;const dt=Math.min(.1,(now-(this.last||now))/1000);this.last=now;this.accumulator+=dt;
  if(!this.paused&&this.sim.status==="running"){
   let aimInWorld=false;let input=this.inputEnabled&&!this.priorityMenuOpen?readControls(this.keys,this.touch,this.sim.player.turnMode):{};if(this.inputEnabled&&!this.priorityMenuOpen){
    if(this.fireQueued||this.fire)input.fire=true;
    if(this.renderer.isFPS){
     input.turn=Number(this.keys.has('arrowright'))-Number(this.keys.has('arrowleft'));
     delete input.angle;
     if(this.canLook()&&!(this.sim.player.stunnedUntil>this.sim.time)){
      const vertical=Number(this.keys.has('arrowup'))-Number(this.keys.has('arrowdown'));
      this.renderer.pitch=Math.max(-MAX_PITCH,Math.min(MAX_PITCH,this.renderer.pitch+vertical*dt*1.6));
     }
    }
    if(!this.renderer.isFPS&&this.settings.mouseAim&&this.mouseActive&&!this.keys.has('arrowleft')&&!this.keys.has('arrowright')&&!this.touch.fire){this.renderer.aimScreen={...this.mouse};const w=this.renderer.aimToWorld?this.renderer.aimToWorld(this.mouse.x,this.mouse.y):this.renderer.screenToWorld(this.mouse.x,this.mouse.y);if(dist(w,this.sim.player)>12){input.angle=Math.atan2(w.y-this.sim.player.y,w.x-this.sim.player.x);aimInWorld=true;}}
   }
   if(this.renderer.transformInput) {const angle=input.angle;input=this.renderer.transformInput(input);if(aimInWorld&&Number.isFinite(angle))input.angle=angle;}
   let i=0;while(this.accumulator>=1/30&&i++<4){this.sim.tick(1/30,input);this.accumulator-=1/30;this.fireQueued=false;}
  }else this.accumulator=0;
  if(this.fpsLocked&&(!this.renderer.isFPS||!this.canLook()))this.releaseMouse();
  if(!this.escapeCapturePaused)this.captureMouse?.();
  this.renderer.render(this.settings.reducedMotion?0:dt);this.uiTimer+=dt;if(this.uiTimer>.12){this.uiTimer=0;this.audio.update(audioScene(this.sim,this.paused));this.callbacks.onUpdate?.(this.snapshot());if(this.renderer.selected){const u=this.sim.units.find(a=>a.id===this.renderer.selected);if(u)this.callbacks.onInspect?.(this.inspect(u));}this.callbacks.onFrame?.();}this.frame=requestAnimationFrame(this.loop);
 }
 setCommandPriority(value){this.sim.setCommandPriority(value);this.callbacks.onUpdate?.(this.snapshot());}
 command(type,room){if(type==="DEFEND_ZONE"&&!room){this.clearInput();this.callbacks.onCommandRoom?.();return;}const r=this.sim.command(type,room);this.callbacks.onUpdate?.(this.snapshot());return r;}
 useItem(index,options){this.audio.unlock();const result=this.sim.useItem(index,options);this.callbacks.onUpdate?.(this.snapshot());if(result.selection==='room'){this.clearInput();this.callbacks.onItemRoom?.(index);}return result;}
 beginInteract(touch=false){if(!this.inputEnabled||this.paused)return;this.interact();}
 interact(){const c=this.sim.interact(this.renderer.isFPS?this.renderer.pitch:undefined);if(c){this.setInput(false);if(c.type==="shop")this.callbacks.onShop?.(c);else if(c.type==="furniture")this.callbacks.onInventory?.();else this.callbacks.onInteract?.(c);this.callbacks.onUpdate?.(this.snapshot());}}
 setPaused(v){this.paused=v;if(v)this.releaseMouse();this.clearInput();this.audio.update(audioScene(this.sim,v));if(!v){this.escapeCapturePaused=false;this.captureMouse(!!globalThis.navigator?.userActivation?.isActive);}}
 setInput(v){this.inputEnabled=v;if(!v)this.releaseMouse();this.clearInput();if(v)this.captureMouse(!!globalThis.navigator?.userActivation?.isActive);}
 setInventoryCollapsed(value){this.settings={...this.settings,inventoryCollapsed:!!value};try{localStorage.setItem('facility-settings-v1',JSON.stringify(this.settings));}catch{}this.callbacks.onSettings?.({...this.settings});}
 clearInput(){this.keys.clear();this.fire=false;this.fireQueued=false;this.mouseActive=false;this.fpsDrag=null;if(this.renderer){this.renderer.aimScreen=null;this.renderer.ads=false;}this.touch={x:0,y:0,fire:false,angle:null};}
 zoom(v){this.renderer.zoom=Math.min(1.45,Math.max(.42,this.renderer.zoom+v));}
 setSettings(s){const oldZoom=this.settings.zoom,wasFPS=this.renderer.isFPS;this.settings=sanitizeSettings({...this.settings,...s});try{localStorage.setItem("facility-settings-v1",JSON.stringify(this.settings));}catch{}this.applySettings(oldZoom);if(wasFPS!==this.renderer.isFPS){
  const movement=[...this.keys].filter(key=>['z','q','s','d','shift'].includes(key));
  const {x,y}=this.touch||{};
  this.releaseMouse();this.clearInput();
  for(const key of movement)this.keys.add(key);
  this.touch.x=x||0;this.touch.y=y||0;
  this.renderer.ads=false;this.renderer.aimBlend=0;
 }this.captureMouse(!!globalThis.navigator?.userActivation?.isActive);this.callbacks.onSettings?.({...this.settings});}
 applySettings(oldZoom=null){this.audio.setSettings(this.settings);this.renderer.settings=this.settings;if(oldZoom!==this.settings.zoom)this.renderer.zoom=this.settings.zoom/100;this.renderer.resize();}
 markMap(floor,x,y){this.renderer.waypoint=nearestWalkable(this.sim.floor(floor),x,y);this.renderer.routeAt=null;return {...this.renderer.waypoint};}
 record(s){this.records.best=Math.max(this.records.best,s.score);this.records.played++;if(s.status==="ended")this.records.completed++;try{localStorage.setItem("facility-records-v1",JSON.stringify(this.records));}catch{}this.callbacks.onFinish?.(s);}
 inspect(u){return {id:u.id,name:u.name||u.role.toUpperCase()+" "+u.id,rank:rankOf(u).name,number:rankOf(u).number,type:u.team,state:u.state,order:u.currentOrder,priority:u.orderPriority,target:u.target,floor:u.floor,health:Math.ceil(u.health),nodes:u.path.length,officer:u.officerID,connector:u.connector,reason:u.orderReason||"",scores:u.orderScores?.map(s=>s.order+":"+s.score).join(" / ")||""};}
 destroy(){this.alive=false;this.releaseMouse();
  globalThis.document?.removeEventListener?.("mousemove",this.handlers.lockedmove);
  globalThis.document?.removeEventListener?.("pointerlockchange",this.handlers.lockchange);
  globalThis.document?.removeEventListener?.("fullscreenchange",this.handlers.fullscreenchange);
  globalThis.document?.removeEventListener?.("pointerlockerror",this.handlers.lockerror);
  window.removeEventListener('pointerdown',this.handlers.autoGesture);
  cancelAnimationFrame(this.frame);this.renderer.destroy();this.audio.destroy();for(const k of ["keydown","keyup","blur","focus","pointerup","pointercancel"])window.removeEventListener(k,this.handlers[k]);for(const k of ["pointermove","pointerdown","wheel","contextmenu"])this.canvas.removeEventListener(k,this.handlers[k]);}
}
function canvasListener(canvas,k,fn){canvas.addEventListener(k,fn,k==="wheel"?{passive:false}:undefined);}
