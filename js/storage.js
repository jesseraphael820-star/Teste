// Persistência local com tolerância a falhas (modo privado, armazenamento bloqueado).
const PREFIX = 'pontocritico.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return structuredClone(fallback);
    return mergeDefaults(JSON.parse(raw), fallback);
  } catch {
    return structuredClone(fallback);
  }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* ignorado */ }
}

function mergeDefaults(value, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? value : structuredClone(defaults);
  if (defaults && typeof defaults === 'object') {
    const out = {};
    const src = value && typeof value === 'object' ? value : {};
    for (const k of Object.keys(defaults)) out[k] = k in src ? mergeDefaults(src[k], defaults[k]) : structuredClone(defaults[k]);
    for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
    return out;
  }
  return typeof value === typeof defaults ? value : defaults;
}
