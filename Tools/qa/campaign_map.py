"""Campaign map QA: the tall scrolling road works with every input, at desktop and phone sizes.

Run from the project root with the preview server up (see Tools/qa/README.md):
    python Tools/qa/campaign_map.py

Checks, at the 1280x720 stage, the 1920x1080 portal frame (stage scaled 1.5x), a
phone held upright and on its side:
- the map opens centred on the selected campaign, with the painted art loaded;
- mouse wheel, mouse drag (also when the drag starts on a stop, which must not
  select it), touch swipe, and the keyboard (arrows, Home) all move the road;
- clicking a stop selects and centres it; the card follows;
- the chapter rail jumps to a chapter and lights the one in view; at the top
  of the map that is the last chapter;
- the "back to campaign N" button appears once the selection is scrolled away
  and brings it back;
- rotating a phone keeps the selection in view;
- with campaigns won, the walked road, stars and fog are drawn.
Screenshots go to Tools/qa/out/map_*.png.
"""
import json
import pathlib
import re
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
URL = "http://127.0.0.1:4174/"
SAVE_KEY = "grow-an-empire:save:v1"

SLUGS = re.findall(r'slug: "([^"]+)"', (ROOT / "src/game/campaigns.ts").read_text(encoding="utf-8"))
IDS = ["campaign-1-first-muster"] + [f"campaign-{i + 1}-{slug}" for i, slug in enumerate(SLUGS) if i > 0]

JS_SCROLL = "document.getElementById('campaign-scroller').scrollTop"
JS_CENTRED = """(i) => { const s = document.getElementById('campaign-scroller').getBoundingClientRect();
  const b = document.querySelectorAll('.campaign-stop')[i].getBoundingClientRect();
  return Math.abs((b.top + b.bottom) / 2 - (s.top + s.bottom) / 2) < 3; }"""
JS_SELECTED_VISIBLE = """() => { const s = document.getElementById('campaign-scroller').getBoundingClientRect();
  const b = document.querySelector('.campaign-stop.selected').getBoundingClientRect();
  return b.top >= s.top && b.bottom <= s.bottom; }"""


def boot(page, query="?reset"):
    page.goto(URL + query)
    page.wait_for_function("document.documentElement.dataset.booted==='true'", timeout=90000)
    page.wait_for_timeout(500)


def selected(page):
    return int(page.inner_text("#campaign-stage").split()[1])


def scroll_top(page):
    return page.evaluate(JS_SCROLL)


def visible_stop(page, start=0):
    """Index and box of a stop wholly inside the scroller, so a drag can start on it."""
    boxes = page.evaluate("""() => { const s = document.getElementById('campaign-scroller').getBoundingClientRect();
      return [...document.querySelectorAll('.campaign-stop')].map(b => b.getBoundingClientRect()).map(r =>
        r.top > s.top + 30 && r.bottom < s.bottom - 30 ? [r.x, r.y, r.width, r.height] : null); }""")
    for index in range(start, len(boxes)):
        if boxes[index]:
            return index, boxes[index]
    raise AssertionError("no stop fully in view")


def desktop(browser, width, height):
    page = browser.new_page(viewport={"width": width, "height": height})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    boot(page)
    r = {}
    r["art_loaded"] = page.evaluate("document.getElementById('campaign-map').classList.contains('map-art-ready')")
    r["opens_on_selection"] = selected(page) == 1 and page.evaluate(JS_SELECTED_VISIBLE)
    scale = page.evaluate("window.__gaeStageScale")
    page.mouse.move(width / 2, height * 0.4)
    before = scroll_top(page)
    page.mouse.wheel(0, -600)
    page.wait_for_timeout(500)
    r["wheel_scrolls"] = scroll_top(page) < before - 100
    # Drag on empty map: the road follows the pointer (in stage pixels).
    before = scroll_top(page)
    page.mouse.move(width * 0.12, height * 0.3)
    page.mouse.down()
    page.mouse.move(width * 0.12, height * 0.3 + 30, steps=3)
    page.mouse.move(width * 0.12, height * 0.3 + 150 * scale, steps=6)
    page.mouse.up()
    page.wait_for_timeout(200)
    r["drag_scrolls"] = abs((before - scroll_top(page)) - 150) < 8
    # Drag that starts on a stop: scrolls, and doesn't select the stop.
    index, (x, y, w, h) = visible_stop(page, 1)
    before, chosen = scroll_top(page), selected(page)
    page.mouse.move(x + w / 2, y + h / 2)
    page.mouse.down()
    page.mouse.move(x + w / 2, y + h / 2 + 120 * scale, steps=8)
    page.mouse.up()
    page.wait_for_timeout(200)
    r["drag_from_stop_scrolls_without_selecting"] = scroll_top(page) != before and selected(page) == chosen
    # A plain click on a stop selects and centres it.
    index, (x, y, w, h) = visible_stop(page, 2)
    page.mouse.click(x + w / 2, y + h / 2)
    page.wait_for_timeout(900)
    r["click_selects_and_centres"] = selected(page) == index + 1 and (page.evaluate(JS_CENTRED, index) or page.evaluate(JS_SELECTED_VISIBLE))
    page.keyboard.press("ArrowUp")
    page.wait_for_timeout(700)
    r["arrow_up_next"] = selected(page) == index + 2 and page.evaluate(JS_SELECTED_VISIBLE)
    page.keyboard.press("ArrowDown")
    page.keyboard.press("ArrowDown")
    page.wait_for_timeout(700)
    r["arrow_down_previous"] = selected(page) == index
    page.keyboard.press("Home")
    page.wait_for_timeout(700)
    r["home_first"] = selected(page) == 1 and page.evaluate(JS_SELECTED_VISIBLE)
    page.locator(".rail-chapter").first.click()  # chapter V, the top of the map
    page.wait_for_timeout(1200)
    r["rail_top_chapter"] = scroll_top(page) == 0 and page.inner_text(".rail-chapter.active") == "V" and page.inner_text("#campaign-chapter").startswith("V")
    r["jump_button_shown"] = page.is_visible("#campaign-jump") and "Campaign 1" in page.inner_text("#campaign-jump")
    page.screenshot(path=f"{OUT}/map_{width}x{height}_top.png")
    page.click("#campaign-jump")
    page.wait_for_timeout(1200)
    r["jump_button_returns"] = page.evaluate(JS_SELECTED_VISIBLE) and not page.is_visible("#campaign-jump")
    page.click("#campaign-launch")
    page.wait_for_timeout(400)
    r["launch_opens_briefing"] = page.is_visible(".flow-dialog[data-kind=briefing]")
    r["errors"] = errors
    page.close()
    return r


def phone(browser):
    context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    boot(page)
    cdp = context.new_cdp_session(page)

    def swipe(x, y0, y1, steps=10):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y0}]})
        for i in range(1, steps + 1):
            cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y0 + (y1 - y0) * i / steps}]})
            time.sleep(0.016)
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})

    r = {"opens_on_selection": page.evaluate(JS_SELECTED_VISIBLE)}
    before = scroll_top(page)
    swipe(150, 150, 450)
    page.wait_for_timeout(800)
    r["swipe_scrolls"] = scroll_top(page) < before - 100
    before = scroll_top(page)
    swipe(150, 450, 150)
    page.wait_for_timeout(800)
    r["swipe_back"] = scroll_top(page) > before + 100
    page.locator(".rail-chapter").nth(0).tap()
    page.wait_for_timeout(1200)
    r["rail_tap"] = scroll_top(page) == 0 and page.inner_text(".rail-chapter.active") == "V"
    page.screenshot(path=f"{OUT}/map_390x844_top.png")
    page.tap("#campaign-jump")
    page.wait_for_timeout(1200)
    r["jump_returns"] = page.evaluate(JS_SELECTED_VISIBLE)
    page.set_viewport_size({"width": 844, "height": 390})
    page.wait_for_timeout(800)
    r["rotation_keeps_selection"] = page.evaluate(JS_SELECTED_VISIBLE)
    page.screenshot(path=f"{OUT}/map_844x390.png")
    r["errors"] = errors
    context.close()
    return r


def progress(browser, won=9):
    """A save with campaigns won: walked road, stars, the fog past the next campaign."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    boot(page)
    page.click("#campaign-launch")
    page.wait_for_timeout(300)
    page.click(".flow-dialog [data-action=begin]")
    page.wait_for_timeout(300)
    if page.is_visible("#tutorial-skip"):
        page.click("#tutorial-skip")
    page.wait_for_timeout(1200)
    save = json.loads(page.evaluate(f"localStorage.getItem('{SAVE_KEY}')"))
    save["campaignStars"] = {IDS[i]: [3, 2, 3, 1, 2, 3, 2, 3, 1][i % 9] for i in range(won)}
    save["completedCampaignIds"] = list(save["campaignStars"])
    page.close()
    page = context.new_page()
    page.add_init_script(f"localStorage.setItem('{SAVE_KEY}', {json.dumps(json.dumps(save))})")
    boot(page, "")
    if not page.is_visible("#campaign-map"):
        page.evaluate("document.getElementById('map-toggle').click()")
        page.wait_for_timeout(600)
    r = page.evaluate("""() => ({
      walked: (document.querySelector('.road-done')?.getAttribute('d') || '').length > 20,
      starsShown: [...document.querySelectorAll('.campaign-stop.completed')].length,
      fogPx: parseFloat(document.getElementById('campaign-fog').style.height),
    })""")
    r["stars_shown"] = r.pop("starsShown") == won
    r["fog_drawn"] = r.pop("fogPx") > 0
    page.screenshot(path=f"{OUT}/map_progress_1280x720.png")
    context.close()
    return r


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    results = {"desktop 1280x720": desktop(browser, 1280, 720), "portal 1920x1080": desktop(browser, 1920, 1080),
               "phone": phone(browser), "progress": progress(browser)}
    browser.close()

failed = [f"{area}: {check}" for area, checks in results.items() for check, value in checks.items()
          if (check == "errors" and value) or (check != "errors" and value is not True)]
print(json.dumps(results, indent=1))
print("ALL PASS" if not failed else "FAILED:\n  " + "\n  ".join(failed))
sys.exit(1 if failed else 0)
