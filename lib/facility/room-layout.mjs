// Keep the building and capture points while the machines are rebuilt separately.
export function configureRoomRules(f){
 const posts=new Set([15,f.id===-2?10:f.id===1?14:6,f.id===-2?6:f.id===1?10:7,f.id===2?2:5,f.id===-2?1:f.id===1?14:4,f.id===-2?3:f.id===1?7:12,...f.supplies.map(s=>s.roomIndex)]);
 if(f.id===-2){posts.add(0);posts.add(4);}if([2,4,5].includes(f.id))posts.add(f.isRoof?16:3);if(f.id===2){posts.add(2);posts.add(8);}if(!f.isRoof)posts.add(f.id===-1?2:13);if(f.id===1){posts.add(2);posts.add(3);}
 for(const r of f.rooms){r.captureProgress=0;r.capturingTeam=null;r.strategic=posts.has(r.index)||r.type==='shop'||f.id===-2&&r.index===2;r.strategicValue=f.id===-2&&r.index===2?100:f.zones[r.index].strategicValue;}
 for(const r of f.rooms)for(const [i,d] of f.doors.filter(d=>d.roomIndex===r.index).entries()){
  d.maxHealth=d.health;d.category=i===0?'normal':f.id===-2&&r.index===2?'core':r.strategic?'security':d.type==='armored'?'blast':'normal';d.mechanical=i===0||d.category==='normal';
 }
 return f;
}
