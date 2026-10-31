// Núcleo da partida: cena, entrada, física do jogador, disparos, dano e ciclo de jogo.
import * as THREE from './vendor/three.module.min.js';
import { PLAYER, WEAPONS, AGENTS, BOT_SKILL, PRIMARY_IDS } from './config.js';
import { parseMap, MAPS, TRAINING_MAP } from './maps.js';
import { World } from './world.js';
import { Actor } from './actor.js';
import { BotBrain } from './bots.js';
import { Effects } from './effects.js';
import { ViewModel } from './viewmodel.js';
import { Hud } from './hud.js';
import { Integrity } from './integrity.js';
import { Social, QUICK_COMMS } from './social.js';
import { createMode } from './modes.js';
import { fire, startReload, updateReload, switchWeapon, recover, currentSpread, falloffMul, partMul, cancelReload } from './combat.js';
import { useAbility, updateAbilityCharges, updateProjectiles, updateGadgets } from './abilities.js';
import { settings, teamColors } from './settings.js';
import { profile, trackEvent, saveProfile } from './progression.js';
import * as audio from './audio.js';

const DEG = Math.PI / 180;
const BOT_NAMES = ['Tavares', 'Okafor', 'Lindqvist', 'Moreau', 'Sato', 'Bianchi', 'Kowalski', 'Ferreira', 'Haddad', 'Novak', 'Ríos', 'Mensah', 'Ivanova', 'Quispe', 'Duarte', 'Varga', 'Nakamura', 'Costa', 'Abara', 'Lemaire'];

export class Game {
  constructor({ canvas, hudRoot, opts, onEnd }) {
    this.canvas = canvas;
    this.opts = opts; // {mode, mapId, skill, ranked}
    this.onEnd = onEnd;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: settings.quality !== 'baixa', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio) * settings.renderScale);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 600);
    this.viewmodel = new ViewModel();
    this.viewmodel.setCamo(profile.equipped.camo);
    this.hud = new Hud(hudRoot);
    this.social = new Social(this.hud);
    this.integrity = new Integrity();
    this.effects = new Effects(this.scene);
    this.actors = [];
    this.projectiles = [];
    this.gadgets = [];
    this.pings = [];
    this.now = 0;
    this.paused = false;
    this.running = true;
    this.events = [];
    this.xpLog = [];
    this.multi = { count: 0, last: -10 };
    this.turnRate = 0;
    this.input = { keys: new Set(), fireHeld: false, firePressed: false, adsHeld: false, dx: 0, dy: 0, interactHeld: false };
    this.shake = 0;

    const def = opts.mode === 'training' ? TRAINING_MAP : MAPS.find((m) => m.id === opts.mapId) || MAPS[0];
    this.map = parseMap(def);
    this.setupLighting(def);
    this.world = new World(this.scene, this.map);
    this.mode = createMode(opts.mode, this);
    this.setupActors();
    this.bindInput();
    this.resize();
    this.mode.setup(this.now);
    audio.startAmbience(def.theme);
    this.last = performance.now();
    this.fpsAcc = 0; this.fpsN = 0;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  colors() { return teamColors(); }
  isEnemyOfPlayer(a) { return a.team !== this.player.team; }

  setupLighting(def) {
    const sky = def.sky;
    this.scene.fog = new THREE.FogExp2(sky.fog, def.theme === 'instalacao' ? 0.011 : 0.0075);
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(sky.top) }, bottom: { value: new THREE.Color(sky.bottom) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP;\nvoid main(){ float h = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0);\n#include <colorspace_fragment>\n}',
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
    // iluminação baseada em imagem a partir do próprio céu: materiais metálicos e
    // faces na sombra recebem luz ambiente crível em vez de ficarem pretos
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(skyGeo, skyMat));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(390, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(sky.bottom).multiplyScalar(0.35) }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -5;
    envScene.add(ground);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envMap;
    this.viewmodel.scene.environment = this.envMap;
    const hemi = new THREE.HemisphereLight(sky.top, 0x4a4036, sky.ambient * 0.8);
    this.scene.add(hemi);
    const fill = new THREE.DirectionalLight(sky.top, 0.35);
    fill.position.set(-60, 40, 90);
    this.scene.add(fill);
    const sun = new THREE.DirectionalLight(sky.sun, sky.sunIntensity);
    const W = this.map.w * 2, D = this.map.h * 2;
    sun.position.set(W * 0.5 + 40, 70, D * 0.5 - 30);
    sun.target.position.set(W / 2, 0, D / 2);
    sun.castShadow = settings.shadows;
    const sz = settings.quality === 'alta' ? 4096 : 2048;
    sun.shadow.mapSize.set(sz, sz);
    const ext = Math.max(W, D) * 0.62;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: 200 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
  }

  setupActors() {
    const c = this.colors();
    const skill = BOT_SKILL[this.opts.skill] || BOT_SKILL.soldado;
    this.player = new Actor({ name: profile.name, team: 'A', agentId: profile.equipped.agent, isPlayer: true, primary: profile.equipped.primary });
    this.actors.push(this.player);
    this.viewmodel.show(this.player.weapon.id);
    if (this.opts.mode === 'training') return;
    // Composição espelhada: cada equipe recebe os 4 agentes (sem repetição até esgotar)
    // e bots com a MESMA habilidade, para que o resultado dependa das decisões, não do sorteio.
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const agentsFor = (exclude) => {
      const pool = AGENTS.map((a) => a.id).filter((id) => id !== exclude);
      const out = [...pool];
      while (out.length < 5) out.push(AGENTS[out.length % AGENTS.length].id);
      return out.sort(() => Math.random() - 0.5);
    };
    const allyAgents = agentsFor(this.player.agent.id);
    const enemyAgents = agentsFor(null);
    const primaries = () => { const p = [...PRIMARY_IDS, 'rifle', 'rifle', 'smg']; return p.sort(() => Math.random() - 0.5); };
    const allyW = primaries(), enemyW = primaries();
    for (let i = 0; i < 4; i++) this.addBot('A', this.opts.skill, allyW[i], allyAgents[i], names.pop());
    for (let i = 0; i < 5; i++) this.addBot('B', this.opts.skill, enemyW[i], enemyAgents[i], names.pop());
    void skill; void c;
  }

  addBot(team, skillId, primary, agentId, name) {
    const a = new Actor({ name: name || BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)], team, agentId: agentId || AGENTS[Math.floor(Math.random() * AGENTS.length)].id, skill: BOT_SKILL[skillId] || BOT_SKILL.soldado, primary: primary || 'rifle' });
    a.brain = new BotBrain(a);
    this.scene.add(a.buildModel({ team: team === this.player.team ? this.colors().ally : this.colors().enemy }));
    this.actors.push(a);
    return a;
  }

  addDummy(team, x, z, moving) {
    const a = new Actor({ name: 'Alvo', team, agentId: 'brasa' });
    a.dummy = true; a.moving = moving;
    this.scene.add(a.buildModel({ team: this.colors().enemy }));
    a.pos.set(x, 0, z);
    this.actors.push(a);
    return a;
  }

  removeActor(a) {
    if (a.model) this.scene.remove(a.model);
    this.actors = this.actors.filter((o) => o !== a);
  }

  applyTeamColors() {
    const c = this.colors();
    for (const a of this.actors) if (!a.isPlayer) a.setTeamColor(a.team === this.player.team ? c.ally : c.enemy);
    this.hud.applyScale();
    this.mode.refreshVisuals?.();
  }

  // ---------- entrada ----------
  bindInput() {
    const k = settings.keys;
    this.handlers = {
      keydown: (e) => {
        if (this.chatOpen) {
          if (e.code === 'Escape') { this.chatOpen = false; this.hud.closeChat(); this.lock(); }
          if (e.code === 'Enter') {
            const inp = this.hudInput;
            const text = inp.value;
            this.chatOpen = false; this.hud.closeChat();
            this.social.playerSay(this.player, text, true);
            this.lock();
          }
          return;
        }
        if (this.loadoutOpen && (e.code === 'Escape' || e.code === k.loadout)) { this.toggleLoadout(false); this.lock(); return; }
        if (!this.locked) return;
        if (e.code === 'AltLeft' && this.showScore) { e.preventDefault(); this.freeCursor = true; document.exitPointerLock(); return; }
        if (e.code === 'Tab' || e.code === 'Space' || e.code === 'KeyQ' && e.ctrlKey) e.preventDefault();
        if (this.commsOpen && /^Digit[1-8]$/.test(e.code)) {
          const q = QUICK_COMMS.find((c) => c.key === e.code.slice(5));
          this.sendComms(q.text);
          this.commsOpen = false; this.hud.showQuickComms(QUICK_COMMS, false);
          return;
        }
        if (e.repeat) return;
        this.input.keys.add(e.code);
        const now = this.now, p = this.player;
        if (e.code === k.reload) startReload(p, now, true);
        else if (e.code === k.primary) { if (switchWeapon(p, 1, now)) { audio.playEquip(); this.viewmodel.show(p.weapon.id); } }
        else if (e.code === k.secondary) { if (switchWeapon(p, 2, now)) { audio.playEquip(); this.viewmodel.show(p.weapon.id); } }
        else if (e.code === k.ability1) { if (p.alive && !this.mode.movementLocked?.(p)) useAbility(p, 'q', this, now); }
        else if (e.code === k.ability2) { if (p.alive && !this.mode.movementLocked?.(p)) useAbility(p, 'e', this, now); }
        else if (e.code === k.ping) this.ping();
        else if (e.code === k.comms) { this.commsOpen = !this.commsOpen; this.hud.showQuickComms(QUICK_COMMS, this.commsOpen); }
        else if (e.code === k.scoreboard) this.showScore = true;
        else if (e.code === k.chat) { this.chatOpen = true; this.hudInput = this.hud.openChat(); document.exitPointerLock(); }
        else if (e.code === k.loadout) { if (this.mode.canChangeLoadout(p)) { this.toggleLoadout(true); document.exitPointerLock(); } else this.hud.toast('Troca de equipamento só no spawn ou na preparação'); }
        else if (e.code === k.crouch && settings.toggleCrouch) this.crouchToggle = !this.crouchToggle;
        else if (e.code === 'KeyT' && this.opts.mode === 'training') {
          const order = ['estande', 'rastreamento', 'duelo'];
          this.mode.setDrill(order[(order.indexOf(this.mode.drill) + 1) % order.length], now);
        }
      },
      keyup: (e) => {
        this.input.keys.delete(e.code);
        if (e.code === k.scoreboard) {
          this.showScore = false;
          if (this.freeCursor) { this.freeCursor = false; this.lock(); }
        }
      },
      mousedown: (e) => {
        if (!this.locked) return;
        if (!this.player.alive && e.button === 0) this.spectateIdx = (this.spectateIdx || 0) + 1;
        if (e.button === 0) { this.input.fireHeld = true; this.input.firePressed = true; this.input.fireQueuedAt = this.now; }
        if (e.button === 2) { if (settings.toggleAim) this.adsToggle = !this.adsToggle; this.input.adsHeld = true; }
      },
      mouseup: (e) => {
        if (e.button === 0) this.input.fireHeld = false;
        if (e.button === 2) this.input.adsHeld = false;
      },
      mousemove: (e) => {
        if (!this.locked) return;
        this.input.dx += e.movementX; this.input.dy += e.movementY;
      },
      contextmenu: (e) => e.preventDefault(),
      pointerlockchange: () => {
        this.locked = document.pointerLockElement === this.canvas;
        if (!this.locked && !this.chatOpen && !this.loadoutOpen && !this.freeCursor && this.running && !this.mode.over) this.pause(true);
      },
      resize: () => this.resize(),
      blur: () => { this.input.keys.clear(); this.input.fireHeld = false; },
    };
    for (const ev of ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'contextmenu']) window.addEventListener(ev, this.handlers[ev]);
    document.addEventListener('pointerlockchange', this.handlers.pointerlockchange);
    window.addEventListener('resize', this.handlers.resize);
    window.addEventListener('blur', this.handlers.blur);
    this.canvas.addEventListener('click', () => { if (!this.locked && !this.paused) this.lock(); });
  }

  lock() {
    try { const r = this.canvas.requestPointerLock(); if (r?.catch) r.catch(() => {}); } catch { /* */ }
  }

  pause(v) {
    this.paused = v;
    this.input.fireHeld = false;
    this.onPause?.(v);
    if (!v) this.lock();
  }

  toggleLoadout(show) {
    this.loadoutOpen = show;
    this.hud.loadout(show, this, (id) => {
      const p = this.player;
      p.primaryId = id;
      p.weapons[1] = { id, mag: WEAPONS[id].mag, reserve: WEAPONS[id].reserve };
      profile.equipped.primary = id; saveProfile();
      switchWeapon(p, 2, this.now); switchWeapon(p, 1, this.now);
      this.viewmodel.show(p.weapon.id);
      audio.playEquip();
      this.toggleLoadout(false);
      this.lock();
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.viewmodel.camera.aspect = w / h;
    this.viewmodel.camera.updateProjectionMatrix();
    this.updateFov();
  }

  updateFov(zoom = 1) {
    // FOV horizontal configurado -> vertical da câmera
    const h = settings.fov * DEG;
    const v = 2 * Math.atan(Math.tan(h / 2) / this.camera.aspect);
    const vz = 2 * Math.atan(Math.tan(v / 2) * zoom);
    this.camera.fov = vz / DEG;
    this.camera.updateProjectionMatrix();
  }

  // ---------- comunicação ----------
  ping() {
    const p = this.player;
    const origin = p.eye();
    const dir = this.aimDir();
    const hit = this.world.raycast(origin, dir, 150);
    const t = hit ? hit.t : 60;
    const pos = origin.clone().addScaledVector(dir, t - 0.2);
    let label = 'Aqui', spottedEnemy = null;
    for (const o of this.actors) {
      if (!o.alive || o.team === p.team || o.dummy) continue;
      const hitE = o.hitTest(origin, dir, t);
      if (hitE) { label = 'Inimigo'; spottedEnemy = o; pos.copy(o.pos).setY(1.9); break; }
    }
    if (spottedEnemy) spottedEnemy.spottedAt = this.now + 1.5;
    this.pings.push({ pos, label, until: this.now + 6 });
    if (this.pings.length > 3) this.pings.shift();
    audio.playBeep(1.4);
    // aliados próximos respondem ao ping
    const allies = this.actors.filter((a) => a.brain && a.alive && a.team === p.team).sort((a, b) => a.pos.distanceTo(pos) - b.pos.distanceTo(pos)).slice(0, 2);
    for (const a of allies) { a.brain.investigate = { x: pos.x, z: pos.z, until: this.now + 10 }; }
    if (allies.length && Math.random() < 0.6) setTimeout(() => this.running && this.social.incoming(allies[0], label === 'Inimigo' ? 'Visto, indo!' : 'Entendido.', true, false), 500);
  }

  sendComms(text) {
    this.hud.chat(this.player, text, true, true);
    if (/A\.$/.test(text) || /B\.$/.test(text)) {
      const site = text.endsWith('A.') ? 'A' : 'B';
      if (this.mode.targetSite && this.mode.attackers === this.player.team) { this.mode.targetSite = site; this.hud.system(`Equipe redirecionada para ${site}.`); }
    }
  }

  // ---------- disparo ----------
  aimDir() {
    const p = this.player;
    const yaw = p.yaw + p.recoil.yaw * DEG, pitch = p.pitch + p.recoil.pitch * DEG;
    const cp = Math.cos(pitch);
    return new THREE.Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  }

  authorizeShot(a, now) {
    if (!a.isPlayer) return true;
    return this.integrity.validateShot(a, now);
  }

  traceShot(a, origin, dir, w) {
    const wh = this.world.raycast(origin, dir, w.range);
    let maxT = wh ? wh.t : w.range;
    let victim = null, part = null;
    for (const o of this.actors) {
      if (o === a || !o.alive) continue;
      const h = o.hitTest(origin, dir, maxT);
      if (h && h.t < maxT) { maxT = h.t; victim = o; part = h.part; }
    }
    const point = origin.clone().addScaledVector(dir, maxT);
    const res = { point, dist: maxT, victim, part, normal: null, surface: null, box: null };
    if (!victim && wh) { res.normal = new THREE.Vector3(wh.normal.x, wh.normal.y, wh.normal.z); res.surface = wh.box.surface; res.box = wh.box; }
    // passa perto do jogador: estalo da bala
    if (!a.isPlayer && this.player.alive && a.team !== this.player.team) {
      const pe = this.player.eye();
      const t = pe.clone().sub(origin).dot(dir);
      if (t > 0 && t < maxT) { const closest = origin.clone().addScaledVector(dir, t); if (closest.distanceTo(pe) < 1.5 && victim !== this.player) audio.playWhiz(closest); }
    }
    if (victim) {
      if (victim.team !== a.team || victim.dummy) {
        const dmg = w.damage * partMul(w, part) * falloffMul(w, maxT);
        this.applyDamage(a, victim, dmg, part, w.id, origin, point);
      }
    } else if (res.box?.barrier) res.box.hp -= w.damage;
    return res;
  }

  onFire(a, origin, results, w) {
    const now = this.now;
    let tip;
    if (a.isPlayer) {
      this.viewmodel.onShot();
      const t = this.viewmodel.tipWorld();
      // posição aproximada do cano no mundo
      tip = origin.clone().add(new THREE.Vector3(0.18, -0.15, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), a.yaw)).addScaledVector(this.aimDir(), 0.6);
      void t;
      this.shake = Math.min(1, this.shake + (w.scoped ? 0.5 : w.pellets > 1 ? 0.5 : 0.12));
    } else {
      tip = a.gunTip ? a.gunTip.getWorldPosition(new THREE.Vector3()) : origin;
      for (const o of this.actors) if (o.brain && o.team !== a.team && o.alive) o.brain.hear(a.pos, 'tiro', now);
      // atirar revela no minimapa inimigo por um instante
      a.spottedAt = Math.max(a.spottedAt || -9, now - 0.5);
    }
    this.effects.muzzle(tip, now);
    results.forEach((r, i) => {
      if (i % 2 === 0 || w.pellets === 1) this.effects.tracer(tip, r.point, now, a.isPlayer);
      if (r.normal) { this.effects.impact(r.point, r.normal, r.surface, now); if (i < 2) audio.playImpact(r.point, r.surface); }
      if (r.victim) this.effects.bodyHit(r.point, now);
    });
  }

  applyDamage(attacker, victim, dmg, part, weaponId, origin, point) {
    const now = this.now;
    if (!victim.alive) return;
    if (victim.spawnProtectUntil && now < victim.spawnProtectUntil && !victim.dummy) return;
    if (attacker.isPlayer && !this.integrity.validateHit(this.world, origin, point, weaponId)) return;
    // escudo absorve primeiro
    let dealt = dmg;
    if (victim.shield > 0) { const s = Math.min(victim.shield, dmg); victim.shield -= s; dmg -= s; }
    const before = victim.hp;
    victim.hp = Math.max(0, victim.hp - dmg);
    dealt = Math.min(dealt, before + (dealt - dmg));
    victim.lastHurtAt = now;
    if (!victim.firstHitAt) victim.firstHitAt = now;
    const rec = victim.damagers.get(attacker.id) || { dmg: 0, hits: 0, heads: 0, t: 0, weapon: weaponId, actor: attacker };
    rec.dmg += dealt; rec.hits++; if (part === 'head') rec.heads++; rec.t = now; rec.weapon = weaponId;
    victim.damagers.set(attacker.id, rec);
    attacker.stats.damage += dealt;
    if (attacker.isPlayer) {
      if (part === 'head') this.headHits = (this.headHits || 0) + 1;
      const kill = victim.hp <= 0;
      this.hud.hit(part === 'head', kill);
      audio.playHit(part === 'head');
      this.hud.damageNumber(this.toScreen(point), dealt, part === 'head');
    }
    if (victim.isPlayer) {
      const dx = attacker.pos.x - victim.pos.x, dz = attacker.pos.z - victim.pos.z;
      const ang = Math.atan2(dx, -dz) + victim.yaw;
      this.hud.damageFrom(ang);
      audio.playHurt();
      this.shake = Math.min(1, this.shake + 0.35);
    }
    if (victim.brain && attacker.alive) {
      victim.brain.lastKnown = attacker.pos.clone();
      victim.brain.lastKnownAt = now;
      if (!victim.brain.target) { const d = attacker.pos.clone().sub(victim.pos); victim.brain.lookYaw = Math.atan2(-d.x, -d.z); victim.yaw += (victim.brain.lookYaw - victim.yaw) * 0.3; }
    }
    if (victim.hp <= 0) this.kill(attacker, victim, part, weaponId);
  }

  kill(killer, victim, part, weaponId) {
    const now = this.now;
    victim.alive = false;
    victim.deathTime = now;
    victim.stats.deaths++;
    victim.vel.set(0, 0, 0);
    cancelReload(victim);
    const head = part === 'head';
    if (killer && killer !== victim) {
      killer.stats.kills++;
      killer.stats.score += 100;
      if (head) killer.stats.headshots++;
    }
    // assistências: dano relevante nos últimos 10 s
    for (const [id, rec] of victim.damagers) {
      if (id === killer?.id || now - rec.t > 10 || rec.dmg < 30) continue;
      rec.actor.stats.assists++; rec.actor.stats.score += 50;
      if (rec.actor.isPlayer) { this.track('assist'); this.reward(50, 'Assistência'); }
    }
    if (!victim.dummy) this.hud.killfeed(killer, victim, weaponId, head, this.player.team, this.player.id);
    this.mode.onKill(killer, victim, now);

    if (killer?.isPlayer && !victim.dummy) {
      audio.playKill();
      this.track('kill', { weapon: weaponId });
      if (head) this.track('headshot', { weapon: weaponId });
      if (now - this.multi.last < 4) { this.multi.count++; if (this.multi.count === 2) this.track('multikill'); } else this.multi.count = 1;
      this.multi.last = now;
      this.reward(100, head ? 'Abate (cabeça)' : 'Abate');
      if (this.multi.count >= 2) this.hud.toast(['', '', 'Abate duplo', 'Abate triplo', 'Quádruplo', 'ACE'][Math.min(5, this.multi.count)], 'gold');
      this.integrity.noteKill(head, this.turnRate);
      profile.weaponKills[weaponId] = (profile.weaponKills[weaponId] || 0) + 1;
    } else if (killer?.isPlayer && victim.dummy) {
      audio.playKill();
    }
    if (victim.isPlayer) this.onPlayerDeath(killer, weaponId, head);
    // comunicação dos bots: só mensagens construtivas
    if (victim.brain && victim.team === this.player.team && Math.random() < 0.25) {
      const lines = ['Ele está com pouca vida!', `Um ${WEAPONS[weaponId]?.cls?.toLowerCase() || 'inimigo'} perto de mim.`, 'Cuidado com esse ângulo.', 'Caí, foquem o objetivo.'];
      setTimeout(() => this.running && this.social.incoming(victim, lines[Math.floor(Math.random() * lines.length)], true, false), 400);
    }
    if (killer?.brain && killer.team === this.player.team && victim.isPlayer === false && Math.random() < 0.08) {
      setTimeout(() => this.running && this.social.incoming(killer, 'Um a menos.', true, false), 500);
    }
  }

  onPlayerDeath(killer, weaponId, head) {
    const p = this.player;
    const taken = [...p.damagers.values()].sort((a, b) => b.dmg - a.dmg).map((r) => ({ name: r.actor.name, weapon: WEAPONS[r.weapon]?.name || '—', dmg: r.dmg, hits: r.hits, heads: r.heads }));
    const given = killer ? (killer.damagers.get(p.id)?.dmg || 0) : 0;
    const dist = killer ? Math.round(killer.pos.distanceTo(p.pos)) : 0;
    const w = WEAPONS[weaponId];
    // dica contextual para tornar a derrota compreensível
    let tip = 'Dica: use cobertura antes de recarregar e evite atirar correndo.';
    const moving = Math.hypot(p.vel.x, p.vel.z) > PLAYER.walkSpeed + 0.5;
    if (w && w.id === 'shotgun' && dist > 10) tip = 'Escopetas perdem quase todo o dano após ~15 m. Mantenha distância delas.';
    else if (w && (w.id === 'sniper' || w.id === 'dmr') && dist > 25) tip = 'Linhas longas favorecem rifles de precisão. Use fumaça ou rotas internas para cruzar.';
    else if (w && w.id === 'smg' && dist < 12) tip = 'Submetralhadoras dominam a curta distância. Recue para média distância.';
    else if (moving) tip = 'Você estava correndo ao trocar tiros. Pare (ou ande com Shift) para recuperar a precisão.';
    else if (taken.length > 1) tip = 'Você foi atingido por mais de um inimigo. Evite ângulos onde pode ser cruzado.';
    else if (p.weapon.mag === 0 || p.reloadStarted) tip = 'Você estava recarregando. Recarregue atrás de cobertura.';
    this.deathInfo = { killer: killer?.name || '—', weapon: w?.name || '—', distance: dist, head, killerHp: killer ? Math.ceil(killer.hp) : 0, taken, given, tip, respawn: '' };
    this.hud.deathRecap(this.deathInfo);
    this.spectateIdx = 0;
  }

  onPlayerSpawn() {
    this.integrity.resetPosition(this.player);
    this.viewmodel.show(this.player.weapon.id);
    this.hud.deathRecap(null);
    this.deathInfo = null;
  }

  spotted(target, by) {
    if (by.team === this.player.team) target.spottedAt = this.now;
  }

  noise(actor, kind) {
    for (const o of this.actors) if (o.brain && o.alive && o.team !== actor.team) o.brain.hear(actor.pos, kind, this.now);
  }

  track(ev, data = {}, amount = 1) {
    const done = trackEvent(ev, data, amount);
    for (const c of done) {
      this.hud.toast(`Desafio concluído: ${c.text} (+${c.xp} XP)`, 'gold');
      audio.playAnnounce('challenge');
      this.xpLog.push({ label: `Desafio: ${c.text}`, xp: c.xp });
    }
  }

  reward(points, label) {
    this.hud.toast(`+${points}  ${label}`);
    this.xpLog.push({ label, xp: Math.round(points / 5) });
  }

  placeChargeModel(pos) {
    if (this.chargeModel) this.scene.remove(this.chargeModel);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), new THREE.MeshStandardMaterial({ color: 0x3a3d40, metalness: 0.6, roughness: 0.4 }));
    body.position.y = 0.125;
    this.chargeLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    this.chargeLight.position.set(0.15, 0.27, 0);
    const pl = new THREE.PointLight(0xff3020, 2, 5);
    pl.position.set(0, 0.5, 0);
    g.add(body, this.chargeLight, pl);
    g.position.set(pos.x, 0, pos.z);
    this.chargePL = pl;
    this.chargeModel = g;
    this.scene.add(g);
  }

  clearRoundObjects() {
    if (this.chargeModel) { this.scene.remove(this.chargeModel); this.chargeModel = null; }
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const g of this.gadgets) { this.scene.remove(g.mesh); if (g.extra) this.scene.remove(g.extra); }
    this.projectiles = []; this.gadgets = []; this.pings = [];
    for (const s of this.world.smokes) s.until = 0;
    for (const d of this.world.dynamic) d.until = 0;
    this.world.update(0, this.now + 0.001);
  }

  toScreen(pos, clampEdges = false) {
    const v = pos.clone().project(this.camera);
    const behind = v.z > 1;
    if (behind && !clampEdges) return null;
    const w = window.innerWidth, h = window.innerHeight;
    let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    if (behind) { x = w - x; y = h - 40; }
    if (clampEdges) { x = Math.max(40, Math.min(w - 40, x)); y = Math.max(60, Math.min(h - 80, y)); }
    else if (x < 0 || y < 0 || x > w || y > h) return null;
    return { x, y };
  }

  // ---------- simulação do jogador ----------
  updatePlayer(dt, now) {
    const p = this.player, k = settings.keys, keys = this.input.keys;
    const locked = this.mode.movementLocked?.(p);
    this.input.interactHeld = keys.has(k.interact) && p.alive;
    // olhar
    const zoomK = 1 + (p.wdef.adsFov - 1) * p.adsT;
    const sens = 0.0022 * settings.sensitivity * (p.adsT > 0.5 ? settings.adsSensitivity * zoomK : 1);
    const dyaw = -this.input.dx * sens;
    const dpitch = -this.input.dy * sens * (settings.invertY ? -1 : 1);
    this.turnRate = this.turnRate * 0.8 + (Math.abs(dyaw) / Math.max(dt, 0.001) / DEG) * 0.2;
    if (p.alive) {
      p.yaw += dyaw;
      p.pitch = Math.max(-89 * DEG, Math.min(89 * DEG, p.pitch + dpitch));
    }
    this.viewInput = { dx: this.input.dx, dy: this.input.dy };
    this.input.dx = 0; this.input.dy = 0;
    if (!p.alive) return;

    // agachar / mirar
    const wantCrouch = settings.toggleCrouch ? this.crouchToggle : keys.has(k.crouch);
    if (!wantCrouch && p.crouch) { if (!this.world.overlaps(p.pos.x, p.pos.y + 0.05, p.pos.z, PLAYER.radius, PLAYER.height - 0.05)) p.crouch = false; }
    else p.crouch = wantCrouch;
    p.ads = (settings.toggleAim ? this.adsToggle : this.input.adsHeld) && !p.reloadStarted && now >= p.equipUntil;
    p.adsT += ((p.ads ? 1 : 0) - p.adsT) * Math.min(1, dt / p.wdef.adsTime * 1.4);
    if (Math.abs(p.adsT - (p.ads ? 1 : 0)) < 0.01) p.adsT = p.ads ? 1 : 0;

    // movimento
    let fx = 0, fz = 0;
    if (!locked) {
      if (keys.has(k.forward)) fz -= 1;
      if (keys.has(k.back)) fz += 1;
      if (keys.has(k.left)) fx -= 1;
      if (keys.has(k.right)) fx += 1;
    }
    const len = Math.hypot(fx, fz) || 1;
    fx /= len; fz /= len;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const wx = fx * cos + fz * sin, wz = -fx * sin + fz * cos;
    const walking = keys.has(k.walk);
    let speed = p.crouch ? PLAYER.crouchSpeed : walking ? PLAYER.walkSpeed : PLAYER.runSpeed;
    speed *= p.wdef.moveMul * (p.adsT > 0.5 ? 0.75 : 1);
    if (p.planting > 0 || p.defusing > 0) speed = 0;
    const dashing = p.dashUntil && now < p.dashUntil;
    if (!dashing) {
      const tx = wx * speed, tz = wz * speed;
      const accel = p.grounded ? PLAYER.accel : PLAYER.airAccel;
      const dvx = tx - p.vel.x, dvz = tz - p.vel.z;
      const dl = Math.hypot(dvx, dvz);
      const step = Math.min(dl, accel * dt);
      if (dl > 0) { p.vel.x += dvx / dl * step; p.vel.z += dvz / dl * step; }
      if (p.grounded && !fx && !fz) { const f = Math.max(0, 1 - PLAYER.friction * dt); p.vel.x *= f; p.vel.z *= f; }
    }
    if (keys.has(k.jump) && p.grounded && !locked && !p.crouch) { p.vel.y = PLAYER.jumpVel; p.grounded = false; }
    p.vel.y -= PLAYER.gravity * dt;
    const r = this.world.move(p.pos, p.vel, dt, PLAYER.radius, p.height);
    if (!p.grounded && r.grounded && p.vel.y === 0) audio.playFootstep(null, this.world.surfaceAt(p.pos.x, p.pos.z), 0.6);
    p.grounded = r.grounded;
    if (!this.integrity.validateMovement(p, dt, now)) { /* a autoridade registra; posição real seria corrigida pelo servidor */ }

    // passos do jogador (alertam bots próximos; andar silencioso não)
    const hs = Math.hypot(p.vel.x, p.vel.z);
    if (hs > PLAYER.walkSpeed + 0.4 && p.grounded && !p.crouch) {
      p.stepAcc += hs * dt;
      if (p.stepAcc > 2.3) { p.stepAcc = 0; audio.playFootstep(null, this.world.surfaceAt(p.pos.x, p.pos.z), 0.35); this.noise(p, 'passos'); }
    }

    // atirar
    if (!locked && now >= (p.spawnProtectUntil || 0) - 2) {
      const w = p.wdef;
      const queued = this.input.firePressed || (this.input.fireQueuedAt && now - this.input.fireQueuedAt < 0.12);
      if ((w.auto && this.input.fireHeld) || (!w.auto && queued)) {
        if (fire(p, this, now)) {
          this.input.fireQueuedAt = 0;
          p.spawnProtectUntil = 0;
        }
      }
    }
    this.input.firePressed = false;
    recover(p, dt, now);
    updateReload(p, now, true);
  }

  // ---------- laço principal ----------
  loop(t) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (dt > 0.05) dt = 0.05;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.hud.fps(Math.round(this.fpsN / this.fpsAcc)); this.fpsAcc = 0; this.fpsN = 0; }
    if (!this.paused) this.step(dt);
    this.render(dt);
  }

  step(dt) {
    this.now += dt;
    const now = this.now;
    this.mode.time += dt;
    this.updatePlayer(dt, now);
    for (const a of this.actors) {
      if (a.brain) a.brain.update(this, dt, now);
      if (a.alive) updateAbilityCharges(a, now);
      a.animate(dt, now);
      if (a.flashUntil && now > a.flashUntil) a.flashAmount = 0;
    }
    updateProjectiles(this, dt, now);
    updateGadgets(this, dt, now);
    this.world.update(dt, now);
    this.effects.update(now, dt);
    this.mode.update(dt, now);
    this.pings = this.pings.filter((p) => now < p.until);
    if (this.chargeLight) { const on = Math.sin(now * 10) > 0; this.chargeLight.visible = on; this.chargePL.intensity = on ? 2 : 0; }
    if (Math.floor(now) !== Math.floor(now - dt) && Math.floor(now) % 5 === 0) this.integrity.checkData();
    this.shake = Math.max(0, this.shake - dt * 4);
    // contorno de inimigos (sempre com teste de profundidade: não atravessa paredes)
    for (const a of this.actors) if (a.outline) a.outline.visible = a.alive && settings.enemyOutline && a.team !== this.player.team;
    // tempo de renascimento na recapitulação
    if (this.deathInfo && this.mode.def.respawn) {
      const left = Math.max(0, this.mode.def.respawn - (now - this.player.deathTime));
      const el = document.querySelector('.deathrecap .respawn');
      if (el) el.textContent = `Renascendo em ${left.toFixed(1)} s`;
    } else if (this.deathInfo && this.opts.mode === 'breach') {
      const el = document.querySelector('.deathrecap .respawn');
      if (el) el.textContent = 'Observando aliados — clique para alternar';
    }
  }

  render(dt) {
    const p = this.player, now = this.now;
    let eye = p.eye();
    let yaw = p.yaw + p.recoil.yaw * DEG, pitch = p.pitch + p.recoil.pitch * DEG;
    // espectador após a morte em Ruptura
    if (!p.alive && this.opts.mode === 'breach' && now - p.deathTime > 2.5) {
      const allies = this.actors.filter((a) => a.alive && a.team === p.team);
      if (allies.length) {
        const s = allies[(this.spectateIdx || 0) % allies.length];
        eye = s.eye(); yaw = s.yaw; pitch = s.pitch;
        this.hud.hint(`Observando: ${s.name}`);
      }
    } else if (!p.alive) {
      eye.y = 0.6 + Math.max(0, 1 - (now - p.deathTime) * 2) * (p.eyeHeight - 0.6);
      this.hud.hint('');
    } else this.hud.hint(this.contextHint());
    const shakeAmt = (settings.reduceMotion ? 0.2 : 1) * settings.screenShake * this.shake * 0.012;
    this.camera.position.copy(eye);
    this.camera.rotation.set(pitch + (Math.random() - 0.5) * shakeAmt, yaw + (Math.random() - 0.5) * shakeAmt, 0, 'YXZ');
    const zoom = 1 + (p.wdef.adsFov - 1) * p.adsT;
    this.updateFov(zoom);
    audio.setListener(eye, yaw);
    this.sky.position.copy(eye);

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (p.alive) {
      this.viewmodel.update(dt, now, p, this.viewInput || { dx: 0, dy: 0 });
      this.viewmodel.render(this.renderer, settings.fov);
    }
    // HUD
    const spreadDeg = currentSpread(p);
    const spreadPx = Math.tan(spreadDeg * DEG) / Math.tan(this.camera.fov * DEG / 2) * (window.innerHeight / 2);
    this.hud.drawCrosshair(spreadPx, !p.alive || (p.wdef.scoped && p.adsT > 0.3));
    this.hud.update(this, now);
    this.drawMarkers(now);
    this.hud.scoreboard(this.showScore, this.actors, p.team, (act, id) => this.socialAction(act, id));
  }

  drawMarkers(now) {
    // marcadores de aliados e inimigos revelados (Pulso/Sensor)
    const box = document.querySelector('.hud .pings');
    if (!box) return;
    const c = this.colors();
    let html = '';
    for (const a of this.actors) {
      if (!a.alive || a === this.player || a.dummy) continue;
      const ally = a.team === this.player.team;
      const revealed = !ally && now < a.revealedUntil;
      if (!ally && !revealed) continue;
      const s = this.toScreen(new THREE.Vector3(a.pos.x, a.pos.y + a.height + 0.35, a.pos.z));
      if (!s) continue;
      const d = a.pos.distanceTo(this.player.pos);
      if (ally && d > 70) continue;
      html += ally
        ? `<div class="allytag" style="left:${s.x}px;top:${s.y}px;color:${c.ally}"><i></i>${d < 25 ? `<span>${a.name}</span>` : ''}</div>`
        : `<div class="revealtag" style="left:${s.x}px;top:${s.y}px;border-color:${c.enemy}"></div>`;
    }
    box.insertAdjacentHTML('beforeend', html);
  }

  contextHint() {
    const p = this.player, m = this.mode, key = settings.keys.interact.replace('Key', '');
    if (m.charge) {
      if (m.charge.state === 'carried' && m.charge.carrier === p && m.siteAt(p.pos)) return `Segure [${key}] para plantar`;
      if (m.charge.state === 'planted' && p.team === m.defenders && p.pos.distanceTo(m.charge.pos) < 1.6) return `Segure [${key}] para desarmar`;
      if (m.charge.carrier === p) return 'Você carrega a carga';
    }
    if (this.mode.movementLocked?.(p)) return 'Preparação: planeje a rodada · [B] equipamento · [V] comunicação';
    return '';
  }

  socialAction(act, id) {
    const a = this.actors.find((x) => x.id === id);
    if (!a) return;
    if (act === 'mute') this.social.mute(a);
    if (act === 'report') this.social.report(a, 'comportamento');
    if (act === 'commend') { this.hud.system(`Você elogiou ${a.name}.`); }
  }

  // ---------- fim ----------
  onMatchEnd(result) {
    setTimeout(() => this.finish(result, false), 3500);
  }

  finish(result, abandoned) {
    if (!this.running) return;
    const p = this.player;
    // elogios recebidos: aliados reconhecem quem jogou para a equipe
    const allyAvg = this.actors.filter((a) => a.team === p.team && !a.isPlayer).reduce((s, a, _, arr) => s + a.stats.score / arr.length, 0) || 1;
    const commends = abandoned ? 0 : Math.max(0, Math.min(3, Math.floor((p.stats.score / allyAvg - 0.8) * 2) + (p.stats.healing > 50 ? 1 : 0) + (p.stats.assists > 3 ? 1 : 0)));
    const summary = {
      mode: this.opts.mode, mapName: this.map.def.name, ranked: !!this.opts.ranked, abandoned,
      won: !abandoned && result?.winner === p.team, draw: !abandoned && result && result.winner == null,
      score: result?.score || this.mode.score, reason: abandoned ? 'Você saiu da partida' : result?.reason,
      stats: { ...p.stats }, xpLog: this.xpLog, commends,
      integrity: this.integrity.summary(),
      players: this.actors.filter((a) => !a.dummy).map((a) => ({ name: a.name, team: a.team, agent: a.agent.name, isPlayer: a.isPlayer, ...a.stats })),
      playerTeam: p.team,
    };
    this.stop();
    this.onEnd(summary);
  }

  stop() {
    this.running = false;
    audio.stopAmbience();
    for (const ev of ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'contextmenu']) window.removeEventListener(ev, this.handlers[ev]);
    document.removeEventListener('pointerlockchange', this.handlers.pointerlockchange);
    window.removeEventListener('resize', this.handlers.resize);
    window.removeEventListener('blur', this.handlers.blur);
    if (document.pointerLockElement) document.exitPointerLock();
    this.world.dispose();
    this.effects.dispose();
    this.renderer.dispose();
  }
}
