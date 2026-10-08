// "Servidor" dentro do navegador: guarda o progresso no aparelho (localStorage) e responde às mesmas
// chamadas que as telas já fazem (/api/estado, /api/rodadas...). Sem rede depois do primeiro carregamento.

import * as M from "./motor.js";

const CHAVE = "sg_p1_estado_v1";
const URL_BANCO = "questoes/geografia-regiao-sul.json";
const LIMITE_DURACAO_S = 6 * 3600;

let banco = null;          // {titulo, questoes, por_id}
let estado = null;         // progresso (ver estadoVazio)
let persistente = true;    // false quando o navegador bloqueia o armazenamento

const estadoVazio = () => ({ versao: 1, nome: "", proximo_id: 1, rodadas: [], respostas: [], trofeus: [], conquistas: {} });

class ErroApi extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

// ---------------------------------------------------------------- armazenamento

function lerEstado() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...estadoVazio(), ...JSON.parse(bruto) };
  } catch { persistente = false; }
  return estadoVazio();
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    persistente = true;
  } catch { persistente = false; }
}

export const armazenamentoOk = () => persistente;

async function iniciar() {
  if (banco) return;
  const r = await fetch(URL_BANCO);
  if (!r.ok) throw new ErroApi(r.status, "Não consegui carregar as questões. Confira a internet e tente de novo.");
  const dados = await r.json();
  const problemas = M.validar(dados);
  if (problemas.length) throw new ErroApi(500, "Banco de questões inválido: " + problemas.join(" "));
  dados.por_id = Object.fromEntries(dados.questoes.map((q) => [q.id, q]));
  banco = dados;
  estado = lerEstado();
}

// ---------------------------------------------------------------- consultas

const rodadaPorId = (id) => {
  const r = estado.rodadas.find((x) => x.id === id);
  if (!r) throw new ErroApi(404, "Rodada não encontrada.");
  return r;
};

const questoesDaRodada = (r) => r.questoes.map((i) => banco.por_id[i]).filter(Boolean);

function feedback(q, resp, aviso = null) {
  return {
    questao_id: q.id, resposta: resp.resposta, correta: !!resp.correta, gabarito: M.gabaritoParaExibir(q),
    explicacao: q.explicacao, pagina: q.pagina ?? null, aviso,
  };
}

function historicoDasQuestoes() {
  const hist = {};
  for (const r of estado.respostas) {
    if (r.revisao) continue;
    const h = (hist[r.questao_id] ||= { vezes: 0 });
    h.vezes++;
    h.ultima_correta = !!r.correta;
    h.ultima_em = r.respondida_em;
  }
  return hist;
}

function stats() {
  const concluidas = estado.rodadas.filter((r) => r.concluida_em);
  const notas = concluidas.map((r) => r.nota);
  return {
    rodadas: concluidas.length,
    trofeus: estado.trofeus.length,
    melhor_nota: notas.length ? Math.max(...notas) : null,
    rodada_perfeita: notas.some((n) => n >= 10),
    veloz: concluidas.some((r) => r.nota >= M.NOTA_TROFEU && r.duracao_s < 300),
    sequencia: M.sequenciaDeDias(concluidas.map((r) => r.concluida_em)),
    vistas: new Set(estado.respostas.filter((r) => !r.revisao).map((r) => r.questao_id)).size,
    total_banco: banco.questoes.length,
    xp: concluidas.reduce((soma, r) => soma + (r.xp || 0), 0),
  };
}

function conquistaPublica(chave, obtida_em = null) {
  const [nome, descricao] = M.CONQUISTAS[chave];
  return { chave, nome, descricao, obtida_em };
}

function conquistasNovas() {
  const novas = [...M.conquistasMerecidas(stats())].filter((c) => !estado.conquistas[c]).sort();
  for (const c of novas) estado.conquistas[c] = M.agora();
  return novas;
}

// ---------------------------------------------------------------- "rotas"

function rotaEstado() {
  const s = stats();
  const aberta = [...estado.rodadas].reverse().find((r) => !r.concluida_em);
  const ultima = estado.rodadas.filter((r) => r.concluida_em)
    .sort((a, b) => (a.concluida_em < b.concluida_em ? 1 : a.concluida_em > b.concluida_em ? -1 : b.id - a.id))[0];
  const nivel = M.nivelPorXp(s.xp);
  const base = M.xpParaNivel(nivel), topo = M.xpParaNivel(nivel + 1);
  return {
    titulo: banco.titulo || "Simulado", nome: estado.nome,
    xp: s.xp, nivel, xp_no_nivel: s.xp - base, xp_do_nivel: topo - base,
    estagio: M.estagioPorNivel(nivel), sequencia_dias: s.sequencia,
    rodadas: s.rodadas, trofeus: s.trofeus, melhor_nota: s.melhor_nota,
    banco: { total: s.total_banco, vistas: s.vistas },
    tamanho_rodada: M.TAMANHO_RODADA, nota_trofeu: M.NOTA_TROFEU,
    rodada_aberta: aberta ? {
      id: aberta.id, total: aberta.questoes.length,
      feitas: estado.respostas.filter((x) => x.rodada_id === aberta.id && !x.revisao).length,
    } : null,
    ultima_rodada: ultima ? { id: ultima.id, nota: ultima.nota, concluida_em: ultima.concluida_em } : null,
    conquistas: Object.keys(M.CONQUISTAS).map((k) => conquistaPublica(k, estado.conquistas[k] || null)),
    armazenamento_ok: persistente,
  };
}

function rotaNovaRodada(corpo) {
  const aberta = [...estado.rodadas].reverse().find((r) => !r.concluida_em);
  if (aberta && !(corpo && corpo.descartar)) return { id: aberta.id, continuada: true };
  const abertas = new Set(estado.rodadas.filter((r) => !r.concluida_em).map((r) => r.id));
  estado.rodadas = estado.rodadas.filter((r) => r.concluida_em);
  estado.respostas = estado.respostas.filter((r) => !abertas.has(r.rodada_id));
  const rnd = M.criarRng();
  const ids = M.sortearRodada(banco.questoes, historicoDasQuestoes(), rnd);
  const ordem = M.sortearOrdem(ids.map((i) => banco.por_id[i]), rnd);
  const id = estado.proximo_id++;
  estado.rodadas.push({
    id, iniciada_em: M.agora(), concluida_em: null, questoes: ids, ordem, duracao_s: 0,
    pontos: null, total: ids.length, nota: null, xp: null,
  });
  salvar();
  return { id, continuada: false };
}

function rotaVerRodada(id) {
  const r = rodadaPorId(id);
  const questoes = questoesDaRodada(r);
  const respondidas = { normal: {}, revisao: {} };
  for (const resp of estado.respostas.filter((x) => x.rodada_id === id)) {
    const q = banco.por_id[resp.questao_id];
    if (q) respondidas[resp.revisao ? "revisao" : "normal"][q.id] = feedback(q, resp);
  }
  return {
    id: r.id, questoes: questoes.map((q) => M.questaoParaAluna(q, r.ordem)), respondidas,
    concluida: !!r.concluida_em, duracao_s: r.duracao_s, nota: r.nota, pontos: r.pontos, total: r.total, xp: r.xp,
    trofeu: estado.trofeus.some((t) => t.rodada_id === id),
  };
}

function rotaResponder(id, corpo) {
  const r = rodadaPorId(id);
  const q = questoesDaRodada(r).find((x) => x.id === corpo.questao_id);
  if (!q) throw new ErroApi(404, "Esta questão não faz parte da rodada.");
  const revisao = !!corpo.revisao;
  if (revisao && !r.concluida_em) throw new ErroApi(409, "O treino das erradas só existe depois de terminar a rodada.");
  if (!revisao && r.concluida_em) throw new ErroApi(409, "Esta rodada já foi concluída.");
  const existente = estado.respostas.find((x) => x.rodada_id === id && x.questao_id === q.id && x.revisao === revisao);
  if (existente) return feedback(q, existente);   // toque duplo: devolve a mesma correção
  const res = M.corrigir(q, corpo.resposta);
  const resp = {
    rodada_id: id, questao_id: q.id, revisao, resposta: String(corpo.resposta), correta: res.correta,
    respondida_em: M.agora(),
  };
  estado.respostas.push(resp);
  if (corpo.duracao_s != null && !revisao) {
    r.duracao_s = Math.max(r.duracao_s, Math.min(Math.max(corpo.duracao_s, 0), LIMITE_DURACAO_S));
  }
  salvar();
  return feedback(q, resp, res.aviso);
}

function rotaConcluir(id, corpo) {
  const r = rodadaPorId(id);
  let novas = [];
  if (!r.concluida_em) {
    const respondidas = estado.respostas.filter((x) => x.rodada_id === id && !x.revisao);
    const total = r.questoes.length;
    if (respondidas.length < total) throw new ErroApi(409, `Ainda faltam ${total - respondidas.length} questões.`);
    const acertos = respondidas.filter((x) => x.correta).length;
    const nota = Math.round((acertos / total) * 100) / 10;
    if (corpo && corpo.duracao_s != null) {
      r.duracao_s = Math.max(r.duracao_s, Math.min(Math.max(corpo.duracao_s, 0), LIMITE_DURACAO_S));
    }
    Object.assign(r, { concluida_em: M.agora(), pontos: acertos, total, nota, xp: M.xpDaRodada(acertos, nota) });
    if (nota >= M.NOTA_TROFEU) estado.trofeus.push({ id: estado.trofeus.length + 1, rodada_id: id, nota, obtido_em: M.agora() });
    novas = conquistasNovas();
    salvar();
  }
  return { ...rotaVerRodada(id), conquistas_novas: novas.map((k) => conquistaPublica(k)) };
}

function rotaTrofeus() {
  return [...estado.trofeus].reverse().map((t) => ({
    id: t.id, nota: t.nota, obtido_em: t.obtido_em, duracao_s: estado.rodadas.find((r) => r.id === t.rodada_id)?.duracao_s ?? null,
  }));
}

// ---------------------------------------------------------------- entrada: mesma assinatura do fetch antigo

export async function api(caminho, opcoes = {}) {
  await iniciar();
  const metodo = opcoes.method || (opcoes.json !== undefined ? "POST" : "GET");
  const corpo = opcoes.json;
  let m;
  if (metodo === "GET" && caminho === "/api/estado") return rotaEstado();
  if (metodo === "GET" && caminho === "/api/trofeus") return rotaTrofeus();
  if (metodo === "POST" && caminho === "/api/rodadas") return rotaNovaRodada(corpo);
  if (metodo === "GET" && (m = caminho.match(/^\/api\/rodadas\/(\d+)$/))) return rotaVerRodada(Number(m[1]));
  if (metodo === "POST" && (m = caminho.match(/^\/api\/rodadas\/(\d+)\/respostas$/))) return rotaResponder(Number(m[1]), corpo);
  if (metodo === "POST" && (m = caminho.match(/^\/api\/rodadas\/(\d+)\/concluir$/))) return rotaConcluir(Number(m[1]), corpo);
  throw new ErroApi(404, "Rota não encontrada: " + caminho);
}

// ---------------------------------------------------------------- ajustes (nome, backup, recomeçar)

export async function nomeSalvo() { await iniciar(); return estado.nome; }
export async function salvarNome(nome) { await iniciar(); estado.nome = String(nome || "").trim().slice(0, 30); salvar(); }

export async function exportarProgresso() {
  await iniciar();
  return JSON.stringify({ app: "simulado-geografia-regiao-sul-p1", exportado_em: M.agora(), estado }, null, 1);
}

export async function importarProgresso(texto) {
  await iniciar();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new ErroApi(400, "Esse arquivo não é um backup válido."); }
  const e = dados && dados.estado;
  if (!dados || dados.app !== "simulado-geografia-regiao-sul-p1" || !e || !Array.isArray(e.rodadas) || !Array.isArray(e.respostas)) {
    throw new ErroApi(400, "Esse arquivo não é um backup deste simulado.");
  }
  estado = { ...estadoVazio(), ...e };
  salvar();
}

export async function recomecar() {
  await iniciar();
  const nome = estado.nome;
  estado = { ...estadoVazio(), nome };
  salvar();
}
