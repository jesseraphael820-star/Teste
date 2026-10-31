import { Menu } from './menu.js';
import { refreshChallenges } from './progression.js';

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

refreshChallenges();
const menu = new Menu({
  canvas: document.getElementById('view'),
  hudRoot: document.getElementById('hud'),
  menuRoot: document.getElementById('menu'),
  overlay: document.getElementById('overlay'),
});
if (!webglOk()) menu.fatal('Seu navegador não suporta WebGL. Atualize o navegador ou ative a aceleração de hardware.');
else menu.show();
