// Entidade comum a jogador e bots: estado, inventário, hitbox e modelo 3D.
import * as THREE from './vendor/three.module.min.js';
import { PLAYER, WEAPONS, AGENTS } from './config.js';

let nextId = 1;

export class Actor {
  constructor({ name, team, agentId, isPlayer = false, skill = null, primary = 'rifle' }) {
    this.id = nextId++;
    this.name = name;
    this.team = team;
    this.isPlayer = isPlayer;
    this.skill = skill;
    this.agent = AGENTS.find((a) => a.id === agentId) || AGENTS[0];
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, score: 0, headshots: 0, plants: 0, defuses: 0, captures: 0, healing: 0, shots: 0, hits: 0 };
    this.primaryId = primary;
    this.model = null;
    this.reset();
  }

  reset() {
    this.hp = PLAYER.hp;
    this.shield = 0;
    this.alive = true;
    this.crouch = false;
    this.grounded = true;
    this.vel.set(0, 0, 0);
    this.weapons = {
      1: { id: this.primaryId, mag: WEAPONS[this.primaryId].mag, reserve: WEAPONS[this.primaryId].reserve },
      2: { id: 'pistol', mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve },
    };
    this.slot = 1;
    this.nextFire = 0;
    this.reloadUntil = 0;
    this.equipUntil = 0;
    this.burst = 0;            // tiros consecutivos (índice do padrão de recuo)
    this.bloom = 0;            // abertura extra acumulada
    this.recoil = { yaw: 0, pitch: 0 };
    this.ads = false; this.adsT = 0;
    this.flashUntil = 0; this.flashAmount = 0;
    this.revealedUntil = 0;
    this.damagers = new Map(); // id -> {dmg, t}
    this.abilities = {
      q: { charges: this.agent.q.charges, cdUntil: 0 },
      e: { charges: this.agent.e.charges, cdUntil: 0 },
    };
    this.shieldDecayAt = 0;
    this.lastShotAt = -10;
    this.lastHurtAt = -10;
    this.stepAcc = 0;
    this.deathTime = 0;
    this.planting = 0; this.defusing = 0;
    this.carrying = false;
    if (this.model) { this.model.visible = true; this.model.rotation.set(0, 0, 0); this.model.position.y = 0; }
  }

  get weapon() { return this.weapons[this.slot]; }
  get wdef() { return WEAPONS[this.weapon.id]; }
  get height() { return this.crouch ? PLAYER.crouchHeight : PLAYER.height; }
  get eyeHeight() { return this.crouch ? PLAYER.crouchEye : PLAYER.eye; }
  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }

  forward() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  // ---- hitboxes ----
  hitTest(o, d, maxT) {
    if (!this.alive) return null;
    const h = this.height;
    const headY = this.pos.y + h - 0.16;
    const hc = { x: this.pos.x, y: headY, z: this.pos.z };
    // cabeça (esfera)
    let best = null;
    const ox = o.x - hc.x, oy = o.y - hc.y, oz = o.z - hc.z;
    const b = ox * d.x + oy * d.y + oz * d.z;
    const c = ox * ox + oy * oy + oz * oz - 0.15 * 0.15;
    const disc = b * b - c;
    if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < maxT) best = { t, part: 'head' }; }
    // corpo (AABB)
    const r = 0.3;
    const min = { x: this.pos.x - r, y: this.pos.y, z: this.pos.z - r };
    const max = { x: this.pos.x + r, y: headY - 0.14, z: this.pos.z + r };
    const bt = slab(o, d, min, max, maxT);
    if (bt !== null && (!best || bt < best.t)) {
      const y = o.y + d.y * bt;
      best = { t: bt, part: y < this.pos.y + h * 0.45 ? 'leg' : 'body' };
    }
    return best;
  }

  buildModel(colors) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0x8d6a52, roughness: 0.8 });
    const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color(this.agent.color).multiplyScalar(0.45), roughness: 0.85 });
    const gear = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6, metalness: 0.3 });
    const teamMat = new THREE.MeshStandardMaterial({ color: colors.team, emissive: colors.team, emissiveIntensity: 0.9 });
    this.teamMat = teamMat;
    const box = (w, h, d, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.castShadow = true; return me; };

    const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
    const legL = new THREE.Group(), legR = new THREE.Group();
    for (const [leg, x] of [[legL, -0.12], [legR, 0.12]]) {
      leg.position.set(x, 0, 0);
      const thigh = box(0.17, 0.48, 0.2, cloth); thigh.position.y = -0.24;
      const shin = box(0.15, 0.46, 0.17, gear); shin.position.y = -0.7;
      leg.add(thigh, shin); hips.add(leg);
    }
    const torso = new THREE.Group(); torso.position.y = 0.0; hips.add(torso);
    const chest = box(0.48, 0.58, 0.28, cloth); chest.position.y = 0.32; torso.add(chest);
    const vest = box(0.5, 0.42, 0.32, gear); vest.position.y = 0.36; torso.add(vest);
    // faixa de equipe (frente, costas, ombros): leitura de silhueta independente de cosméticos
    const stripe = box(0.52, 0.07, 0.34, teamMat); stripe.position.y = 0.5; torso.add(stripe);
    const shoulderL = box(0.12, 0.08, 0.2, teamMat); shoulderL.position.set(-0.3, 0.6, 0); torso.add(shoulderL);
    const shoulderR = shoulderL.clone(); shoulderR.position.x = 0.3; torso.add(shoulderR);
    const head = new THREE.Group(); head.position.y = 0.78; torso.add(head);
    const face = box(0.2, 0.24, 0.22, skin); head.add(face);
    const helmet = box(0.25, 0.13, 0.27, gear); helmet.position.y = 0.11; head.add(helmet);
    const visor = box(0.21, 0.05, 0.02, new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 })); visor.position.set(0, 0.03, -0.115); head.add(visor);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.3, 0.55, 0); armR.position.set(0.3, 0.55, 0);
    const uaL = box(0.12, 0.34, 0.13, cloth); uaL.position.y = -0.17; armL.add(uaL);
    const uaR = uaL.clone(); armR.add(uaR);
    armL.rotation.x = -1.1; armR.rotation.x = -1.3; armL.rotation.z = 0.5;
    torso.add(armL, armR);
    const gun = new THREE.Group();
    const gb = box(0.07, 0.1, 0.62, gear); gb.position.z = -0.25; gun.add(gb);
    gun.position.set(0.12, 0.42, -0.3);
    this.gunTip = new THREE.Object3D(); this.gunTip.position.set(0, 0, -0.58); gun.add(this.gunTip);
    torso.add(gun);
    // contorno de alto contraste (acessibilidade): casca invertida
    const outlineMat = new THREE.MeshBasicMaterial({ color: colors.team, side: THREE.BackSide, transparent: true, opacity: 0.9 });
    this.outline = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.2, 4, 10), outlineMat);
    this.outline.position.y = 0.92; this.outline.scale.set(1.0, 1.0, 0.8);
    this.outline.visible = false; this.outline.renderOrder = -1;
    g.add(this.outline);

    this.parts = { hips, legL, legR, torso, head, armL, armR, gun };
    this.model = g;
    return g;
  }

  setTeamColor(c) {
    if (this.teamMat) { this.teamMat.color.set(c); this.teamMat.emissive.set(c); }
    if (this.outline) this.outline.material.color.set(c);
  }

  animate(dt, now) {
    if (!this.model) return;
    const m = this.model;
    m.position.set(this.pos.x, this.pos.y, this.pos.z);
    if (!this.alive) {
      const k = Math.min(1, (now - this.deathTime) / 0.45);
      m.rotation.x = -k * Math.PI / 2 * 0.95;
      m.position.y = this.pos.y + 0.15 * k;
      this.outline.visible = false;
      return;
    }
    m.rotation.set(0, this.yaw, 0);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    this.animPhase = (this.animPhase || 0) + dt * speed * 2.2;
    const sw = Math.sin(this.animPhase) * Math.min(1, speed / 4) * 0.7;
    const p = this.parts;
    p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
    const crouchK = this.crouch ? 1 : 0;
    p.hips.position.y = 0.92 - crouchK * 0.42;
    p.legL.rotation.x += crouchK * -0.9; p.legR.rotation.x += crouchK * -0.9;
    p.torso.rotation.x = this.pitch * 0.5 + crouchK * 0.15;
    p.head.rotation.x = this.pitch * 0.5;
    const kick = Math.max(0, 1 - (now - this.lastShotAt) * 12) * 0.12;
    p.gun.position.z = -0.3 + kick;
    this.outline.position.y = 0.92 - crouchK * 0.3;
    this.outline.scale.y = this.crouch ? 0.75 : 1;
  }
}

function slab(o, d, min, max, maxT) {
  let tmin = 0, tmax = maxT;
  for (const a of ['x', 'y', 'z']) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < min[a] || o[a] > max[a]) return null; continue; }
    let t1 = (min[a] - o[a]) / d[a], t2 = (max[a] - o[a]) / d[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
