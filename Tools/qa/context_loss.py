"""WebGL context loss: forces a lost context, then checks the game says so, recovers and keeps playing."""
# Run from the project root with the servers up (see Tools/qa/README.md).
import pathlib as _pl
OUT = _pl.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
import sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from flow import enter  # noqa: E402
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
    pg=b.new_page(); errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.add_init_script("localStorage.setItem('grow-an-empire:tutorial:v1','complete')")
    pg.goto("http://127.0.0.1:4174/"); pg.wait_for_function("document.documentElement.dataset.booted==='true'")
    enter(pg)
    pg.evaluate("window.__lc = document.querySelector('#viewport canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lc.loseContext()")
    time.sleep(0.5); lost=pg.inner_text("#phase")
    pg.evaluate("window.__lc.restoreContext()"); time.sleep(1); restored=pg.inner_text("#phase")
    pg.click("#build-options .build-card.affordable >> nth=0"); time.sleep(1); after=pg.inner_text("#phase")
    ok = "lost" in lost and "restored" in restored.lower() and after != restored and not errs
    print({"lost":lost,"restored":restored,"playing_after":after,"errors":errs,"pass":ok}); print("ALL PASS" if ok else "SOME FAILED"); b.close()
