# Simulado de Geografia: Região Sul (revisão P1)

App de estudo para a prova de Geografia sobre a **Região Sul**: rodadas de 20 questões sorteadas na hora, correção imediata com explicação, cronômetro, XP, níveis, troféu para quem tira **9 ou mais** e um mascote, o **Quero** (um quero-quero), que evolui conforme o estudo.

É um site estático (só HTML, CSS e JavaScript, sem servidor e sem build). Funciona no iPhone, no Android e no computador, e **abre sem internet depois da primeira visita**.

## Como usar

Abra o endereço do site no celular:

**https://infobarbosa.github.io/simulado-geografia-regiao-sul-p1/**

Para ter o app na tela inicial:
- **iPhone (Safari):** botão de compartilhar → **Adicionar à Tela de Início**.
- **Android (Chrome):** menu **⋮ → Adicionar à tela inicial** (ou **Instalar app**).

Na primeira vez, o Quero pergunta o seu nome. Depois é só tocar em **Começar** e responder.

## Como funciona

- **Rodadas de 20 questões** sorteadas de um banco de 50 (27 de múltipla escolha, 12 de verdadeiro ou falso e 11 de completar). Passam primeiro as que você nunca viu, depois as que errou por último. Assim você percorre o banco todo antes de repetir, e as repetições vão para o que você erra.
- **As alternativas mudam de posição** a cada rodada, para não decorar "a certa é a B".
- **Depois de cada resposta** aparecem a explicação e a página do resumo onde está o assunto.
- **Nota** de 0 a 10 por rodada (acertos ÷ 20 × 10). **Nota 9 ou mais ganha um troféu.**
- **Treinar as que errei** repete só as erradas, sem mudar a nota.
- **XP:** 10 por acerto, +30 com nota 9 ou mais, +20 extra com nota 10. O Quero evolui nos níveis 2, 4 e 7. Há também sequência de dias e 8 conquistas.
- **Cronômetro** da rodada, que pausa quando a tela fica escondida.
- **Completar:** maiúsculas, espaços e ponto final não importam; só o acento errado ainda conta como certo (a tela mostra a grafia correta).

## Seu progresso

Fica guardado **só no seu aparelho** (no navegador). Não há conta nem servidor. Isso significa que:
- o progresso do iPhone não aparece no Android;
- se você limpar os dados do navegador, ele some.

Em **Ajustes** (rodapé da tela inicial) dá para **salvar o progresso num arquivo**, **carregar** esse arquivo em outro aparelho e **recomeçar do zero**.

## Para quem for mexer no código

Tudo está na raiz, sem etapa de build:

| Arquivo | O que faz |
|---|---|
| `index.html`, `css/app.css` | a página e o visual |
| `js/app.js` | roteador e telas (boas-vindas, início, resultado, troféus, conquistas, ajustes) |
| `js/quiz.js` | a rodada: uma questão por tela, cronômetro e feedback |
| `js/mascote.js` | o Quero e o troféu, desenhados em SVG |
| `js/motor.js` | regras puras: validação do banco, correção, sorteio, XP, níveis, conquistas |
| `js/api.js` | o "servidor" dentro do navegador: guarda o progresso em `localStorage` e atende as chamadas `/api/...` das telas |
| `questoes/geografia-regiao-sul.json` | o banco de questões (fonte da verdade) |
| `sw.js` | service worker: guarda os arquivos para funcionar offline |

### Rodar localmente
```bash
python3 -m http.server 8000     # depois abra http://localhost:8000
```

### Testes
- **Motor (no navegador):** com o servidor local ligado, abra `http://localhost:8000/tests/`. O título da aba mostra `OK 11/11`.
- **Ponta a ponta (opcional):** `pip install playwright` e `python3 tests/e2e.py http://localhost:8000/` (precisa do Chrome; use a variável `CHROME` se ele não estiver em `/usr/bin/google-chrome`). Joga rodadas inteiras em um iPhone e em um Android emulados, confere troféu, treino das erradas, persistência, backup e modo offline.

### Mudar ou acrescentar questões
Edite `questoes/geografia-regiao-sul.json`. Cada questão tem `id` (único), `topico`, `pagina` do resumo, `tipo`, `enunciado` e `explicacao`; e ainda:
- `mc`: `correta` e `erradas` (2 ou mais). A ordem é sorteada pelo app.
- `vf`: `resposta` (`true` ou `false`).
- `lacuna`: `resposta` e, se quiser, `aceitas` (outras grafias válidas).

O progresso de quem já usa fica ligado ao `id`: não reaproveite o `id` de uma questão apagada para outra pergunta. Depois de mudar qualquer arquivo, aumente `VERSAO` em `sw.js`, para o aparelho baixar a versão nova em vez de usar a guardada.

### Publicação
O site é publicado pelo GitHub Pages, a partir da branch `main` (pasta raiz). Cada `git push` atualiza o site em um ou dois minutos.
