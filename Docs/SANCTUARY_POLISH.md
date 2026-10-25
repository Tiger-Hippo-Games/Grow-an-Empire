# Applicable polish from Grow a Sanctuary

24 October 2026 · Grow an Empire v0.14.0

**Density follow-up, v0.14.1:** the user requested one civilian per completed building, with trained armies explicitly exempt. Production and the review page now use one building-assigned worker instead of the 80-person population crowd described in this historical comparison. Focused harvesting replaces the same site's commuter; construction keeps one crew. The 80-actor traffic run remains a stress test, not the current visual density. Army recruitment, idle garrison and battle counts remain unchanged.

Reference: [the supplied comparison](<D:/Game Development/Zookeeper/grow-a-sanctuary/IMPROVEMENTS_VS_GROW_AN_EMPIRE.md>) and Sanctuary's `staffTraffic.ts` / `routeSampler.ts`, inspected alongside Empire's actual source. The comparison is design evidence, not a development instruction or a measured renderer comparison.

| Improvement | Empire implementation and scope |
|---|---|
| More intermediate walk poses | Builder, farmer and woodcutter now ship eight directions × eight authored pose images: 192 frames. Existing identity, painted palette and props guide the new art. Other civilian/military roles keep their previous sheets. Merchant drafts failed grid review and are archived rather than shipped. |
| Registration and clean atlas boundaries | Runtime export keeps transparent gutters and aligns feet using a shared scale. It excludes clipped fragments from adjacent cells. Previous masters are preserved; no duplicated or interpolated frames claim extra poses. |
| Persistent trips | Citizens retain their route and distance when construction adds routes. New routes gain workers on later returns to the civic hub, without redirecting a citizen mid-trip. |
| Responsive movement | A visual 30 Hz traffic model accelerates starts, slows near corners/work stops, uses direction-relative passing lanes, follows citizens on the same physical edge, queues at occupied work stops and uses FIFO junction reservations. Waiting freezes stride advancement. All 80 representative citizens complete multiple visits during the ten-minute stress test. |
| Shared road hierarchy | Authored service branches become canonical undirected edges. Every visible edge is painted once; supply/trade walks reuse it. Shared trunks widen modestly with their built-site usage, alongside existing eased civic road growth. |
| Efficient sampling | Immutable polylines share cached cumulative lengths and binary-search sampling. Civilians, garrison walks and the focused construction crew use the sampler. Construction crew walking also consumes the new poses by distance traveled. |

## Deliberately retained

- **Full-city contain camera and choice tray.** The user explicitly requested the complete city in portal iframes. Sanctuary's cover camera, panning and top-only navigation solve a different presentation problem.
- **Existing plots and authored district routes.** This pass does not import Sanctuary's obstacle-checked lattice planner or claim new clearance around every reserved plot. A complete road redesign would need a separate authored layout and building-footprint review.
- **Simulation-driven construction and adjustable speed.** No forced 15-second wait, six-second visual-only construction, auto-decisions or new economy timing is introduced.
- **Current campaign, battle and score model.** No animal systems, habitats, care tutorial, regional map set, local attempt board, campaign rebalance or save-schema change applies.
- **Existing battle polish.** The v0.13.0 combat atlases and exact casualty/pause/Skip rules remain. These changes improve civilian city activity rather than repainting the same battle assets again.

## Verification and limits

`pnpm check` passes TypeScript, ESLint and 308 tests, including route coverage/deduplication, cached sampling, trip persistence, fixed-step/paused clocks, frozen waiting strides and a ten-minute virtual run with 80 citizens. `Tools/qa/character_atlases.py` decodes all three new runtime sheets, checks 64 nonempty distinct images, gutters and foot registration, and exports a contact sheet and eight-pose GIF.

`Tools/qa/city_motion.py` uses the actual renderer, shared roads, 80 civilians and 42 garrison soldiers in an isolated all-catalog art fixture. It checks pause/step/resume, visible motion and image requests. This fixture does not read or write saves; its full catalog is a visual stress composition, not an example of an ordinary campaign state. Production campaign checks and package evidence belong in [QA_RESULTS.md](QA_RESULTS.md).

Traffic is representative presentation, not individual economic delivery. A visual queue cannot delay resources, construction or training. No cross-game performance superiority, physical-device frame rate or live-portal publication is claimed.

Art provenance, accepted masters and exact prompts: [POLISH_0_14_0.md](../Assets/Art/Production/Characters/POLISH_0_14_0.md). Runtime image generation used the built-in imagegen tool; its default originals were written to tool-managed C: storage, then copied into this project on D:.
