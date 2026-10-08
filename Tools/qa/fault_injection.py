"""Fault injection: breaks things on purpose and checks the game degrades instead of hanging or crashing.

Scenarios: broken and stalled art, a boot-blocking art failure, a portal SDK that throws, hangs or
rejects, blocked or full storage, corrupt saves, a save from another player, a save from a newer
game version, the portal ending the session, battle art failing at the finale, and a game loaded in a
zero-size iframe.

Needs the production build served on http://127.0.0.1:4174 (`pnpm build`, then `pnpm exec vite preview`).
`--quick` skips the 45-second stalled-image scenario.
"""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from flow import enter, fight, play_to_muster  # noqa: E402

URL = "http://127.0.0.1:4174/"
SAVE_KEY = "grow-an-empire:save:v1"
QUICK = "--quick" in sys.argv
TUTORIAL_DONE = "try { localStorage.setItem('grow-an-empire:tutorial:v1','complete') } catch (e) {}"

# A scriptable stand-in for the portal SDK, served in place of /sdk/platform-sdk.js.
def fake_sdk(player_id="bob", login="ok", rejecting=False, cloud="null"):
    login_js = {
        "ok": f"return {{ player: {{ id: '{player_id}', displayName: 'Guest_{player_id}' }} }};",
        "hang": "return new Promise(function () {});",
        "null": "return null;",
    }[login]
    fire = "return Promise.reject(new Error('sdk offline'));" if rejecting else "return undefined;"
    return f"""
    window.__sdkLog = [];
    window.__cloud = {cloud};
    window.Platform = {{
      init: function (c) {{ window.__sdkLog.push(['init', c]); }},
      login: async function () {{ window.__sdkLog.push(['login']); {login_js} }},
      getGameProgress: async function () {{ return {{ progress: window.__cloud }}; }},
      saveGameProgress: async function (p) {{ window.__sdkLog.push(['save', p.runId, p.playerId]); window.__cloud = p; return {{ version: 1 }}; }},
      startSession: function () {{ window.__sdkLog.push(['startSession']); {fire} }},
      endSession: function (s) {{ window.__sdkLog.push(['endSession', s]); {fire} }},
      track: function (e) {{ window.__sdkLog.push(['track', e]); {fire} }}
    }};"""


def open_game(browser, *, init_scripts=(), sdk_js=None, routes=(), viewport=(1280, 720), url=URL):
    ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
    for script in (TUTORIAL_DONE, *init_scripts):
        ctx.add_init_script(script)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" else None)
    if sdk_js is not None:
        page.route("**/sdk/platform-sdk.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=sdk_js))
    for pattern, handler in routes:
        page.route(pattern, handler)
    page.goto(url, wait_until="commit")  # boot is awaited separately; a stalled image would block "load"
    return ctx, page, errors


def booted(page, timeout=30000):
    page.wait_for_function("document.documentElement.dataset.booted === 'true'", timeout=timeout)


def status(page):
    return page.inner_text("#phase")


def cards_enabled(page):
    return page.evaluate("[...document.querySelectorAll('#build-options .build-card')].filter(b => !b.disabled).length")


def saved(page):
    return page.evaluate(f"(() => {{ try {{ return JSON.parse(localStorage.getItem('{SAVE_KEY}')); }} catch (e) {{ return 'unreadable'; }} }})()")


results = {}


def scenario(name):
    def wrap(fn):
        def run(browser):
            started = time.time()
            try:
                outcome = fn(browser)
                outcome.setdefault("pass", False)
            except Exception as error:  # A crash in the check itself counts as a failure.
                outcome = {"pass": False, "exception": repr(error)[:300]}
            outcome["seconds"] = round(time.time() - started, 1)
            results[name] = outcome
            print(("PASS " if outcome["pass"] else "FAIL ") + name, flush=True)
        run.__name__ = name
        return run
    return wrap


@scenario("card art fails, then succeeds on retry")
def broken_card_art(browser):
    blocked = {"on": True}
    def maybe_abort(route):
        if blocked["on"]:
            route.abort()
        else:
            route.continue_()
    ctx, page, errors = open_game(browser, routes=[("**/assets/quarry-construction-*", maybe_abort)])
    booted(page)
    enter(page)
    page.wait_for_timeout(1500)
    page.click("#build-options button:has-text('Quarry')")
    page.wait_for_function("document.querySelector('#phase').innerText.includes(\"Couldn't load\")", timeout=15000)
    message, enabled = status(page), cards_enabled(page)
    blocked["on"] = False
    page.click("#build-options button:has-text('Quarry')")
    page.wait_for_function("document.querySelector('#build-panel').classList.contains('hidden')", timeout=15000)
    real_errors = [e for e in errors if "Failed to load image" not in e and "net::ERR_FAILED" not in e]
    ctx.close()
    return {"message": message, "cards_enabled_after_failure": enabled, "retry_started_construction": True,
            "other_errors": real_errors, "pass": enabled == 3 and not real_errors}


@scenario("card art stalls forever (45 s timeout)")
def stalled_card_art(browser):
    if QUICK:
        return {"skipped": True, "pass": True}
    ctx, page, errors = open_game(browser, routes=[("**/assets/farm-construction-*", lambda route: None)])  # never answered
    booted(page)
    enter(page)
    page.click("#build-options button:has-text('Farm')")
    page.wait_for_function("document.querySelector('#phase').innerText.includes(\"Couldn't load\")", timeout=60000)
    enabled = cards_enabled(page)
    page.unroute_all(behavior="ignoreErrors")  # release the held requests before closing
    ctx.close()
    return {"cards_enabled_after_timeout": enabled, "pass": enabled == 3}


@scenario("boot art fails: error screen with Reload, never an endless spinner")
def boot_art_fails(browser):
    ctx, page, errors = open_game(browser, routes=[("**/assets/village-empty-terrain-*", lambda route: route.abort())])
    page.wait_for_selector("#loading button", timeout=30000)
    text = page.inner_text("#loading")
    ctx.close()
    return {"loading_text": text[:160], "pass": "Reload" in text and "village-empty-terrain" in text}


@scenario("portal SDK script throws while loading")
def sdk_throws(browser):
    ctx, page, errors = open_game(browser, sdk_js="throw new Error('sdk exploded');")
    booted(page)
    page.wait_for_timeout(800)
    watchdog_shown = page.evaluate("!!document.querySelector('#loading button')")
    ctx.close()
    return {"watchdog_error_shown": watchdog_shown, "pass": not watchdog_shown}


@scenario("portal login never answers: boots offline within the time budget")
def sdk_login_hangs(browser):
    started = time.time()
    ctx, page, errors = open_game(browser, sdk_js=fake_sdk(login="hang"))
    booted(page, timeout=20000)
    boot_s = round(time.time() - started, 1)
    ctx.close()
    return {"boot_seconds": boot_s, "pass": boot_s < 9 and not [e for e in errors if "pageerror" in e]}


@scenario("portal login returns nothing")
def sdk_login_null(browser):
    ctx, page, errors = open_game(browser, sdk_js=fake_sdk(login="null"))
    booted(page)
    ctx.close()
    return {"errors": errors, "pass": not [e for e in errors if "pageerror" in e]}


@scenario("portal analytics calls reject: no unhandled rejections")
def sdk_rejects(browser):
    ctx, page, errors = open_game(browser, sdk_js=fake_sdk(rejecting=True))
    unhandled = []
    page.on("console", lambda m: unhandled.append(m.text) if "Uncaught (in promise)" in m.text else None)
    booted(page)
    enter(page)
    page.click("#build-options button:has-text('Farm')")
    page.wait_for_timeout(1500)
    tracked = page.evaluate("window.__sdkLog.filter(c => c[0] === 'track').length")
    ctx.close()
    return {"track_calls": tracked, "unhandled": unhandled, "pass": tracked > 0 and not unhandled and not [e for e in errors if "pageerror" in e]}


@scenario("storage blocked entirely (Safari iframe, locked-down embed)")
def storage_blocked(browser):
    block = """Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });"""
    ctx, page, errors = open_game(browser, init_scripts=[block])
    booted(page)
    # With no storage the "tutorial done" flag can't be read either, so the tutorial opens: enter() skips it.
    enter(page)
    page.click("#build-options button:has-text('Farm')")
    page.wait_for_function("document.querySelector('#build-panel').classList.contains('hidden')", timeout=15000)
    ctx.close()
    return {"errors": errors, "pass": not [e for e in errors if "pageerror" in e]}


@scenario("storage full (every write throws QuotaExceededError)")
def storage_full(browser):
    full = """Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };"""
    ctx, page, errors = open_game(browser, init_scripts=[full])
    booted(page)
    enter(page)
    page.click("#build-options button:has-text('Farm')")
    page.wait_for_function("document.querySelector('#build-panel').classList.contains('hidden')", timeout=15000)
    ctx.close()
    return {"errors": errors, "pass": not [e for e in errors if "pageerror" in e]}


@scenario("corrupt save JSON: fresh start, bad save removed")
def corrupt_save(browser):
    ctx, page, errors = open_game(browser, init_scripts=[f"if (!sessionStorage.getItem('x')) {{ sessionStorage.setItem('x', 1); localStorage.setItem('{SAVE_KEY}', '{{not json'); }}"])
    booted(page)
    page.wait_for_timeout(500)
    save = saved(page)
    ctx.close()
    return {"save_after_boot_mode": (save or {}).get("state", {}).get("mode") if isinstance(save, dict) else save,
            "pass": isinstance(save, dict) and save.get("state", {}).get("move") == 1}


@scenario("valid JSON but impossible state: fresh start with a message")
def invalid_state_save(browser):
    bad = json.dumps({"schemaVersion": 4, "savedAt": "2026-09-23T10:00:00Z", "campaignId": "campaign-1-first-muster",
                      "state": {"mode": "construction", "move": 3, "civicLevel": 2, "population": 4,
                                "builtBuildingIds": ["farm", "not-a-building"], "availableBuildingIds": [],
                                "resources": {}, "buildingMaturity": {}, "trainedUnits": {"archers": 0, "swordsmen": 0}}})
    ctx, page, errors = open_game(browser, init_scripts=[f"if (!sessionStorage.getItem('x')) {{ sessionStorage.setItem('x', 1); localStorage.setItem('{SAVE_KEY}', {json.dumps(bad)}); }}"])
    booted(page)
    move = page.inner_text("#move")
    ctx.close()
    return {"move": move, "pass": move.startswith("1 /") and not [e for e in errors if "pageerror" in e]}


@scenario("save from a newer game version: kept untouched, player told")
def newer_save(browser):
    future = json.dumps({"schemaVersion": 99, "savedAt": "2026-12-01T10:00:00Z", "campaignId": "campaign-1-first-muster", "state": {"anything": True}})
    ctx, page, errors = open_game(browser, init_scripts=[f"if (!sessionStorage.getItem('x')) {{ sessionStorage.setItem('x', 1); localStorage.setItem('{SAVE_KEY}', {json.dumps(future)}); }}"])
    booted(page)
    message = status(page)
    enter(page)
    page.click("#build-options button:has-text('Farm')")
    page.wait_for_timeout(1500)
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    save = saved(page)
    ctx.close()
    return {"message": message[:120], "schema_after_play": save.get("schemaVersion") if isinstance(save, dict) else save,
            "pass": "newer version" in message and isinstance(save, dict) and save.get("schemaVersion") == 99}


@scenario("browser save belongs to another player: not loaded, not uploaded")
def other_players_save(browser):
    # Make Alice's save with a real game first (one completed move), then sign in as Bob.
    ctx, page, errors = open_game(browser, sdk_js=fake_sdk(player_id="alice"))
    booted(page)
    enter(page)
    for _ in range(3): page.keyboard.press("s")  # the control bar hides while a choice is open; S is its shortcut
    page.click("#build-options button:has-text('Farm')")
    page.wait_for_function("document.querySelector('#move').innerText.startsWith('2 /')", timeout=30000)
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    alice_save = saved(page)
    ctx.close()
    ctx, page, errors = open_game(browser, sdk_js=fake_sdk(player_id="bob"),
                                  init_scripts=[f"if (!sessionStorage.getItem('x')) {{ sessionStorage.setItem('x', 1); localStorage.setItem('{SAVE_KEY}', {json.dumps(json.dumps(alice_save))}); }}"])
    booted(page)
    page.wait_for_timeout(2500)
    move = page.inner_text("#move")
    uploads = page.evaluate("window.__sdkLog.filter(c => c[0] === 'save')")
    ctx.close()
    alice_run = alice_save.get("runId")
    return {"alice_owner_recorded": alice_save.get("playerId"), "bob_move": move, "uploads": uploads,
            "pass": alice_save.get("playerId") == "alice" and move.startswith("1 /") and all(u[1] != alice_run for u in uploads)}


@scenario("portal sends GP_SESSION_END: game pauses, saves, ends session")
def session_end(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    ctx.add_init_script(TUTORIAL_DONE)
    page = ctx.new_page()
    page.route("**/sdk/platform-sdk.js", lambda r: r.fulfill(status=200, content_type="application/javascript", body=fake_sdk()))
    page.set_content(f"<iframe id=g src='{URL}' style='width:1200px;height:700px'></iframe>")
    for _ in range(100):
        if len(page.frames) > 1:
            break
        page.wait_for_timeout(100)
    game = page.frames[1]
    game.wait_for_function("document.documentElement.dataset.booted === 'true'", timeout=30000)
    enter(game)  # the session starts when a campaign starts, not on the map
    page.evaluate("document.getElementById('g').contentWindow.postMessage({ type: 'GP_SESSION_END' }, '*')")
    page.wait_for_timeout(500)
    label = (game.get_attribute("#play-toggle", "aria-label") or "").strip()
    ended = game.evaluate("window.__sdkLog.some(c => c[0] === 'endSession')")
    page.evaluate("document.getElementById('g').contentWindow.postMessage({ type: 'GP_RESUME' }, '*')")
    page.wait_for_timeout(300)
    restarted = game.evaluate("window.__sdkLog.filter(c => c[0] === 'startSession').length")
    ctx.close()
    return {"play_label_after_end": label, "endSession_sent": ended, "startSession_calls_after_resume": restarted,
            "pass": ended and label != "Pause" and restarted == 2}


@scenario("battle icon art fails at the end of a full game: result still shown")
def combat_art_fails(browser):
    ctx, page, errors = open_game(browser, routes=[("**/assets/*-combat-*", lambda route: route.abort())])
    booted(page)
    enter(page)
    for _ in range(3):
        page.keyboard.press("s")
    play_to_muster(page, timeout=60000)
    result = fight(page)
    ctx.close()
    real_errors = [e for e in errors if "pageerror" in e]
    return {"result": result[:80], "pass": ("Victory" in result or "fallen" in result) and not real_errors}


@scenario("loaded in a zero-size iframe, then shown")
def zero_size(browser):
    ctx = browser.new_context(viewport={"width": 1280, "height": 800})
    ctx.add_init_script(TUTORIAL_DONE)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content(f"<iframe id=g src='{URL}' style='width:0;height:0;border:0'></iframe>")
    game = None
    for _ in range(100):
        if len(page.frames) > 1:
            game = page.frames[1]
            break
        page.wait_for_timeout(100)
    game.wait_for_function("document.documentElement.dataset.booted === 'true'", timeout=30000)
    page.evaluate("Object.assign(document.getElementById('g').style, { width: '1200px', height: '700px' })")
    page.wait_for_timeout(1200)
    # A healthy render has varied pixels; NaN camera bounds leave the canvas one flat colour.
    # (The WebGL canvas can't be read back directly, so use a screenshot of the iframe.)
    import io
    from PIL import Image
    shot = Image.open(io.BytesIO(page.locator("#g").screenshot())).convert("RGB").resize((80, 48))
    distinct = len({(r >> 4, g >> 4, b >> 4) for r, g, b in (shot.get_flattened_data() if hasattr(shot, "get_flattened_data") else shot.getdata())})
    ctx.close()
    return {"distinct_colours": distinct, "errors": errors, "pass": distinct > 20 and not errors}


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader"])
    for check in [broken_card_art, boot_art_fails, sdk_throws, sdk_login_hangs, sdk_login_null, sdk_rejects,
                  storage_blocked, storage_full, corrupt_save, invalid_state_save, newer_save, other_players_save,
                  session_end, zero_size, combat_art_fails, stalled_card_art]:
        check(browser)
    browser.close()

print(json.dumps(results, indent=1))
print("ALL PASS" if all(r["pass"] for r in results.values()) else "SOME FAILED")
