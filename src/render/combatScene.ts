import { assetUrl } from "./assetCatalog";

/**
 * Unit icons for the dialogs and the popup battle (render/popupBattle.ts):
 * the first frame of each soldier's combat sheet, so they need no extra art.
 * (The old icon-strip battle and the battle fought in the city were removed in
 * 0.10.2; the fight is shown in the muster popup.)
 */
export type IconKind = "archers" | "swordsmen" | "horsemen" | "militia";
const SHEETS: Record<"archers" | "swordsmen" | "horsemen" | "enemy", string> = {
  archers: "archer-combat-south8-master-v1.png",
  swordsmen: "swordsman-combat-south8-master-v1.png",
  horsemen: "horseman-combat-south8-master-v1.png",
  enemy: "enemy-combat-north8-master-v1.png",
};

/** CSS `background` for a unit icon: the sheet is 4 × 2 frames; frame 0 is the ready pose. */
export function iconStyle(kind: IconKind, enemy: boolean): string {
  if (kind === "militia") return "";
  const url = assetUrl(enemy ? SHEETS.enemy : SHEETS[kind]);
  return `background-image:url("${url}")`;
}
