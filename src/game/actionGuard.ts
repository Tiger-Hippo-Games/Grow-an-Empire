/** Stop at the first failed state-changing action; never retry partial mutations. */
export function createActionGuard(canRun: () => boolean, onFailure: (error: unknown, where: string) => void) {
  return (where: string, action: () => void): void => {
    if (!canRun()) return;
    try { action(); }
    catch (error) { onFailure(error, where); }
  };
}
