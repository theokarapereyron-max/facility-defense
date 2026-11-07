import {airframeSolidAt} from './airlift-geometry.mjs';
import {cellAt} from './map.mjs';

export function impactMaterial(floor,x,y,height) {
 if(airframeSolidAt(floor,x,y,height??1))return 'metal';
 const cell=cellAt(floor,x,y);
 if(cell===2)return 'metal';
 if(cell!==3)return 'concrete';
 const prop=floor.props.find(p=>p.solid&&x>=p.x&&x<p.x+p.w&&y>=p.y&&y<p.y+p.h);
 if(!prop)return 'metal';
 return ['crate','box','table','desk','shelf','sofa'].includes(prop.type)?'concrete':'metal';
}
