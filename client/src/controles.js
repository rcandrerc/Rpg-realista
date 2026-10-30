// Joystick na tela, teclado e câmera (arrastar para girar, roda do mouse para aproximar)
import * as THREE from 'three';

export class Controles {
  constructor(canvas) {
    this.teclas = {}; this.joy = { x: 0, y: 0 };
    this.yaw = Math.PI * 0.85; this.pitch = 0.3; this.dist = 5.2;
    this.aoTeclar = null;
    addEventListener('keydown', (e) => {
      this.teclas[e.code] = true;
      if (!document.getElementById('sheet').hidden) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.aoTeclar?.(e.code);
    });
    addEventListener('keyup', (e) => { this.teclas[e.code] = false; });

    // celular: impede o zoom da página com dois dedos e com toque duplo (o jogo usa a tela inteira)
    for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && document.getElementById('sheet').hidden) e.preventDefault(); }, { passive: false });

    const pad = document.getElementById('pad'), knob = document.getElementById('knob');
    let id = null;
    const mv = (e) => {
      const r = pad.getBoundingClientRect(), R = r.width / 2;
      let x = e.clientX - r.left - R, y = e.clientY - r.top - R; const d = Math.hypot(x, y);
      if (d > R) { x *= R / d; y *= R / d; }
      knob.style.transform = `translate(${x}px,${y}px)`; this.joy = { x: x / R, y: y / R };
    };
    pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(id); mv(e); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) mv(e); });
    const fim = (e) => { if (e.pointerId !== id) return; id = null; this.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
    pad.addEventListener('pointerup', fim); pad.addEventListener('pointercancel', fim);

    let cid = null, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', (e) => { cid = e.pointerId; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(cid); });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== cid) return;
      this.yaw -= (e.clientX - lx) * 0.006;
      this.pitch = Math.min(1.05, Math.max(0.05, this.pitch + (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY;
    });
    canvas.addEventListener('pointerup', () => { cid = null; });
    canvas.addEventListener('pointercancel', () => { cid = null; });
    canvas.addEventListener('wheel', (e) => { this.dist = Math.min(9, Math.max(3, this.dist + e.deltaY * 0.004)); }, { passive: true });
  }
  // Direção de movimento no mundo, relativa à câmera
  direcao() {
    let ix = this.joy.x, iy = this.joy.y; const k = this.teclas;
    if (k.KeyW || k.ArrowUp) iy -= 1; if (k.KeyS || k.ArrowDown) iy += 1;
    if (k.KeyA || k.ArrowLeft) ix -= 1; if (k.KeyD || k.ArrowRight) ix += 1;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const v = new THREE.Vector3(fx * -iy - fz * ix, 0, fz * -iy + fx * ix);
    if (v.length() > 1) v.normalize();
    return v;
  }
  correndo() { return !!(this.teclas.ShiftLeft || this.teclas.ShiftRight || Math.hypot(this.joy.x, this.joy.y) > 0.9); }
  posicionarCamera(camera, alvo) {
    const c = Math.cos(this.pitch) * this.dist;
    camera.position.set(alvo.x - Math.sin(this.yaw) * c, alvo.y + Math.sin(this.pitch) * this.dist, alvo.z - Math.cos(this.yaw) * c);
    camera.lookAt(alvo);
  }
}
