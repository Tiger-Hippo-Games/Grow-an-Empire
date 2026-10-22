# GROW game design template

**Working title:** `<Grow a/an ...>`  
**Design owner:** `<name>`  
**Document version/date:** `<version / date>`  
**Implementation baseline:** `<prototype, release or not yet implemented>`  
**Reference implementation:** [Grow an Empire complete design](GAME_DESIGN_DOCUMENT.md).

Copy this file into a new game's design folder. Replace angle-bracket fields, delete irrelevant options and label every system **implemented**, **approved design**, **experiment** or **deferred**. Do not present proposed systems or target metrics as shipped features or measured results.

## 1. The GROW promise

> On every move, the player chooses from a set of options that change a growing world. Those changes interact and accumulate. At the end of the campaign, a final challenge determines whether the player prepared the right combination and sequence.

### Identity sheet

| Question | This game's answer |
|---|---|
| What is growing? | `<world, organism, community, project, ecosystem, institution...>` |
| Who is the player? | `<role and authority>` |
| What is the final challenge? | `<specific test that uses the prepared state>` |
| What does a move represent? | `<one season, investment, action, stage...>` |
| How many moves are available? | `<per-campaign value or schedule; supported bounds>` |
| What decisions does the player make? | `<primary verbs>` |
| What operates automatically? | `<growth, production, relationships, events...>` |
| Why does order matter? | `<at least three concrete causal relationships>` |
| What can a player learn from losing? | `<observable deficit and next experiment>` |
| What is visually satisfying about growth? | `<recognizable transformations>` |
| Audience, platform and session target | `<assumptions and validation plan>` |
| One-sentence player promise | `<what the experience reliably delivers>` |

### Non-negotiable series criteria

- [ ] Each campaign has a finite move budget or another explicit finite sequence.
- [ ] Each move presents a choice set; define minimum alternatives and any automatic/forced turns.
- [ ] Earlier choices change later opportunities, effectiveness or constraints.
- [ ] The world visibly reflects accumulated choices.
- [ ] The finale evaluates preparation rather than replacing it with an unrelated test.
- [ ] A correct legal sequence can win; at least one failure can be explained causally.
- [ ] Replay lets the player test a better hypothesis.

Do not require three cards, buildings, an army, an economic stockpile, stars or 25 campaigns merely because Empire uses them. Specify the form this title needs. If randomness exists, document what the player can prepare for and how seeds, forecasts and replay fairness work.

## 2. Product and creative direction

Describe the setting, premise, player fantasy, emotional arc and narrative framing. List 4–6 design pillars and a concrete implication for each. State audience assumptions, content rating, intended platforms, input methods and the boundaries of a typical session.

| Pillar | Player benefit | Feature that supports it | Design that would violate it |
|---|---|---|---|
| `<pillar>` | `<benefit>` | `<observable behavior>` | `<specific counterexample>` |

**In scope:** `<required systems and content>`  
**Out of scope:** `<tempting features explicitly excluded>`  
**Distinct from the previous GROW title:** `<different interactions and final test, beyond renamed assets>`

## 3. Campaign loop and state model

Write the complete path from launch to first choice, each reaction, the finale, result and replay. Separate simulation modes from interface screens. Define how continuing, restarting, pausing and returning later work.

```text
Initialize → Briefing → Inspect choices → Commit action → Resolve growth
                         ↑                                ↓
                         └── Read consequences ← Moves remain?
                                                          ↓ No
                                       Final preparation → Challenge → Result
```

Let `S(0)` be the initial state. For `t = 0 ... N-1`, resolve the selected action into `S(t+1)`. Evaluate the final challenge against `S(N)`.

| State | Entry condition | Legal actions | Exit condition | Saved data |
|---|---|---|---|---|
| `<state>` | `<condition>` | `<actions>` | `<condition>` | `<fields>` |

Declare whether time is cosmetic, advances simulation, or imposes a decision deadline. Give animation durations, speed controls and pause semantics. Label expected session length as a target until measured.

## 4. Move and choice system

### Choice-set policy

| Property | Specification |
|---|---|
| Opening offers | `<fixed set, seeded set or campaign-specific set>` |
| Normal offer count | `<count/range and why>` |
| Eligibility | `<move gates, prerequisites, conditions, content restrictions>` |
| Refill behavior | `<rolling set, full redraw, player draft, other>` |
| Unchosen choices | `<retained, discarded or changed>` |
| Repeat choices | `<unique items, repeatable actions, upgrade levels>` |
| Offer priority | `<urgency, direct follow-ups, family rotation, weights, ties>` |
| Randomness and seed | `<none or exact policy>` |
| Unaffordable choices | `<visible/hidden, explanation and available response>` |
| Empty offers | `<guaranteed fallback, validated terminal state or explicit forced action>` |
| Gather/Wait equivalent | `<effect, cost, timing and availability, or justified omission>` |
| Confirmation boundary | `<when cost is paid and choice becomes irreversible>` |

Show how choosing A changes the probability or eligibility of B, the usefulness of C, or the growth of an existing system. Define input guards against duplicate commits and unseen-choice activation.

### Per-choice definition

| Field | Required specification |
|---|---|
| Stable ID / displayed name | `<identifier and fiction>` |
| Strategic role / family | `<producer, enabler, converter, support, finisher, recovery...>` |
| Cost | `<resources, move slot, space, risk or other cost>` |
| Eligibility | `<earliest move; all/any prerequisites; extra gates>` |
| Immediate effect | `<exact completion change>` |
| Recurring effect | `<per-move calculation and resolution phase>` |
| Maturity or upgrade behavior | `<curve, caps, thresholds or none>` |
| Dependencies / interactions | `<inputs, outputs, synergies, competition>` |
| Final-challenge contribution | `<how this can help win>` |
| Timing window | `<why early, middle or late selection can matter>` |
| Failure / idle condition | `<what blocks it and how the player learns that>` |
| Presentation | `<card, world stages, motion, sound and feedback>` |
| Persistence | `<state to save; migration concerns>` |
| Evidence | `<reachability, useful solution, counterexample and tests>` |

Provide the complete content roster and dependency graph. Explain which items are intentionally situational. Distinguish tags used for offers from tags used by special rules.

## 5. Growth, economy and automatic systems

Define initial state and every resource/capacity. A “resource” can be water, trust, knowledge, habitat, time, staffing or health; it need not be a purchasable commodity.

| Resource or capacity | Initial amount | Sources | Sinks | Cap/floor | Player visibility | Final-test role |
|---|---:|---|---|---|---|---|
| `<name>` | `<amount>` | `<sources>` | `<costs>` | `<limit>` | `<UI>` | `<contribution>` |

Write exact formulas for repeated growth, aging, processing, workforce, upkeep, spoilage, conversion and recovery where applicable. Specify rounding and whether a newly completed choice acts on its completion move.

**Resolution order:** `<numbered list of every phase, including spending, aging, production, consumption, bonuses, penalties and recovery>`.

Explain why order matters. Identify shared-input competition and which subsystem acts first. Include a before/after example that a designer can calculate by hand.

**Recovery rules:** `<how to prevent unintended dead ends without erasing the final challenge>`. State which failures can happen during preparation and which belong only to the finale. A safety floor is not necessarily a fixed income; describe its exact operation.

## 6. Final challenge and reward quality

| Requirement | Specification |
|---|---|
| Challenge fiction | `<why this finale happens>` |
| Data evaluated | `<prepared state fields>` |
| Victory condition | `<exact predicate; treatment of ties and boundary values>` |
| Failure condition | `<exact predicate>` |
| Quality measure | `<margin, completion percentage, resilience, score...>` |
| Reward tiers | `<thresholds, zero/one/two/three equivalents or another model>` |
| Final preparation | `<last correction options and their limits>` |
| Uncertainty | `<deterministic, seeded or probabilistic; what is forecast>` |
| Presentation | `<beats, duration, skip, pause and reduced-motion behavior>` |
| Explanation | `<why this result occurred>` |
| Replay hint | `<a useful counterfactual and its limitations>` |

Use one evaluator for forecast, actual outcome, scoring and balancing. If the challenge has phases, define their order and exact state transitions. If it is animated, distinguish already-resolved presentation from player-controlled resolution.

Do not promise that a numerical improvement hint is an affordable full solution unless a search has proved that plan legal.

## 7. Campaign roster and progression

| Campaign | Theme / teaching purpose | Moves | Content restrictions | Final threat/target | Quality thresholds | Unlock | Reference difficulty |
|---|---|---:|---|---|---|---|---|
| `<stable ID and name>` | `<lesson/problem>` | `<N>` | `<allowed choices>` | `<parameters>` | `<tiers>` | `<rule>` | `<policy and target>` |

Specify chapter structure, difficulty rhythm, how campaigns differ, what resets between attempts and what persists. Declare whether replay improves best quality, grants repeat rewards or affects rankings. Keep persistent IDs stable.

Explain the first campaign's generosity and the final campaign's mastery demand. Difficulty targets must state the policy, sample size, horizon and randomness assumptions behind them; do not call a simulation share a real-player win probability.

## 8. Worked sequences and strategy diversity

Supply at least one complete verified win, one legal instructive loss and a changed-order comparison. Where appropriate, show multiple different winning strategies rather than one mandatory build order.

| Move | State before | Offered choices | Action/cost | Resolved effects | Visible feedback | State after |
|---:|---|---|---|---|---|---|
| `<t>` | `<key values>` | `<actual legal set>` | `<choice>` | `<phase results>` | `<what player sees>` | `<key values>` |

For each sequence record the campaign, seed, version, final result and verification method. Explain the decisive bottleneck. State whether a strategy is a tested result or an untested hypothesis.

Review reachability, dominant openings, delayed payoffs, redundant choices, complete-catalog endings and whether a recovery action trivializes early or late challenges.

## 9. Interface, tutorial and accessibility

Define each screen's primary question and action: loading, campaign selection, briefing, choices, consequence report, final preparation, challenge, result, optional progression and settings.

Provide a HUD hierarchy, card anatomy and report contents. Define what remains permanently visible and what moves into details. A player should be able to distinguish “what I have,” “what this costs,” “what it changes” and “how many moves remain.”

Specify desktop/mobile layouts, world-space reservation for panels, touch targets, minimum text, contrast, non-color cues, screen-reader names, focus behavior, keyboard map, long-press alternatives and reduced motion. Define tutorial completion/skip/replay and how information remains available afterward.

| First-session moment | What the player learns | Interaction that demonstrates it | Evidence of comprehension |
|---|---|---|---|
| `<moment>` | `<concept>` | `<action/feedback>` | `<test/event>` |

## 10. World, art, animation and sound

Describe camera/projection, palette, lighting, scale, material language, theme specificity and silhouette priorities. Define how the world changes from beginning to final preparation and how those changes express actual systems.

Create an asset inventory covering choice art, growth/construction stages, environment, characters/agents, finale, icons, typography and store images. Specify anchors, sizes, atlases, source masters, export formats, loading strategy and provenance/licensing records.

Define motion timing and its relationship to simulation time. If displayed agents are representative, cap them independently of exact rule counts and explain the numbers honestly. Cosmetic movement must not alter production.

List audio cues, their purpose, gesture unlock, mute/pause behavior, intensity limits and failure fallback. State whether music or adaptive audio is actually in scope.

## 11. Progression and optional social layers

For stars, achievements, rivals or leaderboards, specify metric, ownership, reset rules, replay behavior, ties, identity display and failure states. Clearly distinguish simulated rivals from actual players.

Define any away-time behavior and whether it affects the player's prepared world. Persistent progression should reward learning without invalidating the finite campaign challenge. Do not automatically import Empire's AI population, score formula or weekly cadence.

## 12. Saves, platform, reliability and privacy

List saved state, owner identity, schema version, migration policy, stable IDs and checkpoints. Define local/cloud authority, uncertain-write recovery, conflict reconciliation, missing/corrupt/newer saves and offline/storage-denied behavior.

For a Hippo Arcade release, verify the **current** developer kit in that project. Document same-origin SDK loading, initialization/identity order, load-before-save, server acknowledgements, preview isolation, unsupported preview features, guest behavior, payload/depth limits, score throttling, ready/error handshakes and lifecycle messages. Do not copy a historical SDK version or endpoint blindly.

State platform-controlled access/monetization boundaries and any in-game commerce scope explicitly. Include production versus test environment behavior and real account/device validation still needed.

## 13. Architecture and production plan

Specify a single state owner, pure rules, data-driven choices/campaigns, UI commands/events, rendering and platform boundaries. Keep the finale evaluator shared across live play, forecast and balance tools.

| Content task | Required deliverables | Dependencies | Acceptance evidence |
|---|---|---|---|
| `<choice/campaign/system>` | `<data, rules, art, text, audio, save impact>` | `<requirements>` | `<tests/playtest>` |

Define prototype → vertical slice → full content → polish → platform QA → release gates. Assign owners, prioritize risks and list deferred features separately from committed scope.

## 14. Balance and validation

State search/enumeration limits, sampled policies, seed counts and representative skill assumptions. Compare strategy families and final outcomes, including recovery-heavy and deliberately weak play. Recalibrate campaign threats when systemic numbers change.

- [ ] Every important choice has a reachable, useful role.
- [ ] Supported horizons can reach a legitimate finale.
- [ ] Unaffordable and empty offers have an intentional behavior.
- [ ] The finale is consistent across forecast, animation, rewards and analysis.
- [ ] Invalid and repeated input cannot spend twice.
- [ ] Save/reload preserves in-flight and completed outcomes.
- [ ] Accessibility, target layouts and input methods are tested.
- [ ] Missing art/audio, denied storage, network errors and host interruptions recover safely.
- [ ] Real devices and live platform behavior are distinguished from local simulation.

## 15. Analytics and playtests

| Question | Event or observation | Target | Segment | Decision if it fails |
|---|---|---|---|---|
| `<player-understanding or balance question>` | `<measure>` | `<hypothesis>` | `<new/returning; mobile/desktop...>` | `<design response>` |

Measure recognition of cost/benefit, choice deliberation, report comprehension, perceived causality, finale understanding and whether replays change the player's strategy. Specify participant count and physical-device coverage. Clearly separate targets from observed results and avoid collecting unnecessary personal data.

## 16. Performance, release and acceptance

Declare budgets for first-playable time, startup bytes, package size, frame rate, memory/textures, agent counts, paused work, save payload and analytics. Record host compression, hardware and build version alongside measurements.

Release records should contain a unique version, immutable artifact, checksum, checks run, results and remaining limitations. A documentation-only edit does not by itself imply a new shipped build. Platform publication is a separate action from local packaging.

### Final design review

1. Can a new player state the final objective before choosing?
2. Is every move a real choice under the declared campaign rules?
3. Can two different legal sequences produce visibly and strategically different worlds?
4. Can the designer trace a win and a loss through exact state changes?
5. Does the final test depend on preparation throughout the campaign?
6. Can players identify a useful next experiment after failure?
7. Are mandatory choices, trivial solutions and unresolved bottlenecks documented?
8. Are planned features, measured facts and open questions clearly distinguished?

**Approval/open decisions:** `<owner, date, decision and evidence>`  
**Source map:** `<current rules, data, design references, art pipeline, platform kit and QA records>`  
**Change policy:** `<who updates this document when rules, content or platform contracts change>`
