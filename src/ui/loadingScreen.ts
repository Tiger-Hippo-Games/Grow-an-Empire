import { BUILDINGS } from "../game/content";

/** One tip per building, sharing the same economy-backed text as its card. */
export const BUILDING_LOADING_HINTS = Object.values(BUILDINGS).map(building => ({
  id: building.id, name: building.name, benefit: building.benefit,
}));

export function createLoadingScreen(loading: HTMLElement) {
  const tip = loading.querySelector<HTMLElement>("#loading-tip")!;
  const name = loading.querySelector<HTMLElement>("#loading-building")!;
  const benefit = loading.querySelector<HTMLElement>("#loading-benefit")!;
  const bar = loading.querySelector<HTMLElement>("#loading-progress")!;
  const fill = loading.querySelector<HTMLElement>("#loading-fill")!;
  const label = loading.querySelector<HTMLElement>("#loading-label")!;
  let active = true, index = Math.floor(Math.random() * BUILDING_LOADING_HINTS.length), percent = 0;
  function showTip(): void {
    const hint = BUILDING_LOADING_HINTS[index];
    name.textContent = hint.name;
    benefit.textContent = hint.benefit;
  }
  showTip();
  const timer = window.setInterval(() => {
    // The HTML boot watchdog can replace the loader before main.ts catches a failure.
    if (!loading.contains(tip) || loading.classList.contains("hidden")) { stop(); return; }
    index = (index + 1) % BUILDING_LOADING_HINTS.length;
    showTip();
  }, 4000);
  function stop(): void {
    active = false;
    window.clearInterval(timer);
    tip.classList.add("hidden");
  }
  function paintProgress(value: number): void {
    percent = Math.max(percent, value);
    bar.setAttribute("aria-valuenow", String(percent));
    fill.style.transform = `scaleX(${percent / 100})`;
  }
  return {
    setProgress(settled: number, requested: number): void {
      if (!active || requested <= 0) return;
      // Reserve the final 10% for restoring the city and preparing the title screen.
      paintProgress(Math.min(90, Math.max(0, Math.floor(settled / requested * 90))));
      label.textContent = `Preparing the city… ${percent}%`;
    },
    finish(): void {
      paintProgress(100);
      stop();
      loading.classList.add("hidden");
    },
    stop,
  };
}
