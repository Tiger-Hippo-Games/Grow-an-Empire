import { BUILDINGS } from "../game/content";
import { escapeHtml } from "./dom";
import { icon, type IconName } from "./icons";

/**
 * 0.16.2: tap (or click) any game icon to learn what it means.
 *
 * One delegated listener on the stage: an icon outside a button, or an icon
 * chip on a build card, opens a small bubble beside it with the icon, its name
 * and one plain sentence. Icons inside other buttons (Gather, Fight, controls)
 * keep their button's action; those buttons already carry labels.
 * Mouse users also get the name as a hover tooltip (`title`).
 */

interface Help { name: string; text: string }

const b = (id: string): string => BUILDINGS[id]?.name ?? id;

export const ICON_HELP: Partial<Record<IconName | "per-move", Help>> = {
  wood: { name: "Wood", text: `Cut by the ${b("woodcutter")}. Pays for most buildings; the ${b("sawmill")} turns it into planks.` },
  stone: { name: "Stone", text: `Cut at the ${b("quarry")}. Needed for forges, halls, towers and homes.` },
  grain: { name: "Grain", text: `Grown on the ${b("farm")}. The ${b("bakery")} cooks it into rations; the ${b("granary")} stops it spoiling.` },
  livestock: { name: "Cattle", text: `Raised at the ${b("swine-farm")}. The ${b("butchery")} churns their milk into ghee rations.` },
  fruit: { name: "Mangoes", text: `Picked in the ${b("fruit-orchard")}. The ${b("winery")} presses them into soma.` },
  planks: { name: "Planks", text: `Sawn by the ${b("sawmill")}. Trainers use them to arm archers, swordsmen and horsemen.` },
  rations: { name: "Rations", text: "Food for the army. Every 4 soldiers eat 1 ration a move; without rations, training stops." },
  wine: { name: "Soma", text: `Pressed from mangoes. The ${b("marketplace")} sells it for gold.` },
  gold: { name: "Gold", text: `Earned at the ${b("marketplace")}. Hires sellswords before the battle and pays for swaps.` },
  people: { name: "People", text: "Your villagers. Each soldier needs a free villager to train; houses bring more." },
  archers: { name: "Archers", text: "Ranged soldiers. Strong against swordsmen, weak against horsemen." },
  swordsmen: { name: "Swordsmen", text: "Foot soldiers. Strong against horsemen, weak against archers." },
  horsemen: { name: "Horsemen", text: "Cavalry. Strong against archers, weak against swordsmen." },
  militia: { name: "Militia", text: "Villagers who pick up spears in the battle. Weaker than soldiers unless a Burj trains them." },
  elephants: { name: "War elephants", text: `From the ${b("gajashala")}. Each fights like four swordsmen but eats 2 rations a move.` },
  tower: { name: "Watchtower", text: `The ${b("prakara")}'s archers strike first: a quarter of the enemy falls before the lines meet.` },
  move: { name: "Moves", text: "Each build or Gather uses one move. When the moves run out, the enemy attacks." },
  "per-move": { name: "Every move", text: "This happens again after every move, for the rest of the campaign." },
  strength: { name: "Army strength", text: "How strong your army is in battle, against the enemy's strength. Bigger wins." },
  unlock: { name: "Unlocks", text: "Building this opens new buildings or abilities." },
  lock: { name: "Locked", text: "Not available yet. Win earlier campaigns or build what it needs first." },
  warning: { name: "Something stopped", text: "A building lacked supplies or people this move. Fix it to keep the ★ for no resource or population issues." },
  idle: { name: "Idle", text: "This building did nothing this move, usually because an input was missing." },
  market: { name: "Bazaar", text: "Sells soma for gold, swaps spare goods, and hires sellswords before the battle." },
  star: { name: "Stars", text: "Up to 3 per campaign: win, never run out of people, never run out of supplies. Stars unlock campaigns." },
  civic: { name: "Town Hall level", text: "The Town Hall grows with every move, and the city's roads and decorations grow with it." },
  stockpile: { name: "Stockpile", text: "Everything your city has stored. Tap Resources at the top to see it all." },
  build: { name: "Build", text: "Pay the cost once; the building then works every move." },
  rank: { name: "Realm rank", text: "Your place among 1,008 rival rajas. Win campaigns to climb." },
  rival: { name: "Rivals", text: "Rival rajas camped on this campaign in the Realm." },
  report: { name: "Move report", text: "What every building used and made last move, and how your stockpile changed." },
};

/** Which help entry an element stands for, or null. */
function helpKeyFor(element: Element): keyof typeof ICON_HELP | null {
  const iconEl = element.closest<HTMLElement | SVGElement>(".gi, .unit-icon, .army-chip, .qty");
  if (!iconEl) return null;
  if (iconEl.closest(".per-move")) return "per-move";
  const classes = (iconEl.getAttribute("class") ?? "").split(/\s+/);
  for (const cls of classes) {
    const name = cls.startsWith("gi-") ? cls.slice(3) : cls.startsWith("qty-") ? cls.slice(4) : cls.startsWith("unit-") ? cls.slice(5) : null;
    if (name && name in ICON_HELP) return name as IconName;
  }
  // A chip: use the icon inside it.
  const inner = iconEl.querySelector(".gi, .unit-icon");
  if (inner && inner !== iconEl) return helpKeyFor(inner);
  return null;
}

/** Hover names for every game icon (desktop): `title` on painted icons and chips, set once per render via a mutation observer. */
function addTitles(root: ParentNode): void {
  root.querySelectorAll<HTMLElement | SVGElement>(".gi:not([data-help-title]), .unit-icon:not([data-help-title])").forEach((el) => {
    el.setAttribute("data-help-title", "");
    const key = helpKeyFor(el);
    const help = key ? ICON_HELP[key] : undefined;
    if (!help) return;
    if (el instanceof SVGElement) {
      if (!el.querySelector("title")) {
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = help.name;
        el.prepend(title);
      }
    } else if (!el.getAttribute("title")) el.setAttribute("title", help.name);
    el.classList.add("has-help");
  });
}

export function installIconHelp(root: HTMLElement, onUxEvent?: (name: string, properties: Record<string, unknown>) => void): { close(): void } {
  const bubble = document.createElement("div");
  bubble.className = "icon-help hidden";
  bubble.setAttribute("role", "status");
  bubble.setAttribute("aria-live", "polite");
  root.appendChild(bubble);
  let timer = 0;
  let anchor: Element | null = null;

  function close(): void {
    window.clearTimeout(timer);
    bubble.classList.add("hidden");
    anchor = null;
  }

  function open(target: Element, key: keyof typeof ICON_HELP): void {
    const help = ICON_HELP[key];
    if (!help) return;
    const drawn = icon(key === "per-move" ? "move" : key);
    bubble.innerHTML = `<span class="icon-help-art" aria-hidden="true">${drawn}</span><span><strong>${escapeHtml(help.name)}</strong><span>${escapeHtml(help.text)}</span></span>`;
    bubble.classList.remove("hidden");
    // Place beside the icon, inside the stage (stage pixels: undo the stage scale).
    const stage = root.getBoundingClientRect();
    const scale = stage.width / (root.offsetWidth || stage.width) || 1;
    const box = target.getBoundingClientRect();
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    const maxLeft = root.offsetWidth - width - 8;
    let left = (box.left - stage.left) / scale + box.width / (2 * scale) - width / 2;
    left = Math.max(8, Math.min(maxLeft, left));
    let top = (box.top - stage.top) / scale - height - 10;
    if (top < 8) top = (box.bottom - stage.top) / scale + 10;
    top = Math.max(8, Math.min(root.offsetHeight - height - 8, top));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    anchor = target;
    window.clearTimeout(timer);
    timer = window.setTimeout(close, 7000);
    onUxEvent?.("ux_icon_help", { icon: key });
  }

  root.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target || target.closest(".icon-help")) { close(); return; }
    const key = helpKeyFor(target);
    if (!key) { if (!bubble.classList.contains("hidden")) close(); return; }
    const button = target.closest("button");
    // Inside a build card only its cost/effect chips explain (the rest of the card builds);
    // inside any other button the button keeps its action.
    if (button) {
      if (!button.classList.contains("build-card") || !target.closest(".build-costs, .build-effect, .build-unlock")) { close(); return; }
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    const iconEl = target.closest(".gi, .unit-icon, .army-chip, .qty") ?? target;
    if (anchor === iconEl && !bubble.classList.contains("hidden")) { close(); return; }
    open(iconEl, key);
  }, true);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !bubble.classList.contains("hidden")) close(); });
  // Hover names on every icon as screens render.
  addTitles(root);
  new MutationObserver(() => addTitles(root)).observe(root, { childList: true, subtree: true });
  return { close };
}
