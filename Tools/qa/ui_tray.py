"""Exercise persistent HUD, bottom choices and move countdown at desktop/phone sizes."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
import flow

OUT = Path(__file__).parent / "out" / "ui-tray"
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get("GAE_URL", "http://127.0.0.1:4174/")
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    for w, h in [(1920, 1080), (844, 390), (390, 844)]:
        page = browser.new_page(viewport={"width": w, "height": h})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL + "?reset")
        page.wait_for_function("document.documentElement.dataset.booted==='true'")

        def resources():
            assert page.is_visible("#move")
            page.click("#stockpile-toggle")
            assert page.is_visible("#resource-grid")
            page.keyboard.press("Escape")
            assert not page.is_visible("#resource-grid")

        def cards():
            page.wait_for_timeout(300)
            rows = page.locator(".build-slot").evaluate_all("els=>els.map(e=>e.getBoundingClientRect().y)")
            assert max(rows) - min(rows) < 2
            # Every card's benefit fits vertically inside its scrolling tray.
            assert page.locator(".build-benefit").evaluate_all("""els=>els.every(e=>{
                const r=e.getBoundingClientRect(), p=document.getElementById('build-options').getBoundingClientRect();
                return getComputedStyle(e).display!=='none' && r.top>=p.top-1 && r.bottom<=p.bottom+1;
            })""")
            assert "Game speed" in page.inner_text(".speed-control")

        resources()
        flow.enter(page)
        flow.speed8(page)
        cards()
        page.screenshot(path=str(OUT / f"choice-{w}x{h}.png"))
        resources()
        flow.play_move(page)
        assert page.is_visible("#move")
        page.wait_for_selector(".move-countdown:not(.hidden)", timeout=60000)
        assert page.inner_text(".move-countdown") == "11 moves left"
        page.screenshot(path=str(OUT / f"countdown-{w}x{h}.png"))
        page.wait_for_selector("#build-panel .report-continue")
        resources()
        flow.past_report(page)
        cards()
        # Traverse all later cards, reports, muster, battle and result.
        flow.play_to_muster(page, on_move=lambda _: (flow.past_report(page), cards()))
        resources()
        page.click(".flow-dialog [data-action=fight]")
        page.wait_for_selector(".flow-dialog[data-kind=battle], .flow-dialog[data-kind=result]")
        resources()
        page.wait_for_selector(".flow-dialog[data-kind=result]", timeout=15000)
        resources()
        results[f"{w}x{h}"] = {"errors": errors, "passed": not errors}
        page.context.close()
    browser.close()
print(json.dumps(results, indent=2))
assert all(r["passed"] for r in results.values())
