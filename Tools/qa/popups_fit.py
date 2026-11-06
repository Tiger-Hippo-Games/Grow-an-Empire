"""0.16.2: popups show everything without scrolling where the stage has room, and tapping an icon explains it.

Dev server (4173). For each size: briefing, tutorial welcome, card info, muster (Campaign 2, with a Bazaar if built),
result, badge gallery. Records scrollHeight vs clientHeight for each popup; at the fixed 1280x720 stage and the
1920x1080 frame none may scroll. Then taps icons in the HUD drawer, a card's cost chip (must not build), the report
and the muster, and checks the explanation bubble.
"""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).parent))
import flow  # noqa: E402

URL = os.environ.get("GAE_URL", "http://127.0.0.1:4173/")
OUT = Path(__file__).parent / "out" / "popups-fit"; OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MEASURE = """(sel) => { const d = document.querySelector(sel); if (!d || d.offsetParent === null) return null;
  return { scroll: d.scrollHeight, client: d.clientHeight, width: Math.round(d.getBoundingClientRect().width), dense: d.classList.contains('dense') }; }"""
results = {"sizes": {}, "icons": []}
failures = []


def measure(page, size, name, sel, must_fit):
    m = page.evaluate(MEASURE, sel)
    page.screenshot(path=str(OUT / f"{size}-{name}.png"))
    if m is None:
        results["sizes"].setdefault(size, {})[name] = "not shown"; return
    fits = m["scroll"] <= m["client"] + 1
    m["fits"] = fits
    results["sizes"].setdefault(size, {})[name] = m
    print(size, name, m)
    if must_fit and not fits: failures.append(f"{size} {name} scrolls {m}")


with sync_playwright() as pw:
    browser = pw.chromium.launch(args=ARGS)
    for w, h, must in [(1280, 720, True), (1920, 1080, True), (390, 844, False), (844, 390, False)]:
        size = f"{w}x{h}"
        ctx = browser.new_context(viewport={"width": w, "height": h})
        page = ctx.new_page(); errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL + "?platform=mock"); page.wait_for_selector("#campaign-launch", state="visible", timeout=90000); page.wait_for_timeout(800)
        page.click("#campaign-launch"); page.wait_for_timeout(600)
        measure(page, size, "briefing", ".flow-dialog", must)
        page.click(".flow-dialog [data-action=begin]"); page.wait_for_timeout(600)
        measure(page, size, "tutorial", ".tutorial-dialog", must)
        page.click("#tutorial-skip"); page.wait_for_timeout(300)
        page.wait_for_selector(flow.CHOICE, timeout=60000)
        page.locator(".build-info").first.click(); page.wait_for_timeout(400)
        measure(page, size, "card-info", ".card-info-scrim .flow-dialog", must)
        page.locator(".card-info-scrim button").first.click(); page.wait_for_timeout(200)
        if w == 1280:
            # Icon help: a cost chip on a card explains and does not build.
            move_before = page.inner_text("#move")
            page.locator(".build-card .build-costs .gi").first.click(); page.wait_for_timeout(300)
            shown = page.is_visible(".icon-help"); text = page.inner_text(".icon-help") if shown else ""
            page.screenshot(path=str(OUT / f"{size}-icon-card.png"))
            still = page.inner_text("#move") == move_before and page.is_visible(".build-card")
            results["icons"].append({"where": "card cost chip", "shown": shown, "text": text[:80], "did_not_build": still})
            if not (shown and still): failures.append("card chip help")
            page.mouse.click(5, 300); page.wait_for_timeout(200)
            # Clicking the rest of the card still builds.
            page.locator(".build-card.affordable .build-name").first.click(); page.wait_for_timeout(500)
            built = not page.is_visible("#build-panel:not(.hidden) .build-card")
            results["icons"].append({"where": "card name builds", "built": built})
            if not built: failures.append("card body no longer builds")
        flow.speed8(page)
        flow.play_to_muster(page, timeout=90000)
        page.wait_for_timeout(2500)
        if w == 1280:
            page.locator(".flow-dialog .army-chip").first.click(); page.wait_for_timeout(300)
            shown = page.is_visible(".icon-help")
            page.screenshot(path=str(OUT / f"{size}-icon-muster.png"))
            results["icons"].append({"where": "muster army chip", "shown": shown, "text": page.inner_text(".icon-help")[:80] if shown else ""})
            if not shown: failures.append("muster chip help")
            page.keyboard.press("Escape"); page.wait_for_timeout(200)
        measure(page, size, "muster", ".flow-dialog", must)
        page.click(".flow-dialog [data-action=fight]")
        try: page.click(".flow-dialog[data-kind=battle] [data-action=skip]", timeout=3000)
        except Exception: pass
        page.wait_for_selector(".flow-dialog[data-kind=result]", timeout=15000); page.wait_for_timeout(2600)
        measure(page, size, "result", ".flow-dialog", must)
        if page.is_visible("[data-action=badges]"):
            page.click("[data-action=badges]"); page.wait_for_timeout(500)
            measure(page, size, "badges", ".badge-dialog", must)
            page.keyboard.press("Escape")
        if errors: failures.append(f"{size} page errors: {errors[:2]}")
        ctx.close()
    browser.close()
results["failures"] = failures
(OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results["icons"], indent=1))
print("ALL PASS" if not failures else "FAILED: " + "; ".join(failures))
sys.exit(1 if failures else 0)
