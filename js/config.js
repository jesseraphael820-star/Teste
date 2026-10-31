// Dados de jogo. Tudo é congelado (deepFreeze) — o módulo de integridade
// verifica uma assinatura destes valores durante a partida.

export const PLAYER = {
  hp: 100,
  radius: 0.34,
  height: 1.8,
  crouchHeight: 1.25,
  eye: 1.66,
  crouchEye: 1.12,
  runSpeed: 5.4,
  walkSpeed: 2.7,      // andar silencioso (Shift)
  crouchSpeed: 2.1,
  accel: 60,
  airAccel: 12,
  friction: 10,
  jumpVel: 5.6,
  gravity: 18,
};

// recoil: lista de [yaw, pitch] em graus por disparo consecutivo (padrão aprendível).
// spread em graus. falloff: [distância início, distância fim, multiplicador mínimo]
export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P-9 Vigia', cls: 'Pistola', slot: 2,
    damage: 28, headMul: 3.6, legMul: 0.8, rpm: 380, auto: false, pellets: 1,
    mag: 12, reserve: 48, reload: 1.4, equip: 0.35,
    spread: 0.35, moveSpread: 1.6, airSpread: 5, crouchMul: 0.8, adsMul: 0.6, spreadPerShot: 0.45, spreadRecover: 4,
    falloff: [20, 45, 0.7], range: 120, moveMul: 1.0, adsFov: 0.85, adsTime: 0.12,
    recoil: [[0, 1.2], [0.2, 1.3], [-0.3, 1.4], [0.4, 1.4], [-0.4, 1.4]], recoilRecover: 9,
    strengths: 'Precisa no primeiro disparo, troca rápida, sempre disponível.',
    limits: 'Dano baixo no corpo, pente pequeno.',
    sound: { pitch: 1.25, body: 0.6, crack: 0.8, tail: 0.25 },
    model: { length: 0.22, barrel: 0.08, mag: 0.10, stock: 0, scope: 0, bulk: 0.8 },
  },
  smg: {
    id: 'smg', name: 'K7 Vespa', cls: 'Submetralhadora', slot: 1,
    damage: 22, headMul: 2.6, legMul: 0.8, rpm: 880, auto: true, pellets: 1,
    mag: 30, reserve: 120, reload: 2.0, equip: 0.45,
    spread: 0.9, moveSpread: 0.9, airSpread: 4, crouchMul: 0.85, adsMul: 0.7, spreadPerShot: 0.18, spreadRecover: 6,
    falloff: [12, 30, 0.55], range: 90, moveMul: 0.98, adsFov: 0.85, adsTime: 0.14,
    recoil: [[0, 0.7], [0.1, 0.7], [-0.1, 0.8], [0.2, 0.8], [0.3, 0.8], [-0.2, 0.7], [-0.4, 0.6], [-0.3, 0.6], [0.2, 0.5], [0.4, 0.5], [0.3, 0.5], [-0.3, 0.5]],
    recoilRecover: 8,
    strengths: 'Ótima em movimento e a curta distância.',
    limits: 'Perde muito dano à distância.',
    sound: { pitch: 1.4, body: 0.55, crack: 0.7, tail: 0.3 },
    model: { length: 0.38, barrel: 0.10, mag: 0.18, stock: 0.12, scope: 0, bulk: 0.9 },
  },
  rifle: {
    id: 'rifle', name: 'AR-4 Ferrão', cls: 'Fuzil', slot: 1,
    damage: 34, headMul: 4.0, legMul: 0.85, rpm: 620, auto: true, pellets: 1,
    mag: 30, reserve: 90, reload: 2.4, equip: 0.6,
    spread: 0.12, moveSpread: 3.2, airSpread: 8, crouchMul: 0.75, adsMul: 0.5, spreadPerShot: 0.25, spreadRecover: 5,
    falloff: [35, 70, 0.85], range: 160, moveMul: 0.92, adsFov: 0.75, adsTime: 0.2,
    recoil: [[0, 1.0], [0.05, 1.2], [0.1, 1.4], [0, 1.5], [-0.15, 1.4], [-0.3, 1.1], [-0.5, 0.8], [-0.6, 0.6], [-0.3, 0.4], [0.3, 0.4], [0.6, 0.3], [0.7, 0.3], [0.5, 0.3], [-0.2, 0.3], [-0.6, 0.3]],
    recoilRecover: 7,
    strengths: 'Versátil, abate com um tiro na cabeça.',
    limits: 'Recuo forte em rajadas longas, impreciso correndo.',
    sound: { pitch: 1.0, body: 0.9, crack: 1.0, tail: 0.5 },
    model: { length: 0.55, barrel: 0.18, mag: 0.16, stock: 0.18, scope: 0.06, bulk: 1 },
  },
  dmr: {
    id: 'dmr', name: 'M-14 Lança', cls: 'Rifle de precisão semi', slot: 1,
    damage: 58, headMul: 2.5, legMul: 0.85, rpm: 230, auto: false, pellets: 1,
    mag: 12, reserve: 48, reload: 2.6, equip: 0.7,
    spread: 0.05, moveSpread: 3.8, airSpread: 9, crouchMul: 0.7, adsMul: 0.3, spreadPerShot: 0.7, spreadRecover: 3.5,
    falloff: [60, 120, 0.9], range: 220, moveMul: 0.9, adsFov: 0.55, adsTime: 0.25,
    recoil: [[0, 2.2], [0.3, 2.2], [-0.3, 2.2]], recoilRecover: 6,
    strengths: 'Dois tiros no corpo, controla longas linhas de visão.',
    limits: 'Cadência baixa, punida a curta distância.',
    sound: { pitch: 0.85, body: 1.0, crack: 1.2, tail: 0.7 },
    model: { length: 0.66, barrel: 0.22, mag: 0.12, stock: 0.2, scope: 0.12, bulk: 1.05 },
  },
  shotgun: {
    id: 'shotgun', name: 'SG-8 Martelo', cls: 'Escopeta', slot: 1,
    damage: 15, headMul: 1.6, legMul: 0.9, rpm: 75, auto: false, pellets: 9,
    mag: 7, reserve: 28, reload: 3.0, equip: 0.6,
    spread: 4.2, moveSpread: 0.6, airSpread: 1.5, crouchMul: 0.95, adsMul: 0.85, spreadPerShot: 0, spreadRecover: 5,
    falloff: [7, 18, 0.25], range: 40, moveMul: 0.95, adsFov: 0.9, adsTime: 0.15,
    recoil: [[0, 5]], recoilRecover: 6,
    strengths: 'Letal em portas e corredores.',
    limits: 'Inútil a média distância, recarga lenta.',
    sound: { pitch: 0.7, body: 1.3, crack: 0.8, tail: 0.6 },
    model: { length: 0.6, barrel: 0.2, mag: 0.0, stock: 0.18, scope: 0, bulk: 1.15 },
  },
  sniper: {
    id: 'sniper', name: 'Atalaia .338', cls: 'Fuzil de precisão', slot: 1,
    damage: 135, headMul: 2.0, legMul: 0.7, rpm: 42, auto: false, pellets: 1,
    mag: 5, reserve: 20, reload: 3.4, equip: 0.9,
    spread: 6, moveSpread: 6, airSpread: 12, crouchMul: 1, adsMul: 0.0, spreadPerShot: 0, spreadRecover: 4,
    adsSpread: 0.02, adsMoveSpread: 2.5,
    falloff: [200, 300, 1], range: 300, moveMul: 0.82, adsFov: 0.25, adsTime: 0.35, scoped: true,
    recoil: [[0, 6]], recoilRecover: 4,
    strengths: 'Abate com um tiro acima das pernas.',
    limits: 'Sem mira sem luneta, lenta e barulhenta.',
    sound: { pitch: 0.6, body: 1.4, crack: 1.5, tail: 1.0 },
    model: { length: 0.85, barrel: 0.32, mag: 0.1, stock: 0.22, scope: 0.22, bulk: 1.1 },
  },
};

export const PRIMARY_IDS = ['rifle', 'smg', 'dmr', 'shotgun', 'sniper'];

// Habilidades nunca matam: criam informação, controle de espaço ou sustentação.
export const AGENTS = [
  {
    id: 'brasa', name: 'Brasa', role: 'Ponta de lança', color: 0xd9822b,
    bio: 'Ex-bombeira industrial. Abre espaço para a equipe entrar.',
    q: { id: 'flash', name: 'Clarão', desc: 'Granada que cega quem estiver olhando para ela (1,8 s). Vire o rosto para reduzir.', cooldown: 30, charges: 2 },
    e: { id: 'dash', name: 'Impulso', desc: 'Avanço curto e rápido na direção do movimento.', cooldown: 20, charges: 1 },
  },
  {
    id: 'nevoa', name: 'Névoa', role: 'Controlador', color: 0x6c8ebf,
    bio: 'Engenheira química. Corta linhas de visão e redesenha o mapa.',
    q: { id: 'smoke', name: 'Cortina', desc: 'Fumaça esférica que bloqueia a visão por 14 s.', cooldown: 35, charges: 2 },
    e: { id: 'wall', name: 'Barreira', desc: 'Painel temporário que bloqueia passagem e tiros (8 s, 300 de resistência).', cooldown: 40, charges: 1 },
  },
  {
    id: 'radar', name: 'Radar', role: 'Iniciador', color: 0x4fb39a,
    bio: 'Topógrafo militar. Encontra o inimigo antes que ele te encontre.',
    q: { id: 'pulse', name: 'Pulso', desc: 'Revela inimigos num raio de 22 m por 2 s para toda a equipe.', cooldown: 35, charges: 1 },
    e: { id: 'sensor', name: 'Sensor', desc: 'Sensor fixo que marca inimigos que passarem perto (até 30 s).', cooldown: 30, charges: 1 },
  },
  {
    id: 'ancora', name: 'Âncora', role: 'Sentinela', color: 0xb6a35a,
    bio: 'Paramédica de campo. Mantém a equipe de pé e o ponto seguro.',
    q: { id: 'heal', name: 'Estação médica', desc: 'Cura 12 de vida/s para aliados próximos por 4 s.', cooldown: 40, charges: 1 },
    e: { id: 'shield', name: 'Placa leve', desc: '+30 de escudo temporário em si mesmo (decai em 10 s).', cooldown: 30, charges: 1 },
  },
];

export const MODES = {
  training: {
    id: 'training', name: 'Treinamento', tag: 'Prática',
    desc: 'Estande com alvos fixos e móveis, duelos contra bots e teste livre de armas e habilidades. Sem pressão, com estatísticas.',
  },
  tdm: {
    id: 'tdm', name: 'Confronto', tag: 'Casual',
    desc: 'Equipes 5×5 com renascimento. Primeira a 40 abates vence. Ideal para aquecer.',
    killTarget: 40, timeLimit: 480, respawn: 3,
  },
  domination: {
    id: 'domination', name: 'Domínio', tag: 'Casual',
    desc: 'Capture e segure 3 pontos. Primeira equipe a 150 pontos vence; troca de lados aos 75.',
    scoreTarget: 150, timeLimit: 540, respawn: 4, captureTime: 6,
  },
  breach: {
    id: 'breach', name: 'Ruptura', tag: 'Competitivo',
    desc: 'Atacantes plantam a carga em A ou B; defensores impedem ou desarmam. Sem renascimento. Primeira a 7 rodadas vence; troca de lado após 6.',
    roundsToWin: 7, swapAfter: 6, prepTime: 12, roundTime: 100, plantTime: 3.5, defuseTime: 6, fuseTime: 40, ranked: true,
  },
};

export const BOT_SKILL = {
  // reaction: ms até começar a atirar; aimError: graus; track: velocidade de giro (graus/s)
  recruta: { name: 'Recruta', reaction: 650, aimError: 4.5, track: 180, burst: 4, headChance: 0.1 },
  soldado: { name: 'Soldado', reaction: 420, aimError: 2.6, track: 300, burst: 6, headChance: 0.2 },
  veterano: { name: 'Veterano', reaction: 300, aimError: 1.6, track: 420, burst: 8, headChance: 0.3 },
  elite: { name: 'Elite', reaction: 220, aimError: 1.0, track: 560, burst: 10, headChance: 0.4 },
};

export const RANKS = [
  { name: 'Ferro', min: 0 }, { name: 'Bronze', min: 800 }, { name: 'Prata', min: 1000 },
  { name: 'Ouro', min: 1200 }, { name: 'Platina', min: 1400 }, { name: 'Diamante', min: 1600 }, { name: 'Mestre', min: 1800 },
];

export function deepFreeze(o) {
  Object.freeze(o);
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return o;
}
deepFreeze(PLAYER); deepFreeze(WEAPONS); deepFreeze(AGENTS); deepFreeze(MODES); deepFreeze(BOT_SKILL); deepFreeze(RANKS);
