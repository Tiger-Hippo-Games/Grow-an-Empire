"""Real first-move lessons, keyboard/Gather alternatives and readable popup bounds."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
from flow import enter

OUT = Path(__file__).parent / 'out' / 'tutorial-polish'
OUT.mkdir(parents=True, exist_ok=True)
URL = os.environ.get('GAE_URL', 'http://127.0.0.1:4173/')
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for width, height, gather in [(1280,720,False),(390,844,False),(844,390,False),(375,667,True)]:
        context = browser.new_context(viewport={'width':width,'height':height})
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL+'?reset')
        enter(page, skip_tutorial=False, timeout=30000)
        page.wait_for_selector('#tutorial-scrim:not(.hidden)')
        page.screenshot(path=str(OUT/f'{width}-welcome.png'))
        page.click('#tutorial-start')
        assert 'LESSON 1' in page.inner_text('#tutorial-step')
        assert page.locator('.tutorial-pick').count() == 1
        page.screenshot(path=str(OUT/f'{width}-choice.png'))
        page.locator('#speed-slider').evaluate("e=>{e.value='3';e.dispatchEvent(new Event('input',{bubbles:true}))}")
        if gather:
            page.click('.gather-button')
        else:
            page.click('.tutorial-pick')
        page.wait_for_selector('#tutorial-coach[data-step=report]:not(.hidden)', timeout=30000)
        assert page.is_visible('.report-continue')
        assert page.is_visible('.move-report')
        page.screenshot(path=str(OUT/f'{width}-report.png'))
        if gather:
            assert 'gathered' in page.inner_text('#tutorial-coach-title')
        page.click('.report-continue')
        assert 'LESSON 3' in page.inner_text('#tutorial-step')
        page.screenshot(path=str(OUT/f'{width}-roadmap.png'))
        # Every coach is contained in the stage and leaves the choice/report tray accessible.
        bounds = page.locator('#tutorial-coach').evaluate("""e=>{const r=e.getBoundingClientRect(),t=document.getElementById('build-panel').getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,trayTop:t.top,font:parseFloat(getComputedStyle(e.querySelector('p')).fontSize)}}""")
        assert bounds['left'] >= 0 and bounds['right'] <= width+1, bounds
        assert bounds['top'] >= 0 and bounds['bottom'] <= bounds['trayTop']+1, bounds
        assert bounds['font'] >= 14, bounds
        page.click('#tutorial-next')
        assert not page.is_visible('#tutorial-coach')
        assert not page.is_visible('#tutorial-scrim')
        assert not page.locator('.tutorial-pick').count()
        # Help is replayable; coach dismissal remains accessible without a build.
        if page.is_visible('#city-ui-toggle'): page.click('#city-ui-toggle')
        if not page.is_visible('#help-toggle'):
            if page.is_visible('#controls-more'): page.click('#controls-more')
        if page.is_visible('#help-toggle'):
            page.click('#help-toggle')
            page.click('#tutorial-start')
            page.click('#tutorial-coach-skip')
            assert not page.is_visible('#tutorial-coach')
        assert not errors, errors
        results.append({'size':[width,height],'gather':gather,'bounds':bounds,'errors':errors,'pass':True})
        context.close()
    browser.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
