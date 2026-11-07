// French Army hierarchy; the first ten titles have two fictional game echelons.
import {earnCredits,rewardPromotions,killCredits} from './economy.mjs';
// Echelons provide 30 distinct progression/authority levels, not 30 official ranks.
const titles=[['Soldat','SDT'],['Soldat de première classe','1CL'],['Caporal','CPL'],['Caporal-chef','CCH'],['Sergent','SGT'],['Sergent-chef','SCH'],['Adjudant','ADJ'],['Adjudant-chef','ADC'],['Major','MAJ'],['Aspirant','ASP'],['Sous-lieutenant','SLT'],['Lieutenant','LTN'],['Capitaine','CNE'],['Commandant','CDT'],['Lieutenant-colonel','LCL'],['Colonel','COL'],['Général de brigade','GBR'],['Général de division','GDI'],['Général de corps d’armée','GCA'],['Général d’armée','GAR']];
let threshold=0;
export const RANKS=titles.flatMap(([title,abbr],tier)=>Array.from({length:tier<10?2:1},(_,e)=>({title,abbr,tier,echelon:tier<10?e+1:null}))).map((r,index)=>{
 const cost=index?100+20*(index-1)+7*(index-1)**2:0;threshold+=cost;
 return {...r,index,number:index+1,name:r.title+(r.echelon?' · '+['I','II'][r.echelon-1]:''),short:r.abbr+(r.echelon?' '+r.echelon:''),xp:threshold,cost,maxHealth:100+index*4,speed:205*(1+index*.005)};
});
export const rankOf=u=>RANKS[Math.max(0,Math.min(RANKS.length-1,u.rank||0))];
export const rankForXP=xp=>RANKS.findLast(r=>xp>=r.xp)||RANKS[0];
export const canCommand=(commander,unit)=>!!commander&&!!unit&&commander.id!==unit.id&&commander.team===unit.team&&commander.health>0&&unit.health>0&&rankOf(commander).index>rankOf(unit).index;
export function applyPlayerRank(p,heal=false){
 const before=p.maxHealth||100,r=rankForXP(p.xp||0);p.rank=r.index;p.maxHealth=r.maxHealth;p.speed=r.speed;
 p.health=heal?r.maxHealth:Math.min(r.maxHealth,Math.max(0,p.health+(r.maxHealth-before)));
 return r;
}
export const ROLE_NAMES={player:'Joueur',soldier:'Fusilier',rifleman:'Fusilier',assault:'Assaut',heavy:'Arme lourde',marksman:'Tireur de précision',medic:'Médecin',officer:'Officier',commando:'Commando'};
export function killXP(victim){const base={rifleman:60,soldier:60,assault:90,marksman:110,heavy:170,officer:140,medic:75,commando:150}[victim.role]||60;return Math.round(base*(1+rankOf(victim).index*.025)*(victim.elite?1.5:1));}
export function awardKill(sim,victim){const xp=killXP(victim);earnCredits(sim,killCredits(xp),'Élimination · '+ROLE_NAMES[victim.role]);return awardExperience(sim,xp,(victim.elite?'Élite · ':'')+ROLE_NAMES[victim.role],victim);}
export function awardExperience(sim,amount,label,position=sim.player){
 const p=sim.player,before=p.rank,alive=p.health>0;if(!Number.isFinite(amount)||amount<=0)return 0;amount=Math.floor(amount);p.xp+=amount;applyPlayerRank(p);if(!alive)p.health=0;
 sim.xpEvents.push({id:++sim.xpSerial,amount,label,time:sim.time});sim.xpEvents=sim.xpEvents.slice(-5);
 sim.effects.push({type:'xp',x:position.x,y:position.y,floor:position.floor,amount,life:1.8,max:1.8});
 if(p.rank>before){rewardPromotions(sim);sim.promotion={id:sim.xpSerial,rank:p.rank,time:sim.time};sim.log('PROMOTION — '+rankOf(p).name,'Grade '+rankOf(p).number+' · '+p.maxHealth+' PV · autorité accrue.','success',p.floor);}
 if(sim.officerOrder&&!canCommand(sim.units.find(u=>u.id===sim.officerOrder.commanderID),p))sim.officerOrder=null;
 return amount;
}
export function demote(sim){
 const p=sim.player,old=p.xp,oldRank=rankOf(p),next=RANKS[Math.max(0,p.rank-2)];
 const fraction=(p.xp-oldRank.xp)/Math.max(1,(RANKS[p.rank+1]?.xp??p.xp+1)-oldRank.xp);
 p.xp=p.rank<2?0:next.xp+Math.floor(Math.min(.999,fraction)*(RANKS[next.index+1].xp-next.xp));
 applyPlayerRank(p);p.health=0;sim.deathPenalty={amount:old-p.xp,from:oldRank.number,to:rankOf(p).number};
}
