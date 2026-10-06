"""Word budget per phone screen (Docs/MOBILE_UX_PLAN.md).

Plays Campaign 1 on a phone in portrait (390x844) and landscape (844x390)
against the preview build, and on every screen counts the words a player can
see: text that is visible, on screen, not hidden for screen readers only, and,
while a dialog or the map is open, only the words inside it. Fails if a screen
goes over its budget, or if an amount of a good is written out ("4 wood")
instead of shown with its icon.

    pnpm build; pnpm exec vite preview   # http://127.0.0.1:4174
    python Tools/qa/text_budget.py [WxH ...]
"""
import json
import os
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).parent))
import flow  # noqa: E402

URL = os.environ.get("GAE_URL", "http://127.0.0.1:4174/") + "?reset"
OUT = Path(__file__).parent / "out"
BUDGET = {
    # First visit: the player is learning, so labels show beside the icons.
    "map": 30, "briefing": 24, "tutorial": 38,
    # From here on the tutorial is done (skipped): icons only.
    "first-choice": 14, "report": 12, "later-choice": 20, "muster": 14, "battle": 14, "result": 22,
    "map-again": 16, "briefing-again": 12,
}
GOODS = r"wood|stone|grain|livestock|cattle|fruit|mangoes|mango|planks?|rations?|wine|soma|gold"

COUNT = """() => {
  const vw = innerWidth, vh = innerHeight;
  const modal = document.querySelector('.flow-scrim:not(.hidden), .tutorial-scrim:not(.hidden), .campaign-map:not(.hidden)');
  const hiddenForSight = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (e.classList.contains('sr') || e.getAttribute('aria-hidden') === 'true' || e.inert) return true;
      if (cs.clipPath && cs.clipPath.includes('inset(50%')) return true;
    }
    return false;
  };
  const walker = document.createTreeWalker(modal || document.body, NodeFilter.SHOW_TEXT);
  let words = 0; const blocks = [];
  while (walker.nextNode()) {
    const n = walker.currentNode, t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement;
    if (!el || !el.checkVisibility({opacityProperty: true, visibilityProperty: true}) || hiddenForSight(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    const w = t.split(/\\s+/).filter(x => /[A-Za-z]/.test(x)).length;
    if (w) { words += w; blocks.push(t.slice(0, 80)); }
  }
  return {words, text: blocks.join(' | ')};
}"""


def run(width, height):
    size = f"{width}x{height}"
    results, problems = {}, []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def check(name):
            page.wait_for_timeout(600)
            page.wait_for_function("!document.querySelector('.fly-good')", timeout=6000)  # goods landing in the stockpile
            data = page.evaluate(COUNT)
            budget = BUDGET[name]
            bare = re.findall(rf"\b\d+\s+(?:{GOODS})\b", data["text"], re.I)
            ok = data["words"] <= budget and not bare
            results[name] = {"words": data["words"], "budget": budget, "pass": ok, "bare_amounts": bare, "text": data["text"]}
            if not ok:
                problems.append(f"{size} {name}: {data['words']} words (budget {budget}){' bare: ' + ', '.join(bare) if bare else ''}")
            page.screenshot(path=str(OUT / f"text-budget-{size}-{name}.png"))
            print(f"{size:>8} {name:<13} {data['words']:>3} / {budget:<3} {'ok' if ok else 'OVER'}", flush=True)

        page.goto(URL)
        page.wait_for_selector("#campaign-launch", state="visible", timeout=30000)
        page.wait_for_timeout(1200)
        check("map")
        page.click("#campaign-launch")
        check("briefing")
        page.click(".flow-dialog [data-action=begin]")
        check("tutorial")
        page.click("#tutorial-skip")
        check("first-choice")
        for _ in range(3):
            page.keyboard.press("s")
        for _ in range(5):
            flow.play_move(page)
            page.wait_for_selector(flow.CHOICE, timeout=60000)
        check("report")
        flow.past_report(page)
        check("later-choice")
        flow.play_to_muster(page, timeout=60000)
        check("muster")
        page.click(".flow-dialog [data-action=fight]")
        page.wait_for_selector(".battle-hud:not(.hidden)")
        check("battle")
        if page.is_visible(".battle-hud:not(.hidden) .bh-skip"):
            page.click(".battle-hud .bh-skip", timeout=3000)
        page.wait_for_selector(".flow-dialog[data-kind=result]")
        check("result")
        # After the tutorial the game speaks in icons only: the map and the next briefing.
        page.click(".flow-dialog [data-action=map]")
        page.wait_for_selector("#campaign-launch", state="visible")
        check("map-again")
        page.click("#campaign-launch")
        page.wait_for_selector(".flow-dialog[data-kind=briefing]")
        check("briefing-again")
        browser.close()
    if errors:
        problems.append(f"{size} page errors: {errors}")
    return results, problems


def main():
    OUT.mkdir(exist_ok=True)
    sizes = [tuple(int(v) for v in arg.split("x")) for arg in sys.argv[1:]] or [(390, 844), (844, 390)]
    report, problems = {}, []
    for width, height in sizes:
        results, found = run(width, height)
        report[f"{width}x{height}"] = results
        problems += found
    (OUT / "text_budget.json").write_text(json.dumps(report, indent=1))
    print("\n".join(problems) if problems else "ALL PASS")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
