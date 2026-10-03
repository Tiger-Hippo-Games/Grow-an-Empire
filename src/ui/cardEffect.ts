import { GRANARY_GRAIN, HOUSE_PEOPLE_PER_MOVE, PROCESSORS, RAW_OUTPUT, RESOURCE_NAMES, SOLDIERS, TRAINING_BASE, type ResourceBag } from "../game/economy";
import { amount, icon } from "./icons";

/**
 * What a building does each move, drawn with icons for the card's effect row:
 * "+5 [wood] /move", "[wood]2 → [planks]2 ×3", "+1 [archer] /move".
 * Built from the same numbers as `benefitText()` in content.ts, so the
 * picture and the sentence (still shown on desktop and read aloud) agree.
 */
const PER_MOVE = `<small class="per-move" title="every move">${icon("move")}<span class="sr">every move</span></small>`;

function bag(goods: ResourceBag): string {
  return RESOURCE_NAMES.filter((name) => (goods[name] ?? 0) > 0).map((name) => amount(name, goods[name] as number)).join("");
}

export function effectHtml(id: string): string {
  const raw = RAW_OUTPUT[id];
  if (raw) return `${amount(raw[0], raw[1], { sign: "+" })}${PER_MOVE}`;
  const processor = PROCESSORS.find((entry) => entry.id === id);
  if (processor) {
    const times = processor.cycles > 1 ? `<small class="times">×${processor.cycles}</small>` : "";
    return `${bag(processor.input)}<span class="arrow" aria-label="becomes">→</span>${bag(processor.output)}${times}${PER_MOVE}`;
  }
  const soldier = Object.entries(SOLDIERS).find(([, entry]) => entry.building === id);
  if (soldier) {
    // The training cost is in the card's sentence, behind "i".
    const [type] = soldier;
    return `${amount(type as "archers" | "swordsmen" | "horsemen", TRAINING_BASE, { sign: "+" })}${PER_MOVE}`;
  }
  switch (id) {
    case "house": return `${amount("people", HOUSE_PEOPLE_PER_MOVE, { sign: "+" })}${PER_MOVE}`;
    case "granary": return `${amount("grain", GRANARY_GRAIN, { sign: "+" })}${PER_MOVE}<span class="tag w">no spoiling</span>`;
    case "marketplace": return `${icon("wine")}<span class="arrow" aria-label="sells for">→</span>${icon("gold")}<span class="tag">${icon("market")}${icon("swordsmen")}<span class="w"> sellswords</span></span>`;
    case "barracks": return `${amount("strength", 1, { sign: "+" })}<span class="tag w">training</span>${PER_MOVE}`;
    default: return "";
  }
}
