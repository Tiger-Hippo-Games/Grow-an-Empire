"""0.17 presentation checks in isolated storage, using real simulation snapshots."""
import hashlib,json,os,sys
from pathlib import Path
sys.path.insert(0,'.tmp/qa-python');sys.path.insert(0,'Tools/qa')
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(Path('.tmp/qa-browsers').resolve())
from playwright.sync_api import sync_playwright
import flow
OUT=Path('Tools/qa/out/presentation-017');OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('GAE_URL','http://127.0.0.1:4184/api/v1/games/grow/play/')
fixtures=json.loads(Path('Tools/qa/out/presentation-fixtures.json').read_text())
errors=[];results=[]
def seed(ctx,game):
 ctx.add_init_script("if(!localStorage.getItem('qa-seeded')){localStorage.setItem('grow-an-empire:save:v1',"+json.dumps(json.dumps(game))+");localStorage.setItem('qa-seeded','1');}")
def state(page):return page.evaluate("JSON.parse(localStorage.getItem('grow-an-empire:save:v1')).state")
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for width,height in [(1280,720),(390,844),(844,390)]:
  ctx=browser.new_context(viewport={'width':width,'height':height});seed(ctx,fixtures['city'])
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(URL);flow.enter(page,timeout=60000);page.wait_for_timeout(1200);page.keyboard.press('p')
  assert page.get_attribute('#play-toggle','aria-label')=='Play'
  before=state(page);hashes=[]
  for name,button,label in [('normal',None,'1×'),('wide','#city-zoom-out','0.8×'),('normal-again','#city-zoom-in','1×'),('close','#city-zoom-in','1.4×')]:
   if button:page.click(button)
   page.wait_for_timeout(250)
   assert page.inner_text('#city-zoom-level')==label
   bounds=page.locator('.city-zoom').bounding_box();assert bounds and bounds['x']>=0 and bounds['y']>=0 and bounds['x']+bounds['width']<=width and bounds['y']+bounds['height']<=height,bounds
   if name=='wide':assert page.is_disabled('#city-zoom-out')
   if name=='close':assert page.is_disabled('#city-zoom-in')
   shot=page.locator('#viewport canvas').screenshot();hashes.append(hashlib.sha256(shot).hexdigest())
   page.screenshot(path=str(OUT/f'city-{width}-{name}.png'))
  assert hashes[0]!=hashes[1] and hashes[2]!=hashes[3],hashes
  after=state(page);assert before['resources']==after['resources'] and before['move']==after['move']
  results.append({'zoom':[width,height],'three_distinct_views':True,'paused_state_unchanged':True})
  print('PASS zoom',width,height,flush=True);ctx.close()
 for name,width,height in [('archers',1280,720),('swordsmen',1280,720),('horsemen',1280,720),('elephants',1280,720),('mixed',390,844),('mixed',844,390),('large',1280,720)]:
  ctx=browser.new_context(viewport={'width':width,'height':height});seed(ctx,fixtures[name])
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(URL);flow.enter(page,timeout=60000);page.wait_for_selector('.flow-dialog[data-kind=muster]')
  page.click('[data-action=fight]');page.wait_for_selector('.popup-battlefield')
  report=state(page)['armyReport'];arena=page.locator('.popup-battlefield')
  for side,counts in [('.battle-formation:not(.enemy)',report['units']),('.battle-formation.enemy',report['enemy'])]:
   for kind in ['archers','swordsmen','horsemen','elephants','militia']:
    assert arena.locator(side+' .actor-'+kind).count()==counts.get(kind,0),(name,side,kind,counts)
  sprite=arena.locator('.battle-formation:not(.enemy) .unit-icon').first
  page.wait_for_timeout(1250);pose1=sprite.evaluate('e=>getComputedStyle(e).backgroundPosition')
  page.wait_for_timeout(350);pose2=sprite.evaluate('e=>getComputedStyle(e).backgroundPosition')
  # Each actor must remain within the battlefield, even when the full large army is present.
  bounds=arena.evaluate('e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}')
  outside=arena.locator('.battle-actor').evaluate_all('els=>els.filter(e=>{const r=e.getBoundingClientRect(),b=e.closest(".popup-battlefield").getBoundingClientRect();return r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1}).length')
  assert outside==0,(name,width,outside,bounds)
  page.screenshot(path=str(OUT/f'battle-{name}-{width}.png'))
  page.click('[data-action=skip]');page.wait_for_selector('.flow-dialog[data-kind=result]')
  results.append({'army':name,'size':[width,height],'actors_equal_recorded_roster':True,'poses':[pose1,pose2],'all_actors_inside_field':True})
  print('PASS battle',name,width,flush=True);ctx.close()
 assert not errors,errors
 browser.close()
(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors,'pass':True},indent=2))
print('ALL PASS',flush=True)

