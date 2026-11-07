// Mission-local currency; no purchase with real money and no persistence between missions.
export function earnCredits(sim,amount,label){
 if(!Number.isSafeInteger(amount)||amount<=0)return 0;
 const p=sim.player;p.credits=(p.credits||0)+amount;
 sim.moneyEvents.push({id:++sim.moneySerial,amount,label,time:sim.time});sim.moneyEvents=sim.moneyEvents.slice(-4);return amount;
}
export function rewardPromotions(sim){
 const p=sim.player,highest=p.paidRank||0;let bonus=0;
 for(let r=highest+1;r<=p.rank;r++)bonus+=75+r*25;
 p.paidRank=Math.max(highest,p.rank);if(bonus)earnCredits(sim,bonus,'Prime de promotion');return bonus;
}
export function killCredits(xp){return Math.max(20,Math.round(xp*.6));}
