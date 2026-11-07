export const ROOF_INTERVAL=30;
function rolesFor(soldiers,index=0,elite=false){
 const roles=elite?['medic','commando','commando','commando','commando','marksman','heavy']:['rifleman','assault','medic','rifleman',index%2?'marksman':'heavy','marksman','rifleman'];
 return ['officer',...Array.from({length:soldiers},(_,i)=>roles[i%roles.length])];
}
export function roofPlan(){
 return {formation:'patrouille-medicale',squads:[{route:'charlie',roles:['officer','rifleman','rifleman','rifleman','rifleman','medic'],index:0}],remaining:6};
}
export function majorWavePlan(number,random){
 // Entire squads: roughly 70% roof, 15–20% flanking assault, 10–15% elite infiltration.
 const totalSquads=12+number*4,eliteSquads=Math.max(2,Math.floor(totalSquads*.15)),flankSquads=Math.floor(totalSquads*.2);
 let roof=totalSquads-eliteSquads-flankSquads,elite=eliteSquads,flank=flankSquads;
 const squads=[],flankRoute=random()<.5?'alpha':'bravo',floor=[-1,0,1,2][Math.min(3,Math.floor(random()*4))];
 // Interleave fronts so commandos arrive during the roof assault, not after it.
 while(roof||elite||flank){
  if(roof){squads.push({route:'charlie',roles:rolesFor(7,squads.length)});roof--;}
  if(elite){squads.push({route:'charlie',floor,roles:rolesFor(7,0,true),elite:true});elite--;}
  if(roof){squads.push({route:'charlie',roles:rolesFor(7,squads.length)});roof--;}
  if(flank){squads.push({route:flankRoute,roles:rolesFor(7,squads.length)});flank--;}
 }
 return {number,squads:squads.map((s,index)=>({...s,index})),remaining:totalSquads*8,total:totalSquads*8,resuppliedFloors:[]};
}
