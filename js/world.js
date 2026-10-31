// Constrói a cena a partir da grade, além de colisão, raycast e navegação.
import * as THREE from './vendor/three.module.min.js';
import { CELL, cellAt, isWalkableChar } from './maps.js';
import { texture, softSprite } from './textures.js';
import { settings } from './settings.js';

const H = { '#': 5, '=': 1.05, o: 2.1, c: 1.45, b: 1.15 };
const WIN_LOW = 1.0, WIN_HIGH = 2.0, CEIL = 4.2;

export class World {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    this.boxes = [];         // colisores estáticos {min,max,surface}
    this.dynamic = [];       // barreiras etc.
    this.smokes = [];        // {x,y,z,r,until}
    this.group = new THREE.Group();
    scene.add(this.group);
    this.matCache = {};
    this.build();
  }

  mat(kind, tint, opts = {}) {
    const key = kind + (tint || '') + JSON.stringify(opts);
    if (!this.matCache[key]) {
      this.matCache[key] = new THREE.MeshStandardMaterial({ map: texture(kind, tint), roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0.05, color: opts.color ?? 0xffffff });
    }
    return this.matCache[key];
  }

  // Caixa com UV proporcional ao tamanho (texturas não esticam).
  boxMesh(w, h, d, material, uvScale = 0.5) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
      let su, sv;
      if (nx > 0.5) { su = d; sv = h; } else if (ny > 0.5) { su = w; sv = d; } else { su = w; sv = h; }
      uv.setXY(i, uv.getX(i) * su * uvScale, uv.getY(i) * sv * uvScale);
    }
    const m = new THREE.Mesh(g, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  addBox(x0, y0, z0, x1, y1, z1, material, surface = 'concrete', collide = true, uvScale = 0.5) {
    const m = this.boxMesh(x1 - x0, y1 - y0, z1 - z0, material, uvScale);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.group.add(m);
    if (collide) this.boxes.push({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 }, surface });
    return m;
  }

  hash(x, z) { return ((x * 73856093) ^ (z * 19349663)) >>> 0; }

  wallMaterial(x, z) {
    const t = this.map.def.theme;
    const h = this.hash(x, z) % 5;
    if (t === 'industrial') return h < 2 ? [this.mat('container', ['#2f5d73', '#7a3b2a', '#5a6b3a'][h % 3], { metal: 0.4, rough: 0.6 }), 'metal'] : [this.mat('concrete', '#8a857b'), 'concrete'];
    if (t === 'urbano') return h < 3 ? [this.mat('brick', ['#7a4434', '#6e5040', '#8a5a3a'][h % 3]), 'concrete'] : [this.mat('plaster', ['#b9ad98', '#a7b0a4'][h % 2]), 'concrete'];
    return h < 3 ? [this.mat('concrete', '#a9aaa4'), 'concrete'] : [this.mat('tiles', '#c4cbc9'), 'concrete'];
  }

  build() {
    const { map } = this;
    const { w, h } = map;
    const C = CELL;
    const theme = map.def.theme;
    const done = new Uint8Array(w * h);

    // chão
    const floorKind = theme === 'urbano' ? 'asphalt' : theme === 'industrial' ? 'dirt' : 'concrete';
    const floorMat = new THREE.MeshStandardMaterial({ map: texture(floorKind, floorKind === 'concrete' ? '#7d7e7a' : undefined, w * C / 6), roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w * C, h * C), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(w * C / 2, 0, h * C / 2);
    floor.receiveShadow = true;
    this.group.add(floor);

    // agrupamento guloso de células iguais
    const merge = (chars, cb) => {
      for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
        const i = z * w + x; const ch = map.cells[i];
        if (done[i] || !chars.includes(ch)) continue;
        let x1 = x;
        while (x1 + 1 < w && map.cells[z * w + x1 + 1] === ch && !done[z * w + x1 + 1]) x1++;
        let z1 = z;
        outer: while (z1 + 1 < h) {
          for (let k = x; k <= x1; k++) if (map.cells[(z1 + 1) * w + k] !== ch || done[(z1 + 1) * w + k]) break outer;
          z1++;
        }
        for (let zz = z; zz <= z1; zz++) for (let k = x; k <= x1; k++) done[zz * w + k] = 1;
        cb(ch, x, z, x1, z1);
      }
    };

    merge(['#'], (ch, x, z, x1, z1) => {
      const [m, surf] = this.wallMaterial(x, z);
      const isBorder = x === 0 || z === 0 || x1 === w - 1 || z1 === h - 1;
      const top = isBorder ? 7 : H['#'] + (this.hash(x, z) % 3) * 0.5;
      this.addBox(x * C, 0, z * C, (x1 + 1) * C, top, (z1 + 1) * C, m, surf);
      // rodapé/encardido
      if (!isBorder && theme !== 'instalacao') {
        const trim = this.mat('concrete', '#4b4740');
        this.addBox(x * C - 0.03, 0, z * C - 0.03, (x1 + 1) * C + 0.03, 0.35, (z1 + 1) * C + 0.03, trim, surf, false);
      }
    });

    merge(['w'], (ch, x, z, x1, z1) => {
      const [m, surf] = this.wallMaterial(x, z);
      this.addBox(x * C, 0, z * C, (x1 + 1) * C, WIN_LOW, (z1 + 1) * C, m, surf);
      this.addBox(x * C, WIN_HIGH, z * C, (x1 + 1) * C, H['#'], (z1 + 1) * C, m, surf);
      const frame = this.mat('metal', '#3a3d40', { metal: 0.6, rough: 0.5 });
      this.addBox(x * C - 0.02, WIN_LOW - 0.06, z * C - 0.02, (x1 + 1) * C + 0.02, WIN_LOW, (z1 + 1) * C + 0.02, frame, 'metal', false);
    });

    merge(['='], (ch, x, z, x1, z1) => {
      const m = theme === 'instalacao' ? this.mat('hazard') : theme === 'urbano' ? this.mat('concrete', '#9a958c') : this.mat('concrete', '#8f8a80');
      const inset = 0.25;
      const horiz = (x1 - x) >= (z1 - z);
      this.addBox(x * C + (horiz ? 0 : inset), 0, z * C + (horiz ? inset : 0), (x1 + 1) * C - (horiz ? 0 : inset), H['='], (z1 + 1) * C - (horiz ? inset : 0), m, 'concrete');
    });

    // caixas, carros, barris: um por célula para variação visual
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const ch = map.cells[z * w + x];
      const cx = (x + 0.5) * C, cz = (z + 0.5) * C;
      const r = this.hash(x, z);
      if (ch === 'o') {
        const crate = theme === 'instalacao' ? this.mat('metal', '#5e6a70', { metal: 0.5, rough: 0.5 }) : this.mat('crate');
        const s = C * 0.48;
        this.addBox(cx - s, 0, cz - s, cx + s, 1.05, cz + s, crate, theme === 'instalacao' ? 'metal' : 'wood', false, 1 / 1.9);
        const s2 = s * 0.82, off = ((r % 7) / 7 - 0.5) * 0.3;
        const top = this.addBox(cx - s2 + off, 1.05, cz - s2 - off, cx + s2 + off, H.o, cz + s2 - off, crate, 'wood', false, 1 / 1.6);
        top.rotation.y = ((r % 13) / 13 - 0.5) * 0.3;
        this.boxes.push({ min: { x: cx - s, y: 0, z: cz - s }, max: { x: cx + s, y: H.o, z: cz + s }, surface: 'wood' });
      } else if (ch === 'b') {
        const bm = new THREE.MeshStandardMaterial({ map: texture('metal', ['#6b2f22', '#2f4e6b', '#4f5a2e'][r % 3]), metalness: 0.5, roughness: 0.6 });
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, H.b, 16), bm);
        bar.position.set(cx + ((r % 5) - 2) * 0.1, H.b / 2, cz); bar.castShadow = bar.receiveShadow = true;
        this.group.add(bar);
        const bar2 = bar.clone(); bar2.position.x += 0.5; bar2.position.z += 0.45; this.group.add(bar2);
        this.boxes.push({ min: { x: cx - 0.6, y: 0, z: cz - 0.6 }, max: { x: cx + 0.95, y: H.b, z: cz + 0.95 }, surface: 'metal' });
      } else if (ch === 'c') {
        this.buildCar(cx, cz, r);
      }
    }

    // tetos internos + iluminação interna
    const ceilMat = this.mat('concrete', '#5d5a55');
    const interiorLights = [];
    const doneI = new Uint8Array(w * h);
    for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
      const i = z * w + x;
      if (doneI[i] || !this.isInterior(x, z)) continue;
      let x1 = x;
      while (x1 + 1 < w && this.isInterior(x1 + 1, z) && !doneI[z * w + x1 + 1]) x1++;
      let z1 = z;
      outer: while (z1 + 1 < h) {
        for (let k = x; k <= x1; k++) if (!this.isInterior(k, z1 + 1) || doneI[(z1 + 1) * w + k]) break outer;
        z1++;
      }
      for (let zz = z; zz <= z1; zz++) for (let k = x; k <= x1; k++) doneI[zz * w + k] = 1;
      this.addBox(x * C, CEIL, z * C, (x1 + 1) * C, CEIL + 0.3, (z1 + 1) * C, ceilMat, 'concrete', false);
      const interiorFloor = this.mat(theme === 'urbano' ? 'tiles' : theme === 'instalacao' ? 'tiles' : 'concrete', theme === 'urbano' ? '#8c7c66' : '#9aa3a3');
      const f = this.boxMesh((x1 - x + 1) * C, 0.02, (z1 - z + 1) * C, interiorFloor, 0.5);
      f.position.set((x + x1 + 1) * C / 2, 0.011, (z + z1 + 1) * C / 2); f.castShadow = false;
      this.group.add(f);
      // luminárias a cada ~3 células
      for (let zz = z; zz <= z1; zz += 3) for (let k = x; k <= x1; k += 3) {
        const lx = (k + 0.5) * C, lz = (zz + 0.5) * C;
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.25), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: theme === 'instalacao' ? 0xcfe8ff : 0xffe2b0, emissiveIntensity: 1.6 }));
        lamp.position.set(lx, CEIL - 0.03, lz);
        this.group.add(lamp);
        interiorLights.push({ x: lx, z: lz });
      }
    }
    // poucas luzes pontuais (custo) distribuídas pelos interiores
    const maxLights = settings.quality === 'baixa' ? 4 : settings.quality === 'media' ? 8 : 14;
    const step = Math.max(1, Math.ceil(interiorLights.length / maxLights));
    for (let i = 0; i < interiorLights.length; i += step) {
      const p = interiorLights[i];
      const L = new THREE.PointLight(theme === 'instalacao' ? 0xd8ecff : 0xffd9a0, 14, 16, 1.6);
      L.position.set(p.x, CEIL - 0.4, p.z);
      this.group.add(L);
    }

    this.buildSiteMarkers();
    this.buildBackdrop();
    this.buildProps();
  }

  isInterior(x, z) {
    if (x < 0 || z < 0 || x >= this.map.w || z >= this.map.h) return false;
    const ch = this.map.cells[z * this.map.w + x];
    if (ch === 'i') return true;
    if (ch === '#' || ch === 'w') return false;
    // células especiais cercadas por interior (spawn/ponto dentro de prédio)
    if ('ad123AB'.includes(ch)) {
      let n = 0, t = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c2 = this.map.cells[(z + dz) * this.map.w + x + dx];
        if (!c2) continue; t++;
        if (c2 === 'i' || c2 === '#' || c2 === 'w' || c2 === ch) n++;
      }
      return this.map.def.theme === 'instalacao' ? n >= 3 && this.nearInterior(x, z) : false;
    }
    return false;
  }
  nearInterior(x, z) {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const c2 = this.map.cells[(z + dz) * this.map.w + x + dx];
      if (c2 === 'i') return true;
    }
    return false;
  }

  buildCar(cx, cz, r) {
    const colors = [0x6e2b26, 0x2f4f6f, 0x8c8a80, 0x3b4a32, 0x1f1f22];
    const body = new THREE.MeshStandardMaterial({ color: colors[r % colors.length], metalness: 0.6, roughness: 0.45, map: texture('metal', '#888888') });
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2228, metalness: 0.9, roughness: 0.15 });
    const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const g = new THREE.Group();
    const rot = (r % 2) * Math.PI / 2 + ((r % 9) / 9 - 0.5) * 0.4;
    const L = 3.6, W = 1.7;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(L, 0.75, W), body); lower.position.y = 0.6;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.55, W * 0.92), glass); cabin.position.set(-0.15, 1.2, 0);
    g.add(lower, cabin);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 14), tire);
      t.rotation.x = Math.PI / 2; t.position.set(sx * L * 0.32, 0.33, sz * W * 0.48); g.add(t);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(cx, 0, cz); g.rotation.y = rot;
    this.group.add(g);
    // colisão aproximada: AABB do carro rotacionado
    const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
    const hx = (L * c + W * s) / 2, hz = (L * s + W * c) / 2;
    this.boxes.push({ min: { x: cx - hx, y: 0, z: cz - hz }, max: { x: cx + hx, y: H.c, z: cz + hz }, surface: 'metal' });
  }

  buildSiteMarkers() {
    const mk = (text, color, x, z, size) => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      g.strokeStyle = color; g.lineWidth = 10; g.globalAlpha = 0.75;
      g.strokeRect(14, 14, 228, 228);
      g.fillStyle = color; g.font = 'bold 170px Inter, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 128, 138);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z);
      this.group.add(m);
      return m;
    };
    this.siteMarkers = [];
    for (const k of ['A', 'B']) {
      const s = this.map.sites[k];
      if (s?.center) this.siteMarkers.push(mk(k, '#e8c547', s.center.x, s.center.z, 3.2));
    }
    this.pointMarkers = {};
    for (const p of this.map.points) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.radius - 0.25, p.radius, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.center.x, 0.04, p.center.z);
      ring.visible = false;
      this.group.add(ring);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.7 }));
      pole.position.set(p.center.x, 1.6, p.center.z); pole.visible = false; this.group.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshStandardMaterial({ color: 0xdddddd, side: THREE.DoubleSide, emissive: 0x222222 }));
      flag.position.set(p.center.x + 0.5, 2.85, p.center.z); flag.visible = false; this.group.add(flag);
      this.pointMarkers[p.id] = { ring, pole, flag };
    }
  }

  setPointVisuals(id, color, visible = true) {
    const m = this.pointMarkers[id];
    if (!m) return;
    m.ring.visible = m.pole.visible = m.flag.visible = visible;
    m.ring.material.color.set(color);
    m.flag.material.color.set(color);
    m.flag.material.emissive.set(color).multiplyScalar(0.3);
  }

  buildBackdrop() {
    const { w, h } = this.map;
    const W = w * CELL, D = h * CELL;
    const theme = this.map.def.theme;
    const mat = new THREE.MeshStandardMaterial({ color: theme === 'urbano' ? 0x5b5450 : 0x4a4f52, roughness: 1, map: texture(theme === 'urbano' ? 'brick' : 'concrete', theme === 'urbano' ? '#5e4a40' : '#6a6d6b') });
    const rnd = (i) => ((this.hash(i, 77) % 1000) / 1000);
    for (let i = 0; i < 46; i++) {
      const side = i % 4;
      const t = rnd(i);
      const bw = 6 + rnd(i + 100) * 14, bh = 10 + rnd(i + 200) * (theme === 'industrial' ? 22 : 16), bd = 6 + rnd(i + 300) * 10;
      let x, z;
      const off = 12 + rnd(i + 400) * 24;
      if (side === 0) { x = t * W; z = -off; } else if (side === 1) { x = t * W; z = D + off; } else if (side === 2) { x = -off; z = t * D; } else { x = W + off; z = t * D; }
      const b = this.boxMesh(bw, bh, bd, mat, 0.15);
      b.position.set(x, bh / 2, z); b.castShadow = false;
      this.group.add(b);
    }
    if (theme === 'industrial') {
      // chaminés e torres de resfriamento
      const stack = new THREE.MeshStandardMaterial({ color: 0x6b6660, roughness: 0.95, map: texture('concrete', '#7a756d') });
      for (const [x, z, r, hh] of [[-30, D * 0.3, 2.2, 45], [W + 35, D * 0.6, 2.6, 52], [W * 0.4, -40, 1.8, 38]]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, hh, 20), stack); c.position.set(x, hh / 2, z); this.group.add(c);
      }
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 30, 32, 1, true), stack);
      tower.position.set(W + 50, 15, -20); this.group.add(tower);
    }
  }

  buildProps() {
    const { w, h } = this.map;
    const theme = this.map.def.theme;
    // tubulações sobre paredes (industrial), postes (urbano), cabos (instalação)
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, metalness: 0.6, roughness: 0.5, map: texture('metal', '#8a6b4a') });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.5, roughness: 0.6 });
    for (let z = 1; z < h - 1; z++) for (let x = 1; x < w - 1; x++) {
      const ch = this.map.cells[z * w + x];
      const r = this.hash(x, z) % 23;
      if (theme === 'industrial' && ch === '#' && r === 0) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, CELL * 3, 12), pipeMat);
        p.rotation.z = Math.PI / 2; p.position.set((x + 0.5) * CELL, 5.4, (z + 0.5) * CELL);
        this.group.add(p);
      }
      if (theme === 'urbano' && ch === '.' && r === 3 && this.adjacentTo(x, z, '#')) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.5, 8), poleMat);
        pole.position.set((x + 0.5) * CELL, 2.75, (z + 0.5) * CELL); pole.castShadow = true;
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc77a, emissiveIntensity: 1.2 }));
        lamp.position.set((x + 0.5) * CELL + 0.3, 5.45, (z + 0.5) * CELL);
        this.group.add(pole, lamp);
      }
      if (ch === '.' && r === 7 && theme !== 'instalacao') {
        // entulho decorativo baixo (sem colisão, abaixo da altura do tornozelo)
        const deb = this.boxMesh(0.5 + (r % 3) * 0.2, 0.12, 0.4, this.mat('concrete', '#6d6a63'), 0.8);
        deb.position.set((x + 0.3) * CELL, 0.06, (z + 0.6) * CELL); deb.rotation.y = r;
        this.group.add(deb);
      }
    }
  }

  adjacentTo(x, z, ch) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.map.cells[(z + dz) * this.map.w + x + dx] === ch) return true;
    return false;
  }

  // ---------- física ----------
  allBoxes() { return this.dynamic.length ? this.boxes.concat(this.dynamic.filter((d) => d.alive)) : this.boxes; }

  overlaps(px, py, pz, r, hgt) {
    for (const b of this.allBoxes()) {
      if (px + r > b.min.x && px - r < b.max.x && pz + r > b.min.z && pz - r < b.max.z && py + hgt > b.min.y && py < b.max.y) return b;
    }
    return null;
  }

  // move com deslizamento por eixo. Retorna {grounded}
  move(pos, vel, dt, r, hgt) {
    let grounded = false;
    const nx = pos.x + vel.x * dt;
    if (!this.overlaps(nx, pos.y + 0.05, pos.z, r, hgt - 0.05)) pos.x = nx; else vel.x = 0;
    const nz = pos.z + vel.z * dt;
    if (!this.overlaps(pos.x, pos.y + 0.05, nz, r, hgt - 0.05)) pos.z = nz; else vel.z = 0;
    const ny = pos.y + vel.y * dt;
    const hit = this.overlaps(pos.x, ny, pos.z, r, hgt);
    if (ny <= 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; grounded = true; }
    else if (hit) {
      if (vel.y < 0) { pos.y = hit.max.y; grounded = true; } else { pos.y = hit.min.y - hgt - 0.001; }
      vel.y = 0;
    } else pos.y = ny;
    return { grounded };
  }

  // raio x caixas. Retorna {t, box, normal} ou null
  raycast(o, d, maxT, ignoreDynamic = false) {
    let best = null;
    const list = ignoreDynamic ? this.boxes : this.allBoxes();
    for (const b of list) {
      const hit = rayBox(o, d, b.min, b.max, maxT);
      if (hit && (!best || hit.t < best.t)) { best = hit; best.box = b; maxT = hit.t; }
    }
    return best;
  }

  // linha de visão (considera fumaça)
  visible(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return true;
    const d = { x: dx / len, y: dy / len, z: dz / len };
    if (this.raycast(a, d, len - 0.05)) return false;
    for (const s of this.smokes) if (raySphere(a, d, s, s.r * s.k, len)) return false;
    return true;
  }

  // ---------- navegação ----------
  walkableCell(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.map.w || cz >= this.map.h) return false;
    if (!isWalkableChar(this.map.cells[cz * this.map.w + cx])) return false;
    return true;
  }

  findPath(from, to) {
    const W = this.map.w;
    const sx = Math.floor(from.x / CELL), sz = Math.floor(from.z / CELL);
    let tx = Math.floor(to.x / CELL), tz = Math.floor(to.z / CELL);
    if (!this.walkableCell(tx, tz)) { const n = this.nearestWalkable(tx, tz); if (!n) return null; [tx, tz] = n; }
    const start = sz * W + sx, goal = tz * W + tx;
    const g = new Map([[start, 0]]);
    const came = new Map();
    const open = [[0, start]];
    const hfn = (i) => { const x = i % W, z = (i / W) | 0; const ax = Math.abs(x - tx), az = Math.abs(z - tz); return Math.max(ax, az) + 0.41 * Math.min(ax, az); };
    const closed = new Set();
    let iter = 0;
    while (open.length && iter++ < 4000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) break;
      if (closed.has(cur)) continue;
      closed.add(cur);
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (!this.walkableCell(nx, nz)) continue;
        if (dx && dz && (!this.walkableCell(cx + dx, cz) || !this.walkableCell(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        const cost = g.get(cur) + (dx && dz ? 1.414 : 1);
        if (cost < (g.get(ni) ?? Infinity)) { g.set(ni, cost); came.set(ni, cur); open.push([cost + hfn(ni), ni]); }
      }
    }
    if (!came.has(goal) && goal !== start) return null;
    const cells = [];
    let c = goal;
    while (c !== undefined && c !== start) { cells.push(c); c = came.get(c); }
    cells.reverse();
    const pts = cells.map((i) => ({ x: (i % W + 0.5) * CELL, z: (((i / W) | 0) + 0.5) * CELL }));
    pts.push({ x: to.x, z: to.z });
    return this.smooth({ x: from.x, z: from.z }, pts);
  }

  nearestWalkable(cx, cz) {
    for (let r = 1; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (this.walkableCell(cx + dx, cz + dz)) return [cx + dx, cz + dz];
    return null;
  }

  clearLine(a, b) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      for (const [ox, oz] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]]) {
        if (!isWalkableChar(cellAt(this.map, x + ox, z + oz))) return false;
      }
    }
    return true;
  }

  smooth(from, pts) {
    const out = [];
    let anchor = from, i = 0;
    while (i < pts.length) {
      let j = i;
      while (j + 1 < pts.length && this.clearLine(anchor, pts[j + 1])) j++;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  randomWalkableNear(p, radius) {
    for (let k = 0; k < 20; k++) {
      const x = p.x + (Math.random() * 2 - 1) * radius, z = p.z + (Math.random() * 2 - 1) * radius;
      if (isWalkableChar(cellAt(this.map, x, z)) && isWalkableChar(cellAt(this.map, x + 0.5, z + 0.5)) && isWalkableChar(cellAt(this.map, x - 0.5, z - 0.5))) return { x, z };
    }
    return { x: p.x, z: p.z };
  }

  surfaceAt(x, z) {
    const ch = cellAt(this.map, x, z);
    if (this.map.def.theme === 'instalacao' && ch === 'i') return 'metal';
    return 'concrete';
  }

  update(dt, now) {
    for (const s of this.smokes) {
      // cresce rápido, dissipa no final
      const age = now - s.born, left = s.until - now;
      s.k = Math.min(1, age / 1.0) * Math.min(1, Math.max(0, left / 1.5));
      if (s.sprites) for (const sp of s.sprites) { sp.material.opacity = 0.85 * s.k; sp.position.y += Math.sin(now * 0.6 + sp.userData.phase) * 0.002; }
    }
    for (const s of this.smokes.filter((q) => now >= q.until)) if (s.sprites) for (const sp of s.sprites) { this.scene.remove(sp); sp.material.dispose(); }
    this.smokes = this.smokes.filter((s) => now < s.until);
    for (const d of this.dynamic) if (d.alive && (now >= d.until || d.hp <= 0)) { d.alive = false; if (d.mesh) this.scene.remove(d.mesh); }
    this.dynamic = this.dynamic.filter((d) => d.alive);
  }

  addSmoke(x, y, z, now, duration = 14) {
    const s = { x, y: Math.max(1.6, y), z, r: 4.2, k: 0, born: now, until: now + duration, sprites: [] };
    const tex = softSprite('205,205,200');
    const count = settings.quality === 'baixa' ? 14 : 26;
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xd6d4cc });
      const sp = new THREE.Sprite(m);
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 3.0, yy = Math.random() * 3.2;
      sp.position.set(x + Math.cos(a) * rr, 0.6 + yy, z + Math.sin(a) * rr);
      const sc = 3.6 + Math.random() * 2.4; sp.scale.set(sc, sc, 1);
      sp.userData.phase = i;
      this.scene.add(sp); s.sprites.push(sp);
    }
    this.smokes.push(s);
    return s;
  }

  addBarrier(x, z, yaw, now, owner) {
    const len = 5, thick = 0.35, hgt = 2.6;
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    // alinhado ao eixo mais próximo para colisão AABB precisa
    const alongX = c > s;
    const hx = alongX ? len / 2 : thick / 2, hz = alongX ? thick / 2 : len / 2;
    const mat = new THREE.MeshStandardMaterial({ color: 0x8fb4d9, transparent: true, opacity: 0.55, emissive: 0x1b3550, metalness: 0.3, roughness: 0.3 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hgt, hz * 2), mat);
    mesh.position.set(x, hgt / 2, z);
    this.scene.add(mesh);
    const d = { min: { x: x - hx, y: 0, z: z - hz }, max: { x: x + hx, y: hgt, z: z + hz }, surface: 'metal', alive: true, until: now + 8, hp: 300, mesh, owner, barrier: true };
    this.dynamic.push(d);
    return d;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const s of this.smokes) if (s.sprites) for (const sp of s.sprites) this.scene.remove(sp);
    for (const d of this.dynamic) if (d.mesh) this.scene.remove(d.mesh);
  }
}

export function rayBox(o, d, min, max, maxT) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  for (const [a, k] of [['x', 0], ['y', 1], ['z', 2]]) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < min[a] || o[a] > max[a]) return null;
    } else {
      let t1 = (min[a] - o[a]) / d[a], t2 = (max[a] - o[a]) / d[a];
      let s = -1;
      if (t1 > t2) { [t1, t2] = [t2, t1]; s = 1; }
      if (t1 > tmin) { tmin = t1; nAxis = k; nSign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (nAxis === -1) return null; // origem dentro da caixa
  const normal = { x: 0, y: 0, z: 0 };
  normal[['x', 'y', 'z'][nAxis]] = nSign;
  return { t: tmin, normal };
}

export function raySphere(o, d, c, r, maxT) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  if (t < 0 || t > maxT) return null;
  if (cc < 0) return { t: 0 };
  return { t };
}
