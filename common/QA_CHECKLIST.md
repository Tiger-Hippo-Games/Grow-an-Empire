# QA_CHECKLIST.md

# Studio Game QA Standards

**Studio QA Standard**  
**Applies to:** All Studio games  
**Primary target:** Mobile Web  
**Related standards:** GAME_ARCHITECTURE.md, CODING_STANDARDS.md, ART_PIPELINE.md, THREEJS_STANDARDS.md, MOBILE_PERFORMANCE.md

---

## 1. Purpose

This document defines the minimum QA process for every Studio game.

QA is not simply:

> "Does the game work?"

QA should establish that the game is:

- Playable.
- Stable.
- Understandable.
- Responsive.
- Visually correct.
- Performant on target devices.
- Safe to publish.
- Compatible with the shared Studio platform.
- Measurable through analytics.
- Resilient to ordinary player behavior.

The goal is to catch problems before players do.

---

# 2. QA Philosophy

Use the following hierarchy:

```text
BLOCKER
Game cannot reasonably be played or published.

CRITICAL
Major feature or progression is broken.

HIGH
Significant player-facing defect.

MEDIUM
Noticeable defect with a workaround.

LOW
Minor visual, copy or polish issue.
```

Not every bug has the same business impact.

Prioritize bugs based on:

```text
Player impact
×
Frequency
×
Business impact
×
Likelihood
```

---

# 3. QA Ownership

Every game should have a clear QA owner for the release.

Developers and AI agents are responsible for validating their own work before handing it over.

The basic flow is:

```text
AI / Developer
      ↓
Local validation
      ↓
Feature QA
      ↓
Regression QA
      ↓
Mobile QA
      ↓
Release candidate
      ↓
Production validation
```

QA should not be the first person to discover whether the feature even runs.

---

# 4. Definition of Ready for QA

A feature should not be handed to QA until:

- [ ] It is implemented.
- [ ] The game builds/runs successfully.
- [ ] No known blocker prevents testing.
- [ ] Relevant assets are present.
- [ ] Required configuration exists.
- [ ] Basic happy-path testing has been performed.
- [ ] Console errors have been reviewed.
- [ ] Relevant analytics events have been implemented.
- [ ] AI-generated code has been reviewed/validated.
- [ ] The developer has documented known limitations.

---

# 5. Test Environments

Where applicable, maintain:

```text
LOCAL
 ↓
DEVELOPMENT
 ↓
STAGING
 ↓
PRODUCTION
```

QA should primarily validate against a production-like staging environment.

Do not assume local behavior equals production behavior.

---

# 6. Browser Matrix

At minimum, validate the game's supported mobile browsers.

Typical coverage should include:

```text
iOS Safari
Android Chrome
Desktop Chrome
Desktop Safari
```

Additional browsers should be included if the game's audience data justifies them.

Browser support should be explicitly documented per game.

---

# 7. Device Matrix

Test at least three device classes:

```text
HIGH-END
MID-RANGE
LOWER-END SUPPORTED
```

For each representative device, record:

- OS version.
- Browser version.
- Screen dimensions.
- Device pixel ratio where useful.
- Network condition.
- Game version.
- Result.

The exact devices should evolve based on Studio audience data.

---

# 8. Basic Smoke Test

Every build should pass a short smoke test before deeper QA.

### Smoke Checklist

- [ ] Game URL opens.
- [ ] Page loads without fatal errors.
- [ ] Game initializes.
- [ ] Loading screen works.
- [ ] First playable state appears.
- [ ] Touch input works.
- [ ] Primary gameplay action works.
- [ ] Game can be paused/resumed where applicable.
- [ ] Game can reach an expected end/state transition.
- [ ] Restart/replay works.
- [ ] No obvious console errors.
- [ ] Analytics initialization does not break gameplay.

If smoke testing fails, deeper regression testing should normally stop until the blocker is resolved.

---

# 9. Startup QA

Test the complete startup sequence:

```text
Open URL
 ↓
HTML loads
 ↓
JavaScript loads
 ↓
Game bootstraps
 ↓
Assets load
 ↓
First meaningful UI
 ↓
First playable state
```

Verify:

- [ ] No blank screen.
- [ ] No infinite loading.
- [ ] Loading state is understandable.
- [ ] Progress indicators behave correctly.
- [ ] Required assets load.
- [ ] Optional assets do not block unnecessarily.
- [ ] Startup works on slow networks.
- [ ] Startup errors are handled gracefully.
- [ ] Refreshing the page does not corrupt state.

---

# 10. First-Time Player Test

Test the game as a player who knows nothing about it.

Ask:

- Is it obvious what to do?
- Is the primary action discoverable?
- Are touch controls understandable?
- Is important information visible?
- Does the game explain unusual mechanics?
- Is the first interaction satisfying?
- Can the player recover from mistakes?

Do not rely only on developer knowledge.

---

# 11. Core Gameplay QA

For every major game mechanic:

- [ ] Happy path works.
- [ ] Minimum values work.
- [ ] Maximum values work.
- [ ] Repeated actions work.
- [ ] Rapid actions work.
- [ ] Actions in unexpected order are handled.
- [ ] Invalid actions are rejected safely.
- [ ] State transitions are correct.
- [ ] Rewards/results are correct.
- [ ] Game cannot enter an obvious impossible state.

---

# 12. State Machine Testing

Where the game has meaningful states, test transitions explicitly.

Example:

```text
BOOT
 ↓
MENU
 ↓
PLAYING
 ↓
PAUSED
 ↓
PLAYING
 ↓
GAME OVER
 ↓
RESULT
 ↓
RESTART
```

Test:

- [ ] Every expected transition.
- [ ] Unexpected transition attempts.
- [ ] Rapid repeated transitions.
- [ ] Browser backgrounding during transitions.
- [ ] Refresh at important states.
- [ ] Back navigation where relevant.

---

# 13. Input QA

### Touch

- [ ] Tap works.
- [ ] Hold works if supported.
- [ ] Swipe works if supported.
- [ ] Multi-touch behavior is intentional.
- [ ] Touch targets are sufficiently large.
- [ ] Touch does not trigger unintended browser behavior.
- [ ] Rapid taps do not duplicate actions incorrectly.

### Mouse / Desktop

- [ ] Click works.
- [ ] Hover behavior works where applicable.
- [ ] Pointer interactions do not break gameplay.

### Keyboard

If supported:

- [ ] Expected keys work.
- [ ] Key repeat does not create unintended behavior.
- [ ] Focus handling works.

---

# 14. Orientation QA

Test:

```text
Portrait
Landscape
Portrait → Landscape
Landscape → Portrait
```

Verify:

- [ ] Canvas resizes.
- [ ] Camera adjusts.
- [ ] UI remains visible.
- [ ] Touch controls remain usable.
- [ ] Gameplay state is preserved.
- [ ] No important elements are clipped.

If a game intentionally supports only one orientation, verify the experience communicates that clearly.

---

# 15. Responsive UI QA

Check common viewport ranges.

Verify:

- [ ] No overlapping elements.
- [ ] No clipped buttons.
- [ ] Text remains readable.
- [ ] Important controls remain accessible.
- [ ] Safe areas are handled.
- [ ] Notches do not obscure controls.
- [ ] Browser UI changes do not break layout.

---

# 16. Game State QA

Test state ownership and persistence.

### Session State

- [ ] Temporary state resets correctly.
- [ ] Restart creates the expected state.
- [ ] Game-over state does not leak into the next session.

### Local Persistence

Where applicable:

- [ ] Save works.
- [ ] Load works.
- [ ] Refresh preserves expected state.
- [ ] Corrupt/invalid saved data is handled.
- [ ] Clearing storage produces a valid new-user state.

### Platform Persistence

Where applicable:

- [ ] Server-backed state loads.
- [ ] Server-backed state saves.
- [ ] Network failures are handled.
- [ ] Duplicate requests do not corrupt state.
- [ ] Client cannot silently override authoritative server state.

---

# 17. Network QA

Test more than a fast Wi-Fi connection.

At minimum consider:

```text
Fast connection
Normal mobile connection
Slow connection
High latency
Temporary disconnection
Reconnect
```

Verify:

- [ ] Game does not become permanently stuck.
- [ ] Loading states are clear.
- [ ] Failed requests can recover where appropriate.
- [ ] Duplicate submissions are handled.
- [ ] Timeouts are handled.
- [ ] Retry behavior is sensible.
- [ ] Offline/online transitions do not corrupt state.

---

# 18. API QA

For every important API interaction test:

```text
Success
Failure
Timeout
Malformed response
Unauthorized response
Server error
Network interruption
Duplicate request
```

Verify the game:

- Handles failure gracefully.
- Does not expose sensitive information.
- Does not crash.
- Does not silently lose important player state.

---

# 19. Analytics QA

Analytics should be tested as product functionality.

Verify:

- [ ] Game start event fires.
- [ ] Session event fires.
- [ ] Important gameplay events fire.
- [ ] Level/progression events fire.
- [ ] Monetization events fire where applicable.
- [ ] Game end/result events fire.
- [ ] Events contain correct identifiers.
- [ ] Events do not fire multiple times unexpectedly.
- [ ] Analytics failure does not break gameplay.

Use the Studio's standard event taxonomy.

---

# 20. Authentication QA

Where platform identity is used:

- [ ] New user can enter the game.
- [ ] Returning user is recognized.
- [ ] Login/session expiry is handled.
- [ ] Logout behavior is correct where applicable.
- [ ] Anonymous/guest state behaves correctly where supported.
- [ ] Player identity is not accidentally duplicated.
- [ ] Client does not trust editable identity fields for authorization.

---

# 21. Monetization QA

Where applicable, test:

- [ ] Product/pricing information loads.
- [ ] Purchase UI works.
- [ ] Purchase success works.
- [ ] Purchase failure works.
- [ ] Cancel works.
- [ ] Retry works.
- [ ] Duplicate purchase attempts are handled.
- [ ] Entitlement is granted correctly.
- [ ] Entitlement survives refresh.
- [ ] Server is authoritative for entitlement.
- [ ] No purchase can grant an invalid reward.

Never treat a client-side success message as proof of entitlement.

---

# 22. Ads QA

Where advertising is used:

- [ ] Ad request works.
- [ ] Ad failure does not block gameplay unnecessarily.
- [ ] Rewarded ad reward is granted only after valid completion.
- [ ] Duplicate reward cannot be claimed.
- [ ] Ad does not cover critical controls unexpectedly.
- [ ] Ad return/resume behavior works.
- [ ] Audio behavior after ads is correct.

---

# 23. Save / Reward Integrity

For games involving progression or rewards:

Test:

```text
Complete action
 ↓
Reward generated
 ↓
Reward saved
 ↓
Refresh
 ↓
Reward remains correct
```

Also test:

- Rapid repeated completion.
- Refresh during save.
- Network failure during save.
- Duplicate requests.
- Multiple tabs where relevant.
- Suspicious client-side modification.

---

# 24. Three.js QA

For games using Three.js:

- [ ] Scene initializes.
- [ ] Renderer initializes.
- [ ] Camera works.
- [ ] Resize works.
- [ ] Models load.
- [ ] Materials render correctly.
- [ ] Textures render correctly.
- [ ] Animations work.
- [ ] Objects appear at correct scale.
- [ ] Objects have correct orientation.
- [ ] Lighting works.
- [ ] Shadows work where intended.
- [ ] Effects work.
- [ ] Objects are removed correctly.
- [ ] Resources are disposed.
- [ ] No second render loop exists.
- [ ] No obvious rendering artifacts appear.

See `THREEJS_STANDARDS.md`.

---

# 25. Asset QA

For every production asset:

- [ ] Correct asset is loaded.
- [ ] Correct version is loaded.
- [ ] Asset ID is correct.
- [ ] Asset dimensions are appropriate.
- [ ] Texture quality is acceptable.
- [ ] Transparency is correct.
- [ ] Material appearance is correct.
- [ ] Model scale is correct.
- [ ] Model pivot is correct.
- [ ] Animation is correct.
- [ ] Asset loads on target devices.
- [ ] Asset is correctly cached/versioned.

See `ART_PIPELINE.md`.

---

# 26. Visual QA

Check:

### General

- [ ] No missing images.
- [ ] No broken textures.
- [ ] No incorrect fonts.
- [ ] No unexpected clipping.
- [ ] No overlapping UI.
- [ ] No incorrect colors.
- [ ] No visual glitches.

### Gameplay

- [ ] Player is visible.
- [ ] Important objects are readable.
- [ ] Effects communicate the intended action.
- [ ] Feedback is clear.
- [ ] Animations complete correctly.

---

# 27. Audio QA

Where audio exists:

- [ ] Music starts correctly.
- [ ] Sound effects trigger correctly.
- [ ] Volume controls work.
- [ ] Mute works.
- [ ] Audio resumes correctly after browser backgrounding.
- [ ] No duplicated sounds occur.
- [ ] No unexpected audio continues after game over.
- [ ] Audio does not block startup unnecessarily.

---

# 28. Performance QA

Every release candidate should be tested against the game's performance budget.

Check:

- [ ] Startup time.
- [ ] Initial payload.
- [ ] First playable time.
- [ ] Frame rate.
- [ ] Frame-time stability.
- [ ] Draw calls.
- [ ] Geometry.
- [ ] Texture memory.
- [ ] JavaScript performance.
- [ ] Memory growth.
- [ ] Particle count.
- [ ] Network performance.

See `MOBILE_PERFORMANCE.md`.

---

# 29. Long-Session QA

Run extended sessions where appropriate.

Test:

```text
Start
 ↓
Play
 ↓
Pause
 ↓
Resume
 ↓
Play
 ↓
Game Over
 ↓
Restart
 ↓
Repeat
```

Look for:

- [ ] Memory growth.
- [ ] Performance degradation.
- [ ] Duplicate effects.
- [ ] Duplicate event listeners.
- [ ] Asset accumulation.
- [ ] Increasing DOM size.
- [ ] Audio duplication.
- [ ] State corruption.

---

# 30. Browser Lifecycle QA

Test:

- [ ] Background browser tab.
- [ ] Return to game.
- [ ] Lock/unlock phone where practical.
- [ ] Orientation change.
- [ ] Browser resize.
- [ ] Temporary network loss.
- [ ] WebGL context loss where applicable.

The game should recover gracefully.

---

# 31. Refresh / Back Navigation QA

Test refreshing at important moments:

```text
Menu
Gameplay
Pause
Game Over
Reward
Purchase
Loading
```

Verify that refresh does not:

- Corrupt persistent state.
- Duplicate rewards.
- Lose valid progression unexpectedly.
- Leave the user permanently stuck.

Test browser back navigation where it is relevant to the game flow.

---

# 32. Multi-Tab QA

Where shared accounts or server state exist, test multiple tabs.

Example:

```text
Tab A → Playing
Tab B → Same account
```

Look for:

- Duplicate rewards.
- State overwrites.
- Incorrect session handling.
- Conflicting saves.

Not every game needs full multi-tab synchronization, but server state must remain consistent.

---

# 33. Security-Oriented QA

QA should attempt ordinary player-side abuse.

Test:

- Repeated requests.
- Rapid clicks.
- Modified client values.
- Invalid IDs.
- Missing parameters.
- Unexpected navigation.
- Expired sessions.
- Duplicate submissions.

Do not rely on the client for authoritative decisions.

---

# 34. Error Handling QA

Intentionally cause failures.

Examples:

```text
Asset fails
API fails
Network disconnects
Invalid response
Session expires
Storage unavailable
```

Verify:

- [ ] User sees an understandable result.
- [ ] Game does not crash.
- [ ] Retry is available where appropriate.
- [ ] Player state is not silently corrupted.
- [ ] Technical details are not unnecessarily exposed.

---

# 35. Accessibility QA

Where applicable:

- [ ] Text is readable.
- [ ] Contrast is sufficient.
- [ ] Important information is not conveyed only by color.
- [ ] Controls are sufficiently large.
- [ ] UI does not depend exclusively on hover.
- [ ] Browser zoom does not completely break important UI.
- [ ] Audio-dependent mechanics have appropriate alternatives where feasible.

Games may have different accessibility requirements, but basic usability should always be considered.

---

# 36. Localization QA

If multiple languages are supported:

- [ ] Text fits UI.
- [ ] No untranslated strings remain.
- [ ] Numbers format correctly.
- [ ] Dates/times format correctly.
- [ ] Text expansion does not break layouts.
- [ ] Font supports required characters.
- [ ] Right-to-left layouts are handled where applicable.

---

# 37. Regression Testing

After fixing a bug, test:

```text
Bug fix
 ↓
Original failing case
 ↓
Related functionality
 ↓
Adjacent systems
 ↓
Full smoke test
```

A fix is not complete until the original issue and likely side effects are tested.

---

# 38. AI-Generated Code QA

AI-generated code requires the same or greater validation standard as human-written code.

For every significant AI-generated change:

- [ ] Understand what the code does.
- [ ] Check assumptions.
- [ ] Check dependencies.
- [ ] Check error handling.
- [ ] Check state ownership.
- [ ] Check performance.
- [ ] Check security implications.
- [ ] Check mobile behavior.
- [ ] Check cleanup/disposal.
- [ ] Test the feature rather than trusting the generated explanation.

Never use:

> "The AI said it works."

as a QA result.

---

# 39. AI Agent QA Rules

AI agents should perform a local validation loop:

```text
Read
 ↓
Change
 ↓
Run
 ↓
Observe
 ↓
Test
 ↓
Fix
 ↓
Re-test
```

An AI agent should not report a feature as complete merely because the code was generated successfully.

---

# 40. Bug Severity

Use:

### BLOCKER

Examples:

- Game does not start.
- Critical progression impossible.
- Severe data corruption.
- Security-critical failure.
- Purchase/reward integrity failure.

### CRITICAL

Examples:

- Major game mode unusable.
- Persistent progression broken.
- Core mechanic consistently fails.

### HIGH

Examples:

- Major UI/control problem.
- Frequent crash.
- Significant mobile performance problem.
- Important analytics or monetization issue.

### MEDIUM

Examples:

- Feature works with a workaround.
- Noticeable visual issue.
- Infrequent functional issue.

### LOW

Examples:

- Minor copy issue.
- Small alignment problem.
- Cosmetic polish issue.

---

# 41. Bug Report Format

Every meaningful bug should include:

```text
Title:
Environment:
Game Version:
Device:
Browser:
Severity:

Steps to Reproduce:
1.
2.
3.

Expected:
Actual:

Frequency:

Evidence:
Screenshot / Video / Console / Logs

Additional Context:
```

A developer should be able to reproduce the problem without a conversation.

---

# 42. Release Candidate Checklist

Before marking a build as release candidate:

### Functionality

- [ ] Smoke test passes.
- [ ] Core gameplay passes.
- [ ] Major edge cases tested.
- [ ] Progression tested.
- [ ] Restart tested.
- [ ] Save/load tested where applicable.

### Platform

- [ ] Authentication tested.
- [ ] Platform APIs tested.
- [ ] Analytics tested.
- [ ] Monetization tested where applicable.
- [ ] Rewards tested.
- [ ] Error states tested.

### Mobile

- [ ] iOS/mobile Safari tested.
- [ ] Android/mobile Chrome tested.
- [ ] Multiple device classes tested.
- [ ] Portrait/landscape tested where relevant.
- [ ] Touch tested.
- [ ] Slow network tested.

### Performance

- [ ] Performance budget met.
- [ ] Startup budget met.
- [ ] Memory behavior acceptable.
- [ ] No obvious frame-time spikes.
- [ ] Assets within budget.

### Visual / Audio

- [ ] No missing assets.
- [ ] No major rendering issues.
- [ ] Audio works.
- [ ] UI is readable.
- [ ] Final copy is correct.

---

# 43. Production Smoke Test

After deployment, run a small production validation.

Verify:

- [ ] Production URL works.
- [ ] Correct game version is deployed.
- [ ] CDN assets resolve.
- [ ] Platform APIs resolve.
- [ ] Analytics events arrive.
- [ ] Authentication works.
- [ ] Core gameplay works.
- [ ] No unexpected production errors.
- [ ] Monetization works where applicable.

Do not assume staging success guarantees production success.

---

# 44. Post-Release Monitoring

After launch, monitor:

```text
Game starts
 ↓
Errors
 ↓
Session completion
 ↓
Performance
 ↓
Retention
 ↓
Monetization
```

Important QA signals can come from real player behavior.

Look for:

- Crash/error spikes.
- Loading failures.
- Device-specific problems.
- Browser-specific issues.
- Unusual progression drops.
- Reward anomalies.
- Purchase anomalies.

---

# 45. QA Exit Criteria

A release can normally proceed when:

- No unresolved BLOCKER issues exist.
- No unresolved CRITICAL issues exist unless explicitly accepted.
- HIGH issues are understood and accepted or fixed.
- Core gameplay passes.
- Platform integrations pass.
- Mobile testing passes.
- Performance budget is met or an explicit exception is approved.
- Production smoke-test plan is ready.
- Known issues are documented.

---

# 46. Definition of Done

A game or feature is QA-complete when:

- Core functionality works.
- Edge cases have been tested.
- Mobile behavior has been validated.
- Performance has been measured.
- Network failures have been considered.
- Persistence has been tested.
- Platform integration has been tested.
- Analytics has been verified.
- Relevant assets have been validated.
- Known issues are documented.
- Release criteria are satisfied.

---

# 47. Golden Rules

1. **Test the game as a player, not as its developer.**
2. **Mobile is the primary QA environment.**
3. **A generated code change is not a validated code change.**
4. **Test failure paths, not only happy paths.**
5. **Test persistence and rewards carefully.**
6. **Never trust the client with authoritative game state.**
7. **Test slow networks and real devices.**
8. **Regression-test every meaningful bug fix.**
9. **Performance is part of QA, not a separate concern.**
10. **Production needs its own smoke test.**
11. **Document reproducible bugs clearly.**
12. **When in doubt, test the player journey from start to finish.**

---

# 48. Final Principle

The purpose of QA is not to prove that developers wrote correct code.

It is to establish that:

```text
PLAYER
  ↓
DISCOVERS GAME
  ↓
STARTS GAME
  ↓
UNDERSTANDS GAME
  ↓
PLAYS GAME
  ↓
PROGRESSES
  ↓
RECEIVES CORRECT RESULTS
  ↓
RETURNS
```

works reliably across the real-world conditions in which Studio players will experience the game.

**If the player journey works, the platform works, the game is performant, and failures are handled safely, the game is ready to ship.**
