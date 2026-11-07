import {CORE,FLOOR_INFO,dist} from './map.mjs';
import {reportedHostiles} from './contacts.mjs';
export function fieldIntel(sim){
 const p=sim.player,f=sim.floor(p.floor),local=sim.units.filter(u=>u.floor===p.floor&&u.health>0&&!u.transit),reports=reportedHostiles(sim,p.floor),contacts=reports.length;
 let objective;
 const enemyRoom=f.rooms.filter(r=>r.owner==='enemy').sort((a,b)=>b.strategicValue-a.strategicValue)[0];
 if(sim.coreState!=='SECURE')objective={label:'PROTÉGER LE CORE',detail:'Le contrôle du Core est menacé.',...CORE,kind:'danger'};
 else if(p.health<p.maxHealth*.45){const supplies=sim.supplyOptions().filter(a=>a.available).sort((a,b)=>Math.abs(a.floor-p.floor)*1800+dist(p,a)-Math.abs(b.floor-p.floor)*1800-dist(p,b));if(supplies[0])objective={...supplies[0],label:'REJOINDRE UN RAVITAILLEMENT',detail:'Récupérez santé et munitions.',kind:'medical'};}
 if(!objective&&enemyRoom)objective={x:enemyRoom.x+enemyRoom.w/2,y:enemyRoom.y+enemyRoom.h/2,floor:f.id,label:'REPRENDRE '+enemyRoom.name,detail:'Reprenez la salle et ses accès.',kind:'capture'};
 if(!objective){const contact=reports.map(r=>r.contact).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(contact)objective={...contact,label:'DÉFENDRE LE SECTEUR',detail:'Dernier contact signalé sur votre niveau.',kind:'contact'};}
 objective??={...CORE,label:'GARDER LE CORE SOUS CONTRÔLE',detail:'Tenez les salles et coordonnez vos alliés.',kind:'secure'};
 return {contacts,medics:local.filter(u=>u.team==='ally'&&u.role==='medic').length,objective:{x:objective.x,y:objective.y,floor:objective.floor,label:objective.label,detail:objective.detail,kind:objective.kind,level:FLOOR_INFO[objective.floor+2].short},streak:sim.combatStreak||0,commendation:sim.commendation&&sim.time-sim.commendation.time<3?sim.commendation:null};
}
