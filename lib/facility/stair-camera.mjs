import {STAIR_RISE} from './stairs.mjs';

// Keep interpolation in world height when the simulation changes floor IDs.
export function stairCameraPose(previous,player,dt,reducedMotion=false){
 const height=player.floor*STAIR_RISE+(player.stairHeight||0);
 const snap=!previous||previous.id!==player.id||previous.spawnTime!==player.spawnTime||Math.hypot(previous.x-player.x,previous.y-player.y)>160||Math.abs(previous.height-height)>STAIR_RISE*1.2;
 if(snap||reducedMotion)return {id:player.id,spawnTime:player.spawnTime,x:player.x,y:player.y,height,active:!!player.stairTravel};
 const active=!!player.stairTravel||previous.active;
 if(!active)return {id:player.id,spawnTime:player.spawnTime,x:player.x,y:player.y,height,active:false};
 const blend=1-Math.exp(-Math.max(0,dt)*24);
 const pose={id:player.id,spawnTime:player.spawnTime,x:previous.x+(player.x-previous.x)*blend,y:previous.y+(player.y-previous.y)*blend,height:previous.height+(height-previous.height)*blend,active:true};
 if(!player.stairTravel&&Math.hypot(pose.x-player.x,pose.y-player.y)<.1&&Math.abs(pose.height-height)<.002)pose.active=false;
 return pose;
}
