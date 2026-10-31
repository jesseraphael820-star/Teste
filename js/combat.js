// Disparo hitscan, abertura (spread), recuo e recarga. Usado igualmente por jogador e bots.
import * as THREE from './vendor/three.module.min.js';
import { PLAYER } from './config.js';
import { playShot, playDryFire, playReload, cue } from './audio.js';

const DEG = Math.PI / 180;

export function moveFactor(a) {
  return Math.min(1, Math.hypot(a.vel.x, a.vel.z) / PLAYER.runSpeed);
}

export function currentSpread(a) {
  const w = a.wdef;
  const mf = moveFactor(a);
  // Andar devagar (Shift) mantém boa precisão: penalidade cresce de forma quadrática.
  const mv = mf * mf;
  if (w.scoped) {
    if (a.adsT >= 0.95) return w.adsSpread + w.adsMoveSpread * mv + (a.grounded ? 0 : w.airSpread) + a.bloom * 0.2;
    return w.spread + w.moveSpread * mv + (a.grounded ? 0 : w.airSpread);
  }
  let s = w.spread + w.moveSpread * mv + (a.grounded ? 0 : w.airSpread) + a.bloom;
  if (a.crouch && mf < 0.2) s *= w.crouchMul;
  s *= 1 + (w.adsMul - 1) * a.adsT;
  return s;
}

export function canFire(a, now) {
  return a.alive && now >= a.nextFire && now >= a.reloadUntil && now >= a.equipUntil;
}

export function startReload(a, now, isPlayer) {
  const w = a.wdef, inv = a.weapon;
  if (now < a.reloadUntil || inv.mag >= w.mag || inv.reserve <= 0) return false;
  a.reloadUntil = now + w.reload;
  a.reloadStarted = now;
  a.reloadStage = 0;
  a.ads = false;
  if (isPlayer) playReload('out');
  return true;
}

export function updateReload(a, now, isPlayer) {
  if (!a.reloadStarted) return;
  const w = a.wdef;
  const k = (now - a.reloadStarted) / w.reload;
  if (isPlayer || a.audible) {
    const pos = isPlayer ? null : a.pos;
    if (a.reloadStage === 0 && k > 0.45) { a.reloadStage = 1; playReload(w.id === 'shotgun' ? 'shell' : 'in', pos); }
    if (a.reloadStage === 1 && k > 0.8) { a.reloadStage = 2; playReload('rack', pos); }
  }
  if (now >= a.reloadUntil) {
    const inv = a.weapon;
    const need = w.mag - inv.mag;
    const take = Math.min(need, inv.reserve);
    inv.mag += take; inv.reserve -= take;
    a.reloadStarted = 0;
  }
}

export function cancelReload(a) { a.reloadStarted = 0; a.reloadUntil = 0; }

export function switchWeapon(a, slot, now) {
  if (a.slot === slot || !a.weapons[slot]) return false;
  cancelReload(a);
  a.slot = slot;
  a.equipUntil = now + a.wdef.equip;
  a.burst = 0; a.bloom = 0;
  a.ads = false; a.adsT = 0;
  return true;
}

// Recupera recuo e abertura quando não está atirando.
export function recover(a, dt, now) {
  const w = a.wdef;
  const idle = now - a.lastShotAt > 60 / w.rpm + 0.08;
  a.bloom = Math.max(0, a.bloom - w.spreadRecover * dt * (idle ? 1 : 0.35));
  if (idle) {
    a.burst = 0;
    const k = Math.min(1, w.recoilRecover * dt);
    a.recoil.pitch -= a.recoil.pitch * k;
    a.recoil.yaw -= a.recoil.yaw * k;
  }
}

function coneDir(yaw, pitch, spreadDeg) {
  const cp = Math.cos(pitch);
  const f = new THREE.Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  if (spreadDeg <= 0) return f;
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new THREE.Vector3().crossVectors(right, f).normalize();
  // amostragem uniforme em disco
  const r = Math.tan(spreadDeg * DEG) * Math.sqrt(Math.random());
  const th = Math.random() * Math.PI * 2;
  return f.addScaledVector(right, Math.cos(th) * r).addScaledVector(up, Math.sin(th) * r).normalize();
}

// Dispara a arma do ator. Retorna true se disparou.
export function fire(a, game, now) {
  if (!canFire(a, now)) return false;
  const w = a.wdef, inv = a.weapon;
  if (inv.mag <= 0) {
    if (a.isPlayer && now - (a.lastDry || 0) > 0.25) { playDryFire(); a.lastDry = now; }
    if (inv.reserve > 0) startReload(a, now, a.isPlayer);
    return false;
  }
  inv.mag--;
  a.nextFire = now + 60 / w.rpm;
  a.lastShotAt = now;
  a.stats.shots++;

  const spread = currentSpread(a);
  const pat = w.recoil[Math.min(a.burst, w.recoil.length - 1)];
  a.burst++;
  a.bloom = Math.min(a.bloom + w.spreadPerShot, 4);

  const origin = a.eye();
  const yaw = a.yaw + a.recoil.yaw * DEG;
  const pitch = a.pitch + a.recoil.pitch * DEG;
  const results = [];
  // a autoridade (servidor) valida cadência antes de registrar qualquer acerto
  const authorized = game.authorizeShot ? game.authorizeShot(a, now) : true;
  for (let i = 0; authorized && i < w.pellets; i++) {
    const dir = coneDir(yaw, pitch, spread);
    results.push(game.traceShot(a, origin, dir, w));
  }
  // recuo aplicado após o disparo (o primeiro tiro vai onde a mira aponta)
  const recoilScale = a.crouch ? 0.85 : 1;
  a.recoil.pitch += pat[1] * recoilScale * (a.adsT > 0.5 ? 0.9 : 1);
  a.recoil.yaw += pat[0] * recoilScale + (Math.random() - 0.5) * 0.15;

  if (results.some((r) => r.victim && (r.victim.team !== a.team || r.victim.dummy))) a.stats.hits++;
  playShot(w.sound, a.isPlayer ? null : a.pos);
  if (!a.isPlayer) cue('tiro', a.pos, game.isEnemyOfPlayer(a));
  game.onFire(a, origin, results, w);
  if (inv.mag === 0 && inv.reserve > 0 && !a.isPlayer) startReload(a, now, false);
  return true;
}

export function falloffMul(w, dist) {
  const [d0, d1, minMul] = w.falloff;
  if (dist <= d0) return 1;
  if (dist >= d1) return minMul;
  return 1 - (1 - minMul) * ((dist - d0) / (d1 - d0));
}

export function partMul(w, part) {
  return part === 'head' ? w.headMul : part === 'leg' ? w.legMul : 1;
}
