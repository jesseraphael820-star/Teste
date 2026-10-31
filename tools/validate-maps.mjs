import { MAPS, parseMap, isWalkableChar } from '../js/maps.js';
let ok = true;
for (const def of MAPS) {
  const bad = def.grid.map((r,i)=>[i,r.length]).filter(([,l])=>l!==def.grid[0].length);
  if (bad.length) { ok=false; console.log(def.id,'row length mismatch',bad, 'expected', def.grid[0].length); }
  const m = parseMap(def);
  // BFS from attacker spawn
  const start = def.grid.findIndex(r=>r.includes('a'));
  const sx = def.grid[start].indexOf('a');
  const seen = new Set([start*m.w+sx]); const q=[[sx,start]];
  while(q.length){const [x,z]=q.shift();for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=m.w||nz>=m.h)continue;const k=nz*m.w+nx;if(seen.has(k))continue;if(!isWalkableChar(m.cells[k]))continue;seen.add(k);q.push([nx,nz]);}}
  const unreach=[]; m.cells.forEach((c,i)=>{ if(isWalkableChar(c)&&!seen.has(i)) unreach.push([i%m.w,Math.floor(i/m.w),c]); });
  const need = ['d','A','B','1','2','3'].filter(ch=>!m.cells.some((c,i)=>c===ch&&seen.has(i)));
  console.log(def.id, `${m.w}x${m.h}`, 'unreachable:', unreach.length, unreach.slice(0,8).join(' | '), 'missing:', need.join(','), 'points', m.points.length, 'spawns', m.spawns.a.length, m.spawns.d.length);
  if (need.length) ok=false;
}
process.exit(ok?0:1);
