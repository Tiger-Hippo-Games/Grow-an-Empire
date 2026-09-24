import { describe, expect, it } from "vitest";
import { SettlementSimulation } from "../settlementSimulation";
import { toSavedGame } from "../../platform/progressStore";
import saveV4 from "./fixtures/save-v4-mid-construction.json";
import { playToEnd } from "./play";

/**
 * Saves written by released builds must keep loading forever: the portal keeps
 * every player's save across game updates (GAME_SUBMISSION_GUIDE §5.1, §13).
 *
 * The fixture is a real save from this build (schema v4, mid-construction on
 * move 6). NEVER edit or regenerate it. When the save format changes, add a
 * new fixture for the new version and a migration so this one still passes.
 */
describe("save compatibility", () => {
  it("loads a schema v4 save and plays it to the end", () => {
    const campaignId = new SettlementSimulation().campaign.id;
    const saved = toSavedGame(saveV4, campaignId);
    expect(saved, "the v4 fixture must stay loadable").not.toBeNull();
    expect(saved?.runId).toBe("fixture-run");
    expect(saved?.settings.tutorialComplete).toBe(true);
    expect(saved?.schemaVersion).toBe(6);
    expect(saved?.state.resources.gold).toBeGreaterThanOrEqual(0);
    expect(saved?.state.trainedUnits.horsemen).toBe(0);

    const sim = new SettlementSimulation();
    sim.loadSnapshot(saved!);
    expect(sim.state.mode).toBe("construction");
    playToEnd(sim);
    expect(sim.state.mode).toBe("complete");
    expect(sim.state.armyReport).not.toBeNull();
  });

  it("keeps saves far under the portal's 64 KB limit", () => {
    const sim = new SettlementSimulation();
    playToEnd(sim);
    const bytes = JSON.stringify({ ...sim.serialize(), runId: "x".repeat(36), settings: { tutorialComplete: true } }).length;
    expect(bytes).toBeLessThan(16 * 1024);
  });
});
