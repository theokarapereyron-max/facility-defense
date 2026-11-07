// Music reflects the current floor; the Core signal is global.
import {airliftSound} from './airlift.mjs';
export function audioScene(sim,paused=false){
 const playing=sim.status==='running'&&!paused;
 const enemies=sim.units.some(u=>u.team==='enemy'&&u.health>0&&!u.transit&&u.floor===sim.player.floor);
 const fighting=enemies&&sim.time-(sim.lastCombatAt?.[sim.player.floor]??-Infinity)<4;
 const coreAttacked=sim.coreState==='CAPTURING'||sim.coreState==='CONTESTED';
 return {playing,music:enemies?(fighting?'combat':'threat'):'calm',floor:sim.player.floor,rotor:playing?airliftSound(sim):0,
  coreAlarm:playing&&coreAttacked?(sim.coreControl<20?3:sim.coreControl<40?2:1):0};
}
