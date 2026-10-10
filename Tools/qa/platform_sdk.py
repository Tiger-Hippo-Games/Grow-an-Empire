"""Portal SDK checks: mock SDK call order (init, login, getGameProgress), cloud restore, portal pause/resume/session-end messages in an iframe, and offline play."""
# Run from the project root with the servers up (see Tools/qa/README.md).
import pathlib as _pl
OUT = _pl.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
import json, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from flow import enter, play_move, speed8 as flow_speed8  # noqa: E402
BASE = "http://127.0.0.1:4173/"
KEY = "grow-an-empire:save:v1"
R = {}

def booted(page, t=30000):
    page.wait_for_function("document.documentElement.dataset.booted === 'true'", timeout=t)

def calls(page):
    return page.evaluate("(window.__goLiveMock && window.__goLiveMock.calls || []).map(c => c.method + (c.method==='track' ? ':' + c.args[0] : ''))")

def speed8(page):
    flow_speed8(page)  # the control bar hides while a choice is open; S is its shortcut

def play_moves(page, n):
    for _ in range(n):
        play_move(page)
        page.wait_for_selector("#build-panel.hidden", state="attached", timeout=5000)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])

    # A. Mock SDK lifecycle + cloud restore (a signed-in player: guests keep no cloud save).
    ctx = b.new_context(viewport={"width": 1280, "height": 800})
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errs.append(m.text))
    page.goto(BASE + "?platform=mock&auth=email&reset"); booted(page)
    enter(page, skip_tutorial=False)
    tutorial = page.is_visible("#tutorial-scrim")
    page.click("#tutorial-skip")
    speed8(page)
    play_moves(page, 2)
    page.wait_for_function("document.querySelector('#move').textContent.startsWith('3 ')", timeout=30000)
    time.sleep(5.5)  # SDK 1.5.0 cloud checkpoint cadence
    first_calls = calls(page)
    cloud = json.loads(page.evaluate("localStorage.getItem('grow-an-empire:mock-cloud')") or "null")
    # Wipe the browser save; keep the mock cloud -> the game must resume from the cloud.
    page.evaluate(f"localStorage.removeItem('{KEY}')")
    page.goto(BASE + "?platform=mock&auth=email"); booted(page)
    resumed_move = page.inner_text("#move")
    enter(page, skip_tutorial=False)
    tutorial_again = page.is_visible("#tutorial-scrim")
    R["A_mock_sdk"] = {
        "tutorial_on_fresh": tutorial,
        "call_order_head": first_calls[:6],
        "tracked": sorted(set(c for c in first_calls if c.startswith("track:"))),
        "cloud_moves_built": len(cloud["state"]["builtBuildingIds"]) if cloud else None,
        "cloud_has_runId_settings": bool(cloud and cloud.get("runId") and cloud.get("settings", {}).get("tutorialComplete")),
        "resumed_from_cloud_move": resumed_move,
        "tutorial_not_shown_again": not tutorial_again,
        "errors": errs,
    }
    R["A_mock_sdk"]["pass"] = (first_calls[:3] == ["init", "login", "getGameProgress"] and "startSession" in first_calls
        and {"track:game_start", "track:level_start", "track:level_completed", "track:tutorial_skipped"} <= set(first_calls)
        and R["A_mock_sdk"]["cloud_moves_built"] >= 2 and resumed_move.startswith("3 ") and not tutorial_again and not errs)
    ctx.close()

    # B. Portal iframe harness: GAME_READY, pause/resume, session end.
    ctx = b.new_context(viewport={"width": 1700, "height": 900})
    page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(BASE + "Tools/dev/iframe-test.html")
    game = page.frame_locator("#game")
    page.wait_for_function("document.getElementById('game').contentDocument?.documentElement.dataset.booted === 'true'", timeout=30000)
    time.sleep(0.5)
    fr = page.frame(url=lambda u: "platform=mock" in u)
    enter(fr)
    page.click("[data-msg=GP_PAUSE]"); time.sleep(0.3)
    paused_label = fr.get_attribute("#play-toggle", "aria-label")
    page.click("[data-msg=GP_RESUME]"); time.sleep(0.3)
    resumed_label = fr.get_attribute("#play-toggle", "aria-label")
    page.click("[data-msg=GP_SESSION_END]"); time.sleep(0.5)
    log_text = page.inner_text("#log")
    R["B_iframe_portal"] = {
        "game_ready_received": '"type":"GAME_READY"' in log_text,
        "pause_label": paused_label, "resume_label": resumed_label,
        "endSession_logged": "Platform.endSession(" in log_text,
        "errors": errs,
    }
    R["B_iframe_portal"]["pass"] = (R["B_iframe_portal"]["game_ready_received"] and paused_label == "Play" and resumed_label == "Pause"
        and R["B_iframe_portal"]["endSession_logged"] and not errs)
    page.screenshot(path=str(OUT / "iframe_harness.png"))
    ctx.close()

    # C. Offline (no SDK): plays, saves locally, no errors.
    ctx = b.new_context(); page = ctx.new_page(); errs = []; infos = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: (m.type == "error" and errs.append(m.text)) or (m.type == "info" and infos.append(m.text)))
    page.goto(BASE + "?reset"); booted(page)
    enter(page); speed8(page); play_moves(page, 1)
    time.sleep(0.5)
    local = json.loads(page.evaluate(f"localStorage.getItem('{KEY}')"))
    R["C_offline"] = {"platform_line": [i for i in infos if "platform:" in i], "saved_locally": local["state"]["mode"], "errors": errs}
    R["C_offline"]["pass"] = any("platform: local" in i for i in infos) and local["state"]["mode"] == "construction" and not errs
    ctx.close()

    # D. Guest (signed out): plays normally; no cloud read or write.
    ctx = b.new_context(); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(BASE + "?platform=mock&reset"); booted(page)
    page.evaluate("localStorage.removeItem('grow-an-empire:mock-cloud')")
    enter(page); speed8(page); play_moves(page, 2)
    time.sleep(5.5)
    guest_calls = calls(page)
    R["D_guest_no_cloud"] = {
        "cloud_calls": [c for c in guest_calls if c in ("getGameProgress", "saveGameProgress")],
        "mock_cloud": page.evaluate("localStorage.getItem('grow-an-empire:mock-cloud')"),
        "local_save": bool(page.evaluate(f"localStorage.getItem('{KEY}')")),
        "errors": errs,
    }
    R["D_guest_no_cloud"]["pass"] = (not R["D_guest_no_cloud"]["cloud_calls"] and R["D_guest_no_cloud"]["mock_cloud"] is None
        and R["D_guest_no_cloud"]["local_save"] and not errs)
    ctx.close()
    b.close()

print(json.dumps(R, indent=2))
print("ALL PASS" if all(v["pass"] for v in R.values()) else "SOME FAILED")
