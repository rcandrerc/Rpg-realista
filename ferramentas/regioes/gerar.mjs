// Regiões da névoa arredondadas, crescendo a partir da Vila (André 2026-11-11: "podia ser mais arredondada... como se
// fosse o raio"; desenho aprovado: /mnt/project-files/progressao/regioes-v3-arredondadas.png). Cada ponto do mundo cai
// numa região pela distância e pelo ângulo a partir da Vila da Clareira (e da vila de Aurora); depois a grade é
// desfocada (cantos redondos) e vira o contorno de cada região. Gera shared/regioes.js (o servidor e o app usam).
// Uso: node ferramentas/regioes/gerar.mjs   (depois: node client/exportar-godot/mundo.mjs)
import fs from 'node:fs';
import { TERRAS, dentroDaTerra } from '../../shared/mundo.js';
const V = TERRAS.find(t=>t.id==='vael'), I = TERRAS.find(t=>t.id==='ilha'), A = TERRAS.find(t=>t.id==='aurora');
const deg = (x,z,cx,cz)=>{ let a=Math.atan2(z-cz,x-cx)*180/Math.PI; return a; }; // -180..180, 0 = leste, 90 = sul
const O=[10,0], RV=88, AV=[200,1085];
// C (a ilha) entra na conta só para as outras não pegarem o mar dela; o servidor usa o contorno da terra mesmo
export const IDS=['1b','1c','1d','1f','B1','B2','B3','B4','C','D1','D2','D3'];
export function classe(x,z){
  if (dentroDaTerra(I,x,z) > -25) return 'C';
  if (dentroDaTerra(A,x,z) > -30) {
    if (Math.hypot(x-225,z-1385) < 125) return 'D3';
    const r=Math.hypot(x-AV[0],z-AV[1]), a=deg(x,z,...AV);
    return (r>120 && a>-75 && a<70) ? 'D2' : 'D1';
  }
  if (dentroDaTerra(V,x,z) < -30) return null;
  const r=Math.hypot(x-O[0],z-O[1]); if (r<RV) return null;
  let a=deg(x,z,...O); // -180..180
  // anel dos Arredores (lado sudeste da Vila)
  const RA = a>=-50&&a<28 ? 245 : a>=28&&a<62 ? 270 : a>=62&&a<135 ? 255 : 0;
  if (Math.hypot(x-190,z-255) < 95) return '1f';
  if (r<RA) {
    if (a<28) return '1b';
    if (a<62) return '1d';
    return '1c';
  }
  // anel de Vael
  if (a>=-50&&a<30) return 'B3';
  if (a>=30&&a<105) return 'B4';
  const a360 = a<0 ? a+360 : a; // 105..310
  const lim = 228 - Math.max(0, r-250)*0.08;
  return a360 < lim ? 'B1' : 'B2';
}
// grade + desfoque + contorno (argmax suave)
export function poligonos(g=6, sig=18){
  const X0=-640,Z0=-620,X1=1040,Z1=1660, nx=Math.round((X1-X0)/g)+1, nz=Math.round((Z1-Z0)/g)+1;
  const L=new Int8Array(nx*nz).fill(-1);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){ const x=X0+i*g,z=Z0+j*g; const out = x<-600||x>1000||z<-580||z>1620; if(out) continue; const c=classe(x,z); L[j*nx+i]= c?IDS.indexOf(c):-1; }
  const K=Math.ceil(sig*2.5/g), w=[]; for(let k=-K;k<=K;k++) w.push(Math.exp(-((k*g)**2)/(2*sig*sig))); const sw=w.reduce((a,b)=>a+b);
  const blur=(F)=>{ const T=new Float32Array(nx*nz), R=new Float32Array(nx*nz);
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){let s=0;for(let k=-K;k<=K;k++){const ii=Math.min(nx-1,Math.max(0,i+k));s+=w[k+K]*F[j*nx+ii];}T[j*nx+i]=s/sw;}
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){let s=0;for(let k=-K;k<=K;k++){const jj=Math.min(nz-1,Math.max(0,j+k));s+=w[k+K]*T[jj*nx+i];}R[j*nx+i]=s/sw;} return R; };
  const B=[]; for(let k=-1;k<IDS.length;k++){ const F=new Float32Array(nx*nz); for(let n=0;n<F.length;n++) F[n]=L[n]===k?1:0; B.push(blur(F)); }
  const out={};
  for(let k=0;k<IDS.length;k++){
    const me=B[k+1], F=new Float32Array(nx*nz);
    for(let n=0;n<F.length;n++){ let m=-1; for(let q=0;q<B.length;q++) if(q!==k+1&&B[q][n]>m) m=B[q][n]; F[n]=me[n]-m; }
    out[IDS[k]]=contorno(F,nx,nz,X0,Z0,g);
  }
  return out;
}
// marching squares: devolve o maior laço (em [x,z])
function contorno(F,nx,nz,X0,Z0,g){
  const v=(i,j)=> (i<0||j<0||i>=nx||j>=nz)? -1 : F[j*nx+i];
  const P=(i,j,i2,j2)=>{ const a=v(i,j),b=v(i2,j2), t=a/(a-b); return [X0+(i+(i2-i)*t)*g, Z0+(j+(j2-j)*t)*g]; };
  const segs=new Map(); const key=(p)=>p[0].toFixed(3)+','+p[1].toFixed(3);
  const add=(p,q)=>{ segs.set(key(p),{p,q}); };
  for(let j=-1;j<nz;j++)for(let i=-1;i<nx;i++){
    const a=v(i,j)>0,b=v(i+1,j)>0,c=v(i+1,j+1)>0,d=v(i,j+1)>0; const s=(a?8:0)|(b?4:0)|(c?2:0)|(d?1:0);
    if(s===0||s===15) continue;
    const T=()=>P(i,j,i+1,j), R=()=>P(i+1,j,i+1,j+1), Bm=()=>P(i,j+1,i+1,j+1), Lf=()=>P(i,j,i,j+1);
    // orientação: dentro à esquerda andando
    switch(s){
      case 1: add(Lf(),Bm()); break; case 2: add(Bm(),R()); break; case 3: add(Lf(),R()); break;
      case 4: add(R(),T()); break; case 5: add(Lf(),T()); add(R(),Bm()); break; case 6: add(Bm(),T()); break;
      case 7: add(Lf(),T()); break; case 8: add(T(),Lf()); break; case 9: add(T(),Bm()); break;
      case 10: add(T(),R()); add(Bm(),Lf()); break; case 11: add(T(),R()); break; case 12: add(R(),Lf()); break;
      case 13: add(R(),Bm()); break; case 14: add(Bm(),Lf()); break;
    }
  }
  const laços=[]; const usados=new Set();
  for(const [k0,s0] of segs){ if(usados.has(k0)) continue; const L=[]; let k=k0, s=s0;
    while(s && !usados.has(k)){ usados.add(k); L.push(s.p); k=key(s.q); s=segs.get(k); }
    laços.push(L); }
  laços.sort((a,b)=>b.length-a.length);
  const pol=[]; for(const [x,z] of laços[0]){ const q=[+x.toFixed(1),+z.toFixed(1)], u=pol[pol.length-1]; if(!u||Math.hypot(q[0]-u[0],q[1]-u[1])>0.3) pol.push(q); } // sem ponto repetido
  if(pol.length>1&&Math.hypot(pol[0][0]-pol[pol.length-1][0],pol[0][1]-pol[pol.length-1][1])<=0.3) pol.pop();
  return { pol, extras: laços.slice(1).map(l=>l.length) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const P = poligonos(), out = {};
  for (const id of IDS) if (id !== 'C') { if (P[id].extras.length) console.log('aviso: pedaços soltos em', id, P[id].extras); out[id] = P[id].pol; }
  const txt = `// GERADO por ferramentas/regioes/gerar.mjs (não edite à mão). Contorno de cada região da névoa ([x, z] em metros).\nexport const REGIOES_POLIGONOS = {\n${Object.entries(out).map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`).join('\n')}\n};\n`;
  fs.writeFileSync(new URL('../../shared/regioes.js', import.meta.url), txt);
  console.log('shared/regioes.js:', Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(', '));
}
