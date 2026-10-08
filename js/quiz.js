// A rodada: uma questão por tela, correção na hora, cronômetro e feedback do Quero.

import { api, el, formatarTempo, perguntar, avisar, som, confete, sorteia } from "./util.js";
import { mascote } from "./mascote.js";

// Resultado da última conclusão (traz as conquistas novas), lido pela tela de resultado.
export const sessao = { conclusao: null };

const ELOGIOS = ["Muito bem!", "Isso aí!", "Mandou bem!", "Perfeito!", "Arrasou!", "Na mosca!"];
const INCENTIVOS = ["Quase lá!", "Boa tentativa!", "Vamos guardar essa!", "Errar faz parte de aprender!"];

export async function telaQuiz(raiz, rodadaId, { revisao = false, estagio = "adulto" } = {}) {
  let dados;
  try {
    dados = await api(`/api/rodadas/${rodadaId}`);
  } catch {
    location.hash = "#/";
    return () => {};
  }
  if (dados.concluida && !revisao) { location.hash = `#/resultado/${rodadaId}`; return () => {}; }
  if (!dados.concluida && revisao) { location.hash = `#/rodada/${rodadaId}`; return () => {}; }

  const lista = revisao
    ? dados.questoes.filter((q) => dados.respondidas.normal[q.id] && !dados.respondidas.normal[q.id].correta)
    : dados.questoes;
  if (!lista.length) { location.hash = `#/resultado/${rodadaId}`; return () => {}; }
  const respondidas = revisao ? dados.respondidas.revisao : dados.respondidas.normal;

  // ---- relógio da rodada (pausa quando a tela fica escondida)
  let base = dados.duracao_s;
  let desde = performance.now();
  let pausado = false;
  const segundos = () => Math.floor(base + (pausado ? 0 : (performance.now() - desde) / 1000));
  const aoMudarVisibilidade = () => {
    if (document.hidden) { base += (performance.now() - desde) / 1000; pausado = true; }
    else { desde = performance.now(); pausado = false; }
  };
  document.addEventListener("visibilitychange", aoMudarVisibilidade);

  const relogio = el("span.relogio", { "aria-label": "Tempo da rodada" }, "⏱ ", el("span", formatarTempo(segundos())));
  let intervalo = null;
  if (!revisao) {
    intervalo = setInterval(() => { relogio.lastChild.textContent = formatarTempo(segundos()); }, 500);
  }
  const limpar = () => {
    clearInterval(intervalo);
    document.removeEventListener("visibilitychange", aoMudarVisibilidade);
  };

  let i = lista.findIndex((q) => !respondidas[q.id]);
  if (i < 0) i = lista.length;
  let sequencia = 0;
  for (let k = i - 1; k >= 0 && respondidas[lista[k].id]?.correta; k--) sequencia++;

  const barra = el("div.barra-preenchida");
  const topo = el("header.quiz-topo",
    el("button.icone-botao", { "aria-label": "Sair da rodada", onclick: sair }, "✕"),
    el("div.barra", { role: "progressbar" }, barra),
    revisao ? el("span.relogio", "Treino") : relogio,
  );
  const corpo = el("main.quiz-corpo");
  const rodape = el("footer.quiz-rodape");
  raiz.replaceChildren(el("div.quiz" + (revisao ? ".revisao" : ""), topo, corpo, rodape));

  async function sair() {
    const sim = await perguntar({
      titulo: "Sair da rodada?",
      texto: revisao ? "Você pode voltar ao treino quando quiser." : "Seu progresso fica salvo. Você continua de onde parou.",
      sim: "Sair", nao: "Ficar",
    });
    if (sim) { limpar(); location.hash = revisao ? `#/resultado/${rodadaId}` : "#/"; }
  }

  function atualizarBarra() {
    const feitas = lista.filter((q) => respondidas[q.id]).length;
    barra.style.width = `${(feitas / lista.length) * 100}%`;
    topo.querySelector(".barra").setAttribute("aria-valuenow", String(feitas));
  }

  async function terminar() {
    limpar();
    if (revisao) { location.hash = `#/resultado/${rodadaId}`; return; }
    try {
      sessao.conclusao = await api(`/api/rodadas/${rodadaId}/concluir`, { json: { duracao_s: segundos() } });
      location.hash = `#/resultado/${rodadaId}`;
    } catch (e) {
      avisar(e.message, "erro");
      location.hash = "#/";
    }
  }

  function mostrarQuestao() {
    atualizarBarra();
    if (i >= lista.length) { terminar(); return; }
    const q = lista[i];
    corpo.replaceChildren();
    rodape.replaceChildren();
    rodape.className = "quiz-rodape";
    corpo.scrollTo?.(0, 0);

    corpo.append(
      el("div.chip", q.topico),
      el("h1.enunciado", q.enunciado),
    );

    let valor = null;           // resposta escolhida
    let trancado = false;
    const verificar = el("button.botao.grande", { disabled: true, onclick: enviar }, "Verificar");
    rodape.append(verificar);
    const opcoesEl = [];

    const escolher = (v, botao) => {
      if (trancado) return;
      valor = v;
      opcoesEl.forEach((b) => { b.classList.toggle("escolhida", b === botao); b.setAttribute("aria-pressed", String(b === botao)); });
      verificar.disabled = false;
    };

    if (q.tipo === "lacuna") {
      const campo = el("input.campo", {
        type: "text", placeholder: "Digite sua resposta", autocomplete: "off", autocapitalize: "off",
        autocorrect: "off", spellcheck: false, enterKeyHint: "done", "aria-label": "Sua resposta",
        oninput: () => { valor = campo.value; verificar.disabled = !campo.value.trim(); },
        onkeydown: (e) => { if (e.key === "Enter" && campo.value.trim()) { e.preventDefault(); enviar(); } },
      });
      opcoesEl.push(campo);
      corpo.append(campo);
      setTimeout(() => campo.focus({ preventScroll: true }), 150);
    } else {
      const grade = el("div.opcoes" + (q.tipo === "vf" ? ".vf" : ""));
      q.opcoes.forEach((texto, k) => {
        const b = el("button.opcao", {
          "aria-pressed": "false",
          onclick: () => escolher(texto, b),
        }, el("span.opcao-marca", q.tipo === "vf" ? (texto === "Verdadeiro" ? "V" : "F") : String.fromCharCode(65 + k)),
          el("span.opcao-texto", texto));
        opcoesEl.push(b);
        grade.append(b);
      });
      corpo.append(grade);
    }

    async function enviar() {
      if (trancado || valor === null || !String(valor).trim()) return;
      trancado = true;
      verificar.disabled = true;
      try {
        const r = await api(`/api/rodadas/${rodadaId}/respostas`, {
          json: { questao_id: q.id, resposta: String(valor), revisao, duracao_s: revisao ? null : segundos() },
        });
        respondidas[q.id] = r;
        mostrarFeedback(q, r, opcoesEl);
      } catch (e) {
        trancado = false;
        verificar.disabled = false;
        avisar(e.message, "erro");
      }
    }
  }

  function mostrarFeedback(q, r, opcoesEl) {
    atualizarBarra();
    const certa = r.correta;
    sequencia = certa ? sequencia + 1 : 0;
    // marca as alternativas
    opcoesEl.forEach((b) => {
      if (b.tagName === "INPUT") { b.disabled = true; b.classList.add(certa ? "certa" : "errada"); return; }
      const texto = b.querySelector(".opcao-texto").textContent;
      b.disabled = true;
      if (texto === r.gabarito) b.classList.add("certa");
      else if (b.classList.contains("escolhida")) b.classList.add("errada");
    });

    if (certa) { sequencia === 3 || sequencia === 5 || sequencia === 8 ? som.combo() : som.acerto(); }
    else som.erro();

    const titulo = certa ? sorteia(ELOGIOS) : sorteia(INCENTIVOS);
    const ultimo = i === lista.length - 1;
    const botao = el("button.botao.grande" + (certa ? "" : ".laranja"), { onclick: () => { i++; mostrarQuestao(); } },
      ultimo ? (revisao ? "Concluir treino" : "Ver resultado") : "Continuar");

    rodape.className = "quiz-rodape feedback " + (certa ? "ok" : "erro");
    rodape.replaceChildren(
      el("div.feedback-topo",
        el("div.feedback-mascote", mascote(estagio, certa ? (sequencia >= 3 ? "animado" : "feliz") : "incentivo")),
        el("div.feedback-texto",
          el("strong.feedback-titulo", titulo),
          certa && sequencia >= 3 ? el("span.combo", `🔥 ${sequencia} seguidas`) : null,
          !certa ? el("div.certa-era", "Resposta certa: ", el("b", r.gabarito)) : null,
          certa && r.aviso === "acento" ? el("div.certa-era", "Atenção ao acento: ", el("b", r.gabarito)) : null,
        ),
      ),
      el("p.explicacao", r.explicacao),
      r.pagina ? el("p.pagina-resumo", `📖 Está na página ${r.pagina} do seu resumo`) : null,
      botao,
    );
    if (certa) confete(rodape.querySelector(".feedback-mascote"), sequencia >= 3 ? 14 : 6);
    botao.focus({ preventScroll: true });
  }

  mostrarQuestao();
  return limpar;
}
