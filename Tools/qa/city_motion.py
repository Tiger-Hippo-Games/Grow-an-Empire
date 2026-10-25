"""Production renderer/crowd art review; isolated fixture, no game saves."""
import json, os, sys
from pathlib import Path
sys.path.insert(0,'.tmp/qa-python')
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(Path('.tmp/qa-browsers').resolve())
from playwright.sync_api import sync_playwright

OUT=Path('Tools/qa/out/civilian-density'); OUT.mkdir(parents=True,exist_ok=True)
errors=[]; failures=[]
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1100})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('requestfailed',lambda req:failures.append(req.url))
    page.goto('http://127.0.0.1:4173/Tools/dev/art-review.html')
    page.wait_for_function('window.__cityMotionReview?.snapshot().ready',timeout=90000)
    page.locator('#motion-toggle').click()
    before=page.evaluate('window.__cityMotionReview.snapshot()')
    assert len(before['citizens'])==24 and all(a['visible'] for a in before['citizens'])
    assert len({a['building'] for a in before['citizens']})==24
    assert before['soldiers']==42, before
    page.wait_for_timeout(350)
    assert before==page.evaluate('window.__cityMotionReview.snapshot()'), 'paused crowd moved'
    page.locator('#viewport').screenshot(path=str(OUT/'city-before.png'))
    page.locator('#motion-step').click()
    after=page.evaluate('window.__cityMotionReview.snapshot()')
    moved=sum(abs(a['x']-b['x'])+abs(a['y']-b['y'])>.001 for a,b in zip(before['citizens'],after['citizens']))
    assert moved>10, moved
    assert after['soldiers']==42
    page.locator('#viewport').screenshot(path=str(OUT/'city-after.png'))
    for index in range(12):
        page.evaluate('window.__cityMotionReview.advance(.125)')
        page.locator('#viewport').screenshot(path=str(OUT/f'motion-{index:02d}.png'))
    page.locator('#motion-toggle').click()
    resume=page.evaluate('window.__cityMotionReview.snapshot().elapsed')
    page.wait_for_timeout(350)
    assert page.evaluate('window.__cityMotionReview.snapshot().elapsed')>resume
    bad=page.evaluate('[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)')
    assert not bad,bad
    assert not errors,errors
    assert not failures,failures
    browser.close()
result={'citizens':24,'unique_buildings':24,'soldiers':42,'pause_step_resume':True,'citizens_moved_in_one_second':moved,'all_runtime_images_loaded':True,'errors':errors,'request_failures':failures,'pass':True}
(OUT/'browser-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
