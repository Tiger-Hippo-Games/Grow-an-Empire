import { assetUrl } from "./assetCatalog";

/**
 * Unit icons for the dialogs and the popup battle (render/popupBattle.ts):
 * the first frame of each soldier's combat sheet, so they need no extra art.
 * (The old icon-strip battle and the battle fought in the city were removed in
 * 0.10.2; the fight is shown in the muster popup.)
 */
export type IconKind = "archers" | "swordsmen" | "horsemen" | "elephants" | "militia";

/**
 * Stand-in war elephant (0.10.4) until a painted combat sheet exists
 * (Docs/BUILDING_ART_BRIEF.md): one inline drawing, shown whole, not as a sheet.
 */
const ELEPHANT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 21v-4.2M9.2 21v-3.6M15 21v-3.6M18.2 21v-4.6" stroke="#6f6b69" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="12.6" cy="13.7" rx="7.2" ry="5" fill="#8e8a88"/><circle cx="6.2" cy="11.3" r="3.9" fill="#8e8a88"/><path d="M3.4 12.7c-1 2.4-1.2 5 .1 7.6" stroke="#8e8a88" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M5.2 14.1 2.6 15.5" stroke="#f3ead6" stroke-width="1.2" stroke-linecap="round"/><circle cx="5.4" cy="10.7" r=".8" fill="#2b2420"/><path d="M10.5 8.9h6.6l.8 3.4h-8.2z" fill="#c9452f"/><path d="M13 8.9V6.4" stroke="#6b4423" stroke-width="1.2"/><circle cx="13" cy="5.4" r="1.4" fill="#e8d2a4"/></svg>`;
const ELEPHANT_URL = `data:image/svg+xml,${encodeURIComponent(ELEPHANT_SVG)}`;
const SHEETS: Record<"archers" | "swordsmen" | "horsemen" | "enemy", string> = {
  archers: "archer-combat-south8-master-v1.png",
  swordsmen: "swordsman-combat-south8-master-v1.png",
  horsemen: "horseman-combat-south8-master-v1.png",
  enemy: "enemy-combat-north8-master-v1.png",
};

/** CSS `background` for a unit icon: the sheet is 4 × 2 frames; frame 0 is the ready pose. */
export function iconStyle(kind: IconKind, enemy: boolean): string {
  if (kind === "militia") return "";
  if (kind === "elephants") return `background-image:url("${ELEPHANT_URL}")`;
  const url = assetUrl(enemy ? SHEETS.enemy : SHEETS[kind]);
  return `background-image:url("${url}")`;
}
