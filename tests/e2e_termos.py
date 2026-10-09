"""Teste de ponta a ponta do aceite dos termos de uso (opcional; precisa de playwright e Chrome).
Uso:  python3 -m http.server 6792 &   depois   python3 tests/e2e_termos.py http://127.0.0.1:6792/ [pasta-de-screenshots]
Confere: botão travado até marcar a caixinha; texto completo disponível; aceite guardado; quem já usava o app
vê o aceite uma vez; texto novo (versão maior) pede novo aceite; Ajustes mostra os termos; sem erros no console."""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:6792/"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
REPO = Path(__file__).resolve().parent.parent.name
CFG = {
    "simulados-4o-ano-3tri": dict(botao="Vamos lá", casa=".grade-disciplinas", chave_estado="s4a3t_estado_v1", chave_termos="s4a3t_termos_v1",
                                  estado={"versao": 1, "nome": "Maria", "proximo_id": 1, "tentativas": [], "cartas": [], "reveladas": []}),
    "simulado-geografia-regiao-sul-p1": dict(botao="Começar", casa=".heroi", chave_estado="sg_p1_estado_v1", chave_termos="sg_p1_termos_v1",
                                             estado={"versao": 1, "nome": "Maria", "proximo_id": 1, "rodadas": [], "respostas": [], "trofeus": [], "conquistas": {}}),
}[REPO]


def shot(pg, nome):
    if SHOTS: pg.screenshot(path=str(SHOTS / f"{REPO}-{nome}.png"), full_page=True)


def termos_guardados(pg):
    bruto = pg.evaluate(f"localStorage.getItem('{CFG['chave_termos']}')")
    return json.loads(bruto) if bruto else None


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    erros = []

    def novo(estado_previo=None, termos_previos=None):
        ctx = b.new_context(**p.devices["iPhone 13"])
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
        script = ""
        if estado_previo: script += f"if (!localStorage.getItem('{CFG['chave_estado']}')) localStorage.setItem('{CFG['chave_estado']}', {json.dumps(json.dumps(estado_previo))});"
        if termos_previos: script += f"if (!localStorage.getItem('{CFG['chave_termos']}')) localStorage.setItem('{CFG['chave_termos']}', {json.dumps(json.dumps(termos_previos))});"
        if script: pg.add_init_script(script)
        return pg

    # 1) primeira visita: nome + caixinha
    pg = novo()
    pg.goto(URL); pg.wait_for_selector("input[type=text]")
    botao = pg.locator(f"button:has-text('{CFG['botao']}')")
    pg.fill("input[type=text]", "Maria")
    assert botao.is_disabled(), "sem marcar a caixinha o botão deve ficar travado"
    assert "gratuito e informal" in pg.inner_text(".termos-resumo")
    assert not pg.locator(".termos-texto").is_visible(), "termos completos começam recolhidos"
    pg.click(".termos-detalhes summary")
    assert pg.locator(".termos-texto").is_visible()
    texto = pg.inner_text(".termos-texto")
    for trecho in ("Sem garantias", "Pode haver enganos", "Pode mudar ou acabar", "nenhum compromisso de nível de serviço"):
        assert trecho.lower() in texto.lower(), trecho
    shot(pg, "boas-vindas")
    pg.check(".aceite-linha input")
    assert botao.is_enabled()
    pg.uncheck(".aceite-linha input")
    assert botao.is_disabled(), "desmarcar trava de novo"
    pg.check(".aceite-linha input"); botao.click()
    pg.wait_for_selector(CFG["casa"])
    t = termos_guardados(pg)
    assert t and t["versao"] == 1 and t["aceito_em"], t
    pg.reload(); pg.wait_for_selector(CFG["casa"])
    assert pg.locator(".aceite-linha").count() == 0, "depois de aceitar não pergunta de novo"
    print("1) primeira visita ok")

    # 2) Ajustes -> termos
    pg.goto(URL + "#/ajustes"); pg.wait_for_selector("text=Ler os termos de uso")
    pg.click("text=Ler os termos de uso"); pg.wait_for_selector(".termos-texto")
    assert "Aceito neste aparelho em" in pg.inner_text("body") and "versão 1" in pg.inner_text("body")
    shot(pg, "termos")
    print("2) tela de termos ok")

    # 3) quem já usava o app (tem nome, não tem aceite)
    pg = novo(estado_previo=CFG["estado"])
    pg.goto(URL); pg.wait_for_selector("text=Antes de continuar")
    cont = pg.locator("button:has-text('Continuar')")
    assert cont.is_disabled()
    shot(pg, "aceite-usuario-existente")
    pg.check(".aceite-linha input"); cont.click()
    pg.wait_for_selector(CFG["casa"])
    assert termos_guardados(pg)["versao"] == 1
    print("3) usuário existente ok")

    # 4) texto novo (versão do aceite menor que a atual) pede novo aceite
    pg = novo(estado_previo=CFG["estado"], termos_previos={"versao": 0, "aceito_em": "2020-01-01T00:00:00Z"})
    pg.goto(URL); pg.wait_for_selector("text=Antes de continuar")
    print("4) versão antiga pede novo aceite ok")

    assert not erros, erros
    print("tudo certo")
