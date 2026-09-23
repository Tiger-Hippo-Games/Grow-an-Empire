"""Time to playable (performance mark gae-playable) and bytes downloaded before it, at 10 Mbps and Slow 4G."""
# Run from the project root with the servers up (see Tools/qa/README.md).
import pathlib as _pl
OUT = _pl.Path(__file__).resolve().parent / "out"
OUT.mkdir(exist_ok=True)
import json
from playwright.sync_api import sync_playwright
URL="http://127.0.0.1:4174/"
res={}
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
    for label,mbps,lat in [("10 Mbps",10,40),("Slow 4G 1.6 Mbps",1.6,150)]:
        ctx=b.new_context(viewport={"width":1280,"height":720}); ctx.add_init_script("localStorage.setItem('grow-an-empire:tutorial:v1','complete')")
        pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg); cdp.send("Network.enable")
        cdp.send("Network.emulateNetworkConditions",{"offline":False,"latency":lat,"downloadThroughput":mbps*1e6/8,"uploadThroughput":mbps*1e6/8})
        pg.goto(URL, wait_until="commit"); pg.wait_for_function("performance.getEntriesByName('gae-playable').length>0",timeout=180000)
        r=pg.evaluate("""() => { const t = performance.getEntriesByName('gae-playable')[0].startTime;
          const rs = performance.getEntriesByType('resource').filter(e => e.responseEnd <= t);
          return { playable_s: +(t/1000).toFixed(2), requests: rs.length + 1, MB: +((rs.reduce((a,e)=>a+(e.encodedBodySize||0),0))/1e6).toFixed(2) }; }""")
        res[label]=r; ctx.close()
    b.close()
print(json.dumps(res,indent=1))
