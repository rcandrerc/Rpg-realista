// Joystick na tela, teclado e câmera (arrastar para girar, roda do mouse ou dois dedos para o zoom)
import * as THREE from 'three';

export class Controles {
  constructor(canvas) {
    this.teclas = {}; this.joy = { x: 0, y: 0 };
    this.yaw = Math.PI * 0.85; this.pitch = 0.3; this.dist = 5.2;
    this.aoTeclar = null;
    addEventListener('keydown', (e) => {
      this.teclas[e.code] = true;
      if (['sheet', 'pick', 'hab'].some((id) => !document.getElementById(id).hidden)) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.aoTeclar?.(e.code);
    });
    addEventListener('keyup', (e) => { this.teclas[e.code] = false; });

    // celular: impede o zoom da página com dois dedos e com toque duplo (o jogo usa a tela inteira)
    for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && ['sheet', 'pick', 'hab'].every((id) => document.getElementById(id).hidden)) e.preventDefault(); }, { passive: false });

    // joystick que aparece onde o dedo encosta (metade esquerda de baixo da tela); solto, volta para o canto
    const pad = document.getElementById('pad'), knob = document.getElementById('knob'), zona = document.getElementById('padZona');
    let id = null, cx = 0, cy = 0;
    const mv = (e) => {
      const R = pad.offsetWidth / 2;
      let x = e.clientX - cx, y = e.clientY - cy; const d = Math.hypot(x, y);
      if (d > R) { x *= R / d; y *= R / d; }
      knob.style.transform = `translate(${x}px,${y}px)`; this.joy = { x: x / R, y: y / R };
    };
    const inicio = (e, flutua) => {
      if (id !== null) return;
      e.preventDefault(); id = e.pointerId; e.currentTarget.setPointerCapture(id);
      const R = pad.offsetWidth / 2;
      if (flutua) { // centro do joystick no dedo, sem sair da tela
        cx = Math.min(innerWidth - R - 4, Math.max(R + 4, e.clientX)); cy = Math.min(innerHeight - R - 4, Math.max(R + 4, e.clientY));
        Object.assign(pad.style, { left: `${cx - R}px`, top: `${cy - R}px`, bottom: 'auto' });
      } else { const r = pad.getBoundingClientRect(); cx = r.left + R; cy = r.top + R; }
      pad.classList.add('ativo'); mv(e);
    };
    zona.addEventListener('pointerdown', (e) => inicio(e, true));
    pad.addEventListener('pointerdown', (e) => inicio(e, false));
    for (const el of [zona, pad]) el.addEventListener('pointermove', (e) => { if (e.pointerId === id) mv(e); });
    const fim = (e) => {
      if (e.pointerId !== id) return; id = null; this.joy = { x: 0, y: 0 }; knob.style.transform = '';
      pad.classList.remove('ativo'); pad.style.left = pad.style.top = pad.style.bottom = '';
    };
    for (const el of [zona, pad]) { el.addEventListener('pointerup', fim); el.addEventListener('pointercancel', fim); }

    // câmera: um dedo (ou o mouse) gira para os lados e para cima/baixo; dois dedos afastando/juntando dão zoom
    const toques = new Map(); let pinca = 0;
    const distPinca = () => { const [a, b] = [...toques.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId); toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 2) pinca = distPinca();
    });
    canvas.addEventListener('pointermove', (e) => {
      const t = toques.get(e.pointerId); if (!t) return;
      const dx = e.clientX - t.x, dy = e.clientY - t.y; t.x = e.clientX; t.y = e.clientY;
      if (toques.size >= 2) {
        const d = distPinca(); if (pinca > 0 && d > 0) this.zoom(pinca / d); pinca = d;
      } else {
        this.yaw -= dx * 0.006;
        this.pitch = Math.min(1.2, Math.max(-0.6, this.pitch + dy * 0.004));
      }
    });
    const solta = (e) => { toques.delete(e.pointerId); pinca = toques.size === 2 ? distPinca() : 0; };
    canvas.addEventListener('pointerup', solta);
    canvas.addEventListener('pointercancel', solta);
    canvas.addEventListener('wheel', (e) => { this.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: true });
  }
  zoom(fator) { this.dist = Math.min(14, Math.max(2, this.dist * fator)); }
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
  // Abaixo da linha do ombro a câmera encosta no chão e passa a olhar para cima (dá para ver o céu)
  posicionarCamera(camera, alvo) {
    const c = Math.cos(this.pitch) * this.dist;
    const y = Math.max(0.3, alvo.y + Math.sin(this.pitch) * this.dist);
    camera.position.set(alvo.x - Math.sin(this.yaw) * c, y, alvo.z - Math.cos(this.yaw) * c);
    camera.lookAt(alvo.x, alvo.y + Math.max(0, -Math.sin(this.pitch)) * this.dist * 1.2, alvo.z);
  }
}
