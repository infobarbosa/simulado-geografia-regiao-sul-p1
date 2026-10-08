"""Teste de ponta a ponta no navegador (opcional). Precisa de: pip install playwright e de um Chrome.
Uso:  python3 -m http.server 6791 &   depois   python3 tests/e2e.py http://127.0.0.1:6791/ [pasta-de-screenshots]
Joga rodadas inteiras no emulador de iPhone e de Android, confere troféu, treino das erradas, persistência
depois de recarregar, backup/restauração do progresso e funcionamento offline."""
import json, os, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:6791/"
SHOTS = Path(sys.argv[2]) if len(sys.argv) > 2 else None
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
BANCO = {q["enunciado"]: q for q in json.loads((Path(__file__).parent.parent / "questoes/geografia-regiao-sul.json").read_text())["questoes"]}


def jogar(pg, errar, botao_final):
    """Responde a rodada aberta errando as `errar` primeiras questões."""
    pg.wait_for_selector(".enunciado")
    feitas = 0
    while True:
        q = BANCO[pg.inner_text(".enunciado")]
        certa = q["correta"] if q["tipo"] == "mc" else (("Verdadeiro" if q["resposta"] else "Falso") if q["tipo"] == "vf" else q["resposta"])
        acertar = feitas >= errar
        if q["tipo"] == "lacuna":
            pg.fill(".campo", certa if acertar else "zzz")
        else:
            alvo = certa if acertar else next(t for t in pg.locator(".opcao-texto").all_inner_texts() if t != certa)
            pg.locator(".opcao-texto", has_text=re.compile(f"^{re.escape(alvo)}$")).first.click()
        pg.click("text=Verificar")
        pg.wait_for_selector(".feedback")
        feitas += 1
        btn = pg.locator(".quiz-rodape .botao")
        fim = botao_final in btn.inner_text().upper()
        btn.click()
        if fim:
            return feitas
        pg.wait_for_selector(".quiz-rodape:not(.feedback)")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    for nome, disp in (("iphone", p.devices["iPhone 13"]), ("android", p.devices["Pixel 7"])):
        ctx = b.new_context(**disp, accept_downloads=True)
        pg = ctx.new_page()
        erros = []
        pg.on("pageerror", lambda e: erros.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and erros.append(m.text))
        pg.goto(URL)
        # boas-vindas: pergunta o nome
        pg.wait_for_selector("input")
        pg.fill("input", "Maria"); pg.click("text=Começar")
        pg.wait_for_selector(".heroi")
        assert "Maria" in pg.inner_text(".balao"), "o Quero deve chamar pelo nome"
        if SHOTS: pg.screenshot(path=str(SHOTS / f"{nome}-inicio.png"))
        # rodada com 1 erro (nota 9,5 → troféu)
        pg.locator(".acao .botao.grande").first.click()
        assert jogar(pg, 1, "RESULTADO") == 20
        pg.wait_for_selector(".resultado"); pg.wait_for_timeout(1200)
        assert pg.inner_text(".nota-grande") == "9,5" and "Troféu" in pg.inner_text("h1")
        if SHOTS: pg.screenshot(path=str(SHOTS / f"{nome}-resultado.png"))
        # treino das erradas não muda a nota
        pg.locator("text=Treinar as que errei").click(); pg.wait_for_selector(".quiz.revisao")
        assert jogar(pg, 0, "CONCLUIR") == 1
        pg.wait_for_selector(".resultado"); assert pg.inner_text(".nota-grande") == "9,5"
        # persiste depois de recarregar
        pg.reload(); pg.wait_for_selector(".resultado")
        pg.goto(URL + "#/"); pg.wait_for_selector(".heroi")
        assert pg.locator(".chip-stat.trofeu b").inner_text() == "1"
        assert "20/50" in pg.inner_text("body"), "20 questões vistas depois da primeira rodada"
        # rodada aberta continua depois de recarregar
        pg.locator(".acao .botao.grande").first.click(); pg.wait_for_selector(".enunciado")
        pg.locator(".opcao, .campo").first.click()
        pg.reload(); pg.wait_for_selector(".enunciado")
        pg.locator(".icone-botao").click(); pg.locator(".modal .botao", has_text="Sair").click(); pg.wait_for_selector(".heroi")
        assert "CONTINUAR" in pg.locator(".acao .botao.grande").first.inner_text().upper()
        # backup e restauração
        pg.goto(URL + "#/ajustes"); pg.wait_for_selector("text=Salvar progresso em arquivo")
        with pg.expect_download() as d:
            pg.click("text=Salvar progresso em arquivo")
        arq = Path(d.value.path()); backup = json.loads(arq.read_text())
        assert backup["estado"]["trofeus"] and backup["estado"]["nome"] == "Maria"
        pg.click("text=Apagar meu progresso"); pg.click(".modal .botao:has-text('Apagar tudo')")
        pg.wait_for_selector(".heroi"); assert pg.locator(".chip-stat.trofeu b").inner_text() == "0"
        pg.goto(URL + "#/ajustes"); pg.wait_for_selector("input[type=file]", state="attached")
        pg.set_input_files("input[type=file]", str(arq)); pg.wait_for_selector(".heroi")
        assert pg.locator(".chip-stat.trofeu b").inner_text() == "1", "o backup deve restaurar o troféu"
        # offline (service worker já guardou os arquivos)
        pg.wait_for_timeout(1500)
        ctx.set_offline(True)
        pg.goto(URL); pg.wait_for_selector(".heroi", timeout=8000)
        pg.locator(".acao .botao.grande").first.click(); pg.wait_for_selector(".enunciado")
        ctx.set_offline(False)
        assert not erros, erros
        print(nome, "ok")
        ctx.close()
    b.close()
print("tudo certo")
