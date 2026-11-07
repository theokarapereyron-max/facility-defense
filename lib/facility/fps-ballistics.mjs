import {airframeSolidAt} from './airlift-geometry.mjs';
import {impactMaterial} from './impact-material.mjs';
import {TILE, cellAt, solid} from './map.mjs';
import {liftSolidAt} from './lift-geometry.mjs';

export const EYE_HEIGHT = 1.54;
export const CEILING_HEIGHT = 4.2;
export const MAX_PITCH = Math.PI * .44;
export const ACTOR_HEIGHT = 1.9;

export function heightEntry(ray, entry, exit, bottom, top) {
 if(!ray) return entry;
 const {height, slope} = ray;
 if(Math.abs(slope) < 1e-8) return height >= bottom && height <= top ? entry : Infinity;
 const a = (bottom - height) / slope;
 const b = (top - height) / slope;
 const start = Math.max(entry, Math.min(a, b));
 return start <= Math.min(exit, Math.max(a, b)) ? start : Infinity;
}

function coverHeight(prop) {
 switch(prop.type) {
  case 'locker': case 'cabinet': return 2.45;
  case 'shelf': return 2.3;
  case 'vehicle': return 1.95;
  case 'desk': case 'workbench': return 1.15;
  case 'counter': case 'stand': return 1.45;
  case 'medical': case 'table': case 'jar': return 1.2;
  default: return .93;
 }
}

// Horizontal distances use map pixels. Heights use the 3D scene's tile units.
export function fpsRay(floor, x, y, dx, dy, pitch, range) {
 const slope = Math.tan(pitch) / TILE;
 const height = EYE_HEIGHT;
 const plane = slope < 0 ? -height / slope : slope > 0 && !floor.isRoof ? (CEILING_HEIGHT - height) / slope : Infinity;
 const maxDistance = Math.min(range * Math.cos(pitch), plane);
 for(let distance = 0; distance < maxDistance; distance += 4) {
  const px = x + dx * distance, py = y + dy * distance;
  const z = height + slope * distance, cell = cellAt(floor, px, py);
  if(airframeSolidAt(floor,px,py,z)||liftSolidAt(floor,px,py,z))return {height,slope,distance,material:'metal'};
  if(cell === 1 && z < CEILING_HEIGHT || cell === 2 && z < CEILING_HEIGHT && (z>=2.86 || solid(floor, px, py))) {
   return {height, slope, distance, material:impactMaterial(floor,px,py,z)};
  }
  if(cell !== 3) continue;
  const prop = floor.props.find(p => p.solid && px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h);
  if(prop && z < coverHeight(prop)) return {height, slope, distance, material:impactMaterial(floor,px,py,z)};
 }
 return {height, slope, distance:maxDistance, material:maxDistance===plane?'concrete':null};
}
