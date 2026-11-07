// One occupied slot holds one item type, up to that item's own stack limit.
export const ITEMS={
 grenade:{name:'Grenade à fragmentation',short:'Grenade',icon:'Bomb',stack:3,color:'#dfa272',description:'Lancée devant vous. Explose après 1,2 s : jusqu’à 150 dégâts dans un rayon de 5,6 m. Attention aux alliés et à vous-même.'},
 flash:{name:'Grenade aveuglante',short:'Flash',icon:'Sun',stack:2,color:'#f0dfa0',description:'Lancée devant vous. Désoriente les soldats visibles dans un rayon de 6,9 m pendant 3 s, alliés compris.'},
 bandage:{name:'Pansement de combat',short:'Pansement',icon:'Bandage',stack:4,color:'#a5d8b0',description:'Restaure immédiatement 30 PV. Conservé si votre santé est au maximum.'},
 medkit:{name:'Trousse de secours',short:'Trousse',icon:'BriefcaseMedical',stack:2,color:'#91cdb4',description:'Restaure immédiatement 80 PV, sans dépasser votre santé maximale.'},
 ration:{name:'Ration énergétique',short:'Ration',icon:'Utensils',stack:4,color:'#d2ba86',description:'Récupère 30 PV en 10 secondes. Une seule ration active à la fois.'},
 ammo:{name:'Boîte de munitions',short:'Munitions',icon:'Package',stack:3,color:'#cfbb7e',description:'Ajoute 120 cartouches à la réserve de l’arme en main (60 pour le pistolet). Ne recharge pas le chargeur.'},
 xp:{name:'Fiole d’XP',short:'Fiole XP',icon:'FlaskConical',stack:3,color:'#93c9eb',description:'Objet de jeu : accorde 100 XP. Les promotions et les cases supplémentaires se débloquent immédiatement.'},
 manual:{name:'Dossier d’instruction',short:'Dossier XP',icon:'BookOpen',stack:1,color:'#8bb7d2',description:'Accorde 350 XP d’instruction. Objet non empilable.'},
 radio:{name:'Balise de renforts',short:'Renforts',icon:'Radio',stack:1,color:'#aabfdb',description:'Appelle 8 alliés sur le toit, dans 12 s : officier, médecin, appui et fusiliers. Nécessite 8 places disponibles.'},
 repair:{name:'Module de secours du Core',short:'Module Core',icon:'Wrench',stack:1,color:'#9cd2cb',description:'Restaure 20 points de contrôle. Utilisable uniquement à proximité du Core, au niveau −2.'},
 armor:{name:'Plaque de protection',short:'Protection',icon:'Shield',stack:1,color:'#a2b6c7',description:'Équipe une protection absorbant 60 dégâts avant les PV. Conservée tant que votre protection est intacte.'},
 breach:{name:'Charge de brèche',short:'Brèche',icon:'DoorOpen',stack:1,color:'#e5a58a',description:'Détruit la porte fermée vers laquelle vous regardez, à moins de 4,4 m. Le passage reste ouvert.'},
 scanner:{name:'Détecteur portable',short:'Détecteur',icon:'Radar',stack:1,color:'#8bd2bf',description:'Révèle les hostiles de votre étage sur les cartes pendant 15 s. Le signal reste sur l’étage où il est activé.'},
 xp_major:{name:'Programme d’instruction avancée',short:'XP majeur',icon:'BookOpen',stack:1,color:'#c1a8ef',description:'Accorde immédiatement 2 000 XP. Les promotions, primes inédites et capacités sont recalculées.'},
 stasis:{name:'Impulsion de stase',short:'Stase',icon:'Snowflake',stack:1,color:'#a9e4f2',description:'Technologie fictive : immobilise tous les ennemis et bloque leurs tirs, soins et captures pendant 12 s, y compris les nouveaux arrivants.'},
 core_rebuild:{name:'Restauration intégrale du Core',short:'Core 100 %',icon:'ShieldPlus',stack:1,color:'#83e9cb',description:'Rétablit immédiatement le contrôle du Core à 100 %, depuis tout étage. Ne peut pas relancer une partie déjà perdue.'},
 radio_target:{name:'Renforts avec affectation',short:'Renforts ciblés',icon:'Radio',stack:1,color:'#aabfdb',description:'Choisissez une salle sur n’importe quel niveau : 8 alliés débarquent sur le toit dans 12 s, puis la rejoignent par les accès verticaux.'},
 door_kit:{name:'Kit de réparation de porte',short:'Répar. porte',icon:'Wrench',stack:2,color:'#cbb58b',description:'Répare une porte endommagée ou détruite à moins de 5,6 m. Elle retrouve son fonctionnement et sa résistance complète.'},
 trauma:{name:'Kit de stabilisation complète',short:'Soins complets',icon:'BriefcaseMedical',stack:2,color:'#91e8b0',description:'Restaure tous vos PV. Conservé si votre santé est déjà au maximum.'},
 team_med:{name:'Trousse médicale collective',short:'Soins groupe',icon:'HeartPulse',stack:2,color:'#96dcc2',description:'Restaure 60 PV à chaque allié vivant et visible à moins de 11 m, vous compris. Ne ressuscite personne.'},
 armor_heavy:{name:'Protection balistique renforcée',short:'Blindage',icon:'Shield',stack:1,color:'#b0c6df',description:'Équipe 180 points de protection avant les PV. Remplace la plaque existante, sans additionner les protections.'},
 adrenaline:{name:'Stimulant de mobilité',short:'Mobilité',icon:'Zap',stack:2,color:'#e5d68a',description:'Augmente votre vitesse de déplacement de 25 % pendant 30 s. Ne se cumule pas avec un autre stimulant.'},
 overdrive:{name:'Module de cadence',short:'Cadence',icon:'Crosshair',stack:1,color:'#eeab8d',description:'Réduit de 35 % le délai entre vos tirs pendant 25 s. Consomme normalement les munitions et conserve les rechargements.'},
 incendiary:{name:'Grenade incendiaire',short:'Incendiaire',icon:'Flame',stack:3,color:'#f2a66f',description:'Crée un feu pendant 8 s dans un rayon de 5 m. Inflige 18 dégâts par seconde, alliés compris ; les obstacles protègent.'},
 smoke:{name:'Grenade fumigène',short:'Fumigène',icon:'Cloud',stack:3,color:'#b7c8c3',description:'Masque les lignes de vue des PNJ pendant 15 s dans un rayon de 6,2 m. Les balles peuvent toujours traverser la fumée.'},
 recon:{name:'Reconnaissance du complexe',short:'Recon globale',icon:'Radar',stack:1,color:'#98dfc9',description:'Révèle les hostiles sur les cartes des huit niveaux pendant 60 s.'},
 core_shield:{name:'Protection temporaire du Core',short:'Bouclier Core',icon:'ShieldPlus',stack:1,color:'#8adad4',description:'Réduit de 80 % la vitesse de capture du Core pendant 30 s. Ne supprime pas les ennemis présents.'},
 door_armor:{name:'Renfort de porte',short:'Porte blindée',icon:'DoorOpen',stack:2,color:'#d9c393',description:'Ajoute 200 PV maximum à une porte intacte à moins de 5,6 m et la répare. Un seul renfort par porte.'},
 reserve_pack:{name:'Ravitaillement intégral d’arme',short:'Plein de munit.',icon:'Package',stack:2,color:'#d9c691',description:'Remplit le chargeur et la réserve de l’arme en main. Interrompt son rechargement en cours.'},
};
export const SLOT_KEYS=['Y','U','I','O','P','H','J','K','L','F','G','T','A','Alt+Y','Alt+U','Alt+I','Alt+O'];
export const inventoryCapacity=p=>3+Math.floor(Math.max(0,Math.min(29,p.rank||0))/2);
export function slotForKey(e){
 if(e.ctrlKey||e.metaKey)return -1;
 const label=(e.altKey?'Alt+':'')+e.key.toUpperCase();return SLOT_KEYS.indexOf(label);
}
export function storageSpace(slots,capacity,item){
 const def=ITEMS[item];if(!def)return 0;
 let free=0;for(let i=0;i<capacity;i++){const s=slots[i];if(!s)free+=def.stack;else if(s.item===item)free+=Math.max(0,def.stack-s.count);}return free;
}
export function addItems(slots,capacity,item,count){
 const def=ITEMS[item];if(!def||!Number.isInteger(count)||count<1)return 0;
 let remaining=count;
 for(let i=0;i<capacity&&remaining;i++){const s=slots[i];if(s?.item===item){const n=Math.min(remaining,Math.max(0,def.stack-s.count));s.count+=n;remaining-=n;}}
 for(let i=0;i<capacity&&remaining;i++)if(!slots[i]){const n=Math.min(remaining,def.stack);slots[i]={item,count:n};remaining-=n;}
 return count-remaining;
}
export function transferStack(source,index,target,capacity,amount=Infinity){
 if(source===target||!Number.isInteger(index)||index<0)return 0;
 const s=source[index];if(!s||!(amount>0))return 0;
 const moved=addItems(target,capacity,s.item,Math.min(s.count,Math.floor(amount)));
 if(moved){s.count-=moved;if(!s.count)source[index]=null;}return moved;
}
export const occupied=slots=>slots.filter(Boolean).length;
