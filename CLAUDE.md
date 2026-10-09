# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, serverless version (HTML, CSS and vanilla JS, no build step) of a Geography practice app (P1, Região Sul) for a 13-year-old, published on GitHub Pages from `main` (root): https://infobarbosa.github.io/simulado-geografia-regiao-sul-p1/. It is a port of the sibling repo `simulados-ana` (private, FastAPI + SQLite, port 6789, with a parents area). Here there is no server and no parents area, by the parent's choice (temporary app for a single test; studying anywhere beats parental control). `README.md` is the user-facing guide, in Portuguese. All UI text and code identifiers are Brazilian Portuguese; keep it that way.

This repository is **public**. Do not add the child's name or the notebook photos: the app asks for the user's name on first visit and stores it only on the device.

## Commands

```bash
python3 -m http.server 8000                       # run locally: http://localhost:8000
# unit tests of the engine run in the browser: http://localhost:8000/tests/  (tab title "OK 12/12")
python3 tests/e2e.py http://localhost:8000/ [screenshots-dir]   # needs `pip install playwright` and Chrome (CHROME env var)
```

`tests/e2e.py` plays whole rounds on emulated iPhone 13 and Pixel 7, then checks trophy, review training, persistence after reload, backup and restore, and offline mode. It can also be pointed at the published URL.

## Architecture

- **`js/motor.js`**: pure functions with no DOM or storage: bank validation, grading (case, spaces, final punctuation, accent-only differences and equivalent numbers count as right), round draw (`sortearRodada`: never seen, then last answer wrong, then oldest seen), option shuffling (`sortearOrdem`, seeded `criarRng`), XP, level curve `50*(n-1)*n`, mascot stages, day streak and achievements. This is a line-by-line port of the Python `correcao.py`/`progresso.py` from `simulados-ana`; if one changes, change the other.
- **`js/api.js`**: the "server inside the browser". It keeps all progress in `localStorage` (key `sg_p1_estado_v1`, with an in-memory fallback if storage is blocked) and answers the same `/api/...` calls the screens make (`/api/estado`, `/api/rodadas`, `/api/rodadas/<id>`, `.../respostas`, `.../concluir`, `/api/trofeus`). `util.js` re-exports its `api`. It also has the name, export, import and reset helpers used by the Ajustes screen. Round ids come from a counter in the state, never reused.
- **`js/app.js`** (router and screens: boas-vindas, início, resultado, troféus, conquistas, ajustes; hash routes `#/`, `#/rodada/<id>`, `#/revisao/<id>`, `#/resultado/<id>`, `#/trofeus`, `#/conquistas`, `#/ajustes`), **`js/quiz.js`** (the round player with clock and feedback panel), **`js/mascote.js`** (Quero and the trophy as SVG), **`js/util.js`** (`el()` DOM helper: a numeric `0` as the first argument is a child, not props; sounds; confetti; dialogs).
- **`questoes/geografia-regiao-sul.json`**: the 50-question bank (27 `mc`, 12 `vf`, 11 `lacuna`), the single source of truth. Question ids are stable keys for saved progress: never reuse an id for a different question.
- **`js/termos.js`**: versioned terms-of-use text (`VERSAO_TERMOS`) and the first-visit consent block (summary + collapsed full text + checkbox). Consent is stored apart from the progress (`termosAceitos`/`aceitarTermos` in `api.js`, key `sg_p1_termos_v1`), so restoring a backup never accepts for the user and resetting progress never revokes it. New users must tick the box on the welcome screen; existing users, or anyone whose saved version is older, see an "Antes de continuar" screen once (guard at the top of the router). Changed the text? Bump `VERSAO_TERMOS` (and `DATA_TERMOS`), `VERSAO` in `sw.js`. No analytics or third-party requests exist, and the text says so: keep it true. `tests/e2e_termos.py` covers the flow.
- **`sw.js`**: service worker with stale-while-revalidate over a fixed file list. **Bump `VERSAO` and keep the `ARQUIVOS` list in sync whenever files change or are added**, or devices keep serving the cached version. Registration happens in `app.js` only in a secure context.

## Constraints

All paths are relative (the site lives under `/simulado-geografia-regiao-sul-p1/`). Targets are an iPhone (Safari) and Android (Chrome): `viewport-fit=cover` with safe-area padding, `100dvh`, inputs at 16px or more, audio unlocked on the first touch (Web Audio only; no vibration), `prefers-reduced-motion` support, and `img/apple-touch-icon.png` must stay a PNG. Errors are orange with encouraging copy, never red. Neutral wording (no gendered forms), since the app does not know who is using it.
