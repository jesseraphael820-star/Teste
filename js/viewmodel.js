// Arma em primeira pessoa, renderizada numa cena própria (não atravessa paredes).
import * as THREE from './vendor/three.module.min.js';
import { WEAPONS } from './config.js';
import { CAMOS } from './progression.js';
import { settings } from './settings.js';

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x3a332c, 1.8));
    const key = new THREE.DirectionalLight(0xfff2dd, 2.2); key.position.set(1, 2, 1); this.scene.add(key);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.models = {};
    this.current = null;
    this.kick = 0; this.kickRot = 0;
    this.sway = { x: 0, y: 0 };
    this.bob = 0;
    this.flash = null;
  }

  setCamo(camoId) {
    const c = CAMOS.find((k) => k.id === camoId) || CAMOS[0];
    this.camo = c;
    for (const id in this.models) this.applyCamo(this.models[id]);
  }

  applyCamo(group) {
    const c = this.camo || CAMOS[0];
    group.traverse((o) => {
      if (o.isMesh && o.userData.camo) {
        o.material.color.set(c.color); o.material.metalness = c.metal; o.material.roughness = c.rough;
        o.material.emissive.set(c.emissive || 0x000000);
      }
    });
  }

  build(id) {
    const m = WEAPONS[id].model;
    const g = new THREE.Group();
    const body = () => new THREE.MeshStandardMaterial({ color: 0x2b2d30, metalness: 0.6, roughness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x18191b, metalness: 0.5, roughness: 0.6 });
    const glove = new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 0.9 });
    const add = (w, h, d, mat, x, y, z, camo = false) => {
      const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      me.position.set(x, y, z); me.userData.camo = camo; g.add(me); return me;
    };
    const L = m.length, bk = m.bulk;
    add(0.055 * bk, 0.07 * bk, L, body(), 0, 0, -L / 2, true);
    add(0.022, 0.022, m.barrel + 0.05, dark, 0, 0.012, -L - m.barrel / 2);
    if (m.mag) add(0.04, m.mag, 0.07, dark, 0, -0.05 - m.mag / 2, -L * 0.45);
    add(0.04, 0.09, 0.05, dark, 0, -0.07, -0.05).rotation.x = 0.3;
    if (m.stock) add(0.045, 0.08, m.stock, body(), 0, -0.01, m.stock / 2 - 0.02, true);
    if (m.scope) {
      const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, m.scope + 0.08, 12), dark);
      sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.065, -L * 0.45); g.add(sc);
    } else {
      add(0.01, 0.02, 0.01, dark, 0, 0.045, -L + 0.03);
      add(0.03, 0.015, 0.01, dark, 0, 0.042, -0.04);
    }
    if (id === 'shotgun') add(0.05, 0.05, 0.22, dark, 0, -0.045, -L * 0.7);
    // mãos
    add(0.06, 0.07, 0.1, glove, 0.0, -0.06, -0.02);
    add(0.06, 0.06, 0.12, glove, 0.0, -0.045, -L * 0.62);
    const magMesh = g.children.find((c) => c.geometry.parameters?.height === m.mag && m.mag);
    g.userData.mag = magMesh || null;
    g.userData.magY = magMesh ? magMesh.position.y : 0;
    const tip = new THREE.Object3D(); tip.position.set(0, 0.012, -L - m.barrel - 0.03); g.add(tip);
    g.userData.tip = tip;
    g.visible = false;
    this.root.add(g);
    this.applyCamo(g);
    return g;
  }

  show(id) {
    if (!this.models[id]) this.models[id] = this.build(id);
    for (const k in this.models) this.models[k].visible = k === id;
    this.current = id;
  }

  onShot() {
    const w = WEAPONS[this.current];
    this.kick = Math.min(this.kick + 0.035 * w.model.bulk * (w.pellets > 1 ? 2.5 : 1) * (w.scoped ? 2.5 : 1), 0.12);
    this.kickRot = Math.min(this.kickRot + 0.08 * (w.scoped || w.pellets > 1 ? 2.5 : 1), 0.4);
  }

  update(dt, now, a, input) {
    if (!this.current) return;
    const g = this.models[this.current];
    const w = WEAPONS[this.current];
    const reduce = settings.reduceMotion ? 0.25 : 1;
    // sway com o mouse
    this.sway.x += (-input.dx * 0.0006 - this.sway.x) * Math.min(1, dt * 8);
    this.sway.y += (input.dy * 0.0006 - this.sway.y) * Math.min(1, dt * 8);
    const speed = Math.hypot(a.vel.x, a.vel.z);
    if (a.grounded) this.bob += dt * speed * 1.9;
    const bobAmp = Math.min(1, speed / 5) * 0.012 * reduce * (1 - a.adsT * 0.85);
    this.kick += -this.kick * Math.min(1, dt * 14);
    this.kickRot += -this.kickRot * Math.min(1, dt * 12);

    const hip = new THREE.Vector3(0.17, -0.19, -0.4);
    const ads = new THREE.Vector3(0, w.model.scope ? -0.105 : -0.082, -0.3);
    const p = hip.lerp(ads, a.adsT);
    p.x += Math.sin(this.bob) * bobAmp + this.sway.x * (1 - a.adsT * 0.7);
    p.y += Math.abs(Math.cos(this.bob)) * bobAmp + this.sway.y * (1 - a.adsT * 0.7);
    p.z += this.kick;
    if (a.crouch) p.y += 0.01;

    let rx = this.kickRot, rz = 0;
    // recarga: abaixa e inclina, tira e devolve o carregador
    if (a.reloadStarted) {
      const k = Math.min(1, (now - a.reloadStarted) / w.reload);
      const dip = Math.sin(k * Math.PI);
      p.y -= dip * 0.08; rz = dip * 0.6; rx -= dip * 0.25;
      if (g.userData.mag) g.userData.mag.position.y = g.userData.magY - (k > 0.15 && k < 0.6 ? 0.25 : 0);
    } else if (g.userData.mag) g.userData.mag.position.y = g.userData.magY;
    // troca de arma: sobe de baixo
    if (now < a.equipUntil) {
      const k = 1 - (a.equipUntil - now) / w.equip;
      p.y -= (1 - easeOut(k)) * 0.3; rx -= (1 - k) * 0.6;
    }
    g.position.copy(p);
    g.rotation.set(rx, 0, rz);
    // luneta: esconde a arma quando totalmente mirando
    g.visible = !(w.scoped && a.adsT > 0.9);
  }

  tipWorld() {
    const g = this.models[this.current];
    return g ? g.userData.tip : null;
  }

  render(renderer, fov) {
    this.camera.fov = Math.max(50, fov * 0.72);
    this.camera.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}

function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
