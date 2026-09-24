"""Screenshot the game at the portal's test viewports and report layout problems."""
# Run from the project root with the servers up (see Tools/qa/README.md).
import pathlib as _pl
OUT = _pl.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
import json, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(_pl.Path(__file__).resolve().parent))
from flow import enter  # noqa: E402
URL = "http://127.0.0.1:4174/"
TAG = sys.argv[1] if len(sys.argv) > 1 else "before"
SIZES = [(1920, 1080), (1280, 720), (1600, 900), (1366, 724), (960, 540), (667, 375), (390, 800)]
CHECK = """() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0 ? r : null; };
  const W = innerWidth, H = innerHeight;
  const ids = ['.hud', '.settlement-hud', '#build-panel', '.controls'];
  const rects = ids.map(id => [id, document.querySelector(id) && vis(document.querySelector(id))]).filter(x => x[1]);
  const offscreen = rects.filter(([, r]) => r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1).map(([id, r]) => `${id} ${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)}`);
  const overlaps = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const [a, ra] = rects[i], [b, rb] = rects[j];
    const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ox > 2 && oy > 2) overlaps.push(`${a} x ${b} (${Math.round(ox)}x${Math.round(oy)})`);
  }
  const small = [...document.querySelectorAll('button')].map(b => [b, vis(b)]).filter(([, r]) => r && (r.height < 44 || r.width < 44))
    .map(([b, r]) => `${(b.id || b.className || b.textContent).toString().slice(0, 18)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  const tiny = new Set(); document.querySelectorAll('body *').forEach(el => { if (el.children.length === 0 && el.textContent.trim() && vis(el)) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs * (window.__gaeStageScale || 1) < 11) tiny.add(`${fs.toFixed(1)}px`); } });
  const clipped = [...document.querySelectorAll('.hud *, .settlement-hud *, #build-panel *, .controls *')].map(el => [el, vis(el)])
    .filter(([el, r]) => r && (r.right > W + 1 || r.left < -1)).map(([el, r]) => `${el.id || el.className || el.tagName} ${Math.round(r.left)}-${Math.round(r.right)}`);
  return { clipped, offscreen, overlaps, small_buttons: small, text_below_11px: [...tiny], scroll: document.documentElement.scrollWidth > W || document.documentElement.scrollHeight > H };
}"""
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    for w, h in SIZES:
        ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w < 700 else 1, has_touch=w < 700, is_mobile=w < 700)
        ctx.add_init_script("localStorage.setItem('grow-an-empire:tutorial:v1','complete')")
        pg = ctx.new_page(); pg.goto(URL + "?reset")
        pg.wait_for_function("document.documentElement.dataset.booted==='true'", timeout=60000)
        pg.evaluate("localStorage.setItem('grow-an-empire:tutorial:v1','complete')")
        pg.wait_for_timeout(600)
        pg.screenshot(path=f"{OUT}/vp_{TAG}_map_{w}x{h}.png")
        if h > w:  # landscape-only game: an upright phone gets the "turn sideways" screen
            out[f"{w}x{h}"] = {"rotate_hint_shown": pg.is_visible("#rotate-hint")}
            ctx.close(); continue
        stage = pg.evaluate("""() => { const r = document.getElementById('app').getBoundingClientRect();
          return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height),
                   centred: Math.abs((r.left + r.right) / 2 - innerWidth / 2) < 1.5 && Math.abs((r.top + r.bottom) / 2 - innerHeight / 2) < 1.5 }; }""")
        pg.click("#campaign-launch"); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{OUT}/vp_{TAG}_brief_{w}x{h}.png")
        pg.click(".flow-dialog [data-action=begin]"); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{OUT}/vp_{TAG}_tut_{w}x{h}.png")
        tut = pg.evaluate("""() => { const d = document.querySelector('.tutorial-dialog'); if (!d) return null; const r = d.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), fits: r.top >= 0 && r.bottom <= innerHeight, scrollable: d.scrollHeight > d.clientHeight && getComputedStyle(d).overflowY !== 'visible' }; }""")
        if pg.is_visible("#tutorial-skip"): pg.click("#tutorial-skip")
        pg.wait_for_timeout(400)
        pg.screenshot(path=f"{OUT}/vp_{TAG}_{w}x{h}.png")
        out[f"{w}x{h}"] = pg.evaluate(CHECK)
        out[f"{w}x{h}"]["tutorial_dialog"] = tut
        out[f"{w}x{h}"]["stage"] = stage
        ctx.close()
    b.close()
print(json.dumps(out, indent=1))
