import json, os, pathlib, re, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from flow import enter, past_report, play_to_muster, fight, speed8
URL = os.environ.get('GAE_URL', 'http://127.0.0.1:4175/api/v1/games/grow/play/')
OUT=pathlib.Path('Tools/qa/out/leaderboard'); OUT.mkdir(parents=True, exist_ok=True)
SLUGS=re.findall(r'slug: "([^"]+)"',pathlib.Path('src/game/campaigns.ts').read_text(encoding='utf-8'))
IDS=['campaign-1-first-muster']+[f'campaign-{i+1}-{slug}' for i,slug in enumerate(SLUGS) if i]
SDK='''window.__boardCalls=[]; window.__boardState='full'; window.__best=null;
const record=(method,...args)=>window.__boardCalls.push({method,args});
window.Platform={
init:async options=>{record('init',options)},
login:async()=>({player:{id:'qa-player',displayName:'QA Player',authType:window.__guest?'GUEST':'EMAIL'}}),
getGameProgress:async()=>({progress:null}),saveGameProgress:async()=>({}),
submitScore:async(slug,score,metadata)=>{record('submitScore',slug,score,metadata); window.__best=Math.max(window.__best??0,score);},
getLeaderboard:async(slug,limit)=>{record('getLeaderboard',slug,limit); if(window.__boardState==='error')throw Error('QA offline');
return {entries:window.__boardState==='empty'?[]:Array.from({length:10},(_,i)=>({rank:i+1,displayName:i===0?'Raja <img src=x onerror=alert(1)>':'Player '+(i+1),score:25-i}))};},
getMyRank:async(slug)=>{record('getMyRank',slug);return {rank:window.__best===null?null:12,score:window.__best};},
startSession(){},endSession(){},track(){}};
'''
R=json.loads(OUT.joinpath('results.json').read_text()) if '--long-only' in sys.argv and OUT.joinpath('results.json').exists() else {};
with sync_playwright() as p:
 b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for w,h,guest in ([] if '--long-only' in sys.argv else [(1920,1080,False),(390,844,True),(844,390,True)]):
  ctx=b.new_context(viewport={'width':w,'height':h});ctx.add_init_script(f'window.__guest={str(guest).lower()}; localStorage.setItem("grow-an-empire:tutorial:v1","complete")')
  ctx.route('**/sdk/platform-sdk.js',lambda route:route.fulfill(content_type='application/javascript',body=SDK))
  pg=ctx.new_page(); errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.goto(URL);pg.wait_for_function("document.documentElement.dataset.booted==='true'",timeout=60000)
  pg.click('#campaign-realm');pg.click('[data-tab=players]');pg.wait_for_selector('.player-rankings')
  assert pg.locator('.player-rankings tbody tr').count()==10
  assert pg.locator('.player-rankings img').count()==0
  assert 'Raja <img' in pg.inner_text('.player-rankings')
  assert 'Monday at 00:00 UTC' in pg.inner_text('[data-player-board]')
  assert pg.evaluate("window.__boardCalls.filter(c=>c.method==='getMyRank').length")==(0 if guest else 1)
  assert pg.evaluate("window.__boardCalls.find(c=>c.method==='init').args[0].gameId")=='grow'
  bounds=pg.locator('.realm-board').bounding_box(); assert bounds['x']>=0 and bounds['y']>=0 and bounds['x']+bounds['width']<=w+1 and bounds['y']+bounds['height']<=h+1
  hud=pg.locator('#resource-hud').bounding_box()
  tab=pg.locator('[data-tab=players]').bounding_box()
  assert tab['y'] >= hud['y']+hud['height'], (hud,tab)
  refresh=pg.locator('[data-refresh]').bounding_box(); assert refresh['height']>=44
  pg.screenshot(path=str(OUT/f'board-{w}x{h}.png'))
  pg.evaluate("window.__boardState='empty'");pg.click('[data-refresh]');pg.wait_for_selector('text=No scores yet this week.')
  pg.evaluate("window.__boardState='error'");pg.click('[data-refresh]');pg.wait_for_selector('text=The leaderboard is unavailable.')
  pg.evaluate("window.__boardState='full'");pg.click('[data-refresh]');pg.wait_for_selector('.player-rankings')
  pg.keyboard.press('Escape'); assert not pg.is_visible('.realm-scrim')
  assert pg.evaluate("document.activeElement.id")=='campaign-realm'
  if not guest:
   enter(pg);speed8(pg);play_to_muster(pg);fight(pg)
   pg.wait_for_function("window.__boardCalls.some(c=>c.method==='submitScore')")
   posts=pg.evaluate("window.__boardCalls.filter(c=>c.method==='submitScore')")
   assert posts[0]['args'][0:2]==['strongplayer',1],posts
   pg.click('.flow-dialog [data-action=map]');pg.click('#campaign-realm');pg.click('[data-tab=players]');pg.wait_for_selector('.player-rankings')
   assert 'Your rank: #12' in pg.inner_text('[data-player-board]')
   pg.keyboard.press('Escape')
   R['first-win-submission']=posts
  R[f'{w}x{h}']={'guest':guest,'errors':errors,'pass':not errors}
  assert not errors
  print(f'PASS rankings {w}x{h}',flush=True)
  ctx.close()
 OUT.joinpath('results.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
 # A full 25-move journey, with existing wins seeded only for QA unlocking.
 ctx=b.new_context(viewport={'width':1920,'height':1080})
 ctx.route('**/sdk/platform-sdk.js',lambda route:route.fulfill(content_type='application/javascript',body=SDK))
 pg=ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(URL);pg.wait_for_function("document.documentElement.dataset.booted==='true'",timeout=60000)
 seed=pg.evaluate("JSON.parse(localStorage.getItem('grow-an-empire:save:v1'))")
 seed.update(campaignId=IDS[24],campaignStars={id:3 for id in IDS[:24]},completedCampaignIds=IDS[:24],playerId='qa-player')
 seed['settings']['tutorialComplete']=True
 ctx.add_init_script("if(!localStorage.getItem('qa-seeded')) { localStorage.setItem('grow-an-empire:save:v1',"+json.dumps(json.dumps(seed))+ ");localStorage.setItem('qa-seeded','1'); }")
 pg.reload();pg.wait_for_function("document.documentElement.dataset.booted==='true'",timeout=60000)
 enter(pg);speed8(pg);moves=[]
 def check_move(move):
  moves.append(move);past_report(pg)
  print(f'Campaign 25 move {move}',flush=True)
  assert pg.inner_text('#move').endswith('/ 25'),pg.inner_text('#move')
  if move==14:
   pg.reload();pg.wait_for_function("document.documentElement.dataset.booted==='true'",timeout=60000);enter(pg);speed8(pg);past_report(pg)
 play_to_muster(pg,on_move=check_move)
 assert moves==list(range(1,26)),moves
 result=fight(pg);posts=pg.evaluate("window.__boardCalls.filter(c=>c.method==='submitScore')")
 assert posts and posts[0]['args'][0]=='strongplayer' and posts[0]['args'][1] in (24,25),posts
 pg.screenshot(path=str(OUT/'campaign-25-result.png'))
 R['25-move-journey']={'moves':moves,'postedScore':posts[0]['args'][1],'result':result,'errors':errors,'pass':not errors}
 assert not errors
 ctx.close();b.close()
OUT.joinpath('results.json').write_text(json.dumps(R,indent=2),encoding='utf-8')
print(json.dumps(R,indent=2));print('ALL PASSED')
