// Efeitos visuais disparados pelos eventos da simulação (projéteis, anéis, fogo, chuva de flechas)
import * as THREE from 'three';

export class Efeitos {
  constructor(scene) { this.scene = scene; this.projeteis = new Map(); this.lista = []; }

  evento(e) {
    switch (e.t) {
      case 'proj': return this.projetil(e);
      case 'projFim': return this.fimProjetil(e);
      case 'anel': return this.anel(e.x, e.z, e.r, e.cor, e.dur);
      case 'campo': return this.campo(e);
      case 'chuva': return this.chuva(e);
      default:
    }
  }
  projetil(e) {
    let m;
    if (e.flecha) {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5), new THREE.MeshStandardMaterial({ color: 0x6b4a2c }));
      m.geometry.rotateX(Math.PI / 2);
      const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.8, roughness: 0.3 }));
      ponta.rotation.x = Math.PI / 2; ponta.position.z = 0.44; m.add(ponta);
      if (e.atravessa) m.add(new THREE.PointLight(e.cor, 1.2, 3));
    } else {
      m = new THREE.Mesh(new THREE.SphereGeometry(e.tam, 16, 12), new THREE.MeshBasicMaterial({ color: e.cor, toneMapped: false }));
      m.add(new THREE.PointLight(e.cor, 2.4, 6));
    }
    m.position.set(e.x, e.y, e.z);
    const dir = new THREE.Vector3(e.dx, e.dy, e.dz);
    m.lookAt(m.position.clone().add(dir));
    this.scene.add(m);
    this.projeteis.set(e.id, { m, dir, vel: e.vel, vida: 2.5 });
  }
  fimProjetil(e) {
    const p = this.projeteis.get(e.id);
    if (p) { this.scene.remove(p.m); this.projeteis.delete(e.id); }
    if (e.explosao) {
      const luz = new THREE.PointLight(e.cor, 6, 9); luz.position.set(e.x, e.y, e.z); this.scene.add(luz);
      this.lista.push({ m: luz, vida: 0.35, max: 0.35, luz: true });
      this.anel(e.x, e.z, e.explosao, e.cor, 0.45);
    }
  }
  anel(x, z, r, cor, dur) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.2, r, 40),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.6, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.06, z); this.scene.add(m);
    this.lista.push({ m, vida: dur, max: dur, cresce: true });
  }
  campo(e) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(e.r, 40),
      new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(e.x, 0.07, e.z);
    const luz = new THREE.PointLight(0xff7a2a, 3, e.r * 3); luz.position.set(e.x, 0.8, e.z);
    this.scene.add(m, luz);
    this.lista.push({ m, luzFogo: luz, vida: e.dur, max: e.dur, fogo: true });
  }
  chuva(e) {
    this.anel(e.x, e.z, e.r, 0xe8dcc0, 0.6);
    for (let k = 0; k < e.ondas; k++) setTimeout(() => {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * 6.28, d = Math.random() * e.r;
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x6b4a2c }));
        s.position.set(e.x + Math.cos(a) * d, 6, e.z + Math.sin(a) * d); this.scene.add(s);
        this.lista.push({ m: s, vida: 0.5, max: 0.5, cai: true });
      }
    }, (0.25 + k * 0.22) * 1000);
  }
  atualizar(dt, t) {
    for (const [id, p] of this.projeteis) {
      p.m.position.addScaledVector(p.dir, p.vel * dt); p.vida -= dt;
      if (p.vida <= 0) { this.scene.remove(p.m); this.projeteis.delete(id); }
    }
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const e = this.lista[i]; e.vida -= dt; const k = Math.max(0, e.vida / e.max);
      if (e.luz) e.m.intensity = 6 * k;
      else if (e.cai) e.m.position.y = Math.max(0.2, 6 * k);
      else if (e.fogo) e.luzFogo.intensity = 2.5 + Math.sin(t * 20) * 0.8;
      else { e.m.material.opacity = 0.6 * k; if (e.cresce) e.m.scale.setScalar(1 + (1 - k) * 0.3); }
      if (e.vida <= 0) { this.scene.remove(e.m); if (e.luzFogo) this.scene.remove(e.luzFogo); this.lista.splice(i, 1); }
    }
  }
}
