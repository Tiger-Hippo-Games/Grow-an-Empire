"""0.16.0 feature checks: badges (reveal, persistence, gallery a11y, no repeat reveal), one-time tips,
reduced motion, growing camera framing at several sizes, and a long late campaign with many buildings.

Dev server (4173). Writes screenshots and results.json to Tools/qa/out/features-016/.
"""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import flow  # noqa: E402

URL = os.environ.get("GAE_URL", "http://127.0.0.1:4173/")
OUT = Path(__file__).parent / "out" / "features-016"
OUT.mkdir(parents=True, exist_ok=True)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
results = {}


def check(name, ok, detail=""):
    results.setdefault("checks", []).append({"name": name, "pass": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + name + (f" :: {detail}" if detail else ""))


def boot(page, query="?platform=mock"):  # Each context starts with empty storage.
    page.goto(URL + query)
    page.wait_for_selector("#campaign-launch", state="visible", timeout=90000)
    page.wait_for_timeout(800)


def chip_text(page):
    return page.get_attribute("#campaign-badges", "aria-label") or ""


def play_campaign(page, shots=None, size=""):
    """From the map: begin the selected campaign (skip tutorial), play to the muster at 8x and fight."""
    flow.enter(page, skip_tutorial=True, timeout=60000)
    flow.speed8(page)

    def on_move(move):
        if shots and move in shots:
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT / f"{size}-move{move}.png"))

    flow.play_to_muster(page, on_move=on_move, timeout=90000)
    page.wait_for_timeout(2500)  # Let the camera finish easing back from the last construction close-up.
    page.screenshot(path=str(OUT / f"{size}-muster.png"))
    return flow.fight(page)


with sync_playwright() as pw:
    browser = pw.chromium.launch(args=ARGS)

    # ---------- 1. Badges: reveal, persistence, gallery, no repeat reveal; tips once ----------
    ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    boot(page)
    check("map badge chip starts at 0", "0 of 18" in chip_text(page), chip_text(page))
    tips_seen = []
    page.expose_function("__tipSeen", lambda t: tips_seen.append(t))
    page.evaluate("""() => new MutationObserver(() => { const t = document.querySelector('.advisor-tip:not(.hidden) strong'); if (t) window.__tipSeen(t.textContent); }).observe(document.getElementById('app'), {subtree: true, childList: true, attributes: true, attributeFilter: ['class']})""")
    text = play_campaign(page, shots={3, 6, 9, 12}, size="c1")
    page.wait_for_timeout(2600)
    page.screenshot(path=str(OUT / "c1-result.png"))
    check("campaign 1 victory", "Victory" in text, text[:80])
    reveal = page.inner_text(".badge-reveal") if page.is_visible(".badge-reveal") else ""
    check("new badges revealed on result", "First Victory" in reveal, reveal.replace("\n", " ")[:120])
    check("advisor tip shown during play", len(tips_seen) > 0, ", ".join(sorted(set(tips_seen))))
    # Gallery from the result: opens, focus inside, Tab trapped, Esc closes and returns focus.
    page.click("[data-action=badges]")
    page.wait_for_timeout(400)
    check("gallery opens from result", page.is_visible(".badge-dialog"))
    earned = page.locator(".badge-grid li.earned").count()
    check("gallery shows earned medals", earned >= 2, f"earned={earned}")
    for _ in range(6):
        page.keyboard.press("Tab")
    inside = page.evaluate("document.querySelector('.badge-dialog').contains(document.activeElement)")
    check("Tab stays inside gallery", inside)
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    check("Esc closes gallery, result stays", not page.is_visible(".badge-dialog") and page.is_visible(".flow-dialog[data-kind=result]"))
    check("focus returned to Badges button", page.evaluate("document.activeElement?.dataset?.action") == "badges")
    # Reload: badges persisted, chip shows them on the map.
    page.reload()
    page.wait_for_selector("#campaign-launch", state="visible", timeout=90000)
    page.wait_for_timeout(800)
    chip = chip_text(page)
    check("badges persist across reload", f"{earned} of 18" in chip, chip)
    page.click("#campaign-badges")
    page.wait_for_timeout(300)
    check("gallery opens from map chip", page.is_visible(".badge-dialog"))
    page.screenshot(path=str(OUT / "gallery-map.png"))
    page.click(".badge-close")
    # Replay campaign 1: same badges must not be revealed again; tips do not repeat.
    tips_before = len(tips_seen)
    if page.is_visible("#campaign-launch"):
        text2 = play_campaign(page, size="c1-replay")
        page.wait_for_timeout(1500)
        check("replay shows no repeat badge reveal", not page.is_visible(".badge-reveal"), text2[:60])
        check("tips do not repeat on replay", len(tips_seen) == tips_before, f"before={tips_before} after={len(tips_seen)}")
    check("no page errors (badges run)", not [e for e in errors if "GL Driver" not in e], "; ".join(errors[:3]))
    ctx.close()

    # ---------- 2. Reduced motion: tutorial and first move work, no errors ----------
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, reduced_motion="reduce")
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    boot(page)
    flow.enter(page, skip_tutorial=False, timeout=60000)
    page.wait_for_selector("#tutorial-scrim:not(.hidden)")
    page.click("#tutorial-start")
    page.click(".tutorial-pick")
    page.wait_for_selector("#tutorial-coach[data-step=report]:not(.hidden)", timeout=90000)
    anim = page.evaluate("getComputedStyle(document.getElementById('tutorial-coach')).animationName")
    check("reduced motion: coach not animated", anim in ("none", ""), anim)
    page.click(".report-continue")
    page.click("#tutorial-next")
    page.click("#tutorial-next")
    page.wait_for_timeout(300)
    confetti = page.locator(".cheer:not(.hidden) .confetti").count()
    check("reduced motion: no confetti", confetti == 0)
    page.screenshot(path=str(OUT / "reduced-motion.png"))
    check("no page errors (reduced motion)", not errors, "; ".join(errors[:3]))
    ctx.close()

    # ---------- 3. Growing camera at several sizes: screenshots mid-campaign ----------
    for w, h in [(1920, 1080), (390, 844), (844, 390), (960, 540)]:
        ctx = browser.new_context(viewport={"width": w, "height": h})
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        boot(page)
        flow.enter(page, skip_tutorial=True, timeout=60000)
        flow.speed8(page)
        for _ in range(7):
            page.wait_for_selector(flow.CHOICE, timeout=90000)
            flow.play_move(page)
            page.wait_for_timeout(150)
        page.wait_for_selector(flow.CHOICE, timeout=90000)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / f"camera-{w}x{h}.png"))
        check(f"camera run {w}x{h} without errors", not errors, "; ".join(errors[:3]))
        ctx.close()

    # ---------- 4. A late, long campaign: unlock 25 via the save, play 25 moves ----------
    ctx = browser.new_context(viewport={"width": 1280, "height": 720})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    boot(page)
    ids = page.evaluate("""async () => (await import('/src/game/campaigns.ts')).CAMPAIGNS.map(c => c.id)""")
    page.evaluate("""(ids) => {
      const key = 'grow-an-empire:save:v1';
      const save = JSON.parse(localStorage.getItem(key) || 'null');
      if (!save) throw new Error('no save to seed');
      save.campaignStars = Object.fromEntries(ids.slice(0, 24).map(id => [id, 3]));
      save.completedCampaignIds = ids.slice(0, 24);
      save.settings = { ...save.settings, tutorialComplete: true };
      localStorage.setItem(key, JSON.stringify(save));
    }""", ids)
    page.reload()
    page.wait_for_selector("#campaign-launch", state="visible", timeout=90000)
    page.wait_for_timeout(1000)
    check("returning player earns progress badges", "of 18" in chip_text(page) and not chip_text(page).startswith("Badges: 0"), chip_text(page))
    stops = page.locator(".campaign-stop")
    stops.nth(24).scroll_into_view_if_needed()
    stops.nth(24).click()
    page.wait_for_timeout(500)
    name = page.inner_text("#campaign-name")
    check("campaign 25 selectable", bool(name), name)
    text = play_campaign(page, shots={10, 18, 25}, size="c25")
    page.wait_for_timeout(2600)
    page.screenshot(path=str(OUT / "c25-result.png"))
    check("campaign 25 resolves", "Victory" in text or "fallen" in text, text[:80])
    built = page.evaluate("document.querySelectorAll('.result-order img').length")
    check("campaign 25 built many buildings", built >= 15, f"built={built}")
    # View the city: full city visible after the result.
    if page.is_visible("[data-action=city]"):
        page.click("[data-action=city]")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "c25-city.png"))
    check("no page errors (campaign 25)", not errors, "; ".join(errors[:3]))
    ctx.close()
    browser.close()

results["pass"] = all(c["pass"] for c in results["checks"])
(OUT / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print("ALL PASS" if results["pass"] else "SOME FAILED")
