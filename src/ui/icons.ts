import type { ResourceName } from "../game/economy";
import { assetUrl, bundledAssetNames } from "../render/assetCatalog";

/**
 * The game's small icon set (Docs/MOBILE_UX_PLAN.md): every resource, unit and
 * rule the player reads as a number gets a picture, so a phone screen can say
 * "+5 [log]" instead of "+5 wood each move, growing with age".
 *
 * Inline SVG, 24 × 24, no downloads: it is part of game.js, stays sharp at any
 * stage scale, and works before any art has loaded. Each icon is decorative
 * (`aria-hidden`); `amount()` adds the word for screen readers in a `.sr` span.
 * Painted icons (commissioned, Docs/ICON_COMMISSION_BRIEF.md) replace the
 * drawings one by one: once `icon-<name>-v1.webp` is bundled in
 * Assets/Runtime, `icon()` shows it instead, with no change to the screens.
 * Controls (play, map, sound…) stay drawn.
 */

export type IconName =
  | ResourceName
  | "people" | "archers" | "swordsmen" | "horsemen" | "militia"
  | "move" | "strength" | "unlock" | "lock" | "warning" | "idle" | "market" | "star" | "civic" | "stockpile" | "build"
  | "play" | "pause" | "speed" | "map" | "more" | "sound" | "mute" | "grid" | "help" | "fullscreen" | "restart" | "eye" | "report" | "close"
  | "thumbup" | "thumbdown";

/** The icons the commissioned painted set replaces (game things, not controls). */
export const PAINTED_ICON_NAMES: readonly IconName[] = [
  "wood", "stone", "grain", "livestock", "fruit", "planks", "rations", "wine", "gold",
  "people", "archers", "swordsmen", "horsemen", "militia",
  "move", "strength", "civic", "stockpile", "build", "market", "unlock", "lock", "warning", "idle", "star",
];

const C = "#f3e7c8"; // control icons: cream line art on the dark panels

const DRAWINGS: Record<IconName, string> = {
  wood: `<rect x="2.5" y="12.5" width="17" height="6.5" rx="3.25" fill="#9a6235"/><circle cx="19" cy="15.75" r="3.25" fill="#e2b77c" stroke="#9a6235" stroke-width="1.2"/><circle cx="19" cy="15.75" r="1.2" fill="#9a6235"/><rect x="4.5" y="5" width="15" height="6.5" rx="3.25" fill="#b4743f"/><circle cx="19" cy="8.25" r="3.25" fill="#ecc78f" stroke="#b4743f" stroke-width="1.2"/><circle cx="19" cy="8.25" r="1.2" fill="#b4743f"/>`,
  stone: `<path d="M3 18.5 6 9.5l5-4 6 2 4 6.5-2 4.5z" fill="#a9adb0"/><path d="M6 9.5l5-4 6 2-5 3.5z" fill="#d3d6d8"/><path d="M11.5 11 17 7.5l4 6.5-6 1z" fill="#8c9194"/><path d="M3 18.5h16" stroke="#6d7276" stroke-width="1.2"/>`,
  grain: `<path d="M12 22V6" stroke="#c99a2e" stroke-width="1.6" stroke-linecap="round"/><g fill="#f0c24b"><ellipse cx="12" cy="4.5" rx="1.7" ry="2.6"/><ellipse cx="9.2" cy="8.6" rx="1.6" ry="2.6" transform="rotate(-35 9.2 8.6)"/><ellipse cx="14.8" cy="8.6" rx="1.6" ry="2.6" transform="rotate(35 14.8 8.6)"/><ellipse cx="9.2" cy="12.8" rx="1.6" ry="2.6" transform="rotate(-35 9.2 12.8)"/><ellipse cx="14.8" cy="12.8" rx="1.6" ry="2.6" transform="rotate(35 14.8 12.8)"/><ellipse cx="9.2" cy="17" rx="1.6" ry="2.6" transform="rotate(-35 9.2 17)"/><ellipse cx="14.8" cy="17" rx="1.6" ry="2.6" transform="rotate(35 14.8 17)"/></g>`,
  livestock: `<path d="M5 8 3.5 3.5 8.5 6zM19 8l1.5-4.5L15.5 6z" fill="#d98a92"/><circle cx="12" cy="13" r="8" fill="#eda6ad"/><ellipse cx="12" cy="15.5" rx="4" ry="3" fill="#d98a92"/><circle cx="10.5" cy="15.5" r="0.9" fill="#7a3b42"/><circle cx="13.5" cy="15.5" r="0.9" fill="#7a3b42"/><circle cx="8.5" cy="10.5" r="1" fill="#3a2326"/><circle cx="15.5" cy="10.5" r="1" fill="#3a2326"/>`,
  fruit: `<path d="M12 7c-3.5-2-8-.5-8 5 0 5 3.5 9.5 6 9.5 1 0 1.3-.5 2-.5s1 .5 2 .5c2.5 0 6-4.5 6-9.5 0-5.5-4.5-7-8-5z" fill="#d9483b"/><path d="M12 7c0-2 .5-3.5 2-4.5" stroke="#6b4423" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M13.5 4.5c2-1.5 4.5-1 5 .5-1.5 1.5-4 1.5-5-.5z" fill="#6aa84f"/><ellipse cx="8.5" cy="11" rx="1.2" ry="2" fill="#f08a7f"/>`,
  planks: `<rect x="2.5" y="4" width="19" height="4.6" rx="1" fill="#d6a868"/><rect x="2.5" y="9.7" width="19" height="4.6" rx="1" fill="#c4914f"/><rect x="2.5" y="15.4" width="19" height="4.6" rx="1" fill="#d6a868"/><path d="M6 6.3h5M13 12h6M5 17.7h7" stroke="#8f6232" stroke-width="0.9" stroke-linecap="round"/>`,
  rations: `<path d="M3 15c0-5 4-8.5 9-8.5s9 3.5 9 8.5c0 2-1 3.5-3 3.5H6c-2 0-3-1.5-3-3.5z" fill="#c98a3d"/><path d="M5 15c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5" fill="#e0a85a"/><path d="M8 10.5l1.5 3M12 9.5v3.5M16 10.5l-1.5 3" stroke="#9b6326" stroke-width="1.3" stroke-linecap="round"/>`,
  wine: `<path d="M7 3h10l-.5 5.5c-.3 3-2.2 5-4.5 5s-4.2-2-4.5-5z" fill="#e8e1d4" fill-opacity="0.35" stroke="#e8e1d4" stroke-width="1"/><path d="M7.4 7h9.2l-.1 1.5c-.3 3-2.2 5-4.5 5s-4.2-2-4.5-5z" fill="#8e2d55"/><path d="M12 13.5V19M8 20.5h8" stroke="#e8e1d4" stroke-width="1.6" stroke-linecap="round"/>`,
  gold: `<circle cx="12" cy="12" r="9" fill="#e9b93a"/><circle cx="12" cy="12" r="6.5" fill="#f6d36b" stroke="#c4911c" stroke-width="1"/><path d="M8.6 10.2A4 4 0 0 1 12 8" stroke="#fff3c4" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M12 9.6l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z" fill="#c4911c"/>`,
  people: `<circle cx="9" cy="7.5" r="3.3" fill="#e8d7b4"/><path d="M2.5 20c0-4 2.9-7 6.5-7s6.5 3 6.5 7z" fill="#e8d7b4"/><circle cx="16.5" cy="8.5" r="2.7" fill="#bfae8c"/><path d="M14.5 13.4c.6-.2 1.3-.3 2-.3 3 0 5 2.6 5 6.4h-4.7" fill="#bfae8c"/>`,
  archers: `<path d="M6 3c7 3 7 15 0 18" stroke="#d6a868" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M6 3v18" stroke="#efe6d2" stroke-width="0.9"/><path d="M4 12h16" stroke="#efe6d2" stroke-width="1.5" stroke-linecap="round"/><path d="M20.5 12l-3-2.2v4.4z" fill="#c3c8cc"/><path d="M4 12l-1.5-1.8M4 12l-1.5 1.8" stroke="#d9483b" stroke-width="1.3" stroke-linecap="round"/>`,
  swordsmen: `<path d="M17.5 3.5 20.5 3.5 20.5 6.5 9.5 17.5 6.5 14.5z" fill="#d3d6d8"/><path d="M20.5 3.5 9.5 14.5" stroke="#8c9194" stroke-width="0.8"/><path d="M4.5 13.5l6 6M6 16.5 3 19.5l1.5 1.5 3-3" stroke="#c4911c" stroke-width="2" stroke-linecap="round"/>`,
  horsemen: `<path d="M6.5 20.5V11a5.5 5.5 0 0 1 11 0v9.5" stroke="#c3c8cc" stroke-width="3.2" fill="none" stroke-linecap="round"/><g fill="#5c6166"><circle cx="6.5" cy="12.5" r="0.8"/><circle cx="6.8" cy="16.5" r="0.8"/><circle cx="17.5" cy="12.5" r="0.8"/><circle cx="17.2" cy="16.5" r="0.8"/><circle cx="9" cy="7.2" r="0.8"/><circle cx="15" cy="7.2" r="0.8"/></g>`,
  militia: `<path d="M12 9v12.5" stroke="#9a6235" stroke-width="1.8" stroke-linecap="round"/><path d="M7 2.5V7a5 5 0 0 0 10 0V2.5M12 2.5V9" stroke="#c3c8cc" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  move: `<path d="M19 12a7 7 0 1 1-2.05-4.95" stroke="#f0c24b" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20 3.5v5h-5" stroke="#f0c24b" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  strength: `<path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z" fill="#3f6fb5"/><path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10z" fill="#2f568f"/><path d="M8.5 11.5l2.5 2.5 4.5-5" stroke="#f6e7c1" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  unlock: `<circle cx="7.5" cy="12" r="4.5" fill="none" stroke="#f0c24b" stroke-width="2.2"/><path d="M12 12h9.5M18.5 12v3.5M15.5 12v2.5" stroke="#f0c24b" stroke-width="2.2" stroke-linecap="round"/>`,
  lock: `<rect x="4.5" y="10.5" width="15" height="10.5" rx="2" fill="#a9adb0"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="#a9adb0" stroke-width="2.2" fill="none"/><circle cx="12" cy="15.5" r="1.6" fill="#4b4f53"/>`,
  warning: `<path d="M12 3 22 20H2z" fill="#e6a23c" stroke="#e6a23c" stroke-width="1.5" stroke-linejoin="round"/><path d="M12 9v5.5" stroke="#3a2a10" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1.2" fill="#3a2a10"/>`,
  idle: `<circle cx="12" cy="12" r="9" fill="none" stroke="#a9adb0" stroke-width="2"/><path d="M9.5 8.5v7M14.5 8.5v7" stroke="#a9adb0" stroke-width="2.2" stroke-linecap="round"/>`,
  market: `<path d="M3 9.5 5 4h14l2 5.5z" fill="#d9483b"/><path d="M7 4 6 9.5M12 4v5.5M17 4l1 5.5" stroke="#f6e7c1" stroke-width="1.6"/><rect x="4.5" y="9.5" width="15" height="10.5" fill="#c4914f"/><rect x="9.5" y="13" width="5" height="7" fill="#7a5128"/>`,
  star: `<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="#f0c24b"/>`,
  civic: `<path d="M5 21V4" stroke="#c3c8cc" stroke-width="1.8" stroke-linecap="round"/><path d="M5.8 4.5h12l-2.6 3.6 2.6 3.6h-12z" fill="#c9452f"/><path d="M8 7.2h5" stroke="#f0c24b" stroke-width="1.2" stroke-linecap="round"/>`,
  stockpile: `<rect x="3" y="9" width="18" height="12" rx="1.5" fill="#b4743f"/><path d="M3 13h18M3 17h18M9 9v12M15 9v12" stroke="#7a4b24" stroke-width="1"/><path d="M5 9l3-5h8l3 5" fill="#d6a868"/>`,
  build: `<path d="M13.5 9.5 4 19l1.8 1.8L15.3 11.3" stroke="#b4743f" stroke-width="2.4" stroke-linecap="round"/><path d="M11.5 4.5l4-1.5 5.5 5.5-2.5 2.5-2-2-2.5 2.5-3-3 2.5-2.5z" fill="#c3c8cc"/>`,
  play: `<path d="M8 5v14l11-7z" fill="${C}"/>`,
  pause: `<rect x="6.5" y="5" width="4" height="14" rx="1" fill="${C}"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="${C}"/>`,
  speed: `<path d="M3.5 6v12l8-6zM12.5 6v12l8-6z" fill="${C}"/>`,
  map: `<path d="M3 6.5 8.5 4l7 2.5L21 4v13.5L15.5 20l-7-2.5L3 20z" fill="none" stroke="${C}" stroke-width="1.7" stroke-linejoin="round"/><path d="M8.5 4v13.5M15.5 6.5V20" stroke="${C}" stroke-width="1.4"/>`,
  more: `<circle cx="5.5" cy="12" r="2" fill="${C}"/><circle cx="12" cy="12" r="2" fill="${C}"/><circle cx="18.5" cy="12" r="2" fill="${C}"/>`,
  sound: `<path d="M4 9.5h4l5-4v13l-5-4H4z" fill="${C}"/><path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" stroke="${C}" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
  mute: `<path d="M4 9.5h4l5-4v13l-5-4H4z" fill="${C}"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="${C}" stroke-width="1.8" stroke-linecap="round"/>`,
  grid: `<path d="M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" stroke="${C}" stroke-width="1.5" fill="none"/>`,
  help: `<circle cx="12" cy="12" r="9" fill="none" stroke="${C}" stroke-width="1.8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7v.5" stroke="${C}" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.2" r="1.1" fill="${C}"/>`,
  fullscreen: `<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" stroke="${C}" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  restart: `<path d="M5 12a7 7 0 1 0 2.05-4.95" stroke="#ffb49c" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M4 3.5v5h5" stroke="#ffb49c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  eye: `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" fill="none" stroke="${C}" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="${C}"/>`,
  report: `<path d="M6 3h9l4 4v14H6z" fill="none" stroke="${C}" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 11h7M9 14.5h7M9 18h4" stroke="${C}" stroke-width="1.5" stroke-linecap="round"/><path d="M12.3 4.8l.6 1.2 1.3.2-.9.9.2 1.3-1.2-.6-1.2.6.2-1.3-.9-.9 1.3-.2z" fill="#f0c24b"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18" stroke="${C}" stroke-width="2.2" stroke-linecap="round"/>`,
  thumbup: `<path d="M7 10.5V20H4v-9.5zM9 20h8.2a2 2 0 0 0 2-1.6l1.2-6a2 2 0 0 0-2-2.4H14l.7-3.5a1.7 1.7 0 0 0-3.1-1.2L9 10z" fill="#bfe3a8"/>`,
  thumbdown: `<path d="M7 13.5V4H4v9.5zM9 4h8.2a2 2 0 0 1 2 1.6l1.2 6a2 2 0 0 1-2 2.4H14l.7 3.5a1.7 1.7 0 0 1-3.1 1.2L9 14z" fill="#ffb49c"/>`,
};

const WORDS: Partial<Record<IconName, [string, string]>> = {
  wood: ["wood", "wood"], stone: ["stone", "stone"], grain: ["grain", "grain"], livestock: ["livestock", "livestock"],
  fruit: ["fruit", "fruit"], planks: ["plank", "planks"], rations: ["ration", "rations"], wine: ["wine", "wine"], gold: ["gold", "gold"],
  people: ["person", "people"], archers: ["archer", "archers"], swordsmen: ["swordsman", "swordsmen"], horsemen: ["horseman", "horsemen"], militia: ["militia", "militia"],
};

/** The painted version's URL, once the commissioned art is bundled. */
let painted: Map<IconName, string> | null = null;
function paintedUrl(name: IconName): string | undefined {
  if (!painted) {
    painted = new Map();
    const bundled = new Set(bundledAssetNames());
    for (const iconName of PAINTED_ICON_NAMES) {
      const file = paintedIconFilename(iconName);
      if (bundled.has(file.replace(/\.png$/, ".webp"))) painted.set(iconName, assetUrl(file));
    }
  }
  return painted.get(name);
}

/** The production filename a painted icon is delivered as (Assets/Art/Production/Icons/). */
export function paintedIconFilename(name: IconName): string {
  return `icon-${name}-v1.png`;
}

/** The word a screen reader hears for `amount` of `name` ("1 plank", "4 wood"). */
export function iconWord(name: IconName, amount = 2): string {
  const words = WORDS[name];
  if (!words) return name;
  return words[Math.abs(amount) === 1 ? 0 : 1];
}

/** One decorative icon. `title` makes it a labelled image instead (for an icon with no number beside it). */
export function icon(name: IconName, title?: string): string {
  const label = title ? ` role="img" aria-label="${title.replace(/"/g, "&quot;")}"` : ` aria-hidden="true"`;
  const painted = paintedUrl(name);
  if (painted) return `<img class="gi gi-${name} painted" src="${painted}" alt="${title ? title.replace(/"/g, "&quot;") : ""}"${title ? "" : ` aria-hidden="true"`} draggable="false" />`;
  return `<svg class="gi gi-${name}" viewBox="0 0 24 24" focusable="false"${label}>${DRAWINGS[name]}</svg>`;
}

export interface AmountOptions {
  /** "+" or "−" in front of the number. */
  sign?: "+" | "−";
  /** Extra class names (e.g. "short" when the player can't pay it). */
  className?: string;
  /** Text after the number, e.g. "/move". */
  suffix?: string;
}

/** An icon and a number, read aloud as "4 wood": `<span class="qty"><svg/>4</span>`. */
export function amount(name: IconName, value: number | string, options: AmountOptions = {}): string {
  const number = `${options.sign ?? ""}${value}`;
  const count = typeof value === "number" ? value : Number.parseFloat(String(value)) || 2;
  const classes = ["qty", `qty-${name}`, options.className].filter(Boolean).join(" ");
  const suffix = options.suffix ? `<small>${options.suffix}</small>` : "";
  return `<span class="${classes}">${icon(name)}<b>${number}</b><span class="sr"> ${iconWord(name, count)}</span>${suffix}</span>`;
}
