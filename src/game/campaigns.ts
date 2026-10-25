import type { EnemyArmy, StarMargins } from "./battle";
import { MAX_CAMPAIGN_MOVES } from "./content";

/**
 * The 25 campaigns: five chapters of five on the road through Bharatvarsha.
 * Every campaign uses the same rules (the same starting stockpile and
 * buildings); only the enemy and the number of moves before it arrives can
 * change. Within each chapter the order is easy, medium, medium, medium,
 * hard, and each chapter is harder than the one before (`targetWinShare`).
 * Each enemy was sized with the balance simulation: exhaustive orders at 12
 * moves, 4,096 seeded build-first journeys per longer move limit. Star
 * margins follow how far the winning orders win by (`__tests__/balance.test.ts` keeps both honest; rerun
 * `npx tsx Tools/balance/calibrate.ts` after a rules change).
 */

/** The threat faced after the final move. */
export interface CampaignObjective {
  enemyName: string;
  kingdomName: string;
  /** One line for the enemy briefing popup. */
  briefing: string;
  /** What counters this army, in plain words. */
  counterHint: string;
  /** Total enemy head count (kept for older code paths and analytics). */
  strength: number;
  army: EnemyArmy;
}

export type CampaignTier = "easy" | "medium" | "hard";

/** One playable campaign. `id` is stored in saves, so a save only loads into its own campaign. */
export interface CampaignDefinition {
  id: string;
  /** 1-based position on the campaign road. */
  number: number;
  /** 0-based chapter (five campaigns each). */
  chapter: number;
  tier: CampaignTier;
  name: string;
  subtitle: string;
  /** Build moves before the enemy arrives (8–25; read this, never assume a number). */
  moveLimit: number;
  availableBuildingIds: string[];
  objective: CampaignObjective;
  /** Historical strength bands used by AI Realm calibration; player stars use campaignRating.ts. */
  stars: StarMargins;
}

/** The five chapters of the road through Bharatvarsha, bottom of the map to the top. */
export const CHAPTERS: ReadonlyArray<{ name: string; lore: string }> = [
  { name: "Vanavasa", lore: "The exile begins at a sacred fire in the forest." },
  { name: "Ganga-tira", lore: "River kingdoms, fords and mercenary forts." },
  { name: "Dandakaranya", lore: "The dark forest, where warriors swear never to retreat." },
  { name: "Himavat", lore: "Mountain passes, fens and the gandharva woods." },
  { name: "Dharmakshetra", lore: "The field of dharma, where Durjaya the Unconquered waits." },
];

/** Campaigns per chapter on the road. */
export const CAMPAIGNS_PER_CHAPTER = 5;
/** Shortest and longest campaign the rules support. */
export const MIN_CAMPAIGN_MOVES = 8;

/** Preparation grows with the journey; the final campaign has 25 moves. */
export function campaignMoves(number: number): number {
  if (number <= 5) return 12;
  if (number <= 10) return 14;
  if (number <= 15) return 15;
  if (number <= 20) return 16;
  if (number <= 22) return 18;
  if (number <= 24) return 20;
  return 25;
}

/** Easy, medium, medium, medium, hard, repeating every chapter. */
export function campaignTier(number: number): CampaignTier {
  const position = (number - 1) % CAMPAIGNS_PER_CHAPTER;
  return position === 0 ? "easy" : position === CAMPAIGNS_PER_CHAPTER - 1 ? "hard" : "medium";
}

/**
 * The share of all build orders that should beat campaign `number`. Each
 * chapter's easy campaign is 12 points harder than the last chapter's (100%,
 * 88%, 76%, 64%, 52%); its mediums are 12, 16 and 20 points below its easy one;
 * its hard one 35 points below, plus 3 more per chapter (65% … 5%).
 */
export function targetWinShare(number: number): number {
  const chapter = Math.floor((number - 1) / CAMPAIGNS_PER_CHAPTER);
  const position = (number - 1) % CAMPAIGNS_PER_CHAPTER;
  const easy = 1 - 0.12 * chapter;
  if (position === 0) return easy;
  if (position === CAMPAIGNS_PER_CHAPTER - 1) return easy - 0.35 - 0.03 * chapter;
  return easy - 0.12 - 0.04 * (position - 1);
}

/** Enemy mix per campaign: S swordsmen, A archers, H horsemen. Every chapter changes the combinations. */
export const ENEMY_MIX = [
  "S", "A", "H", "SA", "SAH",
  "H", "S", "AH", "A", "SH",
  "SA", "H", "S", "SH", "SAH",
  "A", "SH", "H", "SA", "AH",
  "S", "AH", "H", "SA", "SAH",
] as const;

const ALL_BUILDINGS = [
  "woodcutter", "farm", "swine-farm", "bakery", "sawmill", "butchery", "fruit-orchard", "winery",
  "quarry", "house", "granary", "marketplace", "blacksmith", "weapons-workshop", "barracks", "stable",
  "baoli", "prakara", "gajashala", "dharma-stambha", "burj", "sarai", "koshagar", "dharmashala",
];

export interface CampaignSeed {
  /** Part of the save id: never change it for an existing campaign. */
  slug: string; name: string; subtitle: string; enemyName: string; kingdomName: string; briefing: string;
  swordsmen: number; archers: number; horsemen?: number; veterancy?: number; two: number; three: number;
  /** Build moves (8–25, clamped to MIN/MAX_CAMPAIGN_MOVES); journey schedule when left out. */
  moves?: number;
}

/** Enemy sizes, veterancy and star margins come from Tools/balance/calibrate.ts. Slugs are the original ones so saves keep their stars. */
export const CAMPAIGN_SEEDS: CampaignSeed[] = [
  { slug: "first-muster", name: "The First Fire", subtitle: "Light the sacred fire of your exile before the scouts return.", enemyName: "The Nagadanta Scout", kingdomName: "Nagadanta clan", briefing: "A lone Nagadanta scout circles your sacred fire.", swordsmen: 1, archers: 0, horsemen: 0, veterancy: 1, two: 0.5, three: 1 },
  { slug: "reedmarsh", name: "Kusha Marsh", subtitle: "Bowmen lurk in the kusha grass by the new fields.", enemyName: "The Kantaka Bowmen", kingdomName: "Kusha Marsh", briefing: "Thorn-fletched arrows hiss out of the marsh grass.", swordsmen: 0, archers: 10, horsemen: 0, veterancy: 1.06, two: 0.5, three: 1 },
  { slug: "ashfang-raiders", name: "Nagadanta Riders", subtitle: "The scout brought his clan, on horseback.", enemyName: "The Nagadanta Riders", kingdomName: "Nagadanta clan", briefing: "Nagadanta riders thunder out of the forest.", swordsmen: 0, archers: 0, horsemen: 6, veterancy: 1.1, two: 0.5, three: 1 },
  { slug: "iron-tusk", name: "Vindhya Gate", subtitle: "Brigands hold the gate through the hills.", enemyName: "The Pashana Brigands", kingdomName: "Vindhya hills", briefing: "Brigands with blades and bows hold the hill gate.", swordsmen: 7, archers: 6, horsemen: 0, veterancy: 1, two: 0.4, three: 1 },
  { slug: "grey-hood", name: "Yaksha Wood", subtitle: "The guardians of the forest test the exile.", enemyName: "The Yaksha Host", kingdomName: "Yaksha Wood", briefing: "The forest's guardians come with blade, bow and horse.", swordsmen: 4, archers: 3, horsemen: 4, veterancy: 1.06, two: 0.3, three: 0.75 },
  { slug: "cinderfield", name: "Agnikshetra", subtitle: "Riders burn their way across the plain.", enemyName: "The Dahana Riders", kingdomName: "Agnikshetra", briefing: "Riders with torches race across the burnt plain.", swordsmen: 0, archers: 0, horsemen: 11, veterancy: 1.02, two: 0.5, three: 1 },
  { slug: "wolfmoor", name: "Matsya Ford", subtitle: "Giant clansmen hold the river ford.", enemyName: "The Bhimakaya Clansmen", kingdomName: "Matsya Ford", briefing: "A wall of giant clansmen wades the ford.", swordsmen: 24, archers: 0, horsemen: 0, veterancy: 1.08, two: 0.5, three: 1 },
  { slug: "thornwood", name: "Kampilya Reeds", subtitle: "Mounted hunters who shoot at a sound.", enemyName: "The Shabdabhedi Hunters", kingdomName: "Kampilya Reeds", briefing: "Hunters on foot and horse loose arrows at every sound.", swordsmen: 0, archers: 8, horsemen: 8, veterancy: 1.06, two: 0.5, three: 0.9 },
  { slug: "ashfang-warband", name: "The Nagadanta Warband", subtitle: "The clan returns with its bowmen.", enemyName: "The Nagadanta Warband", kingdomName: "Nagadanta clan", briefing: "Nagadanta bowmen march to war drums.", swordsmen: 0, archers: 24, horsemen: 0, veterancy: 1, two: 0.5, three: 0.95 },
  { slug: "black-anvil", name: "Lohagarh", subtitle: "Iron-bodied mercenaries guard the iron fort.", enemyName: "The Lohakaya Company", kingdomName: "Lohagarh", briefing: "Mercenaries in iron, on foot and on horse.", swordsmen: 11, archers: 0, horsemen: 12, veterancy: 1.08, two: 0.3, three: 0.55 },
  { slug: "sable-crow", name: "Kaka Ridge", subtitle: "An army marches under the crow banner.", enemyName: "The Crow-Banner Company", kingdomName: "Kaka Ridge", briefing: "Blades and bows under the crow banner.", swordsmen: 15, archers: 14, horsemen: 0, veterancy: 1, two: 0.5, three: 1 },
  { slug: "duskriver", name: "Sandhya River", subtitle: "Horse raiders ford the river at dusk.", enemyName: "The Sandhya Raiders", kingdomName: "Sandhya River", briefing: "Raiders gallop through the shallows at dusk.", swordsmen: 0, archers: 0, horsemen: 20, veterancy: 1, two: 0.5, three: 0.75 },
  { slug: "blood-oath", name: "The Oath of Blood", subtitle: "Warriors sworn to win or die.", enemyName: "The Samshaptakas", kingdomName: "Samshaptaka camp", briefing: "Oath-sworn warriors who never turn back.", swordsmen: 47, archers: 0, horsemen: 0, veterancy: 1.02, two: 0.25, three: 0.4 },
  { slug: "hollow-peak", name: "Meru Heights", subtitle: "Lancers and shield-men hold the heights.", enemyName: "The Shringa Lancers", kingdomName: "Meru Heights", briefing: "Shield-men hold the line while lancers charge.", swordsmen: 16, archers: 0, horsemen: 16, veterancy: 1.02, two: 0.3, three: 0.45 },
  { slug: "red-banner", name: "Raktadhvaja", subtitle: "A full army under red banners.", enemyName: "The Red-Banner Akshauhini", kingdomName: "Raktadhvaja", briefing: "Blades, bows and cavalry in one great host.", swordsmen: 14, archers: 14, horsemen: 14, veterancy: 1.02, two: 0.1, three: 0.2 },
  { slug: "stonejaw", name: "Shiladanta", subtitle: "Archers loose from the cliffs of stone.", enemyName: "The Shiladanta Archers", kingdomName: "Shiladanta cliffs", briefing: "Stone-jaw archers rain arrows from the cliffs.", swordsmen: 0, archers: 47, horsemen: 0, veterancy: 1, two: 0.3, three: 0.5 },
  { slug: "nightfen", name: "Tamasa Fen", subtitle: "Stalkers who strike from the fog.", enemyName: "The Tamasa Stalkers", kingdomName: "Tamasa Fen", briefing: "Shadows on foot and horse slip out of the fen.", swordsmen: 21, archers: 0, horsemen: 22, veterancy: 1.02, two: 0.2, three: 0.3 },
  { slug: "twin-serpent", name: "Twin Nagas", subtitle: "Two serpent clans ride as one.", enemyName: "The Twin-Naga Cavalry", kingdomName: "Twin Naga vale", briefing: "Two clans of riders charge as one.", swordsmen: 0, archers: 0, horsemen: 29, veterancy: 1.18, two: 0.2, three: 0.25 },
  { slug: "iron-tusk-horde", name: "The Pashana Horde", subtitle: "The brigands of the hill gate return in force.", enemyName: "The Pashana Horde", kingdomName: "Vindhya hills", briefing: "Every brigand of the hills, blades and bows.", swordsmen: 42, archers: 21, horsemen: 0, veterancy: 1.02, two: 0.15, three: 0.2 },
  { slug: "silverleaf", name: "Rajata Vana", subtitle: "Celestial archers ride the silver forest.", enemyName: "The Gandharva Rangers", kingdomName: "Rajata Vana", briefing: "Gandharva archers on swift horses.", swordsmen: 0, archers: 25, horsemen: 25, veterancy: 1.04, two: 0.05, three: 0.1 },
  { slug: "ashfang-council", name: "The Nagadanta Council", subtitle: "The clan chiefs lead in person.", enemyName: "The Nagadanta War Council", kingdomName: "Nagadanta clan", briefing: "The clan chiefs and their sworn guard.", swordsmen: 92, archers: 0, horsemen: 0, veterancy: 1.02, two: 0.1, three: 0.25 },
  { slug: "grim-harrow", name: "Ghora Fields", subtitle: "Horse archers burn the fields behind them.", enemyName: "The Ghora Horde", kingdomName: "Ghora Fields", briefing: "Horse archers who leave nothing standing.", swordsmen: 0, archers: 30, horsemen: 31, veterancy: 1.02, two: 0.15, three: 0.25 },
  { slug: "thousand-arrows", name: "Sahasra-ashva", subtitle: "A thousand hooves shake the ground.", enemyName: "The Thousand Hooves", kingdomName: "Sahasra plains", briefing: "More horses than you can count.", swordsmen: 0, archers: 0, horsemen: 76, veterancy: 1.02, two: 0.1, three: 0.2 },
  { slug: "crown-of-cinders", name: "The Ember Throne", subtitle: "A king who burns what he cannot rule.", enemyName: "The Angara Raja", kingdomName: "The Ember Throne", briefing: "The Ember King's own army of blades and bows.", swordsmen: 64, archers: 63, horsemen: 0, veterancy: 1.06, two: 0.05, three: 0.15 },
  { slug: "ashfang-warlord", name: "Dharmakshetra", subtitle: "The last stand on the field of dharma.", enemyName: "Durjaya the Unconquered", kingdomName: "Dharmakshetra", briefing: "Durjaya brings every blade, bow and horse.", swordsmen: 80, archers: 80, horsemen: 80, veterancy: 1, two: 0.05, three: 0.15 },
];

function hintFor(army: EnemyArmy): string {
  const kinds = (["swordsmen", "archers", "horsemen"] as const).filter((kind) => army[kind] > 0);
  if (kinds.length > 1) return "A mixed army is never badly countered.";
  if (kinds[0] === "swordsmen") return "Archers are strong against a swordsman horde.";
  if (kinds[0] === "archers") return "Horsemen ride down archers; swordsmen suffer under their volleys.";
  return "Swordsmen stop a cavalry charge.";
}

export function campaignFromSeed(seed: CampaignSeed, index: number): CampaignDefinition {
  const army: EnemyArmy = { swordsmen: seed.swordsmen, archers: seed.archers, horsemen: seed.horsemen ?? 0, veterancy: seed.veterancy ?? 1 };
  return {
    // Campaign 1 keeps its original id so existing saves still load into it.
    id: index === 0 ? "campaign-1-first-muster" : `campaign-${index + 1}-${seed.slug}`,
    number: index + 1,
    chapter: Math.floor(index / CAMPAIGNS_PER_CHAPTER),
    tier: campaignTier(index + 1),
    name: seed.name,
    subtitle: seed.subtitle,
    moveLimit: Math.min(MAX_CAMPAIGN_MOVES, Math.max(MIN_CAMPAIGN_MOVES, seed.moves ?? campaignMoves(index + 1))),
    availableBuildingIds: ALL_BUILDINGS,
    objective: {
      enemyName: seed.enemyName,
      kingdomName: seed.kingdomName,
      briefing: seed.briefing,
      counterHint: hintFor(army),
      strength: army.swordsmen + army.archers + army.horsemen,
      army,
    },
    stars: { two: seed.two, three: seed.three },
  };
}

export const CAMPAIGNS: readonly CampaignDefinition[] = CAMPAIGN_SEEDS.map(campaignFromSeed);

export const CAMPAIGN_1 = CAMPAIGNS[0];

export function campaignById(id: string): CampaignDefinition | undefined {
  return CAMPAIGNS.find((campaign) => campaign.id === id);
}

/** Stars needed in total to open campaign `number` (1-based): 1.8 × the campaigns before it, rounded down. */
export function starsToUnlock(number: number): number {
  return number <= 1 ? 0 : Math.floor(1.8 * (number - 1));
}

export function totalStars(stars: Readonly<Record<string, number>>): number {
  return CAMPAIGNS.reduce((sum, campaign) => sum + Math.max(0, Math.min(3, stars[campaign.id] ?? 0)), 0);
}

/** Whether campaign `number` is open: the one before it is won, and enough stars are held in total. */
export function isCampaignUnlocked(number: number, stars: Readonly<Record<string, number>>): boolean {
  if (!Number.isInteger(number) || number > CAMPAIGNS.length) return false;
  if (number <= 1) return true;
  const previous = CAMPAIGNS[number - 2];
  return (stars[previous.id] ?? 0) >= 1 && totalStars(stars) >= starsToUnlock(number);
}
