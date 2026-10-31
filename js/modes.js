// Regras de cada modo: objetivos, pontuação, renascimento, metas dos bots e estado do HUD.
import * as THREE from './vendor/three.module.min.js';
import { MODES, WEAPONS, PRIMARY_IDS } from './config.js';
import { playAnnounce, playBeep } from './audio.js';
import { CELL } from './maps.js';

const TEAM_NAME = { A: 'Aliados', B: 'Oponentes' };

function fmt(t) {
  t = Math.max(0, Math.ceil(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

class BaseMode {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.score = { A: 0, B: 0 };
    this.over = false;
    this.result = null;
    this.time = 0;
  }
  spawnCells(team) { return team === 'A' ? this.game.map.spawns.a : this.game.map.spawns.d; }
  spawnActor(a, now, team = a.team) {
    const cells = this.spawnCells(team);
    // escolhe a célula de spawn mais distante de inimigos vivos
    let best = cells[0], bestD = -1;
    for (let k = 0; k < 8; k++) {
      const c = cells[Math.floor(Math.random() * cells.length)];
      let dmin = Infinity;
      for (const o of this.game.actors) if (o.alive && o.team !== a.team && o !== a) dmin = Math.min(dmin, Math.hypot(o.pos.x - c.x, o.pos.z - c.z));
      const taken = this.game.actors.some((o) => o !== a && o.alive && Math.hypot(o.pos.x - c.x, o.pos.z - c.z) < 1.2);
      const score = dmin - (taken ? 50 : 0);
      if (score > bestD) { bestD = score; best = c; }
    }
    a.reset();
    a.pos.set(best.x + (Math.random() - 0.5) * 0.6, 0, best.z + (Math.random() - 0.5) * 0.6);
    // olha para o centro do mapa
    const cx = this.game.map.w * CELL / 2, cz = this.game.map.h * CELL / 2;
    a.yaw = Math.atan2(-(cx - a.pos.x), -(cz - a.pos.z));
    a.pitch = 0;
    a.spawnProtectUntil = now + 2;
    if (a.brain) { a.brain.path = null; a.brain.target = null; a.brain.investigate = null; }
    if (a.isPlayer) this.game.onPlayerSpawn();
  }
  canChangeLoadout(a) { return a.isPlayer && (!a.alive || this.inSpawn(a)); }
  inSpawn(a) {
    const cells = this.spawnCells(a.team);
    return cells.some((c) => Math.abs(c.x - a.pos.x) < CELL && Math.abs(c.z - a.pos.z) < CELL);
  }
  onKill() {}
  update() {}
  goalFor() { return null; }
  threatDir(a) {
    const enemy = a.team === 'A' ? this.game.map.spawns.d[0] : this.game.map.spawns.a[0];
    return enemy;
  }
  finish(winner, reason) {
    if (this.over) return;
    this.over = true;
    this.result = { winner, reason, score: { ...this.score } };
    playAnnounce(winner === this.game.player.team ? 'win' : 'lose');
    this.game.onMatchEnd(this.result);
  }
  respawnLoop(now, delay) {
    for (const a of this.game.actors) {
      if (!a.alive && now - a.deathTime > delay) this.spawnActor(a, now);
    }
  }
  randomPrimary() { return PRIMARY_IDS[Math.floor(Math.random() * PRIMARY_IDS.length)]; }
}

// ---------- Treinamento ----------
export class TrainingMode extends BaseMode {
  constructor(game) {
    super(game, MODES.training);
    this.drill = 'estande';
    this.targets = [];
    this.stats = { shots: 0, hits: 0, heads: 0, kills: 0, ttk: [] };
  }
  setup(now) {
    this.spawnActor(this.game.player, now);
    this.setDrill('estande', now);
  }
  setDrill(drill, now) {
    this.drill = drill;
    for (const t of this.game.actors.filter((a) => !a.isPlayer)) this.game.removeActor(t);
    const W = this.game.map.w * CELL;
    if (drill === 'estande' || drill === 'rastreamento') {
      const rows = [{ z: 46, n: 3 }, { z: 34, n: 3 }, { z: 20, n: 2 }, { z: 8, n: 2 }];
      for (const r of rows) for (let i = 0; i < r.n; i++) {
        const x = W * (i + 1) / (r.n + 1);
        const t = this.game.addDummy('B', x, r.z, drill === 'rastreamento');
        t.spawnPos = { x, z: r.z };
      }
      this.game.hud.banner(drill === 'estande' ? 'Estande: alvos fixos' : 'Rastreamento: alvos em movimento', 'Distâncias de 10 a 50 m. Pratique o primeiro tiro na cabeça e o controle de rajada.');
    } else if (drill === 'duelo') {
      const bot = this.game.addBot('B', 'veterano', this.randomPrimary());
      this.spawnActor(bot, now, 'B');
      this.game.hud.banner('Duelo', 'Um bot Veterano por vez. Use cobertura e jogue com as habilidades.');
    }
    this.stats = { shots: 0, hits: 0, heads: 0, kills: 0, ttk: [] };
  }
  update(dt, now) {
    // munição de reserva infinita
    const p = this.game.player;
    for (const s of [1, 2]) p.weapons[s].reserve = WEAPONS[p.weapons[s].id].reserve;
    for (const t of this.game.actors) {
      if (t.isPlayer) continue;
      if (t.dummy) {
        if (!t.alive && now - t.deathTime > 1.5) { t.reset(); t.pos.set(t.spawnPos.x, 0, t.spawnPos.z); t.firstHitAt = 0; }
        if (t.alive && t.moving) { t.pos.x = t.spawnPos.x + Math.sin(now * 1.3 + t.id) * 3.5; t.vel.x = Math.cos(now * 1.3 + t.id) * 4.5; t.crouch = Math.sin(now * 0.7 + t.id * 2) > 0.85; }
        t.yaw = Math.atan2(-(p.pos.x - t.pos.x), -(p.pos.z - t.pos.z));
      } else if (!t.alive && now - t.deathTime > 2.5) this.spawnActor(t, now, 'B');
    }
    if (!p.alive && now - p.deathTime > 2) this.spawnActor(p, now);
  }
  onKill(killer, victim, now) {
    if (killer.isPlayer) {
      this.stats.kills++;
      if (victim.firstHitAt) this.stats.ttk.push(now - victim.firstHitAt);
    }
  }
  canChangeLoadout() { return true; }
  goalFor(a) { return { pos: this.game.player.pos, radius: 12, action: 'hunt', roam: 8 }; }
  hud(now) {
    const s = this.stats;
    const p = this.game.player.stats;
    const acc = p.shots ? Math.round(p.hits / p.shots * 100) : 0;
    const hs = p.hits ? Math.round((this.game.headHits || 0) / p.hits * 100) : 0;
    const ttk = s.ttk.length ? (s.ttk.reduce((x, y) => x + y, 0) / s.ttk.length).toFixed(2) + ' s' : '—';
    return {
      left: { label: 'Precisão', value: acc + '%' }, right: { label: 'Cabeça', value: hs + '%' },
      center: this.drill === 'duelo' ? 'Duelo' : this.drill === 'estande' ? 'Estande' : 'Rastreamento',
      sub: `Abates ${s.kills} · TTK médio ${ttk} · [T] trocar exercício · [B] trocar arma · [Esc] menu`,
    };
  }
}

// ---------- Confronto (TDM) ----------
export class TdmMode extends BaseMode {
  constructor(game) { super(game, MODES.tdm); this.timeLeft = this.def.timeLimit; }
  setup(now) {
    for (const a of this.game.actors) this.spawnActor(a, now);
    this.game.hud.banner('Confronto', `Primeira equipe a ${this.def.killTarget} abates vence.`);
  }
  update(dt, now) {
    if (this.over) return;
    this.timeLeft -= dt;
    this.respawnLoop(now, this.def.respawn);
    if (this.score.A >= this.def.killTarget) this.finish('A', 'Meta de abates');
    else if (this.score.B >= this.def.killTarget) this.finish('B', 'Meta de abates');
    else if (this.timeLeft <= 0) this.finish(this.score.A === this.score.B ? null : this.score.A > this.score.B ? 'A' : 'B', 'Tempo esgotado');
  }
  onKill(killer, victim) { if (killer && killer.team !== victim.team) this.score[killer.team]++; }
  goalFor(a) {
    // patrulha: vai para zonas centrais e flancos alternadamente
    const b = a.brain;
    if (!b.patrol || Math.hypot(b.patrol.x - a.pos.x, b.patrol.z - a.pos.z) < 3 || this.time > (b.patrolUntil || 0)) {
      const map = this.game.map;
      const anchors = [...map.points.map((p) => p.center), map.sites.A.center, map.sites.B.center].filter(Boolean);
      const base = anchors[Math.floor(Math.random() * anchors.length)];
      b.patrol = this.game.world.randomWalkableNear(base, 8);
      b.patrolUntil = this.time + 20;
    }
    return { pos: b.patrol, radius: 2, action: 'hunt', roam: 6 };
  }
  hud() {
    return {
      left: { label: TEAM_NAME.A, value: this.score.A, team: 'A' }, right: { label: TEAM_NAME.B, value: this.score.B, team: 'B' },
      center: fmt(this.timeLeft), sub: `Primeira a ${this.def.killTarget} abates`,
      progress: { a: this.score.A / this.def.killTarget, b: this.score.B / this.def.killTarget },
    };
  }
}

// ---------- Domínio ----------
export class DominationMode extends BaseMode {
  constructor(game) {
    super(game, MODES.domination);
    this.timeLeft = this.def.timeLimit;
    this.points = game.map.points.map((p) => ({ ...p, owner: null, progress: 0, capturing: null }));
    this.tick = 0;
    this.swapped = false;
  }
  // Troca de lados no intervalo: qualquer vantagem do mapa vale igualmente para as duas equipes.
  spawnCells(team) { return (team === 'A') !== this.swapped ? this.game.map.spawns.a : this.game.map.spawns.d; }
  halftime(now) {
    this.swapped = true;
    for (const p of this.points) { p.owner = null; p.progress = 0; p.capturing = null; }
    this.refreshVisuals();
    for (const a of this.game.actors) { a.brain && (a.brain.domTarget = null); this.spawnActor(a, now); }
    this.game.clearRoundObjects();
    this.game.hud.banner('Intervalo — troca de lados', 'Os pontos voltaram a ficar neutros. Placar mantido.');
    playAnnounce('round');
  }
  setup(now) {
    for (const a of this.game.actors) this.spawnActor(a, now);
    this.refreshVisuals();
    this.game.hud.banner('Domínio', 'Capture Alfa, Bravo e Charlie. Cada ponto controlado gera 1 ponto por segundo.');
  }
  refreshVisuals() {
    const c = this.game.colors();
    for (const p of this.points) this.game.world.setPointVisuals(p.id, p.owner ? (p.owner === this.game.player.team ? c.ally : c.enemy) : '#dddddd');
  }
  update(dt, now) {
    if (this.over) return;
    this.timeLeft -= dt;
    this.respawnLoop(now, this.def.respawn);
    for (const p of this.points) {
      const inside = { A: 0, B: 0 };
      for (const a of this.game.actors) if (a.alive && Math.hypot(a.pos.x - p.center.x, a.pos.z - p.center.z) < p.radius) inside[a.team]++;
      const team = inside.A && !inside.B ? 'A' : inside.B && !inside.A ? 'B' : null;
      p.contested = inside.A > 0 && inside.B > 0;
      if (team && p.owner !== team) {
        const dir = team === 'A' ? 1 : -1;
        const rate = Math.min(2, 1 + (inside[team] - 1) * 0.5) / this.def.captureTime;
        // primeiro neutraliza, depois captura
        p.progress += dir * rate * dt;
        p.capturing = team;
        if (Math.abs(p.progress) >= 1) {
          p.progress = dir;
          const prev = p.owner;
          p.owner = team;
          this.refreshVisuals();
          const mine = team === this.game.player.team;
          playAnnounce(mine ? 'capture' : 'lost');
          this.game.hud.objective(mine ? `Ponto ${p.label} capturado` : `Ponto ${p.label} perdido`, mine ? 'ally' : 'enemy');
          for (const a of this.game.actors) if (a.alive && a.team === team && Math.hypot(a.pos.x - p.center.x, a.pos.z - p.center.z) < p.radius) {
            a.stats.captures++; a.stats.score += 150;
            if (a.isPlayer) { this.game.track('capture'); this.game.reward(150, 'Captura'); }
          }
          void prev;
        } else if (p.owner && Math.sign(p.progress) !== Math.sign(p.owner === 'A' ? 1 : -1)) {
          p.owner = null; this.refreshVisuals();
        }
      } else if (!team && !p.contested && p.owner) {
        p.progress += ((p.owner === 'A' ? 1 : -1) - p.progress) * Math.min(1, dt);
        p.capturing = null;
      } else if (!team && !p.contested && !p.owner) {
        p.progress *= 1 - Math.min(1, dt * 0.3);
        p.capturing = null;
      }
    }
    this.tick += dt;
    while (this.tick >= 1) {
      this.tick -= 1;
      for (const p of this.points) if (p.owner) this.score[p.owner]++;
    }
    if (!this.swapped && Math.max(this.score.A, this.score.B) >= this.def.scoreTarget / 2) return this.halftime(now);
    if (this.score.A >= this.def.scoreTarget) this.finish('A', 'Meta de pontos');
    else if (this.score.B >= this.def.scoreTarget) this.finish('B', 'Meta de pontos');
    else if (this.timeLeft <= 0) this.finish(this.score.A === this.score.B ? null : this.score.A > this.score.B ? 'A' : 'B', 'Tempo esgotado');
  }
  onKill(killer, victim) {
    if (!killer || killer.team === victim.team) return;
    // abate dentro/perto de um ponto vale bônus individual (defesa/ataque)
    for (const p of this.points) if (Math.hypot(victim.pos.x - p.center.x, victim.pos.z - p.center.z) < p.radius + 4) { killer.stats.score += 50; if (killer.isPlayer) this.game.reward(50, p.owner === killer.team ? 'Defesa de ponto' : 'Ataque a ponto'); }
  }
  goalFor(a) {
    const b = a.brain;
    if (!b.domTarget || this.time > (b.domUntil || 0) || b.domTarget.owner === a.team && Math.random() < 0.01) {
      // prioriza pontos não controlados mais próximos; alguns defendem
      const scored = this.points.map((p) => {
        const d = Math.hypot(p.center.x - a.pos.x, p.center.z - a.pos.z);
        const value = p.owner === a.team ? 40 : p.owner ? 0 : -10;
        return { p, s: d + value + Math.random() * 25 };
      }).sort((x, y) => x.s - y.s);
      b.domTarget = scored[0].p;
      b.domUntil = this.time + 15 + Math.random() * 10;
    }
    const p = b.domTarget;
    return { pos: p.center, radius: p.radius * 0.7, action: 'hold', roam: p.radius * 0.6 };
  }
  hud() {
    return {
      left: { label: TEAM_NAME.A, value: this.score.A, team: 'A' }, right: { label: TEAM_NAME.B, value: this.score.B, team: 'B' },
      center: fmt(this.timeLeft), sub: `Primeira a ${this.def.scoreTarget} pontos · ${this.swapped ? '2º tempo' : `troca de lados aos ${this.def.scoreTarget / 2}`}`,
      progress: { a: this.score.A / this.def.scoreTarget, b: this.score.B / this.def.scoreTarget },
      points: this.points.map((p) => ({ id: p.id, label: p.label[0], owner: p.owner, progress: p.progress, contested: p.contested })),
    };
  }
}

// ---------- Ruptura (competitivo) ----------
export class BreachMode extends BaseMode {
  constructor(game) {
    super(game, MODES.breach);
    this.round = 0;
    this.attackers = 'A';
    this.phase = 'prep';
    this.phaseEnd = 0;
    this.charge = null; // {state:'carried'|'dropped'|'planted', carrier, pos, site, plantedAt, defuseProgress}
    this.roundHistory = [];
  }
  setup(now) { this.startRound(now); }
  get defenders() { return this.attackers === 'A' ? 'B' : 'A'; }
  spawnCells(team) { return team === this.attackers ? this.game.map.spawns.a : this.game.map.spawns.d; }

  startRound(now) {
    this.round++;
    if (this.round === this.def.swapAfter + 1) {
      this.attackers = this.defenders;
      this.game.hud.banner('Troca de lados', `Sua equipe agora ${this.attackers === this.game.player.team ? 'ataca' : 'defende'}.`);
    }
    this.game.clearRoundObjects();
    for (const a of this.game.actors) {
      if (!a.isPlayer && Math.random() < 0.25) a.primaryId = this.randomPrimary();
      this.spawnActor(a, now);
    }
    // carga: entregue a um atacante
    const atk = this.game.actors.filter((a) => a.team === this.attackers);
    const carrier = atk.find((a) => a.isPlayer) && Math.random() < 0.5 ? atk.find((a) => a.isPlayer) : atk[Math.floor(Math.random() * atk.length)];
    this.charge = { state: 'carried', carrier, pos: carrier.pos.clone(), site: null, plantedAt: 0, defuseProgress: 0, beepAt: 0 };
    carrier.carrying = true;
    // estratégia da rodada: site alvo e rotas
    this.targetSite = Math.random() < 0.5 ? 'A' : 'B';
    atk.forEach((a, i) => { if (a.brain) { a.brain.route = i % 3 === 2 ? 'flank' : 'main'; a.brain.flankDone = false; } });
    const def = this.game.actors.filter((a) => a.team === this.defenders);
    def.forEach((a, i) => { if (a.brain) a.brain.post = ['A', 'B', 'A', 'B', 'mid'][i % 5]; });
    this.phase = 'prep';
    this.phaseEnd = now + this.def.prepTime;
    const role = this.attackers === this.game.player.team ? 'ATAQUE' : 'DEFESA';
    this.game.hud.banner(`Rodada ${this.round} — ${role}`, this.attackers === this.game.player.team
      ? 'Leve a carga até A ou B e plante (segure F). [B] troca equipamento durante a preparação.'
      : 'Impeça o plantio ou desarme a carga (segure F). [B] troca equipamento durante a preparação.');
    playAnnounce('round');
  }

  canChangeLoadout(a) { return this.phase === 'prep'; }
  movementLocked(a) { return this.phase === 'prep' ? 'prep' : null; }

  aliveCount(team) { return this.game.actors.filter((a) => a.alive && a.team === team).length; }

  endRound(winner, reason, now) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.phaseEnd = now + 5;
    this.score[winner]++;
    this.roundHistory.push({ winner, reason });
    const mine = winner === this.game.player.team;
    playAnnounce(mine ? 'win' : 'lose');
    this.game.hud.roundResult(mine, reason, this.score, this.game.player.team);
    for (const a of this.game.actors) if (a.team === winner) { a.stats.score += 100; if (a.isPlayer) this.game.reward(100, 'Rodada vencida'); }
  }

  update(dt, now) {
    if (this.over) return;
    const ch = this.charge;
    if (this.phase === 'prep' && now >= this.phaseEnd) { this.phase = 'live'; this.phaseEnd = now + this.def.roundTime; this.game.hud.objective('Rodada iniciada', 'neutral'); }
    if (this.phase === 'end') {
      if (now >= this.phaseEnd) {
        const toWin = this.def.roundsToWin;
        if (this.score.A >= toWin) return this.finish('A', `${this.score.A}–${this.score.B}`);
        if (this.score.B >= toWin) return this.finish('B', `${this.score.B}–${this.score.A}`);
        this.startRound(now);
      }
      return;
    }
    // carga solta: atacante pega ao passar por cima
    if (ch.state === 'dropped') {
      for (const a of this.game.actors) if (a.alive && a.team === this.attackers && a.pos.distanceTo(ch.pos) < 1.2) {
        ch.state = 'carried'; ch.carrier = a; a.carrying = true;
        if (a.isPlayer) this.game.hud.objective('Você pegou a carga', 'ally');
        break;
      }
    }
    if (ch.state === 'carried') ch.pos.copy(ch.carrier.pos);

    if (this.phase === 'live') {
      if (ch.state !== 'planted') {
        if (this.aliveCount(this.attackers) === 0) return this.endRound(this.defenders, 'Atacantes eliminados', now);
        if (this.aliveCount(this.defenders) === 0) return this.endRound(this.attackers, 'Defensores eliminados', now);
        if (now >= this.phaseEnd) return this.endRound(this.defenders, 'Tempo esgotado', now);
      } else {
        if (this.aliveCount(this.defenders) === 0) return this.endRound(this.attackers, 'Defensores eliminados', now);
        const left = ch.plantedAt + this.def.fuseTime - now;
        // bipes acelerando
        if (now >= ch.beepAt) { playBeep(left < 10 ? 1.3 : 1, ch.pos); ch.beepAt = now + Math.max(0.15, Math.min(1, left / 20)); }
        if (left <= 0) {
          this.game.effects.burst(ch.pos.clone().setY(1.5), '255,180,90', now, 16);
          return this.endRound(this.attackers, 'Carga detonada', now);
        }
      }
      // progresso de plantio/desarme (bots e jogador usam o mesmo caminho)
      for (const a of this.game.actors) {
        if (!a.alive) continue;
        const wants = a.isPlayer ? this.game.input.interactHeld : a.wantsInteract;
        a.wantsInteract = false;
        if (a.team === this.attackers && ch.state === 'carried' && ch.carrier === a) {
          const site = this.siteAt(a.pos);
          if (wants && site && a.grounded && Math.hypot(a.vel.x, a.vel.z) < 0.5) {
            a.planting += dt;
            if (a.planting >= this.def.plantTime) this.plant(a, site, now);
          } else a.planting = 0;
        } else if (a.team === this.defenders && ch.state === 'planted' && a.pos.distanceTo(ch.pos) < 1.6) {
          if (wants && Math.hypot(a.vel.x, a.vel.z) < 0.5) {
            a.defusing += dt;
            // metade do desarme fica salva
            const total = ch.defuseProgress + a.defusing;
            if (total >= this.def.defuseTime) return this.defuse(a, now);
          } else {
            if (a.defusing > 0) ch.defuseProgress = Math.max(ch.defuseProgress, ch.defuseProgress + a.defusing >= this.def.defuseTime / 2 ? this.def.defuseTime / 2 : 0);
            a.defusing = 0;
          }
        } else { a.planting = 0; a.defusing = 0; }
      }
    }
  }

  siteAt(pos) {
    for (const k of ['A', 'B']) {
      const s = this.game.map.sites[k];
      if (s.cells.some((c) => Math.abs(c.x - pos.x) <= CELL / 2 + 0.2 && Math.abs(c.z - pos.z) <= CELL / 2 + 0.2)) return k;
    }
    return null;
  }

  plant(a, site, now) {
    const ch = this.charge;
    ch.state = 'planted'; ch.site = site; ch.plantedAt = now; ch.pos.copy(a.pos); ch.carrier = null;
    a.carrying = false; a.planting = 0;
    a.stats.plants++; a.stats.score += 150;
    this.game.placeChargeModel(ch.pos);
    playAnnounce('plant');
    const mine = a.team === this.game.player.team;
    this.game.hud.objective(`Carga plantada em ${site}`, mine ? 'ally' : 'enemy');
    if (a.isPlayer) { this.game.track('plant'); this.game.reward(150, 'Carga plantada'); }
  }

  defuse(a, now) {
    a.stats.defuses++; a.stats.score += 200;
    playAnnounce('defuse');
    if (a.isPlayer) { this.game.track('defuse'); this.game.reward(200, 'Carga desarmada'); }
    this.endRound(this.defenders, 'Carga desarmada', now);
  }

  onKill(killer, victim, now) {
    if (victim.carrying) {
      victim.carrying = false;
      this.charge.state = 'dropped';
      this.charge.carrier = null;
      this.charge.pos.copy(victim.pos);
      this.game.hud.objective('A carga caiu', victim.team === this.game.player.team ? 'enemy' : 'ally');
    }
  }

  botInteract(a) { a.wantsInteract = true; }

  goalFor(a) {
    const map = this.game.map, ch = this.charge, b = a.brain;
    if (this.phase === 'prep') return { pos: a.pos.clone(), radius: 50, action: 'hold' };
    if (a.team === this.attackers) {
      const site = ch.state === 'planted' ? map.sites[ch.site] : map.sites[this.targetSite];
      if (ch.state === 'dropped') return { pos: ch.pos, radius: 0.5, action: 'urgent' };
      if (ch.state === 'planted') return { pos: ch.pos, radius: 7, action: 'hold', roam: 6, watch: this.game.map.spawns.d[0] };
      if (ch.carrier === a) {
        // carregador espera a equipe abrir caminho até ~40 s de rodada
        const elapsed = this.def.roundTime - (this.phaseEnd - this.game.now);
        const allies = this.game.actors.filter((o) => o.alive && o.team === a.team && o !== a);
        const opened = allies.some((o) => Math.hypot(o.pos.x - site.center.x, o.pos.z - site.center.z) < site.radius + 3) || elapsed > 40 || !allies.length;
        if (!opened) return { pos: this.stage(site), radius: 2, action: 'move', quiet: true };
        // ponto de plantio: célula do site mais próxima
        const cell = site.cells.reduce((best, c) => (Math.hypot(c.x - a.pos.x, c.z - a.pos.z) < Math.hypot(best.x - a.pos.x, best.z - a.pos.z) ? c : best), site.cells[0]);
        return { pos: cell, radius: 0.6, action: 'plant' };
      }
      if (b.route === 'flank' && !b.flankDone) {
        const other = map.sites[this.targetSite === 'A' ? 'B' : 'A'].center;
        const mid = { x: (site.center.x + other.x) / 2, z: map.h * CELL * 0.45 };
        const p = this.game.world.randomWalkableNear(mid, 3);
        if (Math.hypot(mid.x - a.pos.x, mid.z - a.pos.z) < 5) b.flankDone = true;
        return { pos: b.flankPos || (b.flankPos = p), radius: 3, action: 'move', quiet: true };
      }
      return { pos: site.center, radius: site.radius, action: 'hold', roam: site.radius, quiet: true };
    }
    // defensores
    if (ch.state === 'planted') return { pos: ch.pos, radius: 1.2, action: 'defuse' };
    const post = b.post === 'mid' ? (map.points.find((p) => p.id === '2')?.center || map.sites.A.center) : map.sites[b.post].center;
    return { pos: post, radius: 6, action: 'hold', roam: 7, watch: this.game.map.spawns.a[0] };
  }

  stage(site) {
    // ponto de espera a ~14 m do site em direção ao spawn atacante
    const spawn = this.game.map.spawns.a[0];
    const dx = spawn.x - site.center.x, dz = spawn.z - site.center.z, d = Math.hypot(dx, dz) || 1;
    const p = { x: site.center.x + dx / d * 14, z: site.center.z + dz / d * 14 };
    return this.game.world.randomWalkableNear(p, 2);
  }

  hud(now) {
    const ch = this.charge;
    let center = '', sub = '';
    if (this.phase === 'prep') { center = fmt(this.phaseEnd - now); sub = 'Preparação — [B] equipamento'; }
    else if (this.phase === 'live' && ch.state !== 'planted') { center = fmt(this.phaseEnd - now); sub = this.attackers === this.game.player.team ? 'Plante a carga em A ou B' : 'Defenda A e B'; }
    else if (ch.state === 'planted') { center = fmt(ch.plantedAt + this.def.fuseTime - now); sub = `Carga plantada em ${ch.site}`; }
    else { center = '—'; sub = 'Fim da rodada'; }
    const me = this.game.player;
    let progress = null;
    if (me.planting > 0) progress = { label: 'Plantando…', value: me.planting / this.def.plantTime };
    if (me.defusing > 0) progress = { label: 'Desarmando…', value: (ch.defuseProgress + me.defusing) / this.def.defuseTime };
    const alive = (t) => this.game.actors.filter((a) => a.team === t).map((a) => a.alive);
    return {
      left: { label: this.attackers === 'A' ? 'ATQ' : 'DEF', value: this.score.A, team: 'A' },
      right: { label: this.attackers === 'B' ? 'ATQ' : 'DEF', value: this.score.B, team: 'B' },
      center, sub, planted: ch.state === 'planted', interact: progress,
      roster: { A: alive('A'), B: alive('B') }, round: this.round,
    };
  }
}

export function createMode(id, game) {
  switch (id) {
    case 'training': return new TrainingMode(game);
    case 'tdm': return new TdmMode(game);
    case 'domination': return new DominationMode(game);
    default: return new BreachMode(game);
  }
}

export { TEAM_NAME, fmt };
