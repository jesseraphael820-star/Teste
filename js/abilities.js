// Habilidades dos agentes. Nenhuma causa dano: informação, controle de espaço, sustentação.
import * as THREE from './vendor/three.module.min.js';
import { playAbility, cue } from './audio.js';
import { softSprite } from './textures.js';

export function abilityReady(a, key, now) {
  const s = a.abilities[key];
  return a.alive && s.charges > 0 && now >= s.cdUntil;
}

export function useAbility(a, key, game, now) {
  if (!abilityReady(a, key, now)) return false;
  const def = a.agent[key];
  const s = a.abilities[key];
  s.charges--;
  // recarrega 1 carga por tempo de recarga (não acumula além do máximo)
  s.cdUntil = now + 1.2;
  s.rechargeAt = s.rechargeAt && s.rechargeAt > now ? s.rechargeAt : now + def.cooldown;
  const eye = a.eye();
  const fwd = a.forward();
  switch (def.id) {
    case 'flash': throwGrenade(game, a, eye, fwd, 'flash', now, 0.9); break;
    case 'smoke': throwGrenade(game, a, eye, fwd, 'smoke', now, 2.0); break;
    case 'dash': {
      const dir = new THREE.Vector3(a.vel.x, 0, a.vel.z);
      if (dir.lengthSq() < 0.5) dir.set(fwd.x, 0, fwd.z);
      dir.normalize().multiplyScalar(16);
      a.vel.x = dir.x; a.vel.z = dir.z; a.dashUntil = now + 0.22;
      playAbility('dash', a.isPlayer ? null : a.pos);
      break;
    }
    case 'wall': {
      // posiciona 3 m à frente, perpendicular à visão
      const p = { x: a.pos.x + fwd.x * 3, z: a.pos.z + fwd.z * 3 };
      game.world.addBarrier(p.x, p.z, a.yaw + Math.PI / 2, now, a);
      playAbility('wall', p);
      break;
    }
    case 'pulse': {
      game.effects.ring(a.pos, 0x4fb39a, 22, now);
      playAbility('pulse', a.isPlayer ? null : a.pos);
      let n = 0;
      for (const o of game.actors) if (o.alive && o.team !== a.team && o.pos.distanceTo(a.pos) < 22) { o.revealedUntil = Math.max(o.revealedUntil, now + 2); n++; }
      if (n && a.isPlayer) game.track('reveal', {}, n);
      break;
    }
    case 'sensor': {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.25, 10), new THREE.MeshStandardMaterial({ color: 0x2f6f60, emissive: 0x4fb39a, emissiveIntensity: 1 }));
      mesh.position.set(a.pos.x + fwd.x * 1.2, 0.12, a.pos.z + fwd.z * 1.2);
      game.scene.add(mesh);
      game.gadgets.push({ type: 'sensor', owner: a, team: a.team, pos: mesh.position.clone(), mesh, until: now + 30, radius: 7, cooldown: 0 });
      playAbility('sensor', mesh.position);
      break;
    }
    case 'heal': {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xe8e2c8, emissive: 0x9ad18a, emissiveIntensity: 0.6 }));
      mesh.position.set(a.pos.x, 0.15, a.pos.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(4.3, 4.5, 48), new THREE.MeshBasicMaterial({ color: 0x9ad18a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(a.pos.x, 0.05, a.pos.z);
      game.scene.add(mesh, ring);
      game.gadgets.push({ type: 'heal', owner: a, team: a.team, pos: mesh.position.clone(), mesh, extra: ring, until: now + 4, radius: 4.5 });
      playAbility('heal', mesh.position);
      break;
    }
    case 'shield': {
      a.shield = 30; a.shieldDecayAt = now + 10;
      playAbility('shield', a.isPlayer ? null : a.pos);
      break;
    }
  }
  if (a.isPlayer) game.track('ability');
  return true;
}

export function updateAbilityCharges(a, now) {
  for (const key of ['q', 'e']) {
    const s = a.abilities[key], def = a.agent[key];
    if (s.charges < def.charges && s.rechargeAt && now >= s.rechargeAt) {
      s.charges++;
      s.rechargeAt = s.charges < def.charges ? now + def.cooldown : 0;
    }
  }
  if (a.shield > 0 && now > a.shieldDecayAt) a.shield = Math.max(0, a.shield - 6 * (1 / 60));
}

function throwGrenade(game, a, eye, fwd, kind, now, fuse) {
  const tex = softSprite(kind === 'flash' ? '255,255,230' : '210,210,200');
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: kind === 'flash' ? 0xd9822b : 0x6c8ebf, metalness: 0.4, roughness: 0.5 }));
  mesh.position.copy(eye).addScaledVector(fwd, 0.5);
  game.scene.add(mesh);
  const vel = fwd.clone().multiplyScalar(kind === 'flash' ? 18 : 15);
  vel.y += 2.5;
  game.projectiles.push({ kind, owner: a, team: a.team, mesh, vel, explodeAt: now + fuse, tex });
  playAbility('throw', a.isPlayer ? null : a.pos);
}

export function updateProjectiles(game, dt, now) {
  for (const p of game.projectiles) {
    const pos = p.mesh.position;
    p.vel.y -= 18 * dt;
    const step = p.vel.clone().multiplyScalar(dt);
    const len = step.length();
    if (len > 0) {
      const dir = step.clone().divideScalar(len);
      const hit = game.world.raycast(pos, dir, len + 0.07);
      if (hit) {
        const n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
        p.vel.reflect(n).multiplyScalar(0.45);
        pos.addScaledVector(dir, Math.max(0, hit.t - 0.08));
        if (p.vel.length() > 2) playAbility('bounce', pos);
      } else pos.add(step);
    }
    if (pos.y < 0.07) { pos.y = 0.07; p.vel.y = Math.abs(p.vel.y) * 0.35; p.vel.x *= 0.7; p.vel.z *= 0.7; }
    // fumaça detona ao parar ou no tempo
    if (now >= p.explodeAt) { detonate(game, p, now); p.done = true; }
  }
  game.projectiles = game.projectiles.filter((p) => { if (p.done) game.scene.remove(p.mesh); return !p.done; });
}

function detonate(game, p, now) {
  const pos = p.mesh.position.clone();
  if (p.kind === 'smoke') {
    game.world.addSmoke(pos.x, pos.y, pos.z, now);
    playAbility('smoke', pos);
    return;
  }
  // clarão: cega quem tem linha de visão e está olhando
  game.effects.burst(pos, '255,255,240', now, 6);
  playAbility('flash', pos);
  for (const o of game.actors) {
    if (!o.alive) continue;
    const eye = o.eye();
    const dist = eye.distanceTo(pos);
    if (dist > 30 || !game.world.visible(eye, pos)) continue;
    const to = pos.clone().sub(eye).normalize();
    const facing = o.forward().dot(to); // 1 = olhando diretamente
    let amount = facing > 0.5 ? 1 : facing > 0 ? 0.55 : 0.18;
    amount *= Math.max(0.35, 1 - dist / 30);
    const dur = 1.8 * amount;
    if (dur > 0.25) {
      o.flashUntil = Math.max(o.flashUntil, now + dur);
      o.flashAmount = Math.max(o.flashAmount || 0, amount);
      o.flashStart = now;
      if (o.team !== p.team && p.owner.isPlayer) game.track('reveal');
    }
  }
  cue('clarão', pos, p.team !== game.player?.team);
}

export function updateGadgets(game, dt, now) {
  for (const g of game.gadgets) {
    if (g.type === 'heal') {
      g.extra.material.opacity = 0.3 + 0.3 * Math.sin(now * 6);
      for (const o of game.actors) {
        if (!o.alive || o.team !== g.team || o.pos.distanceTo(g.pos) > g.radius || o.hp >= 100) continue;
        const amt = Math.min(100 - o.hp, 12 * dt);
        o.hp += amt;
        g.owner.stats.healing += amt;
        if (g.owner.isPlayer && o !== g.owner) game.track('heal', {}, amt);
      }
    } else if (g.type === 'sensor') {
      g.mesh.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(now * 4);
      for (const o of game.actors) {
        if (!o.alive || o.team === g.team || o.pos.distanceTo(g.pos) > g.radius) continue;
        if (o.revealedUntil < now + 0.5) {
          o.revealedUntil = now + 2.5;
          if (now > g.cooldown) { g.cooldown = now + 3; playAbility('sensor', g.pos); if (g.owner.isPlayer) game.track('reveal'); }
        }
      }
    }
  }
  const gone = game.gadgets.filter((g) => now >= g.until);
  for (const g of gone) { game.scene.remove(g.mesh); if (g.extra) game.scene.remove(g.extra); }
  game.gadgets = game.gadgets.filter((g) => now < g.until);
}
