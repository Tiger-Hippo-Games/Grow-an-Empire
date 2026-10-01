import { CAMPAIGNS, isCampaignUnlocked, starsToUnlock, totalStars, type CampaignDefinition } from "../game/campaigns";
import { assetUrl } from "../render/assetCatalog";
import { IMAGE_TIMEOUT_MS } from "../render/spriteAssets";
import { requireElement } from "./dom";

/**
 * The campaign map: one tall painting (Tools/ArtPipeline/make_campaign_road_map.py)
 * that the player scrolls up, from the camps of campaign 1 at the bottom to
 * the enemy fortress of campaign 25 at the top.
 *
 * Every stop is a fraction of the painting's width and height, placed on a
 * village, camp or crossing in the art. They stay inside the central band
 * (x 0.40–0.61) because narrow phones show only the middle of the painting.
 * Change the art and these move with it; keep them in this one list so the
 * road, the buttons, the highlight ring and the scroll position agree.
 */
const MAP_ART = "southern-road-map-v6.png";
/** Height ÷ width of the painting. */
const ART_ASPECT = 1930 / 1672;
export const STOPS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.40, y: 0.925 }, { x: 0.60, y: 0.889 }, { x: 0.53, y: 0.853 }, { x: 0.40, y: 0.817 }, { x: 0.58, y: 0.781 },
  { x: 0.47, y: 0.745 }, { x: 0.58, y: 0.709 }, { x: 0.42, y: 0.673 }, { x: 0.61, y: 0.637 }, { x: 0.43, y: 0.601 },
  { x: 0.58, y: 0.565 }, { x: 0.40, y: 0.529 }, { x: 0.56, y: 0.493 }, { x: 0.40, y: 0.457 }, { x: 0.58, y: 0.421 },
  { x: 0.46, y: 0.385 }, { x: 0.58, y: 0.349 }, { x: 0.45, y: 0.313 }, { x: 0.60, y: 0.277 }, { x: 0.42, y: 0.241 },
  { x: 0.53, y: 0.205 }, { x: 0.42, y: 0.169 }, { x: 0.60, y: 0.133 }, { x: 0.42, y: 0.097 }, { x: 0.52, y: 0.061 },
];
/** Where the road enters the map, below campaign 1. */
const ROAD_START = { x: 0.5, y: 1 };
/** Five campaigns per chapter, bottom to top. */
const CHAPTERS = ["Southern hamlets", "River country", "Woodland road", "Outer marches", "Far frontier"] as const;
const PER_CHAPTER = 5;
const NUMERALS = ["I", "II", "III", "IV", "V"] as const;
/**
 * At least 1150 px tall so the 25 stops keep about 42 px apart on a phone; a
 * taller board shows less of the painting's sides instead of squeezing it.
 */
const MIN_BOARD_HEIGHT = 1150;
/** Boards narrower than this hide the stop names (the card says them) and keep the chapter rail clear of the stops. */
const WIDE_BOARD = 700;
const RAIL_WIDTH = 56;

const stars = (earned: number): string => `${"★".repeat(earned)}${"☆".repeat(3 - earned)}`;
const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Smooth road through the points (Catmull-Rom spline as cubic Béziers). */
function roadPath(points: ReadonlyArray<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** The illustrated route is UI only; main.ts owns campaign selection and saves. */
export function createCampaignMap(onLaunch: (campaign: CampaignDefinition) => void) {
  const map = requireElement<HTMLElement>("#campaign-map");
  const scroller = requireElement<HTMLElement>("#campaign-scroller");
  const board = requireElement<HTMLElement>("#campaign-board");
  const stops = requireElement<HTMLElement>("#campaign-stops");
  const highlight = requireElement<HTMLElement>("#province-highlight");
  const fog = requireElement<HTMLElement>("#campaign-fog");
  const rail = requireElement<HTMLElement>("#campaign-rail");
  const jump = requireElement<HTMLButtonElement>("#campaign-jump");
  const chapterName = requireElement<HTMLElement>("#campaign-chapter");
  const chapterNote = requireElement<HTMLElement>("#campaign-chapter-note");
  const stage = requireElement<HTMLElement>("#campaign-stage");
  const title = requireElement<HTMLElement>("#campaign-name");
  const copy = requireElement<HTMLElement>("#campaign-copy");
  const briefing = requireElement<HTMLElement>("#campaign-briefing");
  const state = requireElement<HTMLElement>("#campaign-state");
  const launch = requireElement<HTMLButtonElement>("#campaign-launch");

  // CSS backgrounds don't report load errors. Probe the same bundled image so
  // a failed download falls back to a plain parchment map (still playable)
  // with a logged warning. The browser cache avoids a second transfer.
  try {
    const url = assetUrl(MAP_ART);
    const image = new Image();
    let settled = false;
    const fail = (cause: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      map.classList.add("map-art-failed");
      console.warn(`[Grow an Empire] Campaign map artwork failed to load: ${MAP_ART}`, cause);
    };
    const timeout = setTimeout(() => fail(new Error(`Timed out after ${IMAGE_TIMEOUT_MS / 1000} s`)), IMAGE_TIMEOUT_MS);
    image.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      board.style.setProperty("--campaign-map-image", `url("${url}")`);
      map.classList.add("map-art-ready");
    };
    image.onerror = (event) => fail(event);
    image.src = url;
  } catch (error) {
    map.classList.add("map-art-failed");
    console.warn(`[Grow an Empire] Campaign map artwork is unavailable: ${MAP_ART}`, error);
  }

  let activeId = CAMPAIGNS[0].id;
  let earnedStars: Record<string, number> = {};
  let selectedIndex = 0;
  let currentRunIsComplete = false;
  let currentMove = 1;

  const unlocked = (index: number): boolean => isCampaignUnlocked(index + 1, earnedStars);
  const won = (index: number): boolean => index >= 0 && (earnedStars[CAMPAIGNS[index].id] ?? 0) > 0;

  // --- Board geometry ------------------------------------------------------
  // The board is as wide as the scroller and at least MIN_BOARD_HEIGHT tall.
  // The painting covers it (cropped at the sides when the board is narrow),
  // centred on the part of the board the chapter rail leaves free.
  let geometry = { width: 0, height: 0, artWidth: 0, offsetX: 0 };
  const toBoard = (point: { x: number; y: number }): { x: number; y: number } =>
    ({ x: point.x * geometry.artWidth - geometry.offsetX, y: point.y * geometry.height });

  const road = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  road.setAttribute("class", "campaign-road");
  road.setAttribute("aria-hidden", "true");
  const roadAhead = document.createElementNS("http://www.w3.org/2000/svg", "path");
  roadAhead.setAttribute("class", "road-ahead");
  const roadDone = document.createElementNS("http://www.w3.org/2000/svg", "path");
  roadDone.setAttribute("class", "road-done");
  road.append(roadAhead, roadDone);
  stops.before(road);

  const chapterLabels = CHAPTERS.map((name, chapter) => {
    const label = document.createElement("div");
    label.className = "campaign-region";
    label.innerHTML = `<b>${NUMERALS[chapter]}</b><span>${name}</span><small>Campaigns ${chapter * PER_CHAPTER + 1}–${chapter * PER_CHAPTER + PER_CHAPTER}</small>`;
    label.setAttribute("aria-hidden", "true");
    board.appendChild(label);
    return label;
  });

  /** One rail button per chapter; the last chapter (top of the map) is listed first. */
  const railButtons = CHAPTERS.map((name, chapter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rail-chapter";
    button.textContent = NUMERALS[chapter];
    button.title = `${name}: campaigns ${chapter * PER_CHAPTER + 1}–${chapter * PER_CHAPTER + PER_CHAPTER}`;
    button.setAttribute("aria-label", `Chapter ${chapter + 1}, ${name}: show campaigns ${chapter * PER_CHAPTER + 1} to ${chapter * PER_CHAPTER + PER_CHAPTER}`);
    button.addEventListener("click", () => scrollToY(chapterCenterY(chapter), true));
    return button;
  });
  rail.replaceChildren(...[...railButtons].reverse());

  function chapterCenterY(chapter: number): number {
    const ys = STOPS.slice(chapter * PER_CHAPTER, chapter * PER_CHAPTER + PER_CHAPTER).map((stop) => toBoard(stop).y);
    return (Math.min(...ys) + Math.max(...ys)) / 2;
  }

  function layout(): void {
    const width = scroller.clientWidth;
    if (width === 0) return; // Hidden: laid out again when shown.
    const wide = width >= WIDE_BOARD;
    const usable = wide ? width : width - RAIL_WIDTH;
    const height = Math.max(Math.round(width * ART_ASPECT), MIN_BOARD_HEIGHT);
    const artWidth = height / ART_ASPECT;
    geometry = { width, height, artWidth, offsetX: (artWidth - usable) / 2 };
    map.classList.toggle("narrow-board", !wide);
    board.style.height = `${height}px`;
    board.style.setProperty("--art-width", `${artWidth}px`);
    board.style.setProperty("--art-offset", `${-geometry.offsetX}px`);
    road.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // Chapter titles sit beside the road on wide boards, alternating sides.
    chapterLabels.forEach((label, chapter) => {
      label.style.left = `${(chapter % 2 === 0 ? 0.2 : 0.8) * artWidth - geometry.offsetX}px`;
      label.style.top = `${chapterCenterY(chapter)}px`;
    });
    drawRoute();
    placeStops();
  }

  /** The road: walked (up to the furthest campaign won) and still ahead; fog over the land not yet open. */
  function drawRoute(): void {
    if (geometry.width === 0) return;
    const points = [ROAD_START, ...STOPS].map(toBoard);
    let reached = 0;
    STOPS.forEach((_, index) => { if (won(index)) reached = index + 1; });
    roadAhead.setAttribute("d", roadPath(points));
    roadDone.setAttribute("d", reached > 0 ? roadPath(points.slice(0, reached + 1)) : "");
    // The next campaign to open stays clear, as a goal; the land past it is in shadow.
    const firstLocked = STOPS.findIndex((_, index) => !unlocked(index));
    const shadowFrom = firstLocked < 0 ? -1 : firstLocked + 1;
    fog.style.height = shadowFrom < 0 || shadowFrom >= STOPS.length ? "0px" : `${Math.max(0, toBoard(STOPS[shadowFrom]).y + 30)}px`;
  }

  function placeStops(): void {
    if (geometry.width === 0) return;
    [...stops.children].forEach((child, index) => {
      const point = toBoard(STOPS[index]);
      const element = child as HTMLElement;
      element.style.left = `${point.x}px`;
      element.style.top = `${point.y}px`;
    });
    const selected = toBoard(STOPS[selectedIndex]);
    highlight.style.left = `${selected.x}px`;
    highlight.style.top = `${selected.y}px`;
  }

  // --- Scrolling -----------------------------------------------------------
  function scrollToY(y: number, smooth: boolean): void {
    const top = Math.max(0, Math.min(y - scroller.clientHeight / 2, scroller.scrollHeight - scroller.clientHeight));
    scroller.scrollTo({ top, behavior: smooth && !reducedMotion() ? "smooth" : "instant" });
  }

  function centerSelected(smooth = false): void {
    scrollToY(toBoard(STOPS[selectedIndex]).y, smooth);
  }

  /** The chapter in view (heading and rail), and the "back to the selected campaign" button. */
  function updateScrollState(): void {
    if (geometry.width === 0) return;
    const middle = scroller.scrollTop + scroller.clientHeight / 2;
    let chapter = 0;
    let best = Infinity;
    CHAPTERS.forEach((_, index) => {
      const distance = Math.abs(chapterCenterY(index) - middle);
      if (distance < best) { best = distance; chapter = index; }
    });
    // At either end of the road, the end chapter is the one in view.
    if (scroller.scrollTop <= 2) chapter = CHAPTERS.length - 1;
    else if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) chapter = 0;
    railButtons.forEach((button, index) => {
      button.classList.toggle("active", index === chapter);
      if (index === chapter) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    chapterName.textContent = `${NUMERALS[chapter]} · ${CHAPTERS[chapter]}`;
    chapterNote.textContent = `Campaigns ${chapter * PER_CHAPTER + 1}–${chapter * PER_CHAPTER + PER_CHAPTER} of ${CAMPAIGNS.length}. Scroll or drag along the road.`;
    const y = toBoard(STOPS[selectedIndex]).y;
    const above = y < scroller.scrollTop + 24;
    const below = y > scroller.scrollTop + scroller.clientHeight - 24;
    jump.hidden = !(above || below);
    jump.dataset.direction = above ? "up" : "down";
    jump.textContent = `${above ? "↑" : "↓"} Campaign ${selectedIndex + 1}`;
  }
  let scrollFrame = 0;
  scroller.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; updateScrollState(); });
  }, { passive: true });
  jump.addEventListener("click", () => centerSelected(true));

  // Drag to scroll with a mouse (touch and trackpads scroll natively). A drag
  // of more than a few pixels doesn't count as a click on the stop under it.
  let drag: { id: number; y: number; top: number; moved: boolean } | null = null;
  let suppressClick = false;
  scroller.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag = { id: event.pointerId, y: event.clientY, top: scroller.scrollTop, moved: false };
  });
  scroller.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    // clientY is in screen pixels; the fixed stage may be scaled (index.html).
    const scale = scroller.getBoundingClientRect().height / Math.max(1, scroller.clientHeight) || 1;
    const dy = (event.clientY - drag.y) / scale;
    if (!drag.moved && Math.abs(dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      scroller.setPointerCapture(event.pointerId);
      map.classList.add("dragging");
    }
    scroller.scrollTop = drag.top - dy;
  });
  const endDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
    map.classList.remove("dragging");
  };
  scroller.addEventListener("pointerup", endDrag);
  scroller.addEventListener("pointercancel", endDrag);
  scroller.addEventListener("click", (event) => {
    if (!suppressClick) return;
    event.stopPropagation();
    event.preventDefault();
    suppressClick = false;
  }, true);

  // Keyboard: the arrows walk the road (up = the next campaign); Home and End
  // jump to the first and the furthest open one.
  map.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") next = Math.min(CAMPAIGNS.length - 1, selectedIndex + 1);
    else if (event.key === "ArrowDown" || event.key === "ArrowLeft") next = Math.max(0, selectedIndex - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = CAMPAIGNS.reduce((last, _, index) => (unlocked(index) ? index : last), 0);
    else return;
    event.preventDefault();
    select(next, true);
  });

  function select(index: number, smooth: boolean): void {
    selectedIndex = index;
    render();
    stops.querySelectorAll<HTMLButtonElement>("button")[index]?.focus({ preventScroll: true });
    centerSelected(smooth);
  }

  // --- Stops and the campaign card ------------------------------------------
  function render(): void {
    stops.replaceChildren();
    CAMPAIGNS.forEach((campaign, index) => {
      const button = document.createElement("button");
      button.type = "button";
      const open = unlocked(index);
      const earned = earnedStars[campaign.id] ?? 0;
      const side = STOPS[index].x < 0.5 ? "left" : "right";
      button.className = `campaign-stop label-${side}${index === selectedIndex ? " selected" : ""}${won(index) ? " completed" : ""}${activeId === campaign.id && !currentRunIsComplete ? " current" : ""}${open ? "" : " locked"}`;
      button.setAttribute("aria-label", `Campaign ${index + 1}, ${campaign.name}: ${won(index) ? `won, ${earned} of 3 stars` : open ? "open" : "locked"}`);
      if (index === selectedIndex) button.setAttribute("aria-current", "true");
      const flag = document.createElement("span");
      flag.className = "stop-flag";
      flag.setAttribute("aria-hidden", "true");
      flag.textContent = String(index + 1);
      const label = document.createElement("span");
      label.className = "stop-label";
      label.setAttribute("aria-hidden", "true");
      const name = document.createElement("strong");
      name.textContent = campaign.name;
      const progress = document.createElement("span");
      progress.className = "stop-stars";
      progress.textContent = earned ? stars(earned) : open ? "Open" : "Locked";
      label.append(name, progress);
      button.append(flag, label);
      if (earned) {
        const badge = document.createElement("span");
        badge.className = "stop-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = stars(earned);
        button.appendChild(badge);
      }
      button.addEventListener("click", () => select(index, true));
      stops.appendChild(button);
    });
    placeStops();
    drawRoute();

    const campaign = CAMPAIGNS[selectedIndex];
    stage.textContent = `CAMPAIGN ${selectedIndex + 1} OF ${CAMPAIGNS.length} · ${totalStars(earnedStars)} ★`;
    title.textContent = campaign.name;
    copy.textContent = campaign.subtitle;
    // A run that hasn't built anything yet is offered as a fresh start.
    const isCurrent = activeId === campaign.id && currentMove > 1;
    const movesUntilAttack = isCurrent && !currentRunIsComplete ? Math.max(1, campaign.moveLimit - currentMove + 1) : campaign.moveLimit;
    briefing.textContent = `${campaign.objective.enemyName} from ${campaign.objective.kingdomName} arrive in ${movesUntilAttack} ${movesUntilAttack === 1 ? "move" : "moves"}. ${campaign.objective.briefing}`;
    const earned = earnedStars[campaign.id] ?? 0;
    const open = unlocked(selectedIndex);
    let progress: string;
    if (!open) {
      const previous = CAMPAIGNS[selectedIndex - 1];
      const needed = starsToUnlock(selectedIndex + 1);
      progress = !won(selectedIndex - 1) ? `Locked: win ${previous.name} first` : `Locked: needs ${needed} ★ in total (you have ${totalStars(earnedStars)}). Replay earlier campaigns for more stars.`;
    } else {
      progress = earned ? `Best: ${stars(earned)} · replay for more stars` : isCurrent && currentRunIsComplete ? "Defeat · try again" : isCurrent ? "Settlement in progress" : "Open";
    }
    state.textContent = `${campaign.objective.strength} enemy ${campaign.objective.strength === 1 ? "soldier" : "soldiers"} · ${progress}`;
    launch.disabled = !open;
    launch.textContent = !open ? "Locked" : isCurrent && !currentRunIsComplete ? "Continue settlement" : earned ? "Replay campaign" : "Begin campaign";
    updateScrollState();
  }

  // Re-fit when the frame changes (rotation, resize, fixed ↔ fluid layout),
  // keeping the selected campaign in view.
  let lastWidth = 0;
  let lastHeight = 0;
  const refit = (): void => {
    if (map.classList.contains("hidden")) return;
    if (scroller.clientWidth === lastWidth && scroller.clientHeight === lastHeight) return;
    lastWidth = scroller.clientWidth;
    lastHeight = scroller.clientHeight;
    layout();
    centerSelected();
    updateScrollState();
  };
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(refit).observe(scroller);
  else window.addEventListener("resize", refit);

  launch.addEventListener("click", () => {
    if (!unlocked(selectedIndex)) return;
    try {
      onLaunch(CAMPAIGNS[selectedIndex]);
    } catch (error) {
      console.error("[Grow an Empire] Could not start the selected campaign", error);
      state.textContent = "Could not start this campaign. Reload to retry.";
    }
  });

  return {
    show(activeCampaignId: string, campaignStars: Readonly<Record<string, number>>, runComplete: boolean, move: number) {
      activeId = activeCampaignId;
      earnedStars = { ...campaignStars };
      currentRunIsComplete = runComplete;
      currentMove = move;
      const activeIndex = Math.max(0, CAMPAIGNS.findIndex((campaign) => campaign.id === activeCampaignId));
      const next = CAMPAIGNS.findIndex((_, index) => unlocked(index) && !won(index));
      selectedIndex = !runComplete ? activeIndex : next >= 0 ? next : activeIndex;
      map.classList.remove("hidden");
      layout(); // After un-hiding, so the scroller has a size.
      render();
      lastWidth = scroller.clientWidth;
      lastHeight = scroller.clientHeight;
      centerSelected();
      updateScrollState();
      launch.focus({ preventScroll: true });
    },
    hide() {
      const hadFocus = map.contains(document.activeElement);
      map.classList.add("hidden");
      // The launch button becomes hidden here. Return keyboard focus to the
      // visible map toggle instead of leaving it on the document body.
      if (hadFocus) document.getElementById("map-toggle")?.focus();
    },
    get isOpen() { return !map.classList.contains("hidden"); },
  };
}
