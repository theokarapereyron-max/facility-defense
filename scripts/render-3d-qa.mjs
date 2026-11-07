// Standalone raster QA of the real 3D scene; this does not emulate a browser.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Simulation} from '../lib/facility/simulation.mjs';
import {Renderer3D} from '../lib/facility/renderer3d.mjs';
import {CORE,nearestWalkable} from '../lib/facility/map.mjs';

const require=createRequire(import.meta.url),{createCanvas}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const makeCanvas=()=>{const canvas=createCanvas(1440,900);canvas.style={};canvas.setAttribute=()=>{};canvas.addEventListener=()=>{};canvas.removeEventListener=()=>{};canvas.before=()=>{};canvas.remove=()=>{};canvas.getBoundingClientRect=()=>({width:1440,height:900});return canvas;};
globalThis.document={createElement:()=>makeCanvas()};globalThis.window={devicePixelRatio:1};globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const directory=resolve('docs/qa/3d');await mkdir(directory,{recursive:true});const report=[];
for(const scenario of [{name:'core',floor:-2,focus:CORE},{name:'security',floor:0,focus:{x:2528,y:2768}},{name:'shop',floor:0,shop:true},{name:'roof',floor:5,focus:{x:3104,y:2400}},{name:'medical',floor:1,focus:{x:3104,y:1504}}]){
 const sim=new Simulation({seed:731}),f=sim.floor(scenario.floor),room=scenario.shop?f.shop.room:null,focus=room?{x:room.x+room.w/2,y:room.y+room.h/2}:scenario.focus;
 sim.status='running';sim.time=24;sim.units=[sim.player];Object.assign(sim.player,nearestWalkable(f,focus.x+80,focus.y+60),{angle:-1.7});
 for(let i=0;i<8;i++){const u=sim.makeUnit(i>=6?'enemy':'ally',i===0?'officer':i===1?'medic':i===2?'heavy':'soldier',{x:focus.x-210+i*65,y:focus.y+150-i%3*90,floor:f.id});u.angle=i>=6?Math.PI:-Math.PI/3;u.moveDistance=i*8;}
 const canvas=makeCanvas(),renderer=new Renderer3D(canvas,sim);renderer.settings={renderMode:'3d',effects:true,graphicsQuality:'high',cutawayWalls:true};renderer.zoom=renderer.camera.zoom=1.13;
 const started=performance.now();renderer.render(1/30);const warmup=performance.now()-started;
 const frameStart=performance.now();for(let i=0;i<3;i++)renderer.render(1/30);const frameMs=(performance.now()-frameStart)/3;
 if(renderer.activeMode!=='3d')throw new Error('3D scene did not render: '+scenario.name+' '+renderer.failureReason);
 const composite=createCanvas(1440,900),c=composite.getContext('2d');c.drawImage(renderer.glCanvas,0,0);c.drawImage(canvas,0,0);await writeFile(resolve(directory,scenario.name+'.png'),composite.toBuffer('image/png'));
 report.push({scenario:scenario.name,backend:renderer.gpu.isSoftware?'compatible':'WebGL',warmupMs:Math.round(warmup),frameMs:Math.round(frameMs),...renderer.stats});renderer.destroy();
}
await writeFile(resolve(directory,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
