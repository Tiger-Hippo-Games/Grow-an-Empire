/**
 * The economy's numbers, in one place: what the founding camp starts with,
 * what each building costs and produces, what a soldier costs, and what goods
 * are worth at the Marketplace. Pure data and pure functions (no state), so
 * the rules in `settlementSimulation.ts`, the card text in the HUD and the
 * balance tests all read the same values.
 *
 * Design: "Grow an Empire: Economy & Army Design" (project docs). The balance
 * test (`__tests__/balance.test.ts`) plays every build order under these rules;
 * change a number here and it tells you what that did to each campaign.
 */

export type ResourceName = "wood" | "stone" | "grain" | "livestock" | "fruit" | "planks" | "rations" | "wine" | "gold";
export type ResourceBag = Partial<Record<ResourceName, number>>;

/** Player-facing label for each resource. Its key order is also the HUD stockpile order. */
export const RESOURCE_LABELS: Record<ResourceName, string> = {
  wood: "Wood", stone: "Stone", grain: "Grain", livestock: "Cattle", fruit: "Mangoes",
  planks: "Planks", rations: "Rations", wine: "Soma", gold: "Gold",
};
export const RESOURCE_NAMES = Object.keys(RESOURCE_LABELS) as ResourceName[];

/** What the founding camp starts with: enough for all three opening buildings (9 wood). */
export const STARTING_STOCKPILE: ResourceBag = { wood: 14, stone: 8, grain: 4, rations: 6 };

/** Camp supplies restore these reserves after each move; wood/stone cover a Granary. */
export const MINIMUM_MOVE_STOCKPILE: ResourceBag = { wood: 4, stone: 2, grain: 2, rations: 1 };

/** Build cost of every building, paid when construction starts. */
export const BUILDING_COSTS: Record<string, ResourceBag> = {
  woodcutter: { wood: 2 },
  farm: { wood: 3 },
  quarry: { wood: 4 },
  "swine-farm": { wood: 4, grain: 2 },
  "fruit-orchard": { wood: 4 },
  sawmill: { wood: 4, stone: 2 },
  butchery: { planks: 3, stone: 2 },
  bakery: { planks: 3, stone: 3 },
  house: { planks: 3, stone: 3 },
  granary: { wood: 4, stone: 2 },
  winery: { planks: 3, stone: 2 },
  marketplace: { planks: 4, stone: 4 },
  "weapons-workshop": { planks: 4, stone: 3 },
  blacksmith: { planks: 3, stone: 4 },
  barracks: { planks: 4, stone: 5 },
  stable: { planks: 5, stone: 5, grain: 3 },
  baoli: { wood: 3, stone: 3 },
  prakara: { wood: 4, stone: 6 },
  gajashala: { planks: 5, stone: 4, grain: 3 },
  "dharma-stambha": { planks: 4, stone: 6 },
  burj: { planks: 3, stone: 2 },
  sarai: { planks: 4, stone: 2 },
  koshagar: { stone: 4, planks: 2 },
  dharmashala: { planks: 3, grain: 2 },
};

/** Raw producers: resource and base output per move. Output grows by 1 every 3 moves standing. */
export const RAW_OUTPUT: Record<string, [ResourceName, number]> = {
  woodcutter: ["wood", 5],
  farm: ["grain", 3],
  quarry: ["stone", 3],
  "swine-farm": ["livestock", 2],
  "fruit-orchard": ["fruit", 2],
};

/** Processors: one cycle turns `input` into `output`; `cycles` per move at age 1, +1 every 3 moves. */
export const PROCESSORS: Array<{ id: string; cycles: number; input: ResourceBag; output: ResourceBag }> = [
  { id: "sawmill", cycles: 3, input: { wood: 2 }, output: { planks: 2 } },
  { id: "bakery", cycles: 1, input: { grain: 2 }, output: { rations: 3 } },
  { id: "butchery", cycles: 1, input: { livestock: 1 }, output: { rations: 3 } },
  { id: "winery", cycles: 1, input: { fruit: 2 }, output: { wine: 1 } },
];

/** The Granary adds this much grain per move; without one, grain above the cap spoils. */
export const GRANARY_GRAIN = 1;
export const GRAIN_SPOIL_CAP = 8;
/** The Baoli (stepwell) waters every food producer: farms, the Mango Grove and the Goshala. */
export const BAOLI_FED = ["farm", "fruit-orchard", "swine-farm"] as const;
/** Extra output per watered producer when the Baoli opens; it grows by 1 every 3 moves the Baoli stands. */
export const BAOLI_BASE_BONUS = 2;
/** With water to spare, the food processors (Royal Kitchen, Ghee House, Soma Press) each run this many more cycles a move. */
export const BAOLI_PROCESSOR_CYCLES = 1;
export const BAOLI_PROCESSORS = ["bakery", "butchery", "winery"] as const;
export function baoliBonus(baoliAge: number): number {
  return BAOLI_BASE_BONUS + ageBonus(baoliAge);
}

/** The Prakara (watchtower) fells this share of the enemy before the armies meet. */
export const PRAKARA_REDUCTION = 0.25;
/** The Gajashala sends one war elephant on completion, then one every this many moves. */
export const ELEPHANT_INTERVAL = 6;
/** A war elephant fights like this many swordsmen. */
export const ELEPHANT_SWORDSMEN = 4;
/** Upkeep weight of an elephant: 8 = two rations a move (a ration feeds 4 weight). */
export const ELEPHANT_UPKEEP_WEIGHT = 8;
/** The Dharma Stambha raises the army's battle strength by this share. */
export const DHARMA_STAMBHA_BONUS = 0.2;
/** Every war building must stand before the Dharma Stambha can be raised. */
export const WAR_BUILDINGS = ["blacksmith", "weapons-workshop", "barracks", "stable", "gajashala"] as const;

/** The Burj (bastion): villagers drill there, so militia fight at full strength and more can stand. */
export const BURJ_MILITIA_STRENGTH = 1;
export const BURJ_MILITIA_CAP = 14;
/** The Sarai (caravanserai): Bazaar swaps buy at this multiple of the selling price instead of `BUY_MULTIPLIER`, and the Bazaar sells this many more goods a move. */
export const SARAI_BUY_MULTIPLIER = 1.5;
export const SARAI_EXTRA_SALES = 1;
/** The Koshagar (treasury): +1 gold a move for every `KOSHAGAR_GOLD_STEP` gold stored (at most `KOSHAGAR_MAX_INTEREST`), and more sellswords can be hired. */
export const KOSHAGAR_GOLD_STEP = 5;
export const KOSHAGAR_MAX_INTEREST = 6;
export const KOSHAGAR_SELLSWORD_CAP = 2;
/** The Dharmashala (rest house): people when it opens, more for every move after; every 4th soldier needs no villager of his own. */
export const DHARMASHALA_OPENING_PEOPLE = 6;
export const DHARMASHALA_PEOPLE_PER_MOVE = 2;
export function dharmashalaPeople(age: number): number {
  return age > 0 ? DHARMASHALA_OPENING_PEOPLE + DHARMASHALA_PEOPLE_PER_MOVE * (age - 1) : 0;
}
export const DHARMASHALA_SOLDIERS_PER_SAVED_VILLAGER = 4;
/** Settlers who stay add to the militia: the militia cap rises by this much. */
export const DHARMASHALA_MILITIA_CAP = 4;

/** People a House adds for every move it has stood. */
export const HOUSE_PEOPLE_PER_MOVE = 2;

export type SoldierType = "archers" | "swordsmen" | "horsemen";
/** Where each soldier trains and what one costs. Every soldier also needs one free villager. */
export const SOLDIERS: Record<SoldierType, { building: string; cost: ResourceBag; label: string; singular: string }> = {
  archers: { building: "weapons-workshop", cost: { planks: 2 }, label: "archers", singular: "archer" },
  swordsmen: { building: "blacksmith", cost: { planks: 1, stone: 1 }, label: "swordsmen", singular: "swordsman" },
  horsemen: { building: "stable", cost: { planks: 1, grain: 2 }, label: "horsemen", singular: "horseman" },
};
export const SOLDIER_TYPES = Object.keys(SOLDIERS) as SoldierType[];
/** Training per move at a military building: 1, +1 after 3 moves standing, +1 more with a Barracks. */
export const TRAINING_BASE = 1;
export const BARRACKS_TRAINING_BONUS = 1;
/** One ration feeds this many soldiers a move; a horseman eats for two. */
export const SOLDIERS_PER_RATION = 4;
export const UPKEEP_WEIGHT: Record<SoldierType, number> = { archers: 1, swordsmen: 1, horsemen: 2 };

/** Marketplace prices in gold: what a good sells for. Buying costs `BUY_MULTIPLIER` times as much. */
export const SELL_PRICE: Record<ResourceName, number> = {
  stone: 0.5, wood: 1, grain: 1, livestock: 1, fruit: 1, planks: 2, rations: 2, wine: 5, gold: 1,
};
export const BUY_MULTIPLIER = 2;
/** Order goods are sold in when the market covers a shortfall: least useful first. */
export const SWAP_SELL_ORDER: ResourceName[] = ["gold", "stone", "fruit", "livestock", "grain", "wood", "wine", "rations", "planks"];
/** The Marketplace sells this many goods a move on its own (wine first), +1 every 3 moves. */
export const MARKET_SALES_PER_MOVE = 1;
/** It only sells planks the city has beyond this reserve, so it never starves construction. */
export const MARKET_PLANK_RESERVE = 8;

/** Pre-battle market: a sellsword costs this much gold; at most half the enemy's head count can be hired. */
export const SELLSWORD_COST = 15;

/** Age bonus shared by producers, processors, training and the market: +1 every 3 moves standing. */
export function ageBonus(age: number): number {
  return Math.max(0, Math.floor((age - 1) / 3));
}

export function emptyStockpile(): Record<ResourceName, number> {
  return Object.fromEntries(RESOURCE_NAMES.map((name) => [name, 0])) as Record<ResourceName, number>;
}

export function startingStockpile(): Record<ResourceName, number> {
  const stockpile = emptyStockpile();
  for (const [name, amount] of Object.entries(STARTING_STOCKPILE) as Array<[ResourceName, number]>) stockpile[name] = amount;
  return stockpile;
}

/** What `stock` still lacks to pay `cost` (empty when it can pay). */
export function shortfall(stock: Record<ResourceName, number>, cost: ResourceBag): ResourceBag {
  const missing: ResourceBag = {};
  for (const [name, amount] of Object.entries(cost) as Array<[ResourceName, number]>) {
    const lack = amount - (stock[name] ?? 0);
    if (lack > 0) missing[name] = lack;
  }
  return missing;
}

export function canAfford(stock: Record<ResourceName, number>, cost: ResourceBag): boolean {
  return Object.keys(shortfall(stock, cost)).length === 0;
}

/** The gold value of a stockpile if everything were sold (rounded down). */
export function goldValue(stock: Record<ResourceName, number>): number {
  return Math.floor(RESOURCE_NAMES.reduce((sum, name) => sum + (stock[name] ?? 0) * SELL_PRICE[name], 0));
}

/** "4 planks, 3 stone" */
export function formatBag(bag: ResourceBag): string {
  const parts = (Object.entries(bag) as Array<[ResourceName, number]>).filter(([, amount]) => amount > 0)
    .map(([name, amount]) => `${amount} ${amount === 1 && (name === "planks" || name === "rations") ? name.slice(0, -1) : RESOURCE_LABELS[name].toLowerCase()}`);
  return parts.length ? parts.join(", ") : "nothing";
}

/**
 * A stuck-move swap plan: what to sell (least useful goods first, never what
 * the card itself needs) to buy what the card is missing. `null` when the
 * city can't cover it. Deterministic, so the UI preview and the rules agree.
 */
/** A Marketplace swap. `change`: whole gold left over after buying (goods sell in whole units), kept by the player. */
export interface SwapPlan { buy: ResourceBag; sell: ResourceBag; goldNeeded: number; goldRaised: number; change: number }
export function planSwap(stock: Record<ResourceName, number>, cost: ResourceBag, buyMultiplier = BUY_MULTIPLIER): SwapPlan | null {
  const buy = shortfall(stock, cost);
  const goldNeeded = (Object.entries(buy) as Array<[ResourceName, number]>).reduce((sum, [name, amount]) => sum + amount * SELL_PRICE[name] * buyMultiplier, 0);
  if (goldNeeded <= 0) return null;
  const sell: ResourceBag = {};
  let goldRaised = 0;
  for (const name of SWAP_SELL_ORDER) {
    const spare = (stock[name] ?? 0) - (cost[name] ?? 0);
    let sold = 0;
    while (goldRaised < goldNeeded && sold < spare) {
      sold += 1;
      goldRaised += SELL_PRICE[name];
    }
    if (sold > 0) sell[name] = sold;
    if (goldRaised >= goldNeeded) break;
  }
  if (goldRaised < goldNeeded) return null;
  return { buy, sell, goldNeeded, goldRaised, change: Math.floor(goldRaised - goldNeeded + 1e-9) };
}
