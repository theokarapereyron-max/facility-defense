// One layout for the walkable surface, floor openings and rendered steps.
// Distances on the map are pixels. Vertical distances are metres (scene units).
export const STAIR_RISE=4.6;
export const STAIR_HALF_RUN=112;
export const STAIR_HALF_WIDTH=64;
export const STAIR_LANE=32;
export const STAIR_TREADS=14;
export const STAIR_LANDING=-144;

export function stairFootprint(c,x,y,margin=0){
 return Math.abs(x-c.x)<STAIR_HALF_WIDTH+margin&&y>c.y+STAIR_LANDING-margin&&y<c.y+STAIR_HALF_RUN+margin;
}

export function stairSurface(x,y){
 if(y<=-STAIR_HALF_RUN)return STAIR_RISE/2;
 const t=Math.max(0,Math.min(1,(STAIR_HALF_RUN-y)/(2*STAIR_HALF_RUN)));
 return (x<0?t:2-t)*STAIR_RISE/2;
}

export function stairRoute(c,direction){
 const side=direction>0?-1:1;
 return [
  {x:c.x+side*STAIR_LANE,y:c.y+176},
  {x:c.x+side*STAIR_LANE,y:c.y-128},
  {x:c.x-side*STAIR_LANE,y:c.y-128},
  {x:c.x-side*STAIR_LANE,y:c.y+176},
 ];
}

export function stairCanStep(u,c,x,y){
 const dx=x-c.x,dy=y-c.y,r=u.radius||11;
 if(Math.abs(dx)>STAIR_HALF_WIDTH-r||dy<STAIR_LANDING+r)return false;
 if(dy>-STAIR_HALF_RUN-r&&Math.abs(dx)<r+3)return false;
 return true;
}
