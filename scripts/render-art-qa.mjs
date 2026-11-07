// Native Canvas raster QA, independent of a browser or a running Site.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {Simulation} from '../lib/facility/simulation.mjs';
import {Renderer} from '../lib/facility/renderer.mjs';
import {CORE,nearestWalkable} from '../lib/facility/map.mjs';

const require=createRequire(import.meta.url),canvasModule=require.resolve('@napi-rs/canvas',{paths:[process.cwd(),process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}),{createCanvas,GlobalFonts}=require(canvasModule);
for(const root of ['/usr/share/fonts/truetype/liberation2','/usr/share/fonts/truetype/liberation'])for(const [file,families] of [['LiberationSans-Regular.ttf',['Arial','sans-serif']],['LiberationSans-Bold.ttf',['Arial','sans-serif']],['LiberationMono-Regular.ttf',['monospace']]]){const path=resolve(root,file);if(existsSync(path))for(const family of families)GlobalFonts.registerFromPath(path,family);}
for(const [file,families] of [['DejaVuSans.ttf',['Arial','sans-serif']],['DejaVuSans-Bold.ttf',['Arial','sans-serif']],['DejaVuSansMono.ttf',['monospace']]]){const path=resolve('/usr/share/fonts/truetype/dejavu',file);if(existsSync(path))for(const family of families)GlobalFonts.registerFromPath(path,family);}
globalThis.document={createElement:()=>createCanvas(32,32)};
globalThis.window={devicePixelRatio:1};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
const directory=resolve(process.argv[2]||'docs/qa/renders');await mkdir(directory,{recursive:true});
for(const scenario of [{name:'core',floor:-2,focus:CORE},{name:'security',floor:0,focus:{x:2528,y:2768}},{name:'shop',floor:0,shop:true},{name:'medical',floor:1,focus:{x:3104,y:1504},medical:true}]){
 const s=new Simulation({seed:731}),f=s.floor(scenario.floor),room=scenario.shop?f.shop.room:null,focus=room?{x:room.x+room.w/2,y:room.y+room.h/2}:scenario.focus;s.time=24;s.status='ready';s.units=[s.player];Object.assign(s.player,nearestWalkable(f,focus.x+130,focus.y+80),{angle:-2.6});
 for(let i=0;i<7;i++){const u=s.makeUnit(i>4?'enemy':'ally',i===1?'officer':i===2?'medic':i===3?'heavy':'soldier',{x:focus.x-160+i*62,y:focus.y+140-i%3*75,floor:f.id});u.angle=i>4?Math.PI:-Math.PI/4;u.moveDistance=i*8;}
 if(scenario.medical)s.fields.push({type:'medical',x:focus.x,y:focus.y,floor:f.id,team:'ally',owner:s.player.id,radius:140,startedAt:s.time,until:s.time+15});
 const canvas=createCanvas(1440,900);canvas.getBoundingClientRect=()=>({width:1440,height:900});const r=new Renderer(canvas,s);r.camera={x:focus.x,y:focus.y,zoom:1.12,floor:f.id};r.zoom=1.12;r.settings={effects:true,graphicsQuality:'high',reducedMotion:false,mouseAim:true};r.render(0);
 await writeFile(resolve(directory,scenario.name+'.png'),canvas.toBuffer('image/png'));r.destroy();
}
console.log(JSON.stringify({directory,scenarios:4,scope:'Native Canvas raster output; no browser/CSS/UI verification'}));
