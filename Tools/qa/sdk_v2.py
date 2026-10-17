"""Exact release + real hosted SDK v2 + simulated same-origin portal bridge.

Download /sdk/v2/platform-sdk.js to .tmp/hippo-platform-sdk-v2.js first.
GAE_RELEASE_URL selects serve-release.mjs; this does not test live persistence.
"""
import json
import os
import pathlib
import sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from flow import enter, fight, play_move, play_to_muster, speed8

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'Tools/qa/out/sdk-v2'
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('GAE_RELEASE_URL', 'http://127.0.0.1:4175/').rstrip('/')
SDK = (ROOT / '.tmp/hippo-platform-sdk-v2.js').read_text(encoding='utf-8')
PLAY = '/api/v1/games/grow/play/'
HTML = '<!doctype html><style>body{margin:0}iframe{border:0;width:1280px;height:720px;display:block}</style><iframe id="game" src="' + PLAY + '"></iframe>'
BRIDGE = r"""(() => {
  if (window.parent !== window) return;
  window.__calls = []; window.__ready = []; window.__violations = [];
  let generation = 0;
  const key = 'grow:qa:v2:cloud:' + AUTH;
  const depth = v => !v || typeof v !== 'object' ? 0 : 1 + Math.max(0, ...Object.values(v).map(depth));
  addEventListener('message', e => {
    if (e.source !== document.getElementById('game')?.contentWindow || e.origin !== location.origin) return;
    const q = e.data;
    if (q?.type === 'GAME_READY') { __ready.push(q); return; }
    if (q?.type !== 'GP_BRIDGE_REQUEST' || q.protocolVersion !== 2) return;
    if (q.operation === 'init') generation++;
    __calls.push({ operation: q.operation, args: q.args, at: Date.now(), generation });
    const reply = { type: 'GP_BRIDGE_RESULT', protocolVersion: 2, requestId: q.requestId, ok: true };
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{"version":0,"progress":{}}');
      switch (q.operation) {
        case 'init': reply.result = { gameId: 'grow' }; break;
        case 'player': reply.result = { id: 'qa-' + AUTH, displayName: 'Portal ' + AUTH, authType: AUTH }; break;
        case 'progress.load': reply.result = { gameId: 'grow', ...saved }; break;
        case 'progress.save': {
          if (q.args.version !== saved.version) throw { code: 'SAVE_CONFLICT', status: 409, message: 'Revision changed' };
          if (depth(q.args.progress) > 6 || new TextEncoder().encode(JSON.stringify(q.args.progress)).length > 65536) throw Error('Invalid save limits');
          const next = { version: saved.version + 1, progress: q.args.progress };
          localStorage.setItem(key, JSON.stringify(next));
          reply.result = { gameId: 'grow', version: next.version, updatedAt: new Date().toISOString() }; break;
        }
        case 'leaderboard.top':
          if (AUTH === 'PREVIEW') throw Error('Preview rankings must be skipped');
          reply.result = { entries: [{ rank: 1, score: 12, displayName: 'Bridge Raja' }] }; break;
        case 'leaderboard.me': reply.result = { rank: 2, score: 1 }; break;
        case 'leaderboard.submit':
          if (AUTH !== 'EMAIL') throw Error('Unexpected leaderboard submission');
          reply.result = { rank: 2 }; break;
        default: reply.result = {};
      }
    } catch (error) {
      reply.ok = false; reply.error = { message: error.message, code: error.code || 'QA_ERROR', status: error.status || 500 };
      __violations.push(reply.error);
    }
    e.source.postMessage(reply, e.origin);
  });
})();"""

# Observe calls in the game frame. Parent message-receipt times include event
# loop delays and cannot measure the game's save cadence reliably.
SAVE_TIMING = r"""(() => {
  if (window.parent === window) return;
  window.__saveAttempts = [];
  let platform;
  Object.defineProperty(window, 'Platform', {
    configurable: true, get: () => platform,
    set: value => {
      platform = value;
      const save = value.saveGameProgress;
      value.saveGameProgress = function (...args) {
        __saveAttempts.push(Date.now());
        return save.apply(this, args);
      };
    }
  });
})();"""

def save_intervals(frame):
    attempts = frame.evaluate('window.__saveAttempts')
    intervals = [after - before for before, after in zip(attempts, attempts[1:])]
    assert all(delta >= 4990 for delta in intervals), intervals
    return intervals

results = {}
with sync_playwright() as p:
    executable = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
    browser = p.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for auth in ['PREVIEW', 'EMAIL', 'GUEST']:
        print('START ' + auth, flush=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        context.add_init_script('window.AUTH = ' + json.dumps(auth) + ';' + BRIDGE)
        context.add_init_script(SAVE_TIMING)
        context.route('**/qa-v2-harness', lambda route: route.fulfill(content_type='text/html', body=HTML))
        context.route('**/sdk/v2/platform-sdk.js', lambda route: route.fulfill(content_type='application/javascript', body=SDK))
        def secure(route):
            response = route.fetch()
            headers = dict(response.headers)
            headers['content-security-policy'] = "script-src 'self'; object-src 'none'"
            route.fulfill(response=response, headers=headers)
        context.route('**/api/v1/games/grow/play/', secure)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(URL + '/qa-v2-harness')
        game = page.frame_locator('#game')
        game.locator('html[data-booted=true]').wait_for(state='attached', timeout=60000)
        frame = page.locator('#game').element_handle().content_frame()
        assert frame.evaluate('Platform.version') == '2.1.0'
        page.wait_for_function('__ready.length === 1')
        calls = page.evaluate('__calls')
        assert [c['operation'] for c in calls[:2]] == ['init', 'player']
        assert calls[0]['args'] == {}
        intervals = []
        if auth != 'GUEST':
            page.wait_for_function("__calls.some(c => c.operation === 'progress.save')")
            assert [c['operation'] for c in page.evaluate('__calls')[:3]] == ['init', 'player', 'progress.load']
            enter(frame)
            speed8(frame)
            play_move(frame)
            frame.locator('#build-panel .report-continue').wait_for(state='visible', timeout=45000)
            page.wait_for_function("JSON.parse(localStorage.getItem('grow:qa:v2:cloud:' + AUTH)).progress.state.builtBuildingIds.length === 1", timeout=20000)
            key = 'grow-an-empire:preview:qa-PREVIEW:save:v1' if auth == 'PREVIEW' else 'grow-an-empire:save:v1'
            frame.evaluate('(key) => localStorage.removeItem(key)', key)
            intervals += save_intervals(frame)
            page.evaluate("document.getElementById('game').remove()")
            page.evaluate('(src) => { const f = document.createElement("iframe"); f.id="game"; f.src=src; document.body.append(f); }', PLAY)
            game.locator('html[data-booted=true]').wait_for(state='attached', timeout=60000)
            frame = page.locator('#game').element_handle().content_frame()
            assert frame.evaluate('(key) => JSON.parse(localStorage.getItem(key)).state.builtBuildingIds.length', key) == 1
        frame.locator('#campaign-realm').click()
        frame.locator('[data-tab=players]').click()
        if auth == 'PREVIEW':
            frame.get_by_text('Your preview progress is saved separately.', exact=False).wait_for()
        else:
            frame.get_by_text('Bridge Raja', exact=True).wait_for()
        if auth == 'EMAIL':
            frame.locator('.realm-close').click()
            enter(frame)
            speed8(frame)
            play_to_muster(frame)
            fight(frame)
            page.wait_for_function("__calls.some(c => c.operation === 'leaderboard.submit')")
            posted = page.evaluate("__calls.find(c => c.operation === 'leaderboard.submit').args")
            assert posted['leaderboard'] == 'strongplayer' and posted['score'] == 1, posted
            assert posted['metadata']['completedCampaigns'] == 1
        calls = page.evaluate('__calls')
        if auth == 'GUEST':
            assert not any(c['operation'].startswith('progress.') or c['operation'] in ['leaderboard.me', 'leaderboard.submit'] for c in calls)
        if auth == 'PREVIEW':
            assert not any(c['operation'].startswith('leaderboard.') for c in calls)
            assert frame.evaluate("localStorage.getItem('grow-an-empire:save:v1')") is None
        saves = [c for c in calls if c['operation'] == 'progress.save']
        intervals += save_intervals(frame)
        assert not page.evaluate('__violations'), page.evaluate('__violations')
        assert not errors, errors
        results[auth] = {'pass': True, 'gameVersion': page.evaluate('__ready[0].gameVersion'), 'sdkVersion': '2.1.0', 'operations': [c['operation'] for c in calls], 'saves': len(saves), 'saveIntervalsMs': intervals, 'errors': errors}
        print('PASS ' + auth, flush=True)
        context.close()
    browser.close()
(OUT / 'results.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print('ALL PASS', flush=True)
