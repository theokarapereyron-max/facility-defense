// Real scene raster QA. It does not replace a browser/WebGL interaction test.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Simulation} from '../lib/facility/simulation.mjs';
import {Renderer3D} from '../lib/facility/renderer3d.mjs';
import {scheduleAirlift,updateAirlift,updateAirPassenger} from '../lib/facility/airlift.mjs';
import {helicopterPose} from '../lib/facility/airlift-geometry.mjs';
import {majorWavePlan} from '../lib/facility/reinforcement-plans.mjs';
import {spawnHostiles} from '../lib/facility/director.mjs';

const require=createRequire(import.meta.url),{createCanvas}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const makeCanvas=()=>{const c=createCanvas(1440,900);c.style={};for(const name of ['setAttribute','addEventListener','removeEventListener','before','remove'])c[name]=()=>{};c.getBoundingClientRect=()=>({width:1440,height:900});return c;};
globalThis.document={createElement:()=>makeCanvas()};globalThis.window={devicePixelRatio:1};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const directory=resolve(process.argv[2]||'docs/qa/airlift');await mkdir(directory,{recursive:true});const report=[];
for(const scenario of [{name:'fps-distant-approach',time:15,fps:true},{name:'aerial-approach',time:22,fps:false},{name:'aerial-unloading',time:39,fps:false},{name:'fps-landing',time:31,fps:true},{name:'fps-ramp',time:36,fps:true},{name:'fps-departure',time:58,fps:true}]){
 const sim=new Simulation({seed:731});sim.status='running';sim.units=[sim.player];const plan=majorWavePlan(1,()=>.2);plan.squads=plan.squads.filter(s=>s.route==='charlie'&&s.floor===undefined).slice(0,1);plan.total=plan.remaining=8;sim.pendingWaves=[plan];sim.activeMajorWaves=[{number:1,total:8,inserted:0,landed:false}];scheduleAirlift(sim);const flight=sim.airlift.flight;
 for(let i=0;i<scenario.time*30;i++){sim.time+=1/30;updateAirlift(sim,1/30,spawnHostiles);for(const u of sim.units)if(u.airInsertion)updateAirPassenger(sim,u,1/30);}
 const p=helicopterPose(flight,sim.time),pad=flight.pad;Object.assign(sim.player,{x:pad.x+440,y:pad.y+590,floor:5,angle:Math.atan2(p.y-pad.y-590,p.x-pad.x-440)});
 const canvas=makeCanvas(),renderer=new Renderer3D(canvas,sim);renderer.settings={renderMode:'3d',view3D:scenario.fps?'fps':'aerial',effects:true,graphicsQuality:'balanced',cutawayWalls:true};renderer.zoom=renderer.camera.zoom=scenario.fps?.85:.48;
 renderer.pitch=Math.atan2(p.height+2.7-1.54,Math.hypot(p.x-sim.player.x,p.y-sim.player.y)/32);
 renderer.render(1/30);const start=performance.now();renderer.render(1/30);const ms=performance.now()-start;
 const composite=createCanvas(1440,900),c=composite.getContext('2d');c.drawImage(renderer.glCanvas,0,0);c.drawImage(canvas,0,0);await writeFile(resolve(directory,scenario.name+'.png'),composite.toBuffer('image/png'));
 report.push({scenario:scenario.name,phase:flight.phase,delivered:flight.delivered,height:p.height,frameMs:Math.round(ms),...renderer.stats});renderer.destroy();
}
await writeFile(resolve(directory,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
