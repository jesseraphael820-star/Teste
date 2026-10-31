// Mapas originais em grade. Cada célula = CELL metros.
// Legenda:
//   #  parede alta            w  parede com janela (atira-se pela abertura)
//   =  mureta (cobertura baixa) o  pilha de caixas (cobertura alta)
//   b  barril / tambor        c  veículo abandonado
//   .  chão externo           i  chão interno (com teto)
//   a  spawn atacantes/time A  d  spawn defensores/time B
//   A  zona de plantio A      B  zona de plantio B
//   1 2 3  pontos de controle (modo Domínio) — também são chão
export const CELL = 2;

export const MAPS = [
  {
    id: 'usina',
    name: 'Usina Corvo',
    theme: 'industrial',
    blurb: 'Refinaria desativada à beira do rio. Galpões, tubulações e pátios abertos favorecem duelos de média distância.',
    sky: { top: 0x8aa3b8, bottom: 0xd8cbb3, fog: 0xbcb6a8, sun: 0xffe2b8, sunIntensity: 2.2, ambient: 0.55 },
    grid: [
      '############################################',
      '#oo.......#......#dddddddd#......#......oo.#',
      '#o........#..b...#dddddddd#...b..#.......o.#',
      '#.........w......#........#......w.........#',
      '#...==....#......##..##..##......#....==...#',
      '#.........#................................#',
      '#..AAAAA......oo..........oo.......BBBBB...#',
      '#..AAAAA......oo...######.oo.......BBBBB...#',
      '#..AA1AA...........#iiii#..........BB3BB...#',
      '#..AAAAA...b.......#iiii#.......b..BBBBB...#',
      '#..AAAAA...........w.ii.w..........BBBBB...#',
      '#.......=====......#ii2i#......=====.......#',
      '#####..............#iiii#..............#####',
      '#...#....####......##.###......####....#...#',
      '#...w....####..................####....w...#',
      '#...#....####....=........=....####....#...#',
      '#...#....####.......oo.........####....#...#',
      '#........####.......oo.........####........#',
      '#...#.......................b..........#...#',
      '#...#####....######....######....#####.#...#',
      '#...#iiii....#....#....#....#....#iii#.#...#',
      '#...#iiii....#.b..w....w..b.#....#iii#.....#',
      '#...wiiii....#....#....#....#....#iii#.#...#',
      '#...#iiii....##.###....###.##....##.##.#...#',
      '#...#.....................................##',
      '#....=.....oo.................oo....=......#',
      '#..........oo...==....==......oo...........#',
      '#####......#####..........#####......#######',
      '#..........#aaaaaaaaaaaaaaaaaaaa#..........#',
      '#.o........#aaaaaaaaaaaaaaaaaaaa#........o.#',
      '#..........#aaaaaaaaaaaaaaaaaaaa#..........#',
      '############################################',
    ],
  },
  {
    id: 'vila',
    name: 'Vila Ferro',
    theme: 'urbano',
    blurb: 'Bairro operário evacuado. Ruas estreitas, casas com janelas e carros abandonados criam muitos ângulos de flanco.',
    sky: { top: 0x6f8fb0, bottom: 0xe6c9a0, fog: 0xc9b8a0, sun: 0xffd09a, sunIntensity: 2.0, ambient: 0.6 },
    grid: [
      '############################################',
      '#.......#####....dddddddddd....#####.......#',
      '#.c.....#iii#....dddddddddd....#iii#.....c.#',
      '#.......#iii#..................#iii#.......#',
      '#..AAAA.#iiiw.......c..........wiii#.BBBB..#',
      '#..AAAA.#i#i#..................#i#i#.BBBB..#',
      '#..A1AA......====........====........BB3B..#',
      '#..AAAA..............oo..............BBBB..#',
      '#..AAAA..b...........oo...........b..BBBB..#',
      '#.....=......#####ww.ww#####.........=.....#',
      '####..####...#iiiiiiiiiiiii#...####..#######',
      '#......c.#...#iiiiiiiiiiiii#...#.c.........#',
      '#........w...#iiiiii2iiiiii#...w...........#',
      '#..####..#...#iiiiiiiiiiiii#...#..####.....#',
      '#..#ii#..#...####ii..ii#####...#..#ii#.....#',
      '#..wii#.............................#iiw...#',
      '#..#ii.......b.....c.......b........#ii#...#',
      '#..####....=====..........=====.....####...#',
      '#..........................................#',
      '#####...#####wwww###...###wwww#####...######',
      '#.......#iiiiiiiiii#...#iiiiiiiiii#........#',
      '#...c...#iiiiiiiiii....iiiiiiiiiii#....c...#',
      '#.......#iiiiiiiiii#...#iiiiiiiiii#........#',
      '#.......###ii#######...#######ii###........#',
      '#....................ooo...................#',
      '#...oo.......==.....c.......==.......oo....#',
      '#...oo..............................oo.....#',
      '#######.....#####........#####.....#########',
      '#...........#aaaaaaaaaaaaaaaaa#............#',
      '#..c........#aaaaaaaaaaaaaaaaa#.........c..#',
      '#...........#aaaaaaaaaaaaaaaaa#............#',
      '############################################',
    ],
  },
  {
    id: 'kessler',
    name: 'Instalação Kessler',
    theme: 'instalacao',
    blurb: 'Complexo de pesquisa abandonado. Corredores internos, laboratórios e um átrio central recompensam controle de utilitários.',
    sky: { top: 0x5d6d7c, bottom: 0xa9b3b8, fog: 0x8d969b, sun: 0xe8eef5, sunIntensity: 1.6, ambient: 0.7 },
    grid: [
      '############################################',
      '#iiiiiiiiii#iiiiiidddddddddiiiiii#iiiiiiiii#',
      '#iiiiiiiiii#iiiiiidddddddddiiiiii#iiiiiiiii#',
      '#iiAAAAAiiiwiiiiiiiiiiiiiiiiiiiiiwiiiBBBBBi#',
      '#iiAAAAAiiii#ii##iiiiiiiiiiiii##i#iiiBBBBBi#',
      '#iiAA1AAiiii#iiii#iiiooiiii#iiiiiiiiiBB3BBi#',
      '#iiAAAAAiiii#iiii#iiiiiiiii#iiii#iiiiBBBBBi#',
      '#iiiiiiiiiii#iiii#iiiiiiiii#iiii#iiiiiiiiii#',
      '#ii=====iiiiiiiii####ii#####iiiiiiii=====ii#',
      '#####ii####iiiiiiiiiiiiiiiiiiiii####ii######',
      '#.......#..........................#.......#',
      '#.......#...oo.......oo......oo....#.......#',
      '#..b....w.........==....==.........w....b..#',
      '#.......#..........................#.......#',
      '#..o....#.....=.......22.......=...#...o...#',
      '#.......#..........................#.......#',
      '#.......#...oo.......oo......oo....#.......#',
      '#.......#.........==....==.........#.......#',
      '#..b.......................................#',
      '#####ii####iiiiiiii###ii###iiiiiiii###ii####',
      '#iiiiiiiiii#iiiiiii#iiiiii#iiiiiiii#iiiiiii#',
      '#iiiiiiiiiiwiiiiiii#iiiiiiwiiiiiiiiwiiiiiii#',
      '#iiiiooiiii#iiiiiii#iiiiii#iiiiiiii#iiiooii#',
      '#iiiiiiiiii#iiiiiiiiiiiiii#iiiiiiii#iiiiiii#',
      '#####ii#####ii#####iiiiiii####ii####ii######',
      '#..........................................#',
      '#...==.......oo..............oo.......==...#',
      '#..........................................#',
      '######......#####..........#####......######',
      '#...........#aaaaaaaaaaaaaaaaaa#...........#',
      '#...........#aaaaaaaaaaaaaaaaaa#...........#',
      '############################################',
    ],
  },
];

// Estande de treino: raias abertas com coberturas para praticar duelos e rastreamento.
export const TRAINING_MAP = {
  id: 'campo',
  name: 'Campo de Provas',
  theme: 'industrial',
  training: true,
  blurb: 'Estande de tiro e arena de duelo.',
  sky: { top: 0x88a6c0, bottom: 0xdcd3c0, fog: 0xc8c2b4, sun: 0xfff0d0, sunIntensity: 2.2, ambient: 0.6 },
  grid: [
    '##############################',
    '#............................#',
    '#............................#',
    '#..........dddddd............#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#....oo........b.......oo....#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#.......=====......=====.....#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#=====..====.aaaa.====..=====#',
    '#............aaaa............#',
    '##############################',
  ],
};

export function parseMap(def) {
  const h = def.grid.length;
  const w = def.grid[0].length;
  const cells = [];
  const spawns = { a: [], d: [] };
  const sites = { A: [], B: [] };
  const points = { 1: [], 2: [], 3: [] };
  for (let z = 0; z < h; z++) {
    const row = def.grid[z];
    for (let x = 0; x < w; x++) {
      const ch = row[x] || '#';
      cells.push(ch);
      const wx = (x + 0.5) * CELL, wz = (z + 0.5) * CELL;
      if (ch === 'a' || ch === 'd') spawns[ch].push({ x: wx, z: wz });
      if (ch === 'A' || ch === 'B') sites[ch].push({ x: wx, z: wz });
      if (ch === '1' || ch === '2' || ch === '3') points[ch].push({ x: wx, z: wz });
    }
  }
  const centroid = (arr) => {
    if (!arr.length) return null;
    let sx = 0, sz = 0;
    for (const p of arr) { sx += p.x; sz += p.z; }
    return { x: sx / arr.length, z: sz / arr.length };
  };
  const siteInfo = {};
  for (const k of ['A', 'B']) {
    const c = centroid(sites[k]);
    let r = 0;
    for (const p of sites[k]) r = Math.max(r, Math.hypot(p.x - c.x, p.z - c.z));
    siteInfo[k] = { name: k, center: c, radius: r + CELL * 0.6, cells: sites[k] };
  }
  const map = { def, w, h, cells, spawns, sites: siteInfo, points: [], markedPoints: points };
  map.points = fairPoints(map);
  return map;
}

// Pontos de controle equidistantes (por caminho a pé) dos dois spawns:
// Bravo no meio exato; Alfa e Charlie espelhados — cada equipe tem um ponto
// "de casa" à mesma distância. Assim nenhum lado começa com vantagem.
function fairPoints(map) {
  const { w, h, cells } = map;
  if (!map.spawns.a.length || !map.spawns.d.length) return [];
  const walk = (i) => !BLOCKING.has(cells[i]);
  const bfs = (ch) => {
    const d = new Float32Array(w * h).fill(Infinity);
    const q = [];
    cells.forEach((c, i) => { if (c === ch) { d[i] = 0; q.push(i); } });
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % w, z = (i / w) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const ni = nz * w + nx;
        if (d[ni] !== Infinity || !walk(ni)) continue;
        d[ni] = d[i] + 1; q.push(ni);
      }
    }
    return d;
  };
  const dA = bfs('a'), dD = bfs('d');
  const open = (i) => {
    const x = i % w, z = (i / w) | 0;
    let n = 0;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const nx = x + ox, nz = z + oz;
      if (nx >= 0 && nz >= 0 && nx < w && nz < h && walk(nz * w + nx)) n++;
    }
    return n;
  };
  const toPos = (i) => ({ x: (i % w + 0.5) * CELL, z: (((i / w) | 0) + 0.5) * CELL });
  const cand = [];
  for (let i = 0; i < w * h; i++) if (walk(i) && dA[i] < Infinity && dD[i] < Infinity && open(i) >= 8 && !'ad'.includes(cells[i])) cand.push(i);
  const dist = (i, p) => { const q = toPos(i); return Math.hypot(q.x - p.x, q.z - p.z); };
  const mid = { x: w * CELL / 2, z: h * CELL / 2 };
  const best = (score) => cand.reduce((b, i) => (score(i) < score(b) ? i : b), cand[0]);
  const bravo = best((i) => Math.abs(dA[i] - dD[i]) * 10 + dist(i, mid) * 0.2);
  const siteA = map.sites.A.center || { x: w * CELL * 0.25, z: mid.z };
  const siteB = map.sites.B.center || { x: w * CELL * 0.75, z: mid.z };
  const alfa = best((i) => Math.abs(dA[i] / (dA[i] + dD[i]) - 0.32) * 60 + dist(i, siteA) * 0.08 + (dist(i, toPos(bravo)) < 18 ? 50 : 0));
  const ap = toPos(alfa), mirror = { x: w * CELL - ap.x, z: h * CELL - ap.z };
  const charlie = best((i) => (Math.abs(dD[i] - dA[alfa]) + Math.abs(dA[i] - dD[alfa])) * 10 + dist(i, mirror) * 0.15 + (dist(i, toPos(bravo)) < 18 ? 50 : 0));
  return [[alfa, '1', 'Alfa'], [bravo, '2', 'Bravo'], [charlie, '3', 'Charlie']].map(([i, id, label]) => ({ id, label, center: toPos(i), radius: 5, distA: dA[i], distD: dD[i] }));
}

export function cellAt(map, x, z) {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  if (cx < 0 || cz < 0 || cx >= map.w || cz >= map.h) return '#';
  return map.cells[cz * map.w + cx];
}

export const BLOCKING = new Set(['#', 'w', '=', 'o', 'b', 'c']);
export function isWalkableChar(ch) { return !BLOCKING.has(ch); }
