// Símbolos das habilidades (SVG 24x24, só traço). O mesmo símbolo aparece no botão e na aba Habilidades.
// Vários vêm do jogo de hábitos (New-Game-Anime), para os dois jogos falarem a mesma língua.
const F = 'fill="#fff" fill-opacity=".25"';
const ICO = {
  basico: '<path d="M20 4L9.5 14.5M20 4h-4.5M20 4v4.5"/><path d="M6.5 11.5l6 6M9.5 14.5L4 20"/>',
  magia: `<circle cx="12" cy="12" r="4.2" ${F}/><circle cx="12" cy="12" r="8" stroke-dasharray="2.5 3"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>`,
  cura: `<path d="M12 20.5s-8-4.8-8-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8 2.5c0 5.6-8 10.4-8 10.4z" ${F}/><path d="M12 10v6M9 13h6"/>`,
  troca: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
  // movimento (como os do Quimera)
  pular: `<path d="M12 20V7M6.5 12L12 6.5l5.5 5.5" stroke-width="2.6"/><path d="M8 3h8"/>`,
  dash: '<path d="M10 12h11M16.5 7.5L21 12l-4.5 4.5" stroke-width="2.6"/><path d="M3 8h5M2 12h5M3 16h5"/>',
  rolar: `<circle cx="12" cy="12" r="3.2" ${F}/><path d="M19.5 9.5A8 8 0 1 0 20 14"/><path d="M20.5 5v4.5H16"/>`,
  // espada
  relampago: `<path d="M13.5 2L5 13.5h6L9.5 22 19 9.5h-6.2L13.5 2z" ${F}/>`,
  giro: '<path d="M19.5 13a7.5 7.5 0 1 1-2.6-7.3"/><path d="M17 2.5V6h3.5"/><path d="M12 12l5-5M10 10l4 4"/>',
  salto: '<path d="M12 2v12M9 5.5h6M12 14l-1.5 3h3z"/><path d="M3 21h18M6 18.5l-2.5-2M18 18.5l2.5-2M12 20v-1"/>',
  investida: '<path d="M21 5l-8.5 8.5M21 5h-3.5M21 5v3.5M10 11l3.5 3.5M11.8 12.8L8 16.6"/><path d="M2 9h6M3 13h4M2 17h3.5"/>',
  furia: '<path d="M4 4l10.5 10.5M4 4h3.5M4 4v3.5M12.5 17.5l5-5M15 15l4 4"/><path d="M20 4L9.5 14.5M20 4h-3.5M20 4v3.5M11.5 17.5l-5-5M9 15l-4 4"/>',
  corte: '<path d="M4 18c4-9 10-13 17-13"/><path d="M3 13.5c3-5.5 7.5-8.5 13-9"/><path d="M8 21l3-3M5 20l1.5-1.5"/>',
  fenda: '<path d="M12 2v8M9.5 4.5h5M12 10l-1 2h2z"/><path d="M3 21l4-3 2 2 3-4 2 3 3-2 4 4"/><path d="M12 14v2"/>',
  // magia
  bola: `<circle cx="15" cy="9" r="4.5" ${F}/><path d="M11.5 12.5L4 20M10 9.5l-6.5 4M14.5 13.5L11 20"/>`,
  explosao: `<path d="M12 2.5l1.9 5.2 5.1-2.3-2.3 5.1 5.2 1.9-5.2 1.9 2.3 5.1-5.1-2.3-1.9 5.2-1.9-5.2-5.1 2.3 2.3-5.1L2.5 12.4l5.2-1.9-2.3-5.1 5.1 2.3z" ${F}/>`,
  onda: '<path d="M2 7.5c2.5-3.5 5-3.5 7.5 0s5 3.5 7.5 0 3.5-2 5-2"/><path d="M2 12.5c2.5-3.5 5-3.5 7.5 0s5 3.5 7.5 0 3.5-2 5-2"/><path d="M2 17.5c2.5-3.5 5-3.5 7.5 0s5 3.5 7.5 0 3.5-2 5-2"/>',
  chamas: `<ellipse cx="12" cy="19" rx="9" ry="2.5"/><path d="M12 17c-3 0-4.5-2-4.5-4.5 0-3 3-4.5 2.5-8 2.5 1.5 4 3.5 4 5.5 1-.5 1.5-1.5 1.5-2.5 1.5 1.5 1 3 1 5S15 17 12 17z" ${F}/>`,
  meteoros: `<circle cx="7" cy="17" r="3" ${F}/><circle cx="17" cy="15" r="2.2" ${F}/><path d="M9.2 14.8L16 4M18.6 13.4L22 7M5 14.5L9 6"/>`,
  barreira: `<path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" ${F}/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  lanca: '<path d="M21 3l-5 2 3 3zM16 5L3 18"/><path d="M5.5 15.5l3 3M3 18l3 3"/><path d="M13 3.5l1 2M19.5 9l2 1"/>',
  raio: `<path d="M5 9a5 5 0 0 1 9-3 4 4 0 1 1 3 7H6.5A3.5 3.5 0 0 1 5 9z"/><path d="M12 13l-2.5 4.5h3L11 22" ${F}/>`,
  rajada: `<circle cx="17" cy="6" r="2.5" ${F}/><circle cx="18" cy="13" r="2.5" ${F}/><circle cx="14.5" cy="19.5" r="2.5" ${F}/><path d="M14.7 7L4 11M15.5 13L4 12.5M12.5 18L4 14"/>`,
  vortice: '<path d="M12 12a2 2 0 1 0 2 2 4 4 0 1 0-4-4 6 6 0 1 0 6 6 8 8 0 1 0-8-8"/>',
};
export const icone = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICO[k] || ICO.basico}</svg>`;
