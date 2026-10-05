import { describe, expect, it } from "vitest";
import { CAMPAIGNS } from "../campaigns";
import {
  AiRealmSource, CAMPAIGN_FIELD, campedAt, conquerorsByCampaign, mergeRealmStates, newRealmState, readRealmState, realmStanding,
  recordBattle, RIVAL_COUNT, rivalField, standingFromStars, titleFor, visitRealm,
} from "../realm";

const source = new AiRealmSource();
const late = { ...newRealmState(), season: 500 };
const rank = (level: number, stars: number, state = late) => realmStanding(source, state, { name: "You", level, stars }).rank;

describe("the rival realm", () => {
  it("is the same 1,008 rajas every time, with unique names", () => {
    const field = rivalField();
    expect(field).toHaveLength(RIVAL_COUNT);
    expect(new Set(field.map((rival) => rival.name)).size).toBe(RIVAL_COUNT);
    expect(field[0].name).toBe(rivalField()[0].name);
    expect(realmStanding(source, late, { name: "You", level: 0, stars: 0 }).of).toBe(RIVAL_COUNT + 1);
  });

  it("never lets a rival clear more than its campaign allows", () => {
    for (const rival of rivalField()) {
      expect(rival.stars).toHaveLength(rival.maxLevel);
      for (const stars of rival.stars) expect(stars).toBeGreaterThanOrEqual(1);
    }
    // The field thins with the campaigns' win shares: about 5% finish C25.
    const finishers = rivalField().filter((rival) => rival.maxLevel === 25).length;
    expect(finishers / RIVAL_COUNT).toBeGreaterThan(0.02);
    expect(finishers / RIVAL_COUNT).toBeLessThan(0.08);
    expect(CAMPAIGN_FIELD).toHaveLength(CAMPAIGNS.length);
  });

  it("puts rank 1 at the end of the whole road", () => {
    expect(rank(25, 75)).toBe(1);
    expect(rank(25, 55)).toBeGreaterThan(20);
    expect(rank(20, 48)).toBeGreaterThan(100);
    expect(rank(10, 24)).toBeGreaterThan(rank(20, 48));
    expect(rank(1, 3)).toBeGreaterThan(900);
    // Every step up the road is a step up the board.
    let previous = Infinity;
    for (let level = 1; level <= 25; level += 1) {
      const now = rank(level, level * 2);
      expect(now).toBeLessThanOrEqual(previous);
      previous = now;
    }
  });

  it("names the rank-1 player Chakravartin and titles by level", () => {
    expect(realmStanding(source, late, { name: "You", level: 25, stars: 75 }).player.title).toBe("Chakravartin");
    expect(titleFor(0)).toBe("Vanavasi");
    expect(titleFor(7, true)).toBe("Rani");
    expect(titleFor(25)).toBe("Samrat");
  });

  it("moves a season per battle and counts who was overtaken", () => {
    let state = { ...newRealmState(), season: 4 };
    const start = realmStanding(source, state, { name: "You", level: 4, stars: 10 });
    const result = recordBattle(source, state, { name: "You", level: 4, stars: 10 }, { name: "You", level: 5, stars: 12 });
    expect(result.state.season).toBe(5);
    expect(result.state.lastRank).toBe(result.after.rank);
    expect(result.overtaken).toBeGreaterThan(0);
    expect(result.after.rank).toBeLessThan(start.rank);
    state = result.state;
    const loss = recordBattle(source, state, { name: "You", level: 5, stars: 12 }, { name: "You", level: 5, stars: 12 });
    expect(loss.overtaken).toBe(0);
    expect(loss.state.lastScore).toBe(512);
  });

  it("shows the nemesis just above and the neighbourhood", () => {
    const standing = realmStanding(source, late, { name: "You", level: 12, stars: 26 });
    expect(standing.nemesis?.score ?? 0).toBeGreaterThanOrEqual(standing.player.score);
    expect(standing.above.length).toBe(3);
    expect(standing.below.length).toBe(3);
    expect(standing.top).toHaveLength(10);
  });

  it("adds seasons for days away, at most 7 a visit", () => {
    const seen = visitRealm(newRealmState(), new Date("2026-10-01T00:00:00Z"));
    expect(seen.season).toBe(0);
    expect(visitRealm(seen, new Date("2026-10-03T01:00:00Z")).season).toBe(2);
    expect(visitRealm(seen, new Date("2026-12-01T00:00:00Z")).season).toBe(7);
  });

  it("reads, merges and survives bad saved data", () => {
    expect(readRealmState(null)).toEqual(newRealmState());
    expect(readRealmState({ season: -3, lastRank: "x", lastSeen: "nope" })).toEqual(newRealmState());
    const a = { ...newRealmState(), season: 4, lastSeen: "2026-10-01T00:00:00.000Z" };
    const b = { ...newRealmState(), season: 9, lastSeen: "2026-09-01T00:00:00.000Z" };
    expect(mergeRealmStates(a, b)).toMatchObject({ season: 9, lastSeen: "2026-10-01T00:00:00.000Z" });
  });

  it("counts conquerors and camps on the map", () => {
    const counts = conquerorsByCampaign(source, 40);
    expect(counts[0]).toBeGreaterThan(counts[24]);
    expect(counts[24]).toBeGreaterThan(0);
    expect(campedAt(source, 40).every((camp) => camp.length <= 3)).toBe(true);
  });

  it("reads the player's standing from their stars", () => {
    expect(standingFromStars({ [CAMPAIGNS[0].id]: 3, [CAMPAIGNS[1].id]: 2 }, "You")).toEqual({ name: "You", level: 2, stars: 5 });
  });
});
