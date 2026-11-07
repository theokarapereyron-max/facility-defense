import {impactMaterial} from './impact-material.mjs';
import {createAirlift,updateAirlift,updateAirPassenger} from './airlift.mjs';
import {ACTOR_HEIGHT, EYE_HEIGHT, MAX_PITCH, fpsRay, heightEntry} from './fps-ballistics.mjs';
import {TILE} from './world-config.mjs';
import {STAIR_RISE,stairFootprint,stairSurface,stairCanStep,stairRoute} from './stairs.mjs';
import {createElevators,callLift,selectLiftFloor,boardLift,updateElevators,navigateLift} from './elevators.mjs';
import {insideLift,liftDocked,liftPassengerCanMove,liftPanelHit,liftOffset,liftDisplay} from './lift-geometry.mjs';
import {reportFailingDefence} from './squad-tactics.mjs';
import {clearFireLane,combatPosition,retreatPosition,medicalPosition} from './combat-tactics.mjs';
import {fieldIntel} from './field-intel.mjs';
import {knownHostile,tacticalContact,visionRange,spotUnit,reportedHostiles} from './contacts.mjs';
import {canUseLift} from './lift-access.mjs';
import {FLOOR_INFO,CONNECTORS,CORE,ROOF_FLOOR,createFacility,dist,point,canStand,nearestWalkable,zoneAt} from "./map.mjs";
import {PathfindingSystem,SpatialHash,raycast,lineOfSight} from "./navigation.mjs";
import {commandOfficer} from "./officers.mjs";
import {RANKS,rankOf,canCommand,awardKill,demote} from './ranks.mjs';
import {COMMANDS,RADIUS,clearOrder,commandTargets,issueCommand,selectedStats,formationPoint} from './commands.mjs';
import {randomDelay,spawnHostiles,reinforceAllies,directEvents,commandEnemyOfficer} from './director.mjs';
import {useItem,transferItem,takeAll,collectCredits,openFurniture,nearbyFurniture,dropInventory,updateInventory,inventorySnapshot} from './inventory.mjs';
import {setupServices,RELIEF_LIMIT} from './services.mjs';
import {nearbyShop,buyItem,shopSnapshot} from './shops.mjs';
import {enemyFrozen,npcCanSee} from './special-items.mjs';
import {priorityValue} from './priorities.mjs';
import {waveSummary} from './wave-status.mjs';
import {supplyStatus} from './room-state.mjs';
import {updateRoomControl,healAtSupplies,usableSupply,resupplyGoal,autonomousRoomGoal,roomSnapshot} from './room-control.mjs';
import {updateDoors,setDoorLock,setDoorAction,doorPanel,nearbyDoorContext} from './doors.mjs';
export const WEAPONS={
rifle:{name:"AR-4",label:"Fusil d’assaut",damage:24,fireRate:.13,range:880,accuracy:.045,magazineSize:60,maxReserve:480,reloadTime:2,pellets:1},
pistol:{name:"P-9",label:"Pistolet",damage:30,fireRate:.3,range:650,accuracy:.055,magazineSize:24,maxReserve:192,reloadTime:1.2,pellets:1},
smg:{name:"V-21",label:"Mitraillette",damage:16,fireRate:.075,range:580,accuracy:.09,magazineSize:72,maxReserve:480,reloadTime:1.6,pellets:1},
shotgun:{name:"SG-8",label:"Fusil à pompe",damage:14,fireRate:.65,range:440,accuracy:.2,magazineSize:16,maxReserve:480,reloadTime:2.7,pellets:7},
marksman:{name:"DMR-6",label:"Précision",damage:68,fireRate:.85,range:1250,accuracy:.012,magazineSize:20,maxReserve:480,reloadTime:2.5,pellets:1},
heavy:{name:"LMG-60",label:"Mitrailleuse",damage:29,fireRate:.16,range:1000,accuracy:.075,magazineSize:120,maxReserve:480,reloadTime:3.6,pellets:1}};
const NAMES=["MOREAU","PARK","REYES","DIALLO","VOLKOV","CHEN","SILVA","BAUER"];
export class Simulation{
 constructor(options={}){
  this.options=options;this.seed=options.seed||14812;this.floors=createFacility(this.seed);this.pathfinding=new PathfindingSystem();this.spatial=new SpatialHash();
  this.units=[];this.nextID=1;this.time=0;this.duration=Infinity;this.coreControl=100;this.coreState="SECURE";this.alert=0;this.status="ready";
  this.nextLevelTwo=300;this.nextLevelTwoInsertion=0;this.pendingLevelTwo=[];this.levelTwoSerial=0;this.nextEnemyEvent=110+Math.floor(this.random()*101);this.enemyCommsUntil=0;this.enemyEvent=null;
  this.moneyEvents=[];this.moneySerial=0;this.shopFeedback=null;this.fields=[];this.enemyFreezeUntil=0;this.coreShieldUntil=0;this.activeMajorWaves=[];this.wavesReceived=0;this.wavesRepelled=0;this.activeContainer=null;this.itemSerial=0;this.itemFeedback=null;this.projectiles=[];this.projectileSerial=0;this.supportRequests=[];this.supportSerial=0;this.scans={};this.lastCombatAt={};this.nextInsertion=0;this.pendingWaves=[];this.nextRoofAttack=30;this.pendingRoof=[];this.squadSerial=0;this.commandRadius=250;this.commandPriority=6;this.selectedIDs=new Set();this.xpEvents=[];this.xpSerial=0;this.promotion=null;this.deathPenalty=null;this.commandFeedback=null;this.roofWaves=0;this.events=[];this.decals=[];this.combatStreak=0;this.lastPlayerKill=-100;this.traces=[];this.effects=[];this.casualties=[];this.kills=0;this.deaths=0;this.ordersCompleted=0;this.zonesDefended=0;this.nextAttack=randomDelay(this,"enemy");this.nextReinforce=randomDelay(this,"ally");
  this.director={threatPoints:20,lastMajor:-90,attackIndex:0,spent:0};this.nextRoomCapture=.25;this.officerOrder=null;this.doorClock=0;this.strategyClock=0;this.respawnIn=0;this.pendingPlayerLift=null;
  this.metrics={floorChanges:0,elevatorRides:0,officerOrders:0,doorBreaches:0,shots:0,coreEntries:0,stuckRecoveries:0,enemyOrders:0};
  this.elevators=createElevators(CONNECTORS);
  this.airlift=createAirlift();this.floor(ROOF_FLOOR).airlift=this.airlift;
  for(const floor of this.floors)floor.elevators=this.elevators.filter(l=>floor.id>=l.min&&floor.id<=l.max);
  this.player=this.makeUnit("ally","player",point(79,86,0));Object.assign(this.player,{rank:0,xp:0,credits:0,paidRank:0,turnMode:"up",speed:205,weapon:options.loadout||"rifle",inventory:{},items:[{item:"grenade",count:2},{item:"bandage",count:2},{item:"ammo",count:1}],armor:0,kills:0});this.player.mag=WEAPONS[this.player.weapon].magazineSize;this.player.reserve=WEAPONS[this.player.weapon].maxReserve;
  setupServices(this);this.seedAllies();this.spatial.build(this.units);
 }
 random(){let t=this.seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
 floor(id){return this.floors[id+2];}
 log(title,detail="",severity="info",floor=null){const e={id:this.time+"-"+this.events.length,time:this.time,title,detail,severity,floor};this.events.unshift(e);this.events=this.events.slice(0,60);this.options.onEvent?.(e);}
 makeUnit(team,role,pos,rankOverride){
  const p=nearestWalkable(this.floor(pos.floor),pos.x,pos.y),weapon=role==="heavy"?"heavy":role==="marksman"?"marksman":["assault","commando"].includes(role)?"smg":"rifle";
  const u={id:this.nextID++,team,role,...p,health:role==="heavy"?170:100,maxHealth:role==="heavy"?170:100,speed:role==="heavy"?94:["assault","commando"].includes(role)?150:120,radius:11,angle:-Math.PI/2,weapon,mag:WEAPONS[weapon].magazineSize,reserve:Infinity,magazineSize:WEAPONS[weapon].magazineSize,reload:0,shotCooldown:0,target:null,state:"DEFEND",path:[],pathGoal:null,pathTime:0,goal:null,homePosition:{...p},homeZone:zoneAt(this.floor(p.floor),p.x,p.y),currentOrder:"NORMAL",orderPriority:0,orderUntil:0,officerID:null,route:[],routeIndex:0,nextThink:this.random()*.5,nextOfficer:0,visionRange:role==="marksman"?1150:800,seenAt:-100,spawnTime:this.time,moveDistance:0,stuckTimer:0,lastProgress:{...p},connector:null,connectorCooldown:0,transit:null,coverId:null,coverUntil:0,speech:"",speechUntil:0,deadTime:0,orderSerial:0,waitForLift:0,patrolAt:5+this.random()*10,patrolOffset:80};
  const ranges={player:[0,0],officer:[20,23],heavy:[3,10],marksman:[4,12],medic:[4,10],commando:[10,18]},range=ranges[role]||[0,7];const rolledRank=range[0]+Math.floor(this.random()*(range[1]-range[0]+1));u.rank=Number.isInteger(rankOverride)?Math.max(0,Math.min(29,rankOverride)):rolledRank;
  if(role!=="player"){u.maxHealth+=u.rank*2;u.health=u.maxHealth;u.speed*=1+u.rank*.003;}u.name=role==='officer'?'OFFICIER '+u.id:'UNITÉ '+u.id;
  this.units.push(u);return u;
 }
 seedAllies(){
  const points={"-2":[[97,25],[96,33],[109,34],[85,34],[81,57],[114,85]],"-1":[[46,74],[41,75],[46,65],[81,90],[112,85]],"0":[[77,97],[83,97],[80,93],[73,89],[89,89],[114,84],[46,58],[79,72],[85,80],[77,104]],"1":[[80,56],[46,36],[114,89],[81,86]],"2":[[80,72],[46,34],[115,83],[81,56]],"3":[[80,56],[46,34],[114,89],[79,86]],"4":[[80,72],[46,56],[114,89],[81,85]],"5":[[83,72],[91,78],[112,87]]};
  for(const [floor,positions] of Object.entries(points))positions.forEach(([x,y],i)=>{const role=i===0?"officer":i===2?"heavy":i===3?"marksman":i===4?"medic":"soldier",u=this.makeUnit("ally",role,point(x,y,Number(floor)),role==="officer"?({"-2":22,"-1":21,"0":22,"1":20,"2":25,"3":22,"4":23,"5":21}[floor]):undefined);if(role==="officer")u.name=NAMES[Number(floor)+2];u.patrolOffset=i%2?80:-80;});
 }
 start(){if(this.status!=="ready")return;this.status="running";this.alert=1;this.log("CONTACT — MAIN GATE","Une escouade approche du checkpoint.","danger",0);this.spawnSquad("alpha",12);this.log("DÉFENDEZ L’INSTALLATION","Défense sans limite de durée. Le Core doit rester sous contrôle.");}
 spawnSquad(route,count){return spawnHostiles(this,route,count);}
 useItem(index,options){return useItem(this,index,options);}
 collectCredits(){return collectCredits(this);}
 buyItem(shopID,item,quantity=1,expectedPrice=null){return buyItem(this,shopID,item,quantity,expectedPrice);}
 transferItem(direction,index,amount){return transferItem(this,direction,index,amount);}
 takeAll(){return takeAll(this);}
 openFurniture(id){return openFurniture(this,id);}
 setCommandPriority(value){this.commandPriority=priorityValue(value);}
 setCommandRadius(value){this.commandRadius=Math.max(RADIUS.min,Math.min(RADIUS.max,Math.round(value/RADIUS.step)*RADIUS.step));}
 selectUnit(id,add=false){const u=this.units.find(u=>u.id===id&&u.health>0&&u.role!=="player"&&u.team==='ally');if(!add)this.selectedIDs.clear();if(u){if(add&&this.selectedIDs.has(id))this.selectedIDs.delete(id);else this.selectedIDs.add(id);}}
 command(type,room){return issueCommand(this,type,room);}
 supplyOptions(){return this.floors.flatMap(f=>f.supplies.map(p=>({...p,...supplyStatus(this,f,p),danger:this.units.filter(u=>u.team==='enemy'&&u.health>0&&!u.transit&&u.floor===f.id&&dist(u,p)<450).length})));}
 setDoorLock(id,mode){return setDoorLock(this,this.player,id,mode);}
 setDoorAction(id,action){return setDoorAction(this,this.player,id,action);}
 doorPanel(index){return doorPanel(this,index);}

 tick(dt,input={}){
  if(this.status!=="running")return;this.time+=dt;updateAirlift(this,dt,spawnHostiles);
  this.traces=this.traces.filter(t=>(t.life-=dt)>0);this.effects=this.effects.filter(t=>(t.life-=dt)>0);this.decals=this.decals.filter(d=>d.until>this.time).slice(-260);this.casualties=this.casualties.filter(c=>this.time-c.time<35);this.spatial.build(this.units);this.updateElevators(dt);
  if(this.time>=this.nextRoomCapture){updateRoomControl(this,.25);this.nextRoomCapture+=.25;}
  this.doorClock-=dt;if(this.doorClock<=0){this.updateDoors(.12);this.doorClock=.12;}this.updatePlayer(dt,input);updateInventory(this,dt);
  for(const u of this.units){
   if(u.health<=0||u.role==="player")continue;u.shotCooldown=Math.max(0,u.shotCooldown-dt);u.connectorCooldown=Math.max(0,u.connectorCooldown-dt);
   if(u.reload>0){u.reload-=dt;if(u.reload<=0)u.mag=WEAPONS[u.weapon].magazineSize;}
   if(u.airInsertion){if(!(u.stunnedUntil>this.time)&&!enemyFrozen(this,u))updateAirPassenger(this,u,dt);continue;}
   if(u.airEvadingUntil>this.time)continue;
   if(u.transit){
    const enemy=this.units.find(e=>e.transit===u.transit&&e.health>0&&e.team!==u.team);
    if(enemy){u.angle=Math.atan2(enemy.y-u.y,enemy.x-u.x);this.shoot(u,u.angle);}
    continue;
   }
   if(u.stunnedUntil>this.time||enemyFrozen(this,u)){u.state="STUNNED";continue;}
   if(this.time>=u.nextThink){this.think(u);u.nextThink=this.time+.35+this.random()*.2;}
   if(u.role==="officer"&&this.time>=u.nextOfficer){if(u.team==="ally")this.officerThink(u);else commandEnemyOfficer(this,u);u.nextOfficer=this.time+2;}
   if(u.role==="medic"){u.healTarget=null;for(const a of this.spatial.nearby(u.floor,u.x,u.y,120))if(a.team===u.team&&a.health>0&&!a.transit&&a.health<a.maxHealth&&lineOfSight(this.floor(u.floor),u,a)){a.health=Math.min(a.maxHealth,a.health+dt*(u.team==='enemy'&&u.medicalBoostUntil>this.time?8:4));if(a.id!==u.id)u.healTarget=a.id;}}
   const target=this.units.find(t=>t.id===u.target);if(target&&target.health>0&&!target.transit&&target.floor===u.floor){u.angle=Math.atan2(target.y-u.y,target.x-u.x);if(dist(u,target)<WEAPONS[u.weapon].range&&npcCanSee(this,u,target)&&clearFireLane(this,u,target))this.shoot(u,u.angle);}
   if(u.goal||u.stairRoute||u.liftPlan)this.navigate(u,u.goal,dt);
   if(u.team==="enemy"&&u.floor===-2&&dist(u,CORE)<200&&!u.countedCore){u.countedCore=true;this.metrics.coreEntries++;}
  }
  healAtSupplies(this,dt);this.updateCore(dt);this.strategyClock-=dt;if(this.strategyClock<=0){this.updateZones();this.directEvents();this.strategyClock=1;}
  this.units=this.units.filter(u=>u.role==="player"||u.health>0||this.time-u.deadTime<4);
 }
 updatePlayer(dt,input){
  const p=this.player;p.shotCooldown=Math.max(0,p.shotCooldown-dt);p.connectorCooldown=Math.max(0,p.connectorCooldown-dt);
  if(p.health<=0){this.respawnIn=Math.max(0,this.respawnIn-dt);return;}
  if(p.reload>0){p.reload-=dt;if(p.reload<=0){const n=Math.min(WEAPONS[p.weapon].magazineSize-p.mag,p.reserve);p.mag+=n;p.reserve-=n;}}
  if(p.stunnedUntil>this.time)return;if(this.time>=p.nextThink){this.perceive(p);p.nextThink=this.time+.4;}if(Number.isFinite(input.angle))p.angle=input.angle;else if(input.turn)p.angle=Math.atan2(Math.sin(p.angle+input.turn*2.65*dt),Math.cos(p.angle+input.turn*2.65*dt));
  let dx=input.x||0,dy=input.y||0;
  if(input.relativeMovement){const forward=-dy, strafe=dx;dx=Math.cos(p.angle)*forward-Math.sin(p.angle)*strafe;dy=Math.sin(p.angle)*forward+Math.cos(p.angle)*strafe;}
  const len=Math.hypot(dx,dy);if(len){const speed=p.speed*(input.sprint?1.48:1)*(p.speedBoostUntil>this.time?1.25:1);this.move(p,dx/len*speed*dt,dy/len*speed*dt);}
  if(input.fire&&!input.sprint)this.shoot(p,p.angle,input.shotPitch);if(input.reload)this.reload(p);
  if(this.pendingPlayerLift){const l=this.elevators.find(l=>l.id===this.pendingPlayerLift.id);if(!l||dist(p,l)>160||!canUseLift(this,l,p.floor,p.team,this.pendingPlayerLift.target))this.pendingPlayerLift=null;else this.board(p,l,this.pendingPlayerLift.target);}
  if(this.officerOrder&&!this.officerOrder.completed&&p.floor===this.officerOrder.floor&&dist(p,this.officerOrder)<160&&this.time-this.officerOrder.time>3){this.officerOrder.completed=true;this.ordersCompleted++;this.log("POSITION REJOINTE","Ordre de "+this.officerOrder.officer+" accompli.","success",p.floor);}
 }
 move(u,dx,dy){
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
  // Check the whole displacement, so sprinting cannot skip a thin wall or railing.
  const nearStairs=u.stairTravel||this.floor(u.floor).connectors.some(c=>c.type==='stairs'&&Math.min(u.x,u.x+dx)<c.x+96&&Math.max(u.x,u.x+dx)>c.x-96&&Math.min(u.y,u.y+dy)<c.y+176&&Math.max(u.y,u.y+dy)>c.y-176);
  const nearLift=u.cabin||this.elevators.some(l=>Math.min(u.x,u.x+dx)<l.x+80&&Math.max(u.x,u.x+dx)>l.x-80&&Math.min(u.y,u.y+dy)<l.y+90&&Math.max(u.y,u.y+dy)>l.y-80);
  const nearAircraft=u.floor===ROOF_FLOOR&&this.airlift.flight;
  const steps=nearStairs||nearLift||nearAircraft?Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(2,(u.radius||11)/2))):1;
  for(let i=0;i<steps;i++)this.moveStep(u,dx/steps,dy/steps);
 }
 moveStep(u,dx,dy){
  const f=this.floor(u.floor),x=u.x,y=u.y;
  const stair=f.connectors.find(c=>c.type==='stairs'&&(c.id===u.stairTravel?.id||stairFootprint(c,x+dx,y+dy,16)));
  if(stair&&!u.transit){
   const inside=stairFootprint(stair,x+dx,y+dy);
   if(!u.stairTravel&&inside){
    // The two entrances share the south landing. Left ascends, right descends.
    if(y<stair.y+112||Math.abs(x-stair.x)<14)return;
    const base=u.floor-(x>stair.x?1:0);
    if(base<stair.min||base>=stair.max)return;
    u.stairTravel={id:stair.id,base};
   }
   if(u.stairTravel){
    if(stairCanStep(u,stair,x+dx,y)&&canStand(f,x+dx,y,u.radius))u.x+=dx;
    if(stairCanStep(u,stair,u.x,y+dy)&&canStand(f,u.x,y+dy,u.radius))u.y+=dy;
    u.moveDistance+=Math.hypot(u.x-x,u.y-y);
    u.stairHeight=u.stairTravel.base*STAIR_RISE+stairSurface(u.x-stair.x,u.y-stair.y)-u.floor*STAIR_RISE;
    if(u.y>=stair.y+112){
     const target=u.stairTravel.base+(u.x>stair.x?1:0),px=u.x,py=u.y;
     if(target!==u.floor){this.changeFloor(u,target,stair);u.x=px;u.y=py;}
     u.stairTravel=null;u.stairHeight=0;
    }
    return;
   }
  }
  const lift=this.elevators.find(l=>l.id===u.cabin||Math.abs(l.x-x)<100&&Math.abs(l.y-y)<110);
  const allowed=(px,py)=>{
   if(lift&&u.cabin===lift.id&&lift.moving)return liftPassengerCanMove(u,lift,px,py);
   return canStand(f,px,py,u.radius);
  };
  if(allowed(u.x+dx,u.y))u.x+=dx;
  if(allowed(u.x,u.y+dy))u.y+=dy;
  u.moveDistance+=Math.hypot(x-u.x,y-u.y);
  if(lift){
   if(insideLift(lift,u.x,u.y)&&liftDocked(lift,u.floor)){
    u.cabin=lift.id;
    if(!lift.occupants.includes(u.id))lift.occupants.push(u.id);
   }else if(u.cabin===lift.id&&!lift.moving&&!insideLift(lift,u.x,u.y)){
    u.cabin=null;u.transit=null;lift.occupants=lift.occupants.filter(id=>id!==u.id);
   }
  }
 }
 shoot(u,a,pitch){
  const w=WEAPONS[u.weapon];if(u.reload>0||u.shotCooldown>0||u.health<=0||u.stunnedUntil>this.time||enemyFrozen(this,u))return;if(u.mag<=0){this.reload(u);return;}
  u.lastShotAt=this.time;u.mag--;this.decals.push({x:u.x-Math.sin(a)*13,y:u.y+Math.cos(a)*13,floor:u.floor,type:'casing',angle:a+this.random(),until:this.time+35});u.shotCooldown=w.fireRate*(u.role==="player"?(u.fireBoostUntil>this.time?.65:1):(1.9+this.random()*.8)*(u.team==='enemy'&&u.assaultBoostUntil>this.time?.8:1));this.metrics.shots++;
  const opponent=this.units.find(e=>e.id===u.target&&e.health>0&&e.team!==u.team&&e.floor===u.floor);if(opponent&&lineOfSight(this.floor(u.floor),u,opponent))this.lastCombatAt[u.floor]=this.time;
  let spread=w.accuracy+(u.role==="player"?0:u.team==="enemy"?.22:.12);if(u.team==="enemy"&&this.spatial.nearby(u.floor,u.x,u.y,450).some(a=>a.team==="enemy"&&a.role==="officer"))spread*=.85;
  for(let pellet=0;pellet<w.pellets;pellet++){
   const angle=a+(this.random()-.5)*spread*2,dx=Math.cos(angle),dy=Math.sin(angle);
   const firstPerson=u.role==='player'&&Number.isFinite(pitch), muzzleOffset=firstPerson?0:17;
   const x=u.x+dx*muzzleOffset,y=u.y+dy*muzzleOffset,floor=this.floor(u.floor);
   const cabin=this.elevators.find(l=>l.id===u.transit&&l.moving);
   const vertical=firstPerson?(cabin?{height:EYE_HEIGHT,slope:Math.tan(pitch)/TILE,distance:w.range,material:'metal'}:fpsRay(floor,x,y,dx,dy,Math.max(-MAX_PITCH,Math.min(MAX_PITCH,pitch)),w.range)):null;
   const flat=vertical?null:cabin?{d:w.range,wall:false}:raycast(floor,x,y,angle,w.range);
   let victim=null,nearest=vertical?.distance??flat.d;
   // Compare surface entry for both soldiers and equipment, never a center against a surface.
   if(cabin){
    const wallX=cabin.x+Math.sign(dx)*40,wallY=cabin.y+(dy<0?-40:44);
    nearest=Math.min(nearest,Math.abs(dx)>1e-6?(wallX-x)/dx:Infinity,Math.abs(dy)>1e-6?(wallY-y)/dy:Infinity);
    if(vertical&&Math.abs(vertical.slope)>1e-8)nearest=Math.min(nearest,((vertical.slope>0?2.7:0)-vertical.height)/vertical.slope);
    nearest=Math.max(0,nearest);
   }
   const targets=cabin?this.units.filter(e=>e.transit===cabin.id):this.spatial.nearby(u.floor,u.x,u.y,w.range);
   for(const e of targets){if(e.team===u.team||e.health<=0||(!cabin&&e.transit))continue;const ex=e.x-x,ey=e.y-y,along=ex*dx+ey*dy,perp=Math.abs(ex*dy-ey*dx),radius=e.radius+4;if(along<=0||perp>=radius)continue;const half=Math.sqrt(radius*radius-perp*perp);const entry=heightEntry(vertical,Math.max(0,along-half),along+half,0,ACTOR_HEIGHT);if(entry<nearest){nearest=entry;victim=e;}}
   const ex=x+dx*nearest,ey=y+dy*nearest;
   const offset=cabin?liftOffset(cabin,u.floor):0;
   const elevation=vertical?{height:vertical.height+offset,endHeight:vertical.height+offset+vertical.slope*nearest}:cabin?{height:offset+.95,endHeight:offset+.95}:{};
   const material=cabin?'metal':vertical?vertical.material:flat.wall?impactMaterial(floor,ex,ey):null;
   this.traces.push({x,y,ex,ey,...elevation,floor:u.floor,team:u.team,life:.11,max:.11,player:u.role==='player'});
   if(!victim&&material)this.decals.push({x:ex,y:ey,floor:u.floor,type:'impact',angle:a,until:this.time+45});
   if(victim||material){
    const life=material==='concrete'?.36:material==='glass'?.32:.22;
    this.effects.push({x:ex-dx*2,y:ey-dy*2,height:elevation.endHeight,floor:u.floor,type:victim?'hit':'spark',material,angle,life,max:life});
   }
   if(victim){this.lastCombatAt[u.floor]=this.time;let damage=w.damage*(u.role==="player"?1:u.team==="ally"?.78:.48);const dealt=this.damage(victim,damage,u);if(u.role==='player'&&dealt>0)this.hitFeedback={time:this.time,kill:victim.health<=0};}
  }this.options.onSound?.("shot",u);
 }
 damage(victim,amount,attacker){
  if(victim.health<=0||victim.transit&&victim.transit!==attacker?.transit||!(amount>0))return 0;
  if(victim.role==='player'&&this.time-victim.spawnTime<5)return 0;
  const absorbed=Math.min(victim.armor||0,amount);victim.armor=Math.max(0,(victim.armor||0)-absorbed);const damage=amount-absorbed;
  victim.health-=damage;victim.attacker=attacker?.id;victim.hurtAt=this.time;if(victim.health<=0)this.kill(victim,attacker);return damage;
 }
 reload(u=this.player){if(u.reload>0||u.mag===WEAPONS[u.weapon].magazineSize||u.reserve===0)return;u.reload=WEAPONS[u.weapon].reloadTime;if(u.role==="player")this.options.onSound?.("reload",u);}
 swapWeapon(slot){const p=this.player;if(p.health<=0||p.transit)return;const next=slot===2?"pistol":this.options.loadout||"rifle";if(next===p.weapon)return;p.inventory[p.weapon]={mag:p.mag,reserve:p.reserve};p.weapon=next;p.reload=0;p.mag=p.inventory[next]?.mag??WEAPONS[next].magazineSize;p.reserve=p.inventory[next]?.reserve??WEAPONS[next].maxReserve;}
 kill(victim,attacker){
  if(victim.state==='DEAD')return;victim.health=0;victim.state='DEAD';victim.deadTime=this.time;this.releaseCover(victim);this.selectedIDs.delete(victim.id);this.casualties.push({x:victim.x,y:victim.y,floor:victim.floor,team:victim.team,time:this.time,angle:victim.angle});
  if(victim.team==='enemy'){this.kills++;if(attacker?.id===this.player.id&&attacker.team!==victim.team){this.player.kills++;this.combatStreak=this.time-this.lastPlayerKill<8?this.combatStreak+1:1;this.lastPlayerKill=this.time;if([3,5,8].includes(this.combatStreak))this.commendation={time:this.time,label:this.combatStreak===3?'TRIPLE ÉLIMINATION':this.combatStreak===5?'LIGNE NETTOYÉE':'SECTEUR VERROUILLÉ',count:this.combatStreak};awardKill(this,victim);}}
  if(victim.role==='player'){this.combatStreak=0;this.commendation=null;this.deaths++;dropInventory(this);victim.armor=0;victim.regenUntil=0;this.activeContainer=null;this.respawnIn=5;this.pendingPlayerLift=null;demote(this);this.selectedIDs.clear();this.officerOrder=null;for(const u of this.units)if(u.officerID===victim.id)clearOrder(this,u);this.log('SOLDAT À TERRE','−'+this.deathPenalty.amount+' XP · grade '+rankOf(victim).number+'. Choisissez un ravitaillement.','warning',victim.floor);}
 }
 respawn(supplyID){
  if(this.status!=='running'||this.player.health>0||this.respawnIn>0)return false;
  const supply=this.supplyOptions().find(s=>s.id===supplyID);if(!supply?.available)return false;
  const p=this.player;Object.assign(p,{x:supply.x,y:supply.y,floor:supply.floor,health:p.maxHealth,reload:0,transit:null,cabin:null,liftPlan:null,stairTravel:null,stairHeight:0,stairRoute:null,state:'DEFEND',spawnTime:this.time,inventory:{},shotCooldown:0,angle:-Math.PI/2,turnMode:'up',items:[],armor:0,regenUntil:0,stunnedUntil:0,itemCooldown:0,speedBoostUntil:0,fireBoostUntil:0,goal:null,path:[],connector:null});
  p.mag=WEAPONS[p.weapon].magazineSize;p.reserve=WEAPONS[p.weapon].maxReserve;this.log('RETOUR EN LIGNE',supply.name+' · '+rankOf(p).name,'success',p.floor);return true;
 }
 perceive(u){let best=null,score=-Infinity;for(const e of this.spatial.nearby(u.floor,u.x,u.y,visionRange(this,u))){if(e.team===u.team||e.health<=0||e.transit||!npcCanSee(this,u,e))continue;spotUnit(this,u,e);const s=1200-dist(u,e)+(e.id===u.target?100:0)+(e.role==="heavy"?90:0)+(u.attacker===e.id?180:0)+(e.floor===-2?150:0);if(s>score){score=s;best=e;}}return best;}
 think(u){
  const commander=u.officerID&&this.units.find(a=>a.id===u.officerID);
  if(u.officerID&&(!canCommand(commander,u)||u.orderUntil<=this.time)||!u.manualOrder&&u.orderUntil>0&&u.orderUntil<=this.time)clearOrder(this,u);
  if(u.team==='enemy')while(u.routeIndex<u.route.length-1&&(u.route[u.routeIndex].floor>u.floor||u.route[u.routeIndex].floor===u.floor&&dist(u,u.route[u.routeIndex])<170))u.routeIndex++;
  const target=this.perceive(u);u.target=target?.id??null;
  const explicit=u.currentOrder!=='NORMAL'&&(u.officerID||u.orderUntil>this.time);
  u.autonomousCore=u.team==='ally'&&!explicit&&this.coreState!=='SECURE';
  let mission=explicit?u.orderGoal:null;
  if(u.autonomousCore)mission=formationPoint(this,CORE,u.id%24,22);
  else if(!explicit&&u.deploymentGoal&&this.time<u.deploymentUntil)mission=u.deploymentGoal;
  if(!explicit&&!u.autonomousCore&&!mission)mission=autonomousRoomGoal(this,u);
  const treatment=resupplyGoal(this,u,explicit);
  if(treatment){u.state='RESUPPLY';u.goal=usableSupply(this,u,treatment)?null:treatment;return;}
  if(u.currentOrder==='FOLLOW_OFFICER'&&commander){
   const i=u.formationIndex??u.id%6,angle=commander.angle+Math.PI,back=70+Math.floor(i/2)*40,side=i%2?45:-45;
   mission=nearestWalkable(this.floor(commander.floor),commander.x+Math.cos(angle)*back-Math.sin(angle)*side,commander.y+Math.sin(angle)*back+Math.cos(angle)*side);
  }
  if(u.currentOrder==='ATTACK_NEAREST'){
   const known=this.units.filter(a=>a.team!==u.team&&a.health>0&&!a.transit&&(a.id===target?.id||knownHostile(this,u,a)));
   const reports=known.map(a=>({unit:a,contact:tacticalContact(this,u,a)})).filter(a=>a.contact);reports.sort((a,b)=>dist(u,a.contact)+Math.abs(a.contact.floor-u.floor)*1600-dist(u,b.contact)-Math.abs(b.contact.floor-u.floor)*1600);mission=reports[0]?{...reports[0].contact}:u.homePosition;
  }
  reportFailingDefence(this,u,mission);
  const postTolerance=mission?.guardRoom!==undefined||u.assaultRole?38:u.currentOrder==='FOLLOW_OFFICER'?70:80;
  // Mandatory movement continues under fire: units may shoot but cannot abandon a room/core/follow/retreat order to chase.
  const moveOrder=['RETREAT','DEFEND_CORE','DEFEND_ZONE','REINFORCE_ZONE','HOLD_POSITION','FOLLOW_OFFICER','ATTACK_CORE','ATTACK_ELEVATOR','ATTACK_DOOR','ATTACK_FLOOR','ASSAULT_ZONE'].includes(u.currentOrder)||u.autonomousCore||!explicit&&!!mission||!explicit&&u.deploymentGoal&&this.time<u.deploymentUntil;
  if(mission&&moveOrder&&(mission.floor!==u.floor||dist(u,mission)>postTolerance)){u.goal={...mission};u.state=u.currentOrder==='RETREAT'?'RETREAT':'FOLLOW_ORDER';return;}
  const medical=medicalPosition(this,u,explicit||u.garrison?mission||u.homePosition:null);if(medical&&(!target||dist(u,target)>110)){u.healTarget=medical.patient;u.goal=dist(u,medical)>20?{x:medical.x,y:medical.y,floor:medical.floor}:null;u.state='HEAL';return;}
  if(target){
   u.state='ENGAGE';const d=dist(u,target),hold=u.currentOrder==='HOLD_AT_ALL_COSTS',anchor=mission||u.homePosition;
   if(u.health<u.maxHealth*.3&&!hold&&!explicit&&!u.autonomousCore){const retreat=retreatPosition(this,u,target);if(retreat){u.state='RETREAT';u.goal=retreat;return;}}
   if((u.health<u.maxHealth*.7||u.role==='marksman')&&this.time>u.coverUntil)this.seekCover(u,target,(mission||u.team==='ally')?mission||u.homePosition:null);
   if(u.coverId!==null&&this.time<u.coverUntil){const c=this.floor(u.floor).covers[u.coverId];if(c&&dist(u,c)>22&&(!mission||dist(c,mission)<140)){u.goal={...c,floor:u.floor};u.state='SEEK_COVER';return;}}
   const leash=mission||u.garrison||u.team==='ally'?anchor:null,tactical=combatPosition(this,u,target,leash);if(tactical){u.goal=tactical;u.state=u.reload>0?'SEEK_COVER':'FLANK';return;}
   if(u.assaultRole==='support'){u.goal=null;u.path=[];return;}
   const preferred=['assault','commando'].includes(u.role)?220:u.role==='marksman'?760:420;
   if(d>preferred){const tether=u.autonomousCore||['HOLD_POSITION','HOLD_AT_ALL_COSTS','DEFEND_ZONE','DEFEND_CORE','FOLLOW_OFFICER'].includes(u.currentOrder)||!!u.garrison||u.team==='ally'&&!explicit;
    u.goal=tether&&dist(target,anchor)>180?(dist(u,anchor)>70?{...anchor}:null):{x:target.x,y:target.y,floor:target.floor};
   }else{u.goal=null;u.path=[];}return;
  }
  this.releaseCover(u);
  if(u.team==='enemy'){
   while(u.routeIndex<u.route.length-1&&u.route[u.routeIndex].floor===u.floor&&dist(u,u.route[u.routeIndex])<170)u.routeIndex++;
   u.state=(u.garrison||u.assaultRole==='support')&&mission&&mission.floor===u.floor&&dist(u,mission)<=postTolerance?'DEFEND':u.floor===-2&&dist(u,CORE)<200?'CAPTURE':'ADVANCE';
   u.goal=['CAPTURE','DEFEND'].includes(u.state)?null:mission||u.route[u.routeIndex]||{...CORE};
   return;
  }
  const goal=mission||u.homePosition;u.goal={...goal};u.state=mission?'FOLLOW_ORDER':'RETURN_TO_POST';
  if(u.floor===goal.floor&&dist(u,goal)<(mission?.guardRoom!==undefined?postTolerance:70)){u.goal=null;u.path=[];if(mission?.guardRoom!==undefined)u.angle=Math.atan2(mission.watchY-u.y,mission.watchX-u.x);u.state=u.autonomousCore?'DEFEND_CORE':'DEFEND';
   if(!mission&&u.role!=='officer'&&this.time>u.patrolAt){u.patrolAt=this.time+10+this.random()*8;u.goal=nearestWalkable(this.floor(u.floor),u.homePosition.x+u.patrolOffset,u.homePosition.y);u.state='PATROL';}
  }
 }
 seekCover(u,target,anchor=null){const list=this.floor(u.floor).covers.filter(c=>(c.occupant===null||c.occupant===u.id)&&dist(c,u)<230&&(!anchor||anchor.floor===u.floor&&dist(c,anchor)<180)&&canStand(this.floor(u.floor),c.x,c.y,u.radius)&&(!u.orderGoal||!(["DEFEND_CORE","HOLD_AT_ALL_COSTS"].includes(u.currentOrder))||dist(c,CORE)<170)&&Math.cos(Math.atan2(target.y-c.y,target.x-c.x)-c.dir)>-.5);list.sort((a,b)=>dist(a,u)-dist(b,u));const c=list.find(c=>!lineOfSight(this.floor(u.floor),target,c));if(c){this.releaseCover(u);u.coverId=c.id;c.occupant=u.id;u.coverUntil=this.time+1.4;}}
 releaseCover(u){if(u.coverId!==null){const c=this.floor(u.floor).covers[u.coverId];if(c?.occupant===u.id)c.occupant=null;u.coverId=null;}}
 navigate(u,goal,dt){
  if(!goal||!Number.isFinite(goal.x)||!Number.isFinite(goal.y)||!this.floor(goal.floor)){
   u.goal=null;
   if(!u.stairRoute&&!u.liftPlan){u.path=[];u.pathGoal=null;return;}
  }
  if(u.liftPlan){navigateLift(this,u,dt);return;}
  if(u.transit)return;
  if(u.stairRoute){
   const node=u.stairRoute[0];
   const dx=node.x-u.x,dy=node.y-u.y,len=Math.hypot(dx,dy),step=Math.min(u.speed*dt,len);
   if(len<2){u.stairRoute.shift();if(!u.stairRoute.length){u.stairRoute=null;u.path=[];u.pathGoal=null;}return;}
   u.angle=Math.atan2(dy,dx);this.move(u,dx/len*step,dy/len*step);
   return;
  }
  let local=goal;
  if(goal.floor!==u.floor){
   if(!u.connector){const stairs=CONNECTORS.filter(c=>c.type==="stairs"&&u.floor>=c.min&&goal.floor>=c.min);stairs.sort((a,b)=>dist(u,a)-dist(u,b)+(a.id===u.preferredConnector?-250:0)-(b.id===u.preferredConnector?-250:0));let c=stairs[0],best=dist(u,c)+Math.abs(goal.floor-u.floor)*180;
    for(const l of this.elevators)if(canUseLift(this,l,u.floor,u.team,goal.floor)&&!l.moving&&l.occupants.length<5){const cost=dist(u,l)+Math.abs(l.currentFloor-u.floor)*190+240;if(cost<best){c=l;best=cost;}}
    u.connector=c.id;u.waitForLift=0;u.path=[];u.pathGoal=null;
   }
   const c=CONNECTORS.find(c=>c.id===u.connector);local={...c,floor:u.floor};
   if(c.type==="stairs"){
    const side=Math.sign(goal.floor-u.floor);
    const route=stairRoute(c,side);local={...route[0],floor:u.floor};
    if(dist(u,local)<40){
     u.stairRoute=route;
     return;
    }
   }else{
    local.y+=90;
    if((dist(u,local)<35||dist(u,c)<48)&&u.connectorCooldown<=0){
     const l=this.elevators.find(l=>l.id===c.id);u.waitForLift+=dt;
     if(!canUseLift(this,l,u.floor,u.team,goal.floor)||u.waitForLift>60){u.connector=dist(u,CONNECTORS[0])<dist(u,CONNECTORS[1])?"A":"B";u.pathGoal=null;return;}
     this.board(u,l,goal.floor);return;
    }
   }
  }else if(u.connector){u.connector=null;u.path=[];u.pathGoal=null;}
  if(dist(u,local)<22){u.path=[];return;}
  if(u.pathVersion!==this.floor(u.floor).version||!u.pathGoal||dist(u.pathGoal,local)>70||u.path.length===0&&this.time-u.pathTime>1.5){u.path=this.pathfinding.path(this.floor(u.floor),u,local);u.pathGoal={...local};u.pathTime=this.time;u.pathVersion=this.floor(u.floor).version;}
  if(!u.path.length)return;let node=u.path[0];if(dist(u,node)<14){u.path.shift();node=u.path[0];if(!node)return;}let dx=node.x-u.x,dy=node.y-u.y,len=Math.hypot(dx,dy);if(!len)return;let vx=dx/len,vy=dy/len;
  for(const o of this.spatial.nearby(u.floor,u.x,u.y,26)){if(o.id===u.id||o.transit)continue;const d=dist(u,o);if(d>0&&d<25){vx+=(u.x-o.x)/d*(25-d)/45;vy+=(u.y-o.y)/d*(25-d)/45;}}
  const v=Math.hypot(vx,vy);if(v<.001)return;const speed=u.speed*(u.team==='enemy'&&u.assaultBoostUntil>this.time?1.15:1),step=Math.min(speed*dt,len),before={x:u.x,y:u.y};this.move(u,vx/v*step,vy/v*step);
  if(dist(u,before)<step*.15){const angle=Math.atan2(vy,vx);for(const side of [u.id%2?1:-1,u.id%2?-1:1]){const trial=angle+side*.8,x=u.x+Math.cos(trial)*step,y=u.y+Math.sin(trial)*step;if(canStand(this.floor(u.floor),x,y,u.radius)&&Math.hypot(node.x-x,node.y-y)<len+1.5){this.move(u,x-u.x,y-u.y);break;}}}
  if(!u.target&&dist(u,before)>.01)u.angle=Math.atan2(u.y-before.y,u.x-before.x);
  u.stuckTimer+=dt;if(u.stuckTimer>2.5){if(dist(u,u.lastProgress)<9){u.pathGoal=null;this.metrics.stuckRecoveries++;if(this.time-u.pathTime>7)u.connector=null;}u.lastProgress={x:u.x,y:u.y};u.stuckTimer=0;}
 }
 changeFloor(u,target,c){this.releaseCover(u);u.floor=target;u.x=c.x;u.y=c.y;u.path=[];u.pathGoal=null;u.connectorCooldown=.9;u.target=null;this.metrics.floorChanges++;if(u.role==="player"){this.activeContainer=null;this.log("NIVEAU "+FLOOR_INFO[target+2].short+" — "+FLOOR_INFO[target+2].name,c.label,"info",target);this.options.onSound?.("door",u);}}
 updateDoors(dt){updateDoors(this,dt);}

 destroyDoor(f,d){if(d.state==="DESTROYED")return;d.state="DESTROYED";d.open=1;f.version++;this.metrics.doorBreaches++;this.effects.push({x:d.x,y:d.y,floor:f.id,type:"explosion",life:1.2,max:1.2});this.log("PORTE ENFONCÉE","La brèche reste ouverte — niveau "+FLOOR_INFO[f.id+2].short+".","danger",f.id);}
 interact(pitch){
  const p=this.player;if(p.health<=0||this.status!=="running")return null;
  const lift=this.elevators.find(l=>l.id===p.cabin||Math.abs(p.x-l.x)<90&&p.y>l.y-44&&p.y<l.y+135);
  if(lift)return this.interactLift(lift,pitch);
  if(p.transit)return null;
  const context=this.getContext();if(!context)return null;
  if(context.type==='door')return context;
  if(context.type==='supply'){const station=this.floor(p.floor).supplies.find(s=>s.id===context.id);if(!station||!usableSupply(this,p,station))return null;const healed=this.time-(p.hurtAt??-100)>=3;p.reserve=WEAPONS[p.weapon].maxReserve;p.mag=WEAPONS[p.weapon].magazineSize;p.reload=0;p.inventory={};this.log("RAVITAILLEMENT",healed?"Munitions restaurées. Restez dans la zone pour vous soigner.":"Munitions restaurées. Les soins reprennent après 3 s sans blessure.","success",p.floor);this.options.onSound?.("supply",p);return null;}
  if(context.type==='shop')return context;
  if(context.type==='furniture'){if(this.openFurniture(context.id))return {type:'furniture',id:context.id,label:context.label};return null;}
  return null;
 }
 liftButtonAt(pitch){
  const p=this.player;
  for(const l of this.elevators){
   if(p.floor<l.min||p.floor>l.max)continue;
   const target=liftPanelHit(l,p,pitch);
   if(target!==null&&(p.cabin===l.id||liftDocked(l,p.floor)))return {id:l.id,target,type:'floor'};
   if(!insideLift(l,p.x,p.y)&&Number.isFinite(pitch)&&Math.sin(p.angle)<-.01){
    const t=(l.y+54-p.y)/Math.sin(p.angle),x=p.x+Math.cos(p.angle)*t,height=EYE_HEIGHT+Math.tan(pitch)*t/TILE;
    if(t>0&&t<130&&Math.abs(x-l.x-64)<8&&Math.abs(height-1.2)<.14)return {id:l.id,type:'call'};
   }
  }
  return null;
 }
 interactLift(l,pitch){
  const p=this.player;
  if(!canUseLift(this,l,p.floor,p.team)){
   this.log("ASCENSEUR HORS SERVICE","Vérifiez l’alimentation et la salle de contrôle.","warning",p.floor);return null;
  }
  const button=this.liftButtonAt(pitch);
  if(button?.id===l.id&&button.type==='floor'){selectLiftFloor(this,p,l,button.target);return null;}
  if(insideLift(l,p.x,p.y)&&(p.cabin===l.id||liftDocked(l,p.floor))){
   p.cabin=l.id;
   if(l.moving)return null;
   return {id:l.id,type:'elevator',label:l.label,inside:true,floors:FLOOR_INFO.filter(f=>f.id>=l.min&&f.id<=l.max&&f.id!==p.floor)};
  }
  callLift(this,l,p.floor,p.team);
  this.log("APPEL ASCENSEUR",liftDocked(l,p.floor)?"Attendez l’ouverture puis entrez dans la cabine.":"Cabine demandée au niveau "+p.floor+".","info",p.floor);
  return null;
 }
 useConnector(id,target,inside=false){
  const c=CONNECTORS.find(c=>c.id===id),p=this.player;
  if(!c||dist(c,p)>125||p.health<=0||!Number.isInteger(target)||target<c.min||target>c.max)return false;
  if(c.type==='stairs'){if(Math.abs(target-p.floor)!==1)return false;this.changeFloor(p,target,c);return true;}
  const l=this.elevators.find(l=>l.id===id);
  if(inside)return selectLiftFloor(this,p,l,target);
  if(!canUseLift(this,l,p.floor,p.team,target))return false;
  if(insideLift(l,p.x,p.y)&&liftDocked(l,p.floor))return selectLiftFloor(this,p,l,target);
  this.pendingPlayerLift={id,target};callLift(this,l,p.floor,p.team);return true;
 }
 board(u,l,target){return boardLift(this,u,l,target);}
 updateElevators(dt){updateElevators(this,dt);}
 officerThink(o){commandOfficer(this,o);}
 updateCore(dt){const inside=this.units.filter(u=>u.health>0&&!u.transit&&u.floor===-2&&dist(u,CORE)<200),e=inside.filter(u=>u.team==="enemy").length,a=inside.length-e,state=e===0?"SECURE":this.enemyFreezeUntil>this.time?"CONTESTED":a>0&&e<=a*1.5?"CONTESTED":"CAPTURING";if(e>0&&this.coreState==="SECURE"){this.log("CORE UNDER ATTACK","Toutes les unités disponibles : protégez le Core.","critical",-2);}this.coreState=state;if(state==="CAPTURING")this.coreControl=Math.max(0,this.coreControl-dt*Math.min(3.5,.55+(e-a)*.22)*(this.coreShieldUntil>this.time?.2:1));else if(!e)this.coreControl=Math.min(100,this.coreControl+dt*.5);if(this.coreControl<=0)this.finish(false);}
 updateZones(){updateRoomControl(this,0);const e=this.units.filter(u=>u.team==="enemy"&&u.health>0).length;this.alert=this.coreState!=="SECURE"?4:e>35||this.activeMajorWaves.length||this.time-this.director.lastMajor<45?3:e>8?2:e?1:0;}
 directEvents(){directEvents(this);}
 reinforce(n){return reinforceAllies(this,n);}
 finish(won){if(this.status!=='running')return;this.status=won?'ended':'defeat';this.log(won?'OPÉRATION TERMINÉE':'CORE CAPTURED',won?'Vous avez terminé la partie.':'L’installation est tombée.',won?'info':'critical');this.options.onFinish?.(this.snapshot());}
 getContext(){
  const p=this.player;
  if(p.health<=0)return null;
  if(p.transit){
   const l=this.elevators.find(l=>l.id===p.transit);
   const display=liftDisplay(l);
   return {type:"transit",label:"CABINE "+l.id+" · "+(display.direction>0?"↑":display.direction<0?"↓":"↑↓")+" "+FLOOR_INFO[display.floor+2].short+" → "+FLOOR_INFO[l.targetFloor+2].short+" · "+Math.ceil(l.remaining)+" s"};
  }
  if(this.pendingPlayerLift)return {type:"waiting",label:"CABINE EN APPROCHE…"};
  const lift=this.elevators.find(l=>p.floor>=l.min&&p.floor<=l.max&&Math.abs(p.x-l.x)<90&&p.y>l.y-40&&p.y<l.y+135);
  if(lift){
   const inside=insideLift(lift,p.x,p.y);
   const atLanding=lift.currentFloor===p.floor&&!lift.moving&&lift.doorState==="OPEN";
   const display=liftDisplay(lift),floorLabel=FLOOR_INFO[display.floor+2].short;
   const label=!canUseLift(this,lift,p.floor,p.team)?"HORS SERVICE":atLanding?(inside?"CHOISIR L’ÉTAGE":"ENTRER À PIED"):lift.phase==='OPENING'&&liftDocked(lift,p.floor)?"OUVERTURE DES PORTES":lift.queue.includes(p.floor)?"CABINE DEMANDÉE":"APPELER LA CABINE";
   return {type:atLanding&&!inside?"waiting":"elevator",label:lift.id+" · "+(display.direction>0?"↑":display.direction<0?"↓":"↑↓")+" "+floorLabel+" · "+label,id:lift.id};
  }
  const stair=this.floor(p.floor).connectors.find(c=>c.type==="stairs"&&stairFootprint(c,p.x,p.y,100));
  if(stair)return {type:"waiting",label:stair.label+" · PASSAGE À PIED"};
  const shop=nearbyShop(this);if(shop)return {type:"shop",id:shop.id,category:shop.activeCategory,label:"BOUTIQUE · "+shop.name};
  const supply=this.floor(p.floor).supplies.find(sp=>usableSupply(this,p,sp));if(supply)return {type:"supply",id:supply.id,label:"SE SOIGNER & RECHARGER"};
  const door=nearbyDoorContext(this);if(door)return door;
  const furniture=nearbyFurniture(this);
  return furniture?{type:"furniture",id:furniture.id,label:"FOUILLER · "+furniture.name}:null;
 }
 snapshot(){const p=this.player,alive=this.units.filter(u=>u.health>0),rank=rankOf(p),next=RANKS[rank.index+1],reports=reportedHostiles(this);return {intel:fieldIntel(this),...roomSnapshot(this),...inventorySnapshot(this),...shopSnapshot(this),waveStatus:waveSummary(this),nextRelief:Math.max(0,Math.ceil(this.nextRelief-this.time)),coreReliefs:this.coreReliefs.map(r=>({id:r.id,label:r.label,count:3,remaining:Math.max(0,Math.ceil(r.next-this.time)),pending:r.pending})),reliefLimit:RELIEF_LIMIT,pendingRelief:Math.min(this.reliefBudget,this.reliefPosts.reduce((n,p)=>n+p.pending*(p.kind==='guard'?3:1),0)),rank,rankNumber:rank.number,xp:p.xp,maxHealth:p.maxHealth,speed:p.speed,nextXP:next?next.xp-p.xp:0,xpProgress:next?(p.xp-rank.xp)/(next.xp-rank.xp)*100:100,xpEvents:this.xpEvents.filter(e=>this.time-e.time<3),promotion:this.promotion&&this.time-this.promotion.time<5?this.promotion:null,deathPenalty:this.deathPenalty,commandPriority:this.commandPriority,commandRadius:this.commandRadius,commandCount:commandTargets(this).length,selected:selectedStats(this),commandFeedback:this.commandFeedback,turnMode:p.turnMode,supplies:this.supplyOptions(),nextReinforce:Math.max(0,this.nextReinforce-this.time),majorAssault:this.activeMajorWaves.length>0||this.time-this.director.lastMajor<45,wave:this.director.attackIndex,pendingHostiles:this.pendingWaves.reduce((n,w)=>n+w.remaining,0),status:this.status,time:this.time,duration:this.duration,core:Math.round(this.coreControl),coreState:this.coreState,alert:this.alert,health:Math.max(0,Math.ceil(p.health)),weapon:p.weapon,ammo:p.mag,reserve:p.reserve,reload:Math.max(0,p.reload),floor:p.floor,sector:zoneAt(this.floor(p.floor),p.x,p.y),allies:alive.filter(u=>u.team==="ally").length,enemies:alive.filter(u=>u.team==="enemy").length,kills:p.kills,totalKills:this.kills,deaths:this.deaths,orders:this.ordersCompleted,zones:this.zonesDefended,events:this.events.slice(0,8),order:this.officerOrder,respawn:Math.ceil(this.respawnIn),context:this.getContext(),floors:FLOOR_INFO.map(f=>({...f,allies:alive.filter(u=>u.team==="ally"&&u.floor===f.id).length,enemies:reports.filter(r=>r.contact.floor===f.id).length})),score:Math.round(p.kills*100+this.time*2+this.coreControl*50+this.ordersCompleted*250+this.zonesDefended*40),metrics:{...this.metrics,roofWaves:this.roofWaves}};}
}
