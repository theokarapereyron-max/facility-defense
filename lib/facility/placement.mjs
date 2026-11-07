// Placement checks use the real navigation grid; doors remain traversable here
// because furniture must not make a room inaccessible even with its exits open.
export function preservesCirculation(f,r,blocked){
 const allowed=new Set(),cut=new Set(blocked),cols=f.cols;
 for(let y=r.y/32;y<(r.y+r.h)/32;y++)for(let x=r.x/32;x<(r.x+r.w)/32;x++){const i=y*cols+x;if(f.grid[i]===0||f.grid[i]===2)allowed.add(i);}
 const seen=new Set();
 const fill=(first,set)=>{const reached=new Set([first]),q=[first];for(let n=0;n<q.length;n++)for(const j of [q[n]-1,q[n]+1,q[n]-cols,q[n]+cols])if(set.has(j)&&!reached.has(j)&&(Math.abs(j-q[n])!==1||Math.floor(j/cols)===Math.floor(q[n]/cols))){reached.add(j);q.push(j);}return reached;};
 for(const i of allowed){if(seen.has(i))continue;const component=fill(i,allowed);for(const j of component)seen.add(j);const remaining=new Set([...component].filter(j=>!cut.has(j)));if(remaining.size&&fill(remaining.values().next().value,remaining).size!==remaining.size)return false;}
 return true;
}
