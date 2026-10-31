// Progressão: só cosméticos. Nada aqui altera dano, vida, recuo ou velocidade.
import { load, save } from './storage.js';
import { RANKS } from './config.js';

export const CAMOS = [
  { id: 'padrao', name: 'Fosfato', level: 1, color: 0x3d4045, metal: 0.55, rough: 0.5 },
  { id: 'areia', name: 'Areia do Pátio', level: 3, color: 0x9b8462, metal: 0.2, rough: 0.8 },
  { id: 'oliva', name: 'Oliva de Galpão', level: 5, color: 0x4f5638, metal: 0.25, rough: 0.75 },
  { id: 'grafite', name: 'Grafite', level: 8, color: 0x3c4248, metal: 0.7, rough: 0.35 },
  { id: 'artico', name: 'Ártico', level: 12, color: 0xc9d1d6, metal: 0.3, rough: 0.6 },
  { id: 'cobre', name: 'Cobre Oxidado', level: 16, color: 0x7a4a2e, metal: 0.85, rough: 0.4 },
  { id: 'ferrugem', name: 'Ferrugem de Usina', level: 20, color: 0x6b3a22, metal: 0.4, rough: 0.9 },
  { id: 'carbono', name: 'Carbono', level: 25, color: 0x141517, metal: 0.4, rough: 0.25 },
  { id: 'cobalto', name: 'Cobalto', level: 30, color: 0x1f3f8a, metal: 0.9, rough: 0.2 },
  { id: 'aurora', name: 'Aurora', level: 40, color: 0x2fa58a, metal: 0.95, rough: 0.15, emissive: 0x0b3a30 },
  { id: 'ouro', name: 'Ouro Velho', level: 50, color: 0xb08a3a, metal: 1.0, rough: 0.25 },
  { id: 'kessler', name: 'Protocolo Kessler', challenge: 'weekly', color: 0x9f2b2b, metal: 0.6, rough: 0.3, emissive: 0x220404 },
];

export const CARDS = [
  { id: 'cinza', name: 'Concreto', level: 1, bg: 'linear-gradient(135deg,#3a3d42,#1f2124)' },
  { id: 'rio', name: 'Rio de Ferro', level: 4, bg: 'linear-gradient(135deg,#25445c,#0f1b24)' },
  { id: 'poente', name: 'Poente Industrial', level: 7, bg: 'linear-gradient(135deg,#a8572b,#2a1810)' },
  { id: 'vila', name: 'Telhados da Vila', level: 11, bg: 'linear-gradient(135deg,#7b4a3a,#2b2f3a)' },
  { id: 'neblina', name: 'Neblina', level: 15, bg: 'linear-gradient(135deg,#9aa6ad,#40484e)' },
  { id: 'laboratorio', name: 'Laboratório 7', level: 22, bg: 'linear-gradient(135deg,#2c6e63,#0e1e1c)' },
  { id: 'noturno', name: 'Turno da Noite', level: 28, bg: 'linear-gradient(135deg,#1a1f3d,#05060d)' },
  { id: 'brasa', name: 'Brasa Viva', level: 35, bg: 'linear-gradient(135deg,#ff7a2f,#5a0f0f)' },
  { id: 'lenda', name: 'Lenda do Setor', level: 45, bg: 'linear-gradient(135deg,#e6c36a,#4a3510)' },
  { id: 'semanal', name: 'Operador da Semana', challenge: 'weekly', bg: 'repeating-linear-gradient(45deg,#2b2f36 0 12px,#1d2025 12px 24px)' },
];

export const TITLES = [
  { id: 'novato', name: 'Recém-chegado', level: 1 },
  { id: 'atirador', name: 'Atirador', level: 6 },
  { id: 'estrategista', name: 'Estrategista', level: 14 },
  { id: 'veterano', name: 'Veterano de Kessler', level: 24 },
  { id: 'lenda', name: 'Lenda', level: 50 },
  { id: 'sapador', name: 'Sapador', achievement: 'plants', need: 10, label: 'Plante a carga 10 vezes' },
  { id: 'guardiao', name: 'Guardião', achievement: 'defuses', need: 5, label: 'Desarme a carga 5 vezes' },
  { id: 'cirurgiao', name: 'Cirurgião', achievement: 'headshots', need: 100, label: '100 abates na cabeça' },
  { id: 'anjo', name: 'Anjo da Guarda', achievement: 'healing', need: 1000, label: 'Cure 1000 de vida' },
  { id: 'cortes', name: 'Cortês', achievement: 'commends', need: 10, label: 'Receba 10 elogios' },
];

const CHALLENGE_POOL = [
  { id: 'k_any', text: 'Elimine {n} inimigos', ev: 'kill', n: [15, 25], xp: 600 },
  { id: 'k_hs', text: 'Elimine {n} inimigos com tiro na cabeça', ev: 'headshot', n: [5, 10], xp: 700 },
  { id: 'k_rifle', text: '{n} abates com a AR-4 Ferrão', ev: 'kill', filter: { weapon: 'rifle' }, n: [8, 15], xp: 600 },
  { id: 'k_smg', text: '{n} abates com a K7 Vespa', ev: 'kill', filter: { weapon: 'smg' }, n: [8, 15], xp: 600 },
  { id: 'k_dmr', text: '{n} abates com a M-14 Lança', ev: 'kill', filter: { weapon: 'dmr' }, n: [6, 12], xp: 650 },
  { id: 'k_sg', text: '{n} abates com a SG-8 Martelo', ev: 'kill', filter: { weapon: 'shotgun' }, n: [5, 10], xp: 650 },
  { id: 'k_sn', text: '{n} abates com a Atalaia .338', ev: 'kill', filter: { weapon: 'sniper' }, n: [4, 8], xp: 700 },
  { id: 'k_pis', text: '{n} abates com a pistola', ev: 'kill', filter: { weapon: 'pistol' }, n: [4, 8], xp: 650 },
  { id: 'assist', text: 'Dê {n} assistências', ev: 'assist', n: [5, 10], xp: 500 },
  { id: 'abil', text: 'Use habilidades {n} vezes', ev: 'ability', n: [10, 20], xp: 400 },
  { id: 'heal', text: 'Cure {n} de vida de aliados', ev: 'heal', n: [150, 300], xp: 500 },
  { id: 'cap', text: 'Capture {n} pontos no Domínio', ev: 'capture', n: [3, 6], xp: 600 },
  { id: 'plant', text: 'Plante a carga {n} vezes', ev: 'plant', n: [2, 4], xp: 650 },
  { id: 'defuse', text: 'Desarme a carga {n} vez(es)', ev: 'defuse', n: [1, 2], xp: 700 },
  { id: 'win', text: 'Vença {n} partida(s)', ev: 'win', n: [1, 3], xp: 800 },
  { id: 'play', text: 'Complete {n} partidas', ev: 'match', n: [2, 4], xp: 500 },
  { id: 'multi', text: 'Faça {n} abates duplos', ev: 'multikill', n: [2, 4], xp: 700 },
  { id: 'reveal', text: 'Revele {n} inimigos para a equipe', ev: 'reveal', n: [8, 15], xp: 450 },
];

const DEFAULT_PROFILE = {
  name: 'Operador',
  level: 1, xp: 0, totalXp: 0,
  rating: 1000, placements: 0, peakRating: 1000,
  equipped: { camo: 'padrao', card: 'cinza', title: 'novato', agent: 'brasa', primary: 'rifle' },
  unlockedChallenge: [],
  stats: { matches: 0, wins: 0, kills: 0, deaths: 0, assists: 0, headshots: 0, shots: 0, hits: 0, plants: 0, defuses: 0, healing: 0, captures: 0, commends: 0, rankedMatches: 0, rankedWins: 0 },
  weaponKills: {},
  daily: { key: '', list: [] },
  weekly: { key: '', list: [] },
  behavior: { score: 100, warnings: 0, chatRestrictedUntil: 0, abandons: 0 },
  history: [],
  firstRun: true,
};

export const profile = load('profile', DEFAULT_PROFILE);
export function saveProfile() { save('profile', profile); }

export function xpForLevel(level) { return Math.round(1000 + (level - 1) * 120); }

export function rankFor(rating) {
  let r = RANKS[0];
  for (const k of RANKS) if (rating >= k.min) r = k;
  const div = Math.min(3, Math.floor((rating - r.min) / 67) + 1);
  return { ...r, label: r.name === 'Mestre' ? 'Mestre' : `${r.name} ${'I'.repeat(div)}` };
}

export function isUnlocked(item, kind) {
  if (item.level) return profile.level >= item.level;
  if (item.challenge) return profile.unlockedChallenge.includes(`${kind}:${item.id}`);
  if (item.achievement) return (profile.stats[item.achievement] || 0) >= item.need;
  return false;
}

export function unlockHint(item) {
  if (item.level) return `Nível ${item.level}`;
  if (item.challenge === 'weekly') return 'Complete todos os desafios semanais';
  if (item.achievement) return item.label;
  return '';
}

function seeded(seed) {
  let s = 0;
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function makeList(key, count, scale) {
  const rnd = seeded(key);
  const pool = [...CHALLENGE_POOL];
  const out = [];
  while (out.length < count && pool.length) {
    const c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const n = Math.round((c.n[0] + rnd() * (c.n[1] - c.n[0])) * scale);
    out.push({ id: c.id, text: c.text.replace('{n}', n), ev: c.ev, filter: c.filter || null, need: n, progress: 0, xp: Math.round(c.xp * scale), done: false });
  }
  return out;
}

export function refreshChallenges() {
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  const weekKey = `${now.getFullYear()}-S${week}`;
  if (profile.daily.key !== dayKey) profile.daily = { key: dayKey, list: makeList(dayKey, 3, 1) };
  if (profile.weekly.key !== weekKey) profile.weekly = { key: weekKey, list: makeList(weekKey + 'w', 3, 3), rewarded: false };
  saveProfile();
}

// Registra um evento de jogo; retorna desafios concluídos agora.
export function trackEvent(ev, data = {}, amount = 1) {
  const completed = [];
  for (const list of [profile.daily.list, profile.weekly.list]) {
    for (const c of list) {
      if (c.done || c.ev !== ev) continue;
      if (c.filter && Object.entries(c.filter).some(([k, v]) => data[k] !== v)) continue;
      c.progress = Math.min(c.need, c.progress + amount);
      if (c.progress >= c.need) { c.done = true; completed.push(c); }
    }
  }
  if (!profile.weekly.rewarded && profile.weekly.list.length && profile.weekly.list.every((c) => c.done)) {
    profile.weekly.rewarded = true;
    for (const id of ['camo:kessler', 'card:semanal']) if (!profile.unlockedChallenge.includes(id)) profile.unlockedChallenge.push(id);
  }
  return completed;
}

// Concede XP e devolve lista de novos desbloqueios.
export function grantXp(amount) {
  const unlocks = [];
  profile.xp += amount;
  profile.totalXp += amount;
  while (profile.xp >= xpForLevel(profile.level)) {
    profile.xp -= xpForLevel(profile.level);
    profile.level++;
    for (const c of CAMOS) if (c.level === profile.level) unlocks.push(`Acabamento: ${c.name}`);
    for (const c of CARDS) if (c.level === profile.level) unlocks.push(`Cartão: ${c.name}`);
    for (const t of TITLES) if (t.level === profile.level) unlocks.push(`Título: ${t.name}`);
  }
  return unlocks;
}

// Classificação com Elo simplificado. O desempenho individual ajusta pouco (±20%)
// para não incentivar jogo egoísta em vez do objetivo.
export function applyRankedResult(won, perf, opponentRating) {
  const k = profile.placements < 5 ? 60 : 28;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - profile.rating) / 400));
  let delta = k * ((won ? 1 : 0) - expected);
  delta *= 1 + Math.max(-0.2, Math.min(0.2, perf));
  if (!won) delta = Math.min(delta, -6);
  if (won) delta = Math.max(delta, 6);
  delta = Math.round(delta);
  profile.rating = Math.max(0, profile.rating + delta);
  profile.peakRating = Math.max(profile.peakRating, profile.rating);
  profile.placements++;
  return delta;
}
