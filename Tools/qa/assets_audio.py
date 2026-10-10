"""Art, fonts and sound load properly.

1. Every file in the build's assets/ folder is fetched by the browser and, for
   images, decoded (a corrupt or truncated WebP fails here, not on a player's phone).
2. A real play-through (map -> briefing -> moves -> report -> muster -> battle -> result)
   at 1280x720 and 390x844 records every request: no 4xx/5xx, no failed request
   (except the portal SDK, which only exists on the portal), every visible <img>
   decoded, the display font (Yatra One) loaded, the sound engine running after the
   first tap and cues actually played, and window.__gaeAssetHealth with no failures.

Run from the project root against `pnpm build; pnpm preview` (http://127.0.0.1:4174/),
or set GAE_URL (e.g. the release server from test-release.cmd).
"""
import json
import os
import pathlib as _pl
import sys
import time

OUT = _pl.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from playwright.sync_api import sync_playwright  # noqa: E402
from flow import enter, fight, play_move, play_to_muster, speed8  # noqa: E402

URL = os.environ.get("GAE_URL", "http://127.0.0.1:4174/")
DIST = _pl.Path(os.environ.get("GAE_DIST", _pl.Path(__file__).resolve().parents[2] / "dist"))
R = {}

DECODE_ALL = """async (names) => {
  const failed = [];
  for (const name of names) {
    const url = new URL(name, document.baseURI).href;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) { failed.push(`${name}: HTTP ${response.status}`); continue; }
      if (/\\.(webp|png|jpe?g|gif)$/i.test(name)) {
        const bitmap = await createImageBitmap(await response.blob());
        if (!bitmap.width || !bitmap.height) failed.push(`${name}: decoded with no size`);
        bitmap.close();
      } else if (/\\.woff2?$/i.test(name)) {
        const face = new FontFace("qa-probe", await response.arrayBuffer());
        await face.load();
      } else await response.arrayBuffer();
    } catch (error) { failed.push(`${name}: ${error.message || error}`); }
  }
  return failed;
}"""

IMAGES_ON_SCREEN = """() => [...document.querySelectorAll('img')]
  .filter((img) => img.offsetParent !== null && img.getAttribute('src'))
  .filter((img) => !img.complete || img.naturalWidth === 0)
  .map((img) => img.getAttribute('src'))"""


def health(page):
    return page.evaluate("window.__gaeAssetHealth")


def run(browser, size, tag):
    ctx = browser.new_context(viewport=size)
    page = ctx.new_page()
    bad, errors = [], []
    page.on("response", lambda r: r.status >= 400 and bad.append(f"{r.status} {r.url}"))
    page.on("requestfailed", lambda q: "platform-sdk" not in q.url and bad.append(f"failed {q.url} ({q.failure})"))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "platform-sdk" not in m.text and "ERR_TUNNEL" not in m.text and errors.append(m.text))
    page.goto(URL + "?reset")
    page.wait_for_function("document.documentElement.dataset.booted === 'true'", timeout=90000)
    page.wait_for_timeout(800)
    broken = {"map": page.evaluate(IMAGES_ON_SCREEN)}
    enter(page)  # Clicks: the sound engine unlocks here.
    page.wait_for_timeout(400)
    audio_after_tap = health(page)["audio"]
    speed8(page)
    play_move(page)
    page.wait_for_timeout(300)
    broken["city"] = page.evaluate(IMAGES_ON_SCREEN)
    play_to_muster(page)
    broken["muster"] = page.evaluate(IMAGES_ON_SCREEN)
    fight(page)
    page.wait_for_selector(".flow-dialog[data-kind=result]", timeout=60000)
    page.wait_for_timeout(600)
    broken["result"] = page.evaluate(IMAGES_ON_SCREEN)
    page.screenshot(path=str(OUT / f"assets_audio_{tag}.png"))
    final = health(page)
    font_css = page.evaluate("document.fonts.check('1em \"Yatra One\"')")
    result = {
        "bad_requests": bad,
        "broken_images": {k: v for k, v in broken.items() if v},
        "asset_health": final,
        "font_check": font_css,
        "audio_after_first_tap": audio_after_tap,
        "errors": errors,
    }
    result["pass"] = (not bad and not result["broken_images"] and not final["imagesFailed"]
                      and final["imagesLoaded"] == final["imagesRequested"] and final["imagesRequested"] > 0
                      and final["font"] == "loaded" and font_css
                      and final["audio"] in ("running", "suspended") and final["soundsPlayed"] > 0
                      and not errors)
    ctx.close()
    return result


with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])

    # 1. Every bundled file loads and decodes.
    names = sorted(f"assets/{f.name}" for f in (DIST / "assets").iterdir() if f.is_file()) if (DIST / "assets").is_dir() else []
    ctx = b.new_context()
    page = ctx.new_page()
    page.goto(URL + "?reset")
    page.wait_for_function("document.documentElement.dataset.booted === 'true'", timeout=90000)
    failed = page.evaluate(DECODE_ALL, names)
    R["every_bundled_file"] = {"files": len(names), "failed": failed, "pass": bool(names) and not failed}
    ctx.close()

    # 2. A real play-through, desktop and phone.
    R["play_1280x720"] = run(b, {"width": 1280, "height": 720}, "desktop")
    R["play_390x844"] = run(b, {"width": 390, "height": 844}, "phone")
    b.close()

print(json.dumps(R, indent=2))
print("ALL PASS" if all(v["pass"] for v in R.values()) else "SOME FAILED")
sys.exit(0 if all(v["pass"] for v in R.values()) else 1)
