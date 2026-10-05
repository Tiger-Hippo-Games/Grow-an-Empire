"""Gameplay regression: failed boot keeps the save, unusable saves recover, art failures can be retried,
a full 12-move campaign through the muster and battle (with reloads mid-game, at the muster and after the
result), keyboard shortcuts, and stars unlocking the next campaign."""
# Run from the project root with the servers up (see Tools/qa/README.md).
import pathlib as _pl
import sys
OUT = _pl.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
import json, time
from playwright.sync_api import sync_playwright
from flow import enter, fight, play_move, play_to_muster  # noqa: E402

URL = "http://127.0.0.1:4173/"
KEY = "grow-an-empire:save:v1"
R = {}

def new(browser, tutorial_done=True):
    ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    if tutorial_done:
        ctx.add_init_script("localStorage.setItem('grow-an-empire:tutorial:v1','complete')")
    page = ctx.new_page()
    errs, pageerrs = [], []
    page.on("pageerror", lambda e: pageerrs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text))
    return ctx, page, errs, pageerrs

def loaded(page, t=30000):
    page.wait_for_selector("#loading.hidden", state="attached", timeout=t)

def saved(page):
    raw = page.evaluate(f"localStorage.getItem('{KEY}')")
    return json.loads(raw) if raw else None

def set_speed8(page):
    for _ in range(3): page.keyboard.press("s")  # the control bar hides while a choice is open; S is its shortcut

def wait_move(page, n, t=20000):
    page.wait_for_function(f"document.querySelector('#move').textContent.startsWith('{n} ')", timeout=t)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

    # 1. Failed boot must not clobber the save; the error must be readable.
    ctx, page, errs, perrs = new(b)
    page.goto(URL + "?reset"); loaded(page); enter(page)
    page.click("#build-options .build-card.affordable >> nth=0"); time.sleep(0.4)
    before = saved(page)["state"]
    page.route("**/*village-empty-terrain*", lambda r: r.continue_() if "import" in r.request.url else r.abort())
    page.reload(); time.sleep(3)
    text = page.inner_text("#loading")
    has_reload = page.locator("#loading button").count() == 1
    page.goto("about:blank")
    p2 = ctx.new_page(); p2.goto(URL); loaded(p2)
    after = saved(p2)["state"]
    R["1_failed_boot_keeps_save"] = {"error_text": " ".join(text.split())[:140], "reload_button": has_reload,
        "before_selected": before["selectedBuildingId"], "after_selected": after["selectedBuildingId"],
        "pass": before["selectedBuildingId"] == after["selectedBuildingId"] and has_reload}
    ctx.close()

    # 2. Unusable save -> fresh game, not a bricked loading screen.
    ctx, page, errs, perrs = new(b)
    page.goto(URL); loaded(page)
    page.evaluate(f"""() => localStorage.setItem('{KEY}', JSON.stringify({{schemaVersion:2,savedAt:'x',campaignId:'campaign-1-first-muster',
      state:{{mode:'awaiting-choice',move:2,civicLevel:1,population:2,resources:{{wood:0}},builtBuildingIds:['lumberyard'],
      availableBuildingIds:['farm','swine-farm','woodcutter'],selectedBuildingId:null,activePlotIndex:null,constructionElapsed:0,buildingMaturity:{{}},armyReport:null}}}}))""")
    page.reload(); loaded(page, 15000); enter(page)
    st = saved(page)["state"]
    R["2_bad_save_recovers"] = {"cards": page.locator(".build-card .build-name").all_inner_texts(),
        "new_save_built": st["builtBuildingIds"], "pageerrors": perrs, "pass": st["builtBuildingIds"] == [] and not perrs}
    ctx.close()

    # 3. Art failure on pick: choice not committed (and not paid for), message shown, retry works.
    ctx, page, errs, perrs = new(b)
    block = {"on": True}
    page.route("**/*swine-farm*", lambda r: r.abort() if block["on"] and "import" not in r.request.url else r.continue_())
    page.goto(URL + "?reset"); loaded(page); enter(page)
    set_speed8(page)
    page.click(".build-card >> text=Farm"); wait_move(page, 2); time.sleep(0.3)
    wood_before = saved(page)["state"]["resources"]["wood"]
    page.click(".build-card >> text=Goshala"); time.sleep(1.0)
    panel_hidden = page.evaluate("document.querySelector('#build-panel').classList.contains('hidden')")
    state1 = saved(page)["state"]
    block["on"] = False
    page.click(".build-card >> text=Goshala"); time.sleep(1.0)
    state2 = saved(page)["state"]
    R["3_art_failure_retry"] = {"panel_hidden_after_fail": panel_hidden, "status_after_fail": page.inner_text("#phase"),
        "mode_after_fail": state1["mode"], "wood_kept": state1["resources"]["wood"] == wood_before,
        "selected_after_retry": state2["selectedBuildingId"], "pageerrors": perrs,
        "pass": (not panel_hidden) and state1["mode"] == "awaiting-choice" and state1["resources"]["wood"] == wood_before
            and state2["selectedBuildingId"] == "swine-farm" and not perrs}
    ctx.close()

    # 4. A full campaign at 8x: tutorial on a fresh start, keyboard pick, reload mid-game and at the muster,
    #    battle, result, stars saved, reload after the result, next campaign opened.
    ctx, page, errs, perrs = new(b, tutorial_done=False)
    page.goto(URL + "?reset"); loaded(page)
    enter(page, skip_tutorial=False)
    tutorial_shown = page.is_visible("#tutorial-scrim")
    page.click("#tutorial-skip")
    set_speed8(page)
    page.keyboard.press("1"); time.sleep(0.3)
    key_pick = saved(page)["state"]["mode"] == "construction"
    checks = {"resumed_mid": None}
    def on_move(move):
        if move == 4 and checks["resumed_mid"] is None:
            play_move(page); time.sleep(0.8)
            before = page.inner_text("#stockpile-total"), page.inner_text("#population")
            page.reload(); loaded(page); enter(page)
            after = page.inner_text("#stockpile-total"), page.inner_text("#population")
            checks["resumed_mid"] = saved(page)["state"]["mode"] == "construction" and before == after
            set_speed8(page)
            page.wait_for_selector("#build-panel:not(.hidden) .build-card, .flow-dialog[data-kind=muster]", timeout=30000)
    play_to_muster(page, on_move)
    page.screenshot(path=str(OUT / "muster.png"))
    page.reload(); loaded(page); enter(page)
    muster_after_reload = page.is_visible(".flow-dialog[data-kind=muster]")
    result = fight(page)
    page.screenshot(path=str(OUT / "result.png"))
    won = "Victory" in result
    game = saved(page)
    stars = (game.get("campaignStars") or {}).get("campaign-1-first-muster", 0)
    page.reload(); loaded(page)
    map_after = page.inner_text("#campaign-state")
    page.click("#campaign-map .campaign-stop >> nth=1"); time.sleep(0.2)
    second_open = not page.is_disabled("#campaign-launch")
    R["4_full_campaign"] = {"tutorial_shown_on_fresh": tutorial_shown, "key_1_picks": key_pick, "mid_game_resume_ok": checks["resumed_mid"],
        "muster_after_reload": muster_after_reload, "result": " ".join(result.split())[:120], "stars_saved": stars,
        "map_after": map_after, "campaign_2_open": second_open, "console_errors": errs, "pageerrors": perrs,
        "pass": tutorial_shown and key_pick and checks["resumed_mid"] and muster_after_reload and won and stars >= 1 and second_open and not errs and not perrs}
    ctx.close()
    b.close()

print(json.dumps(R, indent=2))
print("ALL PASS" if all(v["pass"] for v in R.values()) else "SOME FAILED")
