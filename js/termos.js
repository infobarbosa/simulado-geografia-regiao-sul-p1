// Termos de uso (texto versionado). Mudou o texto? Aumente VERSAO_TERMOS: o app pede um novo aceite.
// O aceite é guardado à parte do progresso (ver termosAceitos/aceitarTermos em api.js).

import { el } from "./util.js";

export const VERSAO_TERMOS = 1;
const DATA_TERMOS = "8 de outubro de 2026";

const RESUMO = [
  "Este app é gratuito e informal, feito por um pai para os filhos estudarem. Não há garantia de que funcione sempre nem de que continue existindo.",
  "As questões e os gabaritos podem conter erros. O app ajuda a treinar, mas não substitui o livro, o professor nem a prova de verdade.",
  "O progresso fica só neste aparelho e pode se perder. Faça o backup em Ajustes.",
  "Não há conta, anúncios nem rastreamento.",
];

export const ARTIGOS = [
  ["O que é", "Simulado de Geografia: Região Sul é um app de treino, gratuito, feito de forma independente por um pai para os filhos estudarem. As questões foram elaboradas a partir de um resumo de aula de Geografia sobre a Região Sul do Brasil. O app não tem vínculo com a escola, com editoras ou com os autores dos livros. As notas e as recompensas do app não são notas escolares."],
  ["Quem deve aceitar", "O app é usado por crianças e adolescentes. Estes termos devem ser aceitos por um responsável adulto, ou por um adulto que leu junto com a criança."],
  ["Sem garantias", "O app é oferecido “como está”. Não há garantia de que esteja sempre disponível, funcione sem falhas, seja compatível com todos os aparelhos ou funcione sem internet em todos os casos. Não existe nenhum compromisso de nível de serviço."],
  ["Pode haver enganos", "Questões, gabaritos e correções podem conter erros ou imprecisões. Em caso de dúvida, vale o material da escola e a orientação do professor."],
  ["Pode mudar ou acabar", "O app pode ser alterado, suspenso ou encerrado, e o endereço pode sair do ar, a qualquer momento e sem aviso."],
  ["Seus dados", "O nome e o progresso ficam apenas no armazenamento do navegador deste aparelho. O app não os envia a nenhum servidor e não usa anúncios nem ferramentas de rastreamento. Limpar os dados do navegador, trocar de aparelho ou ficar muito tempo sem usar o app pode apagá-los (alguns navegadores, como o Safari, apagam dados de sites sem uso por cerca de uma semana). O backup em Ajustes é por sua conta. O endereço é hospedado no GitHub Pages, que pode registrar acessos de acordo com a política do próprio GitHub."],
  ["Responsabilidade", "Na medida permitida pela lei, o responsável pelo app não responde por prejuízos decorrentes do uso, de erros no conteúdo ou da perda de dados, inclusive efeitos sobre notas ou desempenho escolar."],
  ["Mudanças nestes termos", "Estes termos podem ser atualizados. Quando mudarem, o app pede um novo aceite."],
  ["Contato", "Encontrou um erro ou tem uma dúvida? Avise quem lhe passou o link deste app."],
];

export const resumoEl = () => el("ul.termos-resumo", RESUMO.map((t) => el("li", t)));

export const termosCompletosEl = () => el("div.termos-texto",
  el("p.pequeno.mini", `Termos de uso — versão ${VERSAO_TERMOS}, ${DATA_TERMOS}`),
  ARTIGOS.flatMap(([titulo, texto], i) => [el("h2", `${i + 1}. ${titulo}`), el("p", texto)]));

// Resumo + termos completos (recolhidos) + caixinha de aceite. aoMudar(marcado) avisa a tela.
export function blocoAceite(aoMudar) {
  const caixa = el("input", { type: "checkbox", onchange: () => aoMudar(caixa.checked) });
  return {
    el: el("div.termos-aceite",
      resumoEl(),
      el("details.termos-detalhes", el("summary", "Ler os termos completos"), termosCompletosEl()),
      el("label.aceite-linha", caixa, el("span", "Sou o responsável (ou li junto com um adulto) e concordo com os termos de uso."))),
    marcado: () => caixa.checked,
  };
}
