# CODING_STANDARDS.md

# Studio Coding Standards

**Studio AI Coding Standard**  
**Applies to:** All games developed for the Studio Publishing Platform  
**Primary platforms:** Mobile Web, Desktop Web  
**Technology baseline:** HTML5, CSS, JavaScript / TypeScript, Three.js where required

---

## 1. Purpose

This document defines how code should be written across all Studio games.

It exists to ensure that:

- Code remains understandable to humans and AI agents.
- Claude, Codex and other coding agents can work consistently across projects.
- Multiple developers can safely contribute to the same codebase.
- Games remain performant on mobile browsers.
- Common platform functionality is reused rather than duplicated.
- Games remain easy to modify after launch.
- AI-generated code does not gradually become unmaintainable code.

These standards apply unless a project explicitly documents an exception.

---

## 2. Core Principle

### Optimize for clarity, maintainability and iteration speed.

The code does not need to be clever.

Prefer descriptive names, straightforward control flow and small, understandable modules.

**Readable code is a development tool** because the codebase will be read and modified repeatedly by both humans and AI agents.

---

## 3. AI-First Development

AI agents are first-class contributors to Studio projects.

Claude and Codex should be able to enter an unfamiliar repository and understand:

1. What the game does.
2. How the game is structured.
3. Where gameplay logic lives.
4. How platform services are accessed.
5. How state is managed.
6. How assets are loaded.
7. How the game is built and deployed.
8. How tests are run.

Every game should contain:

```text
CLAUDE.md
AGENTS.md
README.md
```

These files should remain current.

---

## 4. Before Writing Code

Before making a non-trivial change, an AI agent or developer should:

1. Read `GAME_ARCHITECTURE.md`.
2. Read `CLAUDE.md`.
3. Read `AGENTS.md`.
4. Inspect the existing implementation.
5. Identify existing utilities/components that can be reused.
6. Identify relevant platform APIs.
7. Understand the current state-management approach.
8. Check whether tests already exist.
9. Make the smallest reasonable change.

**Inspect first. Implement second.**

---

## 5. Minimize Unnecessary Changes

### Do

- Change only what is required.
- Preserve existing behavior.
- Reuse existing components.
- Keep commits focused.
- Explain architectural changes.

### Do not

- Rewrite unrelated code.
- Reformat the entire project.
- Rename large numbers of files without reason.
- Replace working libraries unnecessarily.
- Introduce a framework simply because an AI agent prefers it.
- Turn a feature request into a codebase rewrite.

---

## 6. Technology Principles

The default technology stack is:

```text
HTML
CSS
JavaScript / TypeScript
Three.js when required
Browser APIs
Studio Platform SDK
```

Do not introduce additional frameworks or libraries without a clear reason.

Every dependency introduces download, maintenance, security, build and AI-context costs.

Prefer the simplest technology that solves the problem.

---

## 7. JavaScript / TypeScript

Prefer modern JavaScript.

Use:

```text
const
let
async / await
ES modules
classes where appropriate
destructuring where readable
optional chaining where appropriate
```

Avoid:

```text
var
global variables
deeply nested callbacks
unnecessary inheritance
clever metaprogramming
```

Use `let` only when reassignment is actually required.

---

## 8. TypeScript

TypeScript is preferred for larger or more complex projects.

Use explicit types for:

- Public APIs
- Platform interfaces
- Important game-state structures
- Configuration objects
- Shared systems
- Complex function parameters

Avoid `any` unless there is a documented reason.

Types should make the code easier to understand, not create unnecessary complexity.

---

## 9. Naming

Use descriptive names.

### Variables

Prefer:

```text
playerScore
enemyCount
currentLevel
remainingTime
```

Avoid:

```text
ps
ec
lvl
t
```

### Functions

Use verbs:

```text
calculateScore()
spawnEnemy()
loadLevel()
saveProgress()
startGame()
```

### Booleans

Prefer:

```text
isGameOver
hasStarted
canMove
isLoading
```

### Classes

Use PascalCase:

```text
GameManager
PlayerController
EnemySpawner
PlatformAdapter
```

### Constants

Use uppercase for genuine global/configuration constants:

```text
MAX_PLAYERS
DEFAULT_GAME_SPEED
```

Do not turn every variable into uppercase.

---

## 10. Functions

Functions should generally do one understandable thing.

Prefer focused functions such as:

```javascript
function calculateFinalScore(score, multiplier) {
    return score * multiplier;
}
```

rather than a single function responsible for gameplay, UI, persistence, analytics, audio and rewards.

If a function becomes difficult to explain in one sentence, consider splitting it.

---

## 11. Function Size

There is no absolute line-count rule.

Functions should remain small enough to understand quickly.

A function containing 100+ lines should trigger a review.

Do not blindly split every function into tiny functions.

The goal is:

> One clear responsibility, not one line per function.

---

## 12. Classes

Use classes when they represent a meaningful entity or system.

Good examples:

```text
Game
Player
Enemy
Level
AudioManager
InputManager
AssetManager
TournamentManager
```

Avoid creating classes simply to wrap a single function.

Prefer composition over inheritance when practical.

---

## 13. Game State

Game state should have a clear owner.

Avoid scattering state across global variables.

For small games, a clearly defined structure is acceptable:

```javascript
const gameState = {
    score: 0,
    level: 1,
    lives: 3,
    coins: 0,
    isPlaying: false
};
```

For larger games, use a dedicated state manager or state class.

---

## 14. State Changes

Important state changes should happen through identifiable functions or systems.

Prefer:

```javascript
gameState.addScore(100);
```

over arbitrary modifications from many locations.

This becomes increasingly important as games become more complex.

---

## 15. Separate Gameplay From UI

Gameplay logic should not be deeply embedded inside UI code.

Prefer:

```javascript
button.onclick = () => {
    game.startLevel();
};
```

The game system decides what starting a level means.

UI should primarily communicate with game systems.

---

## 16. Separate Game Logic From Platform Logic

Game code should use the platform abstraction.

Prefer:

```javascript
platform.analytics.track("level_completed", data);
```

rather than direct vendor calls from gameplay code.

Likewise:

```javascript
platform.player.getProfile();
platform.progression.saveProgress(data);
platform.leaderboard.submitScore(score);
platform.ads.showRewarded();
```

Game logic should not need to know which underlying vendor provides the service.

---

## 17. Dependency Direction

Preferred dependency direction:

```text
UI
 ↓
Game Systems
 ↓
Game State
 ↓
Platform Adapter
 ↓
Publishing Platform
```

Avoid circular dependencies such as UI → Game → UI where practical.

---

## 18. Events

Use events when systems need to communicate without becoming tightly coupled.

Example:

```javascript
game.events.emit("levelCompleted", {
    level: 5,
    score: 12000
});
```

Analytics or other systems can subscribe.

Do not create an event architecture for trivial interactions.

---

## 19. Async Code

Use `async / await` for asynchronous operations.

Handle failures explicitly.

```javascript
try {
    const player = await platform.player.getProfile();
} catch (error) {
    handlePlayerLoadError(error);
}
```

Do not silently swallow errors.

---

## 20. Error Handling

Errors should be:

- Detected
- Logged appropriately
- Handled where recovery is possible
- Communicated to the user where necessary

Avoid empty catch blocks.

Use meaningful error messages.

---

## 21. Logging

Use logging during development.

Prefer structured logs:

```javascript
console.info("Level loaded", {
    levelId,
    loadTime
});
```

Avoid excessive logging in production.

Never log:

- Authentication tokens
- Payment information
- Secrets
- Sensitive player information

---

## 22. Configuration

Do not hard-code values likely to change.

Good candidates for configuration include:

- Economy values
- Difficulty
- Rewards
- Timers
- Feature flags
- Event settings
- Ad frequency
- Level parameters

Configuration should eventually be capable of being supplied by the platform.

---

## 23. Magic Numbers

Avoid unexplained numbers.

Prefer:

```javascript
player.x += config.player.moveSpeed;
```

over embedding unexplained balance or gameplay values throughout code.

Not every mathematical constant needs a named variable. Use judgment.

---

## 24. Three.js Standards

Three.js should be treated as a rendering/game-engine component, not as the architecture of the entire game.

Separate:

```text
Game Logic
     ↓
Game Systems
     ↓
Rendering
     ↓
Three.js
```

Core game rules should not depend on Three.js rendering objects.

The Three.js mesh represents the visual object; the game model represents the game entity.

---

## 25. Three.js Object Lifecycle

Every dynamically created Three.js object must have a clear lifecycle:

```text
Create
 ↓
Use
 ↓
Remove
 ↓
Dispose
```

When objects are permanently removed, clean up:

- Geometry
- Materials
- Textures
- Render targets
- Event listeners
- References

Memory leaks are particularly damaging on mobile devices.

---

## 26. Animation Loops

Use a single clearly defined rendering/game loop where practical.

Avoid multiple independent `requestAnimationFrame` loops unless there is a specific reason.

Keep gameplay updates and rendering responsibilities clearly separated.

---

## 27. Mobile Input

Input should be abstracted away from gameplay logic.

Prefer:

```javascript
input.isPressed("jump");
```

rather than gameplay code directly checking touch events.

This allows the same gameplay system to support touch, mouse, keyboard and potentially gamepad input.

---

## 28. Responsive Design

Never assume a fixed screen size.

Games should adapt to:

- Phones
- Tablets
- Desktop browsers
- Portrait
- Landscape

An internal game resolution is acceptable when deliberately designed that way.

---

## 29. Asset Loading

Assets should be loaded deliberately.

Avoid loading everything synchronously before gameplay begins.

Prefer:

```text
Core assets
    ↓
First playable moment
    ↓
Additional assets
    ↓
Background loading
```

Use asset manifests where practical.

---

## 30. Caching

Cache assets that are expensive to download and safe to reuse.

Use versioned assets or cache-busting strategies to prevent stale production assets from causing compatibility problems.

---

## 31. DOM Usage

Use the DOM for:

- Menus
- Forms
- Settings
- Text-heavy UI
- Accessibility-sensitive UI
- Platform integration

Use Canvas / Three.js for:

- Game rendering
- Real-time visual effects
- Game-world objects
- High-frequency rendering

Do not render ordinary HTML UI inside Three.js unnecessarily.

---

## 32. CSS

CSS should be organized and reusable.

Avoid excessive inline styles.

Prefer CSS classes where practical.

Keep visual styling separate from gameplay logic.

---

## 33. Accessibility

Where practical, UI outside the game canvas should support:

- Semantic HTML
- Keyboard navigation
- Appropriate labels
- Readable text
- Sufficient touch target size
- Reduced-motion preferences where appropriate

---

## 34. Security

Never place secrets in client-side code.

Anything shipped to the browser should be assumed to be publicly inspectable.

Never include:

- Private API keys
- Database credentials
- Admin tokens
- Payment secrets
- Server credentials

Client validation is not security.

Anything valuable must be validated by the backend.

---

## 35. API Calls

Centralize platform API communication.

Avoid scattering `fetch()` calls throughout gameplay code.

Prefer:

```text
Platform Service
      ↓
API Client
      ↓
Backend
```

This makes authentication, retries, error handling and API versioning easier to manage.

---

## 36. Network Resilience

Assume that network calls can fail.

Distinguish between:

```text
Temporary failure
Permanent failure
User action required
Safe to retry
Unsafe to retry
```

Do not automatically retry operations that could create duplicate transactions.

---

## 37. Persistence

Use local storage for low-value local preferences.

Use the platform backend for authoritative player data.

Never rely exclusively on local storage for:

- Purchases
- Currency
- Competitive scores
- Valuable inventory
- Premium entitlements

---

## 38. Testing

Every significant gameplay system should be testable independently where practical.

Prioritize testing for:

- Game rules
- Scoring
- Rewards
- Economy
- Progression
- Level completion
- State transitions
- API adapters

Pure logic should be easier to test than rendering code.

---

## 39. Build Validation

Before considering a feature complete:

```text
Code
 ↓
Lint / Type check
 ↓
Build
 ↓
Automated tests
 ↓
Mobile browser test
 ↓
Desktop browser test
 ↓
Production-like deployment test
```

AI agents should not claim a feature is complete without performing the available validation steps.

---

## 40. Comments

Comments should explain **why**, not simply repeat **what** the code does.

Good comments explain:

- Non-obvious business rules
- Temporary workarounds
- Performance decisions
- Architectural constraints
- Compatibility decisions

Do not comment obvious code.

---

## 41. TODOs

TODOs should be meaningful.

Good:

```text
TODO: Replace temporary local reward calculation with
platform-authoritative reward validation before launch.
```

Where possible, link significant TODOs to an issue/task.

---

## 42. Dead Code

Do not leave unused code in the repository.

Remove:

- Unused functions
- Unused imports
- Obsolete experiments
- Temporary debugging code
- Commented-out implementations

Git already preserves history.

---

## 43. Dependencies

Before adding a dependency, ask:

1. Do we really need it?
2. Can the functionality be implemented simply without it?
3. Is the package maintained?
4. Does it materially increase bundle size?
5. Does it introduce security or licensing concerns?
6. Will AI agents understand and work effectively with it?

Avoid dependencies for trivial functionality.

---

## 44. Architecture Changes

If a change significantly affects architecture, document it.

Examples:

- New shared service
- New state-management approach
- New rendering architecture
- New platform integration
- New persistence model
- New major dependency
- Major performance change

Use an Architecture Decision Record where appropriate.

---

## 45. Git Standards

Commits should be small and meaningful.

Good:

```text
Add tournament score submission
Fix mobile pause handling
Add lazy loading for level assets
Improve enemy spawn performance
```

Avoid:

```text
updates
changes
fixes
stuff
```

Do not combine unrelated work in one commit.

---

## 46. Branching

For non-trivial work, use branches.

```text
main
 │
 ├── feature/tournament-system
 ├── feature/new-levels
 ├── fix/mobile-input
 └── refactor/platform-adapter
```

Do not develop major unrelated features directly on the production branch.

---

## 47. AI Agent Git Behavior

AI agents must be conservative with Git.

Agents should:

- Inspect repository status before significant changes.
- Avoid overwriting uncommitted human work.
- Avoid force pushes unless explicitly instructed.
- Avoid destructive Git commands unless explicitly authorized.
- Keep commits scoped.
- Clearly report files changed.

Never assume the repository is clean.

---

## 48. Multiple Developers and AI Agents

Multiple people and AI agents may work simultaneously.

Therefore:

- Keep modules loosely coupled.
- Keep interfaces stable.
- Minimize broad refactors.
- Avoid changing shared files unnecessarily.
- Use branches/worktrees for parallel work.
- Communicate changes to shared APIs.
- Integrate changes through the team's normal review process.

The goal is to make parallel development safe.

---

## 49. AI Agent Output Standard

When an AI agent completes a coding task, it should report:

```text
What changed
Files changed
Important architectural decisions
Tests/checks performed
Known limitations
Potential follow-up work
```

---

## 50. Avoid AI Overengineering

AI agents frequently introduce unnecessary abstraction.

Do not create elaborate abstractions simply because they appear architecturally sophisticated.

Before adding an abstraction, ask:

> Does this solve a current problem, or does it solve an imagined future problem?

Prefer simple code until repetition or complexity justifies abstraction.

---

## 51. Refactoring Rule

Refactor when:

- Code is duplicated repeatedly.
- A module has multiple unrelated responsibilities.
- Testing becomes difficult.
- A platform boundary is being violated.
- Performance requires structural change.
- The current implementation is blocking development.

Do not refactor merely because another implementation looks aesthetically cleaner.

---

## 52. Performance Awareness

Every developer and AI agent should consider performance when writing code.

Pay particular attention to:

- Per-frame allocations
- DOM manipulation
- Object creation
- Garbage collection
- Large arrays
- Texture memory
- Draw calls
- Network requests
- Bundle size
- Asset size

Measure before optimizing where practical.

---

## 53. Game Loop Rule

Code that executes every frame is performance-sensitive.

Be particularly careful with:

```text
update()
animate()
render()
tick()
```

Avoid unnecessary object creation, array creation, DOM queries, network calls and logging inside the frame loop.

---

## 54. Mobile Performance Priority

When visual complexity conflicts with mobile performance, mobile performance generally wins.

The game should feel responsive on mid-range mobile devices, not merely perform well on the developer's desktop.

See `MOBILE_PERFORMANCE.md` for detailed requirements.

---

## 55. File Organization

Files should have a clear responsibility.

Avoid giant files containing rendering, input, audio, analytics, economy, UI, game logic and API calls together.

As complexity grows, split systems into meaningful modules.

However, do not create dozens of tiny files for a small game.

---

## 56. Reuse Before Rebuild

Before implementing functionality, search:

1. Does this already exist in the current game?
2. Does the platform already provide it?
3. Does another Studio game already solve it?

Only then implement a new solution.

---

## 57. Platform Reuse Rule

If functionality is likely to be common across multiple Studio games, consider whether it belongs in the shared platform SDK.

Examples:

```text
Authentication
Analytics
Leaderboard
Tournament
Rewards
Economy
Advertising
Payments
Remote Configuration
Feature Flags
```

Do not independently implement these in every game.

---

## 58. Documentation Rule

Every important subsystem should have enough documentation for another developer or AI agent to understand:

```text
What it does
How it is called
What it depends on
What it returns
What can fail
```

Documentation should be maintained alongside code.

---

## 59. Definition of Done

A coding task is complete when:

- Requirements are implemented.
- Existing functionality is preserved.
- Code follows Studio standards.
- Platform boundaries are respected.
- Relevant tests pass.
- Build succeeds.
- Mobile behavior is checked where relevant.
- No unnecessary dependencies were added.
- Documentation is updated where necessary.
- Changes are clearly communicated.

---

## 60. Golden Rules

1. **Read before writing.**
2. **Keep it simple.**
3. **Reuse before rebuilding.**
4. **Keep game logic independent from infrastructure.**
5. **Never trust the client.**
6. **Mobile is the primary target.**
7. **Don't overengineer.**
8. **Make changes easy for the next AI agent.**
9. **Don't silently change architecture.**
10. **Leave the codebase better than you found it — without turning every task into a refactoring project.**

---

## 61. Final Principle

The Studio is building an **AI-native game development organization**.

Code will increasingly be written, reviewed, tested and evolved by a combination of humans and AI agents.

Therefore the most valuable characteristics of Studio code are:

> **Clarity + consistency + modularity + testability + performance.**

If Claude or Codex can open a Studio game they have never seen before and quickly understand:

```text
Where the game starts
        ↓
Where state lives
        ↓
Where gameplay happens
        ↓
Where rendering happens
        ↓
Where platform services are accessed
        ↓
Where configuration lives
        ↓
How to test it
        ↓
How to deploy it
```

then the architecture is working.
