// Integridade competitiva.
// Num jogo online estas verificações rodam no servidor autoritativo; aqui elas
// rodam numa "camada de autoridade" separada da entrada do jogador, com a mesma
// lógica: o cliente só pede ações, a autoridade valida antes de aplicar.
import { WEAPONS, PLAYER } from './config.js';

function signature(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class Integrity {
  constructor() {
    this.baseline = signature({ WEAPONS, PLAYER });
    this.flags = [];
    this.trust = 100;
    this.lastShot = {};
    this.shotTimes = [];
    this.snapHeadshots = 0;
    this.headshotKills = 0;
    this.kills = 0;
    this.lastPos = null;
    this.speedStrikes = 0;
    this.rejected = 0;
  }

  flag(kind, detail) {
    this.flags.push({ kind, detail, t: Date.now() });
    this.trust = Math.max(0, this.trust - (kind === 'adulteração' ? 50 : 8));
    console.warn('[integridade]', kind, detail);
  }

  // Dados de jogo congelados e com assinatura verificada periodicamente.
  checkData() {
    if (signature({ WEAPONS, PLAYER }) !== this.baseline) { this.flag('adulteração', 'configuração de armas alterada'); return false; }
    return true;
  }

  // Cadência máxima: rejeita disparos acima do RPM da arma (macros, edição de memória).
  validateShot(actor, now) {
    const w = WEAPONS[actor.weapon.id];
    const minGap = 60 / w.rpm - 0.004;
    const last = this.lastShot[w.id] ?? -1;
    this.lastShot[w.id] = now;
    if (now - last < minGap) { this.rejected++; this.flag('cadência', `${w.id}: ${(now - last).toFixed(3)}s < ${minGap.toFixed(3)}s`); return false; }
    return true;
  }

  // Movimento: deslocamento por quadro acima do possível (speedhack/teleporte).
  validateMovement(actor, dt, now) {
    if (!this.lastPos) { this.lastPos = actor.pos.clone(); return true; }
    const d = Math.hypot(actor.pos.x - this.lastPos.x, actor.pos.z - this.lastPos.z);
    const max = (actor.dashUntil && now < actor.dashUntil + 0.3 ? 17 : PLAYER.runSpeed * 1.35) * dt + 0.05;
    this.lastPos.copy(actor.pos);
    if (d > max && d < 20) {
      this.speedStrikes++;
      if (this.speedStrikes > 6) { this.flag('movimento', `deslocamento ${d.toFixed(2)}m em ${dt.toFixed(3)}s`); this.speedStrikes = 0; }
      return false;
    }
    this.speedStrikes = Math.max(0, this.speedStrikes - 0.1);
    return true;
  }

  resetPosition(actor) { this.lastPos = actor.pos.clone(); }

  // Acerto: a autoridade refaz a linha de visão e a distância antes de aceitar o dano.
  validateHit(world, origin, point, weaponId) {
    const w = WEAPONS[weaponId];
    const dist = origin.distanceTo(point);
    if (dist > w.range + 1) { this.rejected++; this.flag('alcance', `${weaponId} a ${dist.toFixed(1)} m`); return false; }
    const dir = point.clone().sub(origin).normalize();
    const block = world.raycast(origin, dir, dist - 0.2);
    if (block) { this.rejected++; this.flag('através de parede', `${weaponId}`); return false; }
    return true;
  }

  // Heurística de mira: giro brusco seguido de abate na cabeça, repetidamente.
  noteKill(head, recentTurnDegPerSec) {
    this.kills++;
    if (head) this.headshotKills++;
    if (head && recentTurnDegPerSec > 2400) this.snapHeadshots++;
    if (this.kills >= 10 && this.snapHeadshots / this.kills > 0.5) {
      this.flag('mira suspeita', `${this.snapHeadshots}/${this.kills} abates com giro instantâneo`);
      this.snapHeadshots = 0;
    }
  }

  summary() {
    return { trust: this.trust, flags: this.flags.length, rejected: this.rejected };
  }
}
