export const SHOP_CATEGORIES=[
 {id:'combat',name:'Armement',color:'#dfb876',items:['grenade','flash','ammo','breach','overdrive','incendiary','smoke','reserve_pack']},
 {id:'medical',name:'Soins & mobilité',color:'#9bdbb8',items:['bandage','medkit','ration','trauma','team_med','adrenaline']},
 {id:'protection',name:'Protection',color:'#99c7df',items:['armor','armor_heavy','repair','core_rebuild','core_shield','door_armor']},
 {id:'support',name:'Logistique',color:'#d0bcdf',items:['radio','radio_target','door_kit']},
 {id:'intelligence',name:'Instruction & détection',color:'#a4d8d3',items:['xp','manual','xp_major','scanner','recon']}
];
export const categoryFor=item=>SHOP_CATEGORIES.find(c=>c.items.includes(item))?.id||'support';
