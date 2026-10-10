import { beforeEach, describe, expect, it, vi } from "vitest";
import { assetHealth, checkFont, onAssetProblem, recordAudio, recordImageFailed, recordImageLoaded, recordImageRequested, recordSoundPlayed, resetAssetHealthForTests } from "../assetHealth";

describe("asset health (art, font, sound)", () => {
  beforeEach(() => resetAssetHealthForTests());

  it("counts images and reports each failed file once", () => {
    const problems: unknown[] = [];
    const stop = onAssetProblem((problem) => problems.push(problem));
    recordImageRequested(); recordImageRequested();
    recordImageLoaded();
    recordImageFailed("https://cdn.example/play/assets/farm-level-1-2x-v1-AbC12345.webp?v=1", "404");
    recordImageFailed("https://cdn.example/play/assets/farm-level-1-2x-v1-AbC12345.webp?v=1", "404");
    stop();
    expect(assetHealth()).toMatchObject({ imagesRequested: 2, imagesLoaded: 1, imagesFailed: ["farm-level-1-2x-v1-AbC12345.webp"] });
    expect(problems).toHaveLength(1);
  });

  it("records the sound engine's state and every cue played", () => {
    const problems: unknown[] = [];
    onAssetProblem((problem) => problems.push(problem));
    recordAudio("running");
    recordSoundPlayed(); recordSoundPlayed();
    expect(assetHealth()).toMatchObject({ audio: "running", soundsPlayed: 2 });
    recordAudio("unavailable", "no Web Audio");
    expect(problems).toEqual([{ kind: "audio", detail: "no Web Audio" }]);
  });

  it("tells a loaded display font from the fallback", async () => {
    const loaded = { load: vi.fn(async () => []), check: () => true } as unknown as FontFaceSet;
    expect(await checkFont("Yatra One", loaded)).toBe("loaded");
    const missing = { load: vi.fn(async () => []), check: () => false } as unknown as FontFaceSet;
    expect(await checkFont("Yatra One", missing)).toBe("fallback");
    expect(await checkFont("Yatra One", undefined)).toBe("unsupported");
  });
});
