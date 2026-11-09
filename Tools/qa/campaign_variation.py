"""Campaign variation: visible briefings, a full new Campaign 2, and an old-muster resume."""
import json,os,sys
from pathlib import Path
sys.path.insert(0,'.tmp/qa-python');sys.path.insert(0,'Tools/qa')
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(Path('.tmp/qa-browsers').resolve())
from playwright.sync_api import sync_playwright
import flow
URL=os.environ.get('GAE_URL','http://127.0.0.1:4186/api/v1/games/grow/play/')
OUT=Path('Tools/qa/out/campaign-variation');OUT.mkdir(parents=True,exist_ok=True)
fixture=json.loads(Path('Tools/qa/out/campaign-variation-fixtures.json').read_text())
proofs=json.loads(Path('src/game/__tests__/fixtures/three-star-routes.json').read_text())
errors=[];results=[]
def context(browser,game,width=1280,height=720):
 ctx=browser.new_context(viewport={'width':width,'height':height})
 ctx.add_init_script("if(!localStorage.getItem('qa-seeded')){localStorage.setItem('grow-an-empire:save:v1',"+json.dumps(json.dumps(game))+");localStorage.setItem('qa-seeded','1');}")
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(URL);page.wait_for_selector('#campaign-launch',timeout=60000)
 return ctx,page
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for number,width,height in [(1,1280,720),(2,390,844),(3,844,390),(22,1280,720),(25,1280,720)]:
  spec=fixture['campaigns'][number-1]
  ctx,page=context(browser,spec['save'],width,height)
  page.click('#campaign-launch');page.wait_for_selector('.flow-dialog[data-kind=briefing]')
  assert page.inner_text('.arrival-count b')==str(spec['moves'])+' moves'
  assert page.inner_text('.flow-dialog h2')==spec['enemy']
  for kind in ['swordsmen','archers','horsemen']:
   assert page.locator('.flow-dialog .army-chips .unit-'+kind).count()==int(spec['army'][kind]>0)
  page.screenshot(path=str(OUT/f'briefing-{number}.png'))
  if number==2:
   page.click('[data-action=begin]');flow.speed8(page)
   for index,choice in enumerate(proofs[1]['choices']):
    page.wait_for_selector(flow.CHOICE,timeout=60000);flow.past_report(page)
    if choice=='gather':page.click('#build-foot .gather-button')
    else:page.locator('#build-options .build-card').filter(has=page.locator(f'img[src*="/{choice}-level-1-"]')).click()
   page.wait_for_selector('.flow-dialog[data-kind=muster]',timeout=60000)
   assert page.inner_text('#move').endswith('/ 15')
   flow.fight(page)
   assert page.get_attribute('.result-stars','aria-label')=='3 of 3 stars'
   page.screenshot(path=str(OUT/'campaign-2-three-stars.png'))
  results.append({'campaign':number,'moves':spec['moves'],'enemy':spec['enemy'],'pass':True})
  print('PASS campaign',number,flush=True);ctx.close()
 ctx,page=context(browser,fixture['oldMuster'])
 flow.enter(page);flow.speed8(page)
 assert page.inner_text('#move')=='13 / 15',page.inner_text('#move')
 assert not page.is_visible('.flow-dialog[data-kind=muster]')
 for _ in range(3):flow.play_move(page);page.wait_for_timeout(200)
 page.wait_for_selector('.flow-dialog[data-kind=muster]',timeout=60000)
 assert page.inner_text('#move')=='15 / 15'
 page.screenshot(path=str(OUT/'old-muster-extra-moves.png'))
 results.append({'old_muster':'12 -> 15, resumes at 13','pass':True})
 print('PASS older muster resumes three extra moves',flush=True)
 assert not errors,errors
 ctx.close();browser.close()
(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors,'pass':True},indent=2))
print('ALL PASS',flush=True)
