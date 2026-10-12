"""Verify the unpacked release in a real 1920x1080 portal iframe.

Start Tools/dev/serve-release.mjs with the unpacked ZIP, then run this script.
Uses its local SDK stand-in; never contacts or changes the live portal.
"""
import json
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from flow import fight, play_move, play_to_muster, speed8

OUT = pathlib.Path(__file__).resolve().parent / "out" / "portal"
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("GAE_RELEASE_URL", "http://127.0.0.1:4175/")

LAYOUT = """() => {
  const app = document.getElementById('app').getBoundingClientRect();
  const selectors = ['.flow-scrim:not(.hidden) .flow-dialog',
    '.realm-scrim:not(.hidden) .realm-board',
    '#campaign-map:not(.hidden)', '#build-panel:not(.hidden)', '.speed-control'];
  const offscreen = selectors.flatMap(selector => [...document.querySelectorAll(selector)])
    .filter(el => el.offsetParent && getComputedStyle(el).visibility !== 'hidden')
    .filter(el => { const r = el.getBoundingClientRect();
      return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1; })
    .map(el => el.className);
  return { width: innerWidth, height: innerHeight, scale: window.__gaeStageScale,
    layout: document.documentElement.dataset.layout,
    fills: Math.abs(app.width - innerWidth) < 1 && Math.abs(app.height - innerHeight) < 1,
    scroll: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    offscreen };
}"""

results = {"screens": {}}
errors, warnings, failed, harness_warnings = [], [], [], []
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    context = browser.new_context(viewport={"width": 1920, "height": 1140})
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    def console(message):
        if message.type == "error":
            errors.append(message.text)
        elif message.type == "warning":
            # Chromium warns about the local harness's same-origin sandbox and
            # screenshot readbacks. Keep them in the report, apart from game warnings.
            if message.text.startswith("An iframe which has both allow-scripts and allow-same-origin") or "GPU stall due to ReadPixels" in message.text:
                harness_warnings.append(message.text)
            else:
                warnings.append(message.text)

    page.on("console", console)
    page.on("requestfailed", lambda r: failed.append({"url": r.url, "failure": r.failure}))
    page.on("response", lambda r: failed.append({"url": r.url, "status": r.status}) if r.status >= 400 else None)
    context.add_init_script("""window.__portalReady = [];
      addEventListener('message', e => {
        if (e.source === document.getElementById('game')?.contentWindow && e.data?.type === 'GAME_READY')
          window.__portalReady.push(e.data);
      });""")
    page.goto(URL + "?size=1920x1080")
    page.wait_for_function("document.getElementById('game')?.contentDocument?.documentElement.dataset.booted === 'true'", timeout=60000)
    # The shared flow works with Page/Frame, so obtain the actual Frame.
    game = page.locator("#game").element_handle().content_frame()

    def screen(name):
        results["screens"][name] = game.evaluate(LAYOUT)
        page.locator("#game").screenshot(path=str(OUT / f"{name}.png"))

    screen("map")
    game.click("#campaign-realm")
    screen("realm")
    page.keyboard.press("Shift+Tab")
    results["realm_focus_trapped"] = game.evaluate("document.querySelector('.realm-board').contains(document.activeElement)")
    page.keyboard.press("Escape")
    results["realm_focus_returned"] = game.evaluate("document.activeElement.id === 'campaign-realm'")
    game.click("#campaign-launch")
    screen("briefing")
    game.click(".flow-dialog [data-action=more]")
    results["details_opened"] = game.is_visible(".flow-dialog.show-extra .flow-extra")
    screen("briefing_details")
    game.click(".flow-dialog [data-action=begin]")
    game.wait_for_selector("#tutorial-skip", state="visible")
    screen("tutorial")
    game.click("#tutorial-skip")
    speed8(game)
    screen("choice")
    page.evaluate("document.getElementById('game').contentWindow.postMessage({type:'GP_PAUSE'}, '*')")
    game.wait_for_function("document.getElementById('play-toggle').getAttribute('aria-label') === 'Play'")
    page.evaluate("document.getElementById('game').contentWindow.postMessage({type:'GP_RESUME'}, '*')")
    game.wait_for_function("document.getElementById('play-toggle').getAttribute('aria-label') === 'Pause'")
    results["pause_resume"] = True
    play_move(game)
    game.wait_for_selector("#build-panel:not(.hidden) .report-continue", timeout=60000)
    screen("report")
    move_before = game.inner_text("#move")
    page.keyboard.press("1")
    results["report_guards_shortcuts"] = game.is_visible("#build-panel .report-continue") and game.inner_text("#move") == move_before
    play_to_muster(game)
    screen("muster")
    results["result"] = fight(game)
    screen("result")
    results["next_unlocked"] = game.is_visible(".flow-dialog [data-action=next]")
    game.click(".flow-dialog [data-action=map]")
    screen("progress_map")
    results["completed_campaigns"] = game.locator(".campaign-stop.completed").count()
    results["ready"] = page.evaluate("window.__portalReady")
    results["asset_health"] = game.evaluate("window.__gaeAssetHealth")
    results["guest_cloud_calls"] = game.evaluate("(window.__sdkCalls || []).filter(c => ['getGameProgress','saveGameProgress','submitScore'].includes(c.method))")
    page.evaluate("document.getElementById('game').contentWindow.postMessage({type:'GP_SESSION_END'}, '*')")
    game.wait_for_function("(window.__sdkCalls || []).some(c => c.method === 'endSession')")
    results["session_end"] = True
    browser.close()

results.update(errors=errors, warnings=warnings, harness_warnings=harness_warnings, failed_requests=failed)
health = results["asset_health"]
results["pass"] = (all(s["width"] == 1920 and s["height"] == 1080 and s["scale"] == 1.5
    and s["layout"] == "fixed" and s["fills"] and not s["scroll"] and not s["offscreen"]
    for s in results["screens"].values()) and len(results["ready"]) == 1
    and results["next_unlocked"] and results["completed_campaigns"] == 1
    and results["realm_focus_trapped"] and results["realm_focus_returned"]
    and results["details_opened"] and results["report_guards_shortcuts"]
    and not results["guest_cloud_calls"] and not health["imagesFailed"]
    and health["font"] == "loaded" and health["soundsPlayed"] > 0
    and not errors and not warnings and not failed)
(OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results, indent=2))
print("ALL PASS" if results["pass"] else "FAILED")
sys.exit(0 if results["pass"] else 1)
