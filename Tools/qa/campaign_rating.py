"""Real three-star campaign, then isolated saved-muster fixtures for every rating path."""
import copy,json,os,sys
from pathlib import Path
sys.path.insert(0,'.tmp/qa-python');sys.path.insert(0,'Tools/qa')
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(Path('.tmp/qa-browsers').resolve())
from playwright.sync_api import sync_playwright
import flow

OUT=Path('Tools/qa/out/campaign-rating');OUT.mkdir(parents=True,exist_ok=True)
proof=json.loads(Path('src/game/__tests__/fixtures/three-star-routes.json').read_text(encoding='utf-8'))[0]
errors=[]; results=[]
READ="""() => Object.entries(localStorage).flatMap(([key,raw])=>{try{const game=JSON.parse(raw);return game?.state&&game?.campaignId?[{key,game}]:[]}catch{return[]}})"""
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1280,'height':720})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:4174/')
    page.wait_for_selector('#campaign-launch',timeout=30000);page.click('#campaign-launch')
    assert page.locator('.campaign-star-rules li').count()==3
    page.screenshot(path=str(OUT/'briefing.png'))
    page.click('[data-action=begin]')
    if page.is_visible('#tutorial-skip'):page.click('#tutorial-skip')
    flow.speed8(page)
    for choice in proof['choices']:
        page.wait_for_selector(flow.CHOICE,timeout=60000);flow.past_report(page)
        if choice=='gather':page.locator('#build-foot .gather-button').click()
        else:page.locator('#build-options .build-card').filter(has=page.locator(f'img[src*="/{choice}-level-1-"]')).click()
    page.wait_for_selector('.flow-dialog[data-kind=muster]',timeout=60000)
    page.wait_for_timeout(500)
    saved=page.evaluate(READ); seed=next(g for g in saved if g['game']['state']['mode']=='muster')
    assert seed['game']['state']['campaignHealth']['populationIssueMoves']==0
    assert seed['game']['state']['campaignHealth']['resourceIssueMoves']==0
    assert '★★★' in page.inner_text('[data-forecast]')
    flow.fight(page)
    def check(name,expected,goals):
        page.wait_for_selector('.flow-dialog[data-kind=result]')
        assert page.locator('.result-stars').get_attribute('aria-label')==f'{expected} of 3 stars'
        for key,value in goals.items():assert page.locator(f'[data-star-goal={key}]').get_attribute('data-earned')==str(value).lower()
        bounds=page.locator('.campaign-star-goals').evaluate('e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}}')
        assert bounds['top']>=0 and bounds['bottom']<=bounds['height'],bounds
        page.screenshot(path=str(OUT/f'{name}.png'))
        results.append({'case':name,'stars':expected,'goals':goals,'pass':True})
    check('clean-victory',3,{'victory':True,'population':True,'resources':True})
    page.wait_for_timeout(500)
    complete=next(g for g in page.evaluate(READ) if g['game']['state']['mode']=='complete')['game']
    assert complete['campaignStars'][complete['campaignId']]==3
    for name,width,height,pop,res,legacy,defeat in [('population-shortage',844,390,True,False,False,False),('resource-shortage',390,844,False,True,False,False),('both-shortages',375,667,True,True,False,False),('legacy-midrun',390,844,False,False,True,False),('defeat',960,540,False,False,False,True)]:
        game=copy.deepcopy(complete);game['state']=copy.deepcopy(seed['game']['state']);game['runId']='rating-qa-'+name
        health=game['state']['campaignHealth'];health['populationIssueMoves']=int(pop);health['resourceIssueMoves']=int(res);health['firstPopulationMove']=2 if pop else None;health['firstResourceMove']=3 if res else None
        if legacy:game['schemaVersion']=6;del game['state']['campaignHealth']
        if defeat:game['state']['trainedUnits']={'archers':0,'swordsmen':0,'horsemen':0};game['state']['elephants']=0;game['state']['population']=1
        # Inject after pagehide autosave, before the next document loads progress.
        page.add_init_script('localStorage.setItem('+json.dumps(seed['key'])+','+json.dumps(json.dumps(game))+');')
        page.set_viewport_size({'width':width,'height':height});page.reload();flow.enter(page,timeout=30000)
        page.wait_for_selector('.flow-dialog[data-kind=muster]',timeout=30000)
        expected=0 if defeat else 1 if legacy else 3-int(pop)-int(res)
        if not defeat:assert '★'*expected in page.inner_text('[data-forecast]')
        flow.fight(page,best=not defeat)
        check(name,expected,{'victory':not defeat,'population':not(defeat or legacy or pop),'resources':not(defeat or legacy or res)})
        page.wait_for_timeout(300)
        current=next(g for g in page.evaluate(READ) if g['game']['state']['mode']=='complete')['game']
        assert current['campaignStars'][current['campaignId']]==3,'replay reduced best stars'
        assert current['schemaVersion']==7
    assert not errors,errors
    browser.close()
(OUT/'results.json').write_text(json.dumps({'cases':results,'errors':errors,'pass':True},indent=2),encoding='utf-8')
print(json.dumps(results,indent=2));print('ALL PASS')
