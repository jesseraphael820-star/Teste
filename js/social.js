// Comunicação saudável: filtro de chat, comunicação rápida, silenciar, denunciar, elogiar.
import { profile, saveProfile } from './progression.js';
import { settings } from './settings.js';

// Lista curta e expansível; correspondência por raiz, ignorando acentos e leetspeak.
const BLOCKED = [
  'idiota', 'imbecil', 'otario', 'burro', 'lixo', 'merda', 'porra', 'caralho', 'puta', 'fdp', 'vtnc', 'vsf', 'arrombado', 'desgraca', 'retardado', 'lixao', 'noob lixo',
  'viado', 'macaco', 'cuzao', 'babaca', 'trouxa', 'inutil', 'se mata', 'kys', 'uninstall', 'trash', 'idiot', 'stupid', 'fuck', 'shit', 'bitch', 'retard',
];

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[4@]/g, 'a').replace(/3/g, 'e').replace(/[1!]/g, 'i').replace(/0/g, 'o').replace(/[5$]/g, 's').replace(/7/g, 't');
}

export function filterMessage(text) {
  let out = text;
  let hits = 0;
  const norm = normalize(text);
  for (const w of BLOCKED) {
    let idx = norm.indexOf(w);
    while (idx !== -1) {
      hits++;
      out = out.slice(0, idx) + '*'.repeat(w.length) + out.slice(idx + w.length);
      idx = norm.indexOf(w, idx + w.length);
    }
  }
  return { text: out, hits };
}

export const QUICK_COMMS = [
  { key: '1', text: 'Inimigo avistado aqui!' },
  { key: '2', text: 'Preciso de ajuda!' },
  { key: '3', text: 'Vamos para o A.' },
  { key: '4', text: 'Vamos para o B.' },
  { key: '5', text: 'Recuando / segurando posição.' },
  { key: '6', text: 'Usando habilidade — aguardem.' },
  { key: '7', text: 'Boa jogada!' },
  { key: '8', text: 'Obrigado!' },
];

export class Social {
  constructor(hud) {
    this.hud = hud;
    this.muted = new Set();
    this.reports = [];
  }

  canChat() {
    return Date.now() > profile.behavior.chatRestrictedUntil;
  }

  // Envio do próprio jogador. Linguagem ofensiva é mascarada e conta para a reputação.
  playerSay(actor, raw, teamOnly) {
    if (!raw.trim()) return null;
    if (!this.canChat()) {
      const mins = Math.ceil((profile.behavior.chatRestrictedUntil - Date.now()) / 60000);
      this.hud.system(`Chat restrito por comportamento por mais ${mins} min. Comunicação rápida (Z) continua disponível.`);
      return null;
    }
    const { text, hits } = filterMessage(raw.slice(0, 140));
    if (hits) {
      profile.behavior.warnings++;
      profile.behavior.score = Math.max(0, profile.behavior.score - 4 * hits);
      if (profile.behavior.warnings >= 3 && profile.behavior.score < 80) {
        profile.behavior.chatRestrictedUntil = Date.now() + 15 * 60000;
        this.hud.system('Linguagem ofensiva repetida: chat de texto restrito por 15 minutos.');
      } else this.hud.system('Lembrete: mensagens ofensivas são filtradas e afetam sua reputação.');
      saveProfile();
    }
    this.hud.chat(actor, settings.chatFilter ? text : raw, teamOnly, true);
    return text;
  }

  incoming(actor, text, teamOnly, isEnemy) {
    if (settings.chatMode === 'desligado') return;
    if (settings.chatMode === 'equipe' && !teamOnly) return;
    if (this.muted.has(actor.id)) return;
    if (isEnemy && settings.muteOpponents) return;
    const shown = settings.chatFilter ? filterMessage(text).text : text;
    this.hud.chat(actor, shown, teamOnly, false);
  }

  mute(actor) { this.muted.add(actor.id); this.hud.system(`${actor.name} foi silenciado(a).`); }

  report(actor, reason) {
    this.reports.push({ name: actor.name, reason, t: Date.now() });
    this.hud.system(`Denúncia registrada (${reason}). Obrigado por ajudar a manter as partidas justas.`);
  }

  commendReceived(n) {
    profile.stats.commends += n;
    profile.behavior.score = Math.min(100, profile.behavior.score + n);
    saveProfile();
  }
}
