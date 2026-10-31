// Efeitos visuais leves: traçantes, marcas de impacto, faíscas, poeira, clarões de cano.
import * as THREE from './vendor/three.module.min.js';
import { decalTexture, softSprite } from './textures.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.decals = [];
    this.decalMat = new THREE.MeshBasicMaterial({ map: decalTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decalGeo = new THREE.PlaneGeometry(0.12, 0.12);
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.7 });
    this.dustTex = softSprite('180,170,150');
    this.sparkTex = softSprite('255,200,120');
    this.hitTex = softSprite('150,40,30');
    this.flashTex = softSprite('255,220,160');
    this.muzzleLight = new THREE.PointLight(0xffc27a, 0, 7, 2);
    scene.add(this.muzzleLight);
    this.muzzleUntil = 0;
  }

  tracer(from, to, now, strong = false) {
    const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(g, this.tracerMat.clone());
    line.material.opacity = strong ? 0.8 : 0.45;
    this.scene.add(line);
    this.items.push({ obj: line, until: now + 0.06, fade: true, start: now, dur: 0.06 });
  }

  impact(point, normal, surface, now) {
    const d = new THREE.Mesh(this.decalGeo, this.decalMat);
    d.position.copy(point).addScaledVector(normal, 0.01);
    d.lookAt(point.clone().add(normal));
    d.rotation.z = Math.random() * Math.PI;
    this.scene.add(d);
    this.decals.push(d);
    if (this.decals.length > 120) { const old = this.decals.shift(); this.scene.remove(old); }
    this.puff(point.clone().addScaledVector(normal, 0.1), surface === 'metal' ? this.sparkTex : this.dustTex, now, surface === 'metal' ? 0.25 : 0.5, normal);
  }

  bodyHit(point, now) { this.puff(point, this.hitTex, now, 0.35, null, 0.6); }

  puff(p, tex, now, size, normal, opacity = 0.8) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity }));
    sp.position.copy(p); sp.scale.setScalar(size);
    this.scene.add(sp);
    const vel = normal ? new THREE.Vector3().copy(normal).multiplyScalar(0.8) : new THREE.Vector3(0, 0.4, 0);
    this.items.push({ obj: sp, until: now + 0.4, start: now, dur: 0.4, grow: size * 2, vel, fade: true });
  }

  muzzle(pos, now) {
    this.muzzleLight.position.copy(pos);
    this.muzzleLight.intensity = 6;
    this.muzzleUntil = now + 0.05;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos); sp.scale.setScalar(0.5);
    this.scene.add(sp);
    this.items.push({ obj: sp, until: now + 0.05, start: now, dur: 0.05, fade: true });
  }

  burst(pos, color, now, size = 2) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos); sp.scale.setScalar(size);
    this.scene.add(sp);
    this.items.push({ obj: sp, until: now + 0.35, start: now, dur: 0.35, fade: true, grow: size * 2 });
  }

  // anel expansivo (Pulso)
  ring(pos, color, radius, now) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.3, pos.z);
    this.scene.add(m);
    this.items.push({ obj: m, until: now + 0.8, start: now, dur: 0.8, fade: true, ring: radius });
  }

  update(now, dt) {
    if (now > this.muzzleUntil) this.muzzleLight.intensity = 0;
    for (const it of this.items) {
      const k = Math.min(1, (now - it.start) / it.dur);
      if (it.fade) it.obj.material.opacity = (it.baseOpacity ??= it.obj.material.opacity) * (1 - k);
      if (it.grow) { const s = it.obj.scale.x + it.grow * dt; it.obj.scale.set(s, s, 1); }
      if (it.vel) it.obj.position.addScaledVector(it.vel, dt);
      if (it.ring) it.obj.scale.setScalar(1 + k * it.ring);
    }
    const dead = this.items.filter((i) => now >= i.until);
    for (const it of dead) { this.scene.remove(it.obj); it.obj.material.dispose(); if (it.obj.geometry && !it.obj.isSprite) it.obj.geometry.dispose(); }
    this.items = this.items.filter((i) => now < i.until);
  }

  dispose() {
    for (const it of this.items) this.scene.remove(it.obj);
    for (const d of this.decals) this.scene.remove(d);
    this.items = []; this.decals = [];
    this.scene.remove(this.muzzleLight);
  }
}
