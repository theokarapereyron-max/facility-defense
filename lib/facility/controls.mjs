// AZERTY labels are read from key, while the number row also works without Shift.
export function controlKey(event){
 if(event.code==='Space')return ' ';
 if(event.code==='Digit1')return '1';
 if(event.code==='Digit2')return '2';
 return event.key.toLowerCase();
}
export function readControls(keys,touch={},mode="up"){
 const input={
  x:(keys.has('d')?1:0)-(keys.has('q')?1:0)+(touch.x||0),
  y:(keys.has('s')?1:0)-(keys.has('z')?1:0)+(touch.y||0),
  turn:((keys.has('arrowright')?1:0)-(keys.has('arrowleft')?1:0))*(mode==='down'?-1:1),
  fire:keys.has(' ')||!!touch.fire,sprint:keys.has('shift'),reload:keys.has('r'),interact:keys.has('e')||!!touch.interact
 };
 if(touch.fire&&Number.isFinite(touch.angle))input.angle=touch.angle;
 return input;
}

export function faceVertical(player,key){if(key!=="arrowup"&&key!=="arrowdown")return;player.turnMode=key==="arrowdown"?"down":"up";player.angle=key==="arrowdown"?Math.PI/2:-Math.PI/2;}
