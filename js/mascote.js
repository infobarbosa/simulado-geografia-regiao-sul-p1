// O Quero: um quero-quero (ave símbolo do Sul) desenhado em SVG.
// mascote(estagio, humor) -> elemento <svg>. Estágios: ovo, filhote, adulto, mestre.
// Humores: feliz, animado, pensando, incentivo, comemora.

import { svg } from "./util.js";

const COR = {
  costas: "#9C8570", costasEscura: "#7D6A58", barriga: "#FFFFFF", boneco: "#2B2D3A",
  bico: "#FF8A3D", bicoPonta: "#2B2D3A", perna: "#E5484D", bochecha: "#FFB3B3",
  casca: "#FFF3D6", cascaSombra: "#EBD9AE", ouro: "#FFC800", ouroEscuro: "#E0A800", capa: "#CE82FF",
};

function olhos(humor) {
  const aberto = (cx) => `
    <ellipse cx="${cx}" cy="74" rx="9" ry="10.5" fill="#fff" stroke="${COR.boneco}" stroke-width="2"/>
    <circle cx="${cx + (humor === "pensando" ? 3 : 0)}" cy="${humor === "pensando" ? 71 : 75}" r="5.5" fill="${COR.boneco}"/>
    <circle cx="${cx + 2 + (humor === "pensando" ? 3 : 0)}" cy="${humor === "pensando" ? 68.5 : 72.5}" r="2" fill="#fff"/>`;
  if (humor === "comemora") {
    return `<path d="M72 76q8-12 16 0" stroke="${COR.boneco}" stroke-width="4" fill="none" stroke-linecap="round"/>
            <path d="M112 76q8-12 16 0" stroke="${COR.boneco}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  }
  let sobrancelhas = "";
  if (humor === "incentivo") {
    sobrancelhas = `<path d="M70 58l16 -4" stroke="${COR.boneco}" stroke-width="3.5" stroke-linecap="round"/>
                    <path d="M130 58l-16 -4" stroke="${COR.boneco}" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (humor === "pensando") {
    sobrancelhas = `<path d="M112 56l18 -5" stroke="${COR.boneco}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
  return aberto(80) + aberto(120) + sobrancelhas;
}

function bico(humor) {
  const aberta = humor === "animado" || humor === "comemora";
  if (aberta) {
    return `<path d="M88 88 L112 88 L100 112 Z" fill="${COR.bico}" stroke="${COR.boneco}" stroke-width="2" stroke-linejoin="round"/>
            <path d="M92 94 L108 94 L100 106 Z" fill="#B3262B"/>`;
  }
  if (humor === "incentivo") {
    return `<path d="M90 90 L110 90 L100 104 Z" fill="${COR.bico}" stroke="${COR.boneco}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return `<path d="M90 89 L110 89 L100 105 Z" fill="${COR.bico}" stroke="${COR.boneco}" stroke-width="2" stroke-linejoin="round"/>
          <path d="M94 97q6 5 12 0" stroke="${COR.boneco}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}

function asas(humor) {
  const lado = (x, rot, sinal) =>
    `<ellipse cx="${x}" cy="130" rx="15" ry="30" fill="${COR.costasEscura}" stroke="${COR.boneco}" stroke-width="2.5"
       transform="rotate(${rot} ${x} 130)" class="asa"/>`;
  if (humor === "comemora") return lado(48, 150) + lado(152, -150);
  if (humor === "pensando") return lado(48, 12) + `<ellipse cx="108" cy="118" rx="13" ry="22" fill="${COR.costasEscura}" stroke="${COR.boneco}" stroke-width="2.5" transform="rotate(-50 108 118)"/>`;
  return lado(48, 12) + lado(152, -12);
}

function pernas() {
  const pe = (x) => `<path d="M${x} 170 V188" stroke="${COR.perna}" stroke-width="5" stroke-linecap="round"/>
    <path d="M${x - 9} 192 L${x} 186 L${x + 9} 192" stroke="${COR.perna}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  return pe(82) + pe(118);
}

function topete(estagio) {
  if (estagio === "filhote" || estagio === "ovo") {
    return `<path d="M96 36q-8-14 2-20q2 10 8 14z" fill="${COR.boneco}"/>`;
  }
  return `<path d="M104 38 Q112 12 142 8 Q124 22 118 40 Z" fill="${COR.boneco}"/>
          <path d="M100 38 Q98 14 84 6 Q92 24 94 40 Z" fill="${COR.boneco}"/>`;
}

function enfeite(estagio) {
  if (estagio === "mestre") {
    return `<path d="M76 40 L82 22 L92 34 L100 16 L108 34 L118 22 L124 40 Z" fill="${COR.ouro}" stroke="${COR.ouroEscuro}" stroke-width="2.5" stroke-linejoin="round"/>
            <circle cx="100" cy="30" r="3" fill="#E5484D"/>`;
  }
  return "";
}

function capa(estagio) {
  if (estagio !== "mestre") return "";
  return `<path d="M58 100 Q40 160 56 176 L144 176 Q160 160 142 100 Q100 122 58 100 Z" fill="${COR.capa}" stroke="${COR.boneco}" stroke-width="2.5"/>`;
}

function casca(estagio) {
  if (estagio !== "ovo") return "";
  return `<path d="M44 128 L58 116 L70 130 L84 114 L100 132 L116 114 L130 130 L142 116 L156 128 Q166 168 100 186 Q34 168 44 128 Z"
            fill="${COR.casca}" stroke="${COR.cascaSombra}" stroke-width="3" stroke-linejoin="round"/>`;
}

export function mascote(estagio = "adulto", humor = "feliz") {
  const escala = { ovo: 0.78, filhote: 0.84, adulto: 1, mestre: 1 }[estagio] ?? 1;
  const semPernas = estagio === "ovo";
  const corpo = semPernas ? "" : pernas();
  const ovo = estagio === "ovo";
  const barriga = ovo ? "" : `
    <ellipse cx="100" cy="128" rx="46" ry="46" fill="${COR.costas}" stroke="${COR.boneco}" stroke-width="2.5"/>
    <ellipse cx="100" cy="140" rx="31" ry="32" fill="${COR.barriga}"/>
    <path d="M78 112 Q100 128 122 112 Q118 126 100 128 Q82 126 78 112 Z" fill="${COR.boneco}"/>`;
  const cabeca = `
    <circle cx="100" cy="72" r="38" fill="#fff" stroke="${COR.boneco}" stroke-width="2.5"/>
    <path d="M62 66 Q66 34 100 32 Q134 34 138 66 Q120 52 100 52 Q80 52 62 66 Z" fill="${COR.boneco}"/>
    <ellipse cx="68" cy="88" rx="7" ry="5" fill="${COR.bochecha}" opacity=".7"/>
    <ellipse cx="132" cy="88" rx="7" ry="5" fill="${COR.bochecha}" opacity=".7"/>
    ${topete(estagio)}${olhos(humor)}${bico(humor)}${enfeite(estagio)}`;
  const f = escala;
  return svg(`
    <svg class="mascote mascote-${humor} estagio-${estagio}" viewBox="0 0 200 200" role="img"
         aria-label="Quero, o quero-quero mascote" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="194" rx="46" ry="5" fill="#000" opacity=".1"/>
      <g class="mascote-corpo" transform="translate(${100 - 100 * f} ${196 - 196 * f}) scale(${f})">
        ${capa(estagio)}${corpo}${ovo ? "" : asas(humor)}${barriga}${cabeca}${casca(estagio)}
      </g>
    </svg>`);
}

export function trofeuSvg(nota) {
  const perfeito = nota >= 10;
  return svg(`
    <svg class="trofeu-svg" viewBox="0 0 120 130" role="img" aria-label="Troféu" xmlns="http://www.w3.org/2000/svg">
      <path d="M30 22 H90 V52 Q90 80 60 84 Q30 80 30 52 Z" fill="${COR.ouro}" stroke="${COR.ouroEscuro}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M30 30 H14 Q12 56 34 62" fill="none" stroke="${COR.ouroEscuro}" stroke-width="5" stroke-linecap="round"/>
      <path d="M90 30 H106 Q108 56 86 62" fill="none" stroke="${COR.ouroEscuro}" stroke-width="5" stroke-linecap="round"/>
      <rect x="52" y="84" width="16" height="16" fill="${COR.ouroEscuro}"/>
      <rect x="34" y="100" width="52" height="14" rx="5" fill="${COR.ouro}" stroke="${COR.ouroEscuro}" stroke-width="4"/>
      <path d="M44 32 Q42 52 52 66" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".6"/>
      <path d="M60 36 l5.5 11 12 1.8 -8.7 8.5 2 12 -10.8 -5.7 -10.8 5.7 2 -12 -8.7 -8.5 12 -1.8 Z" fill="${perfeito ? "#fff" : COR.ouroEscuro}" opacity="${perfeito ? 1 : 0.55}"/>
    </svg>`);
}
