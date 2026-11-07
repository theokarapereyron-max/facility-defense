// Smoke blocks observation across a cloud; shared reports retain their last observed position.
export function smokeObstructs(sim,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 return sim.fields.some(c=>{if(c.type!=='smoke'||c.floor!==a.floor||c.until<=sim.time)return false;const t=length?Math.max(0,Math.min(1,((c.x-a.x)*dx+(c.y-a.y)*dy)/length)):0;return Math.hypot(a.x+t*dx-c.x,a.y+t*dy-c.y)<c.radius;});
}
