# MOBILE_PERFORMANCE.md

# Studio Mobile Performance Standards

**Studio Mobile Performance Standard**  
**Applies to:** All Studio games  
**Primary target:** Mobile Web  
**Technology baseline:** HTML5 + JavaScript / TypeScript + Three.js where required  
**Related standards:** GAME_ARCHITECTURE.md, CODING_STANDARDS.md, THREEJS_STANDARDS.md, ART_PIPELINE.md

---

## 1. Purpose

This document defines the performance philosophy and engineering standards for Studio games.

Performance is not a final optimization phase.

It is a product requirement.

The goal is to make games:

- Fast to start.
- Responsive to touch.
- Smooth during gameplay.
- Stable on mid-range and lower-end phones.
- Efficient with memory, battery and network.
- Resilient to mobile browser constraints.
- Measurable and continuously improvable.

The primary principle is:

> **Optimize for the player's actual device and experience, not the developer's laptop.**

---

## 2. Mobile Web Is the Default Target

Studio games should assume that many players will use:

- Mobile browsers.
- Cellular networks.
- Variable network quality.
- Mid-range Android devices.
- Older iPhones.
- High-DPI screens.
- Devices with limited memory.
- Devices experiencing thermal throttling.
- Browsers that suspend or reclaim resources.

Desktop performance is useful for development but is not sufficient as a shipping benchmark.

---

## 3. Performance Is a Product Feature

Performance directly affects:

- First-session conversion.
- Game starts.
- Engagement.
- Retention.
- Session length.
- Frustration.
- Battery usage.
- Data usage.
- Monetization opportunities.

Therefore performance should be considered during:

```text
Game Design
    ↓
Architecture
    ↓
Art / Asset Creation
    ↓
Implementation
    ↓
Testing
    ↓
Release
```

Not only after the game is finished.

---

## 4. Core Performance Principles

1. **Measure before optimizing.**
2. **Optimize the player-visible bottleneck first.**
3. **Prefer predictable performance over occasional peak performance.**
4. **Control memory as aggressively as frame rate.**
5. **Treat network payload as part of performance.**
6. **Avoid unnecessary work every frame.**
7. **Load only what the player needs.**
8. **Design assets for the target device, not the source-generation tool.**
9. **Test on real mobile hardware.**
10. **Never assume desktop performance represents mobile performance.**

---

# 5. Performance Budgets

Every production game should define a performance budget.

At minimum, document:

```text
Target frame rate
Initial download size
Initial playable payload
Peak memory target
Maximum scene complexity
Texture budget
Draw-call budget
Particle budget
Startup target
```

There should not be one universal Studio number for every game.

A simple puzzle game and a 3D action game have different requirements.

The important rule is:

> **Every game must have an explicit budget.**

---

## 6. Frame Rate

Choose a target frame rate appropriate to the game.

For many mobile games:

```text
60 FPS = ideal target where practical
30 FPS = acceptable target for more demanding experiences
```

The important metric is frame time.

Approximate frame budgets:

```text
60 FPS → ~16.7 ms/frame
30 FPS → ~33.3 ms/frame
```

A game that fluctuates heavily between these states can feel worse than a stable lower target.

---

## 7. Frame-Time Stability

Do not optimize only for average FPS.

Monitor:

- Average frame time.
- Worst-frame spikes.
- Long tasks.
- Garbage collection pauses.
- Asset loading stalls.
- Shader compilation stalls.
- Layout/reflow spikes.

A smooth game should avoid unpredictable frame-time spikes.

---

# 8. Main Performance Areas

Analyze performance across five major areas:

```text
CPU
GPU
MEMORY
NETWORK
BATTERY / THERMAL
```

A change that improves one may hurt another.

Example:

```text
Higher resolution
    ↓
Better visual quality
    ↓
Higher GPU cost
    ↓
Higher battery consumption
    ↓
Possible thermal throttling
```

Always evaluate the complete player impact.

---

# 9. CPU Performance

CPU-heavy work commonly comes from:

- Game simulation.
- Physics.
- AI.
- Pathfinding.
- Collision checks.
- DOM manipulation.
- Serialization.
- JSON processing.
- Asset processing.
- Excessive object creation.
- Garbage collection.

Avoid doing unnecessary work every frame.

---

## 10. Hot Paths

Identify frequently executed code.

Typical hot paths include:

```text
game update()
entity update()
collision detection
AI updates
animation updates
render preparation
input processing
```

Keep hot paths simple.

Do not put:

- Logging
- DOM queries
- Large allocations
- Expensive searches
- Repeated parsing

inside hot loops without a strong reason.

---

## 11. Avoid Per-Frame Allocation

Avoid:

```javascript
function update() {
    const result = new Vector3();
    const data = {};
    const items = [];
}
```

Prefer reuse and preallocation where appropriate.

This reduces garbage collection pressure.

See `THREEJS_STANDARDS.md` for Three.js-specific allocation guidance.

---

# 12. Garbage Collection

Garbage collection can create visible frame-time spikes.

Common causes:

- Temporary objects.
- Repeated arrays.
- String construction.
- Short-lived closures.
- Repeated object literals.
- Creating and destroying game entities unnecessarily.

Do not attempt to eliminate every allocation.

Instead:

> **Eliminate unnecessary allocations from performance-critical loops.**

---

# 13. Object Pools

Use pools for frequently created temporary objects.

Good candidates:

- Bullets.
- Particles.
- Damage numbers.
- Floating text.
- Hit effects.
- Repeated enemies.
- Collectibles.

Avoid pooling everything.

Pooling adds complexity and should be used where object churn is meaningful.

---

# 14. GPU Performance

GPU cost commonly comes from:

- Rendering resolution.
- Draw calls.
- Shader complexity.
- Shadows.
- Transparency.
- Post-processing.
- Large textures.
- Overdraw.
- Geometry.
- Reflections.

For Three.js games, see `THREEJS_STANDARDS.md`.

---

# 15. Rendering Resolution

Resolution is one of the most important mobile GPU controls.

A high-DPI device may render substantially more pixels than its physical dimensions suggest.

Do not blindly use maximum device pixel ratio.

Use a controlled pixel ratio and validate visually.

A quality system may dynamically reduce resolution when necessary.

---

# 16. Adaptive Quality

Where appropriate, games may adjust rendering quality based on performance.

Example:

```text
Performance good
    ↓
Maintain quality

Performance degrading
    ↓
Reduce resolution
    ↓
Reduce particles
    ↓
Reduce shadows
    ↓
Reduce post-processing
```

Do not make quality changes so aggressive that the game visibly oscillates.

Use sensible thresholds and hysteresis.

---

# 17. Draw Calls

Draw calls can become a major GPU bottleneck.

Reduce unnecessary draw calls through:

- Material reuse.
- Texture atlases.
- Instancing.
- Batching.
- Geometry reuse.
- Efficient scene structure.

Do not optimize object count without understanding draw-call behavior.

---

# 18. Geometry Budget

Every game should establish a practical geometry budget.

Consider:

- Visible triangles.
- Total loaded geometry.
- Number of meshes.
- LOD levels.
- Animation complexity.

The correct budget depends on:

- Game genre.
- Camera distance.
- Art style.
- Device class.
- Target frame rate.

---

# 19. Level of Detail

Use LOD where it produces meaningful savings.

Example:

```text
Close
 ↓
High detail

Medium distance
 ↓
Medium detail

Far away
 ↓
Low detail / billboard / simplified representation
```

Do not add LOD complexity to tiny games where it provides negligible benefit.

---

# 20. Textures

Texture memory should be actively managed.

Control:

- Dimensions.
- Compression.
- Number of textures.
- Alpha usage.
- Mipmaps.
- Atlasing.
- Texture format.

A 2048×2048 texture can consume far more GPU memory than its compressed network file size suggests.

Therefore:

> **Network size and runtime memory are different budgets.**

---

# 21. Texture Resolution

Use the lowest resolution that provides the required visual quality.

Typical approach:

```text
Hero asset
    → higher resolution

Secondary asset
    → medium resolution

Background/detail
    → lower resolution
```

Do not automatically ship source-generation resolutions.

AI-generated assets should be optimized before integration.

---

# 22. Texture Atlases

Use atlases where appropriate.

Atlasing can reduce:

- Texture switches.
- Material variations.
- Draw calls.

However, excessively large atlases can increase memory usage.

Use them deliberately.

---

# 23. Transparency

Transparency is expensive because of overdraw.

Be careful with:

- Smoke.
- Fire.
- Glows.
- Fog.
- Large transparent planes.
- Particle systems.
- Full-screen overlays.

Prefer smaller, simpler effects where possible.

---

# 24. Particles and VFX

All particle systems should have explicit limits.

Define:

```text
Maximum particles
Maximum simultaneous effects
Maximum effect lifetime
Maximum screen coverage
```

Never allow an effect system to grow indefinitely.

Use pooling where appropriate.

---

# 25. Shadows

Real-time shadows can be expensive.

Use:

- Limited shadow casters.
- Limited shadow receivers.
- Appropriate shadow-map resolution.
- Short shadow distances.
- Fake shadows where suitable.

A stylized blob shadow can sometimes provide most of the perceived value of a complex shadow system.

---

# 26. Post-Processing

Treat post-processing as a premium performance cost.

Potentially expensive features include:

- Bloom.
- SSAO.
- Depth of field.
- Motion blur.
- Multiple render passes.
- Screen-space reflections.

Test every effect on target mobile hardware.

---

# 27. DOM Performance

For HTML5 games, DOM performance matters even when Three.js is used.

Avoid:

- Large DOM trees.
- Frequent DOM creation/destruction.
- Forced synchronous layout.
- Repeated style reads/writes.
- Layout thrashing.

Prefer updating a small number of stable UI elements.

---

# 28. Layout Thrashing

Avoid code like:

```javascript
element.style.width = "...";
const width = element.offsetWidth;
element.style.height = "...";
const height = element.offsetHeight;
```

Repeatedly reading layout after modifying it can force browser recalculation.

Batch DOM updates where practical.

---

# 29. CSS Performance

Keep game UI simple.

Avoid excessive:

- Box shadows.
- Filters.
- Backdrop filters.
- Large blur effects.
- Animated gradients.
- Complex nested layouts.

Visual polish should not automatically mean expensive rendering.

---

# 30. UI Animation

Prefer GPU-friendly transformations when appropriate:

```text
transform
opacity
```

Avoid repeatedly animating layout-heavy properties when a transform can achieve the same effect.

---

# 31. Input Latency

Touch interaction should feel immediate.

Avoid:

- Long event-processing chains.
- Unnecessary network waits.
- Heavy work inside touch handlers.
- Excessive debounce delays.

A touch should quickly become a game action.

---

# 32. Touch Targets

Performance is not only frame rate.

Poorly sized touch controls increase interaction friction.

Use sufficiently large touch targets and avoid requiring pixel-perfect gestures.

---

# 33. Network Performance

Mobile users may be on:

- Fast Wi-Fi.
- 4G.
- 5G.
- Slow cellular networks.
- Congested networks.
- High-latency connections.

Design for variable network quality.

---

# 34. Initial Payload

The initial payload should contain only what is necessary to:

```text
Open
 ↓
Initialize
 ↓
Show useful UI
 ↓
Start the first playable experience
```

Do not require the entire game to download before the player can see anything useful.

---

# 35. Progressive Loading

Prefer:

```text
Boot
 ↓
Core assets
 ↓
First playable state
 ↓
Additional assets
 ↓
Later content
```

over:

```text
Download everything
 ↓
Wait
 ↓
Start game
```

---

# 36. Lazy Loading

Load content when it becomes necessary.

Examples:

- Later levels.
- Optional cosmetics.
- Secondary environments.
- Large audio packs.
- Rare effects.
- Tutorial assets after boot.

Do not preload large assets solely because they might eventually be used.

---

# 37. Asset Prioritization

Every asset should have a loading priority.

Example:

```text
P0 — required for boot
P1 — required for first playable experience
P2 — required shortly after start
P3 — optional / later
```

This can be represented in the asset manifest.

---

# 38. Compression

Use appropriate compression for:

- JavaScript.
- CSS.
- JSON.
- Images.
- 3D assets.
- Audio.

The publishing platform/CDN should deliver compressed assets where supported.

---

# 39. CDN Strategy

Games should use the shared publishing platform/CDN architecture.

Assets should be:

- Versioned.
- Cacheable.
- Immutable where appropriate.
- Served from geographically appropriate infrastructure.
- Addressable by stable asset IDs.

Do not duplicate the same asset across multiple games unnecessarily.

---

# 40. Caching

Use long-lived caching for immutable, versioned assets.

Avoid cache strategies that cause players to repeatedly download unchanged assets.

Asset URLs should change when the underlying asset changes.

---

# 41. Startup Performance

Measure:

```text
Page request
 ↓
HTML available
 ↓
JavaScript loaded
 ↓
Game initialized
 ↓
First meaningful UI
 ↓
First playable state
```

The most important milestone is not merely "page loaded."

It is:

> **How quickly can the player understand and start playing?**

---

# 42. Loading Screens

Loading screens should not hide poor architecture.

A good loading screen:

- Shows progress where meaningful.
- Provides immediate visual feedback.
- Keeps the player informed.
- Does not block unnecessarily.
- Can gracefully handle slow networks.

---

# 43. Perceived Performance

Perceived performance matters.

A game can feel faster when it:

- Shows UI immediately.
- Begins loading in the background.
- Animates progress smoothly.
- Shows partial content early.
- Avoids unexplained blank screens.

---

# 44. Audio Loading

Audio can contribute substantially to startup size.

Prefer loading:

- Essential sounds early.
- Secondary audio later.
- Large music tracks strategically.

Do not preload a large audio library for a game that may use only a small subset during the first session.

---

# 45. Memory Budget

Every game should define a practical memory target.

Track:

```text
Textures
Geometry
Materials
Audio
Animation data
Render targets
Cached assets
JavaScript heap
```

Memory leaks are production defects.

---

# 46. Memory Leak Prevention

Common leak patterns include:

- Objects removed from scenes but still referenced.
- Event listeners not removed.
- Timers not cleared.
- Animation mixers still updating.
- Asset caches growing indefinitely.
- Textures never disposed.
- Render targets never disposed.
- Game sessions retaining stale state.

Test repeated:

```text
Start
 ↓
Play
 ↓
Exit
 ↓
Restart
```

and observe memory behavior.

---

# 47. Long-Session Testing

Do not test only five-minute sessions.

Where relevant, test:

```text
15 min
30 min
60 min+
```

Look for:

- Memory growth.
- Increasing frame time.
- Increasing asset count.
- Increasing DOM size.
- Accumulating event listeners.
- Persistent effects.
- Broken cleanup.

---

# 48. Battery and Thermal Behavior

A game can maintain good FPS while consuming excessive battery.

Watch for:

- Constant maximum GPU load.
- Unnecessary background rendering.
- Excessive animation while idle.
- Continuous particle effects.
- High-resolution rendering when not needed.

When the game is paused or hidden, stop unnecessary work.

---

# 49. Visibility Handling

When the page becomes hidden:

```text
Pause gameplay where appropriate
Pause animation
Reduce rendering work
Stop unnecessary effects
```

Resume cleanly when the page becomes visible again.

---

# 50. Browser Lifecycle

Mobile browsers may suspend or reclaim resources.

The game should handle:

- `visibilitychange`
- Resize.
- Orientation changes.
- Browser suspension.
- WebGL context loss where relevant.

Do not assume a continuous desktop-style browser session.

---

# 51. Low-End Device Strategy

Every production game should identify a minimum supported device class.

Test at least:

```text
High-end device
Mid-range device
Lower-end supported device
```

The game should have a graceful behavior on the lower-end device.

---

# 52. Performance Tiers

Where appropriate:

```text
LOW
 ├── Reduced resolution
 ├── Reduced particles
 ├── Reduced shadows
 ├── Lower texture quality
 └── Reduced post-processing

MEDIUM
 ├── Balanced rendering
 └── Standard effects

HIGH
 ├── Higher resolution
 ├── Better effects
 └── Additional visual quality
```

Do not assume HIGH is the default for every player.

---

# 53. Real-Device Testing

Emulators are useful but insufficient.

Test on real devices.

Record:

- Device.
- Browser.
- OS version.
- Network condition.
- Quality setting.
- FPS/frame time.
- Startup time.
- Memory behavior.
- Major issues.

---

# 54. Performance Test Matrix

Maintain a lightweight test matrix:

| Device Class | Browser | Network | Target | Result |
|---|---|---|---|---|
| High | Modern mobile browser | Fast | Stable target FPS | Pass/Fail |
| Mid | Modern mobile browser | 4G | Stable target FPS | Pass/Fail |
| Low | Modern mobile browser | Slow 4G | Playable | Pass/Fail |

The exact devices should evolve as the Studio's audience data evolves.

---

# 55. Performance Instrumentation

Production builds should not include heavy debugging tools.

Development builds may expose:

```text
FPS
Frame time
Draw calls
Triangles
Memory indicators
Asset count
Entity count
Network timing
Loading progress
```

This information should be easy for developers and AI agents to access.

---

# 56. Performance Regression Testing

Performance can regress even when functionality remains correct.

After significant changes, compare:

```text
Before
vs
After
```

for:

- Startup.
- Frame time.
- Draw calls.
- Memory.
- Download size.
- Asset count.

Do not accept performance regressions blindly.

---

# 57. Performance Budgets in CI

Where practical, automated checks should catch obvious regressions.

Examples:

```text
Bundle size > budget
    → warning/failure

Asset size > budget
    → warning/failure

Unexpected dependency
    → warning

Missing compression
    → warning
```

Not every performance metric can be reliably tested in CI, but obvious regressions should be automated.

---

# 58. AI Agent Rules

When an AI agent changes performance-sensitive code, it should:

1. Identify the likely performance impact.
2. Inspect existing performance utilities before adding new ones.
3. Avoid introducing unnecessary dependencies.
4. Avoid new per-frame allocations.
5. Avoid additional render loops.
6. Avoid unnecessary DOM updates.
7. Avoid unbounded arrays/caches.
8. Preserve asset loading strategy.
9. Preserve disposal behavior.
10. Test at mobile dimensions.
11. Compare before/after performance when practical.
12. Document meaningful trade-offs.

AI agents should not "optimize" code blindly.

---

# 59. Common Performance Anti-Patterns

Avoid:

### Desktop-first validation

"Runs at 120 FPS on my laptop."

This does not prove mobile readiness.

### Unlimited device pixel ratio

Rendering at maximum DPR without measurement.

### Load everything at startup

Downloading the entire game before play begins.

### Huge textures everywhere

Using source-generation resolution directly in production.

### Unbounded particles

Effects that grow with gameplay duration.

### Per-frame DOM manipulation

Repeatedly rebuilding UI.

### Per-frame object creation

Creating temporary objects continuously.

### Permanent caches

Caching every asset forever.

### Excessive shadows

Using complex real-time shadows where players barely notice them.

### Excessive post-processing

Adding effects without measuring cost.

### Premature optimization

Complex optimization before identifying a real bottleneck.

### Optimizing only average FPS

Ignoring frame-time spikes.

---

# 60. Performance Priority Order

When a game is slow, investigate in this order:

```text
1. Is the problem CPU or GPU?
2. Is rendering resolution excessive?
3. Are draw calls excessive?
4. Are shaders/materials expensive?
5. Are shadows/post-processing expensive?
6. Are textures too large?
7. Is there excessive geometry?
8. Is there excessive object creation / GC?
9. Is the DOM doing unnecessary work?
10. Is network/loading causing the perceived slowdown?
11. Is memory growing over time?
12. Is thermal throttling involved?
```

Measure each hypothesis rather than changing everything at once.

---

# 61. Performance Review Checklist

Before release, verify:

### Startup

- [ ] Initial payload is within budget.
- [ ] First meaningful UI appears quickly.
- [ ] First playable state does not wait for unnecessary assets.
- [ ] Loading progress is understandable.
- [ ] Assets are compressed.

### Runtime

- [ ] Target frame rate is achieved on representative devices.
- [ ] Frame-time spikes are understood.
- [ ] Draw calls are within budget.
- [ ] Geometry is within budget.
- [ ] Texture memory is within budget.
- [ ] Particles are bounded.
- [ ] Shadows/effects are justified.
- [ ] No obvious memory leaks exist.

### Mobile

- [ ] Touch input is responsive.
- [ ] Orientation/resizing works.
- [ ] Browser visibility handling works.
- [ ] Low-end device behavior is acceptable.
- [ ] Battery/thermal behavior is reasonable.

### Network

- [ ] Assets are cacheable.
- [ ] Large assets are lazy-loaded.
- [ ] CDN delivery is configured.
- [ ] Slow-network behavior is acceptable.

---

# 62. Definition of Done

A performance-sensitive feature is complete when:

- Its performance impact is understood.
- It stays within the game's defined budget.
- It has been tested at mobile dimensions.
- It has been tested on representative real hardware where appropriate.
- It does not introduce unnecessary per-frame work.
- It does not introduce unbounded memory growth.
- Asset loading remains appropriate.
- Rendering quality is proportional to its player value.
- Relevant performance documentation is updated.

---

# 63. Golden Rules

1. **Mobile is the primary performance target.**
2. **Measure before optimizing.**
3. **Frame-time stability matters more than headline FPS.**
4. **Memory leaks are bugs.**
5. **Network payload is part of performance.**
6. **Load only what the player needs.**
7. **AI-generated assets must be optimized before shipping.**
8. **Control rendering resolution.**
9. **Bound particles, caches and temporary objects.**
10. **Test on real devices.**
11. **Optimize the actual bottleneck, not the most obvious-looking code.**
12. **Do not trade major gameplay responsiveness for cosmetic effects.**

---

# 64. Final Principle

The Studio should not ask:

> "Can this phone technically run the game?"

It should ask:

> **"Does the game feel fast, responsive and reliable on the phones our players actually use?"**

The performance architecture should therefore follow:

```text
Player Experience
       ↓
Performance Budget
       ↓
Measurement
       ↓
Optimization
       ↓
Real-Device Validation
       ↓
Continuous Monitoring
```

Performance is part of game design, engineering, art production and publishing — not a final cleanup task.
