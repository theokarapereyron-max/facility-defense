import {ITEMS} from './items.mjs';
import {WEAPONS} from './simulation.mjs';
const SPECS={grenade:[['Dégâts','150 max'],['Rayon','5,6 m'],['Amorce','1,2 s']],flash:[['Rayon','6,9 m'],['Effet','3 s']],bandage:[['Soins','30 PV']],medkit:[['Soins','80 PV']],ration:[['Soins','30 PV'],['Durée','10 s']],ammo:[['Réserve','120 / 60 coups']],armor:[['Protection','60 dégâts']],armor_heavy:[['Protection','180 dégâts']],repair:[['Contrôle','+20 points'],['Lieu','Core −2']],core_rebuild:[['Contrôle','100 %'],['Portée','Tous niveaux']],core_shield:[['Capture','−80 %'],['Durée','30 s']],scanner:[['Détection','Votre étage'],['Durée','15 s']],recon:[['Détection','8 niveaux'],['Durée','60 s']],stasis:[['Effet','Hostiles figés'],['Durée','12 s']],radio:[['Escouade','8 alliés'],['Arrivée','12 s']],radio_target:[['Escouade','8 alliés'],['Affectation','Salle au choix']],xp:[['Instruction','100 XP']],manual:[['Instruction','350 XP']],xp_major:[['Instruction','2 000 XP']],team_med:[['Soins','60 PV / allié'],['Rayon','11 m']],trauma:[['Soins','100 % des PV']],adrenaline:[['Mobilité','+25 %'],['Durée','30 s']],overdrive:[['Délai de tir','−35 %'],['Durée','25 s']],incendiary:[['Dégâts','18 PV/s'],['Durée','8 s']],smoke:[['Rayon','6,2 m'],['Durée','15 s']],door_kit:[['Porte','Résistance entière'],['Portée','5,6 m']],door_armor:[['Résistance','+200 PV'],['Portée','5,6 m']],breach:[['Porte','Passage permanent'],['Portée','4,4 m']],reserve_pack:[['Munitions','Chargeur + réserve']]};
export function itemPreview(state,item){
 const def=ITEMS[item];if(!def)return null;let outcome=def.description;
 if(['bandage','medkit','trauma'].includes(item)){const amount=Math.max(0,Math.min((state.maxHealth||100)-state.health,item==='bandage'?30:item==='medkit'?80:Infinity));outcome=amount?'Dans votre état actuel : +'+Math.ceil(amount)+' PV.':'Vos PV sont complets : cet objet sera conservé à l’utilisation.';}
 if(item==='armor'||item==='armor_heavy'){const armor=item==='armor'?60:180;outcome='Protection après utilisation : '+Math.max(state.armor||0,armor)+' points. Les protections ne s’additionnent pas.';}
 if(item==='repair')outcome='Contrôle après installation : '+Math.min(100,(state.core??100)+20)+' %. Rejoignez le Core pour l’utiliser.';
 if(item==='reserve_pack'){const weapon=WEAPONS[state.weapon]||WEAPONS.rifle;outcome=weapon.name+' : '+weapon.magazineSize+' coups dans le chargeur et '+weapon.maxReserve+' en réserve après utilisation.';}
 return {name:def.name,stats:SPECS[item]||[],outcome};
}
export function recommendation(state,item){
 if(state.health<state.maxHealth*.5&&['medkit','trauma','bandage'].includes(item))return 100;
 if(state.core<70&&['repair','core_shield','core_rebuild'].includes(item))return 95;
 if(state.ammo<10&&['ammo','reserve_pack'].includes(item))return 90;
 if((state.armor||0)<30&&['armor','armor_heavy'].includes(item))return 60;
 return ['smoke','recon','radio'].includes(item)?25:0;
}
