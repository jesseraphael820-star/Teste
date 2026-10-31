// HUD em DOM: informação essencial, discreta, com prioridade para o que importa agora.
import * as THREE from './vendor/three.module.min.js';
import { settings, teamColors, keyName } from './settings.js';
import { WEAPONS } from './config.js';
import { CELL } from './maps.js';
import { recentCues } from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

export class Hud {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-top">
        <div class="score left"><span class="lbl"></span><b class="val"></b></div>
        <div class="center"><div class="timer"></div><div class="sub"></div><div class="points"></div><div class="roster"></div></div>
        <div class="score right"><b class="val"></b><span class="lbl"></span></div>
        <div class="bars"><i class="a"></i><i class="b"></i></div>
      </div>
      <canvas class="minimap" width="200" height="200"></canvas>
      <div class="killfeed"></div>
      <div class="toasts"></div>
      <div class="banner"><h2></h2><p></p></div>
      <div class="objective"></div>
      <div class="interact"><span></span><div class="bar"><i></i></div></div>
      <div class="hint"></div>
      <canvas class="crosshair" width="160" height="160"></canvas>
      <div class="hitmarker"></div>
      <div class="dmgdirs"></div>
      <div class="dmgnums"></div>
      <div class="pings"></div>
      <div class="cues"></div>
      <div class="subtitles"></div>
      <div class="bottom-left">
        <div class="agent"><span class="aname"></span><span class="arole"></span></div>
        <div class="hp"><b class="hpv">100</b><div class="hpbar"><i class="hpfill"></i><i class="shfill"></i></div></div>
      </div>
      <div class="abilities"><div class="ab q"><kbd></kbd><span class="nm"></span><span class="ch"></span><i class="cd"></i></div><div class="ab e"><kbd></kbd><span class="nm"></span><span class="ch"></span><i class="cd"></i></div></div>
      <div class="bottom-right"><div class="wname"></div><div class="ammo"><b class="mag"></b><span class="res"></span></div><div class="reload"></div></div>
      <div class="chat"><div class="log"></div><input class="chatin" maxlength="140" placeholder="Mensagem para a equipe (Enter envia, Esc cancela)"></div>
      <div class="quickcomms"></div>
      <div class="scoreboard"></div>
      <div class="deathrecap"></div>
      <div class="roundresult"></div>
      <div class="scope"><div class="reticle"></div></div>
      <div class="flash"></div>
      <div class="vignette"></div>
      <div class="fps"></div>
      <div class="loadout"></div>
    `;
    this.ctxX = $('.crosshair', root).getContext('2d');
    this.mini = $('.minimap', root).getContext('2d');
    this.hitUntil = 0;
    this.applyScale();
  }

  applyScale() {
    this.root.style.setProperty('--hud-scale', settings.hudScale);
    const c = teamColors();
    this.root.style.setProperty('--ally', c.ally);
    this.root.style.setProperty('--enemy', c.enemy);
  }

  // ---------- mira ----------
  drawCrosshair(spreadPx, hidden) {
    const g = this.ctxX, cs = settings.crosshair;
    g.clearRect(0, 0, 160, 160);
    if (hidden) return;
    const cx = 80, cy = 80;
    const gap = cs.gap + (cs.dynamic ? Math.min(40, spreadPx) : 0);
    const draw = (fn) => {
      if (cs.outline) { g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = cs.thickness + 2; fn(true); }
      g.strokeStyle = cs.color; g.fillStyle = cs.color; g.lineWidth = cs.thickness; fn(false);
    };
    draw(() => {
      g.beginPath();
      if (cs.style === 'cross' || cs.style === 'tshape') {
        if (cs.style === 'cross') { g.moveTo(cx, cy - gap); g.lineTo(cx, cy - gap - cs.size); }
        g.moveTo(cx, cy + gap); g.lineTo(cx, cy + gap + cs.size);
        g.moveTo(cx - gap, cy); g.lineTo(cx - gap - cs.size, cy);
        g.moveTo(cx + gap, cy); g.lineTo(cx + gap + cs.size, cy);
      } else if (cs.style === 'circle') {
        g.arc(cx, cy, gap + cs.size / 2, 0, Math.PI * 2);
      }
      g.stroke();
    });
    if (cs.dot || cs.style === 'dot') {
      if (cs.outline) { g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(cx - cs.thickness / 2 - 1, cy - cs.thickness / 2 - 1, cs.thickness + 2, cs.thickness + 2); }
      g.fillStyle = cs.color; g.fillRect(cx - cs.thickness / 2, cy - cs.thickness / 2, cs.thickness, cs.thickness);
    }
  }

  hit(head, kill) {
    const h = $('.hitmarker', this.root);
    h.className = 'hitmarker show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    clearTimeout(this.hitT);
    this.hitT = setTimeout(() => { h.className = 'hitmarker'; }, kill ? 380 : 180);
  }

  damageNumber(screen, amount, head) {
    if (!settings.damageNumbers || !screen) return;
    const n = el('div', 'dmgnum' + (head ? ' head' : ''), Math.round(amount));
    n.style.left = screen.x + (Math.random() - 0.5) * 30 + 'px';
    n.style.top = screen.y - 20 + 'px';
    $('.dmgnums', this.root).appendChild(n);
    setTimeout(() => n.remove(), 700);
  }

  damageFrom(angle) {
    const d = el('div', 'dmgdir');
    d.style.transform = `translate(-50%,-50%) rotate(${angle}rad)`;
    $('.dmgdirs', this.root).appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  // ---------- feed / avisos ----------
  killfeed(killer, victim, weaponId, head, playerTeam, playerId) {
    const c = teamColors();
    const col = (a) => (a.team === playerTeam ? c.ally : c.enemy);
    const row = el('div', 'kf' + (killer?.id === playerId || victim.id === playerId ? ' mine' : ''));
    const wn = weaponId ? WEAPONS[weaponId].name : '—';
    row.innerHTML = `${killer ? `<span style="color:${col(killer)}">${esc(killer.name)}</span>` : ''}<em>${esc(wn)}${head ? ' ⊕' : ''}</em><span style="color:${col(victim)}">${esc(victim.name)}</span>`;
    const feed = $('.killfeed', this.root);
    feed.prepend(row);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => row.remove(), 6000);
  }

  toast(text, kind = '') {
    const t = el('div', 'toast ' + kind, esc(text));
    const box = $('.toasts', this.root);
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.remove(), 2600);
  }

  banner(title, text) {
    const b = $('.banner', this.root);
    $('h2', b).textContent = title; $('p', b).textContent = text;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), 4200);
  }

  objective(text, kind) {
    const o = $('.objective', this.root);
    o.textContent = text; o.className = 'objective show ' + kind;
    clearTimeout(this.objT);
    this.objT = setTimeout(() => { o.className = 'objective'; }, 2600);
    if (settings.subtitles) this.subtitle(text);
  }

  subtitle(text) {
    const s = $('.subtitles', this.root);
    const line = el('div', '', esc(text));
    s.appendChild(line);
    while (s.children.length > 3) s.firstChild.remove();
    setTimeout(() => line.remove(), 3000);
  }

  hint(text) { $('.hint', this.root).textContent = text || ''; }

  roundResult(won, reason, score, team) {
    const r = $('.roundresult', this.root);
    const other = team === 'A' ? 'B' : 'A';
    r.innerHTML = `<h2>${won ? 'RODADA VENCIDA' : 'RODADA PERDIDA'}</h2><p>${esc(reason)}</p><div class="rs"><b class="ally">${score[team]}</b> — <b class="enemy">${score[other]}</b></div>`;
    r.className = 'roundresult show ' + (won ? 'won' : 'lost');
    clearTimeout(this.rrT);
    this.rrT = setTimeout(() => { r.className = 'roundresult'; }, 4200);
  }

  deathRecap(info) {
    const d = $('.deathrecap', this.root);
    if (!info) { d.className = 'deathrecap'; return; }
    const rows = info.taken.map((t) => `<li><span>${esc(t.name)}</span><span>${esc(t.weapon)}</span><b>${Math.round(t.dmg)}</b><small>${t.hits} acerto(s)${t.heads ? `, ${t.heads} na cabeça` : ''}</small></li>`).join('');
    d.innerHTML = `<h3>Eliminado por <b class="enemy">${esc(info.killer)}</b></h3>
      <p>${esc(info.weapon)} · ${info.distance} m${info.head ? ' · tiro na cabeça' : ''} · vida restante do oponente: <b>${info.killerHp}</b></p>
      <ul>${rows || '<li>Sem dano registrado</li>'}</ul>
      <p class="given">Você causou <b>${Math.round(info.given)}</b> de dano a ${esc(info.killer)}.</p>
      <p class="tip">${esc(info.tip)}</p>
      <p class="respawn">${esc(info.respawn)}</p>`;
    d.className = 'deathrecap show';
  }

  // ---------- chat ----------
  chat(actor, text, teamOnly, own) {
    const log = $('.chat .log', this.root);
    if (!log) return;
    const c = teamColors();
    const line = el('div', 'line');
    line.innerHTML = `<span class="ch">[${teamOnly ? 'Equipe' : 'Todos'}]</span> <b style="color:${actor.team === this.playerTeam ? c.ally : c.enemy}">${esc(actor.name)}${own ? ' (você)' : ''}:</b> ${esc(text)}`;
    log.appendChild(line);
    while (log.children.length > 7) log.firstChild.remove();
    setTimeout(() => line.classList.add('fade'), 9000);
  }
  system(text) {
    const log = $('.chat .log', this.root);
    if (!log) return;
    const line = el('div', 'line sys', esc(text));
    log.appendChild(line);
    while (log.children.length > 7) log.firstChild.remove();
    setTimeout(() => line.classList.add('fade'), 9000);
  }
  openChat() {
    const box = $('.chat', this.root); box.classList.add('open');
    const inp = $('.chatin', this.root); inp.value = ''; inp.focus();
    return inp;
  }
  closeChat() { $('.chat', this.root).classList.remove('open'); $('.chatin', this.root).blur(); }

  showQuickComms(list, show) {
    const q = $('.quickcomms', this.root);
    q.innerHTML = list.map((c) => `<div><kbd>${c.key}</kbd>${esc(c.text)}</div>`).join('') + '<small>Pressione o número para enviar · Z marca o local mirado</small>';
    q.classList.toggle('show', show);
  }

  // ---------- quadro de pontuação ----------
  scoreboard(show, actors, playerTeam, onAction) {
    const s = $('.scoreboard', this.root);
    if (!show) { s.classList.remove('show'); return; }
    const c = teamColors();
    const team = (t) => actors.filter((a) => a.team === t && !a.dummy).sort((x, y) => y.stats.score - x.stats.score);
    const rows = (t) => team(t).map((a) => `<tr class="${a.alive ? '' : 'dead'} ${a.isPlayer ? 'me' : ''}">
      <td><i style="background:${t === playerTeam ? c.ally : c.enemy}"></i>${esc(a.name)}</td><td>${esc(a.agent.name)}</td>
      <td>${a.stats.kills}</td><td>${a.stats.deaths}</td><td>${a.stats.assists}</td><td>${a.stats.score}</td>
      <td class="act">${a.isPlayer ? '' : `<button data-act="mute" data-id="${a.id}" title="Silenciar">🔇</button><button data-act="report" data-id="${a.id}" title="Denunciar">⚑</button>${a.team === playerTeam ? `<button data-act="commend" data-id="${a.id}" title="Elogiar">👍</button>` : ''}`}</td></tr>`).join('');
    const other = playerTeam === 'A' ? 'B' : 'A';
    const html = `<table><thead><tr><th>Jogador</th><th>Agente</th><th>A</th><th>M</th><th>As</th><th>Pts</th><th></th></tr></thead>
      <tbody class="ally">${rows(playerTeam)}</tbody><tbody class="sep"><tr><td colspan="7"></td></tr></tbody><tbody class="enemy">${rows(other)}</tbody></table>
      <p class="sbhint">Segure Tab e pressione Alt para liberar o cursor e silenciar, denunciar ou elogiar.</p>`;
    // só reescreve quando muda, para os botões continuarem clicáveis
    if (html !== this.sbHtml) { s.innerHTML = html; this.sbHtml = html; }
    s.classList.add('show');
    s.onclick = (e) => { const b = e.target.closest('button'); if (b) onAction(b.dataset.act, +b.dataset.id); };
  }

  // ---------- quadro principal ----------
  update(game, now) {
    const p = game.player;
    const R = this.root;
    this.playerTeam = p.team;
    const h = game.mode.hud(now);
    const c = teamColors();
    $('.score.left .lbl', R).textContent = h.left?.label ?? '';
    $('.score.left .val', R).textContent = h.left?.value ?? '';
    $('.score.right .lbl', R).textContent = h.right?.label ?? '';
    $('.score.right .val', R).textContent = h.right?.value ?? '';
    $('.timer', R).textContent = h.center ?? '';
    $('.timer', R).classList.toggle('planted', !!h.planted);
    $('.sub', R).textContent = h.sub ?? '';
    const bars = $('.bars', R);
    bars.style.display = h.progress ? '' : 'none';
    if (h.progress) { $('.bars .a', R).style.width = Math.min(1, h.progress.a) * 50 + '%'; $('.bars .b', R).style.width = Math.min(1, h.progress.b) * 50 + '%'; }
    const pts = $('.points', R);
    if (h.points) {
      pts.innerHTML = h.points.map((q) => {
        const col = q.owner ? (q.owner === p.team ? c.ally : c.enemy) : '#bbb';
        const prog = Math.abs(q.progress);
        const pcol = q.progress === 0 ? '#bbb' : ((q.progress > 0 ? 'A' : 'B') === p.team ? c.ally : c.enemy);
        return `<span class="pt ${q.contested ? 'contested' : ''}" style="border-color:${col};color:${col};background:conic-gradient(${pcol}55 ${prog * 360}deg, transparent 0)">${q.label}</span>`;
      }).join('');
    } else pts.innerHTML = '';
    const ro = $('.roster', R);
    if (h.roster) {
      const other = p.team === 'A' ? 'B' : 'A';
      ro.innerHTML = `<span class="ally">${h.roster[p.team].map((x) => `<i class="${x ? '' : 'dead'}"></i>`).join('')}</span><span class="enemy">${h.roster[other].map((x) => `<i class="${x ? '' : 'dead'}"></i>`).join('')}</span>`;
    } else ro.innerHTML = '';
    const inter = $('.interact', R);
    if (h.interact) { inter.classList.add('show'); $('span', inter).textContent = h.interact.label; $('.bar i', inter).style.width = Math.min(1, h.interact.value) * 100 + '%'; }
    else inter.classList.remove('show');

    // vida/escudo
    $('.hpv', R).textContent = Math.ceil(p.hp);
    $('.hpfill', R).style.width = p.hp + '%';
    $('.shfill', R).style.width = Math.min(100, p.shield / 0.3) * 0.3 + '%';
    $('.hp', R).classList.toggle('low', p.hp < 35);
    $('.aname', R).textContent = p.agent.name;
    $('.arole', R).textContent = p.agent.role;
    // habilidades
    for (const k of ['q', 'e']) {
      const ab = $(`.ab.${k}`, R), s = p.abilities[k], def = p.agent[k];
      $('kbd', ab).textContent = keyName(settings.keys[k === 'q' ? 'ability1' : 'ability2']);
      $('.nm', ab).textContent = def.name;
      $('.ch', ab).textContent = '●'.repeat(s.charges) + '○'.repeat(def.charges - s.charges);
      const rem = s.rechargeAt ? Math.max(0, s.rechargeAt - now) : 0;
      $('.cd', ab).style.height = s.charges < def.charges && rem ? (rem / def.cooldown) * 100 + '%' : '0%';
      ab.classList.toggle('ready', s.charges > 0 && now >= s.cdUntil);
      ab.title = def.desc;
    }
    // arma
    const w = p.wdef;
    $('.wname', R).textContent = w.name;
    $('.mag', R).textContent = p.weapon.mag;
    $('.res', R).textContent = '/ ' + p.weapon.reserve;
    $('.mag', R).classList.toggle('low', p.weapon.mag <= Math.ceil(w.mag * 0.25));
    $('.reload', R).textContent = p.reloadStarted ? 'Recarregando…' : (p.weapon.mag === 0 && p.weapon.reserve > 0 ? `[${keyName(settings.keys.reload)}] recarregar` : '');

    // luneta e clarão
    $('.scope', R).classList.toggle('show', !!(w.scoped && p.adsT > 0.9 && p.alive));
    const fl = $('.flash', R);
    if (now < p.flashUntil) {
      const k = Math.min(1, (p.flashUntil - now) / 0.6) * (p.flashAmount || 1);
      fl.style.opacity = k;
      fl.classList.toggle('dark', settings.flashDark);
    } else fl.style.opacity = 0;
    $('.vignette', R).style.opacity = p.alive ? Math.max(0, (40 - p.hp) / 40) * 0.8 + Math.max(0, 0.5 - (now - p.lastHurtAt)) : 0;

    this.drawMinimap(game, now);
    this.drawCues(game);
    this.drawPings(game, now);
  }

  drawMinimap(game, now) {
    const g = this.mini, map = game.map, p = game.player;
    const S = 200, scale = 2.2; // px por metro
    g.save();
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(12,14,16,0.72)'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.rotate(p.yaw);
    g.translate(-p.pos.x * scale, -p.pos.z * scale);
    const cs = CELL * scale;
    for (let z = 0; z < map.h; z++) for (let x = 0; x < map.w; x++) {
      const ch = map.cells[z * map.w + x];
      if (ch === '#' || ch === 'w') g.fillStyle = 'rgba(190,195,200,0.55)';
      else if (ch === '=' || ch === 'o' || ch === 'b' || ch === 'c') g.fillStyle = 'rgba(150,150,150,0.35)';
      else if (ch === 'A' || ch === 'B') g.fillStyle = 'rgba(232,197,71,0.18)';
      else continue;
      g.fillRect(x * cs, z * cs, cs + 0.5, cs + 0.5);
    }
    const c = teamColors();
    g.fillStyle = '#e8c547'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
    for (const k of ['A', 'B']) { const s = map.sites[k]; if (s?.center) { g.save(); g.translate(s.center.x * scale, s.center.z * scale); g.rotate(-p.yaw); g.fillText(k, 0, 5); g.restore(); } }
    if (game.mode.points) for (const q of game.mode.points) {
      g.strokeStyle = q.owner ? (q.owner === p.team ? c.ally : c.enemy) : '#ddd'; g.lineWidth = 2;
      g.beginPath(); g.arc(q.center.x * scale, q.center.z * scale, q.radius * scale, 0, Math.PI * 2); g.stroke();
    }
    if (game.mode.charge && (game.mode.charge.state !== 'carried' || game.mode.charge.carrier?.team === p.team)) {
      const ch = game.mode.charge;
      g.fillStyle = '#ff9a3c'; g.fillRect(ch.pos.x * scale - 3, ch.pos.z * scale - 3, 6, 6);
    }
    for (const a of game.actors) {
      if (!a.alive || a === p || a.dummy) continue;
      const ally = a.team === p.team;
      const seen = ally || now < a.revealedUntil || now - (a.spottedAt || -9) < 1.5;
      if (!seen) continue;
      g.fillStyle = ally ? c.ally : c.enemy;
      g.save(); g.translate(a.pos.x * scale, a.pos.z * scale); g.rotate(-a.yaw);
      g.beginPath(); g.moveTo(0, -5); g.lineTo(4, 4); g.lineTo(-4, 4); g.closePath(); g.fill();
      g.restore();
    }
    for (const pg of game.pings) { g.fillStyle = '#ffd166'; g.beginPath(); g.arc(pg.pos.x * scale, pg.pos.z * scale, 4, 0, 7); g.fill(); }
    g.restore();
    // jogador no centro
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(S / 2, S / 2 - 7); g.lineTo(S / 2 + 5, S / 2 + 5); g.lineTo(S / 2 - 5, S / 2 + 5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.strokeRect(0.5, 0.5, S - 1, S - 1);
  }

  drawCues(game) {
    const box = $('.cues', this.root);
    if (!settings.soundVisualizer) { box.innerHTML = ''; return; }
    const p = game.player;
    const now = performance.now();
    const c = teamColors();
    let html = '';
    for (const q of recentCues()) {
      const dx = q.x - p.pos.x, dz = q.z - p.pos.z;
      const dist = Math.hypot(dx, dz);
      if (!q.enemy || dist < 2 || dist > 40) continue;
      const ang = Math.atan2(dx, -dz) + p.yaw;
      const k = 1 - (now - q.t) / 1400;
      const col = q.enemy ? c.enemy : c.ally;
      html += `<div class="cue ${q.kind}" style="transform:translate(-50%,-50%) rotate(${ang}rad);opacity:${k}"><i style="background:${col}"></i><span style="transform:rotate(${-ang}rad)">${q.kind === 'passos' ? '👣' : q.kind === 'tiro' ? '✸' : '◎'}</span></div>`;
    }
    box.innerHTML = html;
  }

  drawPings(game, now) {
    const box = $('.pings', this.root);
    let html = '';
    for (const pg of game.pings) {
      const s = game.toScreen(pg.pos);
      if (!s) continue;
      const d = Math.round(game.player.pos.distanceTo(pg.pos));
      html += `<div class="ping" style="left:${s.x}px;top:${s.y}px"><i></i><span>${esc(pg.label)} · ${d} m</span></div>`;
    }
    // indicador do objetivo (carga plantada/solta, pontos)
    const m = game.mode;
    const objs = [];
    if (m.charge && (m.charge.state === 'planted' || m.charge.state === 'dropped')) objs.push({ pos: m.charge.pos.clone().setY(0.6), label: m.charge.state === 'planted' ? 'CARGA' : 'Carga solta' });
    if (m.points) for (const q of m.points) objs.push({ pos: new THREE.Vector3(q.center.x, 3.4, q.center.z), label: q.label[0], owner: q.owner });
    for (const o of objs) {
      const s = game.toScreen(o.pos, true);
      if (!s) continue;
      const d = Math.round(game.player.pos.distanceTo(o.pos));
      const c = teamColors();
      const col = o.owner ? (o.owner === game.player.team ? c.ally : c.enemy) : '#e8c547';
      html += `<div class="objmark" style="left:${s.x}px;top:${s.y}px;color:${col}"><b>${esc(o.label)}</b><small>${d} m</small></div>`;
    }
    box.innerHTML = html;
  }

  fps(v) { const f = $('.fps', this.root); f.style.display = settings.showFps ? '' : 'none'; f.textContent = `${v} FPS`; }

  loadout(show, game, onPick) {
    const box = $('.loadout', this.root);
    if (!show) { box.classList.remove('show'); return; }
    const cur = game.player.primaryId;
    box.innerHTML = `<h3>Equipamento</h3><p>Escolha a arma principal. Todas estão sempre disponíveis — escolha por estilo e situação.</p><div class="wgrid">${['rifle', 'smg', 'dmr', 'shotgun', 'sniper'].map((id) => {
      const w = WEAPONS[id];
      return `<button data-w="${id}" class="${id === cur ? 'sel' : ''}"><b>${esc(w.name)}</b><small>${esc(w.cls)}</small><span class="pro">+ ${esc(w.strengths)}</span><span class="con">− ${esc(w.limits)}</span></button>`;
    }).join('')}</div><p class="note">[B] ou Esc para fechar</p>`;
    box.classList.add('show');
    box.onclick = (e) => { const b = e.target.closest('button'); if (b) onPick(b.dataset.w); };
  }
}
