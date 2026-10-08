// Roteador (hash) e telas: boas-vindas, início, resultado, troféus, conquistas e ajustes.

import { api, el, formatarNota, formatarTempo, formatarData, avisar, som, confete, prefs, perguntar } from "./util.js";
import { nomeSalvo, salvarNome, exportarProgresso, importarProgresso, recomecar } from "./api.js";
import { mascote, trofeuSvg } from "./mascote.js";
import { telaQuiz, sessao } from "./quiz.js";

let NOME = ""; // perguntado na primeira visita e guardado no aparelho
const raiz = document.getElementById("app");
let limpezaAtual = () => {};
let estagioAtual = "adulto"; // estágio do Quero, atualizado a cada /api/estado

const xpParaNivel = (n) => 50 * (n - 1) * n; // mesma regra do servidor (progresso.py)
const nivelPorXp = (xp) => { let n = 1; while (xp >= xpParaNivel(n + 1)) n++; return n; };
const ESTAGIO_DESDE = [[1, "Quero Ovinho"], [2, "Quero Filhote"], [4, "Quero"], [7, "Quero Mestre"]]; // igual a progresso.ESTAGIOS
const estagioDoNivel = (n) => ESTAGIO_DESDE.filter(([min]) => n >= min).pop()[1];

// ---------------------------------------------------------------- navegação

async function rotear() {
  limpezaAtual();
  limpezaAtual = () => {};
  const [rota = "", arg] = location.hash.replace(/^#\/?/, "").split("/");
  window.scrollTo(0, 0);
  try {
    NOME = await nomeSalvo();
    if (!NOME && rota !== "ajustes") return telaBoasVindas();
    if (rota === "rodada") limpezaAtual = (await telaQuiz(raiz, Number(arg), { estagio: await estagio() })) || (() => {});
    else if (rota === "revisao") limpezaAtual = (await telaQuiz(raiz, Number(arg), { revisao: true, estagio: await estagio() })) || (() => {});
    else if (rota === "resultado") await telaResultado(Number(arg));
    else if (rota === "trofeus") await telaTrofeus();
    else if (rota === "conquistas") await telaConquistas();
    else if (rota === "ajustes") await telaAjustes();
    else await telaInicio();
  } catch (e) {
    raiz.replaceChildren(el("div.tela-centro",
      mascote("adulto", "incentivo"),
      el("h1", "Ops, algo deu errado"),
      el("p", e.message || "Algo não carregou. Confira a internet e tente de novo."),
      el("button.botao", { onclick: () => location.reload() }, "Tentar de novo"),
    ));
  }
}

async function estagio() {
  try { estagioAtual = (await api("/api/estado")).estagio.chave; } catch { /* mantém o último */ }
  return estagioAtual;
}

function abas(ativa) {
  const item = (id, icone, rotulo, destino) =>
    el("a.aba" + (ativa === id ? ".ativa" : ""), { href: destino, "aria-current": ativa === id ? "page" : null },
      el("span.aba-icone", icone), el("span", rotulo));
  return el("nav.abas", item("inicio", "🏠", "Início", "#/"), item("trofeus", "🏆", "Troféus", "#/trofeus"),
    item("conquistas", "🎖️", "Conquistas", "#/conquistas"));
}

function moldura(ativa, ...conteudo) {
  raiz.replaceChildren(el("div.app-com-abas", el("div.tela", ...conteudo), abas(ativa)));
}

// ---------------------------------------------------------------- início

function fraseDoQuero(e) {
  if (e.rodadas === 0) return [`Oi, ${NOME}! Eu sou o Quero. Bora revisar a Região Sul?`, "feliz"];
  if (e.rodada_aberta) return ["Vamos terminar de onde paramos?", "feliz"];
  if (e.sequencia_dias >= 2) return [`🔥 ${e.sequencia_dias} dias seguidos! Não deixa a sequência acabar!`, "animado"];
  if (e.ultima_rodada && e.ultima_rodada.nota >= e.nota_trofeu) return ["Que arraso na última rodada! Bora de novo?", "animado"];
  if (e.ultima_rodada) return [`Vamos buscar o troféu? Basta ${formatarNota(e.nota_trofeu)} ou mais!`, "feliz"];
  return ["Bora estudar?", "feliz"];
}

async function telaInicio() {
  const e = await api("/api/estado");
  estagioAtual = e.estagio.chave;
  const [frase, humor] = fraseDoQuero(e);
  const pct = Math.round((e.xp_no_nivel / e.xp_do_nivel) * 100);
  const abertaPct = e.rodada_aberta ? e.rodada_aberta.feitas : 0;
  // "Geografia — Revisão P1: Região Sul" -> sobre "Geografia · Revisão P1", assunto "Região Sul"
  const [disciplina, resto = ""] = e.titulo.split("—").map((x) => x.trim());
  const [prova, assunto = e.titulo] = resto.split(":").map((x) => x.trim());
  const sobre = prova ? `${disciplina} · ${prova}` : disciplina;

  const comecar = async (descartar) => {
    try {
      const r = await api("/api/rodadas", { json: { descartar } });
      location.hash = `#/rodada/${r.id}`;
    } catch (err) { avisar(err.message, "erro"); }
  };

  moldura("inicio",
    e.armazenamento_ok ? null : el("div.destaque", "⚠️ Este navegador não está guardando seu progresso (modo privado?). Abra o app numa aba normal."),
    el("div.chips-topo",
      el("span.chip-stat" + (e.sequencia_dias ? ".fogo" : ""), { title: "Dias seguidos" }, "🔥 ", el("b", e.sequencia_dias)),
      el("span.chip-stat.xp", { title: "XP total" }, "⭐ ", el("b", e.xp)),
      el("a.chip-stat.trofeu", { href: "#/trofeus", title: "Troféus" }, "🏆 ", el("b", e.trofeus)),
    ),
    el("section.heroi",
      el("div.balao", frase),
      el("div.heroi-mascote", mascote(e.estagio.chave, humor)),
      el("div.heroi-nome", e.estagio.nome, el("span", ` · Nível ${e.nivel}`)),
      el("div.barra.xp", { role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 },
        el("div.barra-preenchida", { style: { width: pct + "%" } })),
      el("div.xp-legenda", `${e.xp_no_nivel} / ${e.xp_do_nivel} XP para o nível ${e.nivel + 1}`),
    ),
    el("section.cartao.acao",
      el("div.cartao-sobre", sobre),
      el("h2", assunto),
      el("p.mini", `${e.tamanho_rodada} questões sorteadas na hora. Nota ${formatarNota(e.nota_trofeu)} ou mais vale troféu! 🏆`),
      e.rodada_aberta
        ? [
          el("button.botao.grande", { onclick: () => comecar(false) }, `Continuar rodada (${abertaPct}/${e.rodada_aberta.total})`),
          el("button.botao.secundario", { onclick: () => comecar(true) }, "Começar uma nova"),
        ]
        : el("button.botao.grande", { onclick: () => comecar(false) }, e.rodadas === 0 ? "Começar" : "Nova rodada"),
    ),
    el("section.cartao.faixa",
      el("div.faixa-item", el("b", `${e.banco.vistas}/${e.banco.total}`), el("span", "questões já vistas")),
      el("div.faixa-item", el("b", e.melhor_nota === null ? "–" : formatarNota(e.melhor_nota)), el("span", "melhor nota")),
      el("div.faixa-item", el("b", e.rodadas), el("span", "rodadas feitas")),
    ),
    el("footer.rodape-pais",
      el("button.link", {
        onclick: () => { prefs.set("som", !prefs.get("som", true)); avisar(prefs.get("som", true) ? "Som ligado 🔊" : "Som desligado 🔇"); telaInicio(); },
      }, prefs.get("som", true) ? "🔊 Som ligado" : "🔇 Som desligado"),
      el("a.link", { href: "#/ajustes" }, "⚙️ Ajustes"),
    ),
  );
}

// ---------------------------------------------------------------- resultado

async function telaResultado(id) {
  const [d, e] = await Promise.all([api(`/api/rodadas/${id}`), api("/api/estado")]);
  if (!d.concluida) { location.hash = `#/rodada/${id}`; return; }
  estagioAtual = e.estagio.chave;
  const fresco = sessao.conclusao && sessao.conclusao.id === id ? sessao.conclusao : null;
  sessao.conclusao = null;

  const trofeu = d.trofeu;
  const acertos = d.pontos, total = d.total;
  const erradas = d.questoes.filter((q) => d.respondidas.normal[q.id] && !d.respondidas.normal[q.id].correta);
  const faltaram = Math.max(0, Math.ceil((e.nota_trofeu / 10) * total) - acertos);
  const humor = trofeu ? "comemora" : d.nota >= 7 ? "feliz" : "incentivo";

  const nivelDepois = e.nivel;
  const nivelAntes = nivelPorXp(Math.max(0, e.xp - (d.xp || 0)));
  const subiu = fresco && nivelDepois > nivelAntes;

  const porTopico = {};
  for (const q of erradas) {
    const t = (porTopico[q.topico] ||= { n: 0, paginas: new Set() });
    t.n++;
    const p = d.respondidas.normal[q.id].pagina;
    if (p) t.paginas.add(p);
  }

  const treino = d.questoes.filter((q) => d.respondidas.normal[q.id] && !d.respondidas.normal[q.id].correta);
  const treinoFeitas = treino.filter((q) => d.respondidas.revisao[q.id]).length;

  moldura("inicio",
    el("section.resultado" + (trofeu ? ".com-trofeu" : ""),
      trofeu ? el("div.trofeu-grande", trofeuSvg(d.nota)) : el("div.heroi-mascote.medio", mascote(e.estagio.chave, humor)),
      el("h1", trofeu ? "Troféu conquistado!" : d.nota >= 7 ? "Muito bom!" : "Rodada concluída!"),
      el("div.nota-grande" + (trofeu ? ".ouro" : ""), formatarNota(d.nota)),
      !trofeu ? el("p.mini", faltaram === 1 ? "Faltou só 1 acerto para o troféu!" : `Faltaram ${faltaram} acertos para o troféu. Na próxima você consegue!`) : null,
      trofeu ? el("div.balao.pequeno", `Parabéns, ${NOME}! Você mandou muito bem!`) : null,
      el("div.faixa",
        el("div.faixa-item", el("b", `${acertos}/${total}`), el("span", "acertos")),
        el("div.faixa-item", el("b", formatarTempo(d.duracao_s)), el("span", "tempo")),
        el("div.faixa-item", el("b", `+${d.xp}`), el("span", "XP")),
      ),
      subiu ? el("div.destaque", `⭐ Subiu para o nível ${nivelDepois}!` + (estagioDoNivel(nivelDepois) !== estagioDoNivel(nivelAntes) ? ` Seu Quero evoluiu: agora é o ${e.estagio.nome}!` : "")) : null,
      ...(fresco?.conquistas_novas || []).map((c) =>
        el("div.destaque.nova-conquista", "🎖️ Conquista desbloqueada: ", el("b", c.nome), el("small", c.descricao))),
      erradas.length
        ? el("section.cartao.revisar",
          el("h3", "Para rever no resumo"),
          el("ul", Object.entries(porTopico).sort((a, b) => b[1].n - a[1].n).map(([topico, t]) =>
            el("li", el("b", topico), ` · ${t.n} ${t.n === 1 ? "erro" : "erros"}`,
              t.paginas.size ? el("span.pg", ` (página ${[...t.paginas].sort().join(", ")})`) : null))))
        : el("p.mini", "Gabaritou! Nenhuma questão para revisar. 🎉"),
      el("div.acoes",
        erradas.length
          ? el("a.botao.grande", { href: `#/revisao/${id}` },
            treinoFeitas ? `Treinar as que errei (${treinoFeitas}/${erradas.length})` : `Treinar as que errei (${erradas.length})`)
          : null,
        el("button.botao" + (erradas.length ? ".secundario" : ".grande"), {
          onclick: async () => {
            try { const r = await api("/api/rodadas", { json: {} }); location.hash = `#/rodada/${r.id}`; }
            catch (err) { avisar(err.message, "erro"); }
          },
        }, "Nova rodada"),
        el("a.botao.texto", { href: "#/" }, "Voltar ao início"),
      ),
    ),
  );
  if (fresco) {
    if (trofeu) { som.trofeu(); setTimeout(() => confete(document.querySelector(".trofeu-grande"), 36), 250); }
    else som.fim();
  }
}

// ---------------------------------------------------------------- troféus e conquistas

async function telaTrofeus() {
  const [lista, e] = await Promise.all([api("/api/trofeus"), api("/api/estado")]);
  moldura("trofeus",
    el("h1.titulo-tela", "Estante de troféus"),
    el("p.mini.centro", `Cada rodada com nota ${formatarNota(e.nota_trofeu)} ou mais vale um troféu.`),
    lista.length
      ? el("div.estante", lista.map((t) => el("div.prateleira-item",
        el("div.trofeu-mini", trofeuSvg(t.nota)),
        el("b", formatarNota(t.nota)),
        el("small", formatarData(t.obtido_em).slice(0, 5)),
        t.duracao_s ? el("small", "⏱ " + formatarTempo(t.duracao_s)) : null)))
      : el("div.vazio", el("div.heroi-mascote.medio", mascote(e.estagio.chave, "feliz")),
        el("p", "Sua estante está vazia por enquanto."), el("p.mini", "Tire 9 ou mais em uma rodada para ganhar o primeiro troféu!")),
  );
}

async function telaConquistas() {
  const e = await api("/api/estado");
  const ganhas = e.conquistas.filter((c) => c.obtida_em).length;
  moldura("conquistas",
    el("h1.titulo-tela", "Conquistas"),
    el("p.mini.centro", `${ganhas} de ${e.conquistas.length} desbloqueadas`),
    el("div.conquistas", e.conquistas.map((c) =>
      el("div.conquista" + (c.obtida_em ? ".ganha" : ""),
        el("div.conquista-selo", c.obtida_em ? "🎖️" : "🔒"),
        el("div", el("b", c.nome), el("small", c.descricao))))),
  );
}

// ---------------------------------------------------------------- boas-vindas e ajustes

function telaBoasVindas() {
  const campo = el("input.campo", {
    type: "text", placeholder: "Seu nome", maxLength: 30, autocomplete: "given-name", autocapitalize: "words",
    enterKeyHint: "go", "aria-label": "Seu nome",
    oninput: () => { botao.disabled = !campo.value.trim(); },
    onkeydown: (ev) => { if (ev.key === "Enter" && campo.value.trim()) botao.click(); },
  });
  const botao = el("button.botao.grande", {
    disabled: true,
    onclick: async () => { await salvarNome(campo.value); location.hash = "#/"; rotear(); },
  }, "Começar");
  raiz.replaceChildren(el("div.tela-centro",
    el("div.heroi-mascote", mascote("ovo", "feliz")),
    el("h1", "Oi! Eu sou o Quero"),
    el("p", "Vou te ajudar a estudar a Região Sul. Como você se chama?"),
    campo, botao,
  ));
}

async function telaAjustes() {
  const e = await api("/api/estado");
  const campoNome = el("input.campo", { type: "text", maxLength: 30, value: NOME, "aria-label": "Seu nome", autocapitalize: "words" });
  const arquivo = el("input", { type: "file", accept: "application/json,.json", hidden: true });
  arquivo.addEventListener("change", async () => {
    const f = arquivo.files[0];
    if (!f) return;
    try {
      await importarProgresso(await f.text());
      avisar("Progresso carregado!", "ok");
      location.hash = "#/";
      rotear();
    } catch (err) { avisar(err.message, "erro"); }
  });
  raiz.replaceChildren(el("div.pais",
    el("header.pais-topo", el("a.link", { href: "#/" }, "← Voltar"), el("h1", "Ajustes")),
    el("h2", "Seu nome"),
    campoNome,
    el("button.botao.secundario", {
      onclick: async () => {
        if (!campoNome.value.trim()) return avisar("Escreva um nome.", "erro");
        await salvarNome(campoNome.value); NOME = campoNome.value.trim(); avisar("Nome salvo!", "ok");
      },
    }, "Salvar nome"),
    el("h2", "Seu progresso"),
    el("p.mini", "Ele fica guardado só neste aparelho. Se você limpar os dados do navegador, ele some. Para guardar uma cópia ou passar para outro aparelho, salve o progresso num arquivo."),
    el("button.botao.secundario", {
      onclick: async () => {
        const blob = new Blob([await exportarProgresso()], { type: "application/json" });
        const a = el("a", { href: URL.createObjectURL(blob), download: "progresso-simulado-geografia.json" });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      },
    }, "Salvar progresso em arquivo"),
    el("button.botao.secundario", { onclick: () => arquivo.click() }, "Carregar progresso de um arquivo"),
    arquivo,
    el("h2", "Recomeçar"),
    el("button.botao.perigo", {
      onclick: async () => {
        if (await perguntar({ titulo: "Recomeçar do zero?", texto: "Isso apaga rodadas, XP, troféus e conquistas deste aparelho.", sim: "Apagar tudo", nao: "Cancelar", perigo: true })) {
          await recomecar(); avisar("Tudo zerado."); location.hash = "#/"; rotear();
        }
      },
    }, "Apagar meu progresso"),
    el("p.mini.centro", `${e.rodadas} rodadas feitas · ${e.xp} XP · ${e.trofeus} troféus`),
  ));
}

// ---------------------------------------------------------------- início do app

window.addEventListener("hashchange", rotear);
rotear();

// Funciona sem internet depois da primeira visita (o navegador só permite em https ou localhost).
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
