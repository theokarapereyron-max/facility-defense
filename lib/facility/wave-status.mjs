export function updateWaveStatus(sim){
 for(const wave of sim.activeMajorWaves){
  if(wave.finished||!wave.landed)continue;
  const pending=sim.pendingWaves.some(p=>p.number===wave.number&&p.remaining>0),alive=sim.units.some(u=>u.team==='enemy'&&u.health>0&&u.waveNumber===wave.number);
  if(!pending&&!alive){wave.finished=true;sim.wavesRepelled++;sim.log('VAGUE '+wave.number+' REPOUSSÉE','Tous les membres de cet assaut ont été neutralisés.','success');}
 }
 sim.activeMajorWaves=sim.activeMajorWaves.filter(w=>!w.finished);
}
export function waveSummary(sim){
 const wave=sim.activeMajorWaves[0];
 if(!wave)return {phase:'waiting',number:sim.director.attackIndex+1,received:sim.wavesReceived,repelled:sim.wavesRepelled,inserted:0,total:0,alive:0};
 const pending=sim.pendingWaves.find(w=>w.number===wave.number)?.remaining||0;
 return {phase:!wave.landed?'incoming':pending?'insertion':'combat',number:wave.number,received:sim.wavesReceived,repelled:sim.wavesRepelled,inserted:wave.inserted,total:wave.total,alive:sim.units.filter(u=>u.team==='enemy'&&u.health>0&&u.waveNumber===wave.number).length};
}
