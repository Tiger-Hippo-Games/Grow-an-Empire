# GAME_ARCHITECTURE.md

# Studio Game Architecture Standards

**Studio AI Architecture Standard**  
**Applies to:** All games developed for the Studio Publishing Platform  
**Primary target:** Mobile Web  
**Technology baseline:** HTML5 / JavaScript / TypeScript / Three.js where required  
**Deployment baseline:** Netlify + Studio Publishing Platform backend

---

## 1. Purpose

This document defines the standard architecture for every game developed for and published through the Studio Publishing Platform.

The objective is to ensure that:

- Every game can be developed independently.
- Every game can be deployed independently.
- Every game integrates consistently with the publishing platform.
- Common services are implemented once at the platform level rather than repeatedly inside games.
- Games remain lightweight, fast-loading and mobile-first.
- Analytics, player identity, progression, monetization and live operations can be managed consistently.
- Claude, Codex and other AI coding agents can understand the expected architecture without rediscovering it.
- Multiple developers and AI agents can safely contribute to the same project.

**This document is an architectural standard, not a suggestion.**

---

## 2. Core Architectural Principle

The Publishing Platform is the primary project. Games are clients of the platform.

```text
                    STUDIO ECOSYSTEM
                           │
             ┌─────────────┴─────────────┐
             │                           │
      PUBLISHING PLATFORM             GAMES
      / Shared Services               / Game Logic
             │                           │
       Identity                       Gameplay
       Analytics                      Levels
       Economy                        Mechanics
       Monetization                   Game UI
       Config                         Game Assets
       Publishing                     Game-specific state
       Experiments
       Leaderboards
       Tournaments
       Notifications
       CMS
             │                           │
             └─────────────┬─────────────┘
                           │
                    Common Platform API
```

**Rule:** Game-specific functionality belongs in the game. Cross-game functionality belongs in the Publishing Platform.

---

## 3. Platform-First Architecture

The Publishing Platform should eventually provide common capabilities including:

- Game registration and configuration
- Player identity and authentication
- Profiles and progression
- Achievements
- Leaderboards and tournaments
- Rewards and virtual economy
- Monetization, advertising and purchases
- Analytics and events
- Remote configuration and A/B testing
- Notifications
- CMS/content management
- Game discovery and publishing
- Game version management
- Feature flags and experiments

Games should consume these capabilities rather than implementing parallel versions.

---

## 4. Game Architecture

Every game should conceptually contain five layers:

```text
┌─────────────────────────────────────┐
│              GAME UI                │
│ HUD / Menus / Screens / UX          │
├─────────────────────────────────────┤
│             GAMEPLAY                │
│ Mechanics / Rules / Systems         │
├─────────────────────────────────────┤
│            GAME STATE               │
│ Player / Progress / Session         │
├─────────────────────────────────────┤
│          PLATFORM ADAPTER           │
│ Analytics / Auth / Economy / API    │
├─────────────────────────────────────┤
│        BROWSER / WEB RUNTIME        │
│ HTML / JS / Three.js / Web APIs     │
└─────────────────────────────────────┘
```

The **Platform Adapter** is the key boundary between a game and the Publishing Platform.

Prefer:

```javascript
platform.player.getProfile()
platform.analytics.track("level_completed", data)
```

over direct infrastructure-specific calls from gameplay code.

---

## 5. Recommended Game Repository Structure

```text
/game-name/

    /src/

        /game/
            Game.js
            GameState.js
            GameLoop.js

        /systems/
            InputSystem.js
            AudioSystem.js
            SaveSystem.js
            ProgressionSystem.js

        /ui/
            screens/
            components/
            hud/

        /platform/
            PlatformAdapter.js
            AnalyticsAdapter.js
            PlayerAdapter.js
            EconomyAdapter.js

        /assets/
            asset-manifest.json

        /config/
            game-config.json

        /utils/
        /data/

        main.js

    /public/
        /assets/

    /docs/
        GAME_DESIGN.md
        TECH_ARCHITECTURE.md

    tests/

    AGENTS.md
    CLAUDE.md
    README.md
```

The exact folder structure may evolve, but separation of concerns should remain.

---

## 6. Game Entry Point

Every game should have a single clear entry point.

```javascript
async function main() {
    await platform.initialize();

    const game = new Game({ platform });

    await game.initialize();

    game.start();
}

main();
```

Initialization should generally occur in this order:

```text
Browser
   ↓
Platform initialization
   ↓
Configuration
   ↓
Player/session initialization
   ↓
Asset loading
   ↓
Game initialization
   ↓
Game start
```

---

## 7. Backend Is the Source of Truth

For anything that matters to the business or player account, the backend should be authoritative.

Examples:

- Currency balance
- Purchases
- Premium status
- Player identity
- Tournament scores
- Leaderboards
- Rewards
- Inventory
- Persistent progression
- Entitlements

The client is not trusted.

---

## 8. Client-Side State

Separate state into:

### Session State
Temporary information required while the game is running.

### Local State
Device-specific preferences and non-critical cached state.

### Persistent Player State
Important player information stored through the Publishing Platform.

Do not use local storage as the primary persistence layer for valuable player state.

---

## 9. Configuration-Driven Games

Where practical, game behavior should be configurable rather than hard-coded.

Examples:

- Starting currency
- Rewards
- Difficulty
- Timers
- Feature flags
- Event settings
- Ad frequency
- Level parameters

The long-term goal is to allow remote configuration without requiring a new game build for every small change.

---

## 10. Analytics

Analytics is a first-class architectural layer.

Games should generate standardized events such as:

```text
game_loaded
game_started
tutorial_started
tutorial_completed
level_started
level_completed
level_failed
session_started
session_ended
reward_claimed
purchase_started
purchase_completed
ad_started
ad_completed
tournament_joined
tournament_completed
```

Prefer:

```javascript
platform.analytics.track("level_completed", {
    level: 4,
    score: 12500,
    duration: 82
});
```

rather than integrating individual analytics vendors directly into gameplay code.

---

## 11. Identity

Games should use the common Publishing Platform player identity.

```text
                    PLAYER
                      │
                Platform Identity
                      │
          ┌───────────┼───────────┐
          │           │           │
        Game A      Game B      Game C
          │           │           │
       Progress    Progress    Progress
```

This enables future cross-game capabilities such as unified profiles, rewards, achievements and cross-promotion.

---

## 12. Monetization

Monetization should be integrated through platform services wherever practical.

```text
Advertising
   ├── Rewarded Video
   ├── Interstitial
   └── Banner

Purchases
   ├── Consumables
   ├── Premium Items
   └── Subscriptions

Economy
   ├── Currency
   ├── Inventory
   └── Rewards
```

Games should request these through platform interfaces.

---

## 13. Mobile-First Runtime

Mobile web is the default target.

Every game must account for:

- Touch input
- Variable screen sizes
- Lower CPU/GPU capability
- Mobile network conditions
- Short sessions
- Browser interruptions
- Orientation changes
- Battery constraints
- Memory constraints

Desktop is an additional supported environment, not the primary design target.

---

## 14. Performance and Loading

Prioritize:

```text
Fast initial load
      ↓
Minimal JavaScript
      ↓
Progressive asset loading
      ↓
Efficient rendering
      ↓
Stable frame rate
      ↓
Low memory usage
```

Do not load the entire game before the player can interact where practical.

Preferred loading sequence:

```text
Initial Load
   ↓
Core Runtime
   ↓
First Playable Moment
   ↓
Background Asset Loading
   ↓
Additional Content
```

---

## 15. Asset Architecture

Assets should be independent resources where practical.

```text
Game Code
   ↓
Asset Manifest
   ↓
CDN
   ↓
Asset
```

Assets should support CDN delivery, compression, caching, lazy loading and versioning.

---

## 16. CDN and Deployment

The current platform architecture uses Netlify as the primary web delivery/CDN layer.

```text
PLAYER
   │
   ▼
Netlify
   ├── Game HTML
   ├── JavaScript
   ├── CSS
   └── Static Assets
          │
          ▼
    Publishing Platform
          ├── APIs
          ├── Database
          ├── Analytics
          ├── Player Data
          └── Services
```

Games should avoid depending directly on infrastructure-specific implementation details.

---

## 17. API Contract

All platform communication should happen through documented APIs or SDK interfaces.

API contracts should define:

- Request format
- Response format
- Authentication
- Error behavior
- Rate limits
- Retry behavior
- Offline behavior where applicable
- Versioning

Breaking changes should be versioned.

---

## 18. Error Handling

Games must assume that platform services can fail:

- Network unavailable
- API timeout
- Authentication expired
- Server error
- Asset unavailable
- Ad unavailable
- Purchase failure

Gameplay should degrade gracefully wherever possible.

Do not grant valuable entitlements when authoritative validation has failed.

---

## 19. Security

Never place secrets in the game client.

Do not ship:

- API secrets
- Private keys
- Database credentials
- Admin tokens
- Payment secrets
- Server credentials

Assume everything shipped to the browser can be inspected or modified.

Server-side validation is mandatory for economy, purchases, rewards, competitive scores and entitlements.

---

## 20. Shared Components

When the same functionality appears in multiple games, consider moving it into a shared platform SDK/library.

Examples:

```text
/platform-sdk/
    authentication
    player
    analytics
    economy
    rewards
    leaderboard
    tournament
    ads
    payments
    configuration
```

Do not copy/paste the same implementation into every game.

Do not prematurely abstract functionality that only one game needs.

---

## 21. Game Independence

Each game should remain independently deployable.

```text
Game A → independent deployment
Game B → independent deployment
Game C → independent deployment
```

A change to one game should not require rebuilding another.

---

## 22. Versioning

Games should have explicit versions.

Example:

```text
Game: Space Arena
Version: 1.4.2
Platform SDK: 2.1
```

Platform APIs should also be versioned where necessary.

---

## 23. Development Environments

At minimum:

```text
Development
     ↓
Staging
     ↓
Production
```

Development builds should not casually point at production services.

---

## 24. AI Development Rules

Claude, Codex and other AI agents are development contributors.

Before significant changes, an agent should:

1. Read `GAME_ARCHITECTURE.md`.
2. Read `AGENTS.md`.
3. Read `CLAUDE.md` when using Claude.
4. Read relevant design and architecture documentation.
5. Inspect existing code before creating abstractions.
6. Reuse existing platform interfaces.
7. Avoid duplicating platform functionality.
8. Keep changes scoped to the requested task.
9. Run relevant tests/build checks.
10. Explain significant architectural changes.

AI agents must not silently introduce a new architectural pattern simply because it is convenient.

---

## 25. Multiple AI Agents

Multiple agents may work on the same project.

Therefore:

- Keep commits focused.
- Avoid unnecessary file changes.
- Do not reformat unrelated code.
- Do not overwrite unrelated work.
- Prefer branches/worktrees for parallel work.
- Clearly document changes affecting shared interfaces.

---

## 26. Architecture Decision Records

Significant architectural decisions should be documented.

Example:

```text
/docs/adr/
    ADR-001-platform-sdk.md
    ADR-002-save-system.md
    ADR-003-analytics.md
```

An ADR should explain:

```text
Problem
Decision
Alternatives considered
Reason
Consequences
```

---

## 27. What Belongs Where?

| Capability | Game | Platform |
|---|---:|---:|
| Gameplay mechanics | ✓ | |
| Level design | ✓ | |
| Game-specific UI | ✓ | |
| Game-specific assets | ✓ | |
| Game rules | ✓ | |
| Player identity | | ✓ |
| Authentication | | ✓ |
| Analytics | Adapter | ✓ |
| Leaderboards | Adapter | ✓ |
| Tournaments | Adapter | ✓ |
| Economy | Adapter | ✓ |
| Payments | Adapter | ✓ |
| Advertising | Adapter | ✓ |
| Remote configuration | Adapter | ✓ |
| Player progression | Adapter | ✓ |
| CMS | | ✓ |
| Publishing | | ✓ |
| Game discovery | | ✓ |
| Cross-game systems | | ✓ |

---

## 28. Golden Rule

Before adding a feature to a game, ask:

> Is this something only this game needs, or is this something the Studio will eventually want across multiple games?

If only this game needs it, put it in the game.

If multiple games will need it, consider putting it in the platform.

If uncertain, start game-specific and abstract only after the common requirement becomes clear.

---

## 29. Target End State

The long-term goal is that creating a new game becomes progressively easier:

```text
NEW GAME
   │
   ├── Create repository
   ├── Install Platform SDK
   ├── Add CLAUDE.md
   ├── Add AGENTS.md
   ├── Define game-specific systems
   ├── Connect analytics
   ├── Connect player identity
   ├── Connect progression
   ├── Connect monetization
   ├── Connect publishing configuration
   └── Deploy
          │
          ▼
   PUBLISHING PLATFORM
          │
          ▼
       PLAYERS
```

The second, fifth and twentieth game should become progressively easier because the platform absorbs repeated complexity.

---

## 30. Architectural North Star

The Studio should ultimately behave less like a collection of individually built games and more like a **game operating system**.

```text
                  STUDIO GAME PLATFORM
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
    Identity          Analytics         Economy
       │                 │                 │
    Rewards          Experiments       Monetization
       │                 │                 │
 Leaderboards        Tournaments       Publishing
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                 COMMON GAME SDK
                         │
        ┌────────────────┼────────────────┐
        │                │                │
      GAME 1           GAME 2           GAME 3
        │                │                │
      HTML5            HTML5            HTML5
      Three.js         Three.js         Three.js
```

**The games provide the entertainment.**

**The platform provides the scalable business and technology infrastructure.**
