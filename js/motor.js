// Motor do simulado: validação do banco, correção, sorteio das rodadas, XP, níveis e conquistas.
// Funções puras, sem DOM e sem armazenamento: dá para testar em tests/index.html.

export const TAMANHO_RODADA = 20;
export const NOTA_TROFEU = 9.0;
const XP_ACERTO = 10;
const XP_BONUS_TROFEU = 30;      // nota >= 9
const XP_BONUS_PERFEITA = 20;    // nota 10 (soma com o bônus do troféu)

// ---------------------------------------------------------------- sorteio com semente

export function criarRng(semente = Math.floor(Math.random() * 2 ** 31)) {
  let a = semente >>> 0;
  return () => {                       // mulberry32
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function embaralhar(lista, rnd) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- validação do banco

export function validar(dados) {
  const problemas = [];
  const questoes = dados && dados.questoes;
  if (!Array.isArray(questoes) || !questoes.length) return ["O arquivo não tem a lista 'questoes'."];
  const vistos = new Set();
  for (const q of questoes) {
    const r = `Questão ${q.id}`;
    if (!Number.isInteger(q.id) || vistos.has(q.id)) problemas.push(`${r}: id ausente ou repetido.`);
    vistos.add(q.id);
    for (const campo of ["topico", "enunciado", "explicacao"]) if (!q[campo]) problemas.push(`${r}: falta '${campo}'.`);
    if (q.tipo === "mc") {
      const erradas = q.erradas || [];
      if (!q.correta || erradas.length < 2) problemas.push(`${r}: precisa de 'correta' e ao menos 2 'erradas'.`);
      const opcoes = [q.correta, ...erradas];
      if (new Set(opcoes).size !== opcoes.length) problemas.push(`${r}: alternativas repetidas.`);
    } else if (q.tipo === "vf") {
      if (typeof q.resposta !== "boolean") problemas.push(`${r}: 'resposta' deve ser true ou false.`);
    } else if (q.tipo === "lacuna") {
      if (!q.resposta) problemas.push(`${r}: falta 'resposta'.`);
    } else problemas.push(`${r}: tipo inválido (${q.tipo}).`);
  }
  return problemas;
}

// ---------------------------------------------------------------- correção

const semAcento = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function normalizar(texto) {
  return String(texto ?? "").normalize("NFC").trim().toLowerCase()
    .replace(/^["'“”‘’ ]+|["'“”‘’ ]+$/g, "")
    .replace(/[.!;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function comoNumero(texto) {
  const t = texto.replace(/ /g, "").replace(/%$/, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

export function corrigirLacuna(resposta, questao) {
  const r = normalizar(resposta);
  if (!r) return { correta: false, aviso: null };
  const aceitas = [questao.resposta, ...(questao.aceitas || [])].map(normalizar);
  if (aceitas.includes(r)) return { correta: true, aviso: null };
  if (aceitas.map(semAcento).includes(semAcento(r))) return { correta: true, aviso: "acento" };
  const nr = comoNumero(r);
  if (nr !== null && aceitas.some((a) => comoNumero(a) === nr)) return { correta: true, aviso: null };
  return { correta: false, aviso: null };
}

export function corrigir(questao, resposta) {
  let correta, aviso = null;
  if (questao.tipo === "vf") correta = String(resposta).toUpperCase().slice(0, 1) === (questao.resposta ? "V" : "F");
  else if (questao.tipo === "mc") correta = normalizar(resposta) === normalizar(questao.correta);
  else if (questao.tipo === "lacuna") ({ correta, aviso } = corrigirLacuna(resposta, questao));
  else throw new Error(`Tipo de questão desconhecido: ${questao.tipo}`);
  return { correta, pontos: correta ? 1 : 0, aviso };
}

export function gabaritoParaExibir(q) {
  if (q.tipo === "vf") return q.resposta ? "Verdadeiro" : "Falso";
  return q.tipo === "mc" ? q.correta : q.resposta;
}

// ---------------------------------------------------------------- rodadas

// historico[id] = {vezes, ultima_correta, ultima_em}. Prioridade: nunca vistas, depois as que a última
// resposta foi erro, depois as vistas há mais tempo; sorteio dentro de cada grupo. O resultado sai embaralhado.
export function sortearRodada(questoes, historico, rnd, tamanho = TAMANHO_RODADA) {
  const chave = (q) => {
    const h = historico[q.id];
    if (!h) return [0, "", rnd()];
    return [h.ultima_correta ? 2 : 1, h.ultima_em, rnd()];
  };
  const comChave = questoes.map((q) => [chave(q), q]);
  comChave.sort(([a], [b]) => (a[0] - b[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || (a[2] - b[2]));
  const ids = comChave.slice(0, tamanho).map(([, q]) => q.id);
  return embaralhar(ids, rnd);
}

// Ordem embaralhada das alternativas (mc) e dos botões Verdadeiro/Falso, por id de questão.
export function sortearOrdem(questoes, rnd) {
  const ordem = {};
  for (const q of questoes) {
    if (q.tipo === "mc") ordem[q.id] = embaralhar([q.correta, ...q.erradas], rnd);
    else if (q.tipo === "vf") ordem[q.id] = embaralhar(["Verdadeiro", "Falso"], rnd);
  }
  return ordem;
}

// Versão da questão para a tela: sem gabarito nem explicação, com a ordem sorteada.
export function questaoParaAluna(q, ordem) {
  const v = { id: q.id, topico: q.topico, tipo: q.tipo, enunciado: q.enunciado };
  if (ordem[q.id]) v.opcoes = ordem[q.id];
  return v;
}

// ---------------------------------------------------------------- XP, níveis, estágios, sequência, conquistas

export const xpParaNivel = (n) => 50 * (n - 1) * n;
export function nivelPorXp(xp) { let n = 1; while (xp >= xpParaNivel(n + 1)) n++; return n; }

export const ESTAGIOS = [[1, "ovo", "Quero Ovinho"], [2, "filhote", "Quero Filhote"], [4, "adulto", "Quero"], [7, "mestre", "Quero Mestre"]];
export function estagioPorNivel(nivel) {
  const [, chave, nome] = ESTAGIOS.filter(([min]) => nivel >= min).pop();
  return { chave, nome };
}

export function xpDaRodada(acertos, nota) {
  let xp = acertos * XP_ACERTO;
  if (nota >= NOTA_TROFEU) xp += XP_BONUS_TROFEU;
  if (nota >= 10) xp += XP_BONUS_PERFEITA;
  return xp;
}

const diaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Dias seguidos com ao menos uma rodada concluída (datas "AAAA-MM-DDTHH:MM:SS"). Vale se o último foi hoje ou ontem.
export function sequenciaDeDias(datas, hoje = new Date()) {
  const dias = new Set(datas.map((d) => d.slice(0, 10)));
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (!dias.has(diaLocal(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (dias.has(diaLocal(cursor))) { n++; cursor.setDate(cursor.getDate() - 1); }
  return n;
}

export const CONQUISTAS = {
  primeira_rodada: ["Primeiro voo", "Conclua sua primeira rodada."],
  primeiro_trofeu: ["Nota 9!", "Tire 9 ou mais em uma rodada."],
  rodada_perfeita: ["Rodada perfeita", "Acerte as 20 questões de uma rodada."],
  tres_dias: ["3 dias seguidos", "Estude 3 dias seguidos."],
  sete_dias: ["Semana inteira", "Estude 7 dias seguidos."],
  cinco_trofeus: ["Coleção de troféus", "Ganhe 5 troféus."],
  banco_completo: ["Conheço tudo", "Responda todas as questões do banco ao menos uma vez."],
  veloz: ["Relâmpago", "Tire 9 ou mais em uma rodada em menos de 5 minutos."],
};

// stats: rodadas, trofeus, rodada_perfeita, sequencia, vistas, total_banco, veloz
export function conquistasMerecidas(s) {
  const ok = new Set();
  if (s.rodadas >= 1) ok.add("primeira_rodada");
  if (s.trofeus >= 1) ok.add("primeiro_trofeu");
  if (s.rodada_perfeita) ok.add("rodada_perfeita");
  if (s.sequencia >= 3) ok.add("tres_dias");
  if (s.sequencia >= 7) ok.add("sete_dias");
  if (s.trofeus >= 5) ok.add("cinco_trofeus");
  if (s.total_banco && s.vistas >= s.total_banco) ok.add("banco_completo");
  if (s.veloz) ok.add("veloz");
  return ok;
}

export function agora(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${diaLocal(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
