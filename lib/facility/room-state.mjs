// Pure room/door rules shared by simulation, services and navigation.
export const insideRoom=(r,p)=>!!r&&p.x>r.x+16&&p.x<r.x+r.w-16&&p.y>r.y+16&&p.y<r.y+r.h-16;
export const roomAt=(f,p)=>f.rooms.find(r=>insideRoom(r,p));
export function roomStatus(sim,f,r){
 let allies=0,enemies=0;
 for(const u of sim.units)if(u.health>0&&!u.transit&&u.floor===f.id&&insideRoom(r,u)){if(u.team==='ally')allies++;else enemies++;}
 return {owner:r.strategic?(r.owner||'neutral'):enemies>allies?'enemy':allies>enemies?'ally':r.owner||'ally',allies,enemies,contested:allies>0&&enemies>0};
}
export const doorCenter=d=>({x:d.x+d.w/2,y:d.y+d.h/2});
export const doorControlRoom=(f,d)=>f.rooms[d.roomIndex];
export const canOpenDoor=(d,team)=>d.state==='DESTROYED'||d.forcedOpen||d.lockMode==='none'||d.lockMode==='hostile'&&d.lockTeam===team;
export function supplyStatus(sim,f,supply){
 const status=roomStatus(sim,f,f.rooms[supply.roomIndex]);
 return {...status,available:status.owner==='ally'&&status.enemies===0,reason:status.enemies?'Salle envahie — éliminez tous les hostiles':status.owner!=='ally'?'Salle sous contrôle ennemi — reprenez-la':'Ravitaillement sécurisé'};
}
