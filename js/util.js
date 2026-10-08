// Utilidades compartilhadas: criação de elementos, sons, confete e avisos.

// As chamadas /api/... são atendidas no próprio navegador (ver api.js).
export { api } from "./api.js";

// el("button.grande", {onclick: f}, "texto", outroEl) -> HTMLElement
export function el(seletor, props, ...filhos) {
  const [tag, ...classes] = seletor.split(".");
  const no = document.createElement(tag || "div");
  if (classes.length) no.className = classes.join(" ");
  if (props !== undefined && props !== null && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    filhos.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) no.addEventListener(k.slice(2), v);
    else if (k === "html") no.innerHTML = v;
    else if (k === "style" && typeof v === "object") {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.includes("-")) no.style.setProperty(prop, val); // variáveis CSS (--cor) e nomes com hífen
        else no.style[prop] = val;
      }
    } else if (k in no && k !== "list") no[k] = v;
    else no.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat(Infinity)) {
    if (f === null || f === undefined || f === false) continue;
    no.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return no;
}

export function svg(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

export const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];

export function formatarNota(n) {
  return n === null || n === undefined ? "–" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatarTempo(segundos) {
  const s = Math.max(0, Math.floor(segundos || 0));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatarData(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const reduzirMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Preferências do aparelho (só conveniência; nada importante fica aqui)

export const prefs = {
  get(chave, padrao) {
    try { const v = localStorage.getItem("sa_" + chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
  },
  set(chave, valor) {
    try { localStorage.setItem("sa_" + chave, JSON.stringify(valor)); } catch { /* sem storage */ }
  },
};

// ---------- Sons curtos gerados na hora (sem arquivos de áudio)
// O Safari do iPhone só libera o áudio depois de um toque: destravamos no primeiro toque na tela.

let audioCtx = null;
function contexto() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function destravarAudio() {
  try {
    const ctx = contexto();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050); // toque mudo: "acorda" o áudio no iOS
    const fonte = ctx.createBufferSource();
    fonte.buffer = buf;
    fonte.connect(ctx.destination);
    fonte.start(0);
  } catch { /* sem áudio */ }
}
for (const evento of ["pointerdown", "touchend", "keydown"]) {
  window.addEventListener(evento, destravarAudio, { once: false, passive: true });
}

function tocar(notas) {
  if (!prefs.get("som", true)) return;
  try {
    const ctx = contexto();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, dur] of notas) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, t);
      ganho.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
      t += dur * 0.8;
    }
  } catch { /* sem áudio */ }
}

export const som = {
  acerto: () => tocar([[660, 0.12], [880, 0.2]]),
  erro: () => tocar([[330, 0.16], [262, 0.28]]),
  combo: () => tocar([[660, 0.1], [784, 0.1], [988, 0.1], [1319, 0.25]]),
  trofeu: () => tocar([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.12], [1319, 0.4]]),
  fim: () => tocar([[523, 0.14], [659, 0.2]]),
};

// ---------- Janela de confirmação amigável (em vez de confirm())

export function perguntar({ titulo, texto, sim = "Sim", nao = "Cancelar", perigo = false }) {
  return new Promise((resolver) => {
    const fechar = (valor) => { fundo.remove(); resolver(valor); };
    const fundo = el("div.modal-fundo", { onclick: (e) => { if (e.target === fundo) fechar(false); } },
      el("div.modal", { role: "dialog", "aria-modal": "true" },
        el("h2", titulo),
        texto ? el("p", texto) : null,
        el("div.modal-botoes",
          el("button.botao.secundario", { onclick: () => fechar(false) }, nao),
          el("button.botao" + (perigo ? ".perigo" : ""), { onclick: () => fechar(true) }, sim),
        ),
      ),
    );
    document.body.append(fundo);
  });
}

export function avisar(texto, tipo = "info") {
  const t = el("div.toast." + tipo, { role: "status" }, texto);
  document.body.append(t);
  setTimeout(() => t.classList.add("saindo"), 2600);
  setTimeout(() => t.remove(), 3200);
}

// ---------- Confete leve (respeita "reduzir movimento" do sistema)

export function confete(origem, quantidade = 24) {
  if (reduzirMovimento()) return;
  const r = origem ? origem.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
  const cores = ["#FFC800", "#1CB0F6", "#58CC02", "#FF9600", "#CE82FF", "#FF4B4B"];
  for (let i = 0; i < quantidade; i++) {
    const p = el("span.confete", { style: {
      left: r.left + r.width / 2 + "px", top: r.top + r.height / 2 + "px", background: sorteia(cores),
      "--dx": (Math.random() * 2 - 1) * 170 + "px", "--dy": -(80 + Math.random() * 170) + "px",
      "--rot": Math.random() * 720 + "deg",
    } });
    document.body.append(p);
    setTimeout(() => p.remove(), 1200);
  }
}
