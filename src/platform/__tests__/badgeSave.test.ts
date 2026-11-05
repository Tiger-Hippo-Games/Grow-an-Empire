import { describe, expect, it } from "vitest";
import { chooseSave, toSavedGame } from "../progressStore";
import { SettlementSimulation } from "../../game/settlementSimulation";

const save = (runId: string, badges?: unknown) => ({ ...new SettlementSimulation().serialize(), runId, settings: { tutorialComplete: true }, ...(badges === undefined ? {} : { badges }) });

describe("badges in the save (0.16.0)", () => {
  it("reads, cleans and keeps older saves without badges loading", () => {
    expect(toSavedGame(save("a"), null)?.badges).toBeUndefined();
    expect(toSavedGame(save("a", ["dharma", "bogus", "first-victory"]), null)?.badges).toEqual(["first-victory", "dharma"]);
  });
  it("merges badges from both copies, whichever run wins", () => {
    const local = toSavedGame(save("a", ["first-victory"]), null);
    const cloud = toSavedGame(save("b", ["gajapati"]), null);
    expect(chooseSave(local, cloud)?.badges).toEqual(["first-victory", "gajapati"]);
  });
});
