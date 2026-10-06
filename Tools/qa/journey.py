"""Whole-game journey on the release ZIP, the way a player goes through it.

Run test-release.cmd (or: node Tools/dev/serve-release.mjs .tmp/release-test --no-open) first, then:
    python Tools/qa/journey.py 1920x1080      # also 390x844, 844x390, ...

Plays, at that frame size: the campaign map (a locked campaign can't start) ->
Campaign 1 with the full tutorial, the controls (pause, sound, View city), a
reload at move 6 (same state restored), the muster, a watched battle, the
result, the battle report -> Next: Campaign 2 with the sellsword market ->
the map (two won, Campaign 3 open) -> Campaign 3 played badly (a defeat,
Try again) -> a replay offer on Campaign 1 -> leaving a run for the map and
coming back (Continue settlement) -> Restart (asks once). Logs what each
screen says, lists console errors, warnings and failed requests, and saves
screenshots to Tools/qa/out/journey/. Read the log: it is a walkthrough, not
a pass/fail test.
"""
import json, sys, time, re, pathlib
from playwright.sync_api import sync_playwright

O = pathlib.Path(__file__).resolve().parent / "out" / "journey"; O.mkdir(parents=True, exist_ok=True)
URL = "http://127.0.0.1:4175/api/v1/games/grow-an-empire/play/index.html"
W, H = map(int, (sys.argv[1] if len(sys.argv) > 1 else "1920x1080").split("x"))
TAG = f"{W}x{H}"
LOG = []
def note(*a):
    s = " ".join(str(x) for x in a); LOG.append(s); print(s, flush=True)
shot_n = [0]
def shot(pg, name):
    shot_n[0] += 1; pg.screenshot(path=str(O / f"{TAG}_{shot_n[0]:02d}_{name}.png"))

MILITARY = ("Bow Hall", "Lohar Forge", "Akhara", "Ashvashala", "Bazaar", "House", "Royal Kitchen", "Ghee House")

def wait_choice_or_muster(pg, t=90000):
    pg.wait_for_selector("#build-panel:not(.hidden) .build-card, #build-panel:not(.hidden) .gather-button, #build-panel:not(.hidden) .report-continue, .flow-dialog[data-kind=muster]", timeout=t)
    if pg.is_visible("#build-panel:not(.hidden) .report-continue"):
        note("report:", pg.inner_text("#build-panel .move-report").replace("\n", " ")[:160])
        pg.click("#build-panel .report-continue")
        pg.wait_for_selector("#build-panel:not(.hidden) .build-card, #build-panel:not(.hidden) .gather-button", timeout=t)

def play_move(pg, strategy):
    wait_choice_or_muster(pg)
    if pg.is_visible(".flow-dialog[data-kind=muster]"): return "muster"
    cards = pg.locator("#build-options .build-card.affordable")
    names = cards.all_inner_texts()
    if names:
        idx = 0
        if strategy == "weak":
            civil = [i for i, n in enumerate(names) if not any(m in n for m in MILITARY)]
            idx = civil[-1] if civil else len(names) - 1
        name = names[idx].split("\n")[1] if "\n" in names[idx] else names[idx][:20]
        cards.nth(idx).click(); return f"built {name.strip()}"
    if pg.locator("#build-options .build-card.swappable").count():
        pg.locator("#build-options .build-card.swappable").first.click(); return "swapped"
    if pg.locator("#build-foot .gather-button").count():
        pg.locator("#build-foot .gather-button").click(); return "gathered"
    raise AssertionError("stuck: no card, no swap, no gather")

def play_campaign(pg, strategy, reload_at=None):
    moves = []
    for _ in range(40):
        wait_choice_or_muster(pg)
        if pg.is_visible(".flow-dialog[data-kind=muster]"): break
        move = int(pg.inner_text("#move").split(" ")[0])
        if reload_at and move == reload_at:
            before = (pg.inner_text("#move"), pg.inner_text("#stockpile-total"), pg.inner_text("#population"))
            pg.reload(); pg.wait_for_function("document.documentElement.dataset.booted==='true'", timeout=90000); pg.wait_for_timeout(800)
            # back into the city: the map may open with "Continue settlement"
            if pg.is_visible("#campaign-launch"):
                note("  after reload map button:", pg.inner_text("#campaign-launch"), "|", pg.inner_text("#campaign-state"))
                pg.click("#campaign-launch"); pg.wait_for_timeout(500)
                if pg.is_visible(".flow-dialog [data-action=begin]"): pg.click(".flow-dialog [data-action=begin]")
            wait_choice_or_muster(pg)
            after = (pg.inner_text("#move"), pg.inner_text("#stockpile-total"), pg.inner_text("#population"))
            note("  reload at move", move, "state", before, "->", after, "SAME" if before == after else "DIFFERENT")
            reload_at = None
            pg.keyboard.press("s"); pg.keyboard.press("s"); pg.keyboard.press("s")
        moves.append(play_move(pg, strategy)); pg.wait_for_timeout(120)
    return moves

def result_text(pg):
    pg.wait_for_selector(".flow-dialog[data-kind=result]", timeout=20000)
    return pg.inner_text(".flow-dialog")

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    mob = min(W, H) < 500
    ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=2 if mob else 1, has_touch=mob, is_mobile=mob)
    pg = ctx.new_page()
    errors, warnings, failed = [], [], []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: (m.type == "error" and errors.append(m.text)) or (m.type == "warning" and "GL Driver" not in m.text and "AudioContext" not in m.text and warnings.append(m.text)))
    pg.on("requestfailed", lambda r: failed.append(r.url))
    pg.on("response", lambda r: r.status >= 400 and failed.append(f"{r.status} {r.url}"))
    t0 = time.time()
    pg.goto(URL + "?reset"); pg.wait_for_function("document.documentElement.dataset.booted==='true'", timeout=90000); pg.wait_for_timeout(800)
    note("boot", round(time.time() - t0, 1), "s; layout", pg.evaluate("document.documentElement.dataset.layout"))
    shot(pg, "map_first")
    note("map:", pg.inner_text("#campaign-stage"), "|", pg.inner_text("#campaign-launch"), "|", pg.inner_text("#campaign-state"))
    # locked campaign selection
    pg.locator(".campaign-stop").nth(1).click(); pg.wait_for_timeout(500)
    note("select C2 (locked):", pg.inner_text("#campaign-launch"), "disabled" if pg.is_disabled("#campaign-launch") else "ENABLED", "|", pg.inner_text("#campaign-state"))
    pg.locator(".campaign-stop").nth(0).click(); pg.wait_for_timeout(500)

    # --- Campaign 1 with the full tutorial
    pg.click("#campaign-launch"); pg.wait_for_timeout(500); shot(pg, "c1_briefing")
    note("briefing:", pg.inner_text(".flow-dialog h2"), "| buttons", pg.locator(".flow-dialog button").all_inner_texts())
    pg.click(".flow-dialog [data-action=begin]"); pg.wait_for_timeout(500)
    note("tutorial shown:", pg.is_visible("#tutorial-scrim")); shot(pg, "c1_tutorial")
    pg.click("#tutorial-start"); pg.wait_for_timeout(500)
    note("coach step 1:", pg.is_visible("#tutorial-coach"), pg.inner_text("#tutorial-coach-title") if pg.is_visible("#tutorial-coach") else "")
    shot(pg, "c1_coach1")
    for _ in range(3): pg.keyboard.press("s")  # 8x: the software renderer is slow
    note("move 1:", play_move(pg, "best"))
    pg.wait_for_selector("#tutorial-next:not(.hidden)", timeout=240000); shot(pg, "c1_coach2")
    note("coach step 2:", pg.inner_text("#tutorial-coach-title")); pg.click("#tutorial-next")
    # controls: idle state toggle, pause/play, speed, mute
    wait_choice_or_muster(pg)
    note("app state while choosing:", pg.evaluate("document.getElementById('app').className"))
    shot(pg, "c1_move2_choice")
    for _ in range(3): pg.keyboard.press("s")
    note("speed now:", pg.evaluate("document.getElementById('speed-toggle').textContent"))
    m = play_move(pg, "best"); pg.wait_for_timeout(600)
    cls = pg.evaluate("document.getElementById('app').className")
    note("move 2:", m, "| app state while building:", cls, "| controls tab visible:", pg.is_visible("#city-ui-toggle"))
    if pg.is_visible("#city-ui-toggle"):
      pg.keyboard.press("p")  # pause, so the next choice can't retract the controls mid-check
      try:
        pg.click("#city-ui-toggle", timeout=5000); pg.wait_for_timeout(400); shot(pg, "c1_controls_open")
        note("paused via P:", pg.inner_text("#play-toggle"), "| more visible:", pg.is_visible("#controls-more"))
        pg.click("#play-toggle", timeout=5000); pg.wait_for_timeout(200); note("play ->", pg.inner_text("#play-toggle"))
        pg.click("#play-toggle", timeout=5000); pg.wait_for_timeout(200); note("pause ->", pg.inner_text("#play-toggle"))
        if pg.is_visible("#controls-more"): pg.click("#controls-more", timeout=5000); pg.wait_for_timeout(200)
        pg.click("#mute-toggle", timeout=5000); note("mute ->", pg.inner_text("#mute-toggle")); pg.click("#mute-toggle", timeout=5000)
        pg.click("#city-view-toggle", timeout=5000); pg.wait_for_timeout(300)
        note("after 'View city':", pg.evaluate("document.getElementById('app').className"), "| tab back:", pg.is_visible("#city-ui-toggle"))
      except Exception as e:
        note("CONTROL CHECK FAILED:", str(e)[:200])
      pg.keyboard.press("p")
      note("resumed:", pg.evaluate("document.getElementById('play-toggle').textContent"))
    while "8" not in pg.evaluate("document.getElementById('speed-toggle').textContent"): pg.keyboard.press("s")
    note("speed for the run:", pg.evaluate("document.getElementById('speed-toggle').textContent"))
    moves = play_campaign(pg, "best", reload_at=6)
    note("C1 moves:", moves)
    shot(pg, "c1_muster"); note("muster:", pg.inner_text(".flow-dialog").replace("\n", " | ")[:400])
    if pg.is_visible(".flow-dialog [data-action=best]"): pg.click(".flow-dialog [data-action=best]")
    pg.click(".flow-dialog [data-action=fight]"); pg.wait_for_timeout(1500); shot(pg, "c1_battle")
    # watch the battle to the end this time (no skip)
    r1 = result_text(pg); shot(pg, "c1_result")
    note("C1 result:", r1.replace("\n", " | ")[:500])
    note("result buttons:", pg.locator(".flow-dialog button").all_inner_texts())
    # battle report after closing
    pg.click(".flow-dialog [data-action=city]"); pg.wait_for_timeout(600)
    shot(pg, "c1_view_city")
    note("after 'view the city': report button visible:", pg.is_visible("#muster-toggle"), "| controls tab:", pg.is_visible("#city-ui-toggle"))
    if pg.is_visible("#city-ui-toggle"): pg.click("#city-ui-toggle"); pg.wait_for_timeout(300)
    if pg.is_visible("#muster-toggle"):
        pg.click("#muster-toggle"); pg.wait_for_timeout(400); note("battle report reopens result:", pg.is_visible(".flow-dialog[data-kind=result]"))
    else:
        pg.evaluate("document.getElementById('muster-toggle').click()"); pg.wait_for_timeout(400); note("battle report (via DOM) reopens:", pg.is_visible(".flow-dialog[data-kind=result]"))
    nxt = pg.locator(".flow-dialog [data-action=next]")
    note("next button:", nxt.inner_text() if nxt.count() else None)
    nxt.click(); pg.wait_for_timeout(600)

    # --- Campaign 2, best play
    shot(pg, "c2_briefing"); note("C2 briefing:", pg.inner_text(".flow-dialog h2") if pg.is_visible(".flow-dialog") else "NO BRIEFING")
    pg.click(".flow-dialog [data-action=begin]"); pg.wait_for_timeout(400)
    note("tutorial again on C2:", pg.is_visible("#tutorial-scrim"))
    for _ in range(3): pg.keyboard.press("s")
    moves = play_campaign(pg, "best"); note("C2 moves:", moves)
    shot(pg, "c2_muster"); note("C2 muster:", pg.inner_text(".flow-dialog").replace("\n", " | ")[:500])
    if pg.is_visible(".flow-dialog [data-step='archers:1']"):
        pg.click(".flow-dialog [data-step='archers:1']"); note("hired 1 archer:", pg.inner_text(".flow-dialog [data-spend]"))
    if pg.is_visible(".flow-dialog [data-action=best]"): pg.click(".flow-dialog [data-action=best]"); note("best mix:", pg.inner_text(".flow-dialog [data-forecast]"))
    pg.click(".flow-dialog [data-action=fight]"); pg.wait_for_selector(".battle-hud:not(.hidden), .flow-dialog[data-kind=result]"); pg.is_visible(".battle-hud:not(.hidden)") and pg.click(".battle-hud .bh-skip", timeout=3000)
    r2 = result_text(pg); shot(pg, "c2_result"); note("C2 result:", r2.replace("\n", " | ")[:400])

    # --- map after two campaigns
    pg.click(".flow-dialog [data-action=map]"); pg.wait_for_timeout(900); shot(pg, "map_after_c2")
    note("map:", pg.inner_text("#campaign-stage"), "|", pg.inner_text("#campaign-name"), "|", pg.inner_text("#campaign-launch"), "|", pg.inner_text("#campaign-state"))
    note("stops won:", pg.locator(".campaign-stop.completed").count(), "| locked:", pg.locator(".campaign-stop.locked").count())

    # --- Campaign 3 played weakly -> expect a defeat; then Try again
    pg.click("#campaign-launch"); pg.wait_for_timeout(500); pg.click(".flow-dialog [data-action=begin]"); pg.wait_for_timeout(400)
    for _ in range(3): pg.keyboard.press("s")
    moves = play_campaign(pg, "weak"); note("C3 weak moves:", moves)
    note("C3 muster:", pg.inner_text(".flow-dialog [data-forecast]") if pg.is_visible(".flow-dialog [data-forecast]") else "")
    pg.click(".flow-dialog [data-action=fight]"); pg.wait_for_selector(".battle-hud:not(.hidden), .flow-dialog[data-kind=result]"); pg.is_visible(".battle-hud:not(.hidden)") and pg.click(".battle-hud .bh-skip", timeout=3000)
    r3 = result_text(pg); shot(pg, "c3_result"); note("C3 result:", r3.replace("\n", " | ")[:500])
    note("C3 buttons:", pg.locator(".flow-dialog button").all_inner_texts())
    pg.click(".flow-dialog [data-action=map]"); pg.wait_for_timeout(800); shot(pg, "map_after_c3")
    note("map after C3:", pg.inner_text("#campaign-stage"), "|", pg.inner_text("#campaign-name"), "|", pg.inner_text("#campaign-launch"), "|", pg.inner_text("#campaign-state"))
    # replay C1 from the map for more stars
    pg.locator(".campaign-stop").nth(0).click(); pg.wait_for_timeout(500)
    note("C1 on map:", pg.inner_text("#campaign-launch"), "|", pg.inner_text("#campaign-state"))
    # Start C3 again ("try again" path) and leave mid-run -> map shows Continue
    pg.locator(".campaign-stop").nth(2).click(); pg.wait_for_timeout(400)
    pg.click("#campaign-launch"); pg.wait_for_timeout(500)
    if pg.is_visible(".flow-dialog [data-action=begin]"): pg.click(".flow-dialog [data-action=begin]"); pg.wait_for_timeout(300)
    for _ in range(3): note("C3 retry:", play_move(pg, "best")); pg.wait_for_timeout(200)
    wait_choice_or_muster(pg)
    pg.evaluate("document.getElementById('map-toggle').click()"); pg.wait_for_timeout(700)
    shot(pg, "map_mid_run"); note("map mid-run:", pg.inner_text("#campaign-name"), "|", pg.inner_text("#campaign-launch"), "|", pg.inner_text("#campaign-state"))
    pg.click("#campaign-launch"); pg.wait_for_timeout(600)
    note("continue -> dialog?", pg.is_visible(".flow-dialog"), "| move", pg.inner_text("#move"), "| panel", pg.is_visible("#build-panel"))
    # Restart (secondary control)
    pg.evaluate("document.getElementById('restart').click()"); pg.wait_for_timeout(300)
    note("restart, first press:", pg.evaluate("document.getElementById('restart').textContent"), "| move still", pg.inner_text("#move"))
    pg.evaluate("document.getElementById('restart').click()"); pg.wait_for_timeout(800)
    note("after restart: move", pg.inner_text("#move"), "| dialog", pg.inner_text(".flow-dialog h2") if pg.is_visible(".flow-dialog") else None, "| map open", pg.is_visible("#campaign-map"))
    shot(pg, "after_restart")
    sdk = pg.evaluate("(window.__sdkCalls||[]).map(c => c.method + (c.method==='track' ? ':' + c.args[0] : ''))")
    note("SDK calls:", sdk[:6], "... tracks:", sorted(set(x for x in sdk if x.startswith('track'))), "| saves:", sdk.count("saveGameProgress"))
    note("ERRORS:", errors); note("WARNINGS:", warnings[:10]); note("FAILED:", failed)
    b.close()
(O / f"{TAG}_log.txt").write_text("\n".join(LOG))
