"""Gameplay regression: fresh start + tutorial, a full 12-move playthrough at 8x, reloads mid-game and after the muster, and three past bug reproductions."""
# Run from the project root with the servers up (see Tools/qa/README.md).
import pathlib as _pl
OUT = _pl.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
import json, time
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:4173/"
KEY = "grow-an-empire:save:v1"
R = {}

def new(browser, tutorial_done=True):
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    if tutorial_done:
        ctx.add_init_script("localStorage.setItem('grow-an-empire:tutorial:v1','complete')")
    page = ctx.new_page()
    errs, pageerrs = [], []
    page.on("pageerror", lambda e: pageerrs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text))
    return ctx, page, errs, pageerrs

def loaded(page, t=30000):
    page.wait_for_selector("#loading.hidden", state="attached", timeout=t)

def save(page):
    raw = page.evaluate(f"localStorage.getItem('{KEY}')")
    return json.loads(raw)["state"] if raw else None

def set_speed8(page):
    for _ in range(3): page.click("#speed-toggle")

def wait_move(page, n, t=20000):
    page.wait_for_function(f"document.querySelector('#move').textContent.startsWith('{n} ')", timeout=t)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

    # 1. Failed boot must not clobber the save; error must be readable.
    ctx, page, errs, perrs = new(b)
    page.goto(URL); loaded(page)
    page.click(".build-card >> nth=0"); time.sleep(0.4)
    before = save(page)
    page.route("**/*village-empty-terrain*", lambda r: r.continue_() if "import" in r.request.url else r.abort())
    page.reload(); time.sleep(3)
    text = page.inner_text("#loading")
    has_reload = page.locator("#loading button").count() == 1
    page.goto("about:blank")
    p2 = ctx.new_page(); p2.goto(URL); loaded(p2)
    after = save(p2)
    R["1_failed_boot_keeps_save"] = {"error_text": " ".join(text.split())[:140], "reload_button": has_reload,
        "before_selected": before["selectedBuildingId"], "after_selected": after["selectedBuildingId"],
        "resumed_status": p2.inner_text("#phase"), "pass": before["selectedBuildingId"] == after["selectedBuildingId"] and has_reload}
    ctx.close()

    # 2. Unusable save -> fresh game with a message (not a bricked loading screen).
    ctx, page, errs, perrs = new(b)
    page.goto(URL); loaded(page)
    page.evaluate(f"""() => localStorage.setItem('{KEY}', JSON.stringify({{schemaVersion:2,savedAt:'x',campaignId:'campaign-1-first-muster',
      state:{{mode:'awaiting-choice',move:2,civicLevel:1,population:2,resources:{{wood:0}},builtBuildingIds:['lumberyard'],
      availableBuildingIds:['farm','swine-farm','woodcutter'],selectedBuildingId:null,activePlotIndex:null,constructionElapsed:0,buildingMaturity:{{}},armyReport:null}}}}))""")
    page.reload(); loaded(page, 15000)
    st = save(page)
    R["2_bad_save_recovers"] = {"cards": page.locator(".build-card .build-name").all_inner_texts(),
        "new_save_built": st["builtBuildingIds"], "pageerrors": perrs, "pass": st["builtBuildingIds"] == [] and not perrs}
    ctx.close()

    # 3. Art failure on pick: choice not committed, message shown, retry works.
    ctx, page, errs, perrs = new(b)
    block = {"on": True}
    page.route("**/*swine-farm*", lambda r: r.abort() if block["on"] and "import" not in r.request.url else r.continue_())
    page.goto(URL); loaded(page)
    set_speed8(page)
    page.click(".build-card >> text=Farm"); wait_move(page, 2); time.sleep(0.3)
    page.click(".build-card >> text=Swine Farm"); time.sleep(1.0)
    mode1 = page.evaluate("document.querySelector('#build-panel').classList.contains('hidden')")
    status1 = page.inner_text("#phase")
    state1 = save(page)
    block["on"] = False
    page.click(".build-card >> text=Swine Farm"); time.sleep(1.0)
    state2 = save(page)
    R["3_art_failure_retry"] = {"panel_hidden_after_fail": mode1, "status_after_fail": status1,
        "sim_mode_after_fail": state1["mode"], "sim_mode_after_retry": state2["mode"], "selected_after_retry": state2["selectedBuildingId"],
        "uncaught_pageerrors": perrs,
        "pass": (not mode1) and state1["mode"] == "awaiting-choice" and state2["selectedBuildingId"] == "swine-farm" and not perrs}
    ctx.close()

    # 4. Full playthrough at 8x with mid-game and post-completion reloads (tutorial enabled at start).
    ctx, page, errs, perrs = new(b, tutorial_done=False)
    page.goto(URL); loaded(page)
    tutorial_shown = page.is_visible("#tutorial-scrim")
    page.click("#tutorial-skip")
    set_speed8(page)
    order = []
    for move in range(1, 13):
        wait_move(page, move)
        page.wait_for_selector("#build-panel:not(.hidden) .build-card:not([disabled])", timeout=20000)
        name = page.locator(".build-card .build-name").first.inner_text()
        page.locator(".build-card").first.click()
        order.append(name)
        if move == 4:
            time.sleep(0.8)
            hud_before = page.inner_text("#stockpile-total"), page.inner_text("#population")
            page.reload(); loaded(page)
            hud_after = page.inner_text("#stockpile-total"), page.inner_text("#population")
            resumed_mid = save(page)["mode"] == "construction" and hud_before == hud_after
            set_speed8(page)
    page.wait_for_selector("#army-report:not(.hidden)", timeout=30000)
    outcome = page.inner_text("#army-outcome"); summary = page.inner_text("#army-summary")
    page.reload(); loaded(page)
    # Reopening a finished game replays the 16 s battle, then shows the same result.
    page.wait_for_selector("#army-report:not(.hidden)", timeout=40000)
    after_complete = page.inner_text("#army-outcome") == outcome
    time.sleep(1.0)
    page.screenshot(path=str(OUT / "final_city.png"))
    R["4_full_playthrough"] = {"tutorial_shown_on_fresh": tutorial_shown, "order": order, "outcome": outcome,
        "summary": summary[:110], "mid_game_resume_ok": resumed_mid, "post_complete_resume_ok": after_complete,
        "console_errors": errs, "pageerrors": perrs,
        "pass": tutorial_shown and resumed_mid and after_complete and not errs and not perrs}
    ctx.close()
    b.close()

print(json.dumps(R, indent=2))
print("ALL PASS" if all(v["pass"] for v in R.values()) else "SOME FAILED")
