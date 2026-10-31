// IA dos bots. Mesmas regras do jogador: mesma arma, recuo, abertura, visão e habilidades.
// A dificuldade só altera tempo de reação, erro de mira e velocidade de rastreio.
import * as THREE from './vendor/three.module.min.js';
import { PLAYER } from './config.js';
import { fire, startReload, recover, updateReload, switchWeapon } from './combat.js';
import { useAbility, abilityReady } from './abilities.js';
import { playFootstep, cue } from './audio.js';

const DEG = Math.PI / 180;
const tmp = new THREE.Vector3();

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class BotBrain {
  constructor(actor) {
    this.a = actor;
    this.path = null; this.pathIdx = 0; this.repathAt = 0; this.goalKey = '';
    this.target = null; this.seenAt = 0; this.aimErr = { yaw: 0, pitch: 0 };
    this.strafeDir = 0; this.strafeUntil = 0;
    this.burstLeft = 0; this.burstPauseUntil = 0;
    this.lookYaw = actor.yaw;
    this.investigate = null;
    this.thinkAt = 0;
    this.holdLookAt = 0;
    this.lastKnown = null;
    this.walkQuiet = false;
    this.crouchUntil = 0;
  }

  get s() { return this.a.skill; }

  perceive(game, now) {
    const a = this.a;
    const eye = a.eye();
    const fwd = a.forward();
    const blind = now < a.flashUntil;
    let best = null, bestScore = Infinity;
    for (const o of game.actors) {
      if (!o.alive || o.team === a.team) continue;
      const d = o.pos.distanceTo(a.pos);
      if (d > 70) continue;
      const chest = tmp.set(o.pos.x, o.pos.y + o.height * 0.7, o.pos.z);
      const dir = chest.clone().sub(eye).normalize();
      const inFov = dir.dot(fwd) > Math.cos(65 * DEG) || d < 3 || (this.target === o);
      const recentlyHurtBy = a.damagers.get(o.id) && now - a.damagers.get(o.id).t < 2;
      if (blind) continue;
      if (!(inFov || recentlyHurtBy)) continue;
      // visível pela cabeça ou pelo tronco
      const head = new THREE.Vector3(o.pos.x, o.pos.y + o.height - 0.15, o.pos.z);
      if (!game.world.visible(eye, chest) && !game.world.visible(eye, head)) continue;
      const score = d - (this.target === o ? 10 : 0) - (recentlyHurtBy ? 15 : 0);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    if (best && best !== this.target) {
      this.target = best;
      // reação: mais lenta se o alvo surgir na periferia da visão
      const dir = best.pos.clone().sub(a.pos).normalize();
      const peripheral = 1 - Math.max(0, dir.x * fwd.x + dir.z * fwd.z);
      this.seenAt = now + (this.s.reaction / 1000) * (0.8 + Math.random() * 0.4) * (1 + peripheral * 0.6);
      const e = this.s.aimError * (0.7 + Math.random() * 0.6);
      this.aimErr = { yaw: (Math.random() - 0.5) * 2 * e * DEG, pitch: (Math.random() - 0.5) * e * DEG };
      this.aimHead = Math.random() < this.s.headChance;
      game.spotted(best, a);
    } else if (!best && this.target) {
      this.lastKnown = this.target.alive ? this.target.pos.clone() : null;
      this.lastKnownAt = now;
      this.target = null;
    }
    if (best) game.spotted(best, a);
  }

  hear(pos, kind, now) {
    const d = pos.distanceTo ? pos.distanceTo(this.a.pos) : Math.hypot(pos.x - this.a.pos.x, pos.z - this.a.pos.z);
    if (this.target || d > (kind === 'tiro' ? 28 : 12)) return;
    if (this.investigate && now < this.investigate.until) return;
    this.investigate = { x: pos.x, z: pos.z, until: now + 4 };
  }

  update(game, dt, now) {
    const a = this.a;
    if (!a.alive) return;
    if (now >= this.thinkAt) { this.perceive(game, now); this.thinkAt = now + 0.08 + Math.random() * 0.04; }
    if (game.mode.movementLocked?.(a)) { a.vel.set(0, 0, 0); a.animate(dt, now); return; }

    const goal = game.mode.goalFor(a, now);
    const t = this.target;
    let wantMove = new THREE.Vector3();
    let speed = PLAYER.runSpeed;
    a.crouch = now < this.crouchUntil;

    if (t && t.alive) {
      this.engage(game, dt, now, t, wantMove);
      if (wantMove.lengthSq() > 0) speed = PLAYER.runSpeed * 0.75;
    } else {
      this.burstLeft = 0;
      // recarrega fora de combate
      if (a.weapon.mag < a.wdef.mag * 0.5) startReload(a, now, false);
      let dest = null;
      if (goal?.action === 'plant' || goal?.action === 'defuse') dest = goal.pos;
      else if (this.investigate && now < this.investigate.until && (!goal || goal.action !== 'urgent')) dest = this.investigate;
      else if (this.lastKnown && now - this.lastKnownAt < 4) dest = this.lastKnown;
      else if (goal) dest = goal.pos;
      if (dest) {
        const dd = Math.hypot(dest.x - a.pos.x, dest.z - a.pos.z);
        const arrive = goal && dest === goal.pos ? (goal.radius ?? 1.5) : 1.5;
        if (dd > arrive) {
          this.follow(game, dest, now, wantMove);
          speed = (goal?.quiet && dd < 25) ? PLAYER.walkSpeed : PLAYER.runSpeed;
          const look = wantMove.lengthSq() > 0 ? Math.atan2(-wantMove.x, -wantMove.z) : a.yaw;
          this.turnTo(look, -0.02, dt, 0.6);
        } else {
          if (dest === this.investigate) this.investigate = null;
          if (dest === this.lastKnown) this.lastKnown = null;
          this.hold(game, dt, now, goal);
        }
      }
      this.useAbilities(game, now, goal);
    }

    // movimento
    const wv = wantMove.lengthSq() > 0 ? wantMove.normalize().multiplyScalar(speed * a.wdef.moveMul * (a.crouch ? PLAYER.crouchSpeed / PLAYER.runSpeed : 1)) : wantMove;
    if (!(a.dashUntil && now < a.dashUntil)) {
      const k = Math.min(1, dt * 10);
      a.vel.x += (wv.x - a.vel.x) * k;
      a.vel.z += (wv.z - a.vel.z) * k;
    }
    a.vel.y -= PLAYER.gravity * dt;
    const r = game.world.move(a.pos, a.vel, dt, PLAYER.radius, a.height);
    a.grounded = r.grounded;
    // passos audíveis (andar silencioso não faz barulho)
    const hs = Math.hypot(a.vel.x, a.vel.z);
    if (hs > PLAYER.walkSpeed + 0.4 && a.grounded && !a.crouch) {
      a.stepAcc += hs * dt;
      if (a.stepAcc > 2.3) {
        a.stepAcc = 0;
        if (a.pos.distanceTo(game.player.pos) < 30) {
          playFootstep(a.pos, game.world.surfaceAt(a.pos.x, a.pos.z), 0.9);
          cue('passos', a.pos, game.isEnemyOfPlayer(a));
        }
        game.noise(a, 'passos');
      }
    }
    recover(a, dt, now);
    updateReload(a, now, false);
  }

  engage(game, dt, now, t, wantMove) {
    const a = this.a;
    const eye = a.eye();
    const aimPt = new THREE.Vector3(t.pos.x, t.pos.y + (this.aimHead ? t.height - 0.15 : t.height * 0.68), t.pos.z);
    // antecipa levemente o movimento do alvo
    aimPt.addScaledVector(t.vel, 0.05);
    const d = aimPt.clone().sub(eye);
    const dist = d.length();
    const yaw = Math.atan2(-d.x, -d.z);
    const pitch = Math.asin(d.y / dist);
    // o erro de mira diminui conforme rastreia o alvo
    const tracking = Math.max(0, now - this.seenAt);
    const decay = Math.max(0.25, Math.exp(-tracking * 1.6));
    const flashed = now < a.flashUntil ? 3 : 1;
    this.turnTo(yaw + this.aimErr.yaw * decay * flashed, pitch + this.aimErr.pitch * decay * flashed, dt, 1);
    // compensação de recuo proporcional à habilidade
    const comp = Math.min(0.85, 0.3 + this.s.track / 900);
    a.recoil.pitch *= 1 - comp * Math.min(1, dt * 12);

    // troca para pistola se a principal acabou e o inimigo está perto
    if (a.weapon.mag === 0 && a.weapon.reserve === 0 && a.slot === 1) switchWeapon(a, 2, now);
    if (a.weapon.mag === 0 && now >= a.reloadUntil) {
      if (dist < 10 && a.slot === 1 && a.weapons[2].mag > 0 && a.abilities) switchWeapon(a, 2, now);
      else startReload(a, now, false);
    }
    // a pé: strafe imprevisível; elite para antes de atirar (contra-strafe)
    if (now > this.strafeUntil) {
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      if (Math.random() < 0.25) this.strafeDir = 0;
      this.strafeUntil = now + 0.35 + Math.random() * 0.6;
      if (this.s.reaction < 320 && Math.random() < 0.2) this.crouchUntil = now + 0.8;
    }
    const w = a.wdef;
    const precise = w.id === 'dmr' || w.id === 'sniper' || (w.id === 'rifle' && dist > 18);
    const right = new THREE.Vector3(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    if (!(precise && now > this.seenAt)) wantMove.addScaledVector(right, this.strafeDir);
    if (w.id === 'shotgun' && dist > 8) wantMove.add(new THREE.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw)));
    if (w.scoped) a.ads = dist > 8; else a.ads = precise && this.s.reaction < 450;
    a.adsT += ((a.ads ? 1 : 0) - a.adsT) * Math.min(1, dt / w.adsTime);

    if (now < this.seenAt || now < this.burstPauseUntil) return;
    const yawErr = Math.abs(angleDiff(a.yaw, yaw));
    const tol = Math.max(1.2 * DEG, Math.atan2(0.45, dist));
    if (yawErr > tol * 2.5) return;
    if (this.burstLeft <= 0) this.burstLeft = w.auto ? Math.max(2, Math.round(this.s.burst * (dist < 10 ? 1.6 : dist > 25 ? 0.5 : 1))) : 1;
    if (fire(a, game, now)) {
      this.burstLeft--;
      if (this.burstLeft <= 0) this.burstPauseUntil = now + (w.auto ? 0.18 + Math.random() * 0.25 : 60 / w.rpm + 0.1 + Math.random() * 0.2);
    }
    // habilidades em combate
    if (a.agent.e.id === 'shield' && abilityReady(a, 'e', now) && a.hp < 80) useAbility(a, 'e', game, now);
    if (a.agent.e.id === 'wall' && abilityReady(a, 'e', now) && a.hp < 45) { a.yaw += Math.PI; useAbility(a, 'e', game, now); a.yaw -= Math.PI; }
  }

  hold(game, dt, now, goal) {
    const a = this.a;
    a.ads = false;
    a.adsT += (0 - a.adsT) * Math.min(1, dt * 6);
    if (now > this.holdLookAt) {
      // olha para a direção de ameaça provável com variação
      const threat = goal?.watch || game.mode.threatDir?.(a);
      let base = this.lookYaw;
      if (threat) base = Math.atan2(-(threat.x - a.pos.x), -(threat.z - a.pos.z));
      this.lookYaw = base + (Math.random() - 0.5) * 1.6;
      this.holdLookAt = now + 1.2 + Math.random() * 2;
      if (goal?.roam && Math.random() < 0.35) {
        const p = game.world.randomWalkableNear(goal.pos, goal.roam);
        this.investigate = { x: p.x, z: p.z, until: now + 4 };
      }
    }
    this.turnTo(this.lookYaw, 0, dt, 0.4);
    if (goal?.action === 'plant' || goal?.action === 'defuse') game.mode.botInteract?.(a, now);
  }

  follow(game, dest, now, wantMove) {
    const a = this.a;
    const key = `${Math.round(dest.x)}:${Math.round(dest.z)}`;
    if (key !== this.goalKey) {
      // trajetos longos passam por um ponto intermediário lateral sorteado:
      // a equipe se espalha pelas rotas em vez de afunilar sempre no mesmo corredor
      this.via = null;
      const dx = dest.x - a.pos.x, dz = dest.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 24 && Math.random() < 0.7) {
        const side = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 14);
        const t = 0.35 + Math.random() * 0.3;
        this.via = game.world.randomWalkableNear({ x: a.pos.x + dx * t - dz / d * side, z: a.pos.z + dz * t + dx / d * side }, 4);
      }
    }
    if (this.via && Math.hypot(this.via.x - a.pos.x, this.via.z - a.pos.z) < 2.5) this.via = null;
    if (!this.path || now > this.repathAt || key !== this.goalKey) {
      const target = this.via || dest;
      this.path = game.world.findPath(a.pos, target) || [target];
      this.pathIdx = 0; this.goalKey = key; this.repathAt = now + 2.5 + Math.random();
    }
    let wp = this.path[this.pathIdx];
    while (wp && Math.hypot(wp.x - a.pos.x, wp.z - a.pos.z) < 0.7 && this.pathIdx < this.path.length - 1) wp = this.path[++this.pathIdx];
    if (!wp) return;
    wantMove.set(wp.x - a.pos.x, 0, wp.z - a.pos.z);
    // separação simples para não empilhar aliados
    for (const o of game.actors) {
      if (o === a || !o.alive || o.team !== a.team) continue;
      const dx = a.pos.x - o.pos.x, dz = a.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 1.4 && d2 > 0.0001) { wantMove.x += dx / d2 * 0.6; wantMove.z += dz / d2 * 0.6; }
    }
    // se travou, recalcula
    if (Math.hypot(a.vel.x, a.vel.z) < 0.3 && now > (this.stuckCheck || 0)) { this.stuckCheck = now + 1; this.repathAt = 0; wantMove.x += (Math.random() - 0.5) * 2; wantMove.z += (Math.random() - 0.5) * 2; }
  }

  turnTo(yaw, pitch, dt, speedMul) {
    const a = this.a;
    const maxStep = this.s.track * DEG * dt * speedMul;
    const dy = angleDiff(a.yaw, yaw);
    a.yaw += Math.max(-maxStep, Math.min(maxStep, dy));
    const dp = pitch - a.pitch;
    a.pitch += Math.max(-maxStep, Math.min(maxStep, dp));
  }

  useAbilities(game, now, goal) {
    const a = this.a;
    if (Math.random() > 0.02) return;
    const id = a.agent;
    const nearObjective = goal && Math.hypot(goal.pos.x - a.pos.x, goal.pos.z - a.pos.z) < 18;
    const knownEnemy = this.lastKnown && now - this.lastKnownAt < 3;
    if (id.q.id === 'flash' && knownEnemy && abilityReady(a, 'q', now)) {
      const d = this.lastKnown.clone().sub(a.pos);
      a.yaw = Math.atan2(-d.x, -d.z); a.pitch = 0.15;
      useAbility(a, 'q', game, now);
    } else if (id.q.id === 'smoke' && nearObjective && goal.action !== 'hold' && abilityReady(a, 'q', now)) {
      a.pitch = 0.2; useAbility(a, 'q', game, now);
    } else if (id.q.id === 'pulse' && nearObjective && abilityReady(a, 'q', now)) {
      useAbility(a, 'q', game, now);
    } else if (id.e.id === 'sensor' && goal?.action === 'hold' && nearObjective && abilityReady(a, 'e', now)) {
      useAbility(a, 'e', game, now);
    } else if (id.q.id === 'heal' && abilityReady(a, 'q', now)) {
      const hurt = game.actors.some((o) => o.alive && o.team === a.team && o.hp < 60 && o.pos.distanceTo(a.pos) < 4);
      if (hurt || a.hp < 60) useAbility(a, 'q', game, now);
    }
  }
}
