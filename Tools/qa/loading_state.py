"""Verify the release loader during a slow boot and immediate hint cleanup on readiness."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("GAE_URL", "http://127.0.0.1:4175/api/v1/games/grow/play/")
OUT = Path(__file__).parent / "out" / "loading"
OUT.mkdir(parents=True, exist_ok=True)
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    for width, height in [(1920, 1080), (390, 844)]:
        page = browser.new_page(viewport={"width": width, "height": height})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        cdp = page.context.new_cdp_session(page)
        cdp.send("Network.enable")
        cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 2000,
                 "downloadThroughput": 100000, "uploadThroughput": 100000})
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        hints, progress = set(), []
        captured = False
        for _ in range(120):
            if page.evaluate("document.documentElement.dataset.booted==='true'"):
                break
            if page.is_visible("#loading-tip"):
                assert not page.is_visible("#build-panel"), "build cards must wait until boot finishes"
                hints.add(page.inner_text("#loading-building"))
                progress.append(int(page.get_attribute("#loading-progress", "aria-valuenow")))
                assert page.inner_text("#loading-benefit").strip()
                assert page.locator("#loading-tip").evaluate("""e=>{const r=e.getBoundingClientRect();
                    return r.left>=0 && r.top>=0 && r.right<=innerWidth+1 && r.bottom<=innerHeight+1;}""")
                if not captured:
                    page.screenshot(path=str(OUT / f"loading-{width}x{height}.png"))
                    captured = True
            page.wait_for_timeout(500)
        else:
            raise AssertionError("boot did not finish")
        assert len(hints) >= 2, hints
        assert progress == sorted(progress)
        assert page.get_attribute("#loading-progress", "aria-valuenow") == "100"
        assert not page.is_visible("#loading-tip")
        assert not page.is_visible("#loading-progress")
        last = page.inner_text("#loading-building")
        page.wait_for_timeout(4500)
        assert page.inner_text("#loading-building") == last
        assert not errors, errors
        results[f"{width}x{height}"] = {"hints_seen": sorted(hints), "progress": progress, "stopped_on_ready": True, "errors": errors}
        page.context.close()
    browser.close()
print(json.dumps(results, indent=2))
print("ALL PASS")
