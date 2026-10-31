import { load, save } from './storage.js';

export const DEFAULT_SETTINGS = {
  sensitivity: 1.0,
  adsSensitivity: 0.8,
  invertY: false,
  fov: 90,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  ambientVolume: 0.5,
  // acessibilidade
  colorblind: 'none',          // none | deuteranopia | protanopia | tritanopia
  enemyOutline: true,          // contorno de alto contraste em inimigos
  soundVisualizer: true,       // indicadores visuais de som (passos, tiros)
  subtitles: true,             // legendas para avisos de áudio
  reduceMotion: false,         // reduz balanço de câmera e tremores
  screenShake: 0.6,
  hudScale: 1.0,
  damageNumbers: true,
  toggleAim: false,
  toggleCrouch: false,
  flashDark: false,            // Clarão como véu escuro em vez de branco (mesma duração e efeito)
  // mira
  crosshair: { style: 'cross', color: '#5cff9d', size: 6, gap: 4, thickness: 2, dot: true, outline: true, dynamic: true },
  // gráficos
  shadows: true,
  quality: 'alta',             // baixa | media | alta
  renderScale: 1.0,
  showFps: false,
  // social
  chatFilter: true,
  chatMode: 'equipe',          // todos | equipe | desligado
  muteOpponents: false,
  // controles
  keys: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', crouch: 'ControlLeft', walk: 'ShiftLeft', reload: 'KeyR',
    ability1: 'KeyQ', ability2: 'KeyE', interact: 'KeyF', ping: 'KeyZ', comms: 'KeyV',
    primary: 'Digit1', secondary: 'Digit2', scoreboard: 'Tab', chat: 'Enter', loadout: 'KeyB',
  },
};

export const KEY_LABELS = {
  forward: 'Frente', back: 'Trás', left: 'Esquerda', right: 'Direita', jump: 'Pular', crouch: 'Agachar',
  walk: 'Andar silencioso', reload: 'Recarregar', ability1: 'Habilidade 1', ability2: 'Habilidade 2',
  interact: 'Interagir / plantar / desarmar', ping: 'Marcar (ping)', comms: 'Comunicação rápida', primary: 'Arma principal',
  secondary: 'Pistola', scoreboard: 'Placar', chat: 'Chat', loadout: 'Trocar equipamento (preparação)',
};

// Cores de identificação de equipe — testadas para cada tipo de daltonismo.
export const TEAM_PALETTES = {
  none: { ally: '#38c6ff', enemy: '#ff4b3e' },
  deuteranopia: { ally: '#3d8bff', enemy: '#ffb000' },
  protanopia: { ally: '#3d8bff', enemy: '#f5e14a' },
  tritanopia: { ally: '#00b3a4', enemy: '#ff3fa4' },
};

export const settings = load('settings', DEFAULT_SETTINGS);

export function saveSettings() { save('settings', settings); }

export function teamColors() { return TEAM_PALETTES[settings.colorblind] || TEAM_PALETTES.none; }

export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Espaço', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', Tab: 'Tab', Enter: 'Enter', AltLeft: 'Alt', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5' };
  return map[code] || code;
}
