# Browser QA scripts

Automated Playwright checks behind `Docs/QA_RESULTS.md`. They drive a real Chromium and fail loudly (`ALL PASS` / `pass: false`, console errors listed).

## Setup (once)

```powershell
pip install playwright
python -m playwright install chromium
```

## Run

Start both servers first, from the project root:

```powershell
pnpm dev                            # http://127.0.0.1:4173 (gameplay, platform_sdk)
pnpm build; pnpm exec vite preview  # http://127.0.0.1:4174 (viewports, load_time, context_loss)
```

| Script | Server | Checks |
|---|---|---|
| `python Tools/qa/gameplay.py` | 4173 | Fresh start with tutorial, a full 12-move run at 8×, reload mid-game and after the muster, three past bug reproductions |
| `python Tools/qa/platform_sdk.py` | 4173 | Mock SDK call order, cloud restore, portal pause/resume/session end inside an iframe, offline play |
| `python Tools/qa/viewports.py [tag]` | 4174 | Overlaps, off-screen or clipped UI, tap targets under 44 px, text under 11 px, page scroll at six viewports |
| `python Tools/qa/load_time.py` | 4174 | Time to playable and bytes before it, at 10 Mbps and Slow 4G |
| `python Tools/qa/context_loss.py` | 4174 | WebGL context loss and recovery |
| `python Tools/qa/fault_injection.py [--quick]` | 4174 | Breaks things on purpose (16 scenarios): broken or stalled art, a portal SDK that throws, hangs or rejects, blocked or full storage, corrupt saves, another player's save, a save from a newer version, portal session end, battle art failing at the finale, a zero-size iframe. `--quick` skips the 45 s stall test. |

Screenshots go to `Tools/qa/out/` (git-ignored). The scripts use Chromium's software renderer, so their frame rates don't reflect real devices. Use `?perf` on a phone for that.
