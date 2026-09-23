# THREEJS_STANDARDS.md

# Studio Three.js Standards

**Studio Three.js Standard**  
**Applies to:** All Studio games using Three.js  
**Primary target:** Mobile Web  
**Technology baseline:** Three.js + HTML5 + JavaScript / TypeScript  
**Related standards:** GAME_ARCHITECTURE.md, CODING_STANDARDS.md, MOBILE_PERFORMANCE.md

---

## 1. Purpose

This document defines how Three.js should be used across Studio games.

The objective is to ensure that:

- Three.js is used consistently.
- Games remain mobile-first and performant.
- Rendering code does not become the game architecture.
- Game logic remains independent from visual representation.
- AI agents can understand and safely modify Three.js projects.
- Assets are efficiently loaded and disposed.
- Rendering complexity is deliberately managed.
- Multiple games can share proven patterns without becoming identical.

**Three.js is a tool within the Studio architecture. It is not the architecture itself.**

---

## 2. Core Principle

The preferred architecture is:

```text
GAMEPLAY
    ↓
GAME SYSTEMS
    ↓
GAME STATE
    ↓
RENDERING ADAPTER / VIEW
    ↓
THREE.JS
    ↓
WEBGL
```

The game should be able to reason about Player, Enemy, Score, Health, Level, Progress, Rewards and Rules without requiring a Three.js `Mesh` to exist.

Three.js represents the visual world. The game model represents the game.

---

## 3. Separate Model From View

Prefer:

```text
Player
 ├── Game state
 │    ├── health
 │    ├── score
 │    └── movement state
 │
 └── Visual representation
      └── THREE.Mesh
```

Do not use the Three.js object as the authoritative source of gameplay state.

Avoid:

```javascript
mesh.userData.health = 100;
```

Prefer:

```javascript
player.health = 100;
playerView.mesh.position.copy(player.position);
```

---

## 4. Scene Architecture

A typical Studio Three.js scene should have clear ownership.

```text
Scene
 ├── World
 │    ├── Environment
 │    ├── Gameplay Objects
 │    └── Effects
 │
 ├── Characters
 │    ├── Player
 │    └── Enemies
 │
 ├── Lighting
 │
 └── Camera
```

Where practical, use groups for logical ownership.

Avoid putting unrelated objects into a single flat scene structure.

---

## 5. Scene Ownership

Every dynamically created Three.js object should have an identifiable owner.

For example:

```text
Enemy System
    ↓
Enemy
    ↓
Enemy View
    ↓
Three.js Mesh
```

The system that creates an object should normally also be responsible for removing it.

---

## 6. Renderer

Use a single primary renderer per game unless there is a compelling technical reason otherwise.

Renderer settings should be selected according to the game's actual visual requirements and target devices.

Do not enable expensive rendering features by default.

---

## 7. Renderer Pixel Ratio

Do not blindly use unlimited device pixel ratio.

A high-DPI phone can make a game render several times more pixels than necessary.

A controlled pixel ratio is preferred:

```javascript
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
```

For performance-sensitive games, a lower cap may be appropriate.

---

## 8. Resolution Management

Handle browser resizing explicitly.

```javascript
function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
}

window.addEventListener("resize", resize);
```

Do not assume 16:9, 1920×1080, landscape orientation or a fixed canvas size.

---

## 9. Camera

Camera logic should belong to a dedicated camera system where practical.

The camera system may handle:

- Follow behavior
- Zoom
- Shake
- Orientation
- Bounds
- Screen transitions
- Cinematic movement

Avoid scattering camera modifications across gameplay code.

---

## 10. Camera Design for Mobile

The camera should prioritize:

- Gameplay readability
- Player visibility
- Important objectives
- Minimal obstruction
- Stable framing

Avoid excessive camera movement that makes touch gameplay difficult.

---

## 11. Scene Graph Depth

Avoid unnecessarily deep scene graphs.

Deep hierarchies make transforms harder to reason about and can increase update complexity.

Use hierarchy when it has a genuine purpose.

---

## 12. Object Creation

Avoid creating objects every frame.

Bad:

```javascript
function update() {
    const direction = new THREE.Vector3();
}
```

Prefer reusable objects:

```javascript
const tempVector = new THREE.Vector3();

function update() {
    tempVector.set(0, 0, 0);
}
```

This is particularly important inside frequently executed code.

---

## 13. Temporary Objects

Common reusable objects should be allocated once when practical:

```javascript
const tempVector = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempMatrix = new THREE.Matrix4();
```

Do not create temporary vectors, colors, matrices or quaternions repeatedly inside hot loops without a reason.

---

## 14. Game Loop

Use a clearly defined animation loop.

```javascript
function animate(time) {
    const deltaTime = clock.getDelta();

    update(deltaTime);
    render();

    requestAnimationFrame(animate);
}
```

Keep Input, Game Update, Animation and Rendering conceptually separate.

---

## 15. Delta Time

Gameplay movement should generally be time-based rather than frame-based.

Avoid:

```javascript
player.position.x += 0.1;
```

Prefer:

```javascript
player.position.x += speed * deltaTime;
```

This prevents gameplay speed from being tied directly to frame rate.

---

## 16. Fixed vs Variable Updates

Use variable delta time for systems where it is sufficient.

Consider a fixed timestep when deterministic simulation is important.

Do not introduce a complex physics architecture unnecessarily.

---

## 17. Framerate

The target frame rate should be defined per game.

For mobile games, stable performance is generally more important than chasing maximum frame rate.

Monitor frame-time spikes rather than looking only at average FPS.

---

## 18. Geometry

Reuse geometry whenever possible.

```javascript
const geometry = new THREE.BoxGeometry(1, 1, 1);

const meshA = new THREE.Mesh(geometry, material);
const meshB = new THREE.Mesh(geometry, material);
```

Avoid generating identical geometry repeatedly.

---

## 19. Materials

Reuse materials where practical.

Avoid creating hundreds of identical materials unnecessarily.

Material complexity should be justified by visible player value.

---

## 20. Textures

Textures are often a major source of memory usage.

Control:

- Resolution
- Number of textures
- Texture format
- Mipmaps where appropriate
- Filtering
- Anisotropy
- Transparency

Do not use 4K textures simply because the source asset was generated at 4K.

---

## 21. Color Management

Use a consistent color-management approach across the game.

Do not mix incompatible color-space assumptions between textures, materials, renderer, post-processing and UI.

Color handling should be established during project setup and documented.

---

## 22. Lighting

Lighting should be designed around the game's visual style and mobile performance budget.

Prefer a small number of purposeful lights.

Avoid adding many dynamic lights simply to make scenes look more impressive.

---

## 23. Shadows

Real-time shadows can be expensive.

Use them selectively.

Consider lower shadow-map resolution, fewer shadow-casting objects, fewer shadow-receiving objects, baked lighting or stylized alternatives.

---

## 24. Post-Processing

Post-processing should be treated as an optional performance cost.

Examples include:

- Bloom
- Depth of field
- SSAO
- Color grading
- Motion blur
- Screen-space effects

Do not enable post-processing by default.

---

## 25. Draw Calls

Monitor draw calls.

Consider:

- Material reuse
- Texture atlases
- Instancing
- Batching
- Geometry reuse
- Scene organization

A scene with many meshes can still be efficient if appropriately batched.

---

## 26. Instancing

Use instancing for large numbers of visually similar objects where appropriate.

Good candidates include:

- Trees
- Rocks
- Grass
- Repeated props
- Particles
- Decorative objects

Consider `THREE.InstancedMesh` where it materially reduces rendering overhead.

---

## 27. Frustum Culling

Allow Three.js frustum culling to work where appropriate.

Do not disable:

```javascript
mesh.frustumCulled = false;
```

without a specific reason. If culling is disabled, document why.

---

## 28. Visibility Management

Large games should consider explicit visibility management where necessary.

Potential strategies:

```text
Distance culling
Frustum culling
Level streaming
Chunk loading
Object pooling
LOD
```

Use the simplest approach that meets the game's performance requirements.

---

## 29. Object Pooling

Use object pools for frequently created and destroyed objects.

Good candidates:

- Bullets
- Projectiles
- Particles
- Damage numbers
- Temporary effects
- Repeated enemies

Do not pool objects that are created only a few times.

---

## 30. Asset Loading

Use appropriate Three.js loaders for the asset type.

Centralize loading through an asset manager where practical.

Avoid every game system independently loading the same asset.

---

## 31. GLTF / GLB

For 3D game assets, prefer GLTF/GLB where appropriate.

Before shipping a model:

- Inspect geometry.
- Remove unused nodes.
- Remove unused animations.
- Optimize materials.
- Optimize textures.
- Compress where appropriate.
- Validate scale.
- Validate orientation.
- Validate pivots.

---

## 32. Asset Cache

The asset manager should avoid loading the same asset repeatedly.

Conceptually:

```javascript
if (cache.has(assetId)) {
    return cache.get(assetId);
}

const asset = await loadAsset(assetId);

cache.set(assetId, asset);

return asset;
```

Use stable asset IDs as described in `ART_PIPELINE.md`.

---

## 33. Cloning Loaded Assets

When creating multiple instances of a loaded model, understand which components can safely be shared.

Potentially share:

- Geometry
- Textures
- Materials

Clone or isolate components only when necessary.

Avoid deep-cloning an entire model for every instance without understanding the memory consequences.

---

## 34. Disposal

Disposal is mandatory when assets are permanently removed.

Typical cleanup includes:

```javascript
geometry.dispose();
material.dispose();
texture.dispose();
```

Also remove scene references, event listeners, animation mixers, timers and custom references.

Do not dispose shared resources while another object still uses them.

---

## 35. Animation Mixers

Animation mixers should have clear ownership.

When an animated object is removed:

- Stop actions.
- Remove mixer references.
- Release associated resources.
- Ensure it is no longer updated.

---

## 36. Physics

Three.js itself is not a full physics engine.

If a game requires physics, use a suitable physics solution only when necessary.

Keep physics state separate from rendering state:

```text
Physics / Gameplay
       ↓
Entity State
       ↓
Three.js View
```

---

## 37. Collision

Use simplified collision representations where practical:

```text
Sphere
Box
Capsule
Plane
Ray
```

Detailed visual geometry should not automatically become collision geometry.

---

## 38. Raycasting

Raycasting can be useful for:

- Touch selection
- Mouse selection
- Interaction
- Ground detection
- Targeting

Do not raycast against hundreds or thousands of irrelevant objects every frame.

Restrict raycast targets.

---

## 39. Touch Interaction

Touch interaction should be handled by an input system rather than scattered through Three.js objects.

Preferred flow:

```text
Touch
 ↓
Input System
 ↓
Game Action
 ↓
Game Logic
 ↓
Three.js View
```

---

## 40. UI

Do not use Three.js for UI simply because the game uses Three.js.

Prefer HTML/CSS for:

- Menus
- Buttons
- Settings
- Text-heavy screens
- Platform UI
- Accessibility-sensitive elements

Use Three.js UI only when the game genuinely benefits from in-world or rendered UI.

---

## 41. Text

For ordinary UI text, prefer HTML/CSS.

For text rendered inside the 3D world, use an appropriate Three.js-compatible text solution.

Avoid creating hundreds of independent high-cost text meshes.

---

## 42. Audio

Audio should have a dedicated system.

Prefer:

```text
Game Event
   ↓
Audio System
   ↓
Audio Asset
```

rather than tightly coupling gameplay entities to audio implementation details.

---

## 43. Debugging

Provide a development-only debug mode where useful.

Potential debug information:

```text
FPS
Frame time
Draw calls
Triangles
Texture memory
Object count
Active entities
Loaded assets
Camera position
```

Do not ship expensive debugging systems enabled in production.

---

## 44. Performance Profiling

When performance problems occur, measure before optimizing.

Useful metrics include:

- FPS
- Frame time
- CPU time
- GPU time where available
- Draw calls
- Triangle count
- Texture memory
- JavaScript heap
- Asset load time
- Network transfer size

Optimize the actual bottleneck.

---

## 45. Mobile Performance Hierarchy

When optimizing a Three.js game, generally investigate:

```text
1. Excessive rendering resolution
2. Excessive draw calls
3. Excessive shader/material complexity
4. Excessive shadows/post-processing
5. Excessive geometry
6. Excessive texture memory
7. Excessive object creation / GC
8. JavaScript/gameplay bottlenecks
9. Asset loading/network cost
```

The exact bottleneck will vary by game.

---

## 46. Graceful Degradation

Where practical, support quality tiers:

```text
LOW
 ├── Lower resolution
 ├── Reduced shadows
 ├── Reduced particles
 └── Lower texture quality

MEDIUM
 ├── Moderate shadows
 ├── Moderate effects
 └── Standard textures

HIGH
 ├── Higher resolution
 ├── Better shadows
 └── Additional effects
```

Do not assume every device can support the highest quality.

---

## 47. Device Capability

Do not identify device capability purely from device name.

Where practical, use observable runtime characteristics such as WebGL capabilities, screen characteristics and actual performance behavior.

Quality settings should be adjustable.

---

## 48. WebGL Context Loss

Games should consider the possibility of WebGL context loss.

Where appropriate:

- Detect context loss.
- Stop unnecessary work.
- Restore resources where feasible.
- Return the game to a usable state.

Do not assume the WebGL context will remain valid for the entire browser session.

---

## 49. Browser Lifecycle

Mobile browsers may suspend tabs, pause rendering, change visibility, change orientation or reclaim resources.

Listen for relevant browser lifecycle events such as:

```text
visibilitychange
resize
orientation changes
```

The game should pause or adapt appropriately.

---

## 50. Memory Management

Treat memory as a first-class constraint.

Monitor:

- Geometry
- Textures
- Materials
- Render targets
- Animation data
- Audio
- Cached assets

A game that runs for five minutes but crashes after forty minutes of play has a production problem.

---

## 51. Render Targets

Render targets can consume substantial memory.

Use them only when required.

Dispose them when no longer needed.

Avoid keeping multiple high-resolution render targets alive unnecessarily.

---

## 52. Particles

Particles can become expensive quickly.

Prefer:

- Pooled particles
- Bounded particle counts
- Simple materials
- Limited overdraw
- Short lifetimes
- Reduced effects on low-end devices

Do not allow particle systems to grow without a hard upper bound.

---

## 53. Transparency and Overdraw

Transparent objects can be expensive because of overdraw.

Be particularly careful with:

- Smoke
- Fire
- Glows
- Large transparent planes
- Full-screen effects
- Layered particles

---

## 54. Shadows, Reflections and Effects

Treat the following as optional performance features:

- Real-time shadows
- Reflections
- Environment maps
- Bloom
- SSAO
- Depth of field
- Screen-space effects

Enable them only when the visual benefit justifies the cost.

---

## 55. Coding Style

Follow `CODING_STANDARDS.md`.

Three.js code should additionally:

- Keep rendering code separate from game logic.
- Avoid allocations in hot paths.
- Reuse resources.
- Dispose resources correctly.
- Make ownership explicit.
- Avoid hidden global state.

---

## 56. AI Agent Rules

When Claude, Codex or another AI agent modifies Three.js code, it should:

1. Inspect the current scene architecture.
2. Identify the owner of the object/system being modified.
3. Check whether geometry/materials/textures are shared.
4. Check whether an existing asset loader or manager should be reused.
5. Avoid introducing a second render loop.
6. Avoid introducing duplicate loaders.
7. Avoid creating per-frame allocations unnecessarily.
8. Preserve disposal behavior.
9. Test on a mobile-sized viewport.
10. Check performance-sensitive changes.

AI agents should not make Three.js architectural changes simply to satisfy a local feature request.

---

## 57. Common Anti-Patterns

Avoid:

### One giant Three.js file

```text
game.js
 ├── UI
 ├── gameplay
 ├── physics
 ├── assets
 ├── audio
 ├── analytics
 └── rendering
```

### Mesh as game state

```javascript
mesh.userData.score
mesh.userData.health
```

### Per-frame allocation

```javascript
function update() {
    const vector = new THREE.Vector3();
}
```

### Duplicate resources

Creating identical geometry/materials/textures repeatedly.

### Missing disposal

Removing objects from the scene but never releasing GPU resources.

### Unbounded effects

Particles or temporary objects growing indefinitely.

### Excessive post-processing

Adding expensive effects without measuring their impact.

### Desktop-first rendering

Optimizing only for a powerful development computer.

---

## 58. Definition of Done

A Three.js feature is complete when:

- Rendering works correctly.
- Game state remains independent from rendering state.
- Assets are loaded through the appropriate system.
- Shared resources are reused where practical.
- Temporary objects do not create unnecessary garbage.
- Removed resources are properly disposed.
- Mobile viewport behavior is tested.
- Performance impact is understood.
- No unnecessary render loops were introduced.
- No unnecessary dependencies were introduced.
- Relevant documentation is updated.

---

## 59. Golden Rules

1. **Three.js is the renderer, not the game architecture.**
2. **Keep game state independent from visual objects.**
3. **Reuse geometry, materials and textures.**
4. **Avoid allocations in hot paths.**
5. **Dispose resources deliberately.**
6. **Treat mobile GPU and memory as constrained resources.**
7. **Use the DOM for ordinary UI where appropriate.**
8. **Measure performance before optimizing.**
9. **Prefer simple rendering solutions over unnecessary effects.**
10. **Keep object ownership clear.**
11. **Use pooling for genuinely high-frequency objects.**
12. **Never let AI agents introduce rendering complexity without understanding its performance cost.**

---

## 60. Final Principle

The purpose of Three.js in the Studio is not to maximize technical sophistication.

It is to create the best possible gameplay experience within the constraints of mobile web.

The desired architecture is:

```text
Game Design
     ↓
Game Systems
     ↓
Game State
     ↓
Rendering View
     ↓
Three.js
     ↓
WebGL
     ↓
Mobile Browser
```

The player should experience a smooth, responsive game.

They should never need to know how sophisticated — or how simple — the rendering architecture is.
