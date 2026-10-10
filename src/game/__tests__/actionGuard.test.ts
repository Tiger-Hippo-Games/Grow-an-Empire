import { describe, expect, it, vi } from "vitest";
import { createActionGuard } from "../actionGuard";

describe("state-changing action failure protection", () => {
  it("preserves the original failure and blocks subsequent mutations", () => {
    let healthy = true;
    const error = new Error("scene failed after a move");
    const failed = vi.fn(() => { healthy = false; });
    const guard = createActionGuard(() => healthy, failed);
    const mutation = vi.fn(() => { throw error; });
    guard("gather", mutation);
    guard("fight", mutation);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledExactlyOnceWith(error, "gather");
  });

  it("allows normal actions and rejects actions before boot without changing state", () => {
    let ready = false;
    const action = vi.fn();
    const failed = vi.fn();
    const guard = createActionGuard(() => ready, failed);
    guard("fight", action);
    ready = true;
    guard("gather", action);
    expect(action).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
  });
});
