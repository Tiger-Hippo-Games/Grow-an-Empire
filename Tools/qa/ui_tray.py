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
    for w, h in [(844, 390), (390, 844), (1920, 1080)]:
        page = browser.new_page(viewport={"width": w, "height": h})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL + "?reset")
        page.wait_for_function("document.documentElement.dataset.booted==='true'")

        def resources():
            assert page.is_visible("#move")
            if page.is_visible('.flow-scrim:not(.hidden) .flow-dialog'):
                bounds = page.locator('.flow-scrim:not(.hidden) .flow-dialog').evaluate("""e=>{const d=e.getBoundingClientRect(),h=document.getElementById('resource-hud').getBoundingClientRect();return {top:d.top,hudBottom:h.bottom}}""")
                assert bounds['top'] >= bounds['hudBottom']+8, bounds
            page.click("#stockpile-toggle")
            assert page.is_visible("#resource-grid")
            page.keyboard.press("Escape")
            assert not page.is_visible("#resource-grid")

        def cards():
            page.wait_for_timeout(300)
            rows = page.locator(".build-slot").evaluate_all("els=>els.map(e=>e.getBoundingClientRect().y)")
            assert max(rows) - min(rows) < 2
            # Every card's benefit fits vertically inside its scrolling tray.
            benefits = page.locator(".build-benefit").evaluate_all("""els=>els.map(e=>{
                const text=document.createRange(); text.selectNodeContents(e);
                const r=text.getBoundingClientRect(), p=document.getElementById('build-options').getBoundingClientRect();
                return {text:e.textContent, top:r.top, bottom:r.bottom, trayTop:p.top, trayBottom:p.bottom,
                  fits:getComputedStyle(e).display!=='none' && r.top>=p.top-1 && r.bottom<=p.bottom+1};
            })""")
            assert all(b['fits'] for b in benefits), benefits
            assert "Game speed" in page.inner_text(".speed-control")

        resources()
        flow.enter(page)
        flow.speed8(page)
        page.screenshot(path=str(OUT / f"choice-{w}x{h}.png"))
        cards()
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
        def inspect_move(move):
            flow.past_report(page)
            cards()
            if move in (4,8):
                page.screenshot(path=str(OUT / f'city-{move}-{w}x{h}.png'))
        flow.play_to_muster(page, on_move=inspect_move)
        resources()
        page.click(".flow-dialog [data-action=fight]")
        page.wait_for_selector(".flow-dialog[data-kind=battle], .flow-dialog[data-kind=result]")
        resources()
        if page.is_visible('.flow-dialog[data-kind=battle]'):
            frame = page.locator('.popup-battlefield').evaluate("""e=>{const f=e.getBoundingClientRect(),d=e.closest('.flow-dialog').getBoundingClientRect(),s=document.querySelector('[data-action=skip]').getBoundingClientRect();return {top:f.top,bottom:f.bottom,left:f.left,right:f.right,dialogTop:d.top,dialogBottom:d.bottom,skipTop:s.top,skipBottom:s.bottom,skipLeft:s.left,skipRight:s.right}}""")
            assert frame['top'] >= frame['dialogTop'] and frame['bottom'] <= frame['dialogBottom'], frame
            overlap_x = min(frame['right'],frame['skipRight'])-max(frame['left'],frame['skipLeft'])
            overlap_y = min(frame['bottom'],frame['skipBottom'])-max(frame['top'],frame['skipTop'])
            assert overlap_x <= 0 or overlap_y <= 0, frame
            page.wait_for_timeout(1100)
            page.screenshot(path=str(OUT / f'battle-{w}x{h}.png'))
        page.wait_for_selector(".flow-dialog[data-kind=result]", timeout=15000)
        page.screenshot(path=str(OUT / f'result-{w}x{h}.png'))
        resources()
        results[f"{w}x{h}"] = {"errors": errors, "passed": not errors}
        page.context.close()
    browser.close()
print(json.dumps(results, indent=2))
assert all(r["passed"] for r in results.values())
