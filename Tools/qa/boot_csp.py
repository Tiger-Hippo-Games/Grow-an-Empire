import json,pathlib,os
from playwright.sync_api import sync_playwright
URL=os.environ.get('GAE_URL','http://127.0.0.1:4175/api/v1/games/grow/play/')
results={}
with sync_playwright() as p:
 b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for size in [(1920,1080),(390,844)]:
  ctx=b.new_context(viewport={'width':size[0],'height':size[1]})
  def secure(route):
   response=route.fetch();headers=dict(response.headers);headers['content-security-policy']="script-src 'self'; object-src 'none'";route.fulfill(response=response,headers=headers)
  ctx.route(URL,secure)
  ctx.add_init_script("window.__cspProblems=[];addEventListener('securitypolicyviolation',e=>__cspProblems.push(e.violatedDirective))")
  pg=ctx.new_page();pg.goto(URL);pg.wait_for_selector("html[data-booted=true]",state="attached",timeout=60000)
  assert pg.evaluate("window.__cspProblems.length")==0
  assert pg.evaluate("window.__gaeStageScale")== (1.5 if size[0]==1920 else 1)
  pg.set_viewport_size({'width':844,'height':390});pg.wait_for_timeout(200)
  assert pg.evaluate("document.documentElement.dataset.layout")=='fluid'
  assert pg.evaluate("document.documentElement.dataset.orientation")=='landscape'
  results[str(size)]={'boot':True,'resize':True,'cspViolations':[]};ctx.close()
 ctx=b.new_context()
 ctx.route(URL,secure)
 ctx.route('**/game.js*',lambda route:route.abort())
 pg=ctx.new_page();pg.goto(URL)
 pg.wait_for_selector('#loading button',timeout=10000)
 assert "The game didn't start." in pg.inner_text('#loading')
 ctx.unroute('**/game.js*')
 with pg.expect_navigation(): pg.click('#loading button')
 pg.wait_for_selector("html[data-booted=true]",state="attached",timeout=60000)
 results['watchdog']={'blockedGameShowsError':True,'reloadRecovers':True};ctx.close();b.close()
pathlib.Path('Tools/qa/out/boot-csp.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2));print('ALL PASS')
