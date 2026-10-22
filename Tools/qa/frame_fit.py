"""All production cards and all painted plots fit real iframe sizes. No game saves are read/written."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT=Path('Tools/qa/out/frame-fit');OUT.mkdir(parents=True,exist_ok=True)
URL='http://127.0.0.1:4173/'
SIZES=[(1920,1080),(1920,1036),(1920,916),(1280,720),(1600,900),(1366,724),(870,668),(960,540),(1024,768),(1180,820),(820,1180),(844,390),(667,375),(390,844),(375,667)]
CHECK="""() => {
 const r=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom}};
 const visible=e=>e.checkVisibility({opacityProperty:true,visibilityProperty:true})&&!!e.offsetParent;
 const options=document.getElementById('build-options'),op=r(options),panel=r(document.getElementById('build-panel'));
 const problems=[];
 if(options.scrollHeight>options.clientHeight+2) problems.push('cards require vertical scrolling');
 for(const e of options.querySelectorAll('.build-name,.build-costs,.build-benefit,.build-action')) {
   if(!visible(e))continue;const b=r(e);
   if(b.top<op.top-1||b.bottom>op.bottom+1) problems.push('clipped '+e.className);
 }
 for(const selector of ['#build-panel','#resource-hud','.speed-control','#city-ui-toggle']) {
   const e=document.querySelector(selector);if(!visible(e))continue;const b=r(e);
   if(b.top< -1||b.left< -1||b.bottom>innerHeight+1||b.right>innerWidth+1)problems.push('offscreen '+selector);
 }
 const headerBottom=Math.max(...['#resource-hud','.speed-control'].map(s=>r(document.querySelector(s)).bottom));
 const painted=window.__frameReview.projected();
 const corners=painted.flatMap(p=>p.corners);
 if(Math.max(...corners.map(c=>c.y))-Math.min(...corners.map(c=>c.y))<20)problems.push('city collapsed to a sliver');
 for(const p of painted)for(const c of p.corners)if(c.x<5||c.x>innerWidth-5||c.y<headerBottom+5||c.y>panel.top-5)problems.push('city clipped '+p.name);
 return {problems,panel,options:op,painted:painted.length};
}"""
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page()
 errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR: '+str(e),flush=True)))
 page.route('**/src/main.ts*',lambda route:route.fulfill(status=200,content_type='application/javascript',body='import "/src/styles.css"; import "/src/ui/polish.css"; import "/Tools/dev/frame-fit-review.ts";'))
 page.goto(URL)
 page.wait_for_function('window.__frameReview?.ready',timeout=20000)
 for w,h in SIZES:
  page.set_viewport_size({'width':w,'height':h})
  for words in (True,False):
   for offset in range(0,24,3):
    page.evaluate('([offset,words])=>window.__frameReview.offers(offset,words)',[offset,words])
    page.wait_for_timeout(60)
    data=page.evaluate(CHECK)
    assert not data['problems'], {'size':[w,h],'words':words,'offset':offset,**data}
   if words:
    page.screenshot(path=str(OUT/f'all-city-{w}x{h}.png'))
  page.locator('.build-info').first.click()
  assert page.locator('.card-info-scrim').is_visible()
  page.keyboard.press('Escape')
  assert not page.locator('.card-info-scrim').count()
  page.locator('#city-ui-toggle').click()
  assert page.locator('.controls').evaluate('e=>!e.inert')
  assert page.locator('#play-toggle').is_visible()
  if page.locator('#controls-more').is_visible(): page.locator('#controls-more').click()
  page.locator('#city-view-toggle').click()
  results.append({'size':[w,h],'card_sets':16,'all_24_plots':True,'info_and_controls':True,'pass':True})
 assert not errors,errors
 b.close()
(OUT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2));print('ALL PASS')
