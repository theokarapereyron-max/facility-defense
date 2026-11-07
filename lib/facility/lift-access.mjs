// Elevators are standalone transport, with no power grid or control console.
export function canUseLift(sim,l,floor,team='ally',target=floor){
 return !!l&&l.offlineUntil<=sim.time&&[floor,target].every(id=>Number.isInteger(id)&&id>=l.min&&id<=l.max&&!!sim.floor(id));
}
