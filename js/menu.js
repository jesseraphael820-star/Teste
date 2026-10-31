// Menus: jogar, agentes, arsenal, carreira, desafios, personalização, configurações, conduta, fim de partida.
import { WEAPONS, AGENTS, MODES, BOT_SKILL, PRIMARY_IDS } from './config.js';
import { MAPS } from './maps.js';
import { settings, saveSettings, KEY_LABELS, keyName, TEAM_PALETTES, DEFAULT_SETTINGS } from './settings.js';
import { profile, saveProfile, xpForLevel, rankFor, CAMOS, CARDS, TITLES, isUnlocked, unlockHint, grantXp, applyRankedResult, refreshChallenges, trackEvent } from './progression.js';
import { initAudio, applyVolumes, playAnnounce } from './audio.js';
import { Game } from './game.js';
import { Hud } from './hud.js';

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const pct = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);

function weaponBars(w) {
  const avgRecoil = w.recoil.reduce((s, r) => s + Math.abs(r[1]) + Math.abs(r[0]), 0) / w.recoil.length;
  return [
    ['Dano', (w.damage * w.pellets) / 140],
    ['Cadência', w.rpm / 900],
    ['Alcance', w.falloff[0] / 80],
    ['Mobilidade', (w.moveMul - 0.75) / 0.25],
    ['Controle', 1 - avgRecoil / 6],
  ];
}
function shotsToKill(w, mul) {
  const per = w.damage * w.pellets * mul;
  return Math.ceil(100 / per);
}

export class Menu {
  constructor({ canvas, hudRoot, menuRoot, overlay }) {
    this.canvas = canvas; this.hudRoot = hudRoot; this.root = menuRoot; this.overlay = overlay;
    this.tab = 'jogar';
    this.sel = { mode: 'breach', map: 'random', skill: 'soldado' };
    this.game = null;
  }

  fatal(msg) { this.root.innerHTML = `<div class="fatal"><h1>Ponto Crítico</h1><p>${esc(msg)}</p></div>`; }

  show() {
    this.root.classList.remove('hidden');
    this.hudRoot.classList.add('hidden');
    if (profile.firstRun) return this.welcome();
    this.render();
  }

  welcome() {
    this.root.innerHTML = `<div class="welcome panel">
      <h1>PONTO CRÍTICO</h1><p class="tag">Tiro tático 5×5 · partidas rápidas · progressão só cosmética</p>
      <label>Seu nome de operador<input id="nm" maxlength="16" value="${esc(profile.name)}"></label>
      <p>Recomendamos começar pelo <b>Treinamento</b> para ajustar sensibilidade, mira e conhecer o recuo das armas.</p>
      <div class="row"><button class="primary" id="go-train">Ir ao Treinamento</button><button id="go-menu">Ir ao menu</button></div>
      <p class="small">Controles padrão: WASD mover · Mouse mirar/atirar · Botão direito mirar · R recarregar · Q/E habilidades · F interagir · Shift andar silencioso · Ctrl agachar · Z marcar · V comunicação rápida · Tab placar · Esc pausa</p>
    </div>`;
    const done = () => {
      const { text } = { text: this.root.querySelector('#nm').value.trim() || 'Operador' };
      profile.name = text.replace(/[<>]/g, '').slice(0, 16);
      profile.firstRun = false; saveProfile();
    };
    this.root.querySelector('#go-train').onclick = () => { done(); this.sel.mode = 'training'; this.start(); };
    this.root.querySelector('#go-menu').onclick = () => { done(); this.render(); };
  }

  render() {
    refreshChallenges();
    const rank = rankFor(profile.rating);
    const card = CARDS.find((c) => c.id === profile.equipped.card) || CARDS[0];
    const title = TITLES.find((t) => t.id === profile.equipped.title) || TITLES[0];
    const need = xpForLevel(profile.level);
    const tabs = [['jogar', 'Jogar'], ['agentes', 'Agentes'], ['arsenal', 'Arsenal'], ['carreira', 'Carreira'], ['desafios', 'Desafios'], ['visual', 'Personalizar'], ['config', 'Configurações'], ['conduta', 'Jogo limpo']];
    this.root.innerHTML = `
      <header class="topbar">
        <div class="logo">PONTO<b>CRÍTICO</b></div>
        <nav>${tabs.map(([id, n]) => `<button data-tab="${id}" class="${this.tab === id ? 'on' : ''}">${n}</button>`).join('')}</nav>
        <div class="profile" style="background:${card.bg}">
          <div><b>${esc(profile.name)}</b><small>${esc(title.name)}</small></div>
          <div class="lvl"><span>Nv ${profile.level}</span><div class="xpbar"><i style="width:${pct(profile.xp / need)}%"></i></div></div>
          <div class="rank">${profile.placements < 5 ? `Classificação ${profile.placements}/5` : esc(rank.label)}<small>${profile.placements < 5 ? '' : profile.rating + ' pts'}</small></div>
        </div>
      </header>
      <main class="content">${this['tab_' + this.tab]()}</main>`;
    this.root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.tab; this.render(); }));
    this['bind_' + this.tab]?.();
  }

  // ---------- JOGAR ----------
  tab_jogar() {
    const modes = ['training', 'tdm', 'domination', 'breach'];
    const m = MODES[this.sel.mode];
    const ranked = this.sel.mode === 'breach';
    const autoSkill = this.skillForRating();
    const ag = AGENTS.find((a) => a.id === profile.equipped.agent);
    return `<section class="play">
      <div class="modes">${modes.map((id) => {
        const d = MODES[id];
        return `<button class="mode ${this.sel.mode === id ? 'sel' : ''}" data-mode="${id}"><span class="tagm ${d.tag === 'Competitivo' ? 'comp' : d.tag === 'Prática' ? 'prac' : ''}">${d.tag}</span><h3>${d.name}</h3><p>${esc(d.desc)}</p></button>`;
      }).join('')}</div>
      <div class="setup panel">
        <h3>${esc(m.name)}</h3>
        ${this.sel.mode !== 'training' ? `<label>Mapa<select id="map"><option value="random">Aleatório</option>${MAPS.map((mp) => `<option value="${mp.id}" ${this.sel.map === mp.id ? 'selected' : ''}>${esc(mp.name)}</option>`).join('')}</select></label>
        <p class="small">${esc((MAPS.find((x) => x.id === this.sel.map) || { blurb: 'Um dos três mapas, sorteado.' }).blurb)}</p>` : '<p class="small">Campo de Provas: estande fixo, alvos móveis e duelo contra bot. Munição infinita, troca de arma livre.</p>'}
        ${ranked ? `<div class="fair"><b>Partida ranqueada</b><p>Oponentes e aliados com o mesmo nível, ajustado à sua classificação (${esc(BOT_SKILL[autoSkill].name)}). Composição espelhada: os dois lados têm os mesmos agentes e armas disponíveis. Sair antes do fim conta como derrota.</p></div>`
        : this.sel.mode !== 'training' ? `<label>Dificuldade dos bots (ambas as equipes)<select id="skill">${Object.entries(BOT_SKILL).map(([k, v]) => `<option value="${k}" ${this.sel.skill === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>` : ''}
        <label>Agente<select id="agent">${AGENTS.map((a) => `<option value="${a.id}" ${profile.equipped.agent === a.id ? 'selected' : ''}>${a.name} — ${a.role}</option>`).join('')}</select></label>
        <p class="small">${esc(ag.q.name)}: ${esc(ag.q.desc)}<br>${esc(ag.e.name)}: ${esc(ag.e.desc)}</p>
        <label>Arma principal<select id="primary">${PRIMARY_IDS.map((id) => `<option value="${id}" ${profile.equipped.primary === id ? 'selected' : ''}>${WEAPONS[id].name} (${WEAPONS[id].cls})</option>`).join('')}</select></label>
        <button class="primary big" id="start">${this.sel.mode === 'training' ? 'Entrar no Treinamento' : ranked ? 'Buscar partida ranqueada' : 'Jogar'}</button>
        <p class="small">Clique na tela do jogo para capturar o mouse. Esc pausa.</p>
      </div>
      <div class="side panel">
        <h4>Desafios de hoje</h4>
        ${profile.daily.list.map((c) => this.challengeRow(c)).join('')}
        <h4>Últimas partidas</h4>
        ${profile.history.slice(0, 5).map((h) => `<div class="hist ${h.won ? 'w' : h.draw ? 'd' : 'l'}"><b>${h.won ? 'V' : h.draw ? 'E' : 'D'}</b><span>${esc(h.mode)} · ${esc(h.map)}</span><small>${h.k}/${h.d}/${h.a}${h.delta != null ? ` · ${h.delta > 0 ? '+' : ''}${h.delta}` : ''}</small></div>`).join('') || '<p class="small">Nenhuma ainda.</p>'}
      </div>
    </section>`;
  }
  bind_jogar() {
    const r = this.root;
    r.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { this.sel.mode = b.dataset.mode; this.render(); }));
    const map = r.querySelector('#map'); if (map) map.onchange = () => { this.sel.map = map.value; this.render(); };
    const sk = r.querySelector('#skill'); if (sk) sk.onchange = () => { this.sel.skill = sk.value; };
    r.querySelector('#agent').onchange = (e) => { profile.equipped.agent = e.target.value; saveProfile(); this.render(); };
    r.querySelector('#primary').onchange = (e) => { profile.equipped.primary = e.target.value; saveProfile(); };
    r.querySelector('#start').onclick = () => this.start();
  }

  skillForRating() {
    const r = profile.rating;
    return r < 900 ? 'recruta' : r < 1150 ? 'soldado' : r < 1500 ? 'veterano' : 'elite';
  }

  challengeRow(c) {
    return `<div class="chal ${c.done ? 'done' : ''}"><span>${esc(c.text)}</span><div class="cbar"><i style="width:${pct(c.progress / c.need)}%"></i></div><small>${Math.floor(c.progress)}/${c.need} · ${c.xp} XP</small></div>`;
  }

  // ---------- AGENTES ----------
  tab_agentes() {
    return `<section class="grid4">${AGENTS.map((a) => `<div class="agentcard panel ${profile.equipped.agent === a.id ? 'sel' : ''}" style="--c:#${a.color.toString(16).padStart(6, '0')}">
      <div class="aghead"><h3>${a.name}</h3><span>${a.role}</span></div><p>${esc(a.bio)}</p>
      <div class="abil"><kbd>Q</kbd><b>${a.q.name}</b><p>${esc(a.q.desc)}</p><small>${a.q.charges} carga(s) · recarga ${a.q.cooldown} s</small></div>
      <div class="abil"><kbd>E</kbd><b>${a.e.name}</b><p>${esc(a.e.desc)}</p><small>${a.e.charges} carga(s) · recarga ${a.e.cooldown} s</small></div>
      <button data-agent="${a.id}">${profile.equipped.agent === a.id ? 'Selecionado' : 'Selecionar'}</button></div>`).join('')}
      <p class="note">Princípio de design: habilidades nunca causam dano. Elas dão informação, controlam espaço ou sustentam — a mira e a coordenação decidem os duelos.</p></section>`;
  }
  bind_agentes() { this.root.querySelectorAll('[data-agent]').forEach((b) => (b.onclick = () => { profile.equipped.agent = b.dataset.agent; saveProfile(); this.render(); })); }

  // ---------- ARSENAL ----------
  tab_arsenal() {
    return `<section class="arsenal">${[...PRIMARY_IDS, 'pistol'].map((id) => {
      const w = WEAPONS[id];
      return `<div class="wcard panel"><div class="wh"><h3>${w.name}</h3><span>${w.cls}</span></div>
        ${weaponBars(w).map(([n, v]) => `<div class="stat"><span>${n}</span><div class="sbar"><i style="width:${pct(v)}%"></i></div></div>`).join('')}
        <div class="facts"><span>Dano ${w.damage}${w.pellets > 1 ? `×${w.pellets}` : ''}</span><span>${w.rpm} disp/min</span><span>Pente ${w.mag}</span><span>Recarga ${w.reload}s</span>
        <span>Abate (corpo): ${shotsToKill(w, 1)} tiro(s)</span><span>Abate (cabeça): ${shotsToKill(w, w.headMul)} tiro(s)</span></div>
        <p class="pro">+ ${esc(w.strengths)}</p><p class="con">− ${esc(w.limits)}</p>
        <p class="small">Seus abates: ${profile.weaponKills[id] || 0}</p></div>`;
    }).join('')}<p class="note">Valores de dano são idênticos para todos os jogadores. Acabamentos são apenas visuais.</p></section>`;
  }

  // ---------- CARREIRA ----------
  tab_carreira() {
    const s = profile.stats;
    const rank = rankFor(profile.rating);
    const kd = (s.kills / Math.max(1, s.deaths)).toFixed(2);
    const acc = s.shots ? Math.round(s.hits / s.shots * 100) : 0;
    const hs = s.kills ? Math.round(s.headshots / s.kills * 100) : 0;
    const need = xpForLevel(profile.level);
    const nextUnlocks = [...CAMOS, ...CARDS, ...TITLES].filter((i) => i.level && i.level > profile.level).sort((a, b) => a.level - b.level).slice(0, 4);
    return `<section class="career">
      <div class="panel big-level"><h2>Nível ${profile.level}</h2><div class="xpbar wide"><i style="width:${pct(profile.xp / need)}%"></i></div><p>${profile.xp} / ${need} XP</p>
      <h4>Próximos desbloqueios</h4>${nextUnlocks.map((u) => `<div class="unl"><b>Nv ${u.level}</b> ${esc(u.name)}</div>`).join('') || '<p>Tudo desbloqueado!</p>'}</div>
      <div class="panel"><h2>${profile.placements < 5 ? 'Em classificação' : esc(rank.label)}</h2><p>${profile.placements < 5 ? `${5 - profile.placements} partida(s) ranqueada(s) restantes para receber sua patente.` : `${profile.rating} pontos · pico ${profile.peakRating}`}</p>
      <p class="small">A classificação muda principalmente por vitórias e derrotas; o desempenho individual ajusta no máximo ±20%, para que jogar pelo objetivo seja sempre recompensado.</p>
      <p>Ranqueadas: ${s.rankedMatches} · Vitórias: ${s.rankedWins}</p></div>
      <div class="panel statsgrid">${[['Partidas', s.matches], ['Vitórias', s.wins], ['Abates', s.kills], ['Mortes', s.deaths], ['Assistências', s.assists], ['A/M', kd], ['Precisão', acc + '%'], ['% cabeça', hs + '%'], ['Plantios', s.plants], ['Desarmes', s.defuses], ['Capturas', s.captures], ['Cura', Math.round(s.healing)], ['Elogios', s.commends]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    </section>`;
  }

  // ---------- DESAFIOS ----------
  tab_desafios() {
    const allWeekly = profile.weekly.list.every((c) => c.done);
    return `<section class="challenges"><div class="panel"><h3>Diários</h3><p class="small">Renovam todos os dias.</p>${profile.daily.list.map((c) => this.challengeRow(c)).join('')}</div>
      <div class="panel"><h3>Semanais</h3><p class="small">Complete os três para ganhar o acabamento <b>Protocolo Kessler</b> e o cartão <b>Operador da Semana</b>.</p>${profile.weekly.list.map((c) => this.challengeRow(c)).join('')}${allWeekly ? '<p class="gold">Recompensa semanal desbloqueada!</p>' : ''}</div>
      <div class="panel"><h3>Conquistas (títulos)</h3>${TITLES.filter((t) => t.achievement).map((t) => `<div class="chal ${isUnlocked(t) ? 'done' : ''}"><span>${esc(t.name)} — ${esc(t.label)}</span><div class="cbar"><i style="width:${pct((profile.stats[t.achievement] || 0) / t.need)}%"></i></div><small>${Math.floor(profile.stats[t.achievement] || 0)}/${t.need}</small></div>`).join('')}</div></section>`;
  }

  // ---------- PERSONALIZAR ----------
  tab_visual() {
    const item = (kind, it, eq, preview) => {
      const ok = isUnlocked(it, kind);
      return `<button class="cos ${eq === it.id ? 'sel' : ''} ${ok ? '' : 'locked'}" data-kind="${kind}" data-id="${it.id}" ${ok ? '' : 'disabled'}>${preview}<b>${esc(it.name)}</b><small>${ok ? (eq === it.id ? 'Equipado' : 'Equipar') : '🔒 ' + esc(unlockHint(it))}</small></button>`;
    };
    return `<section class="cosmetics">
      <p class="note">Tudo aqui é conquistado jogando e é puramente visual. Nenhum item altera dano, recuo, velocidade, som ou visibilidade — a faixa de equipe e o contorno de inimigo nunca mudam.</p>
      <div class="panel"><h3>Acabamentos de arma</h3><div class="cosgrid">${CAMOS.map((c) => item('camo', c, profile.equipped.camo, `<i class="sw" style="background:#${c.color.toString(16).padStart(6, '0')}"></i>`)).join('')}</div></div>
      <div class="panel"><h3>Cartões de jogador</h3><div class="cosgrid">${CARDS.map((c) => item('card', c, profile.equipped.card, `<i class="sw wide" style="background:${c.bg}"></i>`)).join('')}</div></div>
      <div class="panel"><h3>Títulos</h3><div class="cosgrid">${TITLES.map((t) => item('title', t, profile.equipped.title, '')).join('')}</div></div>
    </section>`;
  }
  bind_visual() {
    this.root.querySelectorAll('.cos:not(.locked)').forEach((b) => (b.onclick = () => { profile.equipped[b.dataset.kind] = b.dataset.id; saveProfile(); this.render(); }));
  }

  // ---------- CONFIGURAÇÕES ----------
  tab_config() { return `<section class="settings">${this.settingsHtml()}</section>`; }
  bind_config() { this.bindSettings(this.root, () => this.render()); }

  settingsHtml() {
    const s = settings;
    const range = (key, label, min, max, step, fmt = (v) => v) => `<label class="rng">${label}<input type="range" data-set="${key}" min="${min}" max="${max}" step="${step}" value="${key.split('.').reduce((o, k) => o[k], s)}"><output>${fmt(key.split('.').reduce((o, k) => o[k], s))}</output></label>`;
    const check = (key, label, hint = '') => `<label class="chk"><input type="checkbox" data-set="${key}" ${key.split('.').reduce((o, k) => o[k], s) ? 'checked' : ''}>${label}${hint ? `<small>${hint}</small>` : ''}</label>`;
    const select = (key, label, opts) => `<label>${label}<select data-set="${key}">${opts.map(([v, n]) => `<option value="${v}" ${key.split('.').reduce((o, k) => o[k], s) == v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`;
    return `
      <div class="panel"><h3>Controles</h3>
        ${range('sensitivity', 'Sensibilidade', 0.1, 4, 0.05)}
        ${range('adsSensitivity', 'Sensibilidade ao mirar (multiplicador)', 0.2, 2, 0.05)}
        ${check('invertY', 'Inverter eixo Y')}
        ${check('toggleAim', 'Mirar alterna (em vez de segurar)')}
        ${check('toggleCrouch', 'Agachar alterna (em vez de segurar)')}
        <h4>Teclas</h4><div class="keys">${Object.entries(KEY_LABELS).map(([k, n]) => `<div><span>${n}</span><button data-bind="${k}">${keyName(s.keys[k])}</button></div>`).join('')}</div>
        <button id="resetkeys" class="small">Restaurar teclas padrão</button>
      </div>
      <div class="panel"><h3>Mira</h3>
        <canvas id="xprev" width="160" height="160"></canvas>
        ${select('crosshair.style', 'Estilo', [['cross', 'Cruz'], ['tshape', 'T'], ['circle', 'Círculo'], ['dot', 'Ponto']])}
        <label>Cor<input type="color" data-set="crosshair.color" value="${s.crosshair.color}"></label>
        ${range('crosshair.size', 'Tamanho', 2, 20, 1)}${range('crosshair.gap', 'Espaço', 0, 16, 1)}${range('crosshair.thickness', 'Espessura', 1, 6, 1)}
        ${check('crosshair.dot', 'Ponto central')}${check('crosshair.outline', 'Contorno')}${check('crosshair.dynamic', 'Dinâmica (abre com movimento e disparos)')}
      </div>
      <div class="panel"><h3>Acessibilidade</h3>
        ${select('colorblind', 'Cores de equipe', [['none', 'Padrão (azul × vermelho)'], ['deuteranopia', 'Deuteranopia (azul × âmbar)'], ['protanopia', 'Protanopia (azul × amarelo)'], ['tritanopia', 'Tritanopia (verde-água × magenta)']])}
        <div class="swatches">${Object.entries(TEAM_PALETTES[s.colorblind]).map(([k, v]) => `<span style="background:${v}">${k === 'ally' ? 'Aliado' : 'Inimigo'}</span>`).join('')}</div>
        ${check('enemyOutline', 'Contorno de alto contraste em inimigos', 'Respeita paredes: não revela nada que você não veria.')}
        ${check('soundVisualizer', 'Indicadores visuais de som', 'Mostra direção de passos e disparos próximos.')}
        ${check('subtitles', 'Legendas de avisos de áudio')}
        ${check('damageNumbers', 'Números de dano')}
        ${check('reduceMotion', 'Reduzir movimento (balanço de câmera e arma)')}
        ${range('screenShake', 'Tremor de tela', 0, 1, 0.05)}
        ${check('flashDark', 'Clarão como véu escuro em vez de branco', 'Para fotossensibilidade. Mesma duração: não dá vantagem.')}
        ${range('hudScale', 'Escala do HUD', 0.75, 1.5, 0.05)}
      </div>
      <div class="panel"><h3>Vídeo</h3>
        ${range('fov', 'Campo de visão (horizontal)', 70, 110, 1, (v) => v + '°')}
        ${select('quality', 'Qualidade', [['baixa', 'Baixa'], ['media', 'Média'], ['alta', 'Alta']])}
        ${check('shadows', 'Sombras')}
        ${range('renderScale', 'Escala de renderização', 0.5, 1, 0.05)}
        ${check('showFps', 'Mostrar FPS')}
        <p class="small">Qualidade, sombras e escala aplicam-se na próxima partida.</p>
      </div>
      <div class="panel"><h3>Áudio</h3>
        ${range('masterVolume', 'Volume geral', 0, 1, 0.05)}${range('sfxVolume', 'Efeitos', 0, 1, 0.05)}${range('ambientVolume', 'Ambiente', 0, 1, 0.05)}
        <p class="small">Use fones: passos e tiros têm áudio 3D posicional.</p>
      </div>
      <div class="panel"><h3>Comunicação</h3>
        ${check('chatFilter', 'Filtrar linguagem ofensiva')}
        ${select('chatMode', 'Chat de texto', [['todos', 'Todos'], ['equipe', 'Só equipe'], ['desligado', 'Desligado']])}
        ${check('muteOpponents', 'Silenciar oponentes')}
      </div>
      <div class="panel"><button id="resetall">Restaurar todas as configurações</button></div>`;
  }

  bindSettings(root, rerender) {
    const setPath = (path, val) => { const ks = path.split('.'); let o = settings; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = val; };
    root.querySelectorAll('[data-set]').forEach((inp) => {
      const ev = inp.type === 'range' || inp.type === 'color' ? 'input' : 'change';
      inp.addEventListener(ev, () => {
        let v = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? parseFloat(inp.value) : inp.value;
        setPath(inp.dataset.set, v);
        if (inp.nextElementSibling?.tagName === 'OUTPUT') inp.nextElementSibling.textContent = inp.dataset.set === 'fov' ? v + '°' : v;
        saveSettings();
        applyVolumes();
        this.game?.applyTeamColors();
        this.drawPreview(root);
        if (inp.dataset.set === 'colorblind') rerender();
      });
    });
    root.querySelectorAll('[data-bind]').forEach((b) => (b.onclick = () => {
      b.textContent = 'Pressione…'; b.classList.add('wait');
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        window.removeEventListener('keydown', onKey, true);
        if (e.code !== 'Escape') {
          // evita conflitos: troca com a ação que já usava a tecla
          const prev = Object.keys(settings.keys).find((k) => settings.keys[k] === e.code);
          if (prev) settings.keys[prev] = settings.keys[b.dataset.bind];
          settings.keys[b.dataset.bind] = e.code;
          saveSettings();
        }
        rerender();
      };
      window.addEventListener('keydown', onKey, true);
    }));
    const rk = root.querySelector('#resetkeys'); if (rk) rk.onclick = () => { settings.keys = structuredClone(DEFAULT_SETTINGS.keys); saveSettings(); rerender(); };
    const ra = root.querySelector('#resetall'); if (ra) ra.onclick = () => { Object.assign(settings, structuredClone(DEFAULT_SETTINGS)); saveSettings(); applyVolumes(); rerender(); };
    this.drawPreview(root);
  }

  drawPreview(root) {
    const c = root.querySelector('#xprev');
    if (!c) return;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 160, 160); bg.addColorStop(0, '#6d7a84'); bg.addColorStop(0.5, '#c9b9a0'); bg.addColorStop(1, '#2a2e33');
    g.fillStyle = bg; g.fillRect(0, 0, 160, 160);
    // reutiliza o desenhista do HUD (sem apagar o fundo da prévia)
    Hud.prototype.drawCrosshair.call({ ctxX: proxyCtx(g) }, 0, false);
  }

  // ---------- JOGO LIMPO ----------
  tab_conduta() {
    const b = profile.behavior;
    const restricted = Date.now() < b.chatRestrictedUntil;
    return `<section class="conduct">
      <div class="panel"><h3>Sua reputação</h3><div class="rep"><b>${b.score}</b>/100</div>
        <p>${b.score >= 90 ? 'Excelente — obrigado por manter as partidas agradáveis.' : b.score >= 70 ? 'Boa. Algumas mensagens foram filtradas.' : 'Atenção: reputação baixa limita o chat de texto.'}</p>
        <p class="small">Avisos: ${b.warnings} · Abandonos: ${b.abandons} · Elogios recebidos: ${profile.stats.commends}${restricted ? ' · <b>Chat restrito no momento</b>' : ''}</p>
        <p class="small">A reputação sobe com elogios e partidas completas, e cai com linguagem ofensiva e abandonos.</p></div>
      <div class="panel"><h3>Código de conduta</h3><ul>
        <li>Jogue para vencer, junto com a equipe. Sem sabotagem ou abandono.</li>
        <li>Sem ofensas, discriminação ou assédio — o chat filtra e registra.</li>
        <li>Use a <b>comunicação rápida (V)</b> e <b>marcações (Z)</b>: são rápidas, claras e funcionam em qualquer idioma.</li>
        <li>Silencie quem incomodar e denuncie pelo placar (Tab + Alt). Elogie quem jogou bem.</li></ul></div>
      <div class="panel"><h3>Integridade competitiva</h3><ul>
        <li><b>Autoridade de servidor:</b> o cliente só pede ações; acertos são validados novamente (linha de visão, alcance, cadência) antes de aplicar dano.</li>
        <li><b>Dados protegidos:</b> estatísticas de armas e física são congeladas e verificadas por assinatura durante a partida.</li>
        <li><b>Detecção de anomalias:</b> velocidade de movimento impossível, cadência acima do limite e padrões de mira com giro instantâneo geram sinalizações para revisão.</li>
        <li><b>Sem vantagem paga ou cosmética:</b> todos têm as mesmas armas, agentes e valores. A faixa de equipe e o contorno inimigo nunca mudam com cosméticos.</li>
        <li><b>Equilíbrio:</b> equipes espelhadas em agentes e com o mesmo nível de habilidade; spawn com proteção de 2 s.</li></ul></div>
    </section>`;
  }

  // ---------- PARTIDA ----------
  start() {
    initAudio();
    const mode = this.sel.mode;
    const ranked = mode === 'breach';
    const mapId = this.sel.map === 'random' ? MAPS[Math.floor(Math.random() * MAPS.length)].id : this.sel.map;
    const skill = ranked ? this.skillForRating() : this.sel.skill;
    this.root.classList.add('hidden');
    this.hudRoot.classList.remove('hidden');
    this.game = new Game({ canvas: this.canvas, hudRoot: this.hudRoot, opts: { mode, mapId, skill, ranked }, onEnd: (s) => this.matchEnded(s) });
    this.game.onPause = (v) => this.pauseMenu(v);
    this.game.lock();
    this.lastOpts = { ...this.sel };
  }

  pauseMenu(show) {
    const o = this.overlay;
    if (!show) { o.classList.add('hidden'); o.innerHTML = ''; return; }
    const ranked = this.game?.opts.ranked;
    o.classList.remove('hidden');
    o.innerHTML = `<div class="pause panel"><h2>Pausado</h2>
      <button class="primary" id="resume">Continuar</button>
      <button id="psettings">Configurações</button>
      <button id="leave" class="danger">${ranked ? 'Abandonar partida (conta como derrota)' : 'Sair da partida'}</button>
      <div id="pset"></div></div>`;
    o.querySelector('#resume').onclick = () => { this.game.pause(false); };
    o.querySelector('#psettings').onclick = () => {
      const box = o.querySelector('#pset');
      const draw = () => { box.innerHTML = `<div class="settings inpause">${this.settingsHtml()}</div>`; this.bindSettings(box, draw); };
      draw();
    };
    o.querySelector('#leave').onclick = () => {
      if (ranked && !confirm('Sair agora conta como derrota e reduz sua reputação. Sair mesmo assim?')) return;
      const g = this.game;
      o.classList.add('hidden');
      if (g.opts.mode === 'training') { g.stop(); this.game = null; this.show(); return; }
      g.finish(null, true);
    };
  }

  matchEnded(s) {
    this.overlay.classList.add('hidden');
    this.game = null;
    this.hudRoot.classList.add('hidden');
    this.hudRoot.innerHTML = '';
    const st = profile.stats;
    const p = s.stats;
    const isTraining = s.mode === 'training';
    if (isTraining) return this.show();
    // XP: participação + objetivo + resultado. Abandono não rende XP.
    const lines = [];
    if (!s.abandoned) {
      lines.push(['Partida completa', 300]);
      if (s.won) lines.push(['Vitória', 400]);
      else if (s.draw) lines.push(['Empate', 200]);
      const perf = Math.round(p.score / 5);
      if (perf) lines.push(['Desempenho e objetivos', perf]);
      const chal = s.xpLog.filter((x) => x.label.startsWith('Desafio'));
      for (const c of chal) lines.push([c.label, c.xp]);
      if (s.commends) lines.push([`Elogios de aliados ×${s.commends}`, s.commends * 50]);
    }
    const total = lines.reduce((a, [, v]) => a + v, 0);
    const lvlBefore = profile.level;
    const unlocks = grantXp(total);
    // estatísticas de carreira
    st.matches++; if (s.won) st.wins++;
    for (const k of ['kills', 'deaths', 'assists', 'headshots', 'shots', 'hits', 'plants', 'defuses', 'captures']) st[k] += p[k] || 0;
    st.healing += p.healing || 0;
    if (!s.abandoned) { trackEvent('match'); if (s.won) trackEvent('win'); }
    if (s.commends) { st.commends += s.commends; profile.behavior.score = Math.min(100, profile.behavior.score + s.commends); }
    if (!s.abandoned) profile.behavior.score = Math.min(100, profile.behavior.score + 1);
    else { profile.behavior.abandons++; profile.behavior.score = Math.max(0, profile.behavior.score - 10); }
    let delta = null;
    if (s.ranked) {
      st.rankedMatches++; if (s.won) st.rankedWins++;
      const opp = profile.rating + Math.round((Math.random() - 0.5) * 60);
      const avg = s.players.filter((x) => !x.isPlayer).reduce((a, x, _, arr) => a + x.score / arr.length, 0) || 1;
      delta = applyRankedResult(s.won, (p.score / avg - 1) * 0.2, opp);
    }
    const modeName = MODES[s.mode].name;
    profile.history.unshift({ mode: modeName, map: s.mapName, won: s.won, draw: s.draw, k: p.kills, d: p.deaths, a: p.assists, delta, t: Date.now() });
    profile.history = profile.history.slice(0, 20);
    saveProfile();
    if (unlocks.length) playAnnounce('unlock');

    const team = s.playerTeam, other = team === 'A' ? 'B' : 'A';
    const rowsFor = (t) => s.players.filter((x) => x.team === t).sort((a, b) => b.score - a.score).map((x) => `<tr class="${x.isPlayer ? 'me' : ''}"><td>${esc(x.name)}</td><td>${esc(x.agent)}</td><td>${x.kills}</td><td>${x.deaths}</td><td>${x.assists}</td><td>${Math.round(x.damage)}</td><td>${x.score}</td></tr>`).join('');
    const mvp = s.players.slice().sort((a, b) => b.score - a.score)[0];
    const rank = rankFor(profile.rating);
    const acc = p.shots ? Math.round(p.hits / p.shots * 100) : 0;
    this.root.classList.remove('hidden');
    this.root.innerHTML = `<div class="endscreen">
      <h1 class="${s.won ? 'win' : s.draw ? 'draw' : 'loss'}">${s.abandoned ? 'PARTIDA ABANDONADA' : s.won ? 'VITÓRIA' : s.draw ? 'EMPATE' : 'DERROTA'}</h1>
      <p class="reason">${esc(modeName)} · ${esc(s.mapName)} · ${esc(s.reason || '')}</p>
      <div class="finalscore"><b class="ally">${s.score[team]}</b><span>—</span><b class="enemy">${s.score[other]}</b></div>
      <div class="endgrid">
        <div class="panel"><h3>Seu desempenho</h3><div class="statsgrid small">
          ${[['Abates', p.kills], ['Mortes', p.deaths], ['Assist.', p.assists], ['Dano', Math.round(p.damage)], ['Precisão', acc + '%'], ['Cabeça', p.headshots], ['Objetivos', (p.plants || 0) + (p.defuses || 0) + (p.captures || 0)], ['Cura', Math.round(p.healing)]].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}
        </div>${mvp?.isPlayer ? '<p class="gold">Você foi o destaque da partida!</p>' : `<p class="small">Destaque: ${esc(mvp?.name || '')}</p>`}</div>
        <div class="panel"><h3>Progressão</h3>${lines.map(([n, v]) => `<div class="xpl"><span>${esc(n)}</span><b>+${v}</b></div>`).join('') || '<p>Sem XP por abandono.</p>'}
          <div class="xpl total"><span>Total</span><b>+${total} XP</b></div>
          <p>Nível ${lvlBefore}${profile.level > lvlBefore ? ` → <b class="gold">${profile.level}</b>` : ''}</p><div class="xpbar wide"><i style="width:${pct(profile.xp / xpForLevel(profile.level))}%"></i></div>
          ${unlocks.length ? `<h4>Desbloqueado</h4>${unlocks.map((u) => `<div class="unl gold">${esc(u)}</div>`).join('')}` : ''}
          ${delta != null ? `<h4>Classificação</h4><p class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} pts · ${profile.placements <= 5 ? `Classificação ${Math.min(5, profile.placements)}/5` : esc(rank.label)}</p>` : ''}
        </div>
        <div class="panel"><h3>Desafios</h3>${[...profile.daily.list, ...profile.weekly.list].map((c) => this.challengeRow(c)).join('')}</div>
      </div>
      <div class="panel"><table class="endtable"><thead><tr><th>Jogador</th><th>Agente</th><th>A</th><th>M</th><th>As</th><th>Dano</th><th>Pts</th></tr></thead>
        <tbody class="ally">${rowsFor(team)}</tbody><tbody class="enemy">${rowsFor(other)}</tbody></table>
        ${s.integrity.flags ? `<p class="small">Integridade: ${s.integrity.flags} sinalização(ões) registradas para revisão.</p>` : '<p class="small">Integridade: nenhuma anomalia registrada.</p>'}</div>
      <div class="row center"><button class="primary big" id="again">Jogar novamente</button><button id="tomenu">Menu</button></div>
    </div>`;
    this.root.querySelector('#again').onclick = () => { this.sel = { ...this.lastOpts }; this.start(); };
    this.root.querySelector('#tomenu').onclick = () => { this.tab = 'jogar'; this.render(); };
  }
}

// contexto que desenha a mira centralizada no canvas de prévia
function proxyCtx(g) {
  return new Proxy(g, {
    get(t, k) {
      if (k === 'clearRect') return () => {};
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
