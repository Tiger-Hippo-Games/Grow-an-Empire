import { describe, expect, it } from "vitest";
import { ROAD_GROWTH_CAP, roadScaleForLevel } from "../cityLayout";
import { CROWD, hallStop, laneOffset, strideFrame } from "../villagers";

describe("roads widen with the city", () => {
  it("grow 5% per completed move, compounding, up to the cap", () => {
    expect(roadScaleForLevel(0)).toBe(1);
    expect(roadScaleForLevel(1)).toBeCloseTo(1.05, 6);
    expect(roadScaleForLevel(2)).toBeCloseTo(1.1025, 6);
    expect(roadScaleForLevel(9)).toBeCloseTo(1.05 ** 9, 6);
    expect(roadScaleForLevel(12)).toBe(ROAD_GROWTH_CAP);
    expect(roadScaleForLevel(-3)).toBe(1);
  });
});

describe("the crowd spreads out and walks in step", () => {
  it("gives neighbours different lanes and different stops short of the Town Hall", () => {
    const lanes = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(laneOffset));
    expect(lanes.size).toBe(8);
    const stops = new Set([0, 1, 2, 3, 4, 5].map((index) => hallStop(index, 20)));
    expect(stops.size).toBe(CROWD.hallStopSlots);
    for (const stop of stops) expect(stop).toBeGreaterThanOrEqual(CROWD.hallStopBase);
    expect(hallStop(3, 2)).toBeLessThanOrEqual(0.8); // A short route keeps most of its length.
  });

  it("changes pose by distance walked, so feet keep pace at any game speed", () => {
    const quarter = CROWD.strideLength / 4;
    expect([0, 1, 2, 3, 4].map((step) => strideFrame(step * quarter + 0.001, 2.15).frame)).toEqual([0, 1, 2, 3, 0]);
    // A bigger figure (a horseman) takes longer strides.
    expect(strideFrame(quarter + 0.001, 2.15 * 1.35).frame).toBe(0);
    // The bob is smooth: zero at foot-fall, highest mid-step.
    expect(strideFrame(0, 2.15).bob).toBeCloseTo(0, 6);
    expect(strideFrame(CROWD.strideLength / 4, 2.15).bob).toBeCloseTo(CROWD.bobHeight, 6);
  });
});

describe("smoother sheets drop in", () => {
  it("indexes 8-pose walk atlases by row, like the 4-pose ones", async () => {
    const { walkAtlasIndex, walkPoseCount, workFrameCount, walkSheetFilename } = await import("../characterAssets");
    expect([0, 1, 2, 3].map((pose) => walkAtlasIndex(3, pose))).toEqual([3, 11, 19, 27]);
    expect([0, 4, 7, 8].map((pose) => walkAtlasIndex(3, pose, 8))).toEqual([3, 35, 59, 3]);
    // Until walk64/work16 sheets are exported, every role keeps its current sheets.
    expect(walkPoseCount("builder")).toBe(8);
    expect(workFrameCount("builder")).toBe(8);
    expect(walkSheetFilename("farmer")).toBe("farmer-walk64-master-v1.png");
  });
});
