// Texturas procedurais (sem arquivos externos). Geradas uma vez e reutilizadas.
import * as THREE from './vendor/three.module.min.js';

const cache = new Map();

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function noise(ctx, size, r, amount, alpha = 0.08, scale = 1) {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(r() * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`;
    const s = (1 + r() * 3) * scale;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
}

function stains(ctx, size, r, count, color) {
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rad = 10 + r() * size * 0.25;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
}

function drips(ctx, size, r, count, color) {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const x = r() * size;
    ctx.lineWidth = 1 + r() * 3;
    ctx.globalAlpha = 0.15 + r() * 0.2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 6, r() * size * 0.7); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const painters = {
  concrete(ctx, s, r, tint = '#8d8a84') {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, r, 9000, 0.12);
    stains(ctx, s, r, 6, 'rgba(40,36,30,0.18)');
    drips(ctx, s, r, 18, '#3b372f');
    ctx.strokeStyle = 'rgba(30,30,30,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, s * 0.5); ctx.lineTo(s, s * 0.5); ctx.moveTo(s * 0.5, 0); ctx.lineTo(s * 0.5, s); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(20,20,20,0.5)'; ctx.beginPath(); ctx.arc(s * (0.12 + (i % 2) * 0.5), s * (0.12 + Math.floor(i / 2) * 0.5), 3, 0, 7); ctx.fill(); }
  },
  brick(ctx, s, r, tint = '#7a4434') {
    ctx.fillStyle = '#5b544c'; ctx.fillRect(0, 0, s, s);
    const bh = s / 8, bw = s / 4;
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
      const off = (y % 2) * bw / 2;
      const c = new THREE.Color(tint).offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
      ctx.fillStyle = `#${c.getHexString()}`;
      ctx.fillRect(x * bw + off + 2, y * bh + 2, bw - 4, bh - 4);
    }
    noise(ctx, s, r, 6000, 0.12);
    stains(ctx, s, r, 4, 'rgba(20,20,20,0.25)');
  },
  plaster(ctx, s, r, tint = '#b9ad98') {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, r, 7000, 0.08);
    stains(ctx, s, r, 7, 'rgba(90,70,40,0.18)');
    drips(ctx, s, r, 10, '#5a4d3a');
    ctx.fillStyle = 'rgba(60,50,40,0.35)'; ctx.fillRect(0, s * 0.85, s, s * 0.15);
  },
  metal(ctx, s, r, tint = '#6d7478') {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += s / 16) {
      const g = ctx.createLinearGradient(x, 0, x + s / 16, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, s / 16, s);
    }
    stains(ctx, s, r, 8, 'rgba(120,60,25,0.35)');
    noise(ctx, s, r, 5000, 0.1);
  },
  asphalt(ctx, s, r) {
    ctx.fillStyle = '#4a4a4a'; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, r, 16000, 0.18, 0.7);
    stains(ctx, s, r, 5, 'rgba(10,10,10,0.25)');
    ctx.strokeStyle = 'rgba(20,20,20,0.6)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); let x = r() * s, y = r() * s; ctx.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
  },
  tiles(ctx, s, r, tint = '#9aa3a3') {
    ctx.fillStyle = '#4e5555'; ctx.fillRect(0, 0, s, s);
    const n = 4, t = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = new THREE.Color(tint).offsetHSL(0, 0, (r() - 0.5) * 0.08);
      ctx.fillStyle = `#${c.getHexString()}`; ctx.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
    }
    noise(ctx, s, r, 5000, 0.08);
    stains(ctx, s, r, 5, 'rgba(60,50,30,0.25)');
  },
  dirt(ctx, s, r) {
    ctx.fillStyle = '#6b604f'; ctx.fillRect(0, 0, s, s);
    noise(ctx, s, r, 18000, 0.2, 0.8);
    stains(ctx, s, r, 8, 'rgba(40,34,24,0.3)');
    stains(ctx, s, r, 4, 'rgba(90,96,60,0.25)');
  },
  crate(ctx, s, r) {
    ctx.fillStyle = '#7c6240'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += s / 6) { ctx.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.1})`; ctx.fillRect(0, y, s, 2); }
    noise(ctx, s, r, 4000, 0.1);
    ctx.strokeStyle = '#4b3a24'; ctx.lineWidth = s / 14;
    ctx.strokeRect(s / 28, s / 28, s - s / 14, s - s / 14);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.stroke();
  },
  container(ctx, s, r, tint = '#2f5d73') {
    ctx.fillStyle = tint; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += s / 10) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x, 0, s / 30, s); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + s / 30, 0, s / 40, s); }
    stains(ctx, s, r, 10, 'rgba(110,55,20,0.4)');
    noise(ctx, s, r, 4000, 0.1);
  },
  hazard(ctx, s) {
    ctx.fillStyle = '#d4a017'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#1c1c1c';
    for (let i = -s; i < s * 2; i += s / 4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s / 8, 0); ctx.lineTo(i + s / 8 - s, s); ctx.lineTo(i - s, s); ctx.fill(); }
  },
};

export function texture(kind, tint, repeat = 1) {
  const key = `${kind}|${tint || ''}`;
  let base = cache.get(key);
  if (!base) {
    const size = 256;
    const [c, ctx] = canvas(size);
    const r = rng(key.length * 9973 + kind.charCodeAt(0) * 31 + (tint ? parseInt(tint.slice(1), 16) % 997 : 0));
    painters[kind](ctx, size, r, tint);
    base = new THREE.CanvasTexture(c);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.colorSpace = THREE.SRGBColorSpace;
    base.anisotropy = 8;
    cache.set(key, base);
  }
  if (repeat === 1) return base;
  const t = base.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  return t;
}

// textura radial macia para fumaça, clarões e partículas
export function softSprite(color = '255,255,255') {
  const key = 'sprite|' + color;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.4, `rgba(${color},0.6)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function decalTexture() {
  if (cache.has('decal')) return cache.get('decal');
  const [c, ctx] = canvas(64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(10,10,10,0.95)');
  g.addColorStop(0.35, 'rgba(30,28,25,0.8)');
  g.addColorStop(1, 'rgba(60,55,50,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  cache.set('decal', t);
  return t;
}
